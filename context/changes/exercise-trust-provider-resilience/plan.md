# Bound Repeated Exercise-Generation Requests Implementation Plan

## Overview

Add durable, atomic admission before paid generation work. Each teacher may start 10 generation requests in a rolling hour and hold one unexpired 120-second reservation. Explicit denials preserve the teacher's existing batch; admission failures never silently permit provider work.

This is the existing bounded risk #2 change, not the entire "Exercise trust and provider resilience" test rollout. The scope clarification supersedes the initial whole-Phase-2 selection.

## Current State Analysis

The [research](./research.md) establishes the generation boundary and current coverage. The [handler](../../../src/pages/api/exercises/request.ts:59) validates metadata, authorizes the teacher, checks provider configuration, then calls generation without durable admission. Its dependency-injected factory permits deterministic handler tests.

The [adapter](../../../src/lib/services/openrouter-exercise-generator.ts:227) permits two total provider attempts per invocation, with a 30,000-millisecond abort timer per attempt. A short non-empty batch returns without a top-up. These limits do not bound repeated application requests or actual monetary spend.

The [form](../../../src/components/exercises/RequestExercisesForm.tsx:40) prevents duplicate actions only in its mounted instance. Its recognized-error path already preserves previous results. The [shared error schema](../../../src/lib/exercises/schemas.ts:81) is strict and derives codes from [shared types](../../../src/types.ts:10).

Authenticated, serialized SQL operations with a fixed search path already exist in the [membership migration](../../../supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql:216). Teacher roles live in `profile_roles`, not the removed `profiles.role`. The [database suite](../../../supabase/tests/database/exercise_verification_approval.sql:753) supplies multi-connection `dblink` precedent.

## Desired End State

- Each authenticated teacher has at most 10 charged admissions whose timestamps are strictly later than database decision time minus 60 minutes. A timestamp exactly 60 minutes old no longer counts.
- Admission checks quota and the current reservation atomically across tabs, requests, and Worker instances. One admitted request consumes one unit, including both possible provider attempts; failures, timeouts, and partial results do not refund it.
- One unexpired reservation exists per teacher. Completion releases it; at exactly 120 seconds it is expired and replaceable. This is not a guarantee that old provider work has stopped: abnormal work may overlap after expiry.
- Invalid input, unauthorized callers, missing provider configuration, and denied admissions consume no unit and make no provider call.
- Hourly and reservation denials return distinct typed Polish errors, HTTP 429, and `Retry-After` as positive whole seconds. Previous batches, verification selections, topic, and difficulty remain intact; the browser neither counts down nor retries automatically.
- Admission storage/validation failures return an explicit 503 availability error before generation. Release failures emit a sanitized operational error without replacing settled generation results; expiry provides recovery.

### Key Discoveries:

- [Teacher authorization](../../../src/lib/services/teacher-authorization.ts:17) is request/session based; the database must independently derive `auth.uid()` rather than trust a teacher ID in JSON.
- [RPC adaptation](../../../src/pages/api/classes/invite.ts:64) validates unknown database payloads. New admission and release responses need the same discipline.
- `dblink_is_busy()` alone does not prove lock contention. Race tests must establish an actual waiting PostgreSQL lock, and fixtures must be committed before remote sessions can see them.
- There is no existing application logger in the inspected TypeScript sources. Add narrow, sanitized operation-level error signals, not a new observability framework.

## What We're NOT Doing

- Completing or marking complete the whole test-plan Phase 2; approval evidence, verification quotas/resilience, and answer-oracle changes remain separate.
- Adding a shared provider-key allowance or monetary budget. Ten requests imply at most 20 adapter attempts for those admitted starts, not a currency guarantee.
- Changing adapter retries, attempt timers, candidate counts, partial-batch semantics, verification, approval, homework assignment, or scoring.
- Guaranteeing strict provider no-overlap after reservation expiry, adding lease renewal, or refunding allowance.
- Adding caller idempotency keys, automatic browser retries, live countdowns, reset fields in JSON, new storage platforms, or new npm dependencies.
- Adding hooks, CI enforcement, full-flow e2e, mutation-score targets, or changing frozen test-plan strategy/gates.

## Implementation Approach

Use a private Supabase table with one state row per teacher: a bounded array of recent admission timestamps and a nullable reservation token/expiry pair. Its primary key supplies the per-teacher serialization point. Keeping at most 10 timestamps per row avoids an unbounded admission ledger and a separate retention job.

