# Reuse Saved Exercises Implementation Plan

## Overview

Deliver a protected teacher workflow for finding approved Grade 4 exercises in the shared pool and inspecting them for future homework. The change adds an RLS-preserving, cursor-paginated retrieval contract, a typed read API, and a Polish pool browser without pulling homework assignment or persistent collections into S-03.

## Current State Analysis

The completed persistence and approval slices already store immutable approved exercises with canonical answers, grade, topic, difficulty, approval timestamps, and verification evidence. Every authenticated teacher can read the complete approved pool through RLS, while students cannot read it. The application has no retrieval function, query indexes, list API, pool page, or dashboard entry point, so saved material is durable but not discoverable after approval.

The current exercise workflow establishes the patterns this change should follow: Zod contracts, validation before teacher authorization, dependency-injected Astro API handlers, semantic shadcn components, Vitest and happy-dom interaction tests, pgTAP database tests, and development-only state galleries.

## Desired End State

An authenticated teacher can open a dedicated Polish page, choose Grade 4 and one supported topic, optionally refine by difficulty, and explicitly request matching approved exercises. Results show exercise text, canonical answer, topic, difficulty, and approval date newest-first in stable pages of 20. The teacher can load more results without losing the current list, and a failed search preserves the last successful list and its applied-filter summary.

The retrieval boundary continues to expose the shared teacher pool while denying students. It returns stable exercise IDs for S-06 but creates no assignment, collection, or browser-only selection contract.

### Key Discoveries:

- `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql:57-103` stores the complete reusable record and grants shared teacher reads through RLS, with no retrieval indexes.
- `context/foundation/prd.md:79-81` requires reuse by grade and topic; the current catalog in `src/lib/exercises/catalog.ts:3-42` fixes the MVP to Grade 4 and four topic slugs.
- `context/foundation/roadmap.md:116-125` bounds S-03 to finding and reusing approved exercises before the separate assignment slice.
- `src/pages/api/exercises/approve.ts:61-113` establishes validation, teacher authorization, dependency injection, typed Polish errors, and response validation for exercise APIs.
- `src/components/exercises/ExerciseRequestView.tsx:59-142` and `src/components/ui/` provide the semantic controls and responsive operational layout to reuse.
- `scripts/smoke.mjs:45-119` and `src/pages/dev/ui-exercise-request.astro:1-15` establish provider-free production smoke checks and production-hidden visual fixtures.

## What We're NOT Doing

- Creating homework, assigning exercises, choosing student-specific sets, or implementing S-06.
- Persisting named collections, favorites, or a current-tab exercise selection.
- Adding full-text search, semantic ranking, random ordering, author filters, ratings, or duplicate detection.
- Supporting grades or topics beyond the existing Grade 4 catalog.
- Exposing creator identity, approver identity, verifier identity/version, rationale, or verification-ledger records in the pool UI.
- Editing, deleting, re-verifying, or re-approving exercises from the browser.
- Restyling the existing dashboard or unrelated views.

## Implementation Approach

Add a forward-only migration with query indexes for grade/topic and grade/topic/difficulty access plus a security-invoker PostgreSQL function that applies existing RLS. The function uses `(approved_at, id)` as a deterministic descending keyset, accepts only bounded page sizes, and returns the agreed teacher-facing fields. Database tests prove filtering, ordering, cursor boundaries, shared teacher reads, and student denial.

Expose the function through a teacher-only `GET /api/exercises/saved` endpoint. Shared Zod contracts validate filters, an opaque filter-bound cursor, database rows, and the response. The endpoint requests 21 records, returns at most 20, and emits a next cursor only when another page exists.

Build a dedicated Astro page and React browser with separate draft and applied filter state. An explicit action replaces results only after a successful first-page response; load-more success appends without duplicates, while either failure preserves visible results and applied filters. A successful empty response replaces prior content with an empty state. A development-only gallery and retained responsive evidence cover every named state.

## Critical Implementation Details

The cursor must carry both the `(approved_at, id)` boundary and the applied grade/topic/optional-difficulty values. The API rejects a cursor reused with different filters; otherwise changing draft controls while old results remain visible could silently page through the wrong query. The SQL function must remain security-invoker so the existing exercise RLS policy, not function ownership, decides who can read canonical answers.

## Phase 1: Establish the Retrieval Contract

### Overview

Add the indexed, RLS-preserving database query that defines filtering, newest-first ordering, and stable cursor boundaries before an HTTP or UI consumer exists.

### Changes Required:

#### 1. Saved-exercise discovery migration

**File**: `supabase/migrations/<timestamp>_add_saved_exercise_discovery.sql`

