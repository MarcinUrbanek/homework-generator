# Authorization and Invitation Boundaries Implementation Plan

## Overview

Strengthen Phase 1 risk coverage with focused request-handler tests and real PostgreSQL authorization tests. Cover invitation state only before enrollment: invalidated, expired, undeliverable, and wrong-account links must resolve to coarse statuses without exposing recipient data; membership and replay safety remain deferred until acceptance exists.

## Current State Analysis

The seven teacher-gated API handlers call `authorizeTeacher`, but route tests vary in denial coverage and downstream-call assertions. Most inject authorization results, so they establish handler response behavior, not the role lookup itself. The shared authorization service has its own tests; one representative handler test should compose the real service with a student-shaped role lookup, while pgTAP remains the proof of persisted authorization.

The database suite already exercises authenticated JWT claims, class RLS, owner checks inside `prepare_class_invitations`, digest rotation, and stale delivery writes. It lacks a student-only denial for the invitation-preparation RPC. Current invitation status classification lives in a service used by the server-rendered `/classes/join` page; there is no invitation-status API route. Existing service and sign-in/sign-up tests cover most classification and return-path behavior.

### Key Discoveries:

- Authorization has separate handler and database boundaries: `src/lib/services/teacher-authorization.ts:13-45`, `supabase/migrations/20261001130000_add_classes_and_invitations.sql:95-144`.
- The relevant API handlers are class create/list/invite and exercise request/verify/approve/saved; existing route tests are under `src/pages/api/classes/` and `src/pages/api/exercises/`.
- `class_invitations.sql` runs as `authenticated` with JWT subject claims and already checks another teacher's class visibility, owner RPC denial, student class-creation denial, digest rotation, and stale delivery protection.
- The status service returns coarse states and compares authenticated email to the normalized recipient; `/classes/join` renders messages and authentication links without creating membership (`src/lib/services/class-invitation-status.ts:46-68`, `src/pages/classes/join.astro:5-29`).
- No membership table or acceptance operation exists in this phase. The `redeemed_at`/`redeemed_by` fields are not proof of redemption enforcement.

## Desired End State

Every teacher-gated route has a signed-in student denial assertion that checks a non-disclosing response and confirms route-specific protected work is skipped. A representative route exercises the real `authorizeTeacher` implementation, and pgTAP independently proves student-role and ownership enforcement against actual RLS/security-definer behavior.

Invitation tests establish the correct pre-enrollment status for expired, rotated, failed/pending-delivery, and wrong-account links; persisted digest and delivery transitions remain covered at the database boundary. The join page does not expose recipient details or claim enrollment safety. The cookbook documents both patterns and their limits.

## What We're NOT Doing

- Implementing class acceptance, membership creation, or redemption.
- Asserting that replayed or expired bearer tokens cannot enroll; these require the future acceptance transaction and are deferred to S-05.
- Building a live Supabase-backed HTTP test harness or adding browser automation for the status page.
- Repeating a full anonymous/non-teacher/profile-unavailable/teacher Cartesian matrix on every handler; retain existing distinct cases and add the signed-in student case to each route.
- Changing the frozen test strategy in §1-§5 or modifying production authorization/invitation behavior.

## Implementation Approach

Work in risk order. Start with low-cost route-handler assertions for high/high Risk #1, then use pgTAP for the higher-signal RLS and security-definer boundary. Cover Risk #4 with the existing status-service classification pattern plus persisted invitation lifecycle assertions; manually inspect the rendered page without treating it as enrollment evidence. Finish by updating §6 with the shipped cookbook patterns. Keep handler, database, and status-classification claims separate so a mock or a status-page rejection cannot stand in for a stronger boundary.

## Critical Implementation Details

For the seven route cases, injected `non-teacher` results test each handler's guard and skipped downstream work; one representative case must use the production `authorizeTeacher` function with a signed-in student and a role lookup returning no teacher row. The pgTAP cases must use authenticated role/JWT claims, not service-role execution. Invitation status tests prove classification only; no status-page, token-rotation, or stale-delivery assertion proves single-use enrollment or replay protection.

## Phase 1: Teacher-Only API Denials

### Overview

Add a focused signed-in student denial case to each teacher-only route. Assert the route's forbidden response is generic and that route-specific work does not run; compose the real authorization service in one representative route test. Preserve the existing error distinction for unauthenticated callers and existing profile-unavailable cases without multiplying them across every route.

### Changes Required:

#### 1. Class API route tests

**File**: `src/pages/api/classes/create.test.ts`, `src/pages/api/classes/list.test.ts`, `src/pages/api/classes/invite.test.ts`

