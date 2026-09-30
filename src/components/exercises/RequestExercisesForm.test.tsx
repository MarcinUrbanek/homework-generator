// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RequestExercisesForm from "@/components/exercises/RequestExercisesForm";
import {
  applyExerciseVerificationResults,
  createExerciseReviewBatch,
  restoreSessionExerciseBatch,
  selectExerciseVerification,
  storeSessionExerciseBatch,
} from "@/components/hooks/use-session-exercise-batch";
import {
  exerciseApprovalRequestSchema,
  exerciseGenerationRequestSchema,
  exerciseVerificationRequestSchema,
} from "@/lib/exercises/schemas";
import type { ExerciseGenerationSuccess, ExerciseVerificationResult } from "@/types";

const firstVerificationId = "11111111-1111-4111-8111-111111111111";
const secondVerificationId = "22222222-2222-4222-8222-222222222222";
const firstBatch: ExerciseGenerationSuccess = {
  requestedCount: 5,
  validCount: 2,
  partial_batch: true,
  candidates: [
    {
      id: "candidate-1",
      text: "Oblicz 12 + 7.",
      proposedCanonicalAnswer: "19",
      grade: 4,
      topic: "addition-subtraction",
      difficulty: "easy",
      approvalStatus: "unverified",
    },
    {
      id: "candidate-2",
      text: "Oblicz 48 - 19.",
      proposedCanonicalAnswer: "29",
      grade: 4,
      topic: "addition-subtraction",
      difficulty: "easy",
      approvalStatus: "unverified",
    },
  ],
};

const firstSuccess: ExerciseVerificationResult = {
  candidateId: "candidate-1",
  verificationId: firstVerificationId,
  outcome: "unique_answer",
  verifiedAnswer: "19",
  rationale: "Jednoznaczny wynik.",
  verifierIdentity: "openrouter",
  verifierVersion: "model-v1",
  verifiedAt: "2026-09-29T12:00:00.000Z",
};
const indeterminate: ExerciseVerificationResult = {
  candidateId: "candidate-2",
  outcome: "indeterminate",
  error: { code: "PROVIDER_TIMEOUT", message: "Przekroczono limit czasu." },
};
const secondSuccess: ExerciseVerificationResult = {
  ...firstSuccess,
  candidateId: "candidate-2",
  verificationId: secondVerificationId,
  verifiedAnswer: "29",
};

let container: HTMLDivElement;
let root: Root;

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): unknown {
  const requestInit: unknown = fetchMock.mock.calls[callIndex]?.[1];
  if (!requestInit || typeof requestInit !== "object" || !("body" in requestInit)) {
    throw new Error(`Expected request body for fetch call ${callIndex}`);
  }
  if (typeof requestInit.body !== "string") {
    throw new Error(`Expected string request body for fetch call ${callIndex}`);
  }
  return JSON.parse(requestInit.body) as unknown;
}

function storeVersionOneBatch(): void {
  sessionStorage.setItem("latest-successful-exercise-batch", JSON.stringify({ version: 1, batch: firstBatch }));
}

function storeSelectedReviewedBatch(): void {
  let batch = applyExerciseVerificationResults(createExerciseReviewBatch(firstBatch), [firstSuccess, secondSuccess]);
  batch = selectExerciseVerification(batch, firstVerificationId, true);
  storeSessionExerciseBatch(sessionStorage, batch);
}

function renderForm(): void {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(<RequestExercisesForm />);
  });
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll("button")).find((element) => element.textContent.includes(label));
  if (!match) throw new Error(`Expected button: ${label}`);
  return match;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe("RequestExercisesForm review workflow", () => {
  it("verifies explicitly, exposes granular results, and retries only indeterminate candidates", async () => {
    storeVersionOneBatch();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [firstSuccess, indeterminate] }))
      .mockResolvedValueOnce(jsonResponse({ results: [secondSuccess] }));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      button("Zweryfikuj zestaw").click();
      await Promise.resolve();
    });

    const initialRequest = exerciseVerificationRequestSchema.parse(requestBody(fetchMock, 0));
    expect(initialRequest.candidates.map((candidate) => candidate.id)).toEqual(["candidate-1", "candidate-2"]);
    expect(container.textContent).toContain("Odpowiedź potwierdzona");
    expect(container.textContent).toContain("Nie udało się rozstrzygnąć");
    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(checkboxes[0].disabled).toBe(false);
    expect(checkboxes.map((checkbox) => checkbox.getAttribute("aria-label"))).toEqual(
      checkboxes.map((_, index) => `Wybierz do zapisania: zadanie ${index + 1}`),
    );
    expect(checkboxes[1].disabled).toBe(true);

    await act(async () => {
      button("Ponów nierozstrzygnięte").click();
      await Promise.resolve();
    });

    const retryRequest = exerciseVerificationRequestSchema.parse(requestBody(fetchMock, 1));
    expect(retryRequest.candidates.map((candidate) => candidate.id)).toEqual(["candidate-2"]);
    expect(container.textContent).not.toContain("Nie udało się rozstrzygnąć");
    expect(container.textContent.match(/Odpowiedź potwierdzona/g)).toHaveLength(2);
  });

  it("locks generation, verification, clearing, and selection while verification is pending", () => {
    storeVersionOneBatch();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    renderForm();

    act(() => {
      button("Zweryfikuj zestaw").click();
    });

    expect(container.querySelector("fieldset")?.disabled).toBe(true);
    expect(button("Zweryfikuj zestaw").disabled).toBe(true);
    expect(button("Wyczyść wyniki").disabled).toBe(true);
    expect(
      Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).every(
        (input) => input.disabled,
      ),
    ).toBe(true);
  });

  it("preserves the complete batch after an atomic approval failure", async () => {
    storeSelectedReviewedBatch();
    const before = sessionStorage.getItem("latest-successful-exercise-batch");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: "PERSISTENCE_FAILURE", message: "Nie udało się zapisać zadań." } }, false),
        ),
    );
    renderForm();

    await act(async () => {
      button("Zatwierdź i zapisz").click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Cały zestaw pozostał bez zmian.");
    expect(container.textContent).toContain("Oblicz 12 + 7.");
    expect(container.textContent).toContain("Oblicz 48 - 19.");
    expect(sessionStorage.getItem("latest-successful-exercise-batch")).toBe(before);
  });

  it("accepts an idempotent approval mapping, removes only the confirmed candidate, and retains evidence", async () => {
    storeSelectedReviewedBatch();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        mappings: [
          {
            verificationId: firstVerificationId,
            exerciseId: "33333333-3333-4333-8333-333333333333",
            created: false,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    await act(async () => {
      button("Zatwierdź i zapisz").click();
      await Promise.resolve();
    });

    expect(exerciseApprovalRequestSchema.parse(requestBody(fetchMock, 0))).toEqual({
      verificationIds: [firstVerificationId],
    });
    expect(container.textContent).toContain("Zapisano 1 zadanie w zatwierdzonej puli.");
    expect(container.textContent).not.toContain("Oblicz 12 + 7.");
    expect(container.textContent).toContain("Oblicz 48 - 19.");
    expect(container.textContent).toContain("Jednoznaczny wynik.");
    const stored = restoreSessionExerciseBatch(sessionStorage);
    expect(stored?.candidates.map(({ candidate }) => candidate.id)).toEqual(["candidate-2"]);
  });
});

