# Assign Distinct Homework - Plan Brief

> Full plan: `context/changes/assign-distinct-homework/plan.md`

## What & Why

Build roadmap slice S-06 so a teacher can choose current members of one class, select one Grade 4 topic and difficulty plus one to five exercises, and create a different approved set for every recipient. This establishes the immutable assignment source that later submission and scoring work can trust.

## Starting Point

The application already has a shared teacher-readable pool of immutable approved exercises, teacher-owned classes, and durable student memberships. It has no owner roster, assignment persistence, allocation logic, creation API, or teacher assignment workflow; students are correctly denied pool answers and teachers are currently denied direct membership reads.

## Desired End State

From an owned class, the teacher sees current member emails with everyone initially selected, can deselect recipients, add an optional title, select topic, difficulty, and count, review the request, and create the assignment. Every still-enrolled recipient receives a complete non-identical set with exercise reuse minimized; pool shortages create nothing and report required versus available exercises, while departed selected members are excluded and reported without blocking eligible recipients.

## Key Decisions Made

| Decision            | Choice                                                                        | Why                                                                                     |
| ------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Distinctness        | No two recipients share an identical exercise combination; overlap is allowed | Preserves genuinely different homework without requiring `students * count` exercises.  |
| Fairness            | Prefer least-used exercises and lower pairwise overlap                        | Produces the greatest practical variation from a modest shared pool.                    |
| Bucket              | One Grade 4 topic and one difficulty                                          | Matches current metadata and the PRD's single difficulty bucket.                        |
| Exercise source     | Shared approved pool                                                          | Reuses the shipped S-03 cross-teacher discovery contract and improves capacity.         |
| Recipients          | Current class roster checklist, all preselected                               | Makes whole-class assignment fast while retaining subset control.                       |
| Roster identity     | Normalized account email visible only to the owning teacher                   | Works for invitation and code joins without new student profile setup.                  |
| Exercise count      | One through five per recipient                                                | Matches existing generation and approval batch bounds.                                  |
| Pool shortage       | Block the entire operation and show minimum required versus available         | Preserves count and distinctness without silent degradation.                            |
| Assignment identity | Optional title plus class and creation time                                   | Keeps quick assignment lightweight while supporting later lists.                        |
| Late joiners        | No retroactive assignment                                                     | Keeps the reviewed recipient snapshot immutable.                                        |
| Departed recipients | Exclude them, report them, and assign all remaining eligible recipients       | Honors the latest membership boundary without discarding valid recipients.              |
| Retry               | Same idempotency key returns the original assignment                          | Prevents duplicate homework after transport failure while allowing intentional repeats. |

## Scope

**In scope:** normalized immutable assignment persistence; owner-only roster email disclosure; minimum-overlap unique-set allocation; atomic creation and idempotency; typed roster/creation APIs; Polish class-scoped teacher workflow; pgTAP, Vitest, smoke, responsive, and accessibility verification.

**Out of scope:** student homework access, submissions, scoring, results, feedback, mixed buckets, manual exercise picking, due dates, scheduling, notifications, editing, deletion, retroactive assignment, and assignment history.

## Architecture / Approach

The teacher UI loads a narrow owner-checked roster and submits assignment parameters to a protected Astro endpoint. A pure TypeScript service validates combinatorial capacity and builds unique, balanced exercise sets from shared approved IDs. One security-definer PostgreSQL function revalidates teacher ownership, current memberships, exercise metadata, count, set signatures, and idempotency before atomically writing assignment, recipient, and ordered exercise rows. Direct student reads remain closed until S-07 adds an answer-safe contract.

## Phases at a Glance

| Phase                             | What it delivers                                                               | Key risk                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1. Persistence and trust boundary | Schema, roster function, atomic creation RPC, and pgTAP proof                  | Ownership, privacy, or membership races corrupt the snapshot.   |
| 2. Allocation and typed APIs      | Balanced allocator, DTOs, adapters, handlers, and focused tests                | Sets repeat, capacity is wrong, or errors leak protected state. |
| 3. Teacher workflow               | Class entry point, all-preselected roster, review, creation, and result states | The UI submits stale recipients or hides a shortage/exclusion.  |
| 4. Integrated verification        | Clean-schema suites, build, configured smoke, and manual record                | Individual layers pass while the full authenticated flow fails. |

**Prerequisites:** Completed S-02 approved exercise persistence and S-05 class membership; local Supabase for database and smoke verification.
**Estimated effort:** Approximately 4 implementation sessions across 4 phases.

## Open Risks & Assumptions

- "Minimize overlap" is implemented as bounded least-reuse and pairwise-overlap prioritization, not an expensive proof of the global optimum.
- Student emails are personal data; only the owning teacher's checked roster function and roster response may expose them.
- Exercise foreign keys must prevent an assigned approved row from being deleted, because later scoring depends on that immutable row.
- S-07 must add a student read boundary that returns assigned exercise text without canonical answers or classmates' sets.

## Success Criteria (Summary)

- Every still-enrolled selected student receives exactly the chosen count from one shared approved Grade 4 topic/difficulty bucket, and no two recipients receive the same combination.
- Insufficient capacity creates no rows and reports required/available counts; departed selected students are excluded and identified while eligible recipients commit atomically.
- Database, domain, API, UI, build, smoke, privacy, responsive, and keyboard-accessibility checks pass without exposing canonical answers or cross-class roster data.
