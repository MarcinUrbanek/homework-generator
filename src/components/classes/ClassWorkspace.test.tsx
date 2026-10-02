// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ClassWorkspace from "./ClassWorkspace";

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function renderWorkspace(): void {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(<ClassWorkspace />);
  });
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
      root.unmount();
    });
  }
  if (container !== undefined) container.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("ClassWorkspace", () => {
  it("lists classes and their generated codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          classes: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              name: "4A",
              classCode: "AB12CD34",
              createdAt: "2026-10-02T10:00:00.000Z",
            },
          ],
        }),
      }),
    );
    renderWorkspace();
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("4A");
    expect(container.textContent).toContain("Kod: AB12CD34");
  });

  it("adds a newly created class to the workspace", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ classes: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          class: {
            id: "00000000-0000-4000-8000-000000000002",
            name: "4B",
            classCode: "EF56GH78",
            createdAt: "2026-10-02T10:00:00.000Z",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    await act(async () => {
      await Promise.resolve();
    });
    const input = getElement("#class-name", HTMLInputElement);
    const form = getElement("form", HTMLFormElement);
    act(() => {
      setInputValue(input, "4B");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("4B");
    expect(container.textContent).toContain("Kod: EF56GH78");
  });
});
