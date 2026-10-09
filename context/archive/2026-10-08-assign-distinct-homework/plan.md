# Assign Distinct Homework Implementation Plan

## Overview

Deliver roadmap slice S-06: a teacher can select current members of one owned class, choose one Grade 4 topic and difficulty, choose one to five exercises, and atomically create a different approved exercise set for every still-enrolled recipient. The change establishes the immutable assignment boundary that S-07 will later use for student access, submission, and scoring.

## Current State Analysis

The shared approved exercise pool already exposes immutable exercise IDs, canonical answers, Grade 4 topic and difficulty metadata, and cross-teacher discovery while denying students. Classes and memberships are durable, but teachers intentionally cannot read membership rows or student identity through existing RLS. There is no roster contract, homework schema, allocation domain service, creation endpoint, or assignment UI.

Complex class mutations already use security-definer PostgreSQL functions to revalidate role, ownership, and current state in one transaction. Teacher-only Astro handlers use dependency-injected authorization and adapters, while pgTAP proves database trust boundaries and Vitest covers domain, handler, and React behavior.

## Desired End State

An authenticated teacher opens an assignment workflow from class management, selects one owned class and any non-empty subset of its current members from an all-preselected email roster, enters an optional title, selects one topic, one difficulty, and an exercise count from one through five, then creates the assignment. The allocator uses the shared approved bucket to produce non-identical combinations while minimizing repeated exercises across recipients.

Creation persists an immutable batch, one recipient snapshot per still-enrolled selected student, and an ordered set of approved exercise references per recipient. If selected members left after the roster loaded, they are excluded and reported; the remaining recipients are assigned successfully. If no selected member remains or the bucket cannot provide enough unique combinations, nothing is created and the response reports the actionable reason. Students receive no assignment or canonical-answer read surface until S-07.

### Key Discoveries:

- `supabase/tests/database/saved_exercise_discovery.sql:154-174` proves the saved pool is shared across teachers while student sessions receive no canonical answers.
- `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql:57-102` stores approved exercises as stable rows with no application update path; assignment references can therefore identify the immutable grading source.
- `supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql:11-31` gives students own-membership reads but deliberately gives teachers no direct roster-table access.
- `supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql:64-125` establishes checked security-definer functions as the atomic boundary for class membership mutations.
- `context/foundation/test-plan.md:52-66` requires assignment count, distinctness, difficulty, and later scoring to use approved immutable state, with domain and database tests as the cheapest trusted layers.
- `src/components/classes/ClassWorkspace.tsx:1-67` is the existing teacher class surface and nearest navigation point for assignment.

## What We're NOT Doing

- Adding student homework lists, exercise opening, answer submission, scoring, pass/fail, teacher review, or feedback; those remain S-07 and S-08.
- Exposing canonical answers, another student's set, roster email, or assignment internals to students.
- Supporting mixed topics, mixed difficulties, grades beyond Grade 4, more than five exercises per student, or manually curated assignment pools.
- Requiring the assigning teacher to reapprove exercises from the shared approved pool.
- Assigning homework retroactively to students who join after creation, or mutating a completed assignment when membership later changes.
- Adding due dates, scheduling, notifications, editing, cancellation, deletion, copying, or assignment-history management.
- Solving a global combinatorial optimum when balancing overlap; the domain contract is non-identical sets with bounded, testable least-reuse prioritization.

## Implementation Approach

Add normalized assignment, recipient, and recipient-exercise tables. The assignment row owns class, teacher, optional title, Grade 4 topic, difficulty, count, idempotency key, and creation time. Recipient rows snapshot the selected account and a canonical set signature; ordered child rows reference approved exercises. Foreign keys preserve the assigned exercise records, unique constraints prevent repeated recipients, positions, exercises within a set, and identical set signatures within one assignment, and direct table privileges remain closed.

Add narrow security-definer functions for the owner-only roster and atomic assignment creation. The roster returns member ID plus normalized sign-in email only when the caller owns the class. Creation accepts an allocation produced by the domain service, revalidates teacher ownership, current membership, approved exercise existence and metadata, count, ordering, distinct set signatures, and idempotency. It omits departed selected members, reports them without email disclosure, rejects an empty remaining selection, and commits all remaining recipient sets or none.

