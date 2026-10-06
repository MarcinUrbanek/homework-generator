<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Join Teacher-Managed Class

- **Plan**: context/changes/join-teacher-managed-class/plan.md
- **Scope**: Full plan (completed phases 1-4)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-06
- **Verdict**: APPROVED
- **Findings**: 1 critical, 2 warnings, 1 observation (4 findings fixed)

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

- `npx supabase db reset && npm run db:test`: PASS; clean migration reset and 171 database assertions across 6 files.
- F1 regression: PASS; the focused invitation file passes 60 assertions, including denial without membership or role side effects for a null-email account.
- `npm test`: PASS; 35 files and 239 tests before the F2 regression was added. Existing React `act(...)` environment warnings were emitted.
- `npm test -- src/components/classes`: PASS; 6 files and 14 tests after the F2 regression was added.
- `npm run lint`: PASS after the UI and smoke changes.
- `npm run build`: PASS after the smoke cleanup changes.
- Configured class smoke: PASS on the production preview at `http://localhost:4322` with `SMOKE_CLASS_CHECKS=true` and `SMOKE_CONFIGURED_PREVIEW=true`; all 31 smoke steps passed, followed by confirmation that the generated account and related class data were cleaned up.
- CI now runs the opt-in class smoke against its local Supabase instance, passes the local service-role key without printing it, and skips provider calls.
- Manual criteria are marked complete in Progress. `manual-verification.md` records user confirmation, while environment details and scenario-specific evidence were not supplied.

## Findings

### F1 — Null authenticated email bypasses invitation recipient check

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql:254
- **Detail**: When `authenticated_email` is `NULL`, `invitation_record.normalized_email <> authenticated_email` evaluates to `NULL`. In PL/pgSQL, the `IF` condition does not reject on `NULL`, so an authenticated account without an email could redeem a token despite the email-bound invitation contract. The original database tests covered mismatched emails but not a null-email account.
- **Fix**: Fail closed when `authenticated_email IS NULL` and compare the invitation email with `IS DISTINCT FROM`; add a database regression test for an authenticated user without an email.
- **Decision**: FIXED — the acceptance function rejects null authenticated email and uses `IS DISTINCT FROM`; regression assertions cover denial and absence of membership/role side effects. The focused file passes 60 assertions and the full database suite passes 171.

### F2 — Code confirmation could target a class different from the preview

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/classes/ClassCodeJoinForm.tsx:68
- **Detail**: Before the fix, the input remained editable while preview was in flight. A stale response could restore class A's preview after the student changed the input to code B, while confirmation submitted the current input and could enroll the student into B without previewing it.
- **Fix**: Associate each preview with its submitted normalized code, hide stale previews after input changes, and confirm only the code that produced the visible preview.
- **Decision**: FIXED — added preview-code binding and a delayed-response regression test. The class UI suite passes 6 files and 14 tests; lint passes.

### F3 — Initial dev-server smoke run failed outside S-05

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: scripts/smoke.mjs:134
- **Detail**: The configured run against the pre-existing dev server failed on unrelated gallery/exercise routes and provider expectations. Server logs showed a missing Vite SSR optimized dependency (`radix-ui.js`); `.dev.vars` also configured providers while the smoke invocation expected them to be absent. The S-05-specific smoke steps passed.
- **Fix**: Run the complete smoke command against a fresh production preview with provider calls skipped, matching the repository's CI runtime.
  - Strength: Separates the S-05 signal from stale dev-server state and configured provider credentials.
  - Tradeoff: The dev-server cache issue itself is not repaired by this change.
  - Confidence: HIGH — the production preview completed all expected smoke steps.
  - Blind spot: This does not diagnose why the pre-existing dev server's optimizer cache was stale.
- **Decision**: FIXED — the complete smoke command passed against the production preview with `SMOKE_CONFIGURED_PREVIEW=true`; the temporary preview was stopped after verification.

### F4 — Repeated class smoke runs could accumulate test data

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: scripts/smoke.mjs:31
- **Detail**: The class smoke path creates a timestamped auth account and class. Without teardown, repeated runs against persistent Supabase data accumulate test records.
- **Fix**: Restrict class smoke to loopback app/database URLs, require the service-role key before mutation, and delete the generated account after the run; its class, invitation, and membership data cascade with the account.
- **Decision**: FIXED — added the loopback guard and `finally` cleanup, and wired CI to run the class checks against local Supabase. The production-preview smoke passed all steps and confirmed cleanup.
