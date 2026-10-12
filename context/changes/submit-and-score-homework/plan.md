# Submit and Score Homework Implementation Plan

## Overview

Deliver roadmap S-07: students open their assigned homework, submit one final set of answers, and immediately see pass/fail plus per-exercise correctness. Scoring uses immutable assigned approved exercises, with correct answers divided by all assigned exercises and a passing threshold of at least 50%.

Planning approved on 2026-10-09: MEDIUM complexity, seven substantive questions, and three implementation phases. This document authorizes the implementation specification, not implementation during the planning session.

## Current State Analysis

S-06 persists assignment metadata, student recipient rows, and ordered exercise references. Student reads are deliberately closed; there are no submission tables or student homework pages. Approved exercises supply the authoritative answer, while the dashboard currently presents teacher tools to all signed-in users.

### Key Discoveries:

- Assignment tables, recipient uniqueness, ordered exercise keys, and restrictive grants: `supabase/migrations/20261008120000_add_homework_assignments.sql:1-71`.
- Recipient exercises use `(recipient_id, position)` as their primary key, not a standalone exercise-instance UUID; exercise deletion is restricted by the approved-exercise foreign key.
- Stable assignment retries already preserve the original recipient snapshot: `supabase/migrations/20261009083500_make_homework_assignment_retries_membership_stable.sql:405`.
- Approved canonical answers are stored as text, not a database-enforced natural-number type: `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql:44`.
- Approval copies the independent verified answer into the approved pool: `supabase/migrations/20260929120000_add_exercise_verification_approval.sql:58`.
- Existing normalization supports numbers but also extracts a number from prose; the latter is not allowed for student input: `src/lib/exercises/answer-normalization.ts:1-45`.
- Current verifier output requests plain natural numbers and canonicalizes returned answers: `src/lib/services/openrouter-exercise-verifier.ts:9`, `:106`.
- Existing assignment DTOs, schemas, services, handlers, and form provide the integration pattern: `src/types.ts:151`, `src/lib/homework/schemas.ts:1`, `src/lib/services/homework-assignments.ts:100`, `src/pages/api/homework/assign.ts:1`, `src/components/homework/HomeworkAssignmentForm.tsx:1`.
- Teacher authorization is explicit rather than an authenticated/not-teacher shortcut: `src/lib/services/teacher-authorization.ts:3`. Joining can grant a student role without removing a teacher role.
- Protected route registration and dashboard navigation need extension: `src/middleware.ts:4`, `src/pages/dashboard.astro:6`, `src/components/Topbar.astro:1`.
- Test-plan risks #1 and #6 require persisted ownership denials and scoring from assigned immutable state. New gates and wider critical-flow automation remain deferred to the test-plan rollout.

## Desired End State

A student reaches a dedicated homework list from a role-aware dashboard. Pending homework appears first, then submitted homework; each group sorts by assignment creation time descending, with assignment UUID as a deterministic tie-breaker. Each entry identifies the class, optional assignment title, creation time, exercise count, and status. An empty list explains that no accessible homework exists.

Homework detail displays only that student's exercises, in assigned position order. Before submission, the student can enter natural-number answers or leave any/all answers blank. Confirmation states that submission is final and identifies how many blanks will be graded incorrect. Entries survive validation and transport failures on the current page, but not navigation or refresh.

After submission, answers are read-only and the page shows pass/fail, correct count out of assigned count, and correctness for every exercise, including unanswered ones. Neither pre-submission nor result responses include canonical answers, verifier evidence, classmates' data, or roster emails. Refresh restores the persisted final result.

Access always requires authentication, ownership of the recipient record, and current membership in the assignment's class. Departure hides pending and submitted homework and denies detail, submission, result, and replay requests. A dual-role account may use its own student allocation and its existing teacher tools; teacher status alone grants no student homework access.

## What We're NOT Doing