**Intent**: Make role-denial behavior explicit for class creation, listing, and invitation, including the ownership-error response. This catches a route that stops enforcing the teacher/owner boundary or begins returning protected class or recipient data.

**Contract**: A signed-in non-teacher receives HTTP 403 with the established error schema; class creation, class retrieval, invitation preparation, and delivery dependencies are not reached on role denial. The invite ownership error remains a generic 403 without class, recipient, token, or database details.

#### 2. Exercise API route tests

**File**: `src/pages/api/exercises/request.test.ts`, `src/pages/api/exercises/verify.test.ts`, `src/pages/api/exercises/approve.test.ts`, `src/pages/api/exercises/saved.test.ts`

**Intent**: Apply the same student-denial contract to generation, verification, approval, and saved-exercise retrieval. Explicit skipped-work assertions ensure denial happens before provider calls, ledger reads/writes, RPCs, or retrieval.

**Contract**: Each handler returns its established 403 error shape for a signed-in non-teacher and does not invoke its protected operation. Assertions use fixture secrets/data to prove responses do not disclose protected values.

#### 3. Real authorizer composition check

**File**: `src/pages/api/classes/create.test.ts`

**Intent**: Verify one handler composes with the production role authorizer instead of proving every route only against an injected authorization result.

**Contract**: A signed-in student with no `teacher` row in the controlled `profile_roles` lookup receives 403 and does not reach class creation. The lookup may be a narrow client stub; persisted RLS and RPC behavior is asserted in Phase 2.

### Risk Coverage Contract:

- **Behavior asserted:** Each teacher-only route denies a signed-in student before protected work and returns no class, recipient, token, or database details; the invite ownership response is also generic.
- **Regression caught:** A route omits or moves its role check after a protected call, or exposes protected context while translating an ownership failure.
- **Research source:** `context/changes/testing-authorization-and-invitation-boundaries/research.md` (Session and role boundary; Phase 1 planning handoff), Risk #1 in `context/foundation/test-plan.md`, and the seven route handlers/tests in `src/pages/api/`.
- **Edge/error/boundary case:** A signed-in student is distinct from an unauthenticated caller; one route uses the real authorizer to prove that an authenticated account without a teacher row is not authorized.
- **Anti-pattern avoided:** Happy-path-only role tests, relying only on injected authorizer outcomes, or treating handler mocks as proof of RLS/ownership enforcement.

### Success Criteria:

#### Automated Verification:

- The seven route tests prove a signed-in non-teacher receives a non-disclosing 403 and each route-specific protected operation is skipped; one class route uses the real `authorizeTeacher` implementation.
- The invitation ownership handler test proves the generic 403 response omits class, recipient, token, and database details.
- Focused route and authorization tests pass: `npm test -- src/pages/api/classes/create.test.ts src/pages/api/classes/list.test.ts src/pages/api/classes/invite.test.ts src/pages/api/exercises/request.test.ts src/pages/api/exercises/verify.test.ts src/pages/api/exercises/approve.test.ts src/pages/api/exercises/saved.test.ts src/lib/services/teacher-authorization.test.ts`.

## Phase 2: Database Role and Ownership Enforcement

### Overview

Close the Risk #1 gap at the database trust boundary using the existing pgTAP suite and real PostgreSQL policies/functions, not route mocks.

### Changes Required:

#### 1. Class and invitation authorization assertions

**File**: `supabase/tests/database/class_invitations.sql`

**Intent**: Prove student-role denial and class ownership isolation where RLS and the security-definer function make the final access decision. Check that rejected invitation preparation leaves no invitation rows behind.

**Contract**: Under `authenticated` with JWT claims, a student-only account cannot call `create_class` or `prepare_class_invitations`; another teacher sees no rows for the owner's class and receives SQLSTATE `42501` from invitation preparation. Retain the dual-role teacher success and existing privilege assertions.

### Risk Coverage Contract:

- **Behavior asserted:** Direct database requests are denied for a student role and for a teacher who does not own the class; rejected preparation does not mutate invitation state.
- **Regression caught:** A weakened RLS predicate, removed role check, or missing owner check in the security-definer RPC.
- **Research source:** `context/changes/testing-authorization-and-invitation-boundaries/research.md` (Database authorization and ownership boundary; Phase 1 planning handoff), and Risk #1 in `context/foundation/test-plan.md`.
- **Edge/error/boundary case:** A dual-role account retains teacher capability, while a student-only account calling the invitation-preparation RPC is rejected even though authenticated users have execute privilege on the function.
- **Anti-pattern avoided:** Mocking RLS/security-definer behavior, or treating a handler-level 403 as proof of database ownership isolation.

### Success Criteria:

#### Automated Verification:

