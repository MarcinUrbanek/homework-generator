// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomeworkFeedbackForm from "@/components/homework/HomeworkFeedbackForm";
import type { HomeworkFeedback } from "@/types";

const assignmentId = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";
const endpoint = `/api/homework/${assignmentId}/students/${studentId}/feedback`;
const existing: HomeworkFeedback = { body: "Dobra praca.\nPopraw zadanie 2.", updatedAt: "2026-10-23T08:00:00.000Z" };

let container: HTMLDivElement;
let root: Root;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function render(initialFeedback: HomeworkFeedback | null): void {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <HomeworkFeedbackForm assignmentId={assignmentId} studentId={studentId} initialFeedback={initialFeedback} />,
    );
  });
}

function textarea(): HTMLTextAreaElement {
  const element = container.querySelector("textarea");
  if (!element) throw new Error("Expected textarea");
  return element;
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll("button")).find((element) => element.textContent.includes(label));
  if (!match) throw new Error(`Expected button: ${label}`);
  return match;
}

function setValue(value: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea(), value);
    textarea().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

async function clickAndFlush(label: string): Promise<void> {
  act(() => {
    button(label).click();
  });
  await flush();
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): unknown {
  const options = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  if (typeof options?.body !== "string") throw new Error("Expected JSON body");
  return JSON.parse(options.body) as unknown;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe("HomeworkFeedbackForm", () => {
  it("shows the existing comment, its count and last update", () => {
    render(existing);

    expect(textarea().value).toBe(existing.body);
    expect(container.textContent).toContain(`${String(existing.body.length)}/2000 znaków`);
    expect(container.textContent).toContain("Ostatnia zmiana");
    expect(button("Usuń komentarz")).toBeTruthy();
  });

  it("counts characters live and blocks saving above the limit", () => {
    render(null);
    setValue("a".repeat(2001));

    expect(container.textContent).toContain("2001/2000 znaków");
    expect(button("Zapisz komentarz").disabled).toBe(true);
    expect(textarea().getAttribute("aria-invalid")).toBe("true");
  });

  it("does not send an empty comment and offers no clear action without saved feedback", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(null);
    setValue("   ");

    await clickAndFlush("Zapisz komentarz");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Wpisz komentarz przed zapisaniem.");
    expect(container.textContent).not.toContain("Usuń komentarz");
  });

  it("saves a comment with PUT and shows the confirmation", async () => {
    const saved = { body: "Świetnie!", updatedAt: "2026-10-24T09:00:00.000Z" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ feedback: saved }));
    vi.stubGlobal("fetch", fetchMock);
    render(null);
    setValue("Świetnie!");

    await clickAndFlush("Zapisz komentarz");

    expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.objectContaining({ method: "PUT" }));
    expect(requestBody(fetchMock)).toEqual({ feedback: "Świetnie!" });
    expect(container.textContent).toContain("Komentarz zapisany.");
    expect(container.textContent).toContain("Usuń komentarz");
  });

  it("clears an existing comment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ feedback: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(existing);

    await clickAndFlush("Usuń komentarz");

    expect(requestBody(fetchMock)).toEqual({ feedback: "" });
    expect(textarea().value).toBe("");
    expect(container.textContent).toContain("Komentarz usunięty.");
    expect(container.textContent).not.toContain("Usuń komentarz");
  });

  it("locks the form when feedback is no longer allowed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { code: "FEEDBACK_NOT_ALLOWED", message: "x" } }, 409));
    vi.stubGlobal("fetch", fetchMock);
    render(existing);

    await clickAndFlush("Zapisz komentarz");

    expect(container.textContent).toContain("Nie można już dodać komentarza");
    expect(textarea().disabled).toBe(true);
    expect(button("Zapisz komentarz").disabled).toBe(true);
  });

  it("keeps the text and allows a retry after a network error", async () => {
    const saved = { body: "Popraw 2", updatedAt: "2026-10-24T09:00:00.000Z" };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(jsonResponse({ feedback: saved }));
    vi.stubGlobal("fetch", fetchMock);
    render(null);
    setValue("Popraw 2");

    await clickAndFlush("Zapisz komentarz");
    expect(container.textContent).toContain("Nie udało się połączyć z usługą");
    expect(textarea().value).toBe("Popraw 2");

    await clickAndFlush("Zapisz komentarz");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Komentarz zapisany.");
  });

  it("shows a validation message for a rejected request and a retryable error for server failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "INVALID_REQUEST", message: "x" } }, 400))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "DATABASE_UNAVAILABLE", message: "x" } }, 503));
    vi.stubGlobal("fetch", fetchMock);
    render(null);
    setValue("Komentarz");

    await clickAndFlush("Zapisz komentarz");
    expect(container.textContent).toContain("Komentarz jest nieprawidłowy");

    await clickAndFlush("Zapisz komentarz");
    expect(container.textContent).toContain("Nie udało się zapisać komentarza. Spróbuj ponownie.");
    expect(button("Zapisz komentarz").disabled).toBe(false);
  });
});
