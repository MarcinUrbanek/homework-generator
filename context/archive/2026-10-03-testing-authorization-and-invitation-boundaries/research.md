---
date: 2026-10-03T18:42:38+02:00
researcher: GitHub Copilot
git_commit: 28e46be021f1e700a98ec0e908ba72200914901e
branch: master
repository: 10x-homework-generator
topic: "Authorization and invitation boundaries for test rollout Phase 1"
tags: [research, authorization, invitations, supabase, testing]
status: complete
last_updated: 2026-10-03
last_updated_by: GitHub Copilot
---

# Research: Authorization and invitation boundaries for test rollout Phase 1

**Date**: 2026-10-03T18:42:38+02:00  
**Researcher**: GitHub Copilot  
**Git Commit**: 28e46be021f1e700a98ec0e908ba72200914901e  
**Branch**: master  
**Repository**: 10x-homework-generator

## Research Question

Which current application and database boundaries must Phase 1 test to prove Risk #1 (forbidden role or ownership access) and Risk #4 (invalid invitation state), and which parts of those risks are not yet implementable?

## Summary

Risk #1 is testable at two current trusted boundaries. API handlers distinguish an absent session from a signed-in account without the teacher role through `authorizeTeacher`, while database RLS and security-definer functions independently enforce teacher role and resource ownership ([src/lib/services/teacher-authorization.ts:13](../../../src/lib/services/teacher-authorization.ts#L13), [supabase/migrations/20261001130000_add_classes_and_invitations.sql:13](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L13), [supabase/migrations/20261001130000_add_classes_and_invitations.sql:95](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L95)). Existing route tests inject authorization outcomes, and existing pgTAP checks cover representative class role and ownership denials; Phase 1 should turn those examples into an explicit risk matrix without assuming that authentication implies authorization ([src/pages/api/classes/create.test.ts:29](../../../src/pages/api/classes/create.test.ts#L29), [supabase/tests/database/class_invitations.sql:123](../../../supabase/tests/database/class_invitations.sql#L123)).

Risk #4 is only partly testable against current behavior. The inspected invitation path can prove token format and digest lookup, seven-day preparation expiry, rotation to a new digest, stale delivery-write rejection, delivery-state rejection, wrong-account status, and preservation of the invitation URL through authentication ([src/lib/services/class-invitation-status.ts:46](../../../src/lib/services/class-invitation-status.ts#L46), [supabase/migrations/20261001130000_add_classes_and_invitations.sql:150](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L150), [src/pages/classes/join.astro:5](../../../src/pages/classes/join.astro#L5)). It cannot prove that an expired, replayed, or wrong-recipient invitation cannot enroll: this inspected schema has redemption columns but no membership table or acceptance operation, and the ready page explicitly defers joining ([supabase/migrations/20261001130000_add_classes_and_invitations.sql:26](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L26), [supabase/tests/database/class_invitations.sql:38](../../../supabase/tests/database/class_invitations.sql#L38), [src/pages/classes/join.astro:23](../../../src/pages/classes/join.astro#L23)). Phase 1 must not treat token rotation or stale delivery protection as proof of single-use redemption.

## Detailed Findings

### Session and role boundary

