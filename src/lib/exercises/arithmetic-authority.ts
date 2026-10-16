import { z } from "zod";

import { SUPPORTED_GRADE_4_ARITHMETIC_TOPICS } from "@/lib/exercises/catalog";
import type {
  ArithmeticExpressionV1,
  ArithmeticStructure,
  ExerciseGenerationRequest,
  SupportedArithmeticTopicSlug,
} from "@/types";

const MAX_AUTHORITY_VALUE = 1_000_000;

export const ARITHMETIC_AUTHORITY_V1_LIMITS = {
  maxDepth: 4,
  maxOperations: 4,
  maxIntermediateValue: MAX_AUTHORITY_VALUE,
  buckets: {
    "addition-subtraction": {
      easy: {
        minOperations: 1,
        maxOperations: 1,
        maxOperand: 100,
        operators: ["add", "subtract"],
        tensCrossing: "forbidden",
      },
      medium: {
        minOperations: 1,
        maxOperations: 1,
        maxOperand: 10_000,
        operators: ["add", "subtract"],
        tensCrossing: "required",
      },
      hard: { minOperations: 2, maxOperations: 2, maxOperand: 1_000_000, operators: ["add", "subtract"] },
    },
    "multiplication-division": {
      easy: { minOperations: 1, maxOperations: 1, maxOperand: 100, operators: ["multiply", "divide"] },
      medium: { minOperations: 1, maxOperations: 1, maxOperand: 8_991, operators: ["multiply", "divide"] },
      hard: { minOperations: 1, maxOperations: 1, maxOperand: 1_000_000, operators: ["multiply", "divide"] },
    },
    "order-of-operations": {
      easy: {
        minOperations: 2,
        maxOperations: 2,
        maxOperand: 100,
        operators: ["add", "subtract", "multiply", "divide"],
      },
      medium: {
        minOperations: 3,
        maxOperations: 3,
        maxOperand: 1_000,
        operators: ["add", "subtract", "multiply", "divide"],
      },
      hard: {
        minOperations: 4,
        maxOperations: 4,
        maxOperand: 10_000,
        operators: ["add", "subtract", "multiply", "divide"],
      },
    },
  },
} as const;

const numberExpressionSchema = z
  .object({
    kind: z.literal("number"),
    value: z.number().int().min(0).max(MAX_AUTHORITY_VALUE),
  })
  .strict();

export const arithmeticExpressionSchema: z.ZodType<ArithmeticExpressionV1> = z.lazy(() =>
  z.union([
    numberExpressionSchema,
    z
      .object({
        kind: z.literal("add"),
        left: arithmeticExpressionSchema,
        right: arithmeticExpressionSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("subtract"),
        left: arithmeticExpressionSchema,
        right: arithmeticExpressionSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("multiply"),
        left: arithmeticExpressionSchema,
        right: arithmeticExpressionSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("divide"),
        left: arithmeticExpressionSchema,
        right: arithmeticExpressionSchema,
      })
      .strict(),
  ]),
);

export const arithmeticStructureSchema: z.ZodType<ArithmeticStructure> = z
  .object({
    version: z.literal(1),
    expression: arithmeticExpressionSchema,
  })
  .strict();

export type ArithmeticAuthorityErrorCode =
  "UNSUPPORTED_TOPIC" | "INVALID_STRUCTURE" | "OUT_OF_BOUNDS" | "INVALID_ARITHMETIC";

export class ArithmeticAuthorityError extends Error {
  readonly code: ArithmeticAuthorityErrorCode;

  constructor(code: ArithmeticAuthorityErrorCode) {
    super(code);
    this.name = "ArithmeticAuthorityError";
    this.code = code;
  }
}

interface Evaluation {
  value: number;
  operationCount: number;
  depth: number;
  operators: ("add" | "subtract" | "multiply" | "divide")[];
  operands: number[];
}

function evaluateExpression(expression: ArithmeticExpressionV1, depth: number): Evaluation {
  if (depth > ARITHMETIC_AUTHORITY_V1_LIMITS.maxDepth) {
    throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
  }

  if (expression.kind === "number") {
    return { value: expression.value, operationCount: 0, depth: 0, operators: [], operands: [expression.value] };
  }

  const left = evaluateExpression(expression.left, depth + 1);
  const right = evaluateExpression(expression.right, depth + 1);
  let value: number;

  switch (expression.kind) {
    case "add":
      value = left.value + right.value;
      break;
    case "subtract":
      if (left.value < right.value) throw new ArithmeticAuthorityError("INVALID_ARITHMETIC");
      value = left.value - right.value;
      break;
    case "multiply":
      value = left.value * right.value;
      break;
    case "divide":
      if (right.value === 0 || left.value % right.value !== 0) {
        throw new ArithmeticAuthorityError("INVALID_ARITHMETIC");
      }
      value = left.value / right.value;
      break;
  }

  if (!Number.isSafeInteger(value) || value > ARITHMETIC_AUTHORITY_V1_LIMITS.maxIntermediateValue) {
    throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
  }

  return {
    value,
    operationCount: left.operationCount + right.operationCount + 1,
    depth: Math.max(left.depth, right.depth) + 1,
    operators: [...left.operators, ...right.operators, expression.kind],
    operands: [...left.operands, ...right.operands],
  };
}