An authenticated admission RPC locks that row, reads database time after acquiring the lock, and decides both policies in one transaction. A second RPC releases only the caller's matching token without removing admission timestamps. Neither RPC accepts caller-supplied identity, time, quota, or lease duration.

Use a typed service adapter and the existing handler factory to enforce this contract after authorization/provider configuration and before `generate`. Database state is authoritative; no Worker-local counters or read-then-write admission decisions.

## Critical Implementation Details

### Timing and lifecycle

Capture current time after the serialization lock, not transaction-start `now()`: a waiting request must evaluate expiry against the time it can actually decide. Exact expiry is inclusive for recovery; recent admissions use the strict lower bound described above.

### State sequencing

An old completion must never clear a replacement lease. Release compares both authenticated owner and reservation token; mismatched or already released tokens are harmless no-ops. Releasing a token never refunds a charged admission.

### Debug and verification

An admission error with an uncertain committed outcome still blocks generation and does not retry automatically; a charged unit/lease may remain until normal expiry. For race tests, commit isolated fixture setup first, prove the second backend is waiting on the first backend's lock with a bounded wait, then commit the winner and inspect the serialized result.

## Phase 1: Durable Admission Contract

### Overview

Establish persisted policy, authorization, boundary semantics, and real concurrent-admission evidence before wiring provider calls.

### Changes Required:

#### 1. Admission migration

**File**: `supabase/migrations/20261014160000_add_exercise_generation_admission.sql` (new; retain naming convention and advance the timestamp if it collides).

**Intent**: Persist only the state required to protect generation across Worker instances. Make admission and release atomic and non-bypassable through direct table writes.

**Contract**: `public.exercise_generation_admission_state` has `teacher_id` as its primary key referencing `auth.users` with cascade deletion, `admitted_at` as a non-null `timestamptz[]` of at most 10 entries, and nullable `reservation_id`/`reservation_expires_at` fields constrained to be present or absent together. Enable RLS and revoke direct table access from `anon` and `authenticated`; default-deny RLS is intentional because no direct per-operation access is supported.

**Contract**: `public.admit_exercise_generation()` accepts no arguments and returns one JSON object: `{ status: "admitted", reservation_id: UUID }`, `{ status: "quota-exceeded", retry_after_seconds: positive integer }`, or `{ status: "in-progress", retry_after_seconds: positive integer }`. It revalidates authenticated teacher status using `auth.uid()` and `public.is_teacher()`, serializes first-row creation and existing-row updates, prunes expired timestamps, and atomically records a timestamp plus database-generated 120-second token on admission. Use `SECURITY DEFINER`, an empty fixed search path, fully qualified objects, and authenticated-only execute grants; authorization failure is SQLSTATE `42501`.

**Contract**: When both blockers exist, quota denial takes precedence; retry timing is the ceiling of the later blocking deadline minus decision time, at least one second. Quota readiness is the oldest still-counted admission plus 60 minutes; reservation readiness is its expiry. Rejected calls do not charge or renew leases.

**Contract**: `public.release_exercise_generation(p_reservation_id uuid)` returns a boolean indicating whether the caller's matching reservation was cleared. Derive owner from `auth.uid()`; anonymous callers are denied. Do not require a still-present teacher role to clean up an already acquired lease, and never clear another owner's or replacement token.

#### 2. Persisted policy and synchronized races

**File**: `supabase/tests/database/exercise_generation_admission.sql` (new).

**Intent**: Prove the quota and reservation guarantees at the actual shared-state boundary, independently of handler mocks.

**Contract**: Use authenticated JWT claims and pgTAP to cover first admission, repeated sequential admissions with release, tenth allowed/eleventh denied, exactly-60-minute expiry versus just-inside the window, exactly-120-second lease expiry versus just-before expiry, separate teachers, anonymous/student denial, direct table-write denial, charged failures with release but no refund, malformed/stale/cross-owner release, and old-token release after replacement. Fixture privileged state rather than accepting caller time overrides in production RPCs.

**Contract**: Reuse test-only `dblink`, restoring its pre-test extension state. Use isolated fixture IDs committed before opening remote sessions; explicit scoped cleanup must remove committed fixtures even when race checks fail and must surface the failure. Set authenticated role/claims on both connections. Capture backend PIDs and bound all waits. Establish a non-granted lock with B blocked by A, rather than relying on elapsed sleeps or only `dblink_is_busy()`.

