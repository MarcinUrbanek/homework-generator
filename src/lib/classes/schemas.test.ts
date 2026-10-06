import { describe, expect, it } from "vitest";

import * as classSchemas from "./schemas";

describe("class join schemas", () => {
  it("trims and uppercases class codes", () => {
    expect(classSchemas.classCodeSchema.parse("  ab12cd34  ")).toBe("AB12CD34");
  });
});
