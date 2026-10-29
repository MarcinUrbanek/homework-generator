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
const firstStructure = {
  version: 1 as const,
  expression: {
    kind: "add" as const,
    left: { kind: "number" as const, value: 12 },
    right: { kind: "number" as const, value: 7 },
  },
};
const secondStructure = {
  version: 1 as const,
  expression: {
    kind: "subtract" as const,
    left: { kind: "number" as const, value: 48 },
    right: { kind: "number" as const, value: 18 },
  },
};
const firstBatch: ExerciseGenerationSuccess = {
  requestedCount: 5,
  validCount: 2,
  partial_batch: true,
  candidates: [
    {
      id: "candidate-1",
      text: "Oblicz wartość wyrażenia: (12 + 7). Podaj wynik jako jedną liczbę naturalną.",
      proposedCanonicalAnswer: "19",
      grade: 4,
      topic: "addition-subtraction",
      difficulty: "easy",
      approvalStatus: "unverified",
      arithmeticStructure: firstStructure,
    },
    {
      id: "candidate-2",
      text: "Oblicz wartość wyrażenia: (48 - 18). Podaj wynik jako jedną liczbę naturalną.",
      proposedCanonicalAnswer: "30",
      grade: 4,
      topic: "addition-subtraction",
      difficulty: "easy",
      approvalStatus: "unverified",
      arithmeticStructure: secondStructure,
    },
  ],
};

const firstSuccess: ExerciseVerificationResult = {
  candidateId: "candidate-1",
  verificationId: firstVerificationId,
  outcome: "unique_answer",
  verifiedAnswer: "19",
  rationale: "Jednoznaczny wynik.",
  verifierIdentity: "ArithmeticAuthority",
  verifierVersion: "arithmetic-authority-v1",
  verifiedAt: "2026-09-29T12:00:00.000Z",
  arithmeticStructure: firstStructure,
  authorityVersion: 1,
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
  verifiedAnswer: "30",
  arithmeticStructure: secondStructure,
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

function storeCurrentBatch(): void {
  storeSessionExerciseBatch(sessionStorage, createExerciseReviewBatch(firstBatch));
}

function storeSelectedReviewedBatch(): void {
  let batch = applyExerciseVerificationResults(createExerciseReviewBatch(firstBatch), [firstSuccess, secondSuccess]);
  batch = selectExerciseVerification(batch, firstVerificationId, true);
  storeSessionExerciseBatch(sessionStorage, batch);
}

function storeFullySelectedReviewedBatch(): void {
  let batch = applyExerciseVerificationResults(createExerciseReviewBatch(firstBatch), [firstSuccess, secondSuccess]);
  batch = selectExerciseVerification(batch, firstVerificationId, true);
  batch = selectExerciseVerification(batch, secondVerificationId, true);
  storeSessionExerciseBatch(sessionStorage, batch);
}

function storeLegacySelectedBatch(): void {
  let batch = applyExerciseVerificationResults(createExerciseReviewBatch(firstBatch), [firstSuccess, secondSuccess]);
  batch = selectExerciseVerification(batch, firstVerificationId, true);
  batch = selectExerciseVerification(batch, secondVerificationId, true);
  sessionStorage.setItem(
    "latest-successful-exercise-batch",
    JSON.stringify({ version: 3, batch: { ...batch, eligibility: undefined } }),
  );
}

function renderForm(): void {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(<RequestExercisesForm />);
  });
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
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
  vi.useRealTimers();
  container.remove();
  vi.unstubAllGlobals();
});