- Teacher submission review, feedback, answer-key disclosure, or teacher result dashboards; these remain S-08.
- Repeat attempts, editing final answers, reopening submissions, or grading by latest attempt.
- Server/browser draft storage, autosave, cross-device drafts, or restoring unfinished work after refresh.
- Due dates, expiry, notifications, assignment editing/deletion, retroactive assignments, or mixed buckets.
- Free-text/prose answer extraction, units, negative numbers, fractions, decimals, or extending the exercise curriculum.
- New CI pipelines, hook configuration, test-framework dependencies, or the deferred full-flow smoke/e2e rollout.
- Altering the passing threshold, using answered exercises as the denominator, or broadening assignment/pool table grants.

## Implementation Approach

Add narrow security-definer PostgreSQL read and submit functions using the authenticated user's Supabase session. Keep canonical answers behind the database boundary. The database validates the complete positional answer shape, normalizes accepted numbers as strings, scores against assigned approved answers, and commits submission, individual answers, and result in one transaction.

Use one final submission per recipient as the idempotency boundary. An equivalent positional answer vector returns the existing result; a different vector returns an explicit already-submitted conflict without changing data. Equivalent means normalized numeric answers and blank values match, independent of payload order or number formatting. Membership is checked before returning either a new result or a replay.

The service/API layer validates input and RPC outputs, translates failures using existing Polish error conventions, and never computes or accepts authoritative correctness. Astro supplies protected SSR list/detail shells; a React island owns answer entry, confirmation, submission, and final result. Preserve existing teacher tools and class-join navigation while making the dashboard role-aware.

## Critical Implementation Details

### Timing and trust boundary

Serialize competing submissions on the recipient row and hold the current membership row against deletion through the transaction. Recheck access before reading a saved submission; idempotency never bypasses revoked membership. If departure commits first, submission is denied; if a valid submission locks membership first, it may finish before departure, but later result reads are denied.

### Answer compatibility

Do not reuse the verifier's prose-extraction behavior for student input or convert answers through JavaScript floating-point numbers. Persisted answers are text and may contain unsupported legacy values; an assigned canonical answer that cannot be interpreted as a supported natural number must produce an explicit scoring-unavailable failure with no submission committed, not mark every student answer wrong or guess an answer.

## Phase 1: Persistence and scoring boundary

### Overview

Establish private final-submission storage and caller-scoped homework reads, with atomic database-authoritative scoring and pgTAP protection.

### Changes Required:

#### 1. Submission storage and functions

**File**: new `supabase/migrations/YYYYMMDDHHmmss_add_homework_submissions.sql`

**Intent**: Persist final answers and results without exposing answer authority or classmates' records. Reuse the immutable assignment/recipient/exercise schema rather than copy the current pool into a new allocation model.

**Contract**: Add `homework_submissions` keyed uniquely by `recipient_id`, with submission ID/time, correct count, assigned count, and passed status; add `homework_submission_answers` tied to the submission and the matching `(recipient_id, position)` assigned exercise, preserving submitted text, normalized answer or blank, and correctness. Enforce answer/submission/recipient consistency through foreign keys and constraints. Enable RLS and revoke direct `public`, `anon`, and `authenticated` access; session-authenticated RPCs are the granular read/create surface, with no client update/delete surface.

**Contract**: Provide `list_student_homework()`, `get_student_homework(p_assignment_id uuid)`, and `submit_student_homework(p_assignment_id uuid, p_answers jsonb)`. All use a fixed safe search path, restricted execute grants, `auth.uid()`, recipient ownership, and current class membership. Reads return only allowlisted class/assignment metadata, own ordered prompts, and own final answers/results when present. Unknown, foreign, and departed-class assignment IDs share one unavailable outcome.

**Contract**: Submit accepts exactly one `{position, answer}` item per assigned position, with answer string or null. Null/empty/whitespace-only is blank; omitted, duplicate, unknown, or extra positions and client score/correctness fields are invalid. Enforce a 200-character maximum on each non-null raw answer. Compare natural numbers textually after trimming outer whitespace, accepting ASCII digits and correctly grouped space-separated thousands, and removing grouping/leading zeros; accept zero. Do not accept prose, trailing punctuation, signs, or decimals. Database and application validators must agree on whitespace/grouping using identical accepted/rejected fixtures.

