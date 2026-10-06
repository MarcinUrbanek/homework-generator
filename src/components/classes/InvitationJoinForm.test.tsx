// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InvitationJoinForm from "./InvitationJoinForm";

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function renderForm(navigate?: (destination: string) => void): HTMLDivElement {
  const formContainer = document.createElement("div");
  document.body.append(formContainer);
  const formRoot = createRoot(formContainer);
  container = formContainer;
  root = formRoot;
  act(() => {
    formRoot.render(
      <InvitationJoinForm
        token={"a".repeat(64)}
        preview={{ name: "4A", teacherDisplayName: "Pani Nowak", alreadyMember: false }}
        navigate={navigate}
      />,
    );
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

describe("InvitationJoinForm", () => {
  it("shows a safe preview and waits for explicit confirmation", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const formContainer = renderForm();

    expect(formContainer.textContent).toContain("4A");
    expect(formContainer.textContent).toContain("Pani Nowak");
    expect(formContainer.querySelector('button[type="submit"]')?.textContent).toContain("Dołącz");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("confirms the invitation and offers the joined-classes destination", async () => {
    const navigate = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ redirectTo: "/classes/joined", alreadyMember: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const formContainer = renderForm(navigate);
    const form = formContainer.querySelector("form");
    if (!form) throw new Error("Expected invitation confirmation form");

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/classes/accept-invitation",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "a".repeat(64) }),
      }),
    );
    expect(navigate).toHaveBeenCalledWith("/classes/joined");
    expect(formContainer.querySelector('a[href="/classes/joined"]')).not.toBeNull();
  });
});
