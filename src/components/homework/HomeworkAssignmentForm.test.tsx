// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomeworkAssignmentForm from "@/components/homework/HomeworkAssignmentForm";
import { homeworkAssignmentRequestSchema } from "@/lib/homework/schemas";
import type { HomeworkRosterSuccess } from "@/types";

const classId = "00000000-0000-4000-8000-000000000001";
const firstStudentId = "00000000-0000-4000-8000-000000000002";
const secondStudentId = "00000000-0000-4000-8000-000000000003";
const departedStudentId = "00000000-0000-4000-8000-000000000004";

const roster: HomeworkRosterSuccess = {
  members: [
    { studentId: firstStudentId, email: "ania@example.test", joinedAt: "2026-10-01T10:00:00.000Z" },
    { studentId: secondStudentId, email: "bartek@example.test", joinedAt: "2026-10-02T10:00:00.000Z" },
  ],
};

let container: HTMLDivElement;
let root: Root;

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function renderForm(): void {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(<HomeworkAssignmentForm classId={classId} />);
  });
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll("button")).find((element) => element.textContent.includes(label));
  if (!match) throw new Error(`Expected button: ${label}`);
  return match;
}

function checkbox(index: number): HTMLInputElement {
  const match = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(
    (_, checkboxIndex) => checkboxIndex === index,
  );
  if (!match) throw new Error(`Expected checkbox ${index}`);
  return match;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): unknown {
  const requestInit: unknown = fetchMock.mock.calls[callIndex]?.[1];
  if (!requestInit || typeof requestInit !== "object" || !("body" in requestInit)) {
    throw new Error(`Expected request body for fetch call ${callIndex}`);
  }
  if (typeof requestInit.body !== "string") throw new Error("Expected JSON request body");
  return JSON.parse(requestInit.body) as unknown;
}

async function loadRoster(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function confirmAssignment(): Promise<void> {
  act(() => {
    button("Sprawdź przydzielenie").click();
  });
  await act(async () => {
    button("Potwierdź przydzielenie").click();
    await Promise.resolve();
  });
}

function selectOption(triggerId: string, optionLabel: string): void {
  const trigger = container.querySelector<HTMLButtonElement>(`#${triggerId}`);
  if (!trigger) throw new Error(`Expected select ${triggerId}`);
  act(() => {
    trigger.click();
  });
  const option = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')).find(
    (element) => element.textContent === optionLabel,
  );
  if (!option) throw new Error(`Expected option: ${optionLabel}`);
  act(() => {
    option.click();
  });
}

