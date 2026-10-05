<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Reuse Saved Exercises Implementation Plan

- **Plan**: context/changes/reuse-saved-exercises/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-02
- **Verdict**: APPROVED
- **Findings**: 1 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification

- `npx supabase db reset`: PASS after using the Windows command shim.
- `npm run db:test`: Initially failed because `profiles.role` no longer exists; after F1 was fixed, all 5 database files and 129 assertions pass from a clean reset.
- `npm run test -- src/pages/api/exercises/saved.test.ts`: PASS, 16 tests.
- `npm run test -- src/components/exercises/SavedExerciseBrowser.test.tsx`: PASS, 7 tests.
- `npm run test`: PASS, 25 files and 208 tests.
- `npm run lint`: PASS.
- `npx astro check`: no workspace diagnostics reported.
- `npm run build`: PASS.
- `npm run smoke`: Initially failed because configured provider responses contradicted mutually exclusive gallery expectations; after F2 was fixed, configured-preview smoke passes every step.
- Manual criteria: all are marked complete and supported by `manual-verification.md` plus retained desktop/mobile screenshots.

## Findings

### F1 — Database test fixture targets a removed profile column

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/tests/database/saved_exercise_discovery.sql:56
- **Detail**: The clean schema migration moves roles into `profile_roles` and drops `profiles.role`, but the saved-exercise fixture still executes `update public.profiles set role = 'student'`. `npm run db:test` aborts this file before its 14 planned assertions, so filtering, pagination, shared-teacher access, and student denial are not currently verified in the integrated schema.
- **Fix**: Replace the obsolete profile update with fixture setup that removes the student's default teacher role and inserts the student role in `public.profile_roles`.
- **Decision**: FIXED — updated the fixture to set `public.profile_roles.role` by `user_id`; clean `npm run db:test` passes all 129 assertions.

### F2 — Smoke configured-preview mode cannot pass

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:52
- **Detail**: With configured providers loaded from `.dev.vars`, the default smoke run expects 503 responses but receives 200. Setting the documented `SMOKE_CONFIGURED_PREVIEW=true` cannot resolve this because the script then expects `/dev/ui-exercise-request` to return 200 in one step and 404 in the immediately following unconditional step. The saved-exercise redirect, teacher access, invalid-query, and production-gallery checks themselves pass.
- **Fix**: Keep one unconditional production-gallery 404 assertion and use `SMOKE_CONFIGURED_PREVIEW` only to skip missing-provider expectations.
- **Decision**: FIXED — removed the contradictory conditional gallery step; configured-preview `npm run smoke` passes every step.