const generationBatch: ExerciseGenerationSuccess = {
  requestedCount: 5,
  validCount: 1,
  partial_batch: true,
  candidates: [
    {
      id: "candidate-1",
      text: "Oblicz 12 + 7.",
      proposedCanonicalAnswer: "19",
      grade: 4,
      topic: "addition-subtraction",
      difficulty: "easy",
      approvalStatus: "unverified",
    },
  ],
};

const replacementBatch: ExerciseGenerationSuccess = {
  ...generationBatch,
  candidates: [
    {
      ...generationBatch.candidates[0],
      id: "candidate-2",
      text: "Oblicz 48 - 19.",
      proposedCanonicalAnswer: "29",
      difficulty: "hard",
    },
  ],
};

function storeBatch(batch: ExerciseGenerationSuccess): void {
  sessionStorage.setItem("latest-successful-exercise-batch", JSON.stringify({ version: 1, batch }));
}

function submitForm(): void {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("Expected request form");
  }
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("RequestExercisesForm", () => {
  it("submits the selected payload, locks duplicate requests, and replaces the prior batch", async () => {
    storeBatch(generationBatch);
    let resolveResponse: (response: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init: RequestInit) => pendingResponse);
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    const hardDifficulty = container.querySelector<HTMLButtonElement>("#difficulty-hard");
    expect(hardDifficulty).not.toBeNull();
    act(() => hardDifficulty?.click());
    act(() => {
      submitForm();
      submitForm();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(exerciseGenerationRequestSchema.parse(requestBody(fetchMock, 0))).toEqual({
      grade: 4,
      topic: "addition-subtraction",
      difficulty: "hard",
    });
    expect(container.textContent).toContain("Generowanie zadań...");
    expect(container.querySelector("fieldset")?.disabled).toBe(true);
    expect(container.textContent).toContain("Oblicz 12 + 7.");

    await act(async () => {
      resolveResponse(jsonResponse(replacementBatch));
      await pendingResponse;
    });

    expect(container.textContent).toContain("Oblicz 48 - 19.");
    expect(container.textContent).not.toContain("Oblicz 12 + 7.");
    expect(restoreSessionExerciseBatch(sessionStorage)).toEqual(createExerciseReviewBatch(replacementBatch));
  });

  it.each([
    {
      label: "a malformed success response",
      response: jsonResponse({ requestedCount: 5, validCount: 5, candidates: [] }),
      message: "Nie udało się odczytać odpowiedzi generatora.",
    },
    {
      label: "a provider error response",
      response: jsonResponse(
        { error: { code: "PROVIDER_FAILURE", message: "Generator jest chwilowo niedostępny." } },
        false,
      ),
      message: "Generator jest chwilowo niedostępny.",
    },
  ])("preserves prior results for $label", async ({ response, message }) => {
    storeBatch(generationBatch);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    renderForm();

    await act(async () => {
      submitForm();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(container.textContent).toContain("Poprzednie wyniki, jeśli były dostępne, pozostały bez zmian.");
    expect(container.textContent).toContain("Oblicz 12 + 7.");
  });

  it("renders a restored batch and clears it through the view action", () => {
    storeBatch(generationBatch);
    renderForm();

    expect(container.textContent).toContain("Oblicz 12 + 7.");
    const clearButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("Wyczyść wyniki"),
    );
    expect(clearButton).toBeDefined();

    act(() => clearButton?.click());

    expect(container.textContent).not.toContain("Oblicz 12 + 7.");
    expect(sessionStorage.getItem("latest-successful-exercise-batch")).toBeNull();
  });
});
