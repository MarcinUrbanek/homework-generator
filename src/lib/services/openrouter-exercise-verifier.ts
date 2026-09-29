import { z } from "zod";

import { normalizeExerciseAnswer } from "@/lib/exercises/answer-normalization";
import type { ExerciseCandidate, ExerciseVerificationEvidence, ExerciseVerificationProviderErrorCode } from "@/types";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_DEADLINE_MS = 20_000;
const MAX_RATIONALE_LENGTH = 500;

export const EXERCISE_VERIFIER_IDENTITY = "OpenRouter";
export const EXERCISE_VERIFICATION_STRATEGY_VERSION = "grade-4-independent-answer-set-v1";
export const EXERCISE_VERIFIER_LEDGER_IDENTITY = `${EXERCISE_VERIFIER_IDENTITY}/${EXERCISE_VERIFICATION_STRATEGY_VERSION}`;

const providerPayloadSchema = z
  .object({
    validAnswers: z.array(z.string().trim().min(1)).max(10),
    rationale: z.string().trim().min(1).max(MAX_RATIONALE_LENGTH),
  })
  .strict();

const providerEnvelopeSchema = z.looseObject({
  choices: z
    .array(
      z.looseObject({
        message: z.looseObject({
          content: z.string(),
        }),
      }),
    )
    .min(1),
});

export class OpenRouterExerciseVerifierError extends Error {
  readonly code: ExerciseVerificationProviderErrorCode;

  constructor(code: ExerciseVerificationProviderErrorCode) {
    super(code);
    this.name = "OpenRouterExerciseVerifierError";
    this.code = code;
  }
}

export interface OpenRouterExerciseVerifierConfig {
  apiKey: string;
  model: string;
}

export interface OpenRouterExerciseVerifierDependencies {
  fetch?: typeof fetch;
  deadlineMs?: number;
  now?: () => Date;
}

function buildPrompt(candidate: ExerciseCandidate): string {
  return [
    "Rozwiąż samodzielnie poniższe zadanie matematyczne dla klasy 4.",
    "Wyznacz pełny zbiór poprawnych odpowiedzi bez korzystania z odpowiedzi zaproponowanej przez autora.",
    "Jeżeli zadanie nie ma jednoznacznej odpowiedzi, zwróć zero albo wszystkie różne poprawne odpowiedzi.",
    "Uzasadnienie napisz zwięźle po polsku.",
    `Treść zadania: ${candidate.text}`,
    `Temat: ${candidate.topic}. Poziom trudności: ${candidate.difficulty}.`,
    "Zwróć wyłącznie dane zgodne z podanym schematem JSON.",
  ].join("\n");
}

function buildRequestBody(candidate: ExerciseCandidate, model: string) {
  return {
    model,
    stream: false,
    messages: [{ role: "user", content: buildPrompt(candidate) }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "grade_4_exercise_verification",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["validAnswers", "rationale"],
          properties: {
            validAnswers: {
              type: "array",
              maxItems: 10,
              items: { type: "string", minLength: 1 },
            },
            rationale: { type: "string", minLength: 1, maxLength: MAX_RATIONALE_LENGTH },
          },
        },
      },
    },
    provider: { require_parameters: true },
  };
}

function parseProviderPayload(value: unknown) {
  const envelope = providerEnvelopeSchema.safeParse(value);
  if (!envelope.success) {
    throw new OpenRouterExerciseVerifierError("PROVIDER_FAILURE");
  }

  let content: unknown;
  try {
    content = JSON.parse(envelope.data.choices[0].message.content);
  } catch {
    throw new OpenRouterExerciseVerifierError("PROVIDER_FAILURE");
  }

  const payload = providerPayloadSchema.safeParse(content);
  if (!payload.success) {
    throw new OpenRouterExerciseVerifierError("PROVIDER_FAILURE");
  }

  return payload.data;
}

function classifyAnswers(
  candidate: ExerciseCandidate,
  validAnswers: string[],
  rationale: string,
  model: string,
  verifiedAt: string,
): ExerciseVerificationEvidence {
  const normalizedAnswers = [...new Set(validAnswers.map(normalizeExerciseAnswer).filter(Boolean))];
  const evidence = {
    rationale,
    verifierIdentity: EXERCISE_VERIFIER_LEDGER_IDENTITY,
    verifierVersion: model,
    verifiedAt,
  };

  if (normalizedAnswers.length !== 1) {
    return { ...evidence, outcome: "not_unique_answer", verifiedAnswer: null };
  }

  const [verifiedAnswer] = normalizedAnswers;
  return {
    ...evidence,
    outcome:
      verifiedAnswer === normalizeExerciseAnswer(candidate.proposedCanonicalAnswer)
        ? "unique_answer"
        : "answer_mismatch",
    verifiedAnswer,
  };
}

export async function verifyOpenRouterExercise(
  candidate: ExerciseCandidate,
  config: OpenRouterExerciseVerifierConfig,
  dependencies: OpenRouterExerciseVerifierDependencies = {},
): Promise<ExerciseVerificationEvidence> {
  const fetchImplementation = dependencies.fetch ?? fetch;
  const deadlineMs = dependencies.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const now = dependencies.now ?? (() => new Date());
  const controller = new AbortController();
  const deadline = setTimeout(() => {
    controller.abort();
  }, deadlineMs);

  try {
    const response = await fetchImplementation(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRequestBody(candidate, config.model)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new OpenRouterExerciseVerifierError("PROVIDER_FAILURE");
    }

    const payload = parseProviderPayload(await response.json());
    return classifyAnswers(candidate, payload.validAnswers, payload.rationale, config.model, now().toISOString());
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new OpenRouterExerciseVerifierError("PROVIDER_TIMEOUT");
    }
    if (error instanceof OpenRouterExerciseVerifierError) {
      throw error;
    }
    throw new OpenRouterExerciseVerifierError("PROVIDER_FAILURE");
  } finally {
    clearTimeout(deadline);
  }
}
