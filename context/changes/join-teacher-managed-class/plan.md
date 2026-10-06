# Join Teacher-Managed Class Implementation Plan

## Overview

Deliver roadmap slice S-05: a signed-in student can inspect and join a teacher-managed class through either its class code or an email-bound invitation link. The change adds the membership and student-role boundary required by later homework assignment work while keeping roster and membership management out of scope.

## Current State Analysis

S-04 already provides additive teacher/student roles, teacher-owned classes with unique eight-character codes, email-bound seven-day invitation tokens, safe authentication continuation, and a public invitation-status page. It deliberately creates no membership and does not redeem invitations. The current `/classes` page is teacher-only, profiles contain no display identity, and `/classes/join` stops after reporting that a matching invitation is ready.

The existing invitation status check is useful for presentation but is not an enrollment guarantee. Membership creation, student-role grant, invitation eligibility, redemption, and idempotency must be decided again inside one authenticated database transaction.

## Desired End State

A signed-in account can enter a class code or open a matching invitation, preview the class name and the teacher's display name when available, and explicitly confirm before joining. Confirmation atomically adds the student role, creates at most one membership per account and class, and consumes an eligible invitation without removing an existing teacher role. Same-student retries return the existing membership; a redeemed link cannot enroll anyone else.

Students can belong to multiple classes and revisit a protected list of their joined classes. Existing teachers without a display name do not block joining: previews temporarily show only the class name and class management prompts the teacher to add a reusable display name.

### Key Discoveries:

- `context/foundation/prd.md:59-68` requires both class-code and direct-link joining, including exact invitation-path continuation through authentication.
- `supabase/migrations/20261001130000_add_classes_and_invitations.sql:24-50` reserves redemption fields but has no membership relation or acceptance operation.
- `src/lib/services/class-invitation-status.ts:46-75` classifies pre-enrollment token state through a service client; it does not prove replay-safe acceptance.
- `supabase/migrations/20261001120000_add_profile_roles.sql:1-38` makes roles additive, so enrollment can grant `student` without removing `teacher`.
- `src/pages/classes/index.astro:1-45` is currently teacher-only, while `src/pages/classes/join.astro:1-52` is a public, non-enrolling invitation landing page.
- `context/foundation/test-plan.md:49-55` requires invitation acceptance guarantees to be tested at the future atomic S-05 operation rather than inferred from status-page behavior.

## What We're NOT Doing

- Adding student self-removal, teacher removal, roster management, membership approval queues, or class-code rotation and revocation.
- Exposing teacher email, invitation recipient email, roster contents, membership counts, or another student's membership.
- Adding class detail, homework assignment, submissions, scoring, or other S-06 and later behavior.
- Limiting an account to one class or removing teacher capability when the account gains the student role.
- Automatically enrolling on page load or code submission; the later preview-then-confirm decision supersedes the earlier immediate-code-join choice.
- Reworking invitation delivery, expiry duration, token rotation, or safe authentication continuation established by S-04.

## Implementation Approach

Extend the database with an optional teacher display name and a `class_memberships` relation keyed by class and user. Security-definer database functions own code preview, invitation preview, atomic acceptance, display-name updates, and joined-class reads so browser clients receive only the minimum class/teacher summary and cannot compose a partial enrollment.

Expose those operations through typed, dependency-injected Astro handlers. Rework the join page into a public invitation entry that resumes authentication and presents explicit confirmation, add a signed-in class-code form using the same preview/confirm model, and provide a protected joined-classes page. Keep teacher class management separate while adding a display-name prompt and links between the role-specific surfaces.

## Critical Implementation Details

Acceptance must re-lock and revalidate code or invitation eligibility in PostgreSQL at confirmation time; a successful preview is never authorization to enroll. Invitation redemption, idempotent membership insertion, and student-role grant must commit together, with same-user retries succeeding only when the existing membership matches the target class.

## Phase 1: Identity and Membership Persistence

### Overview

Create the durable identity, membership, authorization, preview, and atomic acceptance contracts before exposing new HTTP behavior.

### Changes Required:

#### 1. Teacher display identity and class membership schema

