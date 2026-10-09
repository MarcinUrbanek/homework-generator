<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Assign Distinct Homework Implementation Plan

- **Plan**: `context/changes/assign-distinct-homework/plan.md`
- **Scope**: Full plan (completed phases only)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Planned-item verification

| Phase | File | Plan intent | Actual result | Verdict |
| --- | --- | --- | --- | --- |
| 1.1 | `supabase/migrations/20261008120000_add_homework_assignments.sql` | Persist immutable batches, recipient snapshots, and ordered approved exercise references with closed direct access. | Adds all three normalized tables, constraints, restrictive exercise FK, RLS, revoked direct privileges, and read indexes. | MATCH |
| 1.2 | `supabase/migrations/20261008120000_add_homework_assignments.sql` | Owner-only roster disclosure with normalized email and stable ordering. | `list_class_homework_roster` is stable, security-definer, teacher/owner checked, returns only ID/email/joined timestamp, and orders by join time and ID. | MATCH |
| 1.3 | `supabase/migrations/20261008120000_add_homework_assignments.sql` | Atomically create valid distinct sets, recheck membership, and support idempotent replay. | `create_homework_assignment` validates ownership, payload, approved bucket, signatures, membership race, atomic inserts, and fingerprinted idempotency. | MATCH |
| 1.4 | `supabase/tests/database/homework_assignments.sql` | Prove trust boundary, validation, rollback, membership race, idempotency, and immutable source. | pgTAP fixture/test covers all stated boundaries, including access denial and restrictive exercise deletion. | MATCH |
| 2.1 | `src/types.ts`, `src/lib/homework/schemas.ts` | Define strict shared assignment/roster/error contracts without sensitive browser output. | Grade-4 topic/difficulty, request bounds, roster/result schemas, capacity details, and safe error vocabulary are typed and Zod-validated. | MATCH |
| 2.2 | `src/lib/homework/allocate-distinct-sets.ts`, `src/lib/homework/allocate-distinct-sets.test.ts` | Allocate capacity-valid, non-identical, least-reuse/lower-overlap sets with injectable randomness. | Bounded random candidates plus deterministic fallback enforce unique signatures and score by usage then overlap; unit tests are present. | MATCH |
| 2.3 | `src/lib/services/homework-assignments.ts` | Isolate Supabase/RPC operations, validate rows, allocate, preserve idempotency, and hide SQL errors. | Adapter pages approved IDs, validates RPC rows, seeds allocation from the idempotency key, maps SQL states, and returns only summary data. | MATCH |
| 2.4 | `src/pages/api/classes/[classId]/members.ts`, `src/pages/api/homework/assign.ts` | Add non-prerendered, teacher-authorized roster/creation APIs with strict validation and privacy-safe errors. | Both handlers validate before protected work as applicable, use `authorizeTeacher`, injected dependencies, response schemas, Polish errors, and no sensitive output. | MATCH |
| 2.5 | `src/lib/homework/allocate-distinct-sets.test.ts`, `src/pages/api/classes/[classId]/members.test.ts`, `src/pages/api/homework/assign.test.ts` | Cover allocation boundaries, authorization, exclusions, idempotency, privacy, malformed output, and skipped work. | Tests cover these contracts; focused run passed the allocator, service, and API test files. | MATCH |
| 3.1 | `src/pages/classes/[classId]/assign.astro`, `src/components/classes/ClassWorkspace.tsx`, `src/pages/dashboard.astro` | Provide a protected class assignment route and discoverable class command without assignment history. | Route authorizes server-side, workspace links each owned class, and dashboard copy reflects assignment; no history surface was added. | MATCH |
| 3.2 | `src/components/homework/HomeworkAssignmentForm.tsx` | Manage roster/preselection, review, input constraints, retry-safe idempotency, and result handling. | Controller implements all-preselected loading, selection controls, review, one-key retries, fresh keys on input changes, and exclusion lookup from the loaded roster. | MATCH |
| 3.3 | `src/components/homework/HomeworkAssignmentView.tsx` | Render every operational state with semantic, accessible Polish UI and capacity feedback. | Implements loading, empty, edit, review, submit, success, exclusion, capacity, authorization, and retry states with focus/live-status handling. | MATCH |
| 3.4 | `src/components/homework/HomeworkAssignmentForm.test.tsx` | Protect UI flow, recovery, privacy, accessibility, and focus behavior. | The 17 tests exercise the intended flow and pass in the focused component suite. | MATCH |
| 4.1 | `scripts/smoke.mjs`, `.github/workflows/ci.yml` | Add configured local-Supabase assignment smoke and run it where local Supabase is available. | Smoke creates controlled accounts/data, verifies authorization, persistence, distinctness, retry, privacy, cleanup, and CI runs it against local Supabase. | MATCH |
| 4.2 | `context/changes/assign-distinct-homework/manual-verification.md` | Record observed manual workflow, privacy, fairness, and responsive-accessibility results. | The record has the required scenarios, but every manual scenario and overall status remains `Pending`, while plan item 4.4 is checked complete. | DRIFT |

