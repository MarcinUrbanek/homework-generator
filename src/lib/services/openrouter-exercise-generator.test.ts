import { afterEach, describe, expect, it, vi } from "vitest";

import authorityFixtures from "@/lib/exercises/__fixtures__/arithmetic-authority-v1.json";
import type { ExerciseGenerationRequest } from "@/types";

import { generateOpenRouterExercises, OpenRouterExerciseGeneratorError } from "./openrouter-exercise-generator";
import { verifyArithmeticExercise } from "./arithmetic-exercise-verifier";

const request: ExerciseGenerationRequest = {
  grade: 4,
  topic: "addition-subtraction",
  difficulty: "easy",
};

const config = { apiKey: "test-secret", model: "test/model" };

function number(value: number) {
  return { kind: "number" as const, value };
}

function addition(left: number, right: number) {
  return { kind: "add" as const, left: number(left), right: number(right) };
}

function providerResponse(exercises: unknown[]): Response {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ exercises }) } }],
  });
}

function validExercises(count = 5) {
  return Array.from({ length: count }, (_, index) => ({
    expression: addition(index + 1, 1),
  }));
}

function renderedAddition(left: number, right: number) {
  return {
    text: `Oblicz wartość wyrażenia: (${left} + ${right}). Podaj wynik jako jedną liczbę naturalną.`,
    proposedCanonicalAnswer: String(left + right),
    arithmeticStructure: { version: 1 as const, expression: addition(left, right) },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("generateOpenRouterExercises", () => {
  it("composes provider generation with deterministic verification for independent fixtures", async () => {
    const fixtureCases = authorityFixtures.certifiedCases.filter(({ manualSeed }) => manualSeed).slice(0, 5);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      providerResponse(
        fixtureCases.map(({ structure }) => ({
          expression: structure.expression,
        })),
      ),
    );
    let nextId = 0;

    const candidates = await generateOpenRouterExercises(request, config, {
      fetch: fetchMock,
      createId: () => `fixture-${(nextId += 1)}`,
    });

    expect(candidates).toHaveLength(fixtureCases.length);
    expect(candidates.map((candidate) => verifyArithmeticExercise(candidate).outcome)).toEqual(
      fixtureCases.map(() => "unique_answer"),
    );
    expect(candidates.map(({ text, proposedCanonicalAnswer }) => ({ text, proposedCanonicalAnswer }))).toEqual(
      fixtureCases.map(({ statement, literalAnswer }) => ({
        text: statement,
        proposedCanonicalAnswer: literalAnswer,
      })),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects generator/model agreement on an incorrect answer at the deterministic boundary", async () => {
    const fixtureCase = authorityFixtures.rejectedCases.find(
      ({ id }) => id === "incorrect-answer-with-model-agreement",
    ) as
      | {
          structure: { expression: unknown };
          literalAnswer: string;
          expectedAnswer: string;
          modelVerifierClaim: { verifiedAnswer: string };
        }
      | undefined;
    if (!fixtureCase) throw new Error("The independent false-agreement fixture is required.");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      providerResponse([
        {
          expression: fixtureCase.structure.expression,
        },
      ]),
    );
    const [generated] = await generateOpenRouterExercises(request, config, {
      fetch: fetchMock,
      createId: () => "false-agreement",
    });
    expect(fixtureCase.modelVerifierClaim.verifiedAnswer).toBe(fixtureCase.literalAnswer);
    const incorrectAgreementCandidate = {
      ...generated,
      proposedCanonicalAnswer: fixtureCase.modelVerifierClaim.verifiedAnswer,
    };
    const verification = verifyArithmeticExercise(incorrectAgreementCandidate);

    expect(generated.proposedCanonicalAnswer).toBe(fixtureCase.expectedAnswer);
    expect(verification).toMatchObject({
      outcome: "answer_mismatch",
      verifiedAnswer: fixtureCase.expectedAnswer,
      authorityVersion: 1,
    });
    expect(verification.verifiedAnswer).not.toBe(incorrectAgreementCandidate.proposedCanonicalAnswer);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

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
      ...renderedAddition(1, 1),
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
      reasoning: { effort: string };
      provider: { require_parameters: boolean };
      response_format: {
        json_schema: {
          strict: boolean;
          schema: {
            $defs: { expression: { anyOf: unknown[] } };
            properties: { exercises: { items: { properties: { expression: { $ref: string } } } } };
          };
        };
      };
      messages: { content: string }[];
    };
    expect(body).toMatchObject({
      stream: false,
      model: "test/model",
      reasoning: { effort: "low" },
      provider: { require_parameters: true },
      response_format: { json_schema: { strict: true } },
    });
    expect(body.messages[0].content).toContain("dokładnie 5");
    expect(body.messages[0].content).toContain("Dodawanie i odejmowanie liczb naturalnych");
    expect(body.messages[0].content).toContain("serwer je wyliczy i wyrenderuje");
    expect(body.response_format.json_schema.schema.$defs.expression.anyOf).toHaveLength(5);
    expect(body.response_format.json_schema.schema.properties.exercises.items.properties).toEqual({
      expression: { $ref: "#/$defs/expression" },
    });
  });

  it.each([1, 2, 3, 4])("returns a non-empty subset of %i without retrying", async (count) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse(validExercises(count)));

    const candidates = await generateOpenRouterExercises(request, config, { fetch: fetchMock });

    expect(candidates).toHaveLength(count);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("filters duplicate text using collapsed whitespace and Polish case-insensitive comparison", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        providerResponse([
          { expression: addition(20, 5) },
          { expression: addition(20, 5) },
          { expression: addition(30, 6) },
        ]),
      );

    const candidates = await generateOpenRouterExercises(request, config, { fetch: fetchMock });

    expect(candidates.map(({ text }) => text)).toEqual([
      "Oblicz wartość wyrażenia: (20 + 5). Podaj wynik jako jedną liczbę naturalną.",
      "Oblicz wartość wyrażenia: (30 + 6). Podaj wynik jako jedną liczbę naturalną.",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once when zero candidates survive validation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(providerResponse([{ expression: null }]))
      .mockResolvedValueOnce(providerResponse(validExercises(1)));

    const candidates = await generateOpenRouterExercises(request, config, { fetch: fetchMock });

    expect(candidates).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores provider-authored text and answers instead of accepting them as authority", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      providerResponse([
        {
          expression: addition(1, 1),
          text: "Zaufaj mi: 999",
          proposedCanonicalAnswer: "999",
        },
        { expression: addition(2, 2) },
      ]),
    );

    const candidates = await generateOpenRouterExercises(request, config, { fetch: fetchMock });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject(renderedAddition(2, 2));
    expect(candidates[0].text).not.toContain("Zaufaj mi");
  });

  it("rejects unsupported topic requests without calling the provider", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      generateOpenRouterExercises({ ...request, topic: "word-problems" }, config, { fetch: fetchMock }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_TOPIC" });
    expect(fetchMock).not.toHaveBeenCalled();
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
