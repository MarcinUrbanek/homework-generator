---
date: 2026-10-14T14:50:47.6559185+02:00
researcher: AI assistant using Copilot SDK in VS Code
git_commit: 44fbe8038e354ba4671e0d05d48adcd1ebb3d6a7
branch: master
repository: homework-generator
topic: "Bound repeated exercise-generation requests before provider work"
tags: [research, codebase, exercise-generation, request-limits, provider-resilience]
status: complete
last_updated: 2026-10-14
last_updated_by: AI assistant using Copilot SDK in VS Code
---

# Research: Bound repeated exercise-generation requests

## Research Question

Where should the server bound repeated exercise-generation requests and reject over-limit requests before provider work, and what existing contracts and tests must be preserved?

Scope follows [change.md](./change.md): generation admission and test-plan risk #2. The folder name also resembles the broader Phase 2 rollout, but approval trust, verification quotas, and per-item verification resilience are not part of this request. [test-plan.md](../../foundation/test-plan.md), lines 42, 58, and 71, supplies the risk context rather than expanding the change.

## Summary

- In the inspected generation path, valid metadata, teacher authorization, and configured provider settings lead directly to `generate`; there is no server admission counter or concurrency reservation in that path. The insertion point is after the provider-configuration check and before the generation call in [request.ts](../../../src/pages/api/exercises/request.ts), lines 66-92.
- The existing browser lock applies to the mounted form instance, not to an authenticated teacher's requests across tabs or direct HTTP callers. See [RequestExercisesForm.tsx](../../../src/components/exercises/RequestExercisesForm.tsx), lines 28 and 40-60.
- For an admitted generation invocation using the current adapter, the loop permits at most **2 total provider attempts**, meaning **1 additional attempt**, not 2 retries. The default abort timer is **30,000 milliseconds per attempt**. These bound an invocation, not a teacher's request frequency or a monetary budget. See [openrouter-exercise-generator.ts](../../../src/lib/services/openrouter-exercise-generator.ts), lines 8 and 217-246.
- The repository already has request-scoped Supabase clients and transactionally serialized authenticated SQL operations. A durable admission RPC is a repository-aligned candidate, not an approved implementation decision. See [supabase.ts](../../../src/lib/supabase.ts), lines 6-22, and the [membership migration](../../../supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql), lines 216-316.
- Quota threshold/window, counting policy, concurrency cap, shared-budget scope, and denial response remain product/design decisions. Current inspected source provides no values for them. Research establishes the boundary and evidence requirements without choosing those policies.

## Detailed Findings

### Identity and server ordering

[middleware.ts](../../../src/middleware.ts), lines 11-23, resolves the session through `supabase.auth.getUser()` into `locals.user`. Its protected-page prefix list does not include the exercise API; [request.ts](../../../src/pages/api/exercises/request.ts), lines 71-82, performs the API's teacher authorization explicitly.

[teacher-authorization.ts](../../../src/lib/services/teacher-authorization.ts), lines 17-48, queries `profile_roles` for `locals.user.id` and role `teacher`, distinguishing missing session, absent teacher role, and unavailable profile data. The authorized result is a status, not a user-ID-bearing DTO. An admission operation should use the authenticated server identity rather than adding a caller-controlled teacher ID to the JSON request. A database RPC can derive identity from `auth.uid()`, matching the inspected SQL precedent.

The handler's inspected ordering is:

1. Parse JSON and strict generation metadata.
2. Create the request-scoped client and authorize the teacher.
3. Reject missing provider configuration.
4. Invoke generation and translate its result or error.

Source: [request.ts](../../../src/pages/api/exercises/request.ts), lines 59-111. Placing admission between the configuration check and generation preserves the existing invalid-input, authorization, and unconfigured-provider rejection precedence. Charging malformed, unauthorized, or unconfigured requests would be a deliberate behavior change, not something established by this research.

The request schema contains grade, topic, and difficulty, with no request identity or quota field: [schemas.ts](../../../src/lib/exercises/schemas.ts), lines 17-24. An idempotency key would therefore introduce a contract rather than reuse a current generation feature.

### What the provider boundary bounds

For this adapter's retry loop, a timeout permits the next iteration; an HTTP response satisfying `status === 429 || status >= 500`, or a successfully parsed payload with zero surviving candidates, also permits the next iteration. A non-empty parsed subset returns from generation without a top-up call. Other generator errors are thrown rather than retried. See [openrouter-exercise-generator.ts](../../../src/lib/services/openrouter-exercise-generator.ts), lines 194-210 and 227-246.

The timer aborts an `AbortController`; it is not a strict end-to-end response-time guarantee independent of fetch/body-consumption behavior. A timed-out call is not proof that the provider performed no billable work. There is no monetary spend calculation in the inspected generation adapter. Source: [openrouter-exercise-generator.ts](../../../src/lib/services/openrouter-exercise-generator.ts), lines 173-246.

