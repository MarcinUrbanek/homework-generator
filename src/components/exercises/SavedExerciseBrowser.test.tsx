// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SavedExerciseBrowser from "@/components/exercises/SavedExerciseBrowser";
import type { SavedExerciseSuccess } from "@/types";

let container: HTMLDivElement;
let root: Root;

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function exercise(index: number) {
  return {
    id: `${String(index).padStart(8, "0")}-0000-4000-8000-000000000000`,
    text: `Zadanie ${index}`,
    canonicalAnswer: String(index),
    grade: 4 as const,
    topic: "addition-subtraction" as const,
    difficulty: "easy" as const,
    approvedAt: "2026-10-02T12:00:00.000Z",
  };
}

function success(exercises = [exercise(1)], nextCursor: string | null = null): SavedExerciseSuccess {
  return { exercises, nextCursor };
}

function renderBrowser(): void {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(<SavedExerciseBrowser />);
  });
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll("button")).find((element) => element.textContent.includes(label));
  if (!match) throw new Error(`Expected button: ${label}`);
  return match;
}

function submit(): void {
  container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

function selectDifficulty(value: "easy" | "medium" | "hard"): void {
  const trigger = container.querySelector<HTMLButtonElement>("#saved-difficulty");
  if (!trigger) throw new Error("Expected difficulty select trigger");
  act(() => {
    trigger.click();
  });
  const option = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')).find(
    (element) => element.textContent === { easy: "Łatwy", medium: "Średni", hard: "Trudny" }[value],
  );
  if (!option) throw new Error(`Expected difficulty option: ${value}`);
  act(() => {
    option.click();
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe("SavedExerciseBrowser", () => {
  it("waits for explicit submission and requests the topic across all difficulty levels", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(success()));
    vi.stubGlobal("fetch", fetchMock);
    renderBrowser();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      submit();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/exercises/saved?grade=4&topic=addition-subtraction");
    expect(container.textContent).toContain("Zadanie 1");
    expect(container.textContent).toContain("wszystkie poziomy");
  });

  it("includes an explicitly selected difficulty in the request predicate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(success()));
    vi.stubGlobal("fetch", fetchMock);
    renderBrowser();

    selectDifficulty("hard");
    await act(async () => {
      submit();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/exercises/saved?grade=4&topic=addition-subtraction&difficulty=hard");
    expect(container.textContent).toContain("Trudny");
  });

  it("locks duplicate requests and replaces results after a successful new search", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pendingResponse);
    vi.stubGlobal("fetch", fetchMock);
    renderBrowser();

    act(() => {
      submit();
      submit();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(button("Pokaż zadania").disabled).toBe(true);

    await act(async () => {
      resolveResponse(jsonResponse(success([exercise(2)])));
      await pendingResponse;
    });
    expect(container.textContent).toContain("Zadanie 2");
    expect(container.textContent).not.toContain("Zadanie 1");
  });

  it("replaces populated results with an explicit empty state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(success()))
      .mockResolvedValueOnce(jsonResponse(success([])));
    vi.stubGlobal("fetch", fetchMock);
    renderBrowser();

    await act(async () => {
      submit();
      await Promise.resolve();
    });
    await act(async () => {
      submit();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Nie znaleziono zatwierdzonych zadań");
    expect(container.textContent).not.toContain("Zadanie 1");
  });

  it("appends unique results in server order and forwards the cursor", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => exercise(index + 1));
    const secondPage = [exercise(20), exercise(21)];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(success(firstPage, "cursor-20")))
      .mockResolvedValueOnce(jsonResponse(success(secondPage)));
    vi.stubGlobal("fetch", fetchMock);
    renderBrowser();

    await act(async () => {
      submit();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("20 zadań");

    await act(async () => {
      button("Wczytaj więcej").click();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/exercises/saved?grade=4&topic=addition-subtraction&cursor=cursor-20",
    );
    expect(container.textContent).toContain("21 zadań");
    expect(container.querySelectorAll('[data-slot="card"]').length).toBe(21);
    expect(container.textContent).not.toContain("Wczytaj więcej");
  });

  it("preserves rendered results and the pagination cursor when Load more fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(success([exercise(1)], "cursor-1")))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "DATABASE_UNAVAILABLE", message: "Baza chwilowo niedostępna." } }, false),
      )
      .mockResolvedValueOnce(jsonResponse(success([exercise(1), exercise(2)])));
    vi.stubGlobal("fetch", fetchMock);
    renderBrowser();

    await act(async () => {
      submit();
      await Promise.resolve();
    });
    await act(async () => {
      button("Wczytaj więcej").click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Baza chwilowo niedostępna.");
    expect(container.textContent).toContain("Zadanie 1");
    expect(button("Wczytaj więcej")).toBeTruthy();

    await act(async () => {
      button("Spróbuj ponownie").click();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/exercises/saved?grade=4&topic=addition-subtraction&cursor=cursor-1",
    );
    expect(container.textContent).toContain("Zadanie 2");
  });

  it("preserves applied results on failure and retries malformed or error envelopes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(success()))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "PERSISTENCE_FAILURE", message: "Błąd bazy." } }, false))
      .mockResolvedValueOnce(jsonResponse({ exercises: "malformed" }))
      .mockResolvedValueOnce(jsonResponse(success([exercise(2)])));
    vi.stubGlobal("fetch", fetchMock);
    renderBrowser();

    await act(async () => {
      submit();
      await Promise.resolve();
    });
    await act(async () => {
      submit();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Błąd bazy.");
    expect(container.textContent).toContain("Zadanie 1");
    expect(container.textContent).toContain("Wyświetlane filtry");

    await act(async () => {
      button("Spróbuj ponownie").click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Nie udało się odczytać odpowiedzi zapisanych zadań.");

    await act(async () => {
      button("Spróbuj ponownie").click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Zadanie 2");
    expect(container.textContent).not.toContain("Zadanie 1");
  });
});
