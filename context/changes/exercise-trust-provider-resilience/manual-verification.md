# Manual Verification: Bounded Exercise Generation Admission

## Status

Manual verification completed per user report on 2026-10-14. The exact browser version, provider-stub implementation, and captured response/log artifacts were not supplied.

## Environment and Commands

- Date and host: 2026-10-14, Windows 11 Enterprise
- Runtime: Node.js v24.14.0, npm 11.9.0, Vitest 5.0.1
- Supabase stack: local stack; migration applied before manual checks
- Application URL and browser setup: local dev server at `http://localhost:4321`; signed-in browser tabs used. Browser/version not recorded
- Provider setup: stubbed provider used per the manual plan; stub implementation not recorded
- Manual commands and setup reported:
  - `npx.cmd supabase start`
  - `npx.cmd supabase migration up --local`
  - `npm.cmd run dev`
  - Admission-unavailability simulation: temporarily changed the local admission RPC to raise SQLSTATE `P0001`, then restored its saved definition
- Automated commands run:
  - `npm.cmd test -- src\components\exercises\RequestExercisesForm.test.tsx src\lib\services\exercise-generation-admission.test.ts src\pages\api\exercises\request.test.ts src\lib\services\openrouter-exercise-generator.test.ts` — passed, 4 files / 76 tests
  - `npx.cmd supabase test db --local supabase\tests\database\exercise_generation_admission.sql` — passed, 1 file / 84 tests
  - `npm.cmd run db:test` — passed, 9 files / 381 tests
  - `npm.cmd run lint` — passed
  - `npm.cmd run build` — passed
  - `npx.cmd prettier --check README.md context\foundation\test-plan.md context\changes\exercise-trust-provider-resilience\manual-verification.md` — passed
  - `npm.cmd test` — passed, 48 files / 443 tests

## Observed Outcomes

Manual results below are recorded from the user's completion report; exact response captures and server-log excerpts were not supplied.

| Scenario                                                                                           | Result | Evidence / notes                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Two signed-in tabs: active reservation is denied without losing the reviewed batch or selections   | Passed | User reports the reservation denial preserved results and selections in the two-tab check.                                                                         |
| Completing a generation releases its matching reservation                                          | Passed | User reports completion released the reservation.                                                                                                                  |
| The eleventh hourly admission is denied; lease and rolling-window boundaries recover as documented | Passed | User reports the hourly denial and lease/window recovery checks passed; exact observed timings were not supplied.                                                  |
| Admission unavailability blocks provider work                                                      | Passed | The initial permission-revocation attempt returned 403 as expected for SQLSTATE `42501`; the corrected `P0001` admission failure test then passed per user report. |
| Release failure preserves settled output and emits only sanitized operation signals                | Passed | User reports the release-failure check passed; exact response body and operation-signal text were not supplied.                                                    |