**Contract**: Derive the denominator from persisted assigned rows and verify that row count/positions agree with the immutable assignment count. Score with the exact predicate `2 * correct_count >= assigned_count`; blank is always incorrect. Validate every canonical answer before scoring. Return a persisted result with submission identity/time, counts, passed status, ordered submitted answers/correctness, and replay indication, never expected answers.

**Contract**: Serialize finalization, membership validation, and equivalent retry detection atomically. An equivalent retry returns the original submission; different answers return an already-submitted conflict. Invalid shape, incompatible canonical data, or persistence failure leaves no partial submission or answer rows. Log diagnostic failure information only server-side without raw answers, canonical answers, student emails, or token data.

#### 2. Persisted contract tests

**File**: new `supabase/tests/database/homework_submissions.sql`

**Intent**: Prove actual database authorization and grading rather than treating mocked handlers as RLS evidence.

**Contract**: Follow the authenticated JWT/role fixtures in `homework_assignments.sql` and `class_memberships.sql`. Test own/foreign/unknown/departed access, anonymous denial, teacher-only and dual-role cases, revoked direct table access, answer-key non-disclosure, complete positional validation, unsupported canonical state rollback, immutable results, equivalent replay, and changed-answer conflict.

**Contract**: Cover `0/1` fail, `1/1` pass, `1/2` pass exactly at 50%, `1/3` fail, `2/3` pass, `2/5` fail, `3/5` pass, all blanks, and valid numeric formatting including leading zeros and large string integers. Verify results survive later pool additions and membership denial applies to saved-result replay.

### Success Criteria:

#### Automated Verification:

- A clean local migration reset and `npm run db:test` pass, including the new private submission/read/scoring suite.
- Database fixtures prove exact 50% boundaries, blank grading, positional validation, equivalent retry, immutable conflict, and unsupported-canonical rollback.
- Database fixtures prove no cross-student/key disclosure and deny all departed-member reads, submissions, and replays.

#### Manual Verification:

- With two database sessions, simultaneous equivalent/different submissions produce one final submission without partial rows; membership deletion serializes with submission and prevents later access.

**Implementation Note**: Complete automated checks, then pause for human confirmation of the manual concurrency check before phase 2.

## Phase 2: Typed student APIs

### Overview

Expose narrow list/detail/submit endpoints and robust typed adapters without trusting client grades.

### Changes Required:

#### 1. DTOs and answer validation

**Files**: `src/types.ts`, `src/lib/homework/schemas.ts`, `src/lib/exercises/answer-normalization.ts`; new `src/lib/homework/student-schemas.test.ts`

**Intent**: Define student-only contracts and consistent strict numeric validation without changing the verifier's existing forgiving behavior.

**Contract**: Add list summaries, ordered detail items, nullable submission/result, positional submit request, and explicit error DTOs. Extract/reuse a numeric-only canonicalization helper where suitable, preserving existing verifier exports and semantics. API input and RPC result schemas are strict/allowlisted; client-supplied grade, recipient/student identity, exercise IDs, or canonical answers are rejected. Preserve raw answer text for review; normalized values drive equivalence only.

**Contract**: Errors distinguish invalid input (400), unauthenticated (401), role-forbidden (403 where applicable), generic homework unavailable (404), different final submission (409), and explicit scoring/database unavailability (503) or persistence failure (500). Generic unavailability must not reveal whether an assignment exists. Database errors must be translated without exposing raw SQL messages.

#### 2. Session-bound adapters and routes

**Files**: new `src/lib/services/student-homework.ts`, `src/lib/services/student-homework.test.ts`, `src/pages/api/homework/list.ts`, `src/pages/api/homework/list.test.ts`, `src/pages/api/homework/[assignmentId]/index.ts`, `src/pages/api/homework/[assignmentId]/index.test.ts`, `src/pages/api/homework/[assignmentId]/submit.ts`, `src/pages/api/homework/[assignmentId]/submit.test.ts`

**Intent**: Connect the trusted RPC boundary to SSR and interactive clients using the existing Supabase SSR session, response validation, and error patterns.

