# Test stack

## E2E

<!-- Written by /10x-e2e-setup. Re-run it to change this section; other skills only read it. -->

- runner: Playwright Test, @playwright/test 1.64.1
- config: playwright.config.ts
- single-spec command: npx playwright test tests/e2e/<name>.spec.ts
- full-suite command: npx playwright test
- base URL: http://localhost:4321
- port: 4321 (detected from Astro's default preview port — no server.port in astro.config.mjs, no --port in the preview script; detected default 4321, override with E2E_PORT)
- web server command: npm run build && npm run preview -- --port $E2E_PORT (ASTRO_PREVIEW_BACKGROUND=1 keeps Astro 7 preview in the foreground; the Cloudflare preview reads its app env from .dev.vars); reuseExistingServer outside CI
- auth setup project: setup (tests/e2e/auth.setup.ts), credentials from E2E_USERNAME / E2E_PASSWORD in .env (local Supabase user e2e.user@example.test, role teacher)
- storageState: playwright/.auth/user.json (gitignored)
- seed: tests/e2e/seed.spec.ts — protects auth-gate-roundtrip: a signed-out visitor to a protected page is sent to sign-in and, after signing in, returns to the same path + query (test-plan.md §3 Phase 4 critical-flow signal)
- browser CLI: playwright-cli (global, @playwright/cli 0.1.22, session -s=10x-homework-generator), command skill at .github/skills/playwright-cli/SKILL.md
- updated: 2026-10-30