**Contract**: For the last-unit race, seed nine recent timestamps; A admits and releases its lease in its uncommitted transaction while B waits, then A commits. B must quota-deny and the persisted count must be exactly 10. For the empty-state race, A retains its lease and B waits; after A commits, B must reservation-deny with exactly one charge and one unexpired token. Include first-ever row creation contention so locking an absent row cannot bypass protection.

### Success Criteria:

#### Automated Verification:

- The additive migration applies on an isolated local stack with `npx supabase migration up --local`.
- Focused pgTAP passes with `npx supabase test db --local supabase\tests\database\exercise_generation_admission.sql`, including exact time boundaries and genuine synchronized quota/reservation races.

#### Manual Verification:

- Review RPC grants, default-deny table access, and test cleanup to confirm authenticated users cannot edit quota state and race fixtures do not remain after a failed test.

**Implementation Note**: After automated checks, pause for human confirmation of the manual criterion before proceeding.

---

## Phase 2: API Enforcement

### Overview

Connect durable admission to generation and preserve existing response/precedence behavior.

### Changes Required:

#### 1. Typed admission service and error contracts

**Files**: `src/lib/services/exercise-generation-admission.ts` and its `.test.ts` (new); `src/types.ts`; `src/lib/exercises/schemas.ts`.

**Intent**: Translate database decisions and failures into explicit typed results, keeping arbitrary RPC payloads away from provider admission.

**Contract**: Add generation error codes `GENERATION_LIMIT_EXCEEDED`, `GENERATION_IN_PROGRESS`, and `ADMISSION_UNAVAILABLE`. Preserve the existing `{ error: { code, message } }` JSON shape and all generation-success fields; derive error parsing from the shared enum. Validate the strict discriminated admission object and boolean release response, including UUIDs and positive integral retry seconds. Treat RPC errors, thrown transport errors, empty/malformed results, and missing client state as unavailable, not allowed. Translate admission SQLSTATE `42501` to the existing forbidden response.

#### 2. Request handler wiring and lifecycle tests

**Files**: `src/pages/api/exercises/request.ts`; `src/pages/api/exercises/request.test.ts`.

**Intent**: Gate every generation call before provider work and release reservations without damaging settled outcomes.

**Contract**: Preserve order: JSON/schema validation, teacher authorization, provider configuration, admission, generation, release. Extend the existing dependency-injected handler with admission/release functions. Supply realistic authenticated locals/client doubles in identity-dependent tests instead of keeping the existing authorized-with-null-client assumption.

**Contract**: Quota denial is 429 with `GENERATION_LIMIT_EXCEEDED` and `Osiągnięto limit 10 żądań generowania w ciągu godziny. Spróbuj ponownie później.` Reservation denial is 429 with `GENERATION_IN_PROGRESS` and `Generowanie zadań już trwa. Spróbuj ponownie po jego zakończeniu.` Set `Retry-After` to the validated integer seconds as a decimal string. Admission unavailability is 503 with `ADMISSION_UNAVAILABLE` and `Nie można teraz sprawdzić limitu generowania. Spróbuj ponownie później.`

**Contract**: Release the admitted token in `finally` for complete/partial success, unusable output, provider failure, and timeout. A release error must not override the original response or refund a unit. Emit a sanitized `console.error` operation signal for admission or release unavailability, distinguishing the operations and never dumping raw errors, RPC payloads, tokens, user data, provider bodies, or credentials. A validated stale-token `false` is a normal no-op, not an availability failure.

**Contract**: Tests assert no admission for existing pre-admission rejections, no generation for all denials/failures, no release without an acquired token, one charge for an invocation with retries, correct headers/envelopes, authorization race handling, and original responses/log signals when release fails.

#### 3. Real handler-to-adapter composition

**File**: `src/pages/api/exercises/request.test.ts`.

**Intent**: Verify the pre-provider guarantee at the outbound boundary rather than only asserting a mocked generation function was not called.

**Contract**: Compose the production handler, validated admission service, and production generator with fake Supabase RPC responses and external fetch/timers. Denied or unavailable admission causes zero outbound fetches; an admitted retryable failure followed by success uses exactly two attempts, one admission, and one release. Exhausted timeouts preserve 504 and release; short batches preserve the existing partial response without extra attempts.