- pgTAP asserts student denial for class creation and invitation preparation, cross-teacher empty class visibility and owner-RPC denial, and no invitation mutation after rejected preparation.
- The database suite passes against local Supabase: `npm run db:test`.

## Phase 3: Invitation Pre-Enrollment Status

### Overview

Prove the invitation status contract and persisted token lifecycle without claiming membership or replay protection. Retain existing authentication-continuation tests rather than duplicating their return-path coverage.

### Changes Required:

#### 1. Status classification and authentication continuation tests

**File**: `src/lib/services/class-invitation-status.test.ts`, `src/pages/api/auth/signin.test.ts`, `src/pages/api/auth/signup.test.ts`, `src/lib/auth/return-destination.test.ts`

**Intent**: Keep expected status values grounded in the pre-enrollment contract for expired, unknown/rotated, failed or pending delivery, and mismatched-account links. Assert that public results remain coarse and authentication returns to the same safe invitation path.

**Contract**: `resolveClassInvitationStatus` returns only the status enum, never the normalized recipient. An invitation whose expiry is earlier than the current time is expired; a rotated prior digest shares the unknown-token invalid state; failed and pending delivery are unavailable; a different normalized account receives `email-mismatch`; safe sign-in/sign-up return destinations retain the complete invitation path and query.

#### 2. Persisted lifecycle assertions

**File**: `supabase/tests/database/class_invitations.sql`

**Intent**: Complement classification tests with real persistence evidence for expiry setup, digest rotation, delivery state, and stale provider responses.

**Contract**: The suite proves the seven-day expiration is stored, refresh replaces the old digest and resets delivery to pending, a current failed-delivery result is persisted, and a stale digest cannot overwrite the refreshed row. These are lifecycle/persistence assertions, not redemption assertions.

### Risk Coverage Contract:

- **Behavior asserted:** Expired, rotated, undelivered, and wrong-account links receive their correct non-disclosing pre-enrollment status; valid unauthenticated invitations preserve the exact safe return path through authentication.
- **Regression caught:** Stale links accepted as current, delivery state ignored, account mismatch treated as ready, recipient email leaked, or invitation query data lost during sign-in/sign-up.
- **Research source:** `context/changes/testing-authorization-and-invitation-boundaries/research.md` (Invitation lifecycle before enrollment; Authentication continuation), archived S-04 contract, and Risk #4 in `context/foundation/test-plan.md`.
- **Edge/error/boundary case:** A refreshed token is still pending until delivery is recorded, and the previous token digest resolves to the same invalid state as an unknown token; an authenticated different account sees only the mismatch status.
- **Anti-pattern avoided:** Treating a status-page rejection, digest rotation, or auth-email match as proof of atomic enrollment or replay protection; exposing recipient data in assertions or expected responses.

### Success Criteria:

#### Automated Verification:

- Status and auth-continuation tests assert the expected coarse outcomes for expired, rotated/unknown, failed/pending, matching, and wrong-account cases without returning recipient data.
- pgTAP proves persisted expiry, digest rotation, delivery-state recording, and stale-delivery rejection; it makes no membership or replay claim.
- Focused status and auth tests pass: `npm test -- src/lib/services/class-invitation-status.test.ts src/pages/api/auth/signin.test.ts src/pages/api/auth/signup.test.ts src/lib/auth/return-destination.test.ts`.

#### Manual Verification:

- With controlled local invitation records, inspect `/classes/join` for expired, rotated, failed-delivery, and wrong-account links; confirm the page shows only its generic state/help text, exposes no recipient or class data, and does not offer or imply enrollment. For a valid unauthenticated link, confirm sign-in/sign-up links retain the tokenized return path. Do not interpret this check as replay or enrollment verification.

## Phase 4: Publish Cookbook Patterns

### Overview

Make the final sub-phase update §6 with the patterns actually established by the route and pgTAP tests, along with their evidence boundaries.

### Changes Required:

#### 1. Authorization and invitation cookbook entries

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the Phase 1 placeholders in §6.1 and §6.2 with concise, reusable test guidance and add the Phase 1 note under §6.6. Preserve the existing risk-strategy edits in §§1-5.

**Contract**: §6.1 records the handler-level denial/no-work assertion, one real authorizer composition example, and pgTAP as the source of RLS/security-definer truth. §6.2 records the coarse-status and persisted-lifecycle pattern, the relevant commands, and the explicit deferral of membership/replay assertions until acceptance exists. §6.6 records the shipped phase and remaining boundary limitation.

### Success Criteria:

#### Automated Verification:

- §6.1, §6.2, and §6.6 describe the shipped patterns, verification commands, source boundaries, and acceptance/replay exclusions; the pre-existing edits to §§1-5 are preserved.