Implement a pure TypeScript allocation service that computes capacity from combinations, rejects insufficient buckets with required and available exercise counts, and produces unique combinations while preferring least-used exercises and lower pairwise overlap. Controlled randomized tie-breaking avoids permanently favoring one saved-pool order while keeping tests deterministic. Typed Astro handlers expose roster and creation contracts; a class-scoped React workflow owns the teacher interaction and reports created and excluded recipient counts.

## Critical Implementation Details

Roster results are advisory: assignment creation must resolve current memberships again inside the transaction. The agreed race behavior is partial by recipient eligibility, not partial persistence: departed students are omitted and reported, while every still-enrolled recipient either receives a complete valid set or the transaction creates nothing. A request idempotency key makes network retries return the same assignment; a deliberate later submission uses a fresh key and creates a new immutable assignment.

## Phase 1: Assignment Persistence and Trust Boundary

### Overview

Create the durable schema, owner-only roster disclosure, atomic assignment operation, and database assertions before any HTTP or UI consumer exists.

### Changes Required:

#### 1. Assignment schema and immutable relationships

**File**: `supabase/migrations/<timestamp>_add_homework_assignments.sql`

**Intent**: Persist the assignment batch and each student's exact ordered exercise set so later scoring can use the originally assigned approved rows rather than the current pool.

**Contract**: Add `homework_assignments`, `homework_recipients`, and `homework_recipient_exercises` with class/teacher/student/exercise foreign keys, nullable trimmed title bounded to 120 characters, Grade 4 topic and difficulty, exercise count constrained to one through five, idempotency ownership, timestamps, ordered positions, and per-assignment set signatures. Enforce one recipient per assignment, one exercise and position per recipient, and one set signature per assignment. Exercise references use restrictive deletion so assigned grading sources cannot disappear. Revoke direct mutation and student read privileges in S-06.

#### 2. Owner-checked roster function

**File**: `supabase/migrations/<timestamp>_add_homework_assignments.sql`

**Intent**: Let a teacher identify current members of an owned class without weakening the existing membership RLS or exposing emails across class boundaries.

**Contract**: Add a stable security-definer roster function accepting class ID and returning only student ID, normalized auth email, and joined timestamp for current members. Require an authenticated teacher who owns the class, order results deterministically, and reveal no role, invitation, token, or other account metadata.

#### 3. Atomic assignment creation function

**File**: `supabase/migrations/<timestamp>_add_homework_assignments.sql`

**Intent**: Make PostgreSQL the final authority for assignment ownership, current recipients, approved bucket membership, complete sets, uniqueness, and retry behavior.

**Contract**: Add a security-definer creation function that accepts class/title/topic/difficulty/count, a request idempotency key, and normalized recipient allocations. Revalidate caller teacher role and class ownership; retain only requested students who are still class members; return excluded student IDs; fail when none remain. Validate every retained set has exactly the requested number of distinct approved exercise IDs from Grade 4 and the selected topic/difficulty, no two retained recipients have the same sorted signature, and all rows commit atomically. A repeat by the same teacher and idempotency key returns the original result without new rows.

#### 4. Database behavior and privacy tests

**File**: `supabase/tests/database/homework_assignments.sql`

**Intent**: Prove the assignment snapshot and roster boundary at the database layer where ownership, membership, and immutable exercise state are authoritative.

**Contract**: Cover owner roster email access, cross-teacher and student denial, shared-pool exercises, one-to-five bounds, optional title normalization, topic/difficulty mismatch, unapproved or missing exercise IDs, duplicate exercises, duplicate sets, current-member filtering, all-departed rejection, mixed valid/departed success, atomic rollback, idempotent retry, conflicting retry payload, student/cross-teacher isolation, and inability to update or delete assigned exercise state.

### Success Criteria:

#### Automated Verification:

- A clean local reset applies the assignment schema and checked functions: `npx supabase db reset`.
- The full pgTAP suite passes assignment ownership, roster privacy, immutable exercise references, membership-race, uniqueness, validation, rollback, and idempotency assertions: `npm run db:test`.

#### Manual Verification:

