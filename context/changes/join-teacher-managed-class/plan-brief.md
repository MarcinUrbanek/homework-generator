# Join Teacher-Managed Class — Plan Brief

> Full plan: `context/changes/join-teacher-managed-class/plan.md`

## What & Why

Deliver roadmap slice S-05 so a signed-in student can join a teacher-managed class through either its short class code or a direct email invitation. This establishes the secure membership boundary required by homework assignment while preserving the low-friction path needed by younger students.

## Starting Point

S-04 already provides additive roles, teacher-owned classes and codes, email-bound expiring invitation links, and safe authentication continuation. It intentionally stops at a non-enrolling invitation status page: there is no membership table, redemption transaction, student class list, or teacher display identity.

## Desired End State

Both join paths preview the class and available teacher display name, then require explicit confirmation. Confirmation atomically grants the student role, creates one membership per account and class, and consumes an eligible invitation; same-student retries are harmless, conflicting replay is denied, and students can revisit their own joined-class list.

## Key Decisions Made

| Decision               | Choice                                                   | Why                                                                               |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Join paths             | Support code and direct invitation                       | FR-003 requires both entry paths.                                                 |
| Confirmation           | Preview then explicitly confirm for both paths           | Students can catch a wrong valid code, and page loads never mutate membership.    |
| Preview identity       | Class name plus teacher profile display name             | Gives students stronger assurance without exposing teacher email.                 |
| Legacy identity        | Class-only fallback when display name is absent          | Existing accounts and links remain usable during migration.                       |
| Repeat join            | Idempotent success for the same account and class        | Double-clicks and retries do not become user-facing failures.                     |
| Invitation replay      | Same joined account may retry; another account is denied | Preserves single-recipient redemption without punishing safe retries.             |
| Account roles          | Add student role; retain teacher role                    | Existing additive-role architecture supports dual-role users.                     |
| Membership cardinality | One account may join multiple classes                    | Avoids an artificial account-wide restriction.                                    |
| Student surface        | Protected joined-classes list                            | Gives durable confirmation and an S-06 entry point without adding homework.       |
| Lifecycle scope        | Join and read only                                       | Leave, removal, roster, and code controls require later data-lifecycle decisions. |

## Scope

**In scope:** Optional teacher display names; class membership persistence and own-membership reads; code and invitation preview; atomic, replay-safe confirmation; additive student role; joined-class list; role-aware navigation; database, handler, UI, smoke, and manual verification.

**Out of scope:** Rosters; student leave; teacher removal; approval queues; code rotation/revocation; teacher email disclosure; class detail; homework assignment, submission, scoring, or feedback.

## Architecture / Approach

PostgreSQL security-definer functions own preview disclosure, role grant, membership creation, invitation revalidation, and redemption so enrollment cannot partially complete. Typed Astro handlers translate those operations for React/Astro surfaces. The public invitation page preserves S-04 auth continuation, while signed-in code entry and both confirmation paths lead to a protected joined-classes page; teacher management gains an optional display-name prompt.

## Phases at a Glance

| Phase                                  | What it delivers                                                 | Key risk                                               |
| -------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| 1. Identity and membership persistence | Display names, memberships, RLS, previews, and atomic acceptance | Partial enrollment, replay, or cross-user access       |
| 2. Join and membership APIs            | Typed preview, confirm, profile, and joined-list routes          | Privacy leaks or HTTP/database contract drift          |
| 3. Student and teacher class UI        | Explicit code/link confirmation and durable class navigation     | Accidental enrollment or confusing dual-role UX        |
| 4. Integrated verification             | Full gates, configured smoke, and recorded boundary evidence     | Environment-only failures or unsupported safety claims |

**Prerequisites:** S-04 migrations and invitation flow; local Supabase/Docker for pgTAP and configured smoke; controlled teacher and student accounts for manual invitation checks.
**Estimated effort:** About 4-6 focused implementation sessions across four gated phases.

## Open Risks & Assumptions

- Class codes are shared credentials and cannot prevent an unintended signed-in account from requesting a preview; the preview exposes only class name and optional display name.
- Existing teachers start without a display name. The class-only fallback is intentional and remains until the teacher updates the profile.
- The invitation status page and acceptance transaction remain separate boundaries; only the transaction proves expiry, recipient, redemption, and membership guarantees.
- Leave/removal semantics must be settled before assignments exist; S-05 deliberately creates no destructive membership action.

## Success Criteria (Summary)

- A signed-in student previews and explicitly confirms either a normalized class code or matching invitation, then sees the class in their own joined list.
- Membership, student-role grant, and invitation redemption are atomic; same-user repeats are idempotent and wrong-recipient, expired, undelivered, rotated, or conflicting links cannot enroll.
- Teacher email and recipient data stay private, dual-role users retain teacher access, multiple classes work, and unnamed legacy teachers do not block joining.