For a named example of **N admitted handler requests** that each reach the adapter and exhaust its loop, the code permits **2N total fetch attempts**. N is the number of admitted requests, not candidates or currency units. The derivation follows the loop bound in [openrouter-exercise-generator.ts](../../../src/lib/services/openrouter-exercise-generator.ts), line 227, and the handler call in [request.ts](../../../src/pages/api/exercises/request.ts), line 89.

Two counting policies remain distinguishable:

- Count admitted application requests: admission occurs once before `generate`, and a provider retry belongs to that admitted operation.
- Count provider attempts: admission must also be enforced at the attempt boundary, with specified exhaustion behavior during a retry.

The change note does not select between them. A request allowance must account for the adapter's amplification if its purpose is resource protection.

### Repetition, concurrency, and state

`beginAction` uses `useRef` to prevent overlapping generation/verification/approval actions within a mounted form; `finishAction` releases that lock. A later form submission can generate again. This mechanism has no server counter or shared teacher-level reservation. See [RequestExercisesForm.tsx](../../../src/components/exercises/RequestExercisesForm.tsx), lines 28 and 40-57.

No admission component was found in the inspected route, middleware, generator, or form. The additional scoped search covered `src`, Supabase migrations, and the checked Astro/Wrangler configuration for quota, rate-limit, and limiter references. Supabase's auth rate-limit settings concern authentication, not this handler. [wrangler.jsonc](../../../wrangler.jsonc), lines 1-17, declares assets and observability but no rate-limit, Durable Object, or KV binding. This is a repository configuration finding, not proof that the deployed Cloudflare account has no external controls.

If the chosen guarantee must span concurrent requests and Worker instances, a read-then-write counter or process-local map would not establish that guarantee. Admission needs an atomic shared-state decision before provider work. A request-frequency quota and an in-flight cap protect different conditions; one does not automatically establish the other.

Repository prior art:

- [invite.ts](../../../src/pages/api/classes/invite.ts), lines 64-101, adapts Supabase RPC responses, checks errors, and validates returned data rather than treating arbitrary database payloads as success.
- [membership migration](../../../supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql), lines 216-316, derives identity from `auth.uid()`, locks persisted state, uses a transaction advisory lock, fixes `search_path`, and restricts function execution. This is atomic-operation precedent, not an existing quota implementation.
- [profile-role migration](../../../supabase/migrations/20261001120000_add_profile_roles.sql), lines 1-16 and 40-52, supplies authenticated role lookup/RLS conventions and `public.is_teacher()`.

A Supabase admission RPC could reuse those conventions without adding a new deployed storage platform. Whether to use a window counter, cooldown, reservation ledger, or Cloudflare-specific primitive remains for planning. A concurrency reservation also needs a recovery policy for crashed or cancelled requests; `finally` cleanup alone would not cover a process that stops executing.

### Error envelope and browser behavior

