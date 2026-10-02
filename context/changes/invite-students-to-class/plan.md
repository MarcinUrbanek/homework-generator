# Invite Students to a Class Implementation Plan

## Overview

Deliver roadmap slice S-04: a signed-in teacher can create a class, view it, and send email-addressed invitations to as many as 50 students at once. The change establishes secure class and invitation contracts for S-05 without creating class membership or completing enrollment.

## Current State Analysis

The app already has Supabase email/password authentication, cookie-backed SSR sessions, teacher authorization, protected teacher pages, dependency-injected API handlers, and pgTAP RLS coverage. It has no class or invitation schema, no transactional email integration, and no recipient-facing invitation route. The current profile model stores exactly one role and all new users become teachers, while authentication redirects discard the requested path.

## Desired End State

A teacher can create a name-only class with a generated class code, paste up to 50 student email addresses, and receive a per-address sent, refreshed, or failed result after Resend delivery. Invitations are bound to normalized recipient email, expire after seven days, rotate their secret when resent, and can be viewed only by the owning teacher. An invitation URL survives sign-in and reaches a non-enrolling status page; S-05 remains responsible for adding the student role and creating membership.

### Key Discoveries:

- `context/foundation/roadmap.md:130-141` fixes the S-04 outcome and requires safe same-origin return-destination preservation.
- `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql:1-56` stores one profile role, defaults every new account to teacher, and centralizes teacher checks in `is_teacher()`.
- `src/lib/services/teacher-authorization.ts:1-38` provides the application authorization boundary that existing teacher routes already reuse.
- `src/pages/api/exercises/approve.ts:32-122` demonstrates the dependency-injected handler, typed error, authorization, and database-failure pattern to follow.
- `src/middleware.ts:1-25` protects teacher routes but currently redirects without preserving the original path or query.
- `astro.config.mjs:12-20` is the server-secret schema; `package.json:1-54` has no transactional email dependency today.

## What We're NOT Doing

- Creating class memberships, accepting invitations, or adding the student role from an invitation; those belong to S-05.
- Building class-code entry, code rotation, or code revocation UI; S-04 only generates the stable code required by S-05.
- Renaming, archiving, or deleting classes.
- Supporting CSV uploads, custom invitation messages, scheduled delivery, queues, or background retries.
- Allowing bearer-only redemption: S-05 must require the signed-in account email to match the invitation recipient.
- Adding homework assignment, student roster management, or any S-06 behavior.

## Implementation Approach

First normalize account capabilities into a `profile_roles` relation and preserve existing teacher behavior behind `is_teacher()` and `authorizeTeacher()`. Then add teacher-owned classes and app-managed invitation state through narrowly scoped database functions and RLS. A server-side orchestration service prepares or rotates each invitation, sends through Resend, records delivery state, and returns independent outcomes so one failure does not cancel the batch. Astro pages and React forms expose class creation and invitation management, while a public token route performs status checks and safe authentication continuation without enrolling anyone.

## Critical Implementation Details

Invitation preparation must commit before the external email call, and delivery outcome must be recorded afterward; a database transaction must never span the Resend request. Resending keeps the invitation row identity but rotates its token digest and expiry before delivery, so every previously delivered link becomes invalid even when the new delivery fails. Store only a cryptographic token digest, never the bearer token or Resend error details that may contain recipient data.

## Phase 1: Dual-Role and Auth Foundation

### Overview

Replace the single-role authorization source with additive role membership and implement the roadmap's safe return-destination contract.

### Changes Required:

#### 1. Role persistence and authorization

**File**: `supabase/migrations/20261001120000_add_profile_roles.sql`

**Intent**: Introduce normalized account capabilities so one user can retain teacher access while later becoming a student. Migrate every existing profile role before removing the obsolete single-role column.

**Contract**: `profile_roles(user_id, role, created_at)` has a unique `(user_id, role)` key and only `teacher` or `student` values. `handle_new_user()` creates the profile and initial teacher role for self-registration; `is_teacher()` checks role membership. Existing exercise policies and functions continue to call the unchanged `is_teacher()` signature.

**File**: `src/lib/services/teacher-authorization.ts`

**Intent**: Read additive role membership without changing the authorization result consumed by teacher pages and APIs.

