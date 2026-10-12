# Submit and Score Homework - Plan Brief

> Full plan: [plan.md](./plan.md)

## What & Why

Deliver S-07 so students can open assigned Polish math homework, submit answers once, and immediately see pass/fail and per-exercise correctness. Grade against the immutable approved answers used in assignment, not the current pool or a client-supplied result.

## Starting Point

S-06 already persists assignments, individual recipients, and ordered approved exercise references, with direct student reads closed. There is no submission storage or student homework workflow; the dashboard currently shows teacher-oriented tools to everyone.

## Desired End State

Students discover homework from a role-aware dashboard, open their own exercises, and confirm one final submission, including unanswered exercises if needed. Results persist across reloads and show submitted answers, per-item correctness, and correct/assigned count without revealing the answer key. Every access requires current class membership; leaving hides pending homework and saved results.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Finality | One immutable submission; equivalent retry returns its saved result | Prevents transport duplicates and post-result answer changes. |
| Blanks | Allowed, including all blank; always incorrect | Students may finish without guessing; confirmation warns about blanks. |
| Input | Natural-number digits, leading zeros, correctly space-grouped thousands | Accepts numeric equivalents without extracting meaning from prose. |
| Rejected input | Prose, units, signs, decimals, and malformed grouping | Keeps grading deterministic for current supported exercises. |
| Score | Correct / all assigned exercises; at least 50% passes | Fixed by PRD; blanks never shrink the denominator. |
| Result | Per-exercise correctness and aggregate counts; no expected answers | Gives immediate feedback without exposing reusable answer authority. |
| Membership | Current enrollment required for all reads, submit, and replay | Departure revokes pending and historical homework access. |
| Navigation | Role-aware dashboard and dedicated homework list; dual-role sees both | Preserves teacher behavior while making student work discoverable. |
| Ordering | Pending first, submitted second; newest assignment first per group | Keeps unfinished work visible and ordering predictable. |
| Drafts | Current page only; retain through validation/network failures | Avoids shared-device storage and autosave scope. |
| Scoring authority | Atomic database scoring and private persistence | Clients cannot submit grades or overwrite a final result. |

## Scope

**In scope:** safe student list/detail reads; private submission persistence; numeric validation; atomic grading/retry; current-membership enforcement; Polish form/results; role-aware dashboard; pgTAP, Vitest, existing smoke, and manual integrated verification.

**Out of scope:** teacher review/feedback (S-08), answer-key disclosure, repeat attempts, reopening, persistent drafts, deadlines, notifications, assignment editing, curriculum expansion, new hooks/CI, and the deferred full-flow automation rollout.

## Architecture / Approach

Session-bound Astro pages and APIs call narrow security-definer database functions. The database checks recipient ownership and current membership, scores against assigned approved answers, and persists all final answers/results atomically. SSR renders the list; a React island handles answer entry, blank-aware final confirmation, recoverable failures, and immutable results. An equivalent normalized answer vector is a replay; a different vector is a conflict.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Persistence and scoring boundary | Private tables, safe reads, atomic scoring, pgTAP | Incorrect authorization, grade, or concurrent finalization. |
| 2. Typed student APIs | DTOs, strict validation, session-bound adapters/routes, tests | Client data or raw database errors leak into public responses. |
| 3. Student workflow and verification | Dashboard/list/form/results, documentation, integrated checks | Finality, blank warnings, or membership revocation fail in real use. |

**Prerequisites:** Completed S-06; local Supabase/Docker; configured app environment; two student accounts and a teacher account for acceptance.
**Estimated effort:** Approximately 3-4 implementation sessions across 3 phases; concurrency and integrated acceptance need human confirmation.

## Open Risks & Assumptions

- Current exercises have natural-number answers, but storage is unconstrained text. Unsupported legacy canonical values must fail scoring explicitly and commit nothing, not silently produce wrong grades.
- Concurrent submit/departure requires transaction locking; one-session database tests alone do not prove this.
- New submissions and saved-result replays must both recheck membership. A successful earlier submission is not continuing authorization.
- No persistent draft is intentional: refresh loses unfinished entries, while final answers/results remain durable.

## Success Criteria (Summary)

- Students see only currently accessible own homework; neither HTML nor network responses disclose canonical answers, verifier data, or other students' work.
- One final submission is durable and retry-safe; blanks count incorrect, exactly half passes, and per-item results match assigned immutable answers.
- Database/API/UI tests, lint/build, existing auth smoke, and recorded keyboard/mobile/concurrency/membership acceptance pass.

## References

- [PRD](../../foundation/prd.md): FR-011 through FR-013 and Business Logic.
- [Roadmap](../../foundation/roadmap.md): S-07; feedback remains S-08.
- [Test plan](../../foundation/test-plan.md): authorization and assignment/scoring risks.
- [S-06 brief](../../archive/2026-10-08-assign-distinct-homework/plan-brief.md): immutable assignment baseline.
