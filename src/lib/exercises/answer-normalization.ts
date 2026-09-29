export function normalizeExerciseAnswer(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("pl-PL").replace(/\.$/u, "");
}