### Success Criteria:

#### Automated Verification:

- Focused service/handler/adapter tests pass with `npm test -- src\lib\services\exercise-generation-admission.test.ts src\pages\api\exercises\request.test.ts src\lib\services\openrouter-exercise-generator.test.ts`.
- `npm run lint` and `npm run build` pass with required Supabase build configuration, without live provider calls.

#### Manual Verification:

- Inspect representative quota, reservation, and admission-unavailable HTTP responses: status, Polish message, Retry-After units, and absence of sensitive data match the contract.

**Implementation Note**: After automated checks, pause for human confirmation of the manual criterion before proceeding.

---

## Phase 3: UX and Operational Handoff

### Overview

Prove that denials preserve usable work and document the bounded policy without claiming broader rollout completion.

### Changes Required:

#### 1. Form regression coverage

**Files**: `src/components/exercises/RequestExercisesForm.test.tsx`; `src/components/exercises/RequestExercisesForm.tsx` only if a failing contract test requires wiring.

**Intent**: Ensure the existing recognized-error path displays the new messages and retains the teacher's work.

**Contract**: For both 429 codes and 503 admission unavailability, start with a reviewed batch and selected verification IDs, change topic/difficulty, submit generation, and assert the exact recognized message, unchanged session storage/batch/selections, unchanged chosen inputs, and unlocked controls after settlement. Advancing timers must cause no additional fetch. No countdown or Retry-After consumption is required in the form.

#### 2. Policy, test cookbook, and observed evidence

**Files**: `README.md`; `context/foundation/test-plan.md`; `context/changes/exercise-trust-provider-resilience/manual-verification.md` (create during implementation, not planning).

**Intent**: Document the generation allowance and recovery model so operators and future tests use the same meanings.

**Contract**: Update the existing OpenRouter generation documentation with 10 admitted requests per rolling hour, no refunds, up to two attempts per unit, a 120-second reservation with explicit post-expiry overlap caveat, fail-closed admission, Retry-After seconds, migration prerequisites, and targeted commands. Add only the risk #2 admission pattern to cookbook section 6.3 and a concise section 6.6 note. Leave strategy, gates, and whole-rollout Phase 2 completion unchanged; approval/resilience cookbook work remains pending.

**Contract**: Record observed manual outcomes with test environment and commands, not assumed passes. Use a stubbed provider or isolated synthetic quota fixtures; do not spend provider credits solely to exhaust quota.

### Success Criteria:

#### Automated Verification:

- Focused regression tests pass with `npm test -- src\components\exercises\RequestExercisesForm.test.tsx src\lib\services\exercise-generation-admission.test.ts src\pages\api\exercises\request.test.ts src\lib\services\openrouter-exercise-generator.test.ts`.
- Database regression coverage passes with `npm run db:test` on an isolated migrated local stack.
- `npm run lint` and `npm run build` pass, and changed Markdown passes the existing Prettier check.

#### Manual Verification:

- With a stubbed provider, two signed-in tabs show reservation denial without losing results or selections; completion releases the slot, the eleventh hourly start is denied, and lease/window recovery matches the documented boundaries.
- Simulated admission unavailability blocks provider work; simulated release failure preserves settled output and emits only sanitized operation signals, with observed results recorded in the manual verification document.

**Implementation Note**: After automated checks, pause for human confirmation of manual criteria before declaring this bounded change implemented.

## Testing Strategy

### Unit Tests:

- Strict RPC result parsing, invalid retry timing/token values, normal no-op release, operation-specific failure signals, and unchanged generation error schema shape.
- Component behavior checks prove preservation and no automatic retry without snapshots or browser timers for a countdown.

### Integration Tests:

- Route composition mocks only external Supabase/provider boundaries while exercising the production admission adapter and generator.
- pgTAP independently proves persisted authorization, exact rolling-window/lease boundaries, token fencing, and genuine multi-connection contention. Privileged fixtures are test-only.
- Race tests use READ COMMITTED session semantics, committed fixture visibility, bounded lock waits/result waits, and scoped cleanup. A timeout or missing lock contention is a failure, never a skipped pass.

### Manual Testing Steps:

