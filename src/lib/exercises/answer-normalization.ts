const UNGROUPED_NATURAL_NUMBER_PATTERN = /^\d+$/u;
const GROUPED_NATURAL_NUMBER_PATTERN = /^\d{1,3}(?: \d{3})+$/u;
const NATURAL_NUMBER_TOKEN_PATTERN =
  /(?<![\p{L}\p{N}+\-*/=,.%^])(?:\d{1,3}(?: \d{3})+|\d+)(?![\p{L}\p{N}+\-*/=,.%^])/gu;
const STUDENT_UNGROUPED_NATURAL_NUMBER_PATTERN = /^[0-9]+$/u;
const STUDENT_GROUPED_NATURAL_NUMBER_PATTERN = /^[0-9]{1,3}(?: [0-9]{3})+$/u;
const STUDENT_ANSWER_ASCII_WHITESPACE_PATTERN = /^[ \t\n\v\f\r]+|[ \t\n\v\f\r]+$/gu;

export interface VerificationAnswerCanonicalization {
  comparisonKey: string;
  canonicalAnswer: string;
}

export function normalizeExerciseAnswer(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pl-PL").replace(/\.$/u, "");
}

export function canonicalizeNaturalNumberAnswer(value: string): string {
  return value.replaceAll(" ", "").replace(/^0+(?=\d)/u, "");
}

export function normalizeStudentHomeworkAnswer(value: string | null): string | null | undefined {
  if (value === null) return null;

  const trimmedAnswer = value.replace(STUDENT_ANSWER_ASCII_WHITESPACE_PATTERN, "");
  if (trimmedAnswer === "") return null;
  if (
    !STUDENT_UNGROUPED_NATURAL_NUMBER_PATTERN.test(trimmedAnswer) &&
    !STUDENT_GROUPED_NATURAL_NUMBER_PATTERN.test(trimmedAnswer)
  ) {
    return undefined;
  }

  return canonicalizeNaturalNumberAnswer(trimmedAnswer);
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
    const canonicalAnswer = canonicalizeNaturalNumberAnswer(numericAnswer);
    return { comparisonKey: `natural-number:${canonicalAnswer}`, canonicalAnswer };
  }

  return { comparisonKey: `literal:${normalizedAnswer}`, canonicalAnswer: normalizedAnswer };
}
