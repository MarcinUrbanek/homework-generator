import { z } from "zod";

import {
  ARITHMETIC_AUTHORITY_V1_LIMITS,
  ArithmeticAuthorityError,
  arithmeticExpressionSchema,
  renderArithmeticExercise,
} from "@/lib/exercises/arithmetic-authority";
import { GRADE_4_EXERCISE_CATALOG, isSupportedArithmeticTopic } from "@/lib/exercises/catalog";
import type { ExerciseGenerationRequest, GeneratedExerciseCandidate } from "@/types";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUESTED_COUNT = 5;
const DEFAULT_DEADLINE_MS = 30_000;

const providerCandidateSchema = z
  .object({
    expression: arithmeticExpressionSchema,
  })
  .strict();

const providerPayloadSchema = z
  .object({
    exercises: z.array(z.unknown()).max(REQUESTED_COUNT),
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

export type OpenRouterExerciseGeneratorErrorCode = "PROVIDER_FAILURE" | "PROVIDER_TIMEOUT" | "UNSUPPORTED_TOPIC";

const expressionReference = { $ref: "#/$defs/expression" };

function providerBinaryExpressionSchema(kind: "add" | "subtract" | "multiply" | "divide") {
  return {
    type: "object",
    additionalProperties: false,
    required: ["kind", "left", "right"],
    properties: {
      kind: { type: "string", enum: [kind] },
      left: expressionReference,
      right: expressionReference,
    },
  };
}

const providerExpressionSchema = {
  $defs: {
    expression: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "value"],
          properties: {
            kind: { type: "string", enum: ["number"] },
            value: {
              type: "integer",
              minimum: 0,
              maximum: ARITHMETIC_AUTHORITY_V1_LIMITS.maxIntermediateValue,
            },
          },
        },
        providerBinaryExpressionSchema("add"),
        providerBinaryExpressionSchema("subtract"),
        providerBinaryExpressionSchema("multiply"),
        providerBinaryExpressionSchema("divide"),
      ],
    },
  },
};

export class OpenRouterExerciseGeneratorError extends Error {
  readonly code: OpenRouterExerciseGeneratorErrorCode;

  constructor(code: OpenRouterExerciseGeneratorErrorCode) {
    super(code);
    this.name = "OpenRouterExerciseGeneratorError";
    this.code = code;
  }
}

export interface OpenRouterExerciseGeneratorConfig {
  apiKey: string;
  model: string;
}

export interface OpenRouterExerciseGeneratorDependencies {
  fetch?: typeof fetch;
  deadlineMs?: number;
  createId?: () => string;
}

function buildPrompt(request: ExerciseGenerationRequest): string {
  const topic = GRADE_4_EXERCISE_CATALOG.find(({ slug }) => slug === request.topic);

  if (!topic || !isSupportedArithmeticTopic(request.topic)) {
    throw new OpenRouterExerciseGeneratorError("UNSUPPORTED_TOPIC");
  }

  return [
    "Zaproponuj dokładnie 5 różnych struktur działań matematycznych dla ucznia klasy 4.",
    `Poziom: klasa ${request.grade}.`,
    `Temat: ${topic.label}.`,
    `Kryterium trudności: ${topic.guidance[request.difficulty]}`,
    "Liście struktur zawierają wyłącznie nieujemne liczby całkowite, a węzły wyłącznie działania +, -, mnożenia lub dzielenia.",
    "Zwróć wyłącznie struktury w polu expression. Nie zwracaj treści zadań ani proponowanych odpowiedzi; serwer je wyliczy i wyrenderuje.",
    "Każde wyrażenie musi być poprawne w podanym temacie i poziomie trudności; dzielenie musi być bez reszty.",
    "Zwróć wyłącznie dane zgodne z podanym schematem JSON.",
  ].join("\n");
}

function buildRequestBody(request: ExerciseGenerationRequest, model: string) {
  return {
    model,
    stream: false,
    reasoning: { effort: "low" },
    messages: [{ role: "user", content: buildPrompt(request) }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "grade_4_polish_exercises",
        strict: true,
        schema: {
          ...providerExpressionSchema,
          type: "object",
          additionalProperties: false,
          required: ["exercises"],
          properties: {
            exercises: {
              type: "array",
              minItems: REQUESTED_COUNT,
              maxItems: REQUESTED_COUNT,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["expression"],
                properties: {
                  expression: expressionReference,
                },
              },
            },
          },
        },
      },
    },
    provider: { require_parameters: true },
  };
}

