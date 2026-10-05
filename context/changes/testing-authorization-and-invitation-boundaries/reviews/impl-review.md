<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Authorization and Invitation Boundaries Implementation Plan

- **Plan**: context/changes/testing-authorization-and-invitation-boundaries/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-05
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

- Phase 1 focused Vitest command: PASS - 16 suites, 74 tests.
- Phase 2/3 database command (`npm run db:test`): PASS after triage fix - 5 files, 133 tests. The initial review run failed 2 assertions because they counted unrelated invitation rows.
- Phase 3 focused Vitest command: PASS - 8 suites, 20 tests.
- Phase 4 documentation criteria: PASS by content inspection.
- Phase 3 manual criterion: PASS - user confirmed the planned rendered invitation states and authentication return-path checks; recorded in `manual-verification.md`.

## Findings

### F1 — Database verification is not hermetic and fails on existing data

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/tests/database/class_invitations.sql:115, supabase/tests/database/class_invitations.sql:238
- **Detail**: The required `npm run db:test` gate fails deterministically. Assertions 11 and 25 expect the global `public.class_invitations` row count to equal 2, but the local database contains one unrelated invitation, so both report `have: 3`, `want: 2`. The test creates `teacher_one_class` inside its transaction and should count invitations for that fixture class rather than all persisted rows. Because the plan marks the database suite passing, the current implementation does not satisfy its automated success criterion.
- **Fix**: Filter both invitation-count assertions by `class_id = (select class_id from teacher_one_class)` so unrelated local records cannot affect the suite.
- **Decision**: FIXED - scoped both counts to the fixture class, granted `service_role` access to the temporary fixture, and verified all 133 database tests pass.

### F2 — Completed manual verification has no durable evidence

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/testing-authorization-and-invitation-boundaries/plan.md:253
- **Detail**: Progress item 3.4 is checked and attributed to commit `0f4c374`, but that commit changes only the plan, the status-classification test, and the pgTAP suite. The change folder has no `manual-verification.md` or equivalent record showing the tested invitation states, observed page text/data exposure, or preserved authentication links. The review therefore cannot distinguish completed manual inspection from a checked box.
- **Fix**: Add a concise `manual-verification.md` recording the date, controlled states, observed generic UI outcomes, non-disclosure checks, and preserved sign-in/sign-up return path.
- **Decision**: FIXED - user confirmed the manual scenarios passed on 2026-10-05; recorded the confirmation in `manual-verification.md` and marked Progress item 3.4 complete. The review agent did not independently rerun the browser checks.

## Triage Summary

- **Fixed**: F1, F2
- **Automated verification**: All focused Vitest and database checks pass.
- **Manual verification**: User-confirmed pass recorded; Progress item 3.4 is complete.
- **Overall**: APPROVED.