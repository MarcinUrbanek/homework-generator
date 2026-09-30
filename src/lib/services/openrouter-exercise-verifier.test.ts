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
    expect(EXERCISE_VERIFICATION_STRATEGY_VERSION).toBe("grade-4-independent-answer-set-v2");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestBody = fetchMock.mock.calls[0][1]?.body;
    expect(typeof requestBody).toBe("string");
    if (typeof requestBody !== "string") {
      throw new TypeError("Expected a string request body");
    }
    const body = JSON.parse(requestBody) as {
      model: string;
      stream: boolean;
      temperature: number;
      reasoning: { effort: string };
      messages: { content: string }[];
      provider: { require_parameters: boolean };
      response_format: {
        json_schema: {
          strict: boolean;
          schema: { properties: { validAnswers: { items: { pattern: string } } } };
        };
      };
    };
    expect(body).toMatchObject({
      model: "test/verifier",
      stream: false,
      temperature: 0,
      reasoning: { effort: "low" },
      provider: { require_parameters: true },
      response_format: { json_schema: { strict: true } },
    });
    expect(body.messages[0].content).not.toContain(independentCandidate.proposedCanonicalAnswer);
    expect(body.messages[0].content).toContain("jedną niepogrupowaną liczbą naturalną");
    expect(body.messages[0].content).toContain("wyłącznie w polu rationale");
    expect(body.response_format.json_schema.schema.properties.validAnswers.items.pattern).toBe("^(0|[1-9][0-9]*)$");
  });

  it("deduplicates grouped variants and persists canonical digits", async () => {
    const groupedCandidate = { ...candidate, proposedCanonicalAnswer: "1234" };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse(["1 234", "1\u202f234", "1234"]));

    await expect(verifyOpenRouterExercise(groupedCandidate, config, { fetch: fetchMock, now })).resolves.toMatchObject({
      outcome: "unique_answer",
      verifiedAnswer: "1234",
    });
  });

  it.each([
    ["15", "Ania zebrała 15 jabłek"],
    ["Ania zebrała 15 jabłek", "15"],
  ])("matches a scalar proposal %s with derived answer %s", async (proposedCanonicalAnswer, derivedAnswer) => {
    const proseCandidate = { ...candidate, proposedCanonicalAnswer };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse([derivedAnswer]));

    await expect(verifyOpenRouterExercise(proseCandidate, config, { fetch: fetchMock, now })).resolves.toMatchObject({
      outcome: "unique_answer",
      verifiedAnswer: "15",
    });
  });

  it("does not reduce ambiguous multi-number prose to one scalar", async () => {
    const proseCandidate = { ...candidate, proposedCanonicalAnswer: "15" };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse(["Ania ma 15 jabłek, a Ola ma 16."]));

    await expect(verifyOpenRouterExercise(proseCandidate, config, { fetch: fetchMock, now })).resolves.toMatchObject({
      outcome: "answer_mismatch",
      verifiedAnswer: "ania ma 15 jabłek, a ola ma 16",
    });
  });

  it.each(["12 34", "1,5", "1/2", "2 + 2"])("keeps non-equivalent notation %s distinct", async (answer) => {
    const notationCandidate = { ...candidate, proposedCanonicalAnswer: "1234" };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(providerResponse([answer]));

    await expect(verifyOpenRouterExercise(notationCandidate, config, { fetch: fetchMock, now })).resolves.toMatchObject(
      {
        outcome: "answer_mismatch",
        verifiedAnswer: answer,
      },
    );
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
