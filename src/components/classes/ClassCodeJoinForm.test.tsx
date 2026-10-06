// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ClassCodeJoinForm from "./ClassCodeJoinForm";

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderForm(navigate?: (destination: string) => void): HTMLDivElement {
  const formContainer = document.createElement("div");
  document.body.append(formContainer);
  const formRoot = createRoot(formContainer);
  container = formContainer;
  root = formRoot;
  act(() => {
    formRoot.render(<ClassCodeJoinForm navigate={navigate} />);
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

describe("ClassCodeJoinForm", () => {
  it("normalizes the code for preview without joining", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        class: { name: "4A", teacherDisplayName: null, alreadyMember: false },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const formContainer = renderForm();
    const input = formContainer.querySelector("input");
    const form = formContainer.querySelector("form");
    if (!(input instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) {
      throw new Error("Expected class-code entry form");
    }

    await act(async () => {
      setInputValue(input, " ab12cd34 ");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/classes/preview-code",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ classCode: "AB12CD34" }) }),
    );
    expect(formContainer.textContent).toContain("4A");
    expect(formContainer.textContent).toContain("Dołącz");
  });

  it("joins only after confirmation and navigates to joined classes", async () => {
    const navigate = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          class: { name: "4A", teacherDisplayName: "Pani Nowak", alreadyMember: false },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ redirectTo: "/classes/joined", alreadyMember: false }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const formContainer = renderForm(navigate);
    const input = formContainer.querySelector("input");
    const form = formContainer.querySelector("form");
    if (!(input instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) {
      throw new Error("Expected class-code entry form");
    }

    await act(async () => {
      setInputValue(input, "ab12cd34");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(formContainer.textContent).toContain("Pani Nowak");

    const confirmButton = Array.from(formContainer.querySelectorAll("button")).find((button) =>
      button.textContent.includes("Dołącz"),
    );
    if (!confirmButton) throw new Error("Expected explicit confirmation button");
    await act(async () => {
      confirmButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/classes/join-by-code",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ classCode: "AB12CD34" }) }),
    );
    expect(navigate).toHaveBeenCalledWith("/classes/joined");
  });
});