interface OneOperationExpression {
  kind: "add" | "subtract" | "multiply" | "divide";
  left: { kind: "number"; value: number };
  right: { kind: "number"; value: number };
}

function assertOneOperationOperands(expression: ArithmeticExpressionV1): asserts expression is OneOperationExpression {
  if (expression.kind === "number" || expression.left.kind !== "number" || expression.right.kind !== "number") {
    throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
  }
}

function assertTopicSpecificLimits(
  request: ExerciseGenerationRequest,
  expression: ArithmeticExpressionV1,
  evaluation: Evaluation,
): void {
  if (request.topic === "addition-subtraction") {
    if (request.difficulty === "easy" || request.difficulty === "medium") {
      assertOneOperationOperands(expression);
      const left = expression.left.value;
      const right = expression.right.value;
      const crossesTens = expression.kind === "add" ? (left % 10) + (right % 10) >= 10 : left % 10 < right % 10;
      const rule = ARITHMETIC_AUTHORITY_V1_LIMITS.buckets[request.topic][request.difficulty];
      if ((rule.tensCrossing === "required") !== crossesTens) {
        throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
      }
    }
    return;
  }

  if (request.topic === "multiplication-division") {
    assertOneOperationOperands(expression);
    const left = expression.left.value;
    const right = expression.right.value;

    if (request.difficulty === "easy") {
      const withinTimesTable = expression.kind === "multiply" ? left <= 10 && right <= 10 : left <= 100 && right <= 10;
      if (!withinTimesTable) throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
      return;
    }

    if (request.difficulty === "medium") {
      const withinMediumBucket =
        expression.kind === "multiply"
          ? (left <= 999 && right <= 9) || (right <= 999 && left <= 9)
          : left <= 8_991 && right <= 9 && evaluation.value <= 999;
      if (!withinMediumBucket) throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
      return;
    }

    const withinHardBucket =
      expression.kind === "multiply" ? left >= 10 && right >= 10 : left >= 100 && right >= 1 && right <= 9;
    if (!withinHardBucket) throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
    return;
  }

  if (request.difficulty === "easy") {
    if (expression.kind !== "add" && expression.kind !== "subtract") {
      throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
    }
    const highPrecedenceChild =
      expression.left.kind === "multiply" ||
      expression.left.kind === "divide" ||
      expression.right.kind === "multiply" ||
      expression.right.kind === "divide";
    if (!highPrecedenceChild) throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
    return;
  }

  const hasAdditiveOperation = evaluation.operators.some((operator) => operator === "add" || operator === "subtract");
  const hasMultiplicativeOperation = evaluation.operators.some(
    (operator) => operator === "multiply" || operator === "divide",
  );
  if (!hasAdditiveOperation || !hasMultiplicativeOperation) {
    throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
  }
}

function renderExpression(expression: ArithmeticExpressionV1): string {
  if (expression.kind === "number") return String(expression.value);

  const symbol = {
    add: "+",
    subtract: "-",
    multiply: "×",
    divide: ":",
  }[expression.kind];

  return `(${renderExpression(expression.left)} ${symbol} ${renderExpression(expression.right)})`;
}

export function renderArithmeticExercise(
  request: ExerciseGenerationRequest,
  structureValue: unknown,
): { arithmeticStructure: ArithmeticStructure; text: string; proposedCanonicalAnswer: string } {
  if (!SUPPORTED_GRADE_4_ARITHMETIC_TOPICS.some((topic) => topic === request.topic)) {
    throw new ArithmeticAuthorityError("UNSUPPORTED_TOPIC");
  }

  const structure = arithmeticStructureSchema.safeParse(structureValue);
  if (!structure.success) throw new ArithmeticAuthorityError("INVALID_STRUCTURE");

  const evaluation = evaluateExpression(structure.data.expression, 0);
  const rule =
    ARITHMETIC_AUTHORITY_V1_LIMITS.buckets[request.topic as SupportedArithmeticTopicSlug][request.difficulty];

  if (
    evaluation.operationCount < rule.minOperations ||
    evaluation.operationCount > rule.maxOperations ||
    evaluation.depth > ARITHMETIC_AUTHORITY_V1_LIMITS.maxDepth ||
    evaluation.operationCount > ARITHMETIC_AUTHORITY_V1_LIMITS.maxOperations ||
    evaluation.operands.some((operand) => operand > rule.maxOperand) ||
    evaluation.operators.some((operator) => !(rule.operators as readonly string[]).includes(operator))
  ) {
    throw new ArithmeticAuthorityError("OUT_OF_BOUNDS");
  }

  assertTopicSpecificLimits(request, structure.data.expression, evaluation);

  return {
    arithmeticStructure: structure.data,
    text: `Oblicz wartość wyrażenia: ${renderExpression(structure.data.expression)}. Podaj wynik jako jedną liczbę naturalną.`,
    proposedCanonicalAnswer: String(evaluation.value),
  };
}
