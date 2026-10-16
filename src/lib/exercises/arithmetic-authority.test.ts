import { describe, expect, it } from "vitest";

import type { ArithmeticExpressionV1, ExerciseGenerationRequest } from "@/types";

import {
  ARITHMETIC_AUTHORITY_V1_LIMITS,
  ArithmeticAuthorityError,
  renderArithmeticExercise,
} from "./arithmetic-authority";

function number(value: number): ArithmeticExpressionV1 {
  return { kind: "number", value };
}

function operation(
  kind: "add" | "subtract" | "multiply" | "divide",
  left: ArithmeticExpressionV1,
  right: ArithmeticExpressionV1,
): ArithmeticExpressionV1 {
  return { kind, left, right };
}

function request(topic: ExerciseGenerationRequest["topic"], difficulty: ExerciseGenerationRequest["difficulty"]) {
  return { grade: 4, topic, difficulty } as const;
}

function render(
  topic: ExerciseGenerationRequest["topic"],
  difficulty: ExerciseGenerationRequest["difficulty"],
  expression: ArithmeticExpressionV1,
) {
  return renderArithmeticExercise(request(topic, difficulty), { version: 1, expression });
}

describe("arithmetic authority v1", () => {
  it.each([
    ["addition-subtraction", "easy", operation("add", number(21), number(32)), "53"],
    ["addition-subtraction", "medium", operation("add", number(999), number(1)), "1000"],
    [
      "addition-subtraction",
      "hard",
      operation("subtract", operation("add", number(10_000), number(1)), number(1)),
      "10000",
    ],
    ["multiplication-division", "easy", operation("multiply", number(10), number(10)), "100"],
    ["multiplication-division", "easy", operation("divide", number(100), number(10)), "10"],
    ["multiplication-division", "medium", operation("multiply", number(999), number(9)), "8991"],
    ["multiplication-division", "medium", operation("divide", number(8991), number(9)), "999"],
    ["multiplication-division", "hard", operation("multiply", number(1000), number(1000)), "1000000"],
    ["multiplication-division", "hard", operation("divide", number(999_999), number(3)), "333333"],
    ["order-of-operations", "easy", operation("add", number(2), operation("multiply", number(3), number(4))), "14"],
    [
      "order-of-operations",
      "medium",
      operation("divide", operation("multiply", operation("add", number(2), number(3)), number(4)), number(2)),
      "10",
    ],
    [
      "order-of-operations",
      "hard",
      operation(
        "subtract",
        operation("multiply", operation("add", number(2), number(3)), operation("add", number(4), number(1))),
        number(5),
      ),
      "20",
    ],
  ])("evaluates the %s %s bucket exactly", (topic, difficulty, expression, answer) => {
    expect(
      render(
        topic as ExerciseGenerationRequest["topic"],
        difficulty as ExerciseGenerationRequest["difficulty"],
        expression,
      ).proposedCanonicalAnswer,
    ).toBe(answer);
  });

  it("renders the same structure to unique, fully parenthesized Polish bytes", () => {
    const requestValue = request("order-of-operations", "easy");
    const expression = operation("add", number(2), operation("multiply", number(3), number(4)));

    const first = renderArithmeticExercise(requestValue, { version: 1, expression });
    const second = renderArithmeticExercise(requestValue, { version: 1, expression });
    const regrouped = renderArithmeticExercise(requestValue, {
      version: 1,
      expression: operation("add", operation("multiply", number(2), number(3)), number(4)),
    });

    expect(first).toEqual(second);
    expect(first.text).toBe("Oblicz wartość wyrażenia: (2 + (3 × 4)). Podaj wynik jako jedną liczbę naturalną.");
    expect(first.proposedCanonicalAnswer).toBe("14");
    expect(regrouped.text).not.toBe(first.text);
    expect(regrouped.proposedCanonicalAnswer).toBe("10");
  });

  it("renders zero using canonical natural-number digits", () => {
    const result = render("addition-subtraction", "easy", operation("subtract", number(0), number(0)));

    expect(result.proposedCanonicalAnswer).toBe("0");
    expect(result.text).toContain("(0 - 0)");
  });

  it("exports explicit finite bounds for every supported bucket", () => {
    expect(Object.keys(ARITHMETIC_AUTHORITY_V1_LIMITS.buckets)).toEqual([
      "addition-subtraction",
      "multiplication-division",
      "order-of-operations",
    ]);
    for (const topicSlug of ["addition-subtraction", "multiplication-division", "order-of-operations"] as const) {
      const topic = ARITHMETIC_AUTHORITY_V1_LIMITS.buckets[topicSlug];
      expect(Object.keys(topic)).toEqual(["easy", "medium", "hard"]);
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        const bucket = topic[difficulty];
        expect(bucket.maxOperations).toBeLessThanOrEqual(ARITHMETIC_AUTHORITY_V1_LIMITS.maxOperations);
        expect(bucket.maxOperand).toBeLessThanOrEqual(ARITHMETIC_AUTHORITY_V1_LIMITS.maxIntermediateValue);
      }
    }
  });

  it.each([
    ["easy addition operand boundary", "addition-subtraction", "easy", operation("add", number(100), number(0)), true],
    ["easy addition above bound", "addition-subtraction", "easy", operation("add", number(101), number(0)), false],
    ["easy addition crossing tens", "addition-subtraction", "easy", operation("add", number(18), number(5)), false],
    [
      "medium addition crossing tens",
      "addition-subtraction",
      "medium",
      operation("add", number(9999), number(1)),
      true,
    ],
    [
      "medium addition above bound",
      "addition-subtraction",
      "medium",
      operation("add", number(10_001), number(9)),
      false,
    ],
    [
      "hard addition intermediate boundary",
      "addition-subtraction",
      "hard",
      operation("subtract", operation("add", number(999_999), number(1)), number(1_000_000)),
      true,
    ],
    [
      "hard addition beyond intermediate bound",
      "addition-subtraction",
      "hard",
      operation("subtract", operation("add", number(1_000_000), number(1)), number(1)),
      false,
    ],
    [
      "easy multiplication boundary",
      "multiplication-division",
      "easy",
      operation("multiply", number(10), number(10)),
      true,
    ],
    [
      "easy multiplication above table",
      "multiplication-division",
      "easy",
      operation("multiply", number(11), number(1)),
      false,
    ],
    [
      "medium multiplication boundary",
      "multiplication-division",
      "medium",
      operation("multiply", number(999), number(9)),
      true,
    ],
    [
      "medium multiplication above bound",
      "multiplication-division",
      "medium",
      operation("multiply", number(1000), number(9)),
      false,
    ],
    [
      "hard multiplication boundary",
      "multiplication-division",
      "hard",
      operation("multiply", number(10), number(10)),
      true,
    ],
    [
      "hard multiplication below boundary",
      "multiplication-division",
      "hard",
      operation("multiply", number(9), number(100)),
      false,
    ],
    [
      "easy operations count boundary",
      "order-of-operations",
      "easy",
      operation("add", number(100), operation("multiply", number(10), number(10))),
      true,
    ],
    [
      "easy operations count above bound",
      "order-of-operations",
      "easy",
      operation("add", operation("multiply", number(2), number(3)), operation("multiply", number(4), number(5))),
      false,
    ],
    [
      "medium operand boundary",
      "order-of-operations",
      "medium",
      operation("add", operation("multiply", number(1000), number(1)), operation("subtract", number(1), number(0))),
      true,
    ],
    [
      "medium operand above bound",
      "order-of-operations",
      "medium",
      operation("add", operation("multiply", number(1001), number(1)), operation("subtract", number(1), number(0))),
      false,
    ],
    [
      "hard operation count boundary",
      "order-of-operations",
      "hard",
      operation(
        "add",
        operation("multiply", number(100), number(10)),
        operation("subtract", number(5), operation("divide", number(8), number(2))),
      ),
      true,
    ],
    [
      "hard operation count above bound",
      "order-of-operations",
      "hard",
      operation(
        "add",
        operation("multiply", number(100), number(10)),
        operation("subtract", number(5), operation("divide", operation("add", number(8), number(2)), number(2))),
      ),
      false,
    ],
  ])("checks %s", (_label, topic, difficulty, expression, valid) => {
    const requestValue = request(
      topic as ExerciseGenerationRequest["topic"],
      difficulty as ExerciseGenerationRequest["difficulty"],
    );
    if (!valid) {
      expect(() => renderArithmeticExercise(requestValue, { version: 1, expression })).toThrow(
        ArithmeticAuthorityError,
      );
    } else {
      expect(renderArithmeticExercise(requestValue, { version: 1, expression }).proposedCanonicalAnswer).toMatch(
        /^(0|[1-9][0-9]*)$/,
      );
    }
  });

  it.each([
    { version: 2, expression: operation("add", number(1), number(1)) },
    { version: 1, expression: { kind: "power", left: number(2), right: number(3) } },
    { version: 1, expression: operation("add", number(-1), number(2)) },
    { version: 1, expression: operation("add", number(1.5), number(2)) },
    { version: 1, expression: operation("divide", number(1), number(0)) },
    { version: 1, expression: operation("divide", number(5), number(2)) },
    { version: 1, expression: operation("subtract", number(1), number(2)) },
    {
      version: 1,
      expression: operation(
        "add",
        number(1),
        operation(
          "add",
          number(1),
          operation("add", number(1), operation("add", number(1), operation("add", number(1), number(1)))),
        ),
      ),
    },
  ])("rejects unsupported or invalid structures: %o", (structure) => {
    expect(() => renderArithmeticExercise(request("addition-subtraction", "easy"), structure)).toThrow(
      ArithmeticAuthorityError,
    );
  });

  it("rejects unsupported topics explicitly", () => {
    expect(() =>
      renderArithmeticExercise(request("word-problems", "easy"), {
        version: 1,
        expression: operation("add", number(1), number(1)),
      }),
    ).toThrow(new ArithmeticAuthorityError("UNSUPPORTED_TOPIC"));
  });
});
