<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Submit and Score Homework

- **Plan**: context/changes/submit-and-score-homework/plan.md
- **Scope**: Full plan (3 phases)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-10
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — RPC result schema permits a correct blank answer

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/homework/schemas.ts:193
- **Detail**: `studentHomeworkSubmissionAnswerRpcSchema` confirms that `normalized_answer` matches the raw answer, but does not require `is_correct` to be false when the normalized answer is null. The database enforces the invariant, but the application boundary can accept internally inconsistent RPC output, contrary to the plan's “blank is always incorrect” contract.
- **Fix**: Add a schema refinement that rejects `normalized_answer: null` with `is_correct: true`, and cover the inconsistent RPC response in the schema/service tests.
  - Strength: Preserves the grading invariant at both the database and typed application boundaries.
  - Tradeoff: A small schema and test update.
  - Confidence: HIGH — the migration already enforces the same rule.
  - Blind spot: None significant.
- **Decision**: FIXED - added the blank/correct invariant and regression coverage; `npm.cmd test -- src/lib/homework/student-schemas.test.ts` passes (32 tests).

## Verification

- Plan review coverage: phases 1, 2, and 3. The migration, pgTAP suite, typed adapters/routes, role/navigation work, student UI, verification documentation, and shared numeric-format fixture were compared against the plan. No planned item was missing; the shared CSV fixture is directly related supporting scope.
- Git scope detection: attempted with the repository Git executable at `C:\Users\maurba\AppData\Local\Programs\Git\cmd\git.exe`, but the terminal integration returned no captured output. Commit/diff evidence could therefore not be independently recorded in this fresh review.
- Phase 1 database check: historical manual-verification record reports `npm run db:test` PASS after `npx supabase db reset --local` (8 files, 297 tests). A fresh rerun could not be evidenced because the terminal integration returned no captured output.
- Phase 2 focused API/schema check: executed `npm.cmd test -- src/lib/homework/student-schemas.test.ts src/lib/services/student-homework.test.ts src/pages/api/homework/list.test.ts "src/pages/api/homework/[assignmentId]/index.test.ts" "src/pages/api/homework/[assignmentId]/submit.test.ts"`; no output or exit status was captured.
- Phase 2 regression check: executed `npm.cmd test -- src/lib/exercises/answer-normalization.test.ts src/lib/services/openrouter-exercise-verifier.test.ts src/lib/services/homework-assignments.test.ts src/pages/api/homework/assign.test.ts`; no output or exit status was captured.
- Phase 3 focused UI/role check: executed `npm.cmd test -- src/components/homework/StudentHomeworkForm.test.tsx src/lib/services/profile-roles.test.ts`; no output or exit status was captured.
- The manual-verification record reports earlier passes for focused UI/role tests, full application tests, database tests, lint, build, and configured-preview smoke. These are historical evidence, not newly verified results.
- Manual criteria 1.4 and 3.4–3.7 passed on 2026-10-10 and are recorded in `manual-verification.md`.