describe("RequestExercisesForm review workflow", () => {
  it("verifies explicitly, exposes granular results, and retries only indeterminate candidates", async () => {
    storeCurrentBatch();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [firstSuccess, indeterminate] }))
      .mockResolvedValueOnce(jsonResponse({ results: [secondSuccess] }));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    expect(fetchMock).not.toHaveBeenCalled();
    act(() => {
      button("Zweryfikuj zestaw").click();
    });
    await flushPromises();

    const initialRequest = exerciseVerificationRequestSchema.parse(requestBody(fetchMock, 0));
    expect(initialRequest.candidates.map((candidate) => candidate.id)).toEqual(["candidate-1", "candidate-2"]);
    expect(container.textContent).toContain("Dowód arytmetyczny potwierdzony");
    expect(container.textContent).toContain("Błąd techniczny — wynik nierozstrzygnięty");
    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(checkboxes[0].disabled).toBe(false);
    expect(checkboxes.map((checkbox) => checkbox.getAttribute("aria-label"))).toEqual(
      checkboxes.map((_, index) => `Wybierz do zapisania: zadanie ${index + 1}`),
    );
    expect(checkboxes[1].disabled).toBe(true);

    act(() => {
      button("Ponów nierozstrzygnięte").click();
    });
    await flushPromises();

    const retryRequest = exerciseVerificationRequestSchema.parse(requestBody(fetchMock, 1));
    expect(retryRequest.candidates.map((candidate) => candidate.id)).toEqual(["candidate-2"]);
    expect(container.textContent).not.toContain("Błąd techniczny — wynik nierozstrzygnięty");
    expect(container.textContent.match(/Dowód arytmetyczny potwierdzony/g)).toHaveLength(2);
  }, 15_000);

  it("locks generation, verification, clearing, and selection while verification is pending", () => {
    storeCurrentBatch();
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
    expect(container.textContent).toContain("Oblicz wartość wyrażenia: (12 + 7).");
    expect(container.textContent).toContain("Oblicz wartość wyrażenia: (48 - 18).");
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
    expect(container.textContent).not.toContain("Oblicz wartość wyrażenia: (12 + 7).");
    expect(container.textContent).toContain("Oblicz wartość wyrażenia: (48 - 18).");
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
      text: "Oblicz wartość wyrażenia: (12 + 7). Podaj wynik jako jedną liczbę naturalną.",
      proposedCanonicalAnswer: "19",
      grade: 4,
      topic: "addition-subtraction",
      difficulty: "easy",
      approvalStatus: "unverified",
      arithmeticStructure: {
        version: 1,
        expression: {
          kind: "add",
          left: { kind: "number", value: 12 },
          right: { kind: "number", value: 7 },
        },
      },
    },
  ],
};

const replacementBatch: ExerciseGenerationSuccess = {
  ...generationBatch,
  candidates: [
    {
      ...generationBatch.candidates[0],
      id: "candidate-2",
      text: "Oblicz wartość wyrażenia: ((48 - 19) + 1). Podaj wynik jako jedną liczbę naturalną.",
      proposedCanonicalAnswer: "30",
      difficulty: "hard",
      arithmeticStructure: {
        version: 1,
        expression: {
          kind: "add",
          left: {
            kind: "subtract",
            left: { kind: "number", value: 48 },
            right: { kind: "number", value: 19 },
          },
          right: { kind: "number", value: 1 },
        },
      },
    },
  ],
};

const replacementVerification: ExerciseVerificationResult = {
  ...firstSuccess,
  candidateId: "candidate-2",
  verificationId: secondVerificationId,
  verifiedAnswer: "30",
  arithmeticStructure: replacementBatch.candidates[0].arithmeticStructure,
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

function selectTopic(label: string): void {
  const topicTrigger = container.querySelector<HTMLButtonElement>("#topic");
  if (!topicTrigger) {
    throw new Error("Expected topic selector");
  }

  act(() => {
    topicTrigger.click();
  });

  const option = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')).find(
    (element) => element.textContent === label,
  );
  if (!option) {
    throw new Error(`Expected topic option: ${label}`);
  }

  act(() => {
    option.click();
  });
}

