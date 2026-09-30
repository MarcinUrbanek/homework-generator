export function exerciseNoun(count: number): string {
  if (count === 1) return "zadanie";
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwoDigits >= 12 && lastTwoDigits <= 14)) return "zadania";
  return "zadań";
}