## Related unplanned or separately named files

| File | Plan relationship | Actual result | Verdict |
| --- | --- | --- | --- |
| `src/lib/services/homework-assignments.test.ts` | Supports Phase 2 adapter contract, though not named in its file list. | Adds focused pagination, malformed-row, idempotency, insufficient-capacity, and SQL-state tests. | EXTRA (related, beneficial) |
| `src/components/classes/ClassWorkspace.test.tsx` | Supports Phase 3’s planned workspace command. | Adds assertion for the class assignment link. | EXTRA (related, beneficial) |
| `src/pages/api/classes/[classId]/members.test.ts` | Explicitly planned Phase 2 test file; touched again in Phase 3. | Only changes the test context cast to `unknown as APIContext`; behavior is unchanged. | MATCH |
| `supabase/tests/database/homework_assignments.sql` | Explicitly planned Phase 1 test file. | Added database trust-boundary coverage. | MATCH |
| `context/changes/assign-distinct-homework/plan.md` | Plan progress record. | Records completed phase checkboxes and commit IDs. | MATCH |
| `context/changes/assign-distinct-homework/plan-brief.md` | Supplemental planning document, not required by the implementation plan. | Concise scope/implementation brief; no product surface added. | EXTRA (related, benign) |
| `context/foundation/roadmap.md` | Project tracking document, not an implementation deliverable. | Tracks S-06 as `in-progress`; this conflicts with the completed plan/change state. | DRIFT |
| `context/foundation/test-plan.md` | Risk/test strategy document, not an implementation deliverable. | Updates assignment/scoring test strategy; no runtime scope added. | EXTRA (related, benign) |

No unrelated runtime scope creep was found. The review also found no substantive security, data-safety, architecture, or pattern-compliance deviation in the implemented assignment path.

## Findings

### F1 — Allocation capacity counts students who may no longer be eligible

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/homework-assignments.ts:143`
- **Detail**: The adapter calculates allocator capacity for every selected student before the database function rechecks current membership. If one selected student departed after roster load and the exercise pool supports only the still-enrolled students, it returns `INSUFFICIENT_POOL` instead of creating the required partial assignment and reporting the exclusion.
- **Fix**: Resolve current eligible recipients before allocating, or change the database contract so it reports eligibility before allocation; add a membership-race boundary test for a pool that fits only the remaining recipients.
- **Decision**: FIXED — Applied roster-first allocation and stable idempotency replay.

### F2 — Manual verification is marked complete without recorded manual evidence

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/changes/assign-distinct-homework/manual-verification.md:7`
- **Detail**: Phase 4 progress item 4.4 is checked, but the verification record says `Overall manual status: Pending` and every scenario remains `Pending`. Automated results do not establish the manual responsive/accessibility evidence required by the plan.
- **Fix**: Perform and record the required sanitized manual checks, or reopen progress item 4.4 until they are complete.
- **Decision**: FIXED — Reopened progress item 4.4 pending observed manual verification.

### F3 — Configured homework smoke verification cannot run in this environment

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `scripts/smoke.mjs:32`
- **Detail**: The required Phase 4 smoke command was run against the production preview with `SMOKE_CLASS_CHECKS` and `SMOKE_HOMEWORK_CHECKS` enabled, but stopped before exercising the flow because the configured Supabase instance was not recognized as local. The completed progress item therefore cannot be independently verified in the current environment.
- **Fix**: Run the smoke command with the local Supabase configuration required by its safety guard and record the successful output.
- **Decision**: FIXED — Local configured-preview smoke passed and the result was recorded.