**Contract**: `GET /api/homework/list`, `GET /api/homework/:assignmentId`, and `POST /api/homework/:assignmentId/submit` use uppercase Astro exports and `prerender = false`. New submissions return 201; equivalent replays return 200 with the saved result. No service-role credential is used to bypass student access. SSR pages and APIs share the same session-bound adapters and non-disclosing error outcomes.

**Contract**: Sort lists pending before submitted and newest assignment first within each group, with a stable ID tie-breaker. Never silently truncate accessible homework; the MVP list returns accessible summary rows only, not exercise/answer payloads. Detail and submit responses preserve assigned exercise order.

**Contract**: Test actual service/handler composition at the RPC boundary, anonymous/no-work and invalid/no-work cases, malformed RPC response failures, foreign/departed denials, exact public response shape, unsupported numeric input, status codes, equivalent retries, and conflicts. Assert raw SQL failures and canonical/verifier/classmate fields never appear in responses.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/homework/student-schemas.test.ts src/lib/services/student-homework.test.ts src/pages/api/homework/list.test.ts "src/pages/api/homework/[assignmentId]/index.test.ts" "src/pages/api/homework/[assignmentId]/submit.test.ts"` passes.
- `npm test -- src/lib/exercises/answer-normalization.test.ts src/lib/services/openrouter-exercise-verifier.test.ts src/lib/services/homework-assignments.test.ts src/pages/api/homework/assign.test.ts` preserves existing verification and teacher-assignment behavior.
- `npm run lint` and `npm run build` pass with the student DTOs and endpoints.

**Implementation Note**: Phase 2 has no separate human acceptance gate; proceed after its automated criteria pass.

## Phase 3: Student workflow and verification

### Overview

Deliver the Polish student list/form/result experience, role-aware dashboard, and verified authenticated flow.

### Changes Required:

#### 1. Navigation and server-rendered pages

**Files**: `src/middleware.ts`, `src/pages/dashboard.astro`; new `src/pages/homework/index.astro`, `src/pages/homework/[assignmentId].astro`, `src/lib/services/profile-roles.ts`, `src/lib/services/profile-roles.test.ts`

**Intent**: Give students a discoverable entry point and protect deep links while preserving teacher and dual-role behavior.

**Contract**: Register `/homework` as protected; preserve the complete same-origin return destination through sign-in. Load the caller's explicit role set using existing profile-role policies. Student accounts see homework navigation; teachers retain their existing tools; dual-role accounts see both. Keep class-join entry points available for accounts not yet enrolled. Role-loading errors are explicit, not interpreted as empty roles. Detail pages use generic unavailable states for inaccessible IDs and never serialize canonical fields.

#### 2. List, answer form, and persisted results

**Files**: new `src/components/homework/StudentHomeworkList.astro`, `src/components/homework/StudentHomeworkForm.tsx`, `src/components/homework/StudentHomeworkView.tsx`, `src/components/homework/StudentHomeworkForm.test.tsx`; use `src/components/ui/` and existing homework layouts

**Intent**: Keep noninteractive lists server-rendered and use React only for answering/confirmation/result interactions. Preserve entered work through recoverable failures while making finality unmistakable.

**Contract**: Provide Polish empty/unavailable/error states, labeled numeric text inputs in assigned order, strict per-input validation, and a review/confirmation step showing unanswered count (including all blank). Do not use a numeric input type that prevents accepted grouped strings or destroys large integer precision. Confirmation explicitly states that answers cannot be changed after submission.

**Contract**: Maintain page-only answer state through validation and network failures; disable duplicate clicks while submitting but keep server concurrency protection authoritative. Abort requests on unmount. Display immutable persisted answers, per-item correctness and blanks, correct/assigned count, and pass/fail after success or reload. A lost-response retry sends the same vector; a finalization conflict loads the persisted result rather than overwriting or pretending unsaved answers succeeded. If membership is revoked, show unavailable and remove editable/submitted content from the active view.

**Contract**: Reuse existing `cn`, UI primitives, focus/status/error patterns, and responsive layouts. Errors preserve form values unless access is denied; successful result and invalid-input states receive accessible focus/status handling. No drafts enter browser storage and no answer key appears in SSR HTML, hydration props, API payloads, or user-facing errors.

#### 3. Verification record and directly related documentation

**Files**: `README.md`, `package.json`, `scripts/seed-homework-manual-test.mjs`; new `context/changes/submit-and-score-homework/manual-verification.md` during implementation only

**Intent**: Document student entry points, irreversible blank-aware submission, membership revocation, and how to verify the shipped behavior.

**Contract**: Record actual database/API/UI outcomes, not unexecuted claims. Run focused new UI/role tests first, then the full existing application/database suites once at final integration. Use existing auth smoke against a configured running server; do not expand it into the deferred test-plan critical-flow rollout. Add no gate/strategy changes.

**Implementation Note**: `npm run seed:homework-manual-test` provisions local-only accounts and homework fixtures for these manual checks. The script refuses non-local Supabase URLs; setup details and fixture limitations are recorded in `manual-verification.md`.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/homework/StudentHomeworkForm.test.tsx src/lib/services/profile-roles.test.ts` proves blank-aware confirmation, numeric validation, final read-only results, retry/conflict handling, and page-only state.
- `npm test`, `npm run db:test`, `npm run lint`, and `npm run build` pass against the completed implementation.
- `npm run smoke` passes against a configured running app and local Supabase without weakening existing auth checks.

