# Authorization and Invitation Boundaries — Plan Brief

> Full plan: `context/changes/testing-authorization-and-invitation-boundaries/plan.md`
> Research: `context/changes/testing-authorization-and-invitation-boundaries/research.md`

## What & Why

This rollout strengthens tests for teacher authorization and invitation links at the boundaries where access is decided. It distinguishes HTTP handler behavior from database enforcement and proves invitation links' pre-enrollment status without pretending that the current system can create membership or prevent replay.

## Starting Point

The app has seven teacher-gated API routes, Vitest handler tests, a shared `authorizeTeacher` service, and a pgTAP class/invitation suite. Existing tests cover parts of these contracts, but every route needs a clear student-denial/no-work assertion and the database suite is missing a student-only invitation-preparation denial. Invitation classification and authentication continuation already have focused tests; the join page is server-rendered and non-enrolling.

## Desired End State

Student and non-owner access is denied by both handlers and the real database policies/functions, without protected data or side effects. Expired, rotated, undelivered, and wrong-account links produce the right coarse status before enrollment, while safe authentication return paths continue to work. Cookbook guidance records the patterns and explicitly defers membership and replay assertions to S-05 acceptance.

## Key Decisions Made

| Decision               | Choice                                                                                                                        | Why                                                                                                                    | Source          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------- |
| API role denial scope  | One signed-in student denial/no-work case for all seven teacher-gated routes                                                  | Each route owns a separate guard and can regress independently; avoid repeating the full role-state matrix everywhere. | Research + Plan |
| Authorization evidence | Handler tests for response/side effects, one real authorizer composition case, and pgTAP for RLS/security-definer enforcement | These checks keep each trust boundary visible without adding a costly live Supabase HTTP harness.                      | Research + Plan |
| Invitation scope       | Verify only pre-enrollment statuses and persisted token/delivery lifecycle; defer membership and replay assertions            | No acceptance operation or membership table exists, so status rejection cannot prove enrollment safety.                | Research        |
| Final sub-phase        | Update test-plan §6.1, §6.2, and §6.6 after tests ship                                                                        | Cookbook entries should describe actual patterns and retain their limitations.                                         | Plan            |

## Scope

**In scope:**

- Denial, non-disclosure, and skipped-work assertions for all seven teacher-only API handlers.
- Real role/ownership enforcement checks through pgTAP, including student invitation-preparation denial.
- Invitation status classification, digest/delivery lifecycle, and existing auth return-path tests.
- Final cookbook update for authorization and invitation tests.

**Out of scope:**

- Class membership creation, acceptance, redemption, and replay protection.
- A live HTTP-to-Supabase harness, browser automation, or production behavior/schema changes.
- Reworking the frozen §1-§5 test strategy or expanding other rollout risks.

## Architecture / Approach

Vitest checks route response contracts and confirms protected operations do not run; one representative handler uses the production role authorizer. pgTAP runs against local PostgreSQL with authenticated JWT claims to test RLS and security-definer enforcement. Invitation classification remains a service test, while pgTAP verifies persisted lifecycle transitions; a manual page check confirms rendered copy without implying enrollment safety.

## Phases at a Glance

| Phase                                      | What it delivers                                                       | Key risk                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Teacher-only API denials                | Seven route-level student denials and safe ownership-error mapping     | #1: handler forgets a role guard or leaks protected context                 |
| 2. Database role and ownership enforcement | Real student/non-owner denials through RLS and checked RPCs            | #1: authorization is enforced only in the app layer                         |
| 3. Invitation pre-enrollment status        | Correct coarse status, persisted lifecycle, and safe auth continuation | #4: stale or wrong-account links are misclassified or reveal recipient data |
| 4. Publish cookbook patterns               | §6 records shipped patterns and defers unsupported claims              | Future tests mistake status rejection for enrollment safety                 |

**Prerequisites:** Node dependencies installed; local Supabase/Docker available for pgTAP. Existing route, status, and auth tests provide the baseline.
**Estimated effort:** About 2-3 focused sessions, including local database verification and a final manual join-page check.

## Open Risks & Assumptions

- Handler-level tests plus pgTAP do not prove a live HTTP request composed with Supabase; this is an explicit cost/signal choice, and the cookbook must say so.
- Replay and membership guarantees remain unverified until S-05 implements an atomic acceptance operation.

## Success Criteria (Summary)

- Every teacher-only handler denies a signed-in student without protected work or protected response data, and pgTAP independently proves role and ownership controls.
- Invitation lifecycle states remain non-disclosing before enrollment, and safe return paths survive authentication.
- §6 documents the patterns and commands shipped, including the explicit membership/replay deferral.