function assignmentSuccess(overrides: Record<string, unknown> = {}) {
  return {
    assignmentId: "00000000-0000-4000-8000-000000000010",
    title: "Powtórka",
    createdAt: "2026-10-08T12:00:00.000Z",
    assignedCount: 2,
    excludedStudentIds: [],
    excludedCount: 0,
    replayed: false,
    ...overrides,
  };
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

describe("HomeworkAssignmentForm", () => {
  it("loads the owner roster once and initially selects every member", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(roster));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestOptions] = fetchMock.mock.calls[0] ?? [];
    expect(requestUrl).toBe(`/api/classes/${classId}/members`);
    expect(requestOptions?.signal).toBeInstanceOf(AbortSignal);
    expect(requestOptions?.signal?.aborted).toBe(false);
    expect(checkbox(0).checked).toBe(true);
    expect(checkbox(1).checked).toBe(true);
  });

  it("supports individual and bulk recipient selection and disables review for an empty selection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(roster)));
    renderForm();
    await loadRoster();

    act(() => {
      checkbox(0).click();
    });
    expect(checkbox(0).checked).toBe(false);
    expect(checkbox(1).checked).toBe(true);
    act(() => {
      button("Wyczyść wybór").click();
    });
    expect(checkbox(1).checked).toBe(false);
    expect(button("Sprawdź przydzielenie").disabled).toBe(true);
    act(() => {
      button("Zaznacz wszystkich").click();
    });
    expect(checkbox(0).checked).toBe(true);
    expect(checkbox(1).checked).toBe(true);
  });

  it("renders an empty-roster state without assignment controls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ members: [] })));
    renderForm();
    await loadRoster();

    expect(container.textContent).toContain("W tej klasie nie ma jeszcze uczniów");
    expect(container.querySelector("form")).toBeNull();
  });

  it("offers only counts one through five", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(roster)));
    renderForm();
    await loadRoster();

    const trigger = container.querySelector<HTMLButtonElement>("#homework-exercise-count");
    if (!trigger) throw new Error("Expected exercise count select");
    act(() => {
      trigger.click();
    });
    const options = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="select-item"]'));
    expect(options.map((option) => option.textContent)).toEqual(["1", "2", "3", "4", "5"]);
    act(() => {
      options[4]?.click();
    });
    expect(container.querySelector("#homework-exercise-count")?.textContent).toContain("5");
    act(() => {
      button("Sprawdź przydzielenie").click();
    });
    expect(container.textContent).toContain("Liczba zadań na ucznia");
    expect(container.textContent).toContain("5");
  });

  it("offers only the three supported arithmetic topics for new assignments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(roster)));
    renderForm();
    await loadRoster();

    const topicTrigger = container.querySelector<HTMLButtonElement>("#homework-topic");
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
  });

  it("trims an optional title and sends the chosen topic, difficulty, and count after review", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(jsonResponse(assignmentSuccess()));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();

    const titleInput = container.querySelector<HTMLInputElement>("#homework-title");
    if (!titleInput) throw new Error("Expected title input");
    act(() => {
      setInputValue(titleInput, "  Powtórka  ");
    });
    selectOption("homework-topic", "Mnożenie i dzielenie liczb naturalnych");
    selectOption("homework-difficulty", "Trudny");
    selectOption("homework-exercise-count", "3");

    act(() => {
      button("Sprawdź przydzielenie").click();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Powtórka");
    expect(container.textContent).toContain("Mnożenie i dzielenie liczb naturalnych · Trudny");
    expect(container.textContent).toContain("bartek@example.test");

    await act(async () => {
      button("Potwierdź przydzielenie").click();
      await Promise.resolve();
    });
    expect(homeworkAssignmentRequestSchema.parse(requestBody(fetchMock, 1))).toMatchObject({
      classId,
      studentIds: [firstStudentId, secondStudentId],
      title: "Powtórka",
      topic: "multiplication-division",
      difficulty: "hard",
      exerciseCount: 3,
    });
  }, 15_000);

  it("keeps an empty or whitespace-only title optional", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(jsonResponse(assignmentSuccess()));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();

    const titleInput = container.querySelector<HTMLInputElement>("#homework-title");
    if (!titleInput) throw new Error("Expected title input");
    expect(titleInput.maxLength).toBe(120);
    act(() => {
      setInputValue(titleInput, "   ");
    });
    await confirmAssignment();

    expect(homeworkAssignmentRequestSchema.parse(requestBody(fetchMock, 1))).not.toHaveProperty("title");
  });

  it("truncates a title to 120 characters before submission", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(jsonResponse(assignmentSuccess()));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();

    const titleInput = container.querySelector<HTMLInputElement>("#homework-title");
    if (!titleInput) throw new Error("Expected title input");
    act(() => {
      setInputValue(titleInput, "x".repeat(121));
    });
    await confirmAssignment();

    expect(homeworkAssignmentRequestSchema.parse(requestBody(fetchMock, 1)).title).toHaveLength(120);
  });

  it("locks a confirmed request while it is active", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(roster)).mockReturnValue(pendingResponse);
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();
    act(() => {
      button("Sprawdź przydzielenie").click();
    });

    act(() => {
      button("Potwierdź przydzielenie").click();
      button("Potwierdź przydzielenie").click();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveResponse(jsonResponse(assignmentSuccess()));
      await pendingResponse;
    });
  });

  it("reuses the idempotency key when retrying a transport failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockRejectedValueOnce(new TypeError("network offline"))
      .mockResolvedValueOnce(jsonResponse(assignmentSuccess()));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();
    await confirmAssignment();
    const firstRequest = homeworkAssignmentRequestSchema.parse(requestBody(fetchMock, 1));

    await act(async () => {
      button("Spróbuj ponownie").click();
      await Promise.resolve();
    });
    const retryRequest = homeworkAssignmentRequestSchema.parse(requestBody(fetchMock, 2));

    expect(retryRequest.idempotencyKey).toBe(firstRequest.idempotencyKey);
    expect(container.textContent).toContain("Przydzielanie zakończone");
  });

  it("creates a fresh idempotency key when inputs change after a settled failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "PERSISTENCE_FAILURE", message: "Błąd zapisu." } }, false))
      .mockResolvedValueOnce(jsonResponse(assignmentSuccess()));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();
    await confirmAssignment();
    const firstKey = homeworkAssignmentRequestSchema.parse(requestBody(fetchMock, 1)).idempotencyKey;

    act(() => {
      button("Zmień dane").click();
    });
    const titleInput = container.querySelector<HTMLInputElement>("#homework-title");
    if (!titleInput) throw new Error("Expected title input");
    act(() => {
      setInputValue(titleInput, "Nowy zestaw");
    });
    await confirmAssignment();

    const nextRequest = homeworkAssignmentRequestSchema.parse(requestBody(fetchMock, 2));
    expect(nextRequest.idempotencyKey).not.toBe(firstKey);
    expect(nextRequest.title).toBe("Nowy zestaw");
  });

  it("shows capacity details without changing the requested count", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "INSUFFICIENT_POOL",
              message: "Zatwierdzona pula jest zbyt mała.",
              requiredExerciseCount: 4,
              availableExerciseCount: 3,
            },
          },
          false,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();
    selectOption("homework-exercise-count", "2");
    await confirmAssignment();

    expect(container.textContent).toContain("Wybrano 2 zadania dla 2 uczniów");
    expect(container.textContent).toContain("co najmniej 4 różnych zatwierdzonych zadań; dostępne: 3");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    act(() => {
      button("Zmień parametry").click();
    });
    expect(container.querySelector("#homework-exercise-count")?.textContent).toContain("2");
  });

  it("reports successful assigned counts without exposing internal identifiers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(jsonResponse(assignmentSuccess()));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();
    await confirmAssignment();

    expect(container.textContent).toContain("Przydzielono: 2");
    expect(container.textContent).toContain("Wyłączono: 0");
    expect(container.textContent).not.toContain(firstStudentId);
    expect(container.textContent).not.toContain("idempotencyKey");
  });

  it("identifies excluded selections by their loaded roster email without changing selection", async () => {
    const departedRoster: HomeworkRosterSuccess = {
      members: [
        { studentId: firstStudentId, email: "ania@example.test", joinedAt: "2026-10-01T10:00:00.000Z" },
        { studentId: departedStudentId, email: "ola@example.test", joinedAt: "2026-10-03T10:00:00.000Z" },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(departedRoster))
      .mockResolvedValueOnce(
        jsonResponse(
          assignmentSuccess({
            assignedCount: 1,
            excludedStudentIds: [departedStudentId],
            excludedCount: 1,
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();
    await confirmAssignment();

    expect(container.textContent).toContain("Przydzielono: 1");
    expect(container.textContent).toContain("Wyłączono: 1");
    expect(container.textContent).toContain("Uczniowie, którzy opuścili klasę");
    expect(container.textContent).toContain("ola@example.test");
    expect(container.textContent).not.toContain(departedStudentId);
    expect(container.querySelector("form")).toBeNull();
  });

  it("reports an all-excluded race and offers a fresh roster instead of showing success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: "EMPTY_ELIGIBLE_ROSTER", message: "Wybrani uczniowie nie należą już do klasy." } },
          false,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();
    await confirmAssignment();

    expect(container.textContent).toContain("Skład klasy zmienił się od pobrania listy");
    expect(
      container.querySelector('a[href="/classes/00000000-0000-4000-8000-000000000001/assign"]')?.textContent,
    ).toContain("Pobierz aktualny skład klasy");
    expect(container.textContent).not.toContain("Przydzielanie zakończone");
  });

  it("uses privacy-safe fallback copy for malformed failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "SECRET", message: `private ${firstStudentId} assignment token` } }, false),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();
    await confirmAssignment();

    expect(container.textContent).toContain("Nie udało się odczytać odpowiedzi przydzielania.");
    expect(container.textContent).not.toContain(firstStudentId);
    expect(container.textContent).not.toContain("assignment token");
  });

  it("renders authorization failures as a separate state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "FORBIDDEN", message: "Tylko nauczyciel może przydzielać zadania." } }, false),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();
    await confirmAssignment();

    expect(container.textContent).toContain("Brak dostępu do przydzielania");
    expect(container.querySelector('a[href="/classes"]')?.textContent).toContain("Wróć do klas");
  });

  it("keeps native checkbox controls keyboard-focusable and moves focus to result feedback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(roster))
      .mockResolvedValueOnce(jsonResponse(assignmentSuccess()));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await loadRoster();

    checkbox(0).focus();
    expect(document.activeElement).toBe(checkbox(0));
    expect(checkbox(0).tabIndex).toBe(0);
    await confirmAssignment();

    expect(document.activeElement?.textContent).toBe("Przydzielanie zakończone");
  });
});