## Testing Strategy

### Unit Tests:

- Retain focused invitation status classification tests for invalid/rotated, expired, failed/pending delivery, and matching/mismatched authenticated accounts.
- Retain the shared `authorizeTeacher` result tests; do not substitute a copied authorization rule in route expectations.

### Integration Tests:

- Vitest invokes the seven API handler functions and checks HTTP response contracts plus skipped side effects. One representative route composes with the production authorizer; other route cases inject its result to isolate each handler guard.
- pgTAP uses authenticated JWT claims to exercise actual RLS and security-definer role/ownership controls.
- Database lifecycle assertions and service classification assertions intentionally stay separate; neither is described as a live HTTP-to-Supabase integration.

### Manual Testing Steps:

1. Create controlled local invitation states for expired, rotated, failed-delivery, and wrong-account paths.
2. Visit `/classes/join` with each link and verify only the expected generic status and help text appears, with no recipient/class details.
3. For a valid unauthenticated link, follow sign-in or sign-up and confirm the tokenized same-origin return destination survives; verify no membership is created by this phase.

## Performance Considerations

These tests use existing Vitest and pgTAP runners. No browser suite, live HTTP/Supabase harness, or production-path instrumentation is added; database execution requires local Supabase.

## Migration Notes

No production migration or schema change is planned. The pgTAP assertions use the existing `class_invitations` and `classes` schema and rollback their fixtures within the suite.

## References

- Research: `context/changes/testing-authorization-and-invitation-boundaries/research.md`
- Risk strategy and rollout scope: `context/foundation/test-plan.md` (§2-§3)
- Authorization handler contract: `src/lib/services/teacher-authorization.ts:13-45`
- Database role and ownership boundary: `supabase/migrations/20261001130000_add_classes_and_invitations.sql:13-144`
- Invitation status and join page: `src/lib/services/class-invitation-status.ts:46-68`, `src/pages/classes/join.astro:5-29`
- Existing pgTAP suite: `supabase/tests/database/class_invitations.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `.github/skills/10x-plan/references/progress-format.md`.

### Phase 1: Teacher-Only API Denials

#### Automated

- [x] 1.1 The seven route tests prove a signed-in non-teacher receives a non-disclosing 403 and each route-specific protected operation is skipped; one class route uses the real `authorizeTeacher` implementation. — 3b76ec2
- [x] 1.2 The invitation ownership handler test proves the generic 403 response omits class, recipient, token, and database details. — 3b76ec2
- [x] 1.3 Focused route and authorization tests pass: `npm test -- src/pages/api/classes/create.test.ts src/pages/api/classes/list.test.ts src/pages/api/classes/invite.test.ts src/pages/api/exercises/request.test.ts src/pages/api/exercises/verify.test.ts src/pages/api/exercises/approve.test.ts src/pages/api/exercises/saved.test.ts src/lib/services/teacher-authorization.test.ts`. — 3b76ec2

### Phase 2: Database Role and Ownership Enforcement

#### Automated

- [x] 2.1 pgTAP asserts student denial for class creation and invitation preparation, cross-teacher empty class visibility and owner-RPC denial, and no invitation mutation after rejected preparation. — d624dcc
- [x] 2.2 The database suite passes against local Supabase: `npm run db:test`. — d624dcc

### Phase 3: Invitation Pre-Enrollment Status

#### Automated

- [x] 3.1 Status and auth-continuation tests assert the expected coarse outcomes for expired, rotated/unknown, failed/pending, matching, and wrong-account cases without returning recipient data. — 0f4c374
- [x] 3.2 pgTAP proves persisted expiry, digest rotation, delivery-state recording, and stale-delivery rejection; it makes no membership or replay claim. — 0f4c374
- [x] 3.3 Focused status and auth tests pass: `npm test -- src/lib/services/class-invitation-status.test.ts src/pages/api/auth/signin.test.ts src/pages/api/auth/signup.test.ts src/lib/auth/return-destination.test.ts`. — 0f4c374

#### Manual

- [x] 3.4 With controlled local invitation records, inspect `/classes/join` for expired, rotated, failed-delivery, and wrong-account links; confirm the page shows only its generic state/help text, exposes no recipient or class data, and does not offer or imply enrollment. For a valid unauthenticated link, confirm sign-in/sign-up links retain the tokenized return path. Do not interpret this check as replay or enrollment verification. — 0f4c374

### Phase 4: Publish Cookbook Patterns

#### Automated

- [x] 4.1 §6.1, §6.2, and §6.6 describe the shipped patterns, verification commands, source boundaries, and acceptance/replay exclusions; the pre-existing edits to §§1-5 are preserved. — 20c8a7d