1. Apply the migration on a disposable/local test stack and use a teacher session with a stubbed generation provider.
2. Keep one generation pending and submit from another tab; inspect the 429 envelope/header and retained results.
3. Complete the pending generation and retry explicitly; confirm its matching token releases.
4. Admit/release ten generations, then inspect quota denial without an outbound provider call. Seed time-boundary fixtures rather than waiting an hour.
5. Replace an expired reservation and finish the old request; ensure the replacement remains active.
6. Exercise unavailable admission and failed release, inspect safe operation signals, and record actual outcomes.

## Performance Considerations

Admission adds one RPC before provider work and one release RPC afterward. Rows retain at most 10 timestamps, and locks serialize only a teacher's short database transaction, never the duration of a provider call. Different teachers remain independent. No monetary or whole-application capacity guarantee is claimed.

## Migration Notes

The migration is additive and needs no existing-data backfill: state rows are created lazily. Deploy the migration before API code. Unconfigured-provider requests still reject before admission, preserving the existing no-provider smoke behavior.

For an application rollback, disable generation by removing its provider configuration before reverting the route; do not restore the old ungated route while generation stays enabled. Retain the compatible admission table/functions during rollback and investigate safely. Removing provider configuration blocks new work but cannot undo already started provider requests. No production reset, bulk data deletion, or hook/CI change is part of delivery.

## References

- [Change identity and bounded task](./change.md)
- [Generation admission research](./research.md)
- [Test strategy, risk #2 and deferred gates](../../foundation/test-plan.md)
- [Request pipeline](../../../src/pages/api/exercises/request.ts:59)
- [Teacher authorization](../../../src/lib/services/teacher-authorization.ts:17)
- [Provider attempt loop](../../../src/lib/services/openrouter-exercise-generator.ts:227)
- [Recognized browser error handling](../../../src/components/exercises/RequestExercisesForm.tsx:66)
- [Strict generation error parsing](../../../src/lib/exercises/schemas.ts:81)
- [Authenticated SQL serialization precedent](../../../supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql:216)
- [Existing dblink race infrastructure](../../../supabase/tests/database/exercise_verification_approval.sql:753)
- [Committed-fixture cleanup precedent](../../../supabase/tests/database/exercise_verification_approval.sql:856)

## Progress

> Convention: unchecked means pending; checked means done. Append the closing commit SHA when a step lands. Do not rename step titles.

### Phase 1: Durable Admission Contract

#### Automated

- [x] 1.1 The additive migration applies on an isolated local stack with `npx supabase migration up --local`. — 85dcb2f
- [x] 1.2 Focused pgTAP passes with `npx supabase test db --local supabase\tests\database\exercise_generation_admission.sql`, including exact time boundaries and genuine synchronized quota/reservation races. — 85dcb2f

#### Manual

- [x] 1.3 Review RPC grants, default-deny table access, and test cleanup to confirm authenticated users cannot edit quota state and race fixtures do not remain after a failed test. — 85dcb2f

### Phase 2: API Enforcement

#### Automated

- [x] 2.1 Focused service/handler/adapter tests pass with `npm test -- src\lib\services\exercise-generation-admission.test.ts src\pages\api\exercises\request.test.ts src\lib\services\openrouter-exercise-generator.test.ts`.
- [x] 2.2 `npm run lint` and `npm run build` pass with required Supabase build configuration, without live provider calls.

#### Manual

- [x] 2.3 Inspect representative quota, reservation, and admission-unavailable HTTP responses: status, Polish message, Retry-After units, and absence of sensitive data match the contract.

### Phase 3: UX and Operational Handoff

#### Automated

- [ ] 3.1 Focused regression tests pass with `npm test -- src\components\exercises\RequestExercisesForm.test.tsx src\lib\services\exercise-generation-admission.test.ts src\pages\api\exercises\request.test.ts src\lib\services\openrouter-exercise-generator.test.ts`.
- [ ] 3.2 Database regression coverage passes with `npm run db:test` on an isolated migrated local stack.
- [ ] 3.3 `npm run lint` and `npm run build` pass, and changed Markdown passes the existing Prettier check.

#### Manual

- [ ] 3.4 With a stubbed provider, two signed-in tabs show reservation denial without losing results or selections; completion releases the slot, the eleventh hourly start is denied, and lease/window recovery matches the documented boundaries.
- [ ] 3.5 Simulated admission unavailability blocks provider work; simulated release failure preserves settled output and emits only sanitized operation signals, with observed results recorded in the manual verification document.