- Local database inspection confirms only an owning teacher can retrieve roster emails, students cannot read assignment or canonical-answer rows, and one assignment stores complete ordered sets only for still-enrolled recipients.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Allocation and Typed APIs

### Overview

Implement the bounded assignment allocator and publish typed teacher-only roster and creation endpoints backed by the Phase 1 database contracts.

### Changes Required:

#### 1. Homework contracts and validation

**File**: `src/types.ts`, `src/lib/homework/schemas.ts`

**Intent**: Give domain logic, adapters, handlers, and UI one strict vocabulary for roster members, assignment input, successful exclusions, capacity failures, and non-disclosing errors.

**Contract**: Define Grade 4 topic/difficulty, one-to-five count, optional 120-character title, distinct non-empty student IDs, idempotency key, roster summaries, recipient allocations, created assignment summary, excluded student IDs/count, and stable error codes for invalid request, unauthenticated, forbidden, class unavailable, empty eligible roster, insufficient pool, database unavailable, and persistence failure. Browser responses never contain canonical answers or another recipient's exercise IDs.

#### 2. Balanced distinct-set allocator

**File**: `src/lib/homework/allocate-distinct-sets.ts`, `src/lib/homework/allocate-distinct-sets.test.ts`

**Intent**: Separate fairness and capacity behavior from HTTP and persistence so the high-risk combinatorial rules are deterministic and mutation-testable.

**Contract**: Accept stable approved exercise IDs, distinct recipient IDs, count, and an injectable random source. Capacity is valid only when `C(available, count)` covers eligible recipients. Return exactly one count-sized set per recipient, no repeated exercise within a set, no identical sorted set signatures, and balanced reuse that prioritizes the lowest current usage and then lower pairwise overlap, using randomness only for equal choices. Return the minimum required exercise-pool size and available size on insufficiency without partial allocations.

#### 3. Assignment data adapters

**File**: `src/lib/services/homework-assignments.ts`

**Intent**: Keep Supabase row and RPC details out of route handlers while preserving typed failure categories and the controlled allocation boundary.

**Contract**: Add adapters to load the owner roster, load all approved IDs for one Grade 4 topic/difficulty bucket, allocate sets, and call atomic creation. Validate database rows before mapping, preserve the request idempotency key, and translate expected SQL states without returning raw database messages.

#### 4. Roster and assignment handlers

**File**: `src/pages/api/classes/[classId]/members.ts`, `src/pages/api/homework/assign.ts`

**Intent**: Expose protected teacher operations with the repository's authorization, dependency injection, strict validation, and Polish error conventions.

**Contract**: Add non-prerendered owner-roster `GET` and assignment `POST` handlers. Validate path/body before protected work where applicable, use `authorizeTeacher`, call the adapters, validate all outputs, return created assignment ID/title/time plus assigned and excluded counts/IDs, and map capacity failures to required/available counts. Do not expose roster emails in the creation response, canonical answers, set contents, SQL details, or class ownership facts to unauthorized callers.

#### 5. Domain and handler tests

**File**: `src/lib/homework/allocate-distinct-sets.test.ts`, `src/pages/api/classes/[classId]/members.test.ts`, `src/pages/api/homework/assign.test.ts`

**Intent**: Lock the exact allocation and HTTP contracts without treating mocks as proof of database authorization.

**Contract**: Use small boundary fixtures where different interpretations diverge: two students/two-of-four permits overlap but forbids identical combinations; insufficient `C(n,k)` creates no allocation; five-of-five supports one recipient only; balancing spreads least-used exercises before increasing reuse. Cover malformed and duplicate inputs, all authorization states, owner and persistence failures, excluded-member success, all-excluded failure, idempotency forwarding, privacy-safe errors, malformed adapter output, and skipped protected work.

### Success Criteria:

#### Automated Verification:

- Focused allocator and homework handler tests pass capacity, non-identical-set, minimum-overlap, deterministic-randomness, authorization, exclusion, idempotency, and privacy cases: `npm test -- src/lib/homework src/pages/api/homework src/pages/api/classes`.
- Type-aware lint passes for the new contracts, services, and handlers: `npm run lint`.

#### Manual Verification:

- Controlled API calls show an owner-only email roster, actionable required/available pool counts, one successful immutable assignment summary, and departed-recipient reporting without canonical answers or roster emails in the creation response.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Teacher Assignment Workflow

