---
date: 2026-10-14T20:56:24+02:00
researcher: AI assistant using Copilot SDK in VS Code
git_commit: e4f19c17914a57562fdc26e9b5efbba856acad15
branch: master
repository: homework-generator
topic: "Testing exercise trust and provider resilience"
tags: [research, codebase, exercise-generation, verification, provider-resilience]
status: complete
last_updated: 2026-10-14
last_updated_by: AI assistant using Copilot SDK in VS Code
last_updated_note: "Recorded planning decisions for authoritative source, unsupported candidates, and cross-change test ownership."
---

# Research: Testing exercise trust and provider resilience

**Date**: 2026-10-14T20:56:24+02:00
**Researcher**: AI assistant using Copilot SDK in VS Code
**Git Commit**: e4f19c17914a57562fdc26e9b5efbba856acad15
**Branch**: master
**Repository**: homework-generator

## Research Question

For Phase 2 of the test rollout, what coverage already proves generation admission, trustworthy approval, and truthful provider-failure outcomes; what gap remains without duplicating the archived Risk #2 work or the active `trustworthy-exercise-approval` change?

## Summary

- **Risk #2 is already covered at the server and database boundaries.** The API tests prove explicit quota/reservation rejection and no generation call; a composed route test proves zero provider fetches for quota rejection, reservation rejection, admission transport failure, an authorization race, and malformed admission data ([request tests:249](../../../src/pages/api/exercises/request.test.ts#L249), [composed cases:477](../../../src/pages/api/exercises/request.test.ts#L477)). The archived `exercise-trust-provider-resilience` change is limited to bounded admission and is not the whole Phase 2 rollout ([archived plan:5](../../archive/2026-10-14-exercise-trust-provider-resilience/plan.md#L5)). Repeating these tests in this change would duplicate existing evidence.
- **Risk #3 is not satisfied by the current approval contract.** The production verifier classifies a singleton model-reported answer set that matches the candidate proposal as `unique_answer` ([classification:121](../../../src/lib/services/openrouter-exercise-verifier.ts#L121)); the approval RPC permits promotion based on the stored `unique_answer` outcome ([approval predicate:110](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql#L110)). The existing [trustworthy-exercise-approval research](../trustworthy-exercise-approval/research.md) documents that this proves persisted provenance and agreement, not mathematical correctness or uniqueness against an independent authoritative source. A test fixture can independently measure named cases, but cannot by itself make runtime approval require that source.
- **Risk #5 has useful coverage, with one narrow generation/API composition gap.** Verification settles each candidate independently and represents provider or persistence failure as an `indeterminate` item; existing handler coverage checks ordering, persisted successes, and a retained timeout failure ([verification handler:244](../../../src/pages/api/exercises/verify.ts#L244), [verification tests:220](../../../src/pages/api/exercises/verify.test.ts#L220)). Generation also reports partial batches as HTTP 200 with `validCount` and `partial_batch: true`, while exhausted provider failure and timeout map to 502 and 504 respectively ([request response mapping:137](../../../src/pages/api/exercises/request.ts#L137)). The generator's provider-boundary tests cover filtering/retries, but the API's analogous partial-batch test injects already-constructed candidates rather than composing the real parser with the handler ([generator filtering:115](../../../src/lib/services/openrouter-exercise-generator.ts#L115), [API fixture test:372](../../../src/pages/api/exercises/request.test.ts#L372)). One composition test can prove that valid items remain settled and the partial response is explicit.
- **Risk #3 had a blocking architecture choice at research time.** The active research identifies materially different options—reviewed authoritative corpus, constrained structured generation with a checked solver/rendering contract, or trusted human-authored verification. The planning interview later selected a reviewed exact problem/solution catalog; this rollout does not implement that runtime contract because ownership remains with the separate trust change.

## Detailed Findings

### Risk #2: bounded generation admission