The inspected generation error enum contains `INVALID_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `PROVIDER_NOT_CONFIGURED`, `PROVIDER_FAILURE`, and `PROVIDER_TIMEOUT`; it has no admission-denial or admission-storage-failure code. See [types.ts](../../../src/types.ts), lines 10-17.

A new explicit denial must be wired through the shared enum, generation error schema, typed route message map/status, and browser parsing. [schemas.ts](../../../src/lib/exercises/schemas.ts), lines 81-92, derives error validation from that enum. [request.ts](../../../src/pages/api/exercises/request.ts), lines 15-46, defines Polish messages and JSON responses.

The form displays a recognized server error message and leaves the previous batch unchanged because replacement happens on validated success. An unrecognized error code produces its generic generator-response message instead. See [RequestExercisesForm.tsx](../../../src/components/exercises/RequestExercisesForm.tsx), lines 66-80. A quota rejection should preserve the existing batch and selections.

HTTP `429` with a dedicated Polish quota message is a candidate contract, not an existing endpoint response. If planning adds `Retry-After` or reset metadata, its units, schema, and browser use need explicit definition. A provider's upstream `429` currently participates in retry/failure translation; it is not a local quota denial. Storage unavailability must be distinguishable from exceeded allowance, with an explicit policy for whether generation is blocked.

### Existing evidence and focused coverage gaps

[request.test.ts](../../../src/pages/api/exercises/request.test.ts), lines 47-63 and 80-207, injects authorization and generation doubles. It verifies invalid-input/auth/configuration no-work behavior, provider failure/timeout translation, and complete/partial success. In this inspected suite, it does not exercise a shared limiter, repeated-request exhaustion, or concurrent admission. Its default authorized double does not require a session user ID; identity-dependent tests must supply realistic authenticated locals.

[openrouter-exercise-generator.test.ts](../../../src/lib/services/openrouter-exercise-generator.test.ts), lines 32-185, uses fake external fetch and timers to cover structured request construction, non-retried short subsets, deduplication, zero-survivor retry, sampled retryable statuses, exhausted timeouts, malformed envelopes, and a non-retryable provider response. Those tests prove adapter behavior separately from handler admission.

[RequestExercisesForm.test.tsx](../../../src/components/exercises/RequestExercisesForm.test.tsx), lines 288-353, verifies duplicate submissions within a mounted form and preservation of prior results after malformed success or provider error responses. It is useful UX precedent but not proof of server-side cost protection.

For implementation planning, the cheapest meaningful coverage is:

- Handler cases for allowed admission, limit denial, explicit storage failure, and unchanged validation/auth/config rejection precedence. Rejected admission must assert no generation call.
- A composition case using the production handler and generator with fake provider fetch: denied admission causes no outbound fetch, admitted retry behavior stays within the adapter contract.
- For a database-backed policy, focused pgTAP for authenticated identity/role enforcement, allowance boundary, window expiry, and persisted counting semantics. A synchronized multi-connection test is needed to establish the chosen concurrent-admission guarantee; mocked handler tests cannot prove atomicity.
- A browser-component case for the recognized denial envelope preserving the prior batch and selected inputs.

These are handoff criteria, not new tests or a committed implementation plan. No test/build/live-provider run was needed to answer the source-level boundary question; existing assertions were inspected, not re-executed.

## Code References

- [request.ts](../../../src/pages/api/exercises/request.ts):59 - request pipeline and insertion boundary.
- [teacher-authorization.ts](../../../src/lib/services/teacher-authorization.ts):17 - authenticated role lookup.
- [openrouter-exercise-generator.ts](../../../src/lib/services/openrouter-exercise-generator.ts):175 - external attempt and abort timer.
- [openrouter-exercise-generator.ts](../../../src/lib/services/openrouter-exercise-generator.ts):227 - total-attempt loop.
- [types.ts](../../../src/types.ts):10 - generation error codes.
- [schemas.ts](../../../src/lib/exercises/schemas.ts):81 - error-envelope validation.
- [RequestExercisesForm.tsx](../../../src/components/exercises/RequestExercisesForm.tsx):40 - form-local action lock.
- [request.test.ts](../../../src/pages/api/exercises/request.test.ts):80 - current handler test boundary.
- [membership migration](../../../supabase/migrations/20261005120000_add_class_memberships_and_teacher_display_names.sql):216 - authenticated transactional precedent.

## Architecture Insights

The handler is the admission boundary; the adapter owns provider attempts. Keep those meanings separate when naming counters and tests. The existing dependency-injected handler and fetch-injected adapter allow deterministic composition without spending provider credits. Persisted admission, if selected, should validate storage results and preserve an explicit failure envelope rather than silently allow work on unknown state.

## Historical Context

- **Supported:** the original generation slice deliberately excluded a durable request quota and documented authenticated direct repetition as a risk. This matches the current inspected generation path. [Archived plan](../../archive/2026-09-24-request-polish-exercises/plan.md), lines 29 and 229.
- **Supported, with narrower scope:** its browser-active-request guard and selective retry remain implemented in the form and adapter; they are not a durable per-teacher bound. [Archived plan](../../archive/2026-09-24-request-polish-exercises/plan.md), lines 37 and 113; current sources cited above.
- **Contradicted for current role storage:** the archived plan refers to `profiles.role`. The current authorizer uses `profile_roles`; the role migration drops `profiles.role`. Do not copy that historical query into admission code. [Archived plan](../../archive/2026-09-24-request-polish-exercises/plan.md), line 121; [profile-role migration](../../../supabase/migrations/20261001120000_add_profile_roles.sql), line 54.

## Related Research

No additional research artifact was needed for this bounded generation-path investigation. The test-plan risk response and archived generation plan are the relevant prior context. No foundation lessons file was present in the inspected foundation directory.

## Open Questions and Planning Handoff

- What allowance and time window are acceptable for a teacher, and is a shared application/provider-key allowance also required?
- Do admitted requests, successful batches, or outbound provider attempts consume allowance? What happens to allowance after provider timeout/failure?
- Is an in-flight cap required in addition to request frequency? If so, what cap, expiry, and crash-recovery semantics apply?
- Which shared state primitive is approved? Supabase offers existing authenticated RPC conventions; deployed platform limits and external controls were not queried.
- What explicit denial code/message/status and retry/reset information should the endpoint expose?
- What storage-failure response and operational signal should be used? The required pre-provider protection must not be weakened by a silent allow-on-error fallback.

Research is complete for locating the current boundary, safeguards, and coverage gaps. These policy choices are unresolved by design and must be settled before an implementation plan is approved. No lifecycle completion, rollout-phase advancement, provider-cost measurement, or implementation approval is implied.
