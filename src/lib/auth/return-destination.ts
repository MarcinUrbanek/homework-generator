export const DEFAULT_SIGNED_IN_DESTINATION = "/";

export function returnDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_SIGNED_IN_DESTINATION;
  }

  try {
    const origin = "https://homework-generator.invalid";
    const destination = new URL(value, origin);
    return destination.origin === origin
      ? `${destination.pathname}${destination.search}`
      : DEFAULT_SIGNED_IN_DESTINATION;
  } catch {
    return DEFAULT_SIGNED_IN_DESTINATION;
  }
}
