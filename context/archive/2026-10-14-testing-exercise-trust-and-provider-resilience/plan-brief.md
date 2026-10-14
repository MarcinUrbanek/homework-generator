# Exercise Trust and Provider Resilience Testing — Plan Brief

> Full plan: `./plan.md`
> Research: `./research.md`

## What & Why

Phase 2 already has server/database protection for repeated generation requests and per-item verification coverage for provider timeouts. This change closes the remaining Risk #5 gap: the request-level contract when a real provider response contains both usable and invalid candidates. Risk #3 remains with the separate `trustworthy-exercise-approval` change.

## Starting Point

The generator adapter filters invalid candidates and the request API can return a partial batch, but the API test currently injects candidates after parsing. The request tests provide a composition seam to exercise the real adapter through the handler with only the external provider fetch stubbed.

## Desired End State

The composed test proves that usable candidates remain settled, the API reports an accurate count and partial status, filtering alone does not retry the provider, and the reservation is released. The test-plan cookbook records this pattern and the separate owners for Risks #2, #3, and #5.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Risk #2 scope | Reuse the archived admission and no-provider-work tests | Admission is already enforced at the API/database boundaries; duplicate tests add no useful signal. | Research |
| Risk #3 ownership | `trustworthy-exercise-approval` owns the reviewed catalog runtime contract and direct tests | Keeps one owner for the approval boundary and avoids overlapping implementation edits. | Plan |
| Risk #5 behavior | Keep valid items when others are filtered; expose a partial response and release the reservation | Preserves settled work while making incomplete results explicit. | Research |
| Provider boundary | Use the real generator and request handler; stub external fetch only | Exercises response translation with less signal loss than mocking internal modules. | Research |
| Unmatched catalog candidates | Keep them explicitly unverified and ineligible, preserving supported items | Maintains a fail-closed approval boundary without discarding supported settled work. | Plan |

## Scope

**In scope:**

- One composed generation/API test for a mixed valid/invalid provider payload.
- Assertions for surviving item count, explicit partial status, no retry caused only by filtering, and reservation release.
- A §6.3/§6.6 cookbook update describing Risk #5 coverage and the distinct Risk #2/#3 owners.

**Out of scope:**

- Risk #2 production logic or duplicate admission tests.
- Risk #3 runtime catalog, verifier, approval, persistence, or direct tests; those belong to `trustworthy-exercise-approval`.
- Changes to provider retry policy, live-provider tests, browser automation, database tests, or CI gates.

## Architecture / Approach

Exercise the existing request-handler composition seam with the production generator adapter and a deterministic provider fetch stub. Validate the HTTP response and reservation lifecycle after candidate filtering; separately run the existing verification tests that retain per-item successes alongside a timeout.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Composed partial-batch contract | Provider filtering remains honest through the request API, with settled valid items retained | Partial provider outcomes are reported as complete or successful work is lost |

**Prerequisites:** Dependencies installed; no live provider credentials or local Supabase required. Phase 2 remains open until the separate Risk #3 trust change and this Risk #5 change complete.
**Estimated effort:** One focused test-and-documentation session.

## Open Risks & Assumptions

- The Risk #3 catalog is implemented and tested by the active trust change; this plan does not define its catalog contents or versioning.
- The current request-handler composition seam remains suitable for the test; if it cannot compose the real adapter without internal mocks, stop and revise the plan rather than weakening the boundary.

## Success Criteria (Summary)

- A mixed provider response returns only valid survivors with an accurate count and an explicit partial marker, without a retry caused by filtering.
- The settled valid batch is retained and its matching reservation is released; existing per-item verification timeout tests continue to pass.
- The cookbook identifies this Risk #5 boundary and keeps Risk #2 admission and Risk #3 trust ownership distinct.
