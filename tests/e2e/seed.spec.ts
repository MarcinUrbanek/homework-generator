// Seed E2E test — the pattern every generated test copies.
// Risk: auth-gate-roundtrip — a signed-out visitor to a protected page is sent to sign-in
// and, after signing in through the real UI, lands back on the page (path + query) they asked for.
// Covers the minimal full-flow signal of test-plan.md §3 Phase 4 (critical-flow quality gates).
import { test, expect } from "@playwright/test";

// This risk is the signed-out path, so start without the saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test("signed-out visitor to a protected page signs in and returns to that page", async ({ page }) => {
  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;
  if (!username || !password) {
    throw new Error("Set E2E_USERNAME and E2E_PASSWORD (see context/foundation/test-stack.md, ## E2E)");
  }
  const protectedPath = `/classes?view=seed-${Date.now()}`;

  await page.goto(protectedPath);

  await page.waitForURL(
    (url) => url.pathname === "/auth/signin" && url.searchParams.get("return_to") === protectedPath,
  );
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();

  // React island: retry the idempotent fill + submit until hydration has caught up.
  await expect(async () => {
    await page.getByLabel("Email").fill("");
    await page.getByLabel("Email").fill(username);
    await page.getByLabel("Password", { exact: true }).fill("");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/signin"), { timeout: 5_000 });
  }).toPass();

  await page.waitForURL((url) => `${url.pathname}${url.search}` === protectedPath);
  await expect(page.getByRole("heading", { name: "Klasy i zaproszenia", level: 1 })).toBeVisible();

  // No cleanup: the test creates no data, and signing out here would revoke the shared saved session.
});