**File**: `supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql`

**Intent**: Add a reusable, teacher-controlled display identity and persist the student-to-class relationship required by downstream assignment authorization.

**Contract**: `profiles.display_name` is nullable for existing accounts and, when present, is trimmed, non-empty, and length-bounded. `class_memberships(class_id, student_id, joined_at)` has one row per class and account, cascades with the class or account, and allows authenticated students to read only their own memberships. Existing teacher class ownership and role policies remain valid.

#### 2. Checked preview and mutation functions

**File**: `supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql`

**Intent**: Keep teacher identity disclosure and enrollment state changes behind narrow authenticated database boundaries.

**Contract**: Checked functions normalize class codes, return only class ID, class name, nullable teacher display name, and the caller's membership state, and list only the caller's joined classes. A teacher-only display-name function updates the authenticated teacher's profile without granting direct profile mutation.

**Contract**: Code acceptance grants `student` and inserts membership atomically. Invitation acceptance locks the current digest row, requires sent delivery, unexpired state, normalized authenticated-email equality, and an unredeemed or same-user redemption, then grants the role, inserts membership, and records `redeemed_at`/`redeemed_by` in one transaction. Same-user repeats for the same class return the existing membership; conflicting redemption is denied without disclosing recipient data.

#### 3. Database risk tests

**File**: `supabase/tests/database/class_memberships.sql`, `supabase/tests/database/profile_roles.sql`, `supabase/tests/database/class_invitations.sql`

**Intent**: Prove the trusted membership boundary against the authorization and invitation risks recorded in the test plan.

**Contract**: Cover code normalization and invalid-code non-disclosure, explicit confirmation functions, multiple-class membership, per-class uniqueness, additive dual roles, own-membership reads, cross-student and cross-teacher denial, nullable and updated teacher display names, expiry at acceptance time, wrong-recipient denial, failed or pending delivery, rotated tokens, atomic redemption, same-user idempotency, and replay denial for another account.

### Success Criteria:

#### Automated Verification:

- New schema applies from a clean local database: `npx supabase db reset`
- Membership, role, invitation, and existing database assertions pass: `npm run db:test`

#### Manual Verification:

- Supabase inspection shows no duplicate membership, no plaintext token, no teacher email in join results, and existing unnamed teachers remain valid accounts.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Join and Membership APIs

### Overview

Expose typed preview, confirmation, profile, and joined-class contracts without moving enrollment logic out of the database transaction.

### Changes Required:

#### 1. Shared join contracts and validation

**File**: `src/types.ts`, `src/lib/classes/schemas.ts`

**Intent**: Define one response vocabulary for class previews, accepted or existing memberships, joined-class summaries, display-name updates, and privacy-preserving errors.

**Contract**: Class codes are trimmed and normalized to uppercase; tokens retain the existing 64-character lowercase-hex contract. Preview summaries contain class name, nullable teacher display name, and caller membership state only. Join results distinguish newly joined from existing membership without exposing invitation, recipient, owner, or database details.

#### 2. Invitation preview evolution

**File**: `src/lib/services/class-invitation-status.ts`, `src/lib/services/class-invitation-status.test.ts`

**Intent**: Preserve existing coarse public states while providing a valid matching account the agreed class and teacher preview and recognizing same-user completed membership.

**Contract**: Missing, malformed, unknown, rotated, expired, undelivered, and mismatched links remain non-disclosing. A ready invitation returns only the safe preview; a link already redeemed by the same joined account resolves to the existing-membership state, while conflicting redemption is unavailable.

#### 3. Class join and membership handlers

**File**: `src/pages/api/classes/preview-code.ts`, `src/pages/api/classes/join-by-code.ts`, `src/pages/api/classes/accept-invitation.ts`, `src/pages/api/classes/joined.ts`

**Intent**: Translate authentication, validation, database outcomes, and idempotent success into stable HTTP contracts using the existing injected-handler pattern.

**Contract**: Preview never mutates. Both acceptance routes require authentication and POST confirmation, call the atomic database functions, return the joined class destination on new or existing membership, and collapse unknown, stale, wrong-recipient, and conflicting credentials into non-disclosing errors. The list route returns only memberships owned by the authenticated caller.