The archived admission rollout implements persisted, per-teacher admission state and atomic quota/reservation checks in the migration ([admission function:21](../../../supabase/migrations/20261014160000_add_exercise_generation_admission.sql#L21), [boundary conditions:52](../../../supabase/migrations/20261014160000_add_exercise_generation_admission.sql#L52)). In the inspected request handler, authorization and provider-configuration checks precede admission, and rejected or unavailable admission returns before provider generation ([request admission sequence:107](../../../src/pages/api/exercises/request.ts#L107)).

The focused API tests cover typed 429 denials and 503 unavailable outcomes without generation calls. The composed test uses the real admission service and provider-fetch spy for the exact five denial/failure conditions listed above ([request tests:249](../../../src/pages/api/exercises/request.test.ts#L249), [composed cases:477](../../../src/pages/api/exercises/request.test.ts#L477)). The database suite also covers privilege boundaries and synchronized contention ([admission database tests:24](../../../supabase/tests/database/exercise_generation_admission.sql#L24), [contention cases:430](../../../supabase/tests/database/exercise_generation_admission.sql#L430)).

**Disposition:** retain the archived Risk #2 evidence; do not add client-only assertions or duplicate admission tests. The full Phase 2 row remains open because the approval and resilience risks are distinct.

### Risk #3: authoritative approval evidence

The verifier prompt omits the proposed answer, but the external model supplies `validAnswers`; local classification then treats a one-item set matching the proposal as `unique_answer` ([verifier prompt:55](../../../src/lib/services/openrouter-exercise-verifier.ts#L55), [classification:121](../../../src/lib/services/openrouter-exercise-verifier.ts#L121)). The database approval boundary consumes the stored outcome and copies its evidence into the approved pool ([approval predicate:110](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql#L110), [promotion:138](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql#L138)).

Accordingly, a test that independently solves a named fixture can detect errors for that fixture, but it cannot prove that arbitrary model-generated content has an authoritative answer or is uniquely answerable. The existing trust research recommends independent, reviewed fixture provenance and identifies possible runtime sources; it records the source choice as unresolved at the time it was written ([trust research](../trustworthy-exercise-approval/research.md)). The planning interview later selected a reviewed exact problem/solution catalog; its population and supported-domain details belong to the trust change.

**Disposition:** the active trust change owns the Risk #3 runtime contract and its direct tests. This rollout does not overwrite its research or duplicate its implementation. The selected contract requires source-backed eligibility; unmatched candidates remain explicitly unverified and ineligible while supported items are preserved.

### Risk #5: settled items and honest provider outcomes

For generation, each provider attempt has an abort deadline and the adapter retries up to two attempts for timeout, retryable HTTP responses, or no surviving candidates ([attempt handling:177](../../../src/lib/services/openrouter-exercise-generator.ts#L177), [retry loop:222](../../../src/lib/services/openrouter-exercise-generator.ts#L222)). Candidate validation drops invalid or duplicate items; if one to four candidates survive, the API returns their count and marks the batch partial. Exhausted provider failure and timeout are represented as 502 and 504 rather than a success-shaped response ([candidate filtering:115](../../../src/lib/services/openrouter-exercise-generator.ts#L115), [request response mapping:137](../../../src/pages/api/exercises/request.ts#L137)).

For verification, the handler runs candidate work independently and converts each provider or persistence failure to an `indeterminate` result. The inspected tests cover input ordering, persisted successful results, and a retained timeout failure ([verification handler:244](../../../src/pages/api/exercises/verify.ts#L244), [verification tests:220](../../../src/pages/api/exercises/verify.test.ts#L220)).

The remaining low-cost signal is a composed generation/API test using the existing `composedHandler` seam, the real generator adapter, and a stubbed provider response with both valid and invalid items. It should assert that surviving results remain in the response, `validCount` matches them, `partial_batch` is true, the adapter does not retry solely because invalid items were filtered, and reservation release occurs. This tests the external provider boundary through the API without over-mocking internal modules ([composed handler seam:140](../../../src/pages/api/exercises/request.test.ts#L140), [partial response:137](../../../src/pages/api/exercises/request.ts#L137)).

## Architecture Insights

- Admission is persisted and shared across requests; browser disabled state is not the enforcement boundary. Existing composed API and database tests already address the server-call bypass risk.
- Verification uses per-candidate outcome settlement, while generation's partial batch is a set of surviving candidates rather than per-candidate provider error objects. Keep those contracts distinct in tests and response wording.
- An authoritative test oracle and an authoritative runtime approval oracle are different guarantees. Do not claim that independent fixtures satisfy the runtime approval requirement unless production eligibility consumes evidence bound to those fixtures or another selected trusted source.

## Historical Context

- The archived `exercise-trust-provider-resilience` change covers bounded generation admission only; its plan explicitly excludes approval authority and per-item resilience ([archived scope:5](../../archive/2026-10-14-exercise-trust-provider-resilience/plan.md#L5)).
- The current test-plan cookbook states admission denial must make no provider call and that Risk #2 admission alone does not complete the broader rollout ([test-plan:128](../../foundation/test-plan.md#L128)).
- The active `trustworthy-exercise-approval` change is separately scoped to Risk #3. Its research predates the planning decision; the user later selected a reviewed exact problem/solution catalog as the runtime authority ([active trust research](../trustworthy-exercise-approval/research.md)).

## Resolved Planning Decisions

- No decision from this research scope remains open after the planning interview on 2026-10-14. Exact catalog population and versioning are implementation details for the active trust change; the evidence findings above are unchanged.

## Follow-up: planning decisions

- Require a reviewed exact problem/solution catalog with a unique answer, derivation, and provenance. Catalog scope and curation are accepted costs; production approval must consume the catalog-backed evidence.
- Keep unmatched candidates as explicitly unverified and ineligible for approval while preserving supported items in the same settled batch.
- The active `trustworthy-exercise-approval` change owns the Risk #3 runtime contract and its direct tests. This rollout owns the Risk #5 generation/API composition coverage and reuses existing Risk #2 evidence. Phase 2 remains open until the Risk #3 and Risk #5 changes complete.

## Evidence Scope

The test plan was read in full. Risk #3 evidence reuses the source-backed research in the active `trustworthy-exercise-approval` change. Two read-only investigations examined the archived Risk #2 admission implementation/tests and the Risk #5 generation/verification paths. No tests were run during research. Findings are from local source at commit `e4f19c17914a57562fdc26e9b5efbba856acad15`. The worktree had pre-existing modifications to authorization rollout documents and `context/foundation/test-plan.md`, plus the separately untracked trust research folder. During planning, only the test-plan Phase 2 status and §6.6 ownership/coverage note were updated; the existing trust research was not modified.
