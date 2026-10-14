# Exercise Trust and Provider Resilience Testing Implementation Plan

## Overview

Add the missing composed generation/API test for honest partial batches and document the pattern in the test-plan cookbook. Reuse existing Risk #2 admission and per-item verification evidence; Risk #3 runtime authority and its direct tests remain owned by `trustworthy-exercise-approval`.

## Current State Analysis

The generation adapter filters invalid or duplicate candidates and can return a partial set; the request API reports that set with `validCount` and `partial_batch`, and releases the admission reservation in its completion path ([generator filtering](../../../src/lib/services/openrouter-exercise-generator.ts#L115), [request response mapping](../../../src/pages/api/exercises/request.ts#L137), [reservation release](../../../src/pages/api/exercises/request.ts#L160)). Existing adapter tests cover filtering, but the analogous request test injects already-constructed candidates rather than exercising the real provider parser through the route ([adapter tests](../../../src/lib/services/openrouter-exercise-generator.test.ts#L81), [request test](../../../src/pages/api/exercises/request.test.ts#L372)).

The request tests expose a `composedHandler` seam suitable for combining the real generator and API handler while stubbing the external provider fetch ([composed handler](../../../src/pages/api/exercises/request.test.ts#L140)). Separately, verification tests already assert that a successful item remains persisted when another candidate times out ([verification tests](../../../src/pages/api/exercises/verify.test.ts#L220)). Risk #2 admission rejection/no-provider-work has API and database coverage in the archived `exercise-trust-provider-resilience` change ([archived plan](../../archive/2026-10-14-exercise-trust-provider-resilience/plan.md#L264)).

### Key Discoveries:

- The remaining Risk #5 gap is generation-to-API composition for mixed valid/invalid provider candidates; per-item verification timeout retention already has direct handler coverage.
- The test should exercise the real generator and request handler and stub only the external provider response.
- Risk #3 source-backed approval is a separate runtime contract owned by `trustworthy-exercise-approval`; it is not an implementation target in this change.

## Desired End State

A composed request test demonstrates that valid candidates remain in the response when other provider candidates are filtered, and that the API reports the response as partial with an accurate count. The same test proves filtering alone does not trigger another provider attempt and that the reservation is released. The cookbook describes this boundary and keeps Risk #2, #3, and #5 ownership distinct.

## What We're NOT Doing

- Reimplementing or duplicating Risk #2 admission logic, tests, or database contention coverage.
- Changing Risk #3 verifier, approval, persistence, or catalog runtime behavior; those are owned by `trustworthy-exercise-approval`.
- Changing provider retry policy, adding live-provider calls, or introducing browser, database, smoke, or E2E infrastructure.
- Treating HTTP 200 by itself as proof of a complete batch; assertions must include the partial marker and surviving-item count.

## Implementation Approach

Extend the existing composed request-handler test setup with the production generator adapter and a deterministic fetch stub at the provider boundary. Return a provider payload containing valid and invalid candidates, then assert the visible partial-response contract, a single provider attempt, and reservation release. Run the focused generator, request, and verification suites to retain coverage for filtering and per-item timeout outcomes. Update §6.3 and §6.6 of the test plan with the shipped pattern and the split ownership.

## Phase 1: Composed Partial-Batch Contract

### Overview

Prove the provider parser's partial result remains settled and is represented honestly through the generation API without over-mocking internal modules.

### Changes Required:

#### 1. Request API composition test

**File**: `src/pages/api/exercises/request.test.ts`

**Intent**: Add a regression test that exercises mixed provider candidates through the real generator and request handler. This covers the integration gap left by unit-level filtering assertions and fixture-injected API tests.

**Contract**: When the provider response contains both valid and invalid candidates, the handler returns only survivors with HTTP 200, an accurate `validCount`, and `partial_batch: true`; filtering alone does not retry the provider request, and the matching reservation is released. Stub the external provider fetch, not internal generator modules.

#### 2. Test-plan cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Record the provider-to-API partial-batch assertion and the ownership boundary established for Phase 2 so future tests reuse existing admission and verification evidence.

**Contract**: Update §6.3 and §6.6 to distinguish archived Risk #2 admission coverage, Risk #3 ownership by `trustworthy-exercise-approval`, and this change's Risk #5 composition coverage. Do not change the risk map, strategy, or quality gates.

### Success Criteria:

#### Automated Verification:

- The composed test uses the real generator through the request handler and asserts the partial status, valid-item count, no filter-only retry, and reservation release.
- `npm test -- src/pages/api/exercises/request.test.ts src/lib/services/openrouter-exercise-generator.test.ts src/pages/api/exercises/verify.test.ts` passes, including the existing per-item timeout-retention case.
- `npx eslint src/pages/api/exercises/request.test.ts` passes.
- Test-plan §6.3 and §6.6 document the shipped Risk #5 pattern and the distinct Risk #2/#3 ownership without changing strategy or gates.

## Testing Strategy

### Unit Tests:

- Reuse the generator adapter's existing filtering and retry tests; do not duplicate their isolated assertions.

### Integration Tests:

- Add one request-handler composition test with the production generator, a provider fetch stub, and mixed valid/invalid candidates.
- Retain the verification-handler test that proves a timeout for one candidate does not discard another candidate's successful settled result.
- Assert response status and partial metadata together; do not infer completeness from HTTP 200.

### Manual Testing Steps:

- Not required. This change exercises a deterministic server/API contract and must not use live provider credits.

## Performance Considerations

No production-path performance changes are planned. The new test uses a stubbed provider response and does not wait for a real provider timeout.

## Migration Notes

None. The plan changes test coverage and cookbook documentation only.

## References

- Research: `context/changes/testing-exercise-trust-and-provider-resilience/research.md`
- Risk #3 runtime ownership: `context/changes/trustworthy-exercise-approval/research.md`
- Existing Risk #2 admission work: `context/archive/2026-10-14-exercise-trust-provider-resilience/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Composed Partial-Batch Contract

#### Automated

- [x] 1.1 The composed test uses the real generator through the request handler and asserts the partial status, valid-item count, no filter-only retry, and reservation release.
- [x] 1.2 `npm test -- src/pages/api/exercises/request.test.ts src/lib/services/openrouter-exercise-generator.test.ts src/pages/api/exercises/verify.test.ts` passes, including the existing per-item timeout-retention case.
- [x] 1.3 `npx eslint src/pages/api/exercises/request.test.ts` passes.
- [x] 1.4 Test-plan §6.3 and §6.6 document the shipped Risk #5 pattern and the distinct Risk #2/#3 ownership without changing strategy or gates.
