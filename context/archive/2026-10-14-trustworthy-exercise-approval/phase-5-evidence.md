# Phase 5 evidence record

Recorded 2026-10-18. This is an implementation handoff, not a release sign-off.

## Evidence prepared

- `src/lib/exercises/__fixtures__/arithmetic-authority-v1.json` contains hand-calculated literal structures, statements, answers, derivations, uniqueness rationales, adversarial evidence, and explicit provenance. No external human review is claimed; an independent human reviewer remains unassigned.
- TypeScript tests and SQL fixtures consume literal expected values. Database promotion and homework-consumption suites retain their actual database functions as the boundary under test.
- The manual seed now inserts fixture-backed immutable evidence and calls authenticated approval rather than writing directly to the exercise pool.

## Evidence not obtained

- Focused authority/API tests passed: 7 files, 186 tests (`npm test -- src/lib/exercises/arithmetic-authority.test.ts src/lib/services/arithmetic-exercise-verifier.test.ts src/lib/services/openrouter-exercise-generator.test.ts src/pages/api/exercises`).
- All local database suites passed: 9 files, 432 tests (`npm run db:test`).
- Full regression passed: 50 files, 564 tests (`npm test`); `npx astro check` reported 0 errors, warnings, or hints across 159 files; `npm run lint` and `npm run build` passed.
- A deliberate wrong-answer mutation made the arithmetic-authority suite fail 37 of 66 tests; the temporary production edit was restored and verified absent from the worktree.
## Manual and release checks

- The user confirmed both Phase 5 manual verification criteria passed on 2026-10-18, including the disposable-local-Supabase teacher/student flow and the release-review checks.
- The confirmation did not include numeric legacy counts or detailed observations for the backup, maintenance ordering, or rollback review. This evidence is user-reported and was not independently observed by this agent.

## Remaining evidence limits

- No production deployment, live migration, or live-data inspection was performed by this implementation run; local test results do not establish deployed legacy counts.
- Do not infer deployment status or safety from this record. Keep traffic paused or affected routes disabled if release verification fails; never restore model-only approval or expose uncertified prompts as a rollback.