function normalizeForComparison(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl-PL");
}

function parseCandidates(
  envelopeValue: unknown,
  request: ExerciseGenerationRequest,
  createId: () => string,
): GeneratedExerciseCandidate[] {
  if (!isSupportedArithmeticTopic(request.topic)) {
    throw new OpenRouterExerciseGeneratorError("UNSUPPORTED_TOPIC");
  }
  const supportedRequest = { ...request, topic: request.topic };

  const envelope = providerEnvelopeSchema.safeParse(envelopeValue);
  if (!envelope.success) {
    throw new OpenRouterExerciseGeneratorError("PROVIDER_FAILURE");
  }

  let contentValue: unknown;
  try {
    contentValue = JSON.parse(envelope.data.choices[0].message.content);
  } catch {
    throw new OpenRouterExerciseGeneratorError("PROVIDER_FAILURE");
  }

  const payload = providerPayloadSchema.safeParse(contentValue);
  if (!payload.success) {
    throw new OpenRouterExerciseGeneratorError("PROVIDER_FAILURE");
  }

  const seenTexts = new Set<string>();
  const candidates: GeneratedExerciseCandidate[] = [];

  for (const value of payload.data.exercises) {
    const candidate = providerCandidateSchema.safeParse(value);
    if (!candidate.success) {
      continue;
    }

    let rendered: ReturnType<typeof renderArithmeticExercise>;
    try {
      rendered = renderArithmeticExercise(supportedRequest, {
        version: 1,
        expression: candidate.data.expression,
      });
    } catch (error) {
      if (error instanceof ArithmeticAuthorityError) continue;
      throw error;
    }

    const comparisonText = normalizeForComparison(rendered.text);
    if (seenTexts.has(comparisonText)) {
      continue;
    }

    seenTexts.add(comparisonText);
    candidates.push({
      id: createId(),
      text: rendered.text,
      proposedCanonicalAnswer: rendered.proposedCanonicalAnswer,
      ...supportedRequest,
      approvalStatus: "unverified",
      arithmeticStructure: rendered.arithmeticStructure,
    });
  }

  return candidates;
}

async function makeAttempt(
  request: ExerciseGenerationRequest,
  config: OpenRouterExerciseGeneratorConfig,
  fetchImplementation: typeof fetch,
  deadlineMs: number,
  createId: () => string,
): Promise<{ candidates?: GeneratedExerciseCandidate[]; retryableFailure?: true }> {
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
      body: JSON.stringify(buildRequestBody(request, config.model)),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        return { retryableFailure: true };
      }
      throw new OpenRouterExerciseGeneratorError("PROVIDER_FAILURE");
    }

    const candidates = parseCandidates(await response.json(), request, createId);
    return candidates.length === 0 ? { retryableFailure: true } : { candidates };
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new OpenRouterExerciseGeneratorError("PROVIDER_TIMEOUT");
    }
    if (error instanceof OpenRouterExerciseGeneratorError) {
      throw error;
    }
    throw new OpenRouterExerciseGeneratorError("PROVIDER_FAILURE");
  } finally {
    clearTimeout(deadline);
  }
}

export async function generateOpenRouterExercises(
  request: ExerciseGenerationRequest,
  config: OpenRouterExerciseGeneratorConfig,
  dependencies: OpenRouterExerciseGeneratorDependencies = {},
): Promise<GeneratedExerciseCandidate[]> {
  if (!isSupportedArithmeticTopic(request.topic)) {
    throw new OpenRouterExerciseGeneratorError("UNSUPPORTED_TOPIC");
  }

  const fetchImplementation = dependencies.fetch ?? fetch;
  const deadlineMs = dependencies.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  let lastErrorCode: OpenRouterExerciseGeneratorErrorCode = "PROVIDER_FAILURE";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await makeAttempt(request, config, fetchImplementation, deadlineMs, createId);
      if (result.candidates) {
        return result.candidates;
      }
      lastErrorCode = "PROVIDER_FAILURE";
    } catch (error) {
      if (!(error instanceof OpenRouterExerciseGeneratorError)) {
        throw error;
      }
      lastErrorCode = error.code;
      if (error.code !== "PROVIDER_TIMEOUT") {
        throw error;
      }
    }
  }

  throw new OpenRouterExerciseGeneratorError(lastErrorCode);
}