#### 4. Teacher display-name handler

**File**: `src/pages/api/profile/display-name.ts`

**Intent**: Let an authenticated teacher set or revise the reusable identity shown in join previews.

**Contract**: The dependency-injected POST handler validates the bounded display name, calls the checked teacher function, and maps unauthenticated, non-teacher, validation, and persistence failures without exposing profile internals.

#### 5. Handler tests

**File**: `src/pages/api/classes/preview-code.test.ts`, `src/pages/api/classes/join-by-code.test.ts`, `src/pages/api/classes/accept-invitation.test.ts`, `src/pages/api/classes/joined.test.ts`, `src/pages/api/profile/display-name.test.ts`

**Intent**: Verify HTTP and skipped-work behavior independently from the database integration assertions.

**Contract**: Cover authentication, malformed credentials, preview without mutation, explicit confirmation, new and idempotent success, normalized code input, generic failure responses, joined-class ownership, display-name validation, and absence of email, token, digest, teacher ID, and database details in browser responses.

### Success Criteria:

#### Automated Verification:

- Join, membership, display-name, and invitation-status tests pass: `npm test -- src/pages/api/classes src/pages/api/profile src/lib/services/class-invitation-status.test.ts`
- Existing authentication and class invitation tests remain green: `npm test -- src/pages/api/auth src/pages/api/classes/invite.test.ts src/lib/auth/return-destination.test.ts`
- Type-aware lint passes for the new contracts and handlers: `npm run lint`

#### Manual Verification:

- Direct API checks show class and optional teacher display name before confirmation, and no membership appears until the confirmation request succeeds.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Student and Teacher Class UI

### Overview

Make both join paths usable, provide durable joined-class navigation, and let teachers supply the identity shown to students.

### Changes Required:

#### 1. Invitation preview and confirmation

**File**: `src/pages/classes/join.astro`, `src/components/classes/InvitationJoinForm.tsx`

**Intent**: Replace the non-enrolling ready message with a clear preview and explicit, retry-safe join action while preserving all existing unavailable and authentication states.

**Contract**: Matching signed-in users see class name and teacher display name when present, otherwise class name alone, then choose `Dołącz`. Successful new or existing membership redirects to the joined-classes page. The UI never auto-submits on load and never renders recipient email or raw persistence details.

#### 2. Class-code entry and confirmation

**File**: `src/pages/classes/join-code.astro`, `src/components/classes/ClassCodeJoinForm.tsx`

**Intent**: Give younger students a short code path while allowing them to verify the intended class and teacher before enrollment.

**Contract**: The signed-in form accepts case-insensitive, whitespace-tolerant eight-character input, previews without mutation, and requires a separate confirmation POST. Invalid and stale codes use generic Polish copy; retries for an existing membership lead to the same success destination.

#### 3. Joined-classes surface and navigation

**File**: `src/pages/classes/joined.astro`, `src/components/classes/JoinedClasses.tsx`, `src/pages/dashboard.astro`

**Intent**: Give students a durable list of their own memberships and a discoverable route to code entry without adding roster or homework views.

**Contract**: The protected page shows each joined class name, teacher display name when available, and joined timestamp. Empty, loading, error, one-class, and multi-class states are accessible and role-neutral; dual-role users can navigate between teacher-managed and joined classes without losing either capability.

#### 4. Teacher display-name prompt

**File**: `src/pages/classes/index.astro`, `src/components/classes/ClassWorkspace.tsx`, `src/components/classes/TeacherDisplayNameForm.tsx`

**Intent**: Let teachers add the identity used in join previews while keeping legacy memberships and credentials usable before they do.

**Contract**: Class management loads the current optional display name, prompts when absent, supports later updates, and explains the student-facing effect. Missing names never block preview or acceptance and fall back to class-only display.

#### 5. UI behavior tests

**File**: `src/components/classes/InvitationJoinForm.test.tsx`, `src/components/classes/ClassCodeJoinForm.test.tsx`, `src/components/classes/JoinedClasses.test.tsx`, `src/components/classes/TeacherDisplayNameForm.test.tsx`