#### Manual Verification:

- A teacher assigns real homework; two students independently list/open only their own allocation, submit with blanks, and reload the same final per-item results without any canonical answer in HTML or network payloads.
- Exactly half correct passes, below half fails, and all blanks fail; formatted equivalent numbers score correctly while prose/decimal/negative input is rejected before finalization.
- A departed member cannot list/open/submit/view/replay homework; anonymous deep links resume after sign-in, and student/teacher/dual-role dashboards retain their intended entry points.
- Keyboard, screen-reader status/focus, narrow/mobile layout, empty list, unavailable homework, and recoverable network error states are verified and recorded.

**Implementation Note**: Pause for human confirmation of the manual acceptance record before declaring S-07 complete.

## Testing Strategy

### Unit Tests

- Use explicit input/output fixtures, not expected results generated by production scoring. Compare shared numeric cases across application validation and database normalization.
- Include zero, leading zeros, correctly grouped thousands, whitespace-only blanks, very large digit strings, malformed grouping, prose, decimal, negative, duplicate position, missing position, and overlength input.
- Preserve the existing verifier's prose-normalization tests; student restrictions must not regress approval equivalence.

### Integration Tests

- pgTAP proves actual session ownership, membership, table privileges, complete submission persistence, authoritative answer selection, exact thresholds, atomic failures, and replay.
- Vitest handler/service tests prove request/response contracts and error translation, not database access safety.
- Component tests prove blank warnings, confirmation finality, failures retaining answers, immutable success, conflict recovery, and no local draft storage.
- The two-session manual test proves serialization; a single-transaction pgTAP test is not evidence of concurrent correctness.

### Manual Testing Steps

1. Create a class with two students and assign two- and five-exercise homework from the approved bucket.
2. Open each student's list/detail separately; verify no other allocation and no canonical/verifier data in HTML or network responses.
3. Submit one of two correct, two of five correct, three of five correct, and all blank using separate assignments; expect pass, fail, pass, fail.
4. Retry after a simulated lost response and submit a different vector from another tab; verify one unchanged final submission.
5. Delete membership in a controlled local fixture; test list, detail, submit, result reload, and equivalent retry denial.
6. Check teacher-only, student-only, dual-role, not-yet-enrolled, and anonymous navigation, then keyboard/mobile/error states.

## Performance Considerations

Each student submission has at most five exercises. Normalize/compare digit strings without numeric conversion and bound raw answer size to 200 characters. Scope list queries by indexed recipient student ID and membership, returning summaries only; details load one assigned set. Avoid provider calls, whole-pool reads, per-exercise network requests, and fetching another student's data for filtering.

## Migration Notes

Apply an additive timestamped migration; do not rewrite shipped S-06 migrations or grant student access to the approved pool. Existing recipient records become pending unless a final submission exists; no assignment backfill or reassignment is required. Before rollout, verify assigned canonical answers are supported; incompatible trusted state fails visibly without writing a grade. Do not rewrite historical answers or silently coerce unsupported content.