describe("RequestExercisesForm", () => {
  it("offers only the three supported arithmetic topics", () => {
    renderForm();
    const topicTrigger = container.querySelector<HTMLButtonElement>("#topic");
    if (!topicTrigger) throw new Error("Expected topic selector");
    act(() => {
      topicTrigger.click();
    });

    expect(
      Array.from(document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')).map((option) =>
        option.textContent.trim(),
      ),
    ).toEqual([
      "Dodawanie i odejmowanie liczb naturalnych",
      "Mnożenie i dzielenie liczb naturalnych",
      "Kolejność wykonywania działań",
    ]);
    expect(container.textContent).toContain("Zadania tekstowe nie są obsługiwane.");
  });

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
    expect(container.textContent).toContain("Oblicz wartość wyrażenia: (12 + 7).");

    await act(async () => {
      resolveResponse(jsonResponse(replacementBatch));
      await pendingResponse;
    });

    expect(container.textContent).toContain("Oblicz wartość wyrażenia: ((48 - 19) + 1).");
    expect(container.textContent).not.toContain("Oblicz wartość wyrażenia: (12 + 7).");
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
    expect(container.textContent).toContain(
      "Oblicz wartość wyrażenia: (12 + 7). Podaj wynik jako jedną liczbę naturalną.",
    );
  });

  it("renders a restored batch and clears it through the view action", () => {
    storeBatch(generationBatch);
    renderForm();

    expect(container.textContent).toContain(
      "Oblicz wartość wyrażenia: (12 + 7). Podaj wynik jako jedną liczbę naturalną.",
    );
    const clearButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("Wyczyść wyniki"),
    );
    expect(clearButton).toBeDefined();

    act(() => clearButton?.click());

    expect(container.textContent).not.toContain("Oblicz 12 + 7.");
    expect(sessionStorage.getItem("latest-successful-exercise-batch")).toBeNull();
  });

  it("keeps a selected legacy batch reference-only until a new batch is generated and reviewed", async () => {
    storeLegacySelectedBatch();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(replacementBatch))
      .mockResolvedValueOnce(jsonResponse({ results: [replacementVerification] }))
      .mockResolvedValueOnce(
        jsonResponse({
          mappings: [
            {
              verificationId: secondVerificationId,
              exerciseId: "44444444-4444-4444-8444-444444444444",
              created: true,
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    expect(container.textContent).toContain("zachowany wyłącznie jako materiał referencyjny");
    expect(container.textContent).toContain("Oblicz wartość wyrażenia: (12 + 7).");
    expect(
      Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).every(
        (input) => !input.checked && input.disabled,
      ),
    ).toBe(true);
    expect(button("Zweryfikuj zestaw").disabled).toBe(true);
    expect(button("Zatwierdź i zapisz").disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      submitForm();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Oblicz wartość wyrażenia: ((48 - 19) + 1).");
    expect(container.textContent).not.toContain("materiał referencyjny");
    expect(button("Zweryfikuj zestaw").disabled).toBe(false);

    await act(async () => {
      button("Zweryfikuj zestaw").click();
      await Promise.resolve();
    });
    expect(exerciseVerificationRequestSchema.parse(requestBody(fetchMock, 1)).candidates.map(({ id }) => id)).toEqual([
      "candidate-2",
    ]);
    const currentCheckbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!currentCheckbox) throw new Error("Expected replacement selection checkbox");
    expect(currentCheckbox.disabled).toBe(false);
    act(() => {
      currentCheckbox.click();
    });
    expect(button("Zatwierdź i zapisz").disabled).toBe(false);

    await act(async () => {
      button("Zatwierdź i zapisz").click();
      await Promise.resolve();
    });
    expect(exerciseApprovalRequestSchema.parse(requestBody(fetchMock, 2))).toEqual({
      verificationIds: [secondVerificationId],
    });
    expect(container.textContent).toContain("Zapisano 1 zadanie w zatwierdzonej puli.");
  });

  it.each([
    {
      label: "the hourly generation limit",
      code: "GENERATION_LIMIT_EXCEEDED",
      message: "Osiągnięto limit 10 żądań generowania w ciągu godziny. Spróbuj ponownie później.",
    },
    {
      label: "an in-progress generation",
      code: "GENERATION_IN_PROGRESS",
      message: "Generowanie zadań już trwa. Spróbuj ponownie po jego zakończeniu.",
    },
    {
      label: "admission unavailability",
      code: "ADMISSION_UNAVAILABLE",
      message: "Nie można teraz sprawdzić limitu generowania. Spróbuj ponownie później.",
    },
  ])("preserves reviewed work after $label", async ({ code, message }) => {
    storeFullySelectedReviewedBatch();
    const storedBefore = sessionStorage.getItem("latest-successful-exercise-batch");
    const batchBefore = restoreSessionExerciseBatch(sessionStorage);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { code, message } }, false));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    selectTopic("Mnożenie i dzielenie liczb naturalnych");
    const hardDifficulty = container.querySelector<HTMLButtonElement>("#difficulty-hard");
    expect(hardDifficulty).not.toBeNull();
    act(() => hardDifficulty?.click());

    vi.useFakeTimers();
    await act(async () => {
      submitForm();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(exerciseGenerationRequestSchema.parse(requestBody(fetchMock, 0))).toEqual({
      grade: 4,
      topic: "multiplication-division",
      difficulty: "hard",
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      `${message} Poprzednie wyniki, jeśli były dostępne, pozostały bez zmian.`,
    );
    expect(sessionStorage.getItem("latest-successful-exercise-batch")).toBe(storedBefore);
    expect(restoreSessionExerciseBatch(sessionStorage)).toEqual(batchBefore);
    expect(batchBefore?.selectedVerificationIds).toEqual([firstVerificationId, secondVerificationId]);
    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(checkboxes.map(({ checked }) => checked)).toEqual([true, true]);

    expect(container.querySelector<HTMLButtonElement>("#topic")?.textContent).toContain(
      "Mnożenie i dzielenie liczb naturalnych",
    );
    expect(container.querySelector<HTMLButtonElement>("#difficulty-hard")?.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector<HTMLFieldSetElement>("form fieldset")?.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>('form button[type="submit"]')?.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>("#topic")?.disabled).toBe(false);
    expect(hardDifficulty?.disabled).toBe(false);
    expect(checkboxes.every(({ disabled }) => !disabled)).toBe(true);
    expect(button("Zatwierdź i zapisz").disabled).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