**Intent**: Protect the explicit-confirmation sequence, privacy boundary, retry behavior, and role-specific navigation.

**Contract**: Cover loading and disabled controls, preview-to-confirm transitions, no mutation during preview, normalized code entry, optional teacher name, class-only fallback, idempotent success, generic failures, empty and multi-class lists, keyboard focus, and sensitive-value absence.

### Success Criteria:

#### Automated Verification:

- Join and joined-class component tests pass: `npm test -- src/components/classes`
- Full application test suite passes: `npm test`
- Lint and production SSR build pass with the new pages: `npm run lint && npm run build`

#### Manual Verification:

- At desktop and mobile widths, both link and code flows show the intended class and available teacher name, require confirmation, preserve focus, and reach the joined-classes list without overlap or clipped text.
- A dual-role account can use both teacher-managed and joined-class surfaces, while an unnamed legacy teacher produces the agreed class-only preview.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Integrated Verification

### Overview

Exercise the complete server-backed join flow and record evidence for the security, migration, and usability boundaries.

### Changes Required:

#### 1. Configured class smoke flow

**File**: `scripts/smoke.mjs`

**Intent**: Extend the existing opt-in class smoke path with deterministic display-name, code preview/confirmation, and joined-list checks against a configured local Supabase instance.

**Contract**: Keep the script dependency-free and gated by explicit class-check configuration. It uses controlled accounts and generated class data, performs no live invitation email send, and verifies anonymous denial, no preview mutation, successful code confirmation, idempotent repeat, and joined-class visibility.

#### 2. Verification record

**File**: `context/changes/join-teacher-managed-class/manual-verification.md`

**Intent**: Record the environments, accounts, and observed outcomes needed for implementation review without retaining credentials, codes, invitation URLs, or personal data.

**Contract**: Cover code and invitation preview, explicit confirmation, class-only fallback, teacher display name, multiple classes, dual roles, wrong recipient, expiry, failed delivery, rotated and replayed tokens, same-user retries, cross-student isolation, and excluded roster/lifecycle behavior.

### Success Criteria:

#### Automated Verification:

- Full unit and component suite passes: `npm test`
- Full database suite passes from a clean schema: `npx supabase db reset && npm run db:test`
- Repository lint and production build pass: `npm run lint && npm run build`
- Configured class smoke flow passes without live email delivery: `$env:SMOKE_CLASS_CHECKS='true'; npm run smoke`

#### Manual Verification:

- Real code and controlled invitation flows confirm preview-before-mutation, atomic membership, idempotent same-user retry, conflicting replay denial, multi-class listing, and no private identity leakage.
- The verification record confirms join-only scope: no roster, leave, teacher removal, code rotation, or homework behavior is exposed.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before implementation review.

---

## Testing Strategy

### Unit Tests:

- Validate request normalization, typed response parsing, privacy-preserving error mapping, and preview/confirm component state.
- Challenge malformed codes and tokens, absent teacher names, retries, database failures, and accidental preview mutation.
- Keep expected values grounded in the PRD and settled plan decisions rather than mirroring production branching.

### Integration Tests:

- Use pgTAP for membership uniqueness, role grants, RLS, acceptance-time invitation checks, redemption atomicity, and replay behavior.
- Use handler tests for HTTP authentication, validation, response shape, and skipped downstream work.
- Use the configured smoke path for deployed Astro, session, RPC, and joined-list composition without requiring Resend.

### Manual Testing Steps:

1. Set a teacher display name, create a class, and confirm a signed-in student sees class and teacher before code confirmation.
2. Repeat with an unnamed teacher and confirm joining remains available with class-only preview.
3. Join two classes through code, retry one confirmation, and confirm one membership per class in the joined list.
4. Open a delivered invitation signed out, authenticate with the matching account, confirm explicitly, and retry the same link.
5. Try the invitation with a mismatched account and test expired, failed-delivery, rotated, and conflicting-replay states; confirm generic Polish responses and no recipient data.
6. Use a dual-role account and confirm both teacher management and joined-class navigation remain available.

