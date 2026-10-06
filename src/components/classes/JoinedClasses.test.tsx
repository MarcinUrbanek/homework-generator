// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import JoinedClasses from "./JoinedClasses";

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function renderList(): HTMLDivElement {
  const listContainer = document.createElement("div");
  document.body.append(listContainer);
  const listRoot = createRoot(listContainer);
  container = listContainer;
  root = listRoot;
  act(() => {
    listRoot.render(<JoinedClasses />);
  });
  return listContainer;
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

describe("JoinedClasses", () => {
  it("shows each joined class, optional teacher name, and joined date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          classes: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              name: "4A",
              teacherDisplayName: "Pani Nowak",
              joinedAt: "2026-10-06T09:00:00.000Z",
            },
            {
              id: "00000000-0000-4000-8000-000000000002",
              name: "4B",
              teacherDisplayName: null,
              joinedAt: "2026-10-05T09:00:00.000Z",
            },
          ],
        }),
      }),
    );
    const listContainer = renderList();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listContainer.textContent).toContain("4A");
    expect(listContainer.textContent).toContain("Pani Nowak");
    expect(listContainer.textContent).toContain("4B");
    expect(listContainer.querySelector('time[datetime="2026-10-06T09:00:00.000Z"]')).not.toBeNull();
    expect(listContainer.querySelector('a[href="/classes/join-code"]')).not.toBeNull();
  });

  it("shows an empty state and an accessible path to join a class", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ classes: [] }) }));
    const listContainer = renderList();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listContainer.textContent).toContain("Nie należysz jeszcze do żadnej klasy");
    expect(listContainer.querySelector('a[href="/classes/join-code"]')?.textContent).toContain("Dołącz do klasy");
  });
});