**Intent**: Make both agreed pool queries efficient and encapsulate composite keyset pagination without weakening the existing shared-teacher RLS boundary.

**Contract**: Add indexes for `(grade, topic, approved_at desc, id desc)` and `(grade, topic, difficulty, approved_at desc, id desc)`. Add a security-invoker retrieval function accepting grade, topic, nullable difficulty, nullable approval-time/ID cursor, and a bounded limit. Return only exercise ID, text, canonical answer, grade, topic, difficulty, and approval timestamp ordered by `approved_at desc, id desc`; grant execution to authenticated sessions and rely on table RLS for row visibility.

#### 2. Database behavior tests

**File**: `supabase/tests/database/saved_exercise_discovery.sql`

**Intent**: Prove filtering and pagination directly at the trust boundary, including the shared-teacher and student behavior inherited from F-01.

**Contract**: Add pgTAP fixtures with tied approval timestamps, multiple topics and difficulties, two teachers, and a student. Cover exact grade/topic filtering, optional difficulty refinement, deterministic tie-breaking, non-overlapping cursor pages, page-size bounds, cross-teacher results, malformed function arguments, and student denial.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies the saved-exercise indexes and security-invoker retrieval function to a clean local database.
- `npm run db:test` passes filtering, optional-difficulty, newest-first tie-break, cursor, page-bound, shared-teacher, and student-denial cases.

#### Manual Verification:

- In local Supabase, the same function call returns the shared matching pool for two teachers and no rows for a student, with only the agreed teacher-facing columns.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 2: Publish the Typed Read API

### Overview

Define the reusable DTOs and expose the retrieval function through a validated teacher-only endpoint with stable cursor and error semantics.

### Changes Required:

#### 1. Saved-exercise types and schemas

**File**: `src/types.ts`, `src/lib/exercises/schemas.ts`

**Intent**: Give the database adapter, route, and browser one runtime-validated contract for filters, results, pagination, and Polish errors.

**Contract**: Define Grade 4/topic/optional-difficulty query filters; a saved-exercise summary containing stable ID, text, canonical answer, metadata, and approval timestamp; an opaque cursor bound to the applied filters and `(approvedAt, id)` boundary; a success envelope with up to 20 exercises and nullable `nextCursor`; and error codes for invalid request, unauthenticated, forbidden, database unavailable, and persistence failure. Add a strict schema for the snake_case retrieval rows before mapping them to the public DTO.

#### 2. Saved-exercise endpoint

**File**: `src/pages/api/exercises/saved.ts`

**Intent**: Provide one server-owned read boundary that validates filters and cursor before querying the shared pool and keeps Supabase details out of the browser.

**Contract**: Add non-prerendered `GET /api/exercises/saved`. Parse URL parameters before authorization, authorize with the existing request-scoped teacher helper, invoke the retrieval function through the authenticated client for 21 records, validate every returned row, return at most 20 records plus a filter-bound next cursor, and map database availability or malformed result failures to stable Polish envelopes without leaking details.

#### 3. Endpoint tests

**File**: `src/pages/api/exercises/saved.test.ts`

**Intent**: Lock validation, authorization, query parameter mapping, cursor behavior, and failure handling without requiring a live database.

**Contract**: Use the existing handler-factory and injected-client pattern. Cover invalid grade/topic/difficulty/cursor before authorization, unauthenticated/non-teacher/profile-unavailable responses, unavailable client, topic-only and difficulty-refined calls, 20-of-21 trimming, cursor generation and mismatch rejection, stable mapping, empty success, and non-leaking database/malformed-row failures.

### Success Criteria:

#### Automated Verification:

- `npm run test -- src/pages/api/exercises/saved.test.ts` passes validation, authorization, filter, cursor, pagination, empty-result, and failure cases.
- `npm run lint` and `npx astro check` pass with the saved-exercise DTO, schema, and route contracts.

#### Manual Verification:

- Calling the endpoint as a local teacher returns 20 newest matching summaries and a usable next cursor, while invalid filters and a student session receive the agreed Polish errors without exercise answers.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 3: Deliver the Teacher Pool Browser

### Overview

Add a discoverable protected page that lets teachers submit filters, inspect approved exercises, page forward, and retain useful results through transient failures.

### Changes Required:

#### 1. Protected saved-exercise page and navigation

**File**: `src/pages/exercises/saved.astro`, `src/pages/dashboard.astro`

**Intent**: Give teachers a clear entry point to the durable pool while retaining the established server-side teacher boundary and role-scoped semantic shell.

**Contract**: Add a protected Polish page that authorizes the teacher before hydrating the browser component, applies `data-role="teacher"`, and renders a denied state for non-teachers. Add a separate dashboard command to `/exercises/saved` without redesigning the existing dashboard.

