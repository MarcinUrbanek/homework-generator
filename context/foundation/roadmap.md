---
project: "Homework generator"
version: 1
status: draft
created: 2026-09-21
updated: 2026-09-23
prd_version: 1
main_goal: market-feedback
top_blocker: time
milestone_id: first-verified-homework-flow
milestone_seq: 1
milestone_status: open
---

# Roadmap: Homework generator

> Derived from `context/foundation/prd.md` (v1) and an auto-researched, user-confirmed codebase baseline.
> Edit in place; archive when superseded.
> Items below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: First verified homework flow** — Status: open

- **Intent:** Prove that a teacher can build a trustworthy pool of Polish math exercises and carry it through a distinct homework assignment, automatic scoring, and review.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** US-01 and FR-001 through FR-013.

## Vision recap

Primary-school classroom math teachers in Poland need many distinct exercises at comparable difficulty, but producing variants and checking answers consumes substantial effort. The product should let a teacher prepare an approved exercise pool and use it to assign distinct homework that is scored consistently while keeping every student's data isolated.

## North star

**S-02: Teacher verifies, approves, and saves the first exercise pool** — This is the earliest slice that tests whether generated exercises can become trustworthy, reusable teaching material and provide real market feedback.

> "North star" means the smallest end-to-end capability whose delivery proves the central product idea; it is placed as early as its prerequisites allow.

## At a glance

| ID   | Change ID                     | Outcome (user can ...)                                                                                                   | Prerequisites | PRD refs                      | Status   |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------- | ----------------------------- | -------- |
| F-01 | verified-exercise-persistence | (foundation) approved exercises and their answer, grade, topic, and difficulty evidence can be stored and checked safely | —             | FR-006, FR-008, FR-009        | done |
| S-01 | request-polish-exercises      | teacher can choose a supported grade, topic, and difficulty and receive Polish exercise candidates                       | —             | FR-004, FR-005, FR-007        | ready    |
| S-02 | approve-first-exercise-pool   | teacher can verify a batch, approve valid exercises, and save the first exercise pool                                    | F-01, S-01    | FR-006, FR-007, FR-008        | proposed |
| S-03 | reuse-saved-exercises         | teacher can find and reuse approved exercises by grade and topic                                                         | S-02          | FR-009                        | proposed |
| S-04 | invite-students-to-class      | teacher can sign in, create a class, and invite students by email                                                        | —             | FR-001, FR-002                | blocked  |
| S-05 | join-teacher-managed-class    | student can sign in and join a class through a code or direct invitation link                                            | S-04          | FR-001, FR-003                | proposed |
| S-06 | assign-distinct-homework      | teacher can choose an exercise count and assign each selected student a distinct set from one approved difficulty bucket | S-02, S-05    | US-01, FR-010                 | proposed |
| S-07 | submit-and-score-homework     | student can open homework, submit answers, and immediately see pass or fail from the defined score rule                  | S-06          | US-01, FR-011, FR-012, FR-013 | proposed |
| S-08 | review-submission-feedback    | teacher can review submitted answers and provide feedback that the student can later view                                | S-07          | US-01, FR-013                 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                    | Chain                                      | Note                                                                |
| ------ | ------------------------ | ------------------------------------------ | ------------------------------------------------------------------- |
| A      | Generation request       | `S-01`                                     | Starts the shortest route to early market feedback.                 |
| B      | Exercise trust and reuse | `F-01` → `S-02` → `S-03`                   | Joins Stream A at `S-02` to validate the first approved pool.       |
| C      | Class-to-result flow     | `S-04` → `S-05` → `S-06` → `S-07` → `S-08` | Joins Stream B at `S-06` after trustworthy exercises are available. |

## Baseline

What's already in place in the codebase as of `2026-09-21` (auto-researched and user-confirmed). Foundations below assume present capabilities are not re-scaffolded.

- **Frontend:** present — Astro and React page/component scaffold, per `context/foundation/tech-stack.md` and `src/pages/`.
- **Backend / API:** present — server rendering and authentication request handlers, per `context/foundation/tech-stack.md` and `src/pages/api/auth/`.
- **Data:** partial — Supabase/PostgreSQL is selected, but no domain migrations exist under `supabase/migrations/`.
- **Auth:** present — Supabase sessions, authentication endpoints, and route middleware exist under `src/lib/supabase.ts`, `src/pages/api/auth/`, and `src/middleware.ts`.
- **Deploy / infra:** present — Cloudflare Workers deployment and GitHub Actions CI are configured, per `context/foundation/tech-stack.md`.
- **Observability:** partial — native Cloudflare observability is enabled in `wrangler.jsonc`; application logging and error tracking are absent.

## Foundations

### F-01: Verifiable approved-exercise persistence

- **Outcome:** (foundation) approved exercises and their answer, grade, topic, and difficulty evidence can be stored and checked safely.
- **Change ID:** verified-exercise-persistence
- **PRD refs:** FR-006, FR-008, FR-009
- **Unlocks:** S-02 and S-03; provides the verification path for answer uniqueness and approved-pool persistence.
- **Prerequisites:** —
- **Parallel with:** S-01, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Keep this contract limited to evidence needed by the first approved pool; completing the wider data model here would delay user feedback.
- **Status:** done

