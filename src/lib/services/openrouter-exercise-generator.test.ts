import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExerciseGenerationRequest } from "@/types";

import { generateOpenRouterExercises, OpenRouterExerciseGeneratorError } from "./openrouter-exercise-generator";

const request: ExerciseGenerationRequest = {
  grade: 4,
  topic: "addition-subtraction",
  difficulty: "easy",
};

const config = { apiKey: "test-secret", model: "test/model" };

function providerResponse(exercises: unknown[]): Response {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ exercises }) } }],
  });
}

function validExercises(count = 5) {
  return Array.from({ length: count }, (_, index) => ({
    text: `Oblicz ${index + 1} + 1.`,
    proposedCanonicalAnswer: String(index + 2),
  }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("generateOpenRouterExercises", () => {
  it("requests strict non-streaming output and returns five normalized candidates", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse(validExercises()));
    let nextId = 0;

    const candidates = await generateOpenRouterExercises(request, config, {
      fetch: fetchMock,
      createId: () => `candidate-${(nextId += 1)}`,
    });

    expect(candidates).toHaveLength(5);
    expect(candidates[0]).toEqual({
      id: "candidate-1",
      text: "Oblicz 1 + 1.",
      proposedCanonicalAnswer: "2",
      ...request,
      approvalStatus: "unverified",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: "Bearer test-secret",
      "Content-Type": "application/json",
    });
    const requestBody = init?.body;
    expect(typeof requestBody).toBe("string");
    if (typeof requestBody !== "string") {
      throw new TypeError("Expected a string request body");
    }
    const body = JSON.parse(requestBody) as {
      stream: boolean;
      model: string;
      provider: { require_parameters: boolean };
      response_format: { json_schema: { strict: boolean } };
      messages: { content: string }[];
    };
    expect(body).toMatchObject({
      stream: false,
      model: "test/model",
      provider: { require_parameters: true },
      response_format: { json_schema: { strict: true } },
    });
    expect(body.messages[0].content).toContain("dokładnie 5");
    expect(body.messages[0].content).toContain("Dodawanie i odejmowanie liczb naturalnych");
  });

  it.each([1, 2, 3, 4])("returns a non-empty subset of %i without retrying", async (count) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse(validExercises(count)));

    const candidates = await generateOpenRouterExercises(request, config, { fetch: fetchMock });

    expect(candidates).toHaveLength(count);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("filters duplicate text using collapsed whitespace and Polish case-insensitive comparison", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      providerResponse([
        { text: "Oblicz 20 + 5.", proposedCanonicalAnswer: "25" },
        { text: "  OBLICZ   20 + 5. ", proposedCanonicalAnswer: "25" },
        { text: "Oblicz 30 + 6.", proposedCanonicalAnswer: "36" },
      ]),
    );

    const candidates = await generateOpenRouterExercises(request, config, { fetch: fetchMock });

    expect(candidates.map(({ text }) => text)).toEqual(["Oblicz 20 + 5.", "Oblicz 30 + 6."]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once when zero candidates survive validation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(providerResponse([{ text: " ", proposedCanonicalAnswer: "2" }]))
      .mockResolvedValueOnce(providerResponse(validExercises(1)));

    const candidates = await generateOpenRouterExercises(request, config, { fetch: fetchMock });

    expect(candidates).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([429, 500, 503])("retries HTTP %i once", async (status) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(providerResponse(validExercises(1)));

    await expect(generateOpenRouterExercises(request, config, { fetch: fetchMock })).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps exhausted timeouts to a stable timeout error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const generation = generateOpenRouterExercises(request, config, {
      fetch: fetchMock,
      deadlineMs: 30_000,
    });
    const expectation = expect(generation).rejects.toMatchObject<Partial<OpenRouterExerciseGeneratorError>>({
      code: "PROVIDER_TIMEOUT",
    });

    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a malformed provider envelope without retrying", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [] }));

    await expect(generateOpenRouterExercises(request, config, { fetch: fetchMock })).rejects.toMatchObject({
      code: "PROVIDER_FAILURE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-retryable HTTP failure without exposing its body", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("raw provider error", { status: 400 }));

    await expect(generateOpenRouterExercises(request, config, { fetch: fetchMock })).rejects.toEqual(
      new OpenRouterExerciseGeneratorError("PROVIDER_FAILURE"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
