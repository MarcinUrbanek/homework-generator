// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TeacherDisplayNameForm from "./TeacherDisplayNameForm";

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderForm(displayName: string | null): HTMLDivElement {
  const formContainer = document.createElement("div");
  document.body.append(formContainer);
  const formRoot = createRoot(formContainer);
  container = formContainer;
  root = formRoot;
  act(() => {
    formRoot.render(<TeacherDisplayNameForm displayName={displayName} />);
  });
  return formContainer;
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

describe("TeacherDisplayNameForm", () => {
  it("prompts an unnamed teacher and saves the name shown to students", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ displayName: "Pani Nowak" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const formContainer = renderForm(null);
    const input = formContainer.querySelector("input");
    const form = formContainer.querySelector("form");
    if (!(input instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) {
      throw new Error("Expected teacher display-name form");
    }

    expect(formContainer.textContent).toContain("widoczna dla uczniów");
    await act(async () => {
      setInputValue(input, "Pani Nowak");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile/display-name",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ displayName: "Pani Nowak" }) }),
    );
    expect(formContainer.textContent).toContain("Zapisano");
  });

  it("loads the existing name and allows the teacher to revise it", () => {
    const formContainer = renderForm("Pani Nowak");
    const input = formContainer.querySelector("input");

    expect(input instanceof HTMLInputElement ? input.value : null).toBe("Pani Nowak");
    expect(formContainer.textContent).toContain("Zmień nazwę");
  });
});