### Overview

Add the class-scoped Polish UI that selects recipients and assignment parameters, confirms the operation, and reports complete success or membership exclusions.

### Changes Required:

#### 1. Assignment route and class entry point

**File**: `src/pages/classes/[classId]/assign.astro`, `src/components/classes/ClassWorkspace.tsx`, `src/pages/dashboard.astro`

**Intent**: Make assignment discoverable from an owned class while retaining the existing server-rendered teacher boundary and role-scoped visual language.

**Contract**: Add a protected class assignment page and an `Assign homework` command on each teacher-owned class. The route passes only the class ID into the hydrated workflow; API ownership checks remain authoritative. Keep dashboard navigation consistent without adding an assignment-history surface.

#### 2. Assignment workflow controller

**File**: `src/components/homework/HomeworkAssignmentForm.tsx`

**Intent**: Orchestrate roster loading, all-preselected recipients, optional title, topic/difficulty/count choices, confirmation, idempotent submission, and recoverable results.

**Contract**: Load the roster once per class, preselect every member, allow individual deselection, require at least one selected member, trim an optional title to at most 120 characters, and constrain count to one through five. Show a review summary before creation. Generate one idempotency key per user-confirmed attempt and retain it across transport retries; changing inputs after a settled response starts a fresh attempt. On success show assigned and excluded counts, identify excluded selections from the already-loaded owner roster, and do not silently reselect or mutate the completed assignment.

#### 3. Assignment view and operational states

**File**: `src/components/homework/HomeworkAssignmentView.tsx`

**Intent**: Present a compact classroom workflow with accessible bulk selection and actionable capacity or roster-change feedback.

**Contract**: Render loading, empty roster, editable, review, submitting, success, success-with-exclusions, insufficient-pool, authorization, and retryable-failure states. Use semantic checkbox, select, input, button, alert, and badge components; provide select-all/clear commands, stable control dimensions, visible focus, live status, and Polish copy. Capacity errors show requested count, current recipient count, minimum required exercises, and available exercises; they never auto-reduce the chosen count or permit duplicate sets.

#### 4. Component behavior tests

**File**: `src/components/homework/HomeworkAssignmentForm.test.tsx`

**Intent**: Protect the teacher-visible recipient, confirmation, retry, exclusion, and recovery behavior independently from database fixtures.

**Contract**: Cover all-preselected roster, deselection and bulk controls, empty roster, one-to-five bounds, optional title, topic/difficulty payload, review-before-submit, one active request, retry with the same idempotency key, changed-input fresh key, insufficient-pool details, successful counts, departed-member labels, all-excluded error, generic failures, sensitive-value absence, keyboard operation, and focus movement after results.

### Success Criteria:

#### Automated Verification:

- Homework component tests pass roster selection, review, payload, idempotent retry, capacity, exclusion, error, accessibility, and focus cases: `npm test -- src/components/homework`.
- The full application suite, type-aware lint, Astro checks, and production SSR build pass after the route and navigation are wired: `npm test && npm run lint && npx astro check && npm run build`.

#### Manual Verification:

- At desktop and mobile widths, a teacher can assign from an owned class with all members initially selected, review the exact parameters, recover from a pool shortage, and see successful assigned/excluded counts with no overlap, clipping, stale selection, or inaccessible control.
- A controlled membership race confirms a departed selected student is omitted and identified to the owner while every remaining selected member receives a complete set.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Integrated Verification

### Overview

Exercise the complete server-backed teacher flow and retain evidence for allocation fairness, privacy, migration safety, and responsive usability.

### Changes Required:

#### 1. Configured assignment smoke flow

**File**: `scripts/smoke.mjs`, `.github/workflows/ci.yml`

**Intent**: Extend the existing opt-in local-Supabase smoke path with one deterministic teacher assignment without provider or email calls.

**Contract**: Gate assignment checks behind explicit configuration, use controlled local accounts/class/members/approved exercises, verify anonymous and student denial, owner roster access, successful assignment counts, non-identical persisted sets, idempotent retry, and no canonical answers in HTTP responses. Keep loopback/service-role cleanup protections and delete generated accounts so related rows cascade after the run. Wire the configured path into CI only where local Supabase is already available.