## Slices

### S-01: Request Polish exercise candidates

- **Outcome:** teacher can choose a supported grade, topic, and difficulty and receive Polish exercise candidates.
- **Change ID:** request-polish-exercises
- **PRD refs:** FR-004, FR-005, FR-007
- **Prerequisites:** —
- **Parallel with:** F-01, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Generation may produce plausible wording without comparable difficulty, so candidates remain unapproved until S-02.
- **Status:** ready

### S-02: Approve the first exercise pool

- **Outcome:** teacher can verify a batch, approve valid exercises, and save the first exercise pool.
- **Change ID:** approve-first-exercise-pool
- **PRD refs:** FR-006, FR-007, FR-008
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Automated answer verification can create false confidence; teacher approval remains the final gate before reuse or assignment.
- **Status:** proposed

### S-03: Reuse saved exercises

- **Outcome:** teacher can find and reuse approved exercises by grade and topic.
- **Change ID:** reuse-saved-exercises
- **PRD refs:** FR-009
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Reuse is sequenced after the first approved pool so discovery behavior is shaped by real saved content rather than assumptions.
- **Status:** proposed

### S-04: Invite students to a class

- **Outcome:** teacher can sign in, create a class, and invite students by email.
- **Change ID:** invite-students-to-class
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** —
- **Parallel with:** F-01, S-01, S-02, S-03
- **Blockers:** —
- **Unknowns:**
  - What happens when an unauthenticated visitor opens a protected route? — Owner: user. Block: yes.
- **Risk:** Planning protected class routes before their unauthenticated behavior is decided would lock in an unstated product rule.
- **Status:** blocked

### S-05: Join a teacher-managed class

- **Outcome:** student can sign in and join a class through a code or direct invitation link.
- **Change ID:** join-teacher-managed-class
- **PRD refs:** FR-001, FR-003
- **Prerequisites:** S-04
- **Parallel with:** F-01, S-01, S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The join path must remain usable for younger students while preserving account and class boundaries.
- **Status:** proposed

### S-06: Assign distinct homework

- **Outcome:** teacher can choose an exercise count and assign each selected student a distinct set from one approved difficulty bucket.
- **Change ID:** assign-distinct-homework
- **PRD refs:** US-01, FR-010
- **Prerequisites:** S-02, S-05
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Distinct sets can become unfair if difficulty evidence is not applied consistently, so assignment follows approval and class membership.
- **Status:** proposed

### S-07: Submit and score homework

- **Outcome:** student can open homework, submit answers, and immediately see pass or fail from the defined score rule.
- **Change ID:** submit-and-score-homework
- **PRD refs:** US-01, FR-011, FR-012, FR-013
- **Prerequisites:** S-06
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Immediate results are only trustworthy when scoring uses the immutable valid answers from approved assigned exercises.
- **Status:** proposed

### S-08: Review submission feedback

- **Outcome:** teacher can review submitted answers and provide feedback that the student can later view.
- **Change ID:** review-submission-feedback
- **PRD refs:** US-01, FR-013
- **Prerequisites:** S-07
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Feedback must remain isolated to the intended student, so this follows the exercised submission and result-access path.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                     | Suggested issue title                              | Ready for `/10x-plan` | Notes                                   |
| ---------- | ----------------------------- | -------------------------------------------------- | --------------------- | --------------------------------------- |
| F-01       | verified-exercise-persistence | Establish verifiable approved-exercise persistence | yes                   | Unlocks north-star slice S-02.          |
| S-01       | request-polish-exercises      | Let teachers request Polish exercise candidates    | yes                   | Can proceed in parallel with F-01.      |
| S-02       | approve-first-exercise-pool   | Approve and save the first exercise pool           | no                    | Requires F-01 and S-01.                 |
| S-03       | reuse-saved-exercises         | Find and reuse approved exercises                  | no                    | Requires S-02.                          |
| S-04       | invite-students-to-class      | Create a class and invite students                 | no                    | Resolve protected-route behavior first. |
| S-05       | join-teacher-managed-class    | Join a class by code or invitation                 | no                    | Requires S-04.                          |
| S-06       | assign-distinct-homework      | Assign distinct homework sets                      | no                    | Requires S-02 and S-05.                 |
| S-07       | submit-and-score-homework     | Submit homework and release pass or fail           | no                    | Requires S-06.                          |
| S-08       | review-submission-feedback    | Review answers and provide student feedback        | no                    | Requires S-07.                          |

## Open Roadmap Questions

1. **What happens when an unauthenticated visitor opens a protected route?** — Owner: user. Block: S-04, S-05, S-06, S-07, S-08.

## Parked

- **Complete Polish primary-school mathematics curriculum** — Why parked: the PRD's Non-Goals limit the first release to selected grades and topics so the end-to-end flow can be proven first.

## Milestone History

## Done
- **F-01: (foundation) approved exercises and their answer, grade, topic, and difficulty evidence can be stored and checked safely** — Archived 2026-09-23 → `context/archive/2026-09-23-verified-exercise-persistence/`. Lesson: —.