**Contract**: `authorizeTeacher()` retains its four existing statuses; any account with a teacher role returns `authorized-teacher`, including an account that also has a student role.

#### 2. Safe authentication continuation

**File**: `src/lib/auth/return-destination.ts`

**Intent**: Centralize validation so authentication can resume a complete internal path without creating an open redirect.

**Contract**: Accept only same-origin relative paths beginning with exactly one `/`, preserve path plus query, and return the signed-in fallback for missing, malformed, protocol-relative, or external values.

**File**: `src/middleware.ts`

**Intent**: Attach the original protected path and query to sign-in redirects.

**Contract**: Protected-route redirects use a single encoded `return_to` value produced from `pathname + search`; public invitation landing remains reachable before authentication.

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: Carry the validated destination through sign-in, signup, errors, and confirmation without dropping invitation query data.

**Contract**: Auth forms submit `return_to`; handlers validate it before every redirect and use the default signed-in landing when invalid. Existing email/password behavior and error messages remain intact.

#### 3. Foundation tests

**File**: `supabase/tests/database/profile_roles.sql`, `src/lib/services/teacher-authorization.test.ts`, `src/lib/auth/return-destination.test.ts`, `src/pages/api/auth/signin.test.ts`, `src/pages/api/auth/signup.test.ts`

**Intent**: Prove migration compatibility, dual-role teacher access, and rejection of redirect attacks before class behavior depends on them.

**Contract**: Cover migrated teacher-only and student-only users, dual-role authorization, new teacher signup, complete query preservation, and malformed, absolute, and protocol-relative destinations.

### Success Criteria:

#### Automated Verification:

- Role and auth unit tests pass: `npm test -- src/lib/services/teacher-authorization.test.ts src/lib/auth/return-destination.test.ts src/pages/api/auth/signin.test.ts src/pages/api/auth/signup.test.ts`
- Role migration and RLS tests pass: `npm run db:test`
- Existing teacher authorization and exercise API tests remain green: `npm test -- src/lib/services/teacher-authorization.test.ts src/pages/api/exercises`

#### Manual Verification:

- A protected URL with a query string resumes exactly after sign-in, while an external or protocol-relative destination falls back safely.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Class and Invitation Persistence

### Overview

Create the durable, RLS-protected class and invitation model that S-04 owns and S-05 can redeem later.

### Changes Required:

#### 1. Class and invitation schema

**File**: `supabase/migrations/20261001130000_add_classes_and_invitations.sql`

**Intent**: Persist teacher-owned classes, generated codes, and one current invitation per normalized email and class.

**Contract**: `classes` stores immutable `teacher_id`, trimmed `name`, unique generated class code, and timestamps. `class_invitations` stores class ownership by foreign key, normalized recipient email, token digest, seven-day expiry, delivery state, provider message ID, sent timestamp, optional future redemption fields, and timestamps. There is no membership table in this phase.

#### 2. Atomic database operations

**File**: `supabase/migrations/20261001130000_add_classes_and_invitations.sql`

**Intent**: Keep code generation, ownership checks, invitation creation, and resend rotation race-safe under concurrent requests.

**Contract**: Authenticated teacher functions create a class and prepare up to 50 invitations for an owned class. Preparation normalizes and deduplicates emails, reuses an active invitation identity, rotates token digest and expiry, and returns ordered persistence outcomes. A server-only operation records sent or failed delivery without exposing token digests to browser clients.

#### 3. RLS and database tests

**File**: `supabase/tests/database/class_invitations.sql`

**Intent**: Prove ownership isolation, invariants, resend behavior, and dual-role compatibility at the database boundary.

**Contract**: Cover teacher-only and dual-role creation, cross-teacher denial, student-only denial, class-code uniqueness, case-insensitive email uniqueness, 50-address limit, seven-day expiry, token rotation, ordered replay behavior, and absence of authenticated mutation grants outside approved functions.

### Success Criteria:

#### Automated Verification:

- Class and invitation migrations apply from a clean local database: `npx supabase db reset`
- Class invitation invariants and RLS tests pass: `npm run db:test`
- Existing exercise persistence and approval database tests remain green: `npm run db:test`

#### Manual Verification:

- Supabase inspection shows no class membership table and no plaintext invitation token while each class has a generated unique code.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Class and Delivery APIs

### Overview

