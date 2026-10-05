# Invite Students to a Class — Plan Brief

> Full plan: `context/changes/invite-students-to-class/plan.md`

## What & Why

Build roadmap slice S-04 so a teacher can create a class and invite students by email. This establishes the secure class and invitation foundation required by the later student-join and homework slices without implementing enrollment early.

## Starting Point

The app already supports Supabase email/password sessions, teacher-only exercise workflows, typed Astro API handlers, and RLS tests. It has no class or invitation domain, no email provider, no invitation landing page, and only one role per account; protected-route redirects also lose the requested destination.

## Desired End State

A teacher creates a name-only class with a generated code, pastes up to 50 student emails, and sees an independent delivery result for each address. Resend delivers seven-day, email-bound links whose secrets rotate on resend; links survive authentication and reach a non-enrolling Polish status page. No student role or class membership is created in S-04.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Delivery | App-managed Resend email | Keeps invitation lifecycle under app control for new and existing accounts. |
| Class identity | Name only plus generated code | Minimizes teacher input while avoiding an S-05 backfill. |
| Invitation validity | Seven days | Balances school-week onboarding with leaked-link exposure. |
| Duplicate invitation | Reuse row, rotate secret and expiry | Prevents duplicate pending records and invalidates older links. |
| Batch input | Up to 50 comma/newline-separated emails | Fits a classroom without CSV complexity. |
| Batch failures | Per-address outcomes | One invalid address or provider failure does not block the class. |
| Link ownership | Signed-in email must match recipient | Forwarded or leaked links cannot enroll another account. |
| Account roles | Teacher and student capabilities may coexist | A person can participate in both contexts without losing teacher data. |
| Recipient surface | Non-enrolling landing page | Emails never lead to a 404 while S-05 still owns enrollment. |
| Class lifecycle | Create and view only | Avoids premature destructive and archival semantics. |

## Scope

**In scope:** Additive roles; safe authentication continuation; teacher-owned classes and generated codes; hashed, expiring, rotating invitations; Resend delivery with per-address outcomes; teacher and recipient surfaces; automated and manual verification.

**Out of scope:** Student role grants, redemption, memberships, class-code entry, code lifecycle controls, class editing or deletion, rosters, CSV, queues, custom messages, and homework assignment.

## Architecture / Approach

Normalize roles into `profile_roles`, preserving `is_teacher()` and `authorizeTeacher()` as stable gates. Database functions create classes and prepare or rotate invitation state under teacher ownership; the server sends each prepared link through Resend and records delivery outcome afterward. Teacher Astro/React surfaces consume typed APIs, while a public token-status page validates links and carries a strictly relative `return_to` through authentication without enrolling the account.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dual-role and auth foundation | Additive roles and safe auth continuation | Regressing current teacher access or enabling open redirects. |
| 2. Class and invitation persistence | RLS-protected classes, codes, and rotating invites | Race conditions or plaintext token exposure. |
| 3. Class and delivery APIs | Typed class operations and Resend partial results | Divergence between persistence and provider delivery state. |
| 4. Teacher and recipient UI | Usable class workspace and stable landing page | Crossing into S-05 enrollment or leaking recipient data. |
| 5. Integrated verification | Full gates and recorded live-email evidence | Environment-specific Resend or local Supabase setup. |

**Prerequisites:** Local Supabase/Docker for database gates; a Resend account, verified sender or test domain, and Cloudflare/local secrets for live delivery verification.
**Estimated effort:** About 5-7 focused implementation sessions across five gated phases.

## Open Risks & Assumptions

- Resend sender-domain verification and production credentials are external prerequisites; provider setup can block only the live manual gate.
- Synchronous batches need bounded concurrency to remain within Cloudflare and Resend limits; the 50-address cap is fixed for this slice.
- Role normalization is not automatically reversible after a user gains both roles.
- S-05 must consume the exact email-bound token and class-code contracts without weakening them.

## Success Criteria (Summary)

- A teacher can create and view a class, submit up to 50 emails, and understand each sent, refreshed, or failed outcome.
- Latest invitation links are hashed at rest, expire after seven days, survive safe authentication continuation, and reject superseded or mismatched use.
- Existing teacher exercise workflows and RLS remain green, dual-role accounts keep teacher access, and S-04 creates no membership.