#### 2. Verification record

**File**: `context/changes/assign-distinct-homework/manual-verification.md`

**Intent**: Record the environments and observed results needed for implementation review without retaining real emails, credentials, class codes, or assignment payloads.

**Contract**: Record shared-pool use, all-preselected and subset recipients, one-to-five counts, non-identical/minimum-overlap sets, insufficient capacity, optional title, idempotent retry, mixed departed-member success, all-departed failure, cross-teacher/student denial, no canonical-answer leakage, and desktop/mobile accessibility checks.

### Success Criteria:

#### Automated Verification:

- The complete database and application suites pass from a clean schema: `npx supabase db reset && npm run db:test && npm test`.
- Repository lint, Astro checks, and production build pass: `npm run lint && npx astro check && npm run build`.
- The configured production-preview smoke flow passes assignment authorization, roster, creation, distinctness, retry, privacy, and cleanup checks: `$env:SMOKE_CLASS_CHECKS='true'; $env:SMOKE_HOMEWORK_CHECKS='true'; npm run smoke`.

#### Manual Verification:

- The verification record confirms the complete teacher workflow, minimum-overlap distinct sets, actionable shortage handling, departed-member exclusion, privacy boundaries, and responsive keyboard-accessible UI while retaining S-07 student behavior as out of scope.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before implementation review.

---

## Testing Strategy

### Unit Tests:

- Use a pure allocator with an injectable random source and independent expected combinations for capacity, non-identical signatures, least-use balancing, pairwise-overlap tie-breaking, and one-to-five boundaries.
- Test strict Zod contracts, SQL-state translation, privacy-safe error envelopes, idempotency forwarding, and malformed adapter results.
- Drive the React controller through roster, review, submit, retry, capacity, exclusion, and accessibility states with mocked HTTP boundaries.
- Narrow Stryker to the allocator and capacity helpers because Risk #6 identifies distinct assignment as business-critical; review surviving mutants rather than chasing a score target.

### Integration Tests:

- Use pgTAP with two teachers, current and departed students, tied/shared approved exercises, and authenticated JWT claims to prove roster disclosure, ownership, set integrity, idempotency, transaction rollback, and isolation.
- Use handler tests for request validation, teacher authorization, skipped work, response mapping, and sensitive-value absence; do not treat injected dependencies as RLS proof.
- Use the configured smoke flow for Astro session, authenticated Supabase RPC, persisted set, and cleanup composition without live generation or invitation delivery.

### Manual Testing Steps:

1. Sign in as a teacher, open an owned class, and confirm the roster shows current member emails with all selected.
2. Assign one through five exercises from a shared approved Grade 4 topic/difficulty bucket and inspect the confirmation and optional-title behavior.
3. Assign to enough recipients to require overlap and confirm every combination differs while reuse remains balanced.
4. Trigger insufficient capacity and confirm required/available counts appear without creating assignment rows or changing the chosen count.
5. Remove one selected membership after roster load, submit, and confirm the departed student is excluded and identified while remaining sets commit completely.
6. Retry a timed-out request with the same idempotency key, then deliberately submit the same parameters again with a new key; confirm one retry result and two intentional assignments.
7. Verify another teacher and a student cannot read the roster or invoke creation, and no assignment response exposes canonical answers or another student's set.
8. Repeat the workflow at desktop and mobile widths using keyboard-only interaction and confirm focus, live feedback, wrapping, and stable layout.

## Performance Considerations

Fetch only IDs and metadata required for allocation, and keep creation bounded by selected recipients times the maximum five exercises. Capacity uses a capped combinatorial comparison rather than materializing all combinations. The balancing algorithm must avoid enumerating the complete combination space; use bounded candidate generation while preserving the unique-signature and least-reuse invariants. Add indexes for assignment owner/class chronology, recipient student lookup, idempotency, and child ordering only where the planned reads require them.

## Migration Notes

The forward-only migration creates empty assignment tables and checked functions; no historical data can be backfilled because S-06 did not previously exist. Existing exercise, class, invitation, and membership rows remain unchanged. Restrictive exercise references intentionally prevent deleting an approved exercise after assignment. A code rollback may leave unused assignment tables/functions safely in place; production schema corrections use a later migration rather than editing the applied file.

