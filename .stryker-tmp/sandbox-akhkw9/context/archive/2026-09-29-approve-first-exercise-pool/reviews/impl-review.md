<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Approve First Exercise Pool

- **Plan**: context/changes/approve-first-exercise-pool/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-09-30
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated re-run in this review: `npm run test` (120 passed), `npm run lint` (0 errors), `npx astro check` (0 errors), `npm run build` (ok). `db:test` and `smoke` were not re-run; results are taken from `manual-verification.md` (62 db tests, smoke pass).

## Findings

### F1 — Retained screenshots not delivered

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/approve-first-exercise-pool/screenshots/ (absent)
- **Detail**: Phase 4 contract requires `screenshots/*.png` for mixed verification, selected subset, save error, and post-save remainder/completion states. None exist. Progress 4.4 is checked as "waived" and `manual-verification.md` states screenshots were not retained; the visual evidence gate from the UI contract is therefore unmet, though the waiver is documented.
- **Fix**: Accept the documented waiver, or capture the gallery states at 1280x800 and 390x844 and add them.
- **Decision**: SKIPPED (waiver accepted)

### F2 — Unplanned exercise-count helper

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/exercises/exercise-count.ts
- **Detail**: Polish noun-pluralization helper (plus test) is used by the saved-count summary in `RequestExercisesForm.tsx` and `ExerciseRequestView.tsx`. It is not named in the plan but is required by the planned Polish saved-count announcement and is small and tested.
- **Fix**: Note it as an addendum in the plan; no code change.
- **Decision**: FIXED via Fix now (addendum added to plan.md)

### F3 — Non-provider failure discards settled batch results

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/exercises/verify.ts:244
- **Detail**: Provider failures become `indeterminate` items, but a ledger write failure rethrows inside `Promise.all`, so the whole response becomes an error and the client sees none of the other candidates' results. Rows already recorded are reused on retry (existing-snapshot lookup), so no data is lost, only a repeat request and a possible extra provider call for unrecorded candidates.
- **Fix**: Use `Promise.allSettled` and map write failures to per-candidate `indeterminate` with a persistence code.
  - Strength: Matches the plan's "one failure does not erase settled results" intent.
  - Tradeoff: Requires a new error code in the shared schema/UI copy.
  - Confidence: MED — the failure path is rare and the retry is already safe.
  - Blind spot: UI handling of a persistence-coded indeterminate was not checked.
- **Decision**: FIXED via Fix now (ledger write failures map to per-candidate `indeterminate` with `PROVIDER_FAILURE`; test updated; no new error code needed)
