import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExerciseCandidate } from "@/types";

import {
  EXERCISE_VERIFICATION_STRATEGY_VERSION,
  EXERCISE_VERIFIER_LEDGER_IDENTITY,
  OpenRouterExerciseVerifierError,
  verifyOpenRouterExercise,
} from "./openrouter-exercise-verifier";

const candidate: ExerciseCandidate = {
  id: "candidate-1",
  text: "Oblicz 20 + 5.",
  proposedCanonicalAnswer: "25",
  grade: 4,
  topic: "addition-subtraction",
  difficulty: "easy",
  approvalStatus: "unverified",
};

const config = { apiKey: "test-secret", model: "test/verifier" };
const now = () => new Date("2026-09-29T12:00:00.000Z");

function providerResponse(validAnswers: unknown, rationale = "Po dodaniu liczb otrzymujemy 25."): Response {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ validAnswers, rationale }) } }],
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("verifyOpenRouterExercise", () => {
  it("uses strict structured output without disclosing the proposed answer in the prompt", async () => {
    const independentCandidate = { ...candidate, text: "Oblicz dwadzieścia plus pięć." };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse(["25"]));

    const result = await verifyOpenRouterExercise(independentCandidate, config, { fetch: fetchMock, now });

    expect(result).toEqual({
      outcome: "unique_answer",
      verifiedAnswer: "25",
      rationale: "Po dodaniu liczb otrzymujemy 25.",
      verifierIdentity: EXERCISE_VERIFIER_LEDGER_IDENTITY,
      verifierVersion: "test/verifier",
      verifiedAt: "2026-09-29T12:00:00.000Z",
    });
    expect(EXERCISE_VERIFICATION_STRATEGY_VERSION).toBe("grade-4-independent-answer-set-v1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestBody = fetchMock.mock.calls[0][1]?.body;
    expect(typeof requestBody).toBe("string");
    if (typeof requestBody !== "string") {
      throw new TypeError("Expected a string request body");
    }
    const body = JSON.parse(requestBody) as {
      model: string;
      stream: boolean;
      messages: { content: string }[];
      provider: { require_parameters: boolean };
      response_format: { json_schema: { strict: boolean } };
    };
    expect(body).toMatchObject({
      model: "test/verifier",
      stream: false,
      provider: { require_parameters: true },
      response_format: { json_schema: { strict: true } },
    });
    expect(body.messages[0].content).not.toContain(independentCandidate.proposedCanonicalAnswer);
  });

  it("normalizes and deduplicates equivalent derived answers before matching", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse([" 25. ", "25"]));

    await expect(verifyOpenRouterExercise(candidate, config, { fetch: fetchMock, now })).resolves.toMatchObject({
      outcome: "unique_answer",
      verifiedAnswer: "25",
    });
  });

  it("classifies one different answer as a mismatch", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse(["24"]));

    await expect(verifyOpenRouterExercise(candidate, config, { fetch: fetchMock, now })).resolves.toMatchObject({
      outcome: "answer_mismatch",
      verifiedAnswer: "24",
    });
  });

  it.each([[[]], [["24", "25"]]])("classifies zero or multiple answers as non-unique", async (answers) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse(answers));

    await expect(verifyOpenRouterExercise(candidate, config, { fetch: fetchMock, now })).resolves.toMatchObject({
      outcome: "not_unique_answer",
      verifiedAnswer: null,
    });
  });

  it.each([
    Response.json({ choices: [] }),
    Response.json({ choices: [{ message: { content: "not json" } }] }),
    providerResponse([""]),
  ])("maps malformed provider data to a technical failure", async (response) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(verifyOpenRouterExercise(candidate, config, { fetch: fetchMock })).rejects.toEqual(
      new OpenRouterExerciseVerifierError("PROVIDER_FAILURE"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps an HTTP failure without reading or exposing its body", async () => {
    const response = new Response("sensitive upstream body", { status: 500 });
    const jsonSpy = vi.spyOn(response, "json");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(verifyOpenRouterExercise(candidate, config, { fetch: fetchMock })).rejects.toMatchObject({
      code: "PROVIDER_FAILURE",
    });
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts at the deadline without retrying", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const verification = verifyOpenRouterExercise(candidate, config, { fetch: fetchMock, deadlineMs: 20_000 });
    const expectation = expect(verification).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });

    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