#### 2. Pool browser controller and view

**File**: `src/components/exercises/SavedExerciseBrowser.tsx`, `src/components/exercises/SavedExercisePoolView.tsx`

**Intent**: Separate request/state ownership from deterministic presentation so filter, loading, failure, empty, populated, and pagination states remain testable and visually inspectable.

**Contract**: Render fixed Grade 4, one catalog topic, optional difficulty including all levels, and an explicit `Pokaż zadania` action using existing semantic Field, Select, Button, Alert, Badge, and Card primitives. Track draft filters separately from the applied-filter summary. On successful first-page search replace results; on successful empty search show an empty state; on Load more append unique IDs in server order; on either failure preserve visible results and applied filters with a retryable Polish message. Show text, canonical answer, topic, difficulty, and localized approval date, and expose Load more only when `nextCursor` is present. Permit one active request and prevent stale responses from changing state.

#### 3. Browser interaction tests

**File**: `src/components/exercises/SavedExerciseBrowser.test.tsx`

**Intent**: Prove the user-visible state transitions and exact request predicates independently of Supabase and visual review.

**Contract**: Cover no fetch before explicit submission, topic-only and optional-difficulty query construction, loading lockout, successful replacement, empty replacement, 20-item rendering, Load more append/order/deduplication, cursor forwarding, hidden terminal pagination, failed new-search preservation with applied-filter summary, failed Load more preservation, malformed/error envelopes, and retry.

### Success Criteria:

#### Automated Verification:

