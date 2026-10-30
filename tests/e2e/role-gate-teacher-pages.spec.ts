// risk: role-gate-teacher-pages — test-plan.md Risk #1 (a student reaches teacher-only actions),
// facet: the rendered teacher pages deny a signed-in student and never show teacher tools.
// The API 403s are covered by Vitest handler tests and pgTAP (test-plan.md §6.1); patterned on seed.spec.ts.
import { test, expect } from "@playwright/test";
import { createLocalStudent, deleteLocalAccount, type LocalAccount } from "./helpers/local-accounts";

// The saved session is the teacher; this test signs in its own student account.
test.use({ storageState: { cookies: [], origins: [] } });

let student: LocalAccount;

// Setup: a fresh local student account per test; unique email so parallel runs and re-runs don't collide.
test.beforeEach(async () => {
  student = await createLocalStudent("role-gate");
  test.info().annotations.push({ type: "test-data", description: student.email });
});

// Cleanup: delete the account and assert its profile and roles are gone.
test.afterEach(async () => {
  await deleteLocalAccount(student.id);
});

test.describe("Risk #1: student cannot reach teacher-only actions", () => {
  test("signed-in student is denied the teacher pages and never sees teacher tools", async ({ page, baseURL }) => {
    // Sign in through the app's sign-in endpoint (not the UI); the session cookie lands in this context.
    const signIn = await page.request.post("/api/auth/signin", {
      form: { email: student.email, password: student.password, return_to: "/" },
      headers: { Origin: new URL(baseURL ?? "").origin },
      maxRedirects: 0,
    });
    expect(signIn.status()).toBe(302);
    expect(signIn.headers().location).toBe("/");

    // Class management: the student gets the access-denied state, not the class workspace.
    const classes = await page.goto("/classes");
    expect(classes?.status()).toBe(403);
    await expect(page).toHaveURL(/\/classes$/);
    await expect(
      page.getByRole("heading", { name: "Ta strona jest dostępna tylko dla nauczycieli", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Klasy i zaproszenia" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Nowa klasa" })).toHaveCount(0);

    // Exercise generation: the student gets the access-denied state, not the generation form.
    const request = await page.goto("/exercises/request");
    expect(request?.status()).toBe(403);
    await expect(page).toHaveURL(/\/exercises\/request$/);
    await expect(
      page.getByRole("heading", { name: "Ta strona jest dostępna tylko dla nauczycieli", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wygeneruj propozycje zadań" })).toHaveCount(0);
  });
});
