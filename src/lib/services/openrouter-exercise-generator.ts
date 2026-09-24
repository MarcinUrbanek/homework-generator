import { z } from "zod";

import { GRADE_4_EXERCISE_CATALOG } from "@/lib/exercises/catalog";
import type { ExerciseCandidate, ExerciseGenerationRequest } from "@/types";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUESTED_COUNT = 5;
const DEFAULT_DEADLINE_MS = 30_000;

const providerCandidateSchema = z
  .object({
    text: z.string().trim().min(1),
    proposedCanonicalAnswer: z.string().trim().min(1),
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

export type OpenRouterExerciseGeneratorErrorCode = "PROVIDER_FAILURE" | "PROVIDER_TIMEOUT";

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

  if (!topic) {
    throw new OpenRouterExerciseGeneratorError("PROVIDER_FAILURE");
  }

  return [
    "Wygeneruj dokładnie 5 różnych zadań matematycznych w języku polskim.",
    `Poziom: klasa ${request.grade}.`,
    `Temat: ${topic.label}.`,
    `Kryterium trudności: ${topic.guidance[request.difficulty]}`,
    "Każde zadanie musi mieć niepustą treść i jedną proponowaną odpowiedź kanoniczną.",
    "Zwróć wyłącznie dane zgodne z podanym schematem JSON.",
  ].join("\n");
}

function buildRequestBody(request: ExerciseGenerationRequest, model: string) {
  return {
    model,
    stream: false,
    messages: [{ role: "user", content: buildPrompt(request) }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "grade_4_polish_exercises",
        strict: true,
        schema: {
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
                required: ["text", "proposedCanonicalAnswer"],
                properties: {
                  text: { type: "string", minLength: 1 },
                  proposedCanonicalAnswer: { type: "string", minLength: 1 },
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
): ExerciseCandidate[] {
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
  const candidates: ExerciseCandidate[] = [];

  for (const value of payload.data.exercises) {
    const candidate = providerCandidateSchema.safeParse(value);
    if (!candidate.success) {
      continue;
    }

    const comparisonText = normalizeForComparison(candidate.data.text);
    if (seenTexts.has(comparisonText)) {
      continue;
    }

    seenTexts.add(comparisonText);
    candidates.push({
      id: createId(),
      text: candidate.data.text,
      proposedCanonicalAnswer: candidate.data.proposedCanonicalAnswer,
      ...request,
      approvalStatus: "unverified",
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
): Promise<{ candidates?: ExerciseCandidate[]; retryableFailure?: true }> {
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
): Promise<ExerciseCandidate[]> {
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