## References

- Product requirements: `context/foundation/prd.md:40-53`, `context/foundation/prd.md:84-92`, `context/foundation/prd.md:102-119`.
- Roadmap slice: `context/foundation/roadmap.md:153-165`.
- Assignment risk strategy: `context/foundation/test-plan.md:44-66`, `context/foundation/test-plan.md:78-89`.
- Shared approved pool and RLS: `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql`, `supabase/migrations/20261002120000_add_saved_exercise_discovery.sql`.
- Membership and checked-function pattern: `supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql`.
- Saved-pool implementation precedent: `context/archive/2026-10-01-reuse-saved-exercises/plan.md`.
- Class membership implementation precedent: `context/archive/2026-10-05-join-teacher-managed-class/plan.md`.
- Teacher handler pattern: `src/pages/api/classes/list.ts`, `src/pages/api/exercises/saved.ts`.
- Teacher UI entry points: `src/components/classes/ClassWorkspace.tsx`, `src/components/exercises/SavedExerciseBrowser.tsx`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Assignment Persistence and Trust Boundary

#### Automated

- [x] 1.1 A clean local reset applies the assignment schema and checked functions: `npx supabase db reset`. — 07d265c
- [x] 1.2 The full pgTAP suite passes assignment ownership, roster privacy, immutable exercise references, membership-race, uniqueness, validation, rollback, and idempotency assertions: `npm run db:test`. — 07d265c

#### Manual

- [x] 1.3 Local database inspection confirms only an owning teacher can retrieve roster emails, students cannot read assignment or canonical-answer rows, and one assignment stores complete ordered sets only for still-enrolled recipients. — 07d265c

### Phase 2: Allocation and Typed APIs

#### Automated

- [x] 2.1 Focused allocator and homework handler tests pass capacity, non-identical-set, minimum-overlap, deterministic-randomness, authorization, exclusion, idempotency, and privacy cases: `npm test -- src/lib/homework src/pages/api/homework src/pages/api/classes`. — ef40629
- [x] 2.2 Type-aware lint passes for the new contracts, services, and handlers: `npm run lint`. — ef40629

#### Manual

- [x] 2.3 Controlled API calls show an owner-only email roster, actionable required/available pool counts, one successful immutable assignment summary, and departed-recipient reporting without canonical answers or roster emails in the creation response. — ef40629

### Phase 3: Teacher Assignment Workflow

#### Automated

- [x] 3.1 Homework component tests pass roster selection, review, payload, idempotent retry, capacity, exclusion, error, accessibility, and focus cases: `npm test -- src/components/homework`. — e0e4df3
- [x] 3.2 The full application suite, type-aware lint, Astro checks, and production SSR build pass after the route and navigation are wired: `npm test && npm run lint && npx astro check && npm run build`. — e0e4df3

#### Manual

- [x] 3.3 At desktop and mobile widths, a teacher can assign from an owned class with all members initially selected, review the exact parameters, recover from a pool shortage, and see successful assigned/excluded counts with no overlap, clipping, stale selection, or inaccessible control. — e0e4df3
- [x] 3.4 A controlled membership race confirms a departed selected student is omitted and identified to the owner while every remaining selected member receives a complete set. — e0e4df3

### Phase 4: Integrated Verification

#### Automated

- [x] 4.1 The complete database and application suites pass from a clean schema: `npx supabase db reset && npm run db:test && npm test`. — 12c738b
- [x] 4.2 Repository lint, Astro checks, and production build pass: `npm run lint && npx astro check && npm run build`. — 12c738b
- [x] 4.3 The configured production-preview smoke flow passes assignment authorization, roster, creation, distinctness, retry, privacy, and cleanup checks: `$env:SMOKE_CLASS_CHECKS='true'; $env:SMOKE_HOMEWORK_CHECKS='true'; npm run smoke`. — 12c738b

#### Manual

- [x] 4.4 The verification record confirms the complete teacher workflow, minimum-overlap distinct sets, actionable shortage handling, departed-member exclusion, privacy boundaries, and responsive keyboard-accessible UI while retaining S-07 student behavior as out of scope.
