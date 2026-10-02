import { describe, expect, it } from "vitest";

import { DEFAULT_SIGNED_IN_DESTINATION, returnDestination } from "./return-destination";

describe("returnDestination", () => {
  it("preserves a complete internal path and query", () => {
    expect(returnDestination("/classes/join?token=example&source=email")).toBe(
      "/classes/join?token=example&source=email",
    );
  });

  it.each([
    undefined,
    "",
    "classes",
    "https://attacker.example/classes",
    "//attacker.example/classes",
    "/\\attacker.example/classes",
  ])("falls back for an unsafe destination: %s", (value) => {
    expect(returnDestination(value)).toBe(DEFAULT_SIGNED_IN_DESTINATION);
  });
});
