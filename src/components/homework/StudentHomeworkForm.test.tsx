// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StudentHomeworkForm from "@/components/homework/StudentHomeworkForm";
import type {
  StudentHomeworkDetailSuccess,
  StudentHomeworkSubmissionResult,
  StudentHomeworkSubmitSuccess,
} from "@/types";

const assignment = {
  assignmentId: "00000000-0000-4000-8000-000000000001",
  className: "Matematyka 4A",
  title: "Powtórka",
  createdAt: "2026-10-09T10:00:00.000Z",
  exerciseCount: 3,
};
const exercises = [
  { position: 1, prompt: "Ile to 1 + 1?" },
  { position: 2, prompt: "Ile to 2 + 2?" },
  { position: 3, prompt: "Ile to 3 + 3?" },
];
const persistedResult: StudentHomeworkSubmissionResult = {
  submissionId: "00000000-0000-4000-8000-000000000002",
  submittedAt: "2026-10-09T12:00:00.000Z",
  correctCount: 2,
  assignedCount: 3,
  passed: true,
  answers: [
    { position: 1, answer: "2", isCorrect: true },
    { position: 2, answer: "4", isCorrect: true },
    { position: 3, answer: null, isCorrect: false },
  ],
};

let container: HTMLDivElement;
let root: Root;
let rootMounted = false;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function detailResponse(submission: StudentHomeworkSubmissionResult | null): StudentHomeworkDetailSuccess {
  return { kind: "prompts", assignment, exercises, submission };
}

function resultOnlyDetail(): StudentHomeworkDetailSuccess {
  return {
    kind: "result-only",
    assignment,
    result: persistedResult,
  };
}

function submitResponse(overrides: Partial<StudentHomeworkSubmissionResult> = {}): StudentHomeworkSubmitSuccess {
  return {
    ...persistedResult,
    ...overrides,
    kind: "scored",
    replayed: false,
  };
}

function renderForm(submission: StudentHomeworkSubmissionResult | null = null): void {
  renderDetail(detailResponse(submission));
}

function renderDetail(detail: StudentHomeworkDetailSuccess): void {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rootMounted = true;
  act(() => {
    root.render(<StudentHomeworkForm detail={detail} />);
  });
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll("button")).find((element) => element.textContent.includes(label));
  if (!match) throw new Error(`Expected button: ${label}`);
  return match;
}

function answerInput(position: number): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`#homework-answer-${position}`);
  if (!input) throw new Error(`Expected answer input ${position}`);
  return input;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): unknown {
  const requestOptions = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  if (typeof requestOptions?.body !== "string") throw new Error(`Expected JSON body at call ${callIndex}`);
  return JSON.parse(requestOptions.body) as unknown;
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

async function openReview(): Promise<void> {
  act(() => {
    button("Sprawdź odpowiedzi").click();
  });
  await flushPromises();
}

async function confirmAnswers(): Promise<void> {
  act(() => {
    button("Wyślij ostateczne odpowiedzi").click();
  });
  await flushPromises();
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  if (rootMounted) {
    act(() => {
      root.unmount();
    });
    rootMounted = false;
  }
  container.remove();
  vi.unstubAllGlobals();
});

