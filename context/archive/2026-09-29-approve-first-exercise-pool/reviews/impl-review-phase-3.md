<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Approve First Exercise Pool

- **Plan**: context/changes/approve-first-exercise-pool/plan.md
- **Scope**: Phase 3 of 4 (round 2; round 1 preserved in impl-review-phase-3-round1.md)
- **Reviewed phases**: 3
- **Date**: 2026-09-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Untracked, non-ignored file holds service-role and API keys

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `.dev copy2.vars` (repo root)
- **Detail**: The file defines SUPABASE_SERVICE_ROLE_KEY and OPENROUTER_API_KEY and appears as untracked in `git status`; `git check-ignore` reports no ignore rule, so `git add .` would commit live secrets. It is not part of the plan.
- **Fix**: Delete the copy (or move it outside the repo) and broaden `.gitignore` to `.dev*.vars`.
- **Decision**: FIXED - deleted `.dev copy2.vars` (redundant with ignored `.dev.vars`) and broadened .gitignore to `.dev*.vars`.

### F2 — Selected-count label uses wrong Polish plural

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/exercises/ExerciseRequestView.tsx:181
- **Detail**: Only 1 vs. other is handled, so the UI renders "Wybrano: 0 zadania" (observed in the gallery) and "Wybrano: 5 zadania"; correct forms are "0 zadań" and "5 zadań". `savedCountMessage` in RequestExercisesForm.tsx:15-19 already implements the correct rule, so the two are inconsistent.
- **Fix**: Extract the plural helper from RequestExercisesForm.tsx into `src/lib/` and use it for both messages; add a test for 0, 1, 2-4, 5.
- **Decision**: FIXED - added `src/lib/exercises/exercise-count.ts` (+ test), used in the view and save message; tests, lint, astro check pass.

### F3 — All selection checkboxes share one accessible name

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/components/exercises/ExerciseCandidateList.tsx:134
- **Detail**: Every candidate's checkbox is labelled "Wybierz do zapisania" (five identical names in the accessibility snapshot). Screen-reader and voice-control users cannot tell which exercise a checkbox selects, which conflicts with the plan's "accessible names" requirement and criterion 3.4.
- **Fix**: Make the label unique per candidate, e.g. visually hidden "Zadanie N" prefix or `aria-label={`Wybierz zadanie ${n} do zapisania`}`, and assert it in RequestExercisesForm.test.tsx.
- **Decision**: FIXED - per-candidate `aria-label` "Wybierz do zapisania: zadanie N" (keeps the visible label text) with a test assertion.

### F4 — Manual desktop/mobile keyboard and pointer verification still pending

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/approve-first-exercise-pool/plan.md:349
- **Detail**: Item 3.4 is correctly unchecked. Gallery spot-checks this round found no horizontal overflow or clipped text at 1440 px and 390 px, eligible/ineligible checkbox states and Polish disabled reasons render correctly, and the retry and save controls behave as planned. This does not cover the live flow (verify, retry, save, focus and announcements), and a programmatic `focus()` on a checkbox did not report `:focus-visible`, which needs a real keyboard pass.
- **Fix**: Run the keyboard-only and pointer walkthrough on the live flow and the gallery, record it, then check off 3.4.
- **Decision**: SKIPPED - manual walkthrough (3.4) remains pending for the user.

### F5 — Unplanned scratch artifacts in the working tree

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .phase2-verify.json; supabase/snippets/Untitled query 447.sql; supabase/snippets/Untitled query 755.sql (modified)
- **Detail**: Leftover Phase 2 output and Studio snippets are outside the Phase 3 file list and would pollute the phase commit. Also, `astro preview` on port 4332 had locked `dist/client` and caused `npm run build` to fail with EPERM until it was stopped.
- **Fix**: Remove or ignore these files before committing; stop preview servers before running the build.
- **Decision**: FIXED (partial) - removed `.phase2-verify.json`; Studio snippets left untouched.

## Triage summary

- Fixed: F1, F2, F3, F5 (partial)
- Skipped: F4

## Triage summary

- Fixed: F1, F2, F3, F5 (partial)
- Skipped: F4

## Verification

- Plan drift (all four planned areas: review state, controller, presentation, gallery fixtures): MATCH, no MISSING or EXTRA in the seven implementation and test files.
- `npm run test -- src/components/hooks/use-session-exercise-batch.test.ts`: PASS (9 tests)
- `npm run test -- src/components/exercises/RequestExercisesForm.test.tsx`: PASS (8 tests)
- `npm run test`: PASS (11 files, 115 tests)
- `npm run lint`: PASS
- `npx astro check`: PASS (0 errors, 0 warnings, 0 hints)
- `npm run build`: PASS after stopping a stale `astro preview` (PID 33060) that locked `dist/client`; the first two attempts failed with EPERM, an environment lock rather than a code defect.
- Manual 3.4: PENDING (unchecked); progress items 3.2 and 3.3 remain unchecked in plan.md although their commands now pass.
- Dismissed scan findings: unmount state-update warning (removed in React 19, no action needed) and the optional-chaining validator (type-narrowed and covered by the malformed-evidence test).
