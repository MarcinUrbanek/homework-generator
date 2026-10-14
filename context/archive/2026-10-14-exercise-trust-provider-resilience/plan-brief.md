# Bound Repeated Exercise-Generation Requests - Plan Brief

> Full plan: [plan.md](./plan.md)
> Research: [research.md](./research.md)

## What & Why

Bound repeated exercise-generation requests and reject over-limit requests before provider work. Protect against repeated paid starts across tabs or direct HTTP requests. This is risk #2 only, not the entire test-rollout Phase 2; the scope clarification replaced the initial broader selection.

## Starting Point

The handler validates input and teacher access but has no durable admission state; its form-local lock and adapter's two-attempt maximum do not limit repeated requests. Existing Supabase RPC and pgTAP/dblink patterns supply the implementation and concurrency-test foundation.

## Desired End State

Teachers receive an explicit Polish denial when hourly allowance or a reservation blocks a start, preserving results, selected exercises, topic, and difficulty. Unknown admission state blocks generation; completed work survives a release failure.

## Key Decisions Made

| Decision         | Choice                                                        | Why                                                                                     | Source          |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------- |
| Scope            | Existing bounded generation-admission change                  | Preserve established identity/research rather than expand to approval/verification.     | Plan + Research |
| Allowance        | 10 admitted starts in a rolling 60 minutes per teacher        | Bound repeated starts without fixed-window bursts; exactly 60-minute-old starts expire. | Plan            |
| Accounting       | One unit per admitted request, no refunds                     | Retries, failures, timeouts, and partial batches cannot bypass charging.                | Plan            |
| Shared budget    | None in this change                                           | Avoid inventing an application-wide spend policy.                                       | Plan            |
| Concurrency      | One unexpired reservation; 120-second lease                   | Recover crashed Workers automatically; exact expiry permits replacement.                | Plan            |
| Expiry exception | Old provider work may overlap after lease expiry              | A timer/lease cannot prove provider work has stopped.                                   | Plan            |
| Denials          | Distinct 429 errors with Retry-After in whole seconds         | Fit existing error rendering and give HTTP callers actionable timing.                   | Plan            |
| Client retries   | Explicit user retry only; no countdown                        | Preserve existing form behavior and avoid stale timer state.                            | Plan            |
| Failure policy   | Admission fails closed with 503; release errors logged safely | Block unknown admission while preserving settled generation results.                    | Plan            |
| Storage          | Private per-teacher Supabase state plus atomic RPCs           | Reuse existing infrastructure; keep at most 10 admission timestamps per row.            | Research + Plan |
| Verification     | pgTAP with genuine dblink lock contention; route composition  | Prove shared-state atomicity and zero denied outbound calls without provider credits.   | Research + Plan |

## Scope

**In scope:**

- Additive admission migration, token-matched release, strict service/error contracts.
- Rolling-window/lease boundaries, synchronized races, API/provider composition, and form preservation tests.
- Generation-policy documentation and the risk #2 test cookbook entry.

**Out of scope:**

- Approval trust, verification resilience/quotas, scoring, and whole-rollout Phase 2 completion.
- Shared monetary budgets, adapter retry changes, strict no-overlap after expiry, refunds, new dependencies.
- Hooks, CI gates, live countdowns, automatic retries, and full-flow e2e.

## Architecture / Approach

Validated request -> teacher authorization -> provider configuration -> atomic admission RPC -> generator -> matching-token release.
One private RLS-protected row per teacher holds at most 10 timestamps and a token/expiry pair. The database clock is read after locking; callers cannot supply identity, policy, or time. Quota denial takes precedence if both blockers exist; Retry-After covers the later deadline. Release never clears a replacement token or refunds allowance.

## Phases at a Glance

| Phase                         | What it delivers                                                      | Key risk                                                              |
| ----------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Durable admission contract | State, RPCs, boundary tests, synchronized races                       | Concurrent requests bypass the last unit or reservation               |
| 2. API enforcement            | Typed service, pre-provider guard, errors, release, composition tests | Denied requests still call the provider or cleanup overwrites results |
| 3. UX and operational handoff | Preservation tests, documentation, regression evidence                | Teachers lose work or operators misunderstand recovery                |

**Prerequisites:** Existing research; Node/npm; Docker and an isolated migrated local Supabase stack for database tests; required Supabase build settings. No live provider credentials are needed for deterministic tests.
**Estimated effort:** Roughly 2-3 implementation sessions across three phases, plus human verification; an estimate, not a deadline.

## Open Risks & Assumptions

- The 10/hour threshold is a user-approved starting policy, not a measured capacity limit; aggregate spend across teachers remains unbounded by this change.
- At most 20 adapter attempts belong to 10 admitted requests, but this is not a currency or strict provider-duration guarantee.
- Lost admission responses may leave charged allowance/reservations without generation; no automatic refund or retry guesses whether the transaction committed.
- Release failures recover through expiry; abnormal old work can overlap after 120 seconds. Deploy the migration first; disable provider configuration before reverting to an ungated route and retain compatible database state.

## Success Criteria (Summary)

- Denied/unavailable admission makes zero outbound provider calls, and real database races admit only the permitted winner.
- Exact hourly/lease boundaries, token fencing, charging, Retry-After units, and existing success/partial/error contracts are tested.
- Teachers keep prior results/selections on denials, and operators can distinguish safely logged admission and release failures.

## References

- [Full plan and Progress](./plan.md), [research](./research.md), [change identity](./change.md), and [test-plan risk #2/deferred gates](../../foundation/test-plan.md).