- `npm run test -- src/components/exercises/SavedExerciseBrowser.test.tsx` passes explicit-search, applied-filter, replacement, empty, pagination, deduplication, preservation, and retry cases.
- `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass after the pool page and dashboard entry point are wired.

#### Manual Verification:

- On desktop and mobile, a teacher can browse topic-wide or difficulty-refined results, inspect answers and approval dates, load more, and recover from first-page or Load more failures without stale filter labels, lost results, overlap, clipping, or layout shift.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 4: Verify States and Production Boundaries

### Overview

Make every browser state reproducible, extend provider-free smoke coverage, and retain final accessibility and responsive evidence.

### Changes Required:

#### 1. Development-only saved-pool gallery

**File**: `src/pages/dev/ui-saved-exercises.astro`, `src/components/exercises/SavedExercisePoolStateGallery.tsx`

**Intent**: Let reviewers inspect the real pool view without database fixtures or network calls and keep visual regressions reviewable under the existing UI contract.

**Contract**: Render deterministic initial, loading, populated first page, populated terminal page, empty, first-page error with prior results, and Load more error states in teacher light/dark specimens. Use the real presentational component, expose stable state attributes for capture, guard the route with `import.meta.env.DEV`, and return 404 outside development.

#### 2. Smoke and retained verification evidence

**File**: `scripts/smoke.mjs`, `context/changes/reuse-saved-exercises/manual-verification.md`, `context/changes/reuse-saved-exercises/screenshots/*.png`

**Intent**: Prove route protection, invalid-request handling, gallery isolation, and the complete user experience under reproducible viewport and accessibility checks.

**Contract**: Extend provider-free smoke coverage for anonymous saved-page redirect, authenticated teacher page access, invalid saved-query rejection, and production 404 for the gallery. Record date, browser, OS, exact viewports, named-state screenshot files, keyboard order, accessible names, visible focus, live feedback, text wrapping, and the agreed result-preservation behavior; do not blind-update or add a screenshot framework.

### Success Criteria:

#### Automated Verification:

- `npm run smoke` passes saved-page protection, invalid-query behavior, authenticated access, and production gallery isolation against the production preview.
- `npm run db:test`, `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass for the complete saved-exercise workflow.

#### Manual Verification:

- Retained desktop and mobile evidence shows every named pool state with logical keyboard order, accessible names, visible focus and live feedback, readable Polish text, and no overlap or clipping; the production preview exposes no development gallery.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before considering the change ready for implementation review.

## Testing Strategy

### Unit Tests:

- Validate every supported Grade 4 topic, optional difficulty, cursor shape, filter binding, database row, success envelope, and stable error envelope.
- Exercise the endpoint handler with injected authorization and retrieval dependencies; no route test requires live Supabase.
- Drive the browser with mocked fetch responses for explicit submission, replacement, empty results, cursor pagination, deduplication, stale-response prevention, preservation, and retry.

### Integration Tests:

- Use pgTAP with tied timestamps, multiple filters, two teachers, and a student to prove ordering, page boundaries, RLS, and bounded retrieval.
- Build for Cloudflare and run the provider-free smoke flow with local Supabase to prove protected page/API behavior and gallery isolation.

### Manual Testing Steps:

1. Reset local Supabase, insert approved fixtures across topics, difficulties, teachers, and tied approval timestamps, then sign in as a teacher.
2. Open the saved-exercise page from the dashboard and confirm no request runs until `Pokaż zadania` is activated.
3. Search one topic across all difficulties, then refine by each difficulty and inspect text, canonical answer, metadata, and newest-first approval dates.
4. Load more than 20 matching records and confirm stable order, no duplicates or gaps, and no Load more command on the terminal page.
5. Trigger a failed new search and a failed Load more request; confirm the last successful list and applied-filter summary remain visible, then retry successfully.
6. Confirm an empty successful search replaces prior results, a student cannot access the page/API, and the gallery returns 404 in production preview.
7. Capture the named states at desktop and mobile sizes and verify keyboard order, focus, accessible names, live messages, wrapping, and layout stability.

## Performance Considerations

Both accepted filter shapes receive matching composite indexes, retrieval is capped at 21 database rows per request, and the public response contains at most 20. Keyset pagination avoids count queries and growing offsets while preserving deterministic newest-first order. The browser appends only on demand and does not issue requests while draft filters change.

## Migration Notes

The migration is forward-only and adds indexes plus a read function without rewriting existing exercise data. Existing approved rows, nullable verification provenance, ownership, immutability, and RLS policies remain unchanged. A production correction should use a later migration; rolling back Cloudflare code does not remove the database function or indexes.

## References

- `context/foundation/prd.md:79-81` — FR-009 reuse by grade and topic metadata.
- `context/foundation/roadmap.md:116-125` — S-03 outcome, prerequisite, and scope boundary.
- `context/archive/2026-09-23-verified-exercise-persistence/plan.md` — shared teacher pool, student denial, immutability, and deferred reuse indexes.
- `context/archive/2026-09-29-approve-first-exercise-pool/plan.md` — authoritative approval path and explicit deferral of pool browsing.
- `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql:57-103` — approved-exercise schema and RLS.
- `src/pages/api/exercises/approve.ts:61-113` — typed route and authorization convention.
- `src/components/exercises/ExerciseRequestView.tsx:59-142` — semantic filter and action controls.
- `context/archive/2026-09-28-ui-shared-components-with-role-specific-semantic-tokens/ui-contract.md` — quiet classroom utility and role-scoped semantic component contract.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Establish the Retrieval Contract

#### Automated

- [x] 1.1 `npx supabase db reset` applies the saved-exercise indexes and security-invoker retrieval function to a clean local database. — 22c144a
- [x] 1.2 `npm run db:test` passes filtering, optional-difficulty, newest-first tie-break, cursor, page-bound, shared-teacher, and student-denial cases. — 22c144a

#### Manual

- [x] 1.3 In local Supabase, the same function call returns the shared matching pool for two teachers and no rows for a student, with only the agreed teacher-facing columns. — 22c144a

### Phase 2: Publish the Typed Read API

#### Automated

- [x] 2.1 `npm run test -- src/pages/api/exercises/saved.test.ts` passes validation, authorization, filter, cursor, pagination, empty-result, and failure cases.
- [x] 2.2 `npm run lint` and `npx astro check` pass with the saved-exercise DTO, schema, and route contracts.

#### Manual

- [x] 2.3 Calling the endpoint as a local teacher returns 20 newest matching summaries and a usable next cursor, while invalid filters and a student session receive the agreed Polish errors without exercise answers.

### Phase 3: Deliver the Teacher Pool Browser

#### Automated

- [ ] 3.1 `npm run test -- src/components/exercises/SavedExerciseBrowser.test.tsx` passes explicit-search, applied-filter, replacement, empty, pagination, deduplication, preservation, and retry cases.
- [ ] 3.2 `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass after the pool page and dashboard entry point are wired.

#### Manual

- [ ] 3.3 On desktop and mobile, a teacher can browse topic-wide or difficulty-refined results, inspect answers and approval dates, load more, and recover from first-page or Load more failures without stale filter labels, lost results, overlap, clipping, or layout shift.

### Phase 4: Verify States and Production Boundaries

#### Automated

- [ ] 4.1 `npm run smoke` passes saved-page protection, invalid-query behavior, authenticated access, and production gallery isolation against the production preview.
- [ ] 4.2 `npm run db:test`, `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass for the complete saved-exercise workflow.

#### Manual

- [ ] 4.3 Retained desktop and mobile evidence shows every named pool state with logical keyboard order, accessible names, visible focus and live feedback, readable Polish text, and no overlap or clipping; the production preview exposes no development gallery.