describe("StudentHomeworkForm", () => {
  it("confirms all-blank answers as final and submits every position as blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        submitResponse({
          correctCount: 0,
          passed: false,
          answers: exercises.map(({ position }) => ({ position, answer: null, isCorrect: false })),
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    await openReview();
    expect(container.textContent).toContain("Bez odpowiedzi: 3 z 3");
    expect(container.textContent).toContain("Po wysłaniu nie można zmienić odpowiedzi");
    expect(container.textContent).toContain("Puste odpowiedzi zostaną uznane za niepoprawne");
    expect(document.activeElement?.textContent).toBe("Sprawdź odpowiedzi");

    await confirmAnswers();

    expect(requestBody(fetchMock, 0)).toEqual({
      answers: [
        { position: 1, answer: null },
        { position: 2, answer: null },
        { position: 3, answer: null },
      ],
    });
    expect(container.textContent).toContain("Nie zaliczone");
    expect(container.textContent).toContain("0 z 3");
    expect(container.textContent).toContain("Brak odpowiedzi — niepoprawna");
    expect(container.querySelector("input")).toBeNull();
    expect(document.activeElement?.textContent).toBe("Wynik zadania domowego");
  });

  it.each(["cztery", "1.5", "-1", "1,000", "1 00", "+1"])(
    "rejects non-natural or malformed numeric input %s without losing the entered value",
    (value) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      renderForm();

      act(() => {
        setInputValue(answerInput(1), value);
      });
      act(() => {
        button("Sprawdź odpowiedzi").click();
      });

      expect(container.textContent).toContain("Wpisz liczbę naturalną cyframi lub pozostaw pole puste.");
      expect(answerInput(1).value).toBe(value);
      expect(answerInput(1).getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement?.textContent).toBe("Popraw zaznaczone odpowiedzi");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("accepts grouped and very large digit strings without numeric conversion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(submitResponse()));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    act(() => {
      setInputValue(answerInput(1), "1 000");
      setInputValue(answerInput(2), "90071992547409931234567890");
      setInputValue(answerInput(3), "0");
    });
    await openReview();
    await confirmAnswers();

    expect(requestBody(fetchMock, 0)).toEqual({
      answers: [
        { position: 1, answer: "1 000" },
        { position: 2, answer: "90071992547409931234567890" },
        { position: 3, answer: "0" },
      ],
    });
    expect(container.textContent).toContain("Zaliczone");
    expect(container.querySelector("input")).toBeNull();
  });

  it("retries a lost response with the identical answer vector and keeps values on the page", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network offline"))
      .mockResolvedValueOnce(
        jsonResponse(
          submitResponse({
            correctCount: 1,
            passed: false,
            answers: [
              { position: 1, answer: "0007", isCorrect: true },
              { position: 2, answer: null, isCorrect: false },
              { position: 3, answer: null, isCorrect: false },
            ],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    act(() => {
      setInputValue(answerInput(1), "0007");
    });
    await openReview();
    await confirmAnswers();

    expect(container.textContent).toContain("Możesz ponowić próbę z tymi samymi odpowiedziami.");
    expect(answerInput(1).value).toBe("0007");
    expect(answerInput(1).readOnly).toBe(true);

    await act(async () => {
      button("Spróbuj ponownie").click();
      await Promise.resolve();
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchMock, 1)).toEqual(requestBody(fetchMock, 0));
    expect(container.textContent).toContain("Nie zaliczone");
  });

  it("loads the immutable persisted result after a finalization conflict", async () => {
    const savedResult: StudentHomeworkSubmissionResult = {
      ...persistedResult,
      answers: [
        { position: 1, answer: "2", isCorrect: true },
        { position: 2, answer: "8", isCorrect: false },
        { position: 3, answer: null, isCorrect: false },
      ],
      correctCount: 1,
      passed: false,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "SUBMISSION_CONFLICT", message: "private canonical answer" } }, 409),
      )
      .mockResolvedValueOnce(jsonResponse(detailResponse(savedResult)));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    act(() => {
      setInputValue(answerInput(1), "999");
    });
    await openReview();
    await confirmAnswers();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/homework/${assignment.assignmentId}`);
    expect(container.textContent).toContain("Nie zaliczone");
    expect(container.textContent).toContain("Twoja odpowiedź: 8");
    expect(container.textContent).not.toContain("999");
    expect(container.textContent).not.toContain("private canonical answer");
    expect(container.querySelector("input")).toBeNull();
  });

  it("renders a result-only SSR detail without prompts or an editable form", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderDetail(resultOnlyDetail());

    expect(container.textContent).toContain("Wynik zadania domowego");
    expect(container.textContent).toContain("Poprawne odpowiedzi: 2 z 3");
    expect(container.textContent).toContain("Pozycja 1");
    expect(container.textContent).toContain("Twoja odpowiedź: 2");
    expect(container.textContent).not.toContain("Ile to");
    expect(container.textContent).not.toContain("Odpowiedź do zadania");
    expect(container.querySelector("input")).toBeNull();
  });

  it("recovers a prompt-free historical result after a submission retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "SUBMISSION_CONFLICT", message: "private answer" } }, 409))
      .mockResolvedValueOnce(jsonResponse(resultOnlyDetail()));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await openReview();
    await confirmAnswers();

    expect(container.textContent).toContain("Wynik zadania domowego");
    expect(container.textContent).toContain("Pozycja 1");
    expect(container.textContent).not.toContain("Ile to");
    expect(container.querySelector("input")).toBeNull();
  });

  it("clears old prompts when recovery or a recovery retry is denied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "SUBMISSION_CONFLICT", message: "private answer" } }, 409))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "DATABASE_UNAVAILABLE", message: "unavailable" } }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "HOMEWORK_UNAVAILABLE", message: "unavailable" } }, 404));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await openReview();
    await confirmAnswers();

    expect(container.textContent).toContain("Nie udało się pobrać zapisanego wyniku");
    expect(container.textContent).toContain("Ile to 1 + 1?");
    await act(async () => {
      button("Pobierz zapisany wynik").click();
      await Promise.resolve();
    });
    await flushPromises();

    expect(container.textContent).toContain("Zadanie domowe jest niedostępne");
    expect(container.textContent).toContain("skontaktuj się z nauczycielem");
    expect(container.textContent).not.toContain("Ile to");
    expect(container.textContent).not.toContain("Poprawne odpowiedzi:");
    expect(container.querySelector("input")).toBeNull();
  });

  it("removes entered answers when access is denied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: "HOMEWORK_UNAVAILABLE", message: "Zadanie niedostępne." } }, 404),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    act(() => {
      setInputValue(answerInput(1), "123");
    });
    await openReview();
    await confirmAnswers();

    expect(container.textContent).toContain("Zadanie domowe jest niedostępne");
    expect(container.textContent).not.toContain("123");
    expect(container.querySelector("input")).toBeNull();
  });

  it("renders persisted results read-only after reload and rechecks current membership", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(detailResponse(persistedResult)));
    vi.stubGlobal("fetch", fetchMock);
    renderForm(persistedResult);
    await flushPromises();

    const requestCall = fetchMock.mock.calls.at(0);
    if (!requestCall) throw new Error("Expected a persisted-result request");
    expect(requestCall[0]).toBe(`/api/homework/${assignment.assignmentId}`);
    expect(requestCall[1]?.cache).toBe("no-store");
    expect(requestCall[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(container.textContent).toContain("Zaliczone");
    expect(container.textContent).toContain("2 z 3");
    expect(container.textContent).toContain("Twoja odpowiedź: 4");
    expect(container.textContent).toContain("Brak odpowiedzi — niepoprawna");
    expect(container.querySelector("input")).toBeNull();
    expect(document.activeElement?.textContent).toBe("Wynik zadania domowego");
  });

  it("removes a previously rendered persisted result when membership revalidation is denied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: "HOMEWORK_UNAVAILABLE", message: "Zadanie niedostępne." } }, 404),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderForm(persistedResult);
    await flushPromises();

    expect(container.textContent).toContain("Zadanie domowe jest niedostępne");
    expect(container.textContent).not.toContain("Wynik zadania domowego");
    expect(container.textContent).not.toContain("Twoja odpowiedź: 2");
    expect(container.querySelector("input")).toBeNull();
  });

  it("keeps unfinished answers only in page state", () => {
    const localWrite = vi.spyOn(window.localStorage, "setItem");
    const sessionWrite = vi.spyOn(window.sessionStorage, "setItem");
    vi.stubGlobal("fetch", vi.fn());
    renderForm();

    act(() => {
      setInputValue(answerInput(1), "123");
    });
    expect(answerInput(1).value).toBe("123");
    expect(localWrite).not.toHaveBeenCalled();
    expect(sessionWrite).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    rootMounted = false;
    container.remove();
    renderForm();
    expect(answerInput(1).value).toBe("");
  });

  it("aborts an in-flight submission when the form unmounts", async () => {
    const requestSignals: AbortSignal[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) {
        requestSignals.push(init.signal);
      }
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await openReview();
    act(() => {
      button("Wyślij ostateczne odpowiedzi").click();
    });

    const submittedSignal = requestSignals.at(0);
    expect(submittedSignal).toBeInstanceOf(AbortSignal);
    if (submittedSignal === undefined) {
      throw new Error("Expected submission to provide an abort signal");
    }
    expect(submittedSignal.aborted).toBe(false);
    act(() => {
      root.unmount();
    });
    rootMounted = false;
    expect(submittedSignal.aborted).toBe(true);
  });
});