- Middleware authenticates with Supabase, stores the resulting user or `null` in `context.locals.user`, and redirects an unauthenticated request from the configured protected path prefixes. It deliberately exempts `/classes/join`; it does not load or authorize a role ([src/middleware.ts:8](../../../src/middleware.ts#L8), [src/middleware.ts:22](../../../src/middleware.ts#L22)).
- `authorizeTeacher` first requires a user, then queries that user's `teacher` row in `profile_roles`. Its observed result set is `unauthenticated`, `non-teacher`, `profile-unavailable`, or `authorized-teacher`; an authentication session alone is insufficient ([src/lib/services/teacher-authorization.ts:3](../../../src/lib/services/teacher-authorization.ts#L3), [src/lib/services/teacher-authorization.ts:13](../../../src/lib/services/teacher-authorization.ts#L13)).
- The invitation API maps no session to HTTP 401, every other non-authorized result to HTTP 403, and class ownership failure to the same generic HTTP 403 response. On this path, those responses do not include a class name, owner identity, recipient, token, or database error ([src/pages/api/classes/invite.ts:13](../../../src/pages/api/classes/invite.ts#L13), [src/pages/api/classes/invite.ts:132](../../../src/pages/api/classes/invite.ts#L132), [src/pages/api/classes/invite.ts:151](../../../src/pages/api/classes/invite.ts#L151)).
- Existing API tests cover injected authorization statuses across the class and exercise handlers, so they verify response translation but not a live composition of session lookup, profile-role query, and route handling. For example, the class-create matrix injects three denial statuses, and the invitation ownership case injects the domain error ([src/pages/api/classes/create.test.ts:29](../../../src/pages/api/classes/create.test.ts#L29), [src/pages/api/classes/invite.test.ts:90](../../../src/pages/api/classes/invite.test.ts#L90)).

### Database authorization and ownership boundary

- The `classes` SELECT policy requires both `is_teacher()` and `teacher_id = auth.uid()`. In the inspected class path, a signed-in student and a different teacher therefore fail for distinct reasons while a dual-role account retains teacher capability ([supabase/migrations/20261001130000_add_classes_and_invitations.sql:13](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L13), [supabase/tests/database/class_invitations.sql:123](../../../supabase/tests/database/class_invitations.sql#L123), [supabase/tests/database/class_invitations.sql:143](../../../supabase/tests/database/class_invitations.sql#L143)).
- `prepare_class_invitations` repeats authorization inside its security-definer boundary: it requires an authenticated teacher and then verifies that the class belongs to that user before reading or mutating invitation state ([supabase/migrations/20261001130000_add_classes_and_invitations.sql:95](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L95), [supabase/migrations/20261001130000_add_classes_and_invitations.sql:113](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L113)).
- Authenticated clients have SELECT privilege on `classes` subject to RLS, but no direct table privilege on `class_invitations`. Invitation preparation is exposed through its checked RPC; delivery recording is granted to `service_role`, not authenticated clients ([supabase/migrations/20261001130000_add_classes_and_invitations.sql:21](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L21), [supabase/migrations/20261001130000_add_classes_and_invitations.sql:53](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L53), [supabase/migrations/20261001130000_add_classes_and_invitations.sql:239](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L239)).
- The class pgTAP suite already checks another teacher's empty class view and rejected invitation preparation, student-only class creation denial, dual-role class creation, invitation-table privileges, and delivery-function grants ([supabase/tests/database/class_invitations.sql:123](../../../supabase/tests/database/class_invitations.sql#L123), [supabase/tests/database/class_invitations.sql:136](../../../supabase/tests/database/class_invitations.sql#L136), [supabase/tests/database/class_invitations.sql:158](../../../supabase/tests/database/class_invitations.sql#L158)). The missing risk-level assertion on this path is student-only invitation preparation denial; the current student assertion exercises class creation, not `prepare_class_invitations`.

### Invitation lifecycle before enrollment

- Preparation stores a lowercase recipient and a 64-character lowercase-hex digest, not the plaintext bearer token. Creating an invitation sets expiry to `now() + interval '7 days'`; refreshing the same class and normalized email preserves the row identity, replaces the digest, resets expiry, and returns delivery state to pending ([supabase/migrations/20261001130000_add_classes_and_invitations.sql:26](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L26), [supabase/migrations/20261001130000_add_classes_and_invitations.sql:140](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L140), [supabase/migrations/20261001130000_add_classes_and_invitations.sql:156](../../../supabase/migrations/20261001130000_add_classes_and_invitations.sql#L156)).
- The public status service validates token shape, computes SHA-256, looks up the digest with a service client, then evaluates the observed sequence: found row, unexpired timestamp, sent delivery, optional authenticated-email match. Unknown and rotated digests intentionally collapse to `invalid`; a matching normalized email produces `ready`, while a different email produces `email-mismatch` ([src/lib/services/class-invitation-status.ts:25](../../../src/lib/services/class-invitation-status.ts#L25), [src/lib/services/class-invitation-status.ts:46](../../../src/lib/services/class-invitation-status.ts#L46)).
- The status unit test covers malformed and missing input, unknown/rotated lookup, expired and failed-delivery rows, unauthenticated valid state, wrong email, and normalized matching email. Because the test injects the lookup record, it proves classification and non-disclosing return values, not integration with the persisted invitation row ([src/lib/services/class-invitation-status.test.ts:7](../../../src/lib/services/class-invitation-status.test.ts#L7), [src/lib/services/class-invitation-status.test.ts:20](../../../src/lib/services/class-invitation-status.test.ts#L20), [src/lib/services/class-invitation-status.test.ts:52](../../../src/lib/services/class-invitation-status.test.ts#L52)).
- The database suite proves digest replacement on refresh and rejects a stale digest when recording a delivery result. That boolean rejection prevents an old provider response from overwriting current delivery state; it does not consume an invitation and therefore is not a bearer-token replay test ([supabase/tests/database/class_invitations.sql:99](../../../supabase/tests/database/class_invitations.sql#L99), [supabase/tests/database/class_invitations.sql:190](../../../supabase/tests/database/class_invitations.sql#L190)).

### Authentication continuation

- The join page includes its complete path and query in a `return_to` parameter. The sign-in and sign-up handlers pass that value through `returnDestination`, preserving a same-origin invitation path and falling back for unsafe destinations ([src/pages/classes/join.astro:7](../../../src/pages/classes/join.astro#L7), [src/pages/api/auth/signin.ts:17](../../../src/pages/api/auth/signin.ts#L17), [src/pages/api/auth/signup.ts:17](../../../src/pages/api/auth/signup.ts#L17)).
- Existing auth tests cover preservation through successful sign-in, sign-in failure, signup confirmation, and unsafe destination fallback on their respective inspected paths ([src/pages/api/auth/signin.test.ts:37](../../../src/pages/api/auth/signin.test.ts#L37), [src/pages/api/auth/signup.test.ts:39](../../../src/pages/api/auth/signup.test.ts#L39), [src/lib/auth/return-destination.test.ts:5](../../../src/lib/auth/return-destination.test.ts#L5)).

### Phase 1 planning handoff

The plan can use the following current contracts without rediscovery:

| Risk slice                                                                   | Cheapest current signal                                  | Required assertions                                                                                                 | Existing baseline                                             | Gap Phase 1 should close                                                                                                             |
| ---------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Signed-in student reaches teacher action                                     | Handler integration plus authorization service unit      | HTTP 403, generic body, no downstream business/provider call                                                        | Injected denial matrices in class and exercise route tests    | Name the teacher-only endpoint set in the plan and ensure each distinct downstream boundary has one representative no-call assertion |
| Teacher crosses class ownership                                              | pgTAP plus invitation handler error translation          | No class rows; RPC raises `42501`; API maps ownership failure to generic 403                                        | Class RLS/RPC and mocked route mapping tests                  | Add no duplicate test unless the plan introduces a connected API/database harness                                                    |
| Dual-role account uses teacher capability                                    | pgTAP                                                    | Teacher function succeeds while ownership isolation remains                                                         | Class creation succeeds for the dual-role fixture             | Add invitation preparation for the dual-role fixture only if that function is selected as the representative boundary                |
| Student calls invitation preparation directly                                | pgTAP                                                    | RPC raises `42501`; no invitation mutation                                                                          | Student class creation denial exists                          | Add the direct preparation denial because the current suite does not exercise that RPC as the student fixture                        |
| Expired, rotated, failed-delivery, or wrong-account link reaches status page | Status service test plus focused persistence integration | Correct generic status; no recipient data; rotated digest no longer resolves                                        | Classification unit test and digest-rotation pgTAP assertions | Add a connected persisted-row status check only if the test harness can provide the server service client cheaply                    |
| Invitation path survives authentication                                      | Auth handler tests                                       | Exact safe path and query preserved on success and failure; unsafe destination rejected                             | Sign-in, signup, and destination tests                        | Retain existing tests unless a join-page rendering test is needed to connect link generation to the auth forms                       |
| Same token enrolls twice, expired token enrolls, or wrong account enrolls    | Not currently available                                  | Atomic membership insert and redemption; expiry, recipient, and `redeemed_at is null` checked in the same operation | No acceptance operation or membership table                   | Defer to the change that implements S-05 acceptance; Phase 1 must record this as uncovered rather than simulate it                   |

## Architecture Insights

- Authorization is intentionally layered: middleware establishes identity, handlers translate role authorization to HTTP semantics, and RLS/security-definer functions protect persisted resources. Tests should preserve those separate responsibilities rather than infer database ownership from a handler mock.
- Invitation lookup is server-mediated because authenticated and anonymous roles cannot read the invitation table. Its public contract is a coarse status enum; recipient data stays behind the service-role lookup.
- Rotation and redemption are separate concepts in the current model. Rotation replaces the active digest, while the unused `redeemed_at` and `redeemed_by` pair reserves state for a future acceptance transaction.

## Historical Context

- **Supported**: The archived invitation plan assigned S-04 a non-enrolling landing page and deferred membership creation to S-05 ([context/archive/2026-10-01-invite-students-to-class/plan.md:28](../../archive/2026-10-01-invite-students-to-class/plan.md#L28), [context/archive/2026-10-01-invite-students-to-class/plan.md:156](../../archive/2026-10-01-invite-students-to-class/plan.md#L156)). Current code and the database test agree with that boundary.
- **Supported for the inspected status path**: The archived plan required seven-day expiry, digest rotation, recipient-email matching after authentication, and exact internal return-path preservation ([context/archive/2026-10-01-invite-students-to-class/plan.md:95](../../archive/2026-10-01-invite-students-to-class/plan.md#L95), [context/archive/2026-10-01-invite-students-to-class/plan.md:154](../../archive/2026-10-01-invite-students-to-class/plan.md#L154)). Current preparation, status classification, and auth handlers implement those pre-enrollment behaviors.
- **Partial, not an acceptance guarantee**: Archived manual verification reports that expired and rotated links were rejected and a mismatched account received no recipient data ([context/archive/2026-10-01-invite-students-to-class/manual-verification.md:45](../../archive/2026-10-01-invite-students-to-class/manual-verification.md#L45)). Those observations validate the S-04 landing behavior; because S-04 has no enrollment operation, they do not prove expiry, replay, or recipient binding at membership creation.

## Code References

- `src/middleware.ts:8-30` - Identity resolution and protected-route redirect.
- `src/lib/services/teacher-authorization.ts:13-45` - Teacher-role authorization result contract.
- `src/pages/api/classes/invite.ts:122-155` - Invitation API authorization and error translation.
- `src/lib/services/class-invitation-status.ts:46-68` - Public token status classification.
- `src/pages/classes/join.astro:5-29` - Non-enrolling invitation landing page and auth continuation.
- `supabase/migrations/20261001130000_add_classes_and_invitations.sql:13-242` - Class RLS, invitation schema, checked preparation, rotation, delivery recording, and grants.
- `supabase/tests/database/class_invitations.sql:1-202` - Existing pgTAP evidence for class and invitation boundaries.

## Related Research

No other research artifact was required to answer this phase's authorization and invitation questions.

## Open Questions

1. Which future S-05 operation will atomically create membership and set `redeemed_at`/`redeemed_by`? Its transaction must be the target for expiry, recipient, and same-token replay tests.
2. Will Phase 1 introduce a server-backed API integration harness, or retain handler tests and pgTAP as separate trusted-boundary checks? A connected test is useful only if it adds signal beyond the existing injected handler and database assertions.
3. Which teacher-only API entry points are in the explicit Phase 1 denial matrix? The plan should name the selected set and justify representative coverage where handlers share `authorizeTeacher`.