Rollback the application exposure first while retaining submission data and restrictive grants. Destructive submission rollback requires an explicit backup/data-retention decision outside this change. Schema/RPC deployment precedes application exposure. No feature-flag infrastructure is needed for this additive slice.

## References

- Scope and scoring: `../../foundation/prd.md`, FR-011 through FR-013 and Business Logic.
- Roadmap: `../../foundation/roadmap.md`, S-07; teacher feedback is S-08.
- Risk/gate strategy: `../../foundation/test-plan.md`, risks #1/#6 and Quality Gates.
- Prior assignment decisions: `../../archive/2026-10-08-assign-distinct-homework/plan-brief.md`.
- Assignment persistence and pgTAP: `supabase/migrations/20261008120000_add_homework_assignments.sql:1`, `supabase/tests/database/homework_assignments.sql:1`.
- Approval authority: `supabase/migrations/20260929120000_add_exercise_verification_approval.sql:58`.
- Reusable normalization: `src/lib/exercises/answer-normalization.ts:1`.
- Existing handler/form: `src/pages/api/homework/assign.ts:1`, `src/components/homework/HomeworkAssignmentForm.tsx:1`.
- Test runner: `vitest.config.ts:1`; commands: `package.json`.

## Progress

### Phase 1: Persistence and scoring boundary

#### Automated

- [x] 1.1 A clean local migration reset and `npm run db:test` pass, including the new private submission/read/scoring suite. — c5cee2b
- [x] 1.2 Database fixtures prove exact 50% boundaries, blank grading, positional validation, equivalent retry, immutable conflict, and unsupported-canonical rollback. — c5cee2b
- [x] 1.3 Database fixtures prove no cross-student/key disclosure and deny all departed-member reads, submissions, and replays. — c5cee2b

#### Manual

- [x] 1.4 With two database sessions, simultaneous equivalent/different submissions produce one final submission without partial rows; membership deletion serializes with submission and prevents later access. — c5cee2b

### Phase 2: Typed student APIs

#### Automated

- [x] 2.1 `npm test -- src/lib/homework/student-schemas.test.ts src/lib/services/student-homework.test.ts src/pages/api/homework/list.test.ts "src/pages/api/homework/[assignmentId]/index.test.ts" "src/pages/api/homework/[assignmentId]/submit.test.ts"` passes. — 38fcb37
- [x] 2.2 `npm test -- src/lib/exercises/answer-normalization.test.ts src/lib/services/openrouter-exercise-verifier.test.ts src/lib/services/homework-assignments.test.ts src/pages/api/homework/assign.test.ts` preserves existing verification and teacher-assignment behavior. — 38fcb37
- [x] 2.3 `npm run lint` and `npm run build` pass with the student DTOs and endpoints. — 38fcb37

### Phase 3: Student workflow and verification

#### Automated

- [x] 3.1 `npm test -- src/components/homework/StudentHomeworkForm.test.tsx src/lib/services/profile-roles.test.ts` proves blank-aware confirmation, numeric validation, final read-only results, retry/conflict handling, and page-only state. — 830717c
- [x] 3.2 `npm test`, `npm run db:test`, `npm run lint`, and `npm run build` pass against the completed implementation. — 830717c
- [x] 3.3 `npm run smoke` passes against a configured running app and local Supabase without weakening existing auth checks. — 830717c

#### Manual

- [x] 3.4 A teacher assigns real homework; two students independently list/open only their own allocation, submit with blanks, and reload the same final per-item results without any canonical answer in HTML or network payloads. — 830717c
- [x] 3.5 Exactly half correct passes, below half fails, and all blanks fail; formatted equivalent numbers score correctly while prose/decimal/negative input is rejected before finalization. — 830717c
- [x] 3.6 A departed member cannot list/open/submit/view/replay homework; anonymous deep links resume after sign-in, and student/teacher/dual-role dashboards retain their intended entry points. — 830717c
- [x] 3.7 Keyboard, screen-reader status/focus, narrow/mobile layout, empty list, unavailable homework, and recoverable network error states are verified and recorded. — 830717c