Expose typed teacher operations and synchronous Resend delivery with independent per-address results.

### Changes Required:

#### 1. Shared contracts and validation

**File**: `src/types.ts`, `src/lib/classes/schemas.ts`

**Intent**: Define one request and response vocabulary for class creation, class listing, batch invitations, and landing-page status.

**Contract**: Class names are trimmed and non-empty; invite requests contain one to 50 unique normalized emails. Batch results preserve input order and distinguish newly sent, refreshed-and-sent, and delivery-failed addresses without returning bearer tokens or provider diagnostics.

#### 2. Resend integration

**File**: `package.json`, `package-lock.json`, `astro.config.mjs`, `.env.example`, `src/lib/services/resend-class-invitation.ts`

**Intent**: Add a testable transactional mail adapter for Polish invitation emails containing the stable app invitation URL.

**Contract**: Add the Resend SDK plus optional server-only `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and public app-origin configuration. The service accepts an injected client/clock, returns a provider message ID on success, classifies provider failures without leaking details, and escapes all rendered class data.

#### 3. Class and invitation handlers

**File**: `src/pages/api/classes/create.ts`, `src/pages/api/classes/list.ts`, `src/pages/api/classes/invite.ts`, `src/lib/services/class-invitations.ts`

**Intent**: Authorize teacher operations, coordinate persistence and delivery, and return actionable partial outcomes.

**Contract**: Handlers follow the existing dependency-injected `APIRoute` factory pattern. The invite service prepares each invitation, sends its plaintext token once, records delivery state, and continues after recipient-specific failures. Missing provider configuration returns a typed service-unavailable error before rotating invitations.

#### 4. API and service tests

**File**: `src/lib/services/resend-class-invitation.test.ts`, `src/lib/services/class-invitations.test.ts`, `src/pages/api/classes/create.test.ts`, `src/pages/api/classes/list.test.ts`, `src/pages/api/classes/invite.test.ts`

**Intent**: Verify contracts without live Supabase or Resend calls.

**Contract**: Cover authorization states, invalid class names and batches, class ownership, configuration failure, mixed delivery outcomes, duplicate refresh, token non-disclosure, ordered results, and sanitized provider failures.

### Success Criteria:

#### Automated Verification:

- Class API and invitation service tests pass: `npm test -- src/lib/services/resend-class-invitation.test.ts src/lib/services/class-invitations.test.ts src/pages/api/classes`
- Type-aware lint passes for the new contracts and handlers: `npm run lint`
- Production SSR build accepts the new environment schema and routes: `npm run build`

#### Manual Verification:

- A Resend test-domain request produces a Polish email with the expected class name and stable app invitation URL, with no token logged or returned by the API.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Teacher and Recipient UI

### Overview

Add the usable teacher workflow and a safe non-enrolling destination for emailed links.

### Changes Required:

#### 1. Teacher class workspace

**File**: `src/pages/classes/index.astro`, `src/components/classes/ClassWorkspace.tsx`, `src/components/classes/CreateClassForm.tsx`, `src/components/classes/InviteStudentsForm.tsx`

**Intent**: Let authorized teachers create a class, view their classes and generated codes, paste a classroom-sized email batch, and understand every delivery outcome.

**Contract**: The form accepts comma- or newline-separated addresses, previews normalized unique recipients, enforces the 50-address limit, prevents duplicate submissions, and renders sent, refreshed, and failed statuses per address. No rename, archive, delete, roster, or join controls are present.

**File**: `src/pages/dashboard.astro`, `src/middleware.ts`

**Intent**: Make class management discoverable and protect it with the existing authenticated-route mechanism plus page-level teacher authorization.

**Contract**: Dashboard navigation links to `/classes`; the route is protected, and student-only users receive the established forbidden behavior while dual-role users retain teacher access.

#### 2. Invitation landing

**File**: `src/pages/classes/join.astro`, `src/lib/services/class-invitation-status.ts`

**Intent**: Give every email link a stable, privacy-preserving destination without implementing enrollment.

**Contract**: The public page handles missing, malformed, expired, superseded, delivery-failed, valid, and email-mismatch states. An unauthenticated valid link offers sign-in/signup with the complete invitation URL as `return_to`; an authenticated matching account sees that the invitation is ready but not yet joinable. It never exposes recipient email, token digest, teacher identity, or whether an unrelated account exists.

#### 3. UI and page tests

**File**: `src/components/classes/ClassWorkspace.test.tsx`, `src/components/classes/InviteStudentsForm.test.tsx`, `src/lib/services/class-invitation-status.test.ts`

**Intent**: Cover parsing, state transitions, accessibility, and recipient-state privacy before browser verification.

**Contract**: Test mixed separators, normalization, duplicates, over-limit input, pending lockout, partial results, retry, link-state messages, matching-email checks, and absence of sensitive values.

### Success Criteria:

#### Automated Verification:

- Class workspace and invitation landing tests pass: `npm test -- src/components/classes src/lib/services/class-invitation-status.test.ts`
- Full application tests pass: `npm test`
- Lint and production build pass with the new pages: `npm run lint && npm run build`

#### Manual Verification:

- At desktop and mobile widths, a teacher can create a class and process a mixed invitation batch without overlap, clipped text, ambiguous status, or lost keyboard focus.
- Valid, expired, superseded, mismatched, and unauthenticated invitation links show the correct Polish state without creating membership.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 5: Integrated Verification

### Overview

Run the complete repository gates and record the real Resend, auth-continuation, and boundary checks needed before implementation review.

### Changes Required:

#### 1. Verification record

**File**: `context/changes/invite-students-to-class/manual-verification.md`

**Intent**: Record environment, accounts, addresses, observed outcomes, and screenshots or email evidence without storing invitation tokens or secrets.

**Contract**: Document class creation, 50-recipient validation, partial provider failure, duplicate resend invalidation, seven-day expiry, safe return destinations, dual-role teacher access, and confirmation that no membership was created.

#### 2. Existing smoke coverage

**File**: `scripts/smoke.mjs`

**Intent**: Extend the dependency-free smoke path only where class creation and authorization can be exercised deterministically without sending real email.

**Contract**: Preserve existing auth smoke behavior and require explicit test configuration for any class checks; live Resend delivery remains manual verification.

### Success Criteria:

#### Automated Verification:

- Full unit and component suite passes: `npm test`
- Full database suite passes from a clean schema: `npx supabase db reset && npm run db:test`
- Repository lint and production build pass: `npm run lint && npm run build`
- Configured smoke flow passes without a live email send: `npm run smoke`

#### Manual Verification:

- A real Resend message reaches a controlled inbox, its latest link survives authentication, and an older rotated link is rejected.
- The verification record confirms per-address partial results, email binding, dual-role teacher access, safe redirect fallback, and zero class memberships.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before implementation review.

---

## Testing Strategy

### Unit Tests:

- Validate additive role authorization and every unsafe return-destination shape.
- Test email normalization, batch deduplication, token generation/digest boundaries, provider error classification, and ordered partial results with injected dependencies.
- Exercise React parsing, pending, success, partial-failure, retry, and accessibility states.

### Integration Tests:

- Use pgTAP to prove role migration, teacher ownership, cross-teacher isolation, class-code uniqueness, invitation rotation, expiry, and restricted grants.
- Use handler tests with mocked Supabase functions and Resend adapter to prove HTTP status and response contracts without network calls.
- Keep one configured smoke path for existing auth plus deterministic class authorization and creation.

### Manual Testing Steps:

1. Sign in as a teacher, create a named class, and confirm its generated code and empty invitation state.
2. Paste valid, duplicate, malformed, and provider-failing addresses; confirm input validation and independent outcomes.
3. Resend one active invitation; confirm the prior URL becomes invalid and the new URL remains valid for seven days.
4. Open the new URL signed out, sign in with the matching email, and confirm the exact path and query resume at the non-enrolling page.
5. Repeat with a mismatched account and unsafe `return_to`; confirm no recipient data leaks and fallback navigation is used.
6. Give one account both roles and confirm teacher class access still works while no class membership exists.

## Performance Considerations

The batch is deliberately capped at 50 addresses. Delivery remains synchronous and independent per recipient; avoid unbounded parallel requests and use a small fixed concurrency so Cloudflare and Resend limits are respected. Index class ownership, unique class code, active class/email identity, and invitation token digest for the S-04 and future S-05 lookup paths.

## Migration Notes

The role migration must copy every existing `profiles.role` value into `profile_roles` before removing the old column, then replace `handle_new_user()` and `is_teacher()` in the same migration so no deployed state references a missing source. Existing teacher-only users remain teacher-only; existing student-only users remain student-only. The migration is not reversibly representable after an account gains both roles, so rollback requires restoring from backup or explicitly choosing one role per dual-role account.

## References

- Product requirements: `context/foundation/prd.md:59-68`, `context/foundation/prd.md:105-113`
- Roadmap slice and boundary: `context/foundation/roadmap.md:130-147`
- Existing role and RLS foundation: `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql:1-103`
- Existing teacher authorization: `src/lib/services/teacher-authorization.ts:1-38`
- Existing API handler pattern: `src/pages/api/exercises/approve.ts:32-122`
- Existing API test pattern: `src/pages/api/exercises/approve.test.ts:1-130`
- Existing database test pattern: `supabase/tests/database/exercise_verification_approval.sql:1-150`
- Existing auth redirects: `src/middleware.ts:1-25`, `src/pages/api/auth/signin.ts:1-20`, `src/pages/api/auth/signup.ts:1-20`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Dual-Role and Auth Foundation

#### Automated

- [x] 1.1 Role and auth unit tests pass: `npm test -- src/lib/services/teacher-authorization.test.ts src/lib/auth/return-destination.test.ts src/pages/api/auth/signin.test.ts src/pages/api/auth/signup.test.ts` — 3f5ec6e
- [x] 1.2 Role migration and RLS tests pass: `npm run db:test` — 3f5ec6e
- [x] 1.3 Existing teacher authorization and exercise API tests remain green: `npm test -- src/lib/services/teacher-authorization.test.ts src/pages/api/exercises` — 3f5ec6e

#### Manual

- [x] 1.4 A protected URL with a query string resumes exactly after sign-in, while an external or protocol-relative destination falls back safely. — 3f5ec6e

### Phase 2: Class and Invitation Persistence

#### Automated

- [x] 2.1 Class and invitation migrations apply from a clean local database: `npx supabase db reset`
- [x] 2.2 Class invitation invariants and RLS tests pass: `npm run db:test`
- [x] 2.3 Existing exercise persistence and approval database tests remain green: `npm run db:test`

#### Manual

- [x] 2.4 Supabase inspection shows no class membership table and no plaintext invitation token while each class has a generated unique code.

### Phase 3: Class and Delivery APIs

#### Automated

- [ ] 3.1 Class API and invitation service tests pass: `npm test -- src/lib/services/resend-class-invitation.test.ts src/lib/services/class-invitations.test.ts src/pages/api/classes`
- [ ] 3.2 Type-aware lint passes for the new contracts and handlers: `npm run lint`
- [ ] 3.3 Production SSR build accepts the new environment schema and routes: `npm run build`

#### Manual

- [ ] 3.4 A Resend test-domain request produces a Polish email with the expected class name and stable app invitation URL, with no token logged or returned by the API.

### Phase 4: Teacher and Recipient UI

#### Automated

- [ ] 4.1 Class workspace and invitation landing tests pass: `npm test -- src/components/classes src/lib/services/class-invitation-status.test.ts`
- [ ] 4.2 Full application tests pass: `npm test`
- [ ] 4.3 Lint and production build pass with the new pages: `npm run lint && npm run build`

#### Manual

- [ ] 4.4 At desktop and mobile widths, a teacher can create a class and process a mixed invitation batch without overlap, clipped text, ambiguous status, or lost keyboard focus.
- [ ] 4.5 Valid, expired, superseded, mismatched, and unauthenticated invitation links show the correct Polish state without creating membership.

### Phase 5: Integrated Verification

#### Automated

- [ ] 5.1 Full unit and component suite passes: `npm test`
- [ ] 5.2 Full database suite passes from a clean schema: `npx supabase db reset && npm run db:test`
- [ ] 5.3 Repository lint and production build pass: `npm run lint && npm run build`
- [ ] 5.4 Configured smoke flow passes without a live email send: `npm run smoke`

#### Manual

- [ ] 5.5 A real Resend message reaches a controlled inbox, its latest link survives authentication, and an older rotated link is rejected.
- [ ] 5.6 The verification record confirms per-address partial results, email binding, dual-role teacher access, safe redirect fallback, and zero class memberships.