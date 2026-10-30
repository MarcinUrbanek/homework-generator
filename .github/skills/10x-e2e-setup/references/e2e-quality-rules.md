# E2E Quality Rules

These rules govern every E2E test the agent writes. They are **not** copied into
your agent's rules file (`CLAUDE.md`, `AGENTS.md`, …): they matter only while
you work on E2E tests, so they ship with the skills and load when one runs.
`/10x-e2e-setup` writes the seed to follow them; `/10x-e2e` reads this file
before it generates a test and reviews every test against it. The rules
constrain the agent's output so generated tests are stable by default — agents
apply known patterns far more reliably than they invent new ones.

## The rules (Playwright)

```
# E2E Testing Rules

- Use getByRole, getByLabel, getByText as primary locators.
  Fall back to getByTestId only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared state between tests.
- Never use page.waitForTimeout(). Wait for specific conditions:
  toBeVisible(), waitForURL(), waitForResponse().
- Assert the business outcome, not implementation details.
- Use unique identifiers (e.g., timestamp suffix) for test data
  to avoid collisions in parallel runs. Clean up in afterEach and
  assert every cleanup call succeeded (expect(res).toBeOK()) — a
  cleanup that fails silently leaves data behind while the test stays green.
- Use storageState for authentication — never log in through UI
  in individual tests.
```

## Governing rules (the reasoning behind the rules)

- **Don't generate E2E tests from scratch.** Start from `test-plan.md`: pick the
  2–3 highest risks that need browser-level coverage and feed them as input. A
  risk needs E2E when it crosses several system boundaries (auth, routing, API,
  DB) or exists only in the rendered UI; if an isolated function can prove it, a
  unit test is enough.
- **E2E ≠ zero mocking.** Internal boundaries (auth, routing, DB) stay real —
  that's where integration risk hides. Mock expensive/non-deterministic external
  APIs (LLMs, payment gateways) at the network layer.
- **Name the test after the risk:** `test('flashcard data persists after page
  reload', ...)`, not `test('test 1', ...)`.
- **The assertion must fail if the risk materializes.** Control question for
  every assertion: would this fail if the `test-plan.md` risk came true? If not,
  it's decorative.

## Why these rules (source authority)

Every rule traces to Playwright's official Best Practices and Test Assertions
docs:

- `getByRole` is the recommended default locator strategy; CSS selectors couple
  tests to implementation details.
- Each test must be completely isolated with its own storage, data, cookies.
- Web-first assertions wait until conditions are met; `waitForTimeout` is
  officially designated an anti-pattern ("Never wait for timeout in production.
  Tests that wait for time are inherently flaky").
- `storageState` is the standard pattern for authenticated tests.

## Other stacks

The rules above are Playwright syntax; the principles are tool-agnostic. Map
each to your tool's idiom:

| Principle | Playwright | Cypress | WebdriverIO / Selenium |
| --- | --- | --- | --- |
| Role-based locator | `getByRole` | `cy.findByRole` (Testing Library) | accessibility-name / role strategy |
| Wait for state | `expect().toBeVisible()`, `waitForResponse` | `cy.contains().should('be.visible')`, `cy.intercept` | explicit waits on conditions, never `sleep` |
| Test isolation | parallel workers, own data | `beforeEach` reset, no shared aliases | fresh session per test |
| Auth without UI | `storageState` | `cy.session` | saved cookies / token injection |
| Data cleanup | unique ids + `afterEach`, each call asserted | unique ids + `afterEach`, each call asserted | unique ids + teardown, each call asserted |

If you work on a non-Playwright stack, write these mappings into your seed test
and your E2E prompts so the agent produces idiomatic, stable tests for your tool.

## Project conventions (10x-homework-generator)

Derived from `tests/e2e/*.spec.ts`, `tests/e2e/auth.setup.ts`,
`tests/e2e/helpers/local-accounts.ts`, `playwright.config.ts` and
`context/foundation/test-stack.md`. They override the generic rules above
where they are more specific.

- **Spec files.** One risk per file in `tests/e2e/`, named
  `<risk-slug>.spec.ts` (e.g. `role-gate-teacher-pages.spec.ts`). Start the
  file with a comment naming the risk, the `test-plan.md` risk/phase it
  covers, and what lower layers (Vitest, pgTAP) already cover. Shared helpers
  go in `tests/e2e/helpers/`. `tests/e2e/seed.spec.ts` is the pattern to copy.
- **Auth setup project.** The `setup` project (`tests/e2e/auth.setup.ts`,
  matched by `*.setup.ts`) signs in once through the UI as the teacher from
  `E2E_USERNAME` / `E2E_PASSWORD` (gitignored `.env`; local user
  `e2e.user@example.test`). It saves the session to
  `playwright/.auth/user.json` (gitignored). The `chromium` project depends
  on `setup` and uses that `storageState` by default.
- **Teacher vs. student accounts.** The default saved session is the
  **teacher**. A test that needs a signed-out start or another user opts out
  with `test.use({ storageState: { cookies: [], origins: [] } })`. Create a
  student with `createLocalStudent(tag)` from
  `tests/e2e/helpers/local-accounts.ts`. It uses the local Supabase
  service-role key (from `.env` or `.dev.vars`) and refuses a non-localhost
  `SUPABASE_URL`. Sign-up assigns the teacher role by default, so the helper
  replaces it with `student`. A test may sign the extra account in via
  `page.request.post("/api/auth/signin", { form: { email, password,
return_to }, headers: { Origin }, maxRedirects: 0 })` instead of the UI.
- **Never sign out the shared teacher session** inside a test; that revokes
  the saved `storageState` for every other test.
- **UI text in locators.** App pages are Polish, so use the exact Polish
  accessible names (e.g. `getByRole("heading", { name: "Klasy i zaproszenia",
level: 1 })`, `"Ta strona jest dostępna tylko dla nauczycieli"`). The auth
  pages are English (`"Sign in"`, `getByLabel("Email")`,
  `getByLabel("Password", { exact: true })`). Copy names from the running app
  (playwright-cli snapshot), never translate them.
- **React island hydration.** On island forms (e.g. sign-in), wrap the
  idempotent clear + fill + submit + `waitForURL` in
  `await expect(async () => { ... }).toPass()`. Input typed before hydration
  is lost. Never use a fixed wait.
- **Unique data.** Suffix every created value with `Date.now()` (plus a
  random part for accounts, as `createLocalStudent` does), e.g.
  `` `/classes?view=seed-${Date.now()}` ``. Record created accounts with
  `test.info().annotations.push({ type: "test-data", description: email })`.
- **Cleanup.** Create per-test data in `test.beforeEach` and remove it in
  `test.afterEach` (`deleteLocalAccount(id)`). Cleanup asserts that it worked:
  `deleteLocalAccount` throws if `profiles`/`profile_roles` rows survive.
  Tests that create no data say so in a comment instead.
- **Where it runs.** Always against the production build served by
  `npm run build && npm run preview -- --port $E2E_PORT` (default 4321,
  `ASTRO_PREVIEW_BACKGROUND=1`; the preview reads app env from `.dev.vars`)
  and a **local** Supabase (`npx supabase start`). `reuseExistingServer` is on
  outside CI. Commands: `npx playwright test tests/e2e/<name>.spec.ts` (one
  spec) and `npx playwright test` (suite).