## Performance Considerations

Class-code and token-digest lookups already have unique or indexed access paths; keep membership lookup indexed by its primary key and add only an index justified by joined-class ordering. Joined-class reads are bounded by one student's memberships and require no roster aggregation.

## Migration Notes

Add `profiles.display_name` as nullable so existing accounts and invitation links remain usable. Do not synthesize names from email or auth metadata. The new membership table begins empty; no historical membership can be inferred from invitations because S-04 explicitly did not enroll students. Rollback must remove memberships and redemption written by S-05 together; reverting only the table while retaining redeemed invitations would strand valid users.

## References

- Product requirements: `context/foundation/prd.md:59-68`, `context/foundation/prd.md:105-113`
- Roadmap slice: `context/foundation/roadmap.md:142-151`
- Test risk and acceptance handoff: `context/foundation/test-plan.md:49-55`, `context/foundation/test-plan.md:121-126`
- Prior invitation plan: `context/archive/2026-10-01-invite-students-to-class/plan.md`
- Existing class and invitation schema: `supabase/migrations/20261001130000_add_classes_and_invitations.sql`
- Existing role schema: `supabase/migrations/20261001120000_add_profile_roles.sql`
- Existing invitation status path: `src/lib/services/class-invitation-status.ts`, `src/pages/classes/join.astro`
- Existing handler pattern: `src/pages/api/classes/create.ts`, `src/pages/api/classes/invite.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Identity and Membership Persistence

#### Automated

- [x] 1.1 New schema applies from a clean local database: `npx supabase db reset` — 19365a5
- [x] 1.2 Membership, role, invitation, and existing database assertions pass: `npm run db:test` — 19365a5

#### Manual

- [x] 1.3 Supabase inspection shows no duplicate membership, no plaintext token, no teacher email in join results, and existing unnamed teachers remain valid accounts. — 19365a5

### Phase 2: Join and Membership APIs

#### Automated

- [x] 2.1 Join, membership, display-name, and invitation-status tests pass: `npm test -- src/pages/api/classes src/pages/api/profile src/lib/services/class-invitation-status.test.ts` — beedd48
- [x] 2.2 Existing authentication and class invitation tests remain green: `npm test -- src/pages/api/auth src/pages/api/classes/invite.test.ts src/lib/auth/return-destination.test.ts` — beedd48
- [x] 2.3 Type-aware lint passes for the new contracts and handlers: `npm run lint` — beedd48

#### Manual

- [x] 2.4 Direct API checks show class and optional teacher display name before confirmation, and no membership appears until the confirmation request succeeds. — beedd48

### Phase 3: Student and Teacher Class UI

#### Automated

- [x] 3.1 Join and joined-class component tests pass: `npm test -- src/components/classes` — 4b10a22
- [x] 3.2 Full application test suite passes: `npm test` — 4b10a22
- [x] 3.3 Lint and production SSR build pass with the new pages: `npm run lint && npm run build` — 4b10a22

#### Manual

- [x] 3.4 At desktop and mobile widths, both link and code flows show the intended class and available teacher name, require confirmation, preserve focus, and reach the joined-classes list without overlap or clipped text. — 4b10a22
- [x] 3.5 A dual-role account can use both teacher-managed and joined-class surfaces, while an unnamed legacy teacher produces the agreed class-only preview. — 4b10a22

### Phase 4: Integrated Verification

#### Automated

- [x] 4.1 Full unit and component suite passes: `npm test`
- [x] 4.2 Full database suite passes from a clean schema: `npx supabase db reset && npm run db:test`
- [x] 4.3 Repository lint and production build pass: `npm run lint && npm run build`
- [x] 4.4 Configured class smoke flow passes without live email delivery: `$env:SMOKE_CLASS_CHECKS='true'; npm run smoke`

#### Manual

- [x] 4.5 Real code and controlled invitation flows confirm preview-before-mutation, atomic membership, idempotent same-user retry, conflicting replay denial, multi-class listing, and no private identity leakage.
- [x] 4.6 The verification record confirms join-only scope: no roster, leave, teacher removal, code rotation, or homework behavior is exposed.
