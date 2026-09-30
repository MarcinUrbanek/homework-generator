<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Approve First Exercise Pool

- **Plan**: context/changes/approve-first-exercise-pool/plan.md
- **Scope**: Phase 3 of 4
- **Reviewed phases**: 3
- **Date**: 2026-09-29
- **Verdict**: REJECTED
- **Findings**: 1 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | FAIL |

## Findings

### F1 — Legacy implementations are duplicated across the Phase 3 UI modules

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/exercises/RequestExercisesForm.tsx:171; src/components/exercises/ExerciseRequestView.tsx:172; src/components/exercises/ExerciseCandidateList.tsx:153; src/components/exercises/ExerciseRequestStateGallery.tsx:213
- **Detail**: Each file contains the new Phase 3 implementation followed by an appended legacy generation-only implementation. The duplicates redeclare imports, props, functions, and default exports. The focused form test cannot be collected, the full suite has one failed suite, Astro reports 153 errors, and the production build rejects multiple default exports, so the planned review workflow cannot compile or run.
- **Fix**: Remove the second legacy implementation block from each affected file, retaining the first Phase 3 implementation.
- **Decision**: FIXED — removed the appended legacy implementations from all four UI modules; `npm run build` passes.

### F2 — Phase 3 changes do not satisfy the repository lint contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/components/hooks/use-session-exercise-batch.ts:21; src/components/exercises/RequestExercisesForm.test.tsx:123
- **Detail**: `npm run lint` reports 73 errors across the Phase 3 files. Beyond duplicate-declaration fallout, the retained implementation has Prettier violations, unsafe `any` access in tests, unnecessary conditions/assertions, and forbidden shorthand callbacks returning `void`. Forty-eight errors are auto-fixable, but the remaining typed lint failures require targeted edits.
- **Fix**: Run the repository formatter/lint fixer on the Phase 3 files, then repair the remaining typed ESLint findings and rerun all Phase 3 commands.
  - Strength: Restores the repository's established formatting and type-checked lint contract across the complete touched slice.
  - Tradeoff: Several files need mechanical formatting plus focused test typing changes; the exact remaining count is only knowable after duplicate removal and auto-fix.
  - Confidence: HIGH — the failures were reproduced by the plan's exact lint command.
  - Blind spot: Some reported lint errors may disappear when the appended legacy blocks are removed.
- **Decision**: FIXED — formatted the Phase 3 slice, replaced unsafe test JSON access with schema validation and public restoration helpers, preserved evidence-union narrowing, and passed focused tests, full tests, lint, Astro check, and build.

### F3 — Manual responsive and accessibility verification remains pending

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/approve-first-exercise-pool/plan.md:349
- **Detail**: Progress item 3.4 is correctly unchecked, and no retained desktop/mobile, keyboard, focus, status-announcement, or overlap evidence exists for this active change. This is pending work rather than rubber-stamped completion, but Phase 3 cannot be considered complete until it is performed after the build blockers are fixed.
- **Fix**: Complete the documented desktop/mobile keyboard and pointer walkthrough, record the evidence, and only then mark Progress item 3.4 complete.
- **Decision**: PENDING

## Verification

- `npm run test -- src/components/hooks/use-session-exercise-batch.test.ts`: PASS — 1 file, 9 tests passed.
- `npm run test -- src/components/exercises/RequestExercisesForm.test.tsx`: FAIL — transform failed before collection because `RequestExercisesForm.tsx` redeclares imports and its default export.
- `npm run test`: FAIL — 10 files and 107 tests passed; 1 suite failed during transformation.
- `npm run lint`: FAIL — 73 errors, including 48 potentially auto-fixable errors.
- `npx astro check`: FAIL — 153 errors across 66 files, dominated by duplicate Phase 3 component implementations and their conflicting contracts.
- `npm run build`: FAIL — multiple default exports in `RequestExercisesForm.tsx`.
- Manual Progress item 3.4: PENDING and unchecked.