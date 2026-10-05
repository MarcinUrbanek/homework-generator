// @ts-nocheck
// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InviteStudentsForm, { parseInvitationEmails } from "./InviteStudentsForm";

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderForm(): HTMLDivElement {
  const formContainer = document.createElement("div");
  document.body.append(formContainer);
  const formRoot = createRoot(formContainer);
  container = formContainer;
  root = formRoot;
  act(() => {
    formRoot.render(<InviteStudentsForm classId="00000000-0000-4000-8000-000000000001" />);
  });
  return formContainer;
}

function getElement<T extends Element>(selector: string, type: new () => T): T {
  const element = container?.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Expected ${selector}`);
  return element;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  if (root !== undefined) {
    act(() => {
      root?.unmount();
    });
  }
  if (container !== undefined) container.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("InviteStudentsForm", () => {
  it("normalizes comma and newline separated addresses and removes duplicates", () => {
    expect(parseInvitationEmails(" One@Example.test, two@example.test\nONE@example.test ")).toEqual([
      "one@example.test",
      "two@example.test",
    ]);
  });

  it("locks duplicate submissions and renders independent delivery results", async () => {
    let resolveResponse: (response: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn(() => pendingResponse);
    vi.stubGlobal("fetch", fetchMock);
    const formContainer = renderForm();
    const textarea = getElement("textarea", HTMLTextAreaElement);
    act(() => {
      setTextareaValue(textarea, "one@example.test, two@example.test");
    });
    const form = getElement("form", HTMLFormElement);
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveResponse({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [
            { email: "one@example.test", status: "sent" },
            { email: "two@example.test", status: "failed" },
          ],
        }),
      } as unknown as Response);
      await pendingResponse;
    });
    expect(formContainer.textContent).toContain("Wysłano");
    expect(formContainer.textContent).toContain("Nie wysłano");
  });

  it("rejects previews above the fifty recipient limit", () => {
    const formContainer = renderForm();
    const textarea = getElement("textarea", HTMLTextAreaElement);
    act(() => {
      setTextareaValue(textarea, Array.from({ length: 51 }, (_, index) => `student${index}@example.test`).join(","));
    });
    expect(formContainer.textContent).toContain("51/50");
    expect(getElement("button", HTMLButtonElement).disabled).toBe(true);
  });
});
