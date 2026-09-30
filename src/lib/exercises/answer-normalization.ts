const UNGROUPED_NATURAL_NUMBER_PATTERN = /^\d+$/u;
const GROUPED_NATURAL_NUMBER_PATTERN = /^\d{1,3}(?: \d{3})+$/u;
const NATURAL_NUMBER_TOKEN_PATTERN =
  /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu;

export interface VerificationAnswerCanonicalization {
  comparisonKey: string;
  canonicalAnswer: string;
}

export function normalizeExerciseAnswer(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pl-PL").replace(/\.$/u, "");
}

function canonicalizeNaturalNumber(value: string): string {
  return value.replaceAll(" ", "").replace(/^0+(?=\d)/u, "");
}

export function canonicalizeExerciseAnswerForVerification(value: string): VerificationAnswerCanonicalization {
  const normalizedAnswer = normalizeExerciseAnswer(value);
  let numericAnswer: string | undefined;

  if (
    UNGROUPED_NATURAL_NUMBER_PATTERN.test(normalizedAnswer) ||
    GROUPED_NATURAL_NUMBER_PATTERN.test(normalizedAnswer)
  ) {
    numericAnswer = normalizedAnswer;
  } else {
    const numericTokens = [...normalizedAnswer.matchAll(NATURAL_NUMBER_TOKEN_PATTERN)];
    if (numericTokens.length === 1) {
      numericAnswer = numericTokens[0][0];
    }
  }

  if (numericAnswer !== undefined) {
    const canonicalAnswer = canonicalizeNaturalNumber(numericAnswer);
    return { comparisonKey: `natural-number:${canonicalAnswer}`, canonicalAnswer };
  }

  return { comparisonKey: `literal:${normalizedAnswer}`, canonicalAnswer: normalizedAnswer };
}
