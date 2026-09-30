<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Approve First Exercise Pool

- **Plan**: context/changes/approve-first-exercise-pool/plan.md
- **Scope**: Phase 4 of 4
- **Reviewed phases**: 4
- **Date**: 2026-09-30
- **Verdict**: REJECTED
- **Findings**: 2 critical 1 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Findings

### F1 — Smoke coverage for verify/approve boundaries not implemented

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: scripts/smoke.mjs
- **Detail**: Plan requires invalid verify/approve requests, missing verifier-configuration behavior and gallery isolation checks. `scripts/smoke.mjs` has no reference to `verify` or `approve`; no Phase 4 commit exists after f35467d and the file is unmodified. Criterion 4.2 is therefore unmet (the smoke passes only because it does not cover the new routes).
- **Fix**: Extend smoke.mjs with authenticated invalid-payload checks (400), unauthenticated (401), and missing-config (503) for `/api/exercises/verify` and `/api/exercises/approve`, matching the existing assertion helpers.
  - Strength: Reuses the existing authenticated smoke flow.
  - Tradeoff: Must avoid inserting approved rows and provider calls.
  - Confidence: HIGH — routes and error envelopes already exist from Phase 2.
  - Blind spot: Exact 503 behavior in the provider-free preview not run.
- **Decision**: FIXED via Fix now (smoke.mjs extended with 401/400/503 verify/approve steps; the 503 step needs a provider-free server)

### F2 — Operational docs and manual verification record missing

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: README.md, context/changes/approve-first-exercise-pool/manual-verification.md
- **Detail**: README has no mention of `SUPABASE_SERVICE_ROLE_KEY` or `OPENROUTER_VERIFIER_MODEL`; `manual-verification.md` and `screenshots/*.png` do not exist. Manual criteria 4.3 and 4.4 are unchecked and have no evidence.
- **Fix**: Add README setup section, run the live workerd flow, and record results and screenshots.
  - Strength: Produces the north-star evidence the milestone depends on.
  - Tradeoff: Requires a live verifier model and local Supabase.
  - Confidence: HIGH — plan defines contents precisely.
  - Blind spot: Live flow outcome is unknown.
- **Decision**: FIXED via Fix now (README section added; live flow, screenshots and manual-verification.md remain a manual step, 4.3/4.4 pending)

### F3 — Automated criteria 4.1 partially unverified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 4.1
- **Detail**: `npm run test` (120 passed), `npm run lint` (0 errors) and `npx astro check` (0 errors) pass. `npm run build` and `npm run db:test` were not run in this review (db:test requires local Supabase/Docker); Progress 4.1/4.2 remain unchecked.
- **Fix**: Run build and db:test, then check 4.1 once green.
- **Decision**: FIXED via Fix now (build, db:test, test, lint, astro check pass; 4.1 verified)
