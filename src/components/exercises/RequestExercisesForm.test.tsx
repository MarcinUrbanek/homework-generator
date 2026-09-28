// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RequestExercisesForm from "@/components/exercises/RequestExercisesForm";
import type { ExerciseGenerationSuccess } from "@/types";

const firstBatch: ExerciseGenerationSuccess = {
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
  ...firstBatch,
  candidates: [
    {
      ...firstBatch.candidates[0],
      id: "candidate-2",
      text: "Oblicz 48 - 19.",
      proposedCanonicalAnswer: "29",
      difficulty: "hard",
    },
  ],
};

let container: HTMLDivElement;
let root: Root;

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function storeBatch(batch: ExerciseGenerationSuccess): void {
  sessionStorage.setItem("latest-successful-exercise-batch", JSON.stringify({ version: 1, batch }));
}

function renderForm(): void {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(<RequestExercisesForm />);
  });
}

function submitForm(): void {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("Expected request form");
  }
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
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

describe("RequestExercisesForm", () => {
  it("submits the selected payload, locks duplicate requests, and replaces the prior batch", async () => {
    storeBatch(firstBatch);
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
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
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
    const storedBatch = JSON.parse(sessionStorage.getItem("latest-successful-exercise-batch") ?? "null") as {
      batch: ExerciseGenerationSuccess;
    };
    expect(storedBatch.batch).toEqual(replacementBatch);
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
    storeBatch(firstBatch);
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
    storeBatch(firstBatch);
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
