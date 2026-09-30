# Approve First Exercise Pool Implementation Plan

## Overview

Extend the existing Polish exercise-request workflow into an explicit verify, select, and approve flow. The platform will independently verify each generated candidate, preserve inspectable evidence, let the teacher choose only successful candidates, and atomically promote that subset into the immutable approved exercise pool.

## Current State Analysis

S-01 already gives an authorized teacher one to five generated Grade 4 candidates, labels every proposed answer as unverified, and preserves the latest successful batch in versioned `sessionStorage`. F-01 already provides an immutable `exercises` table with teacher ownership, shared teacher reads, student exclusion, and required verification-evidence columns. The missing bridge is trusted verification execution and a batch approval path: browser-provided evidence cannot be accepted as authoritative, and the current database has no idempotency key linking a generated candidate to its approved exercise.

The request view is one React island with a presentational state gallery, shared semantic components, and focused happy-dom tests. API routes use Zod validation, handler factories, request-scoped teacher authorization, typed Polish errors, and dependency injection. OpenRouter is isolated behind a standards-based service with strict JSON output and deterministic Vitest seams.

## Desired End State

An authorized teacher explicitly verifies the current generated batch. Each candidate independently reaches one of four visible outcomes: a successful unique-answer match, an answer mismatch, a non-unique answer, or a technical indeterminate result. Successful results show the verified answer and concise rationale; technical failures alone can be retried.

The teacher selects any successful subset and saves it with one command. The database either promotes the complete selected subset or none of it, repeated submissions return the original exercise mappings, and only server-recorded verification evidence can enter the approved pool. Saved candidates leave the current-tab review state, while unsaved candidates, evidence, and selection survive a same-tab refresh.

### Key Discoveries:

- `src/types.ts:25-31` defines transient candidates with the literal `approvalStatus: "unverified"`; verification and approval need a separate review-state contract rather than weakening the generation response boundary.
- `src/components/hooks/use-session-exercise-batch.ts:7-72` already owns versioned same-tab recovery and is the correct place to migrate review evidence and selection without introducing reusable-pool discovery early.
- `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql:57-102` accepts only complete `unique_answer` evidence, keeps approved rows immutable, and requires creator and approver to equal the authenticated teacher.
- `src/lib/services/openrouter-exercise-generator.ts:17-186` establishes strict OpenRouter JSON, provider isolation, deadlines, typed failures, and injected test seams that the verifier should follow.
- `src/pages/api/exercises/request.ts:36-110` establishes the route ordering: validate input, authorize the teacher, validate server configuration, invoke the service, and map failures to stable Polish responses.
- `src/components/exercises/ExerciseRequestStateGallery.tsx:1-158` provides the existing development-only visual gate and should gain the verification, selection, save, error, and completion states introduced here.

## What We're NOT Doing

- Editing generated exercise text or answers; a changed candidate would require fresh verification and is deferred.
- Treating the generator's proposed answer or teacher approval alone as platform verification.
- Allowing a teacher to override a mismatch or non-unique verdict.
- Persisting technical indeterminate outcomes as successful evidence.
- Adding exercise-pool browsing, search, filtering, or reuse; those remain S-03.
- Adding assignments, classes, students, submissions, scoring, or feedback.
- Detecting semantically duplicate exercises across different candidate IDs.
- Adding background jobs, streaming verification, durable verification queues, or automatic provider fallback.
- Expanding beyond the existing Grade 4 catalog or changing generation behavior.

## Implementation Approach

Add a teacher-owned, immutable verification ledger that stores the candidate snapshot and successful or content-failure result produced by the server-side verifier. Authenticated browser clients may read their own records but cannot insert or mutate them; the verification API writes through a server-only Supabase service-role client after normal request-scoped teacher authorization. A separate `OPENROUTER_VERIFIER_MODEL` setting keeps verification independently configurable and makes the recorded verifier identity reproducible.

The verifier processes at most five candidates independently so one provider failure does not erase settled results. It derives the valid-answer set through strict structured output and applies a conservative shared normalization rule: Unicode normalization, surrounding-whitespace removal, internal-whitespace collapse, Polish case folding, and removal of one terminal sentence period. A candidate passes only when one normalized answer remains and equals the normalized proposed answer. Content failures are final for that candidate; HTTP, timeout, and malformed-provider failures become indeterminate and are eligible for an explicit targeted retry.

Approval accepts verification-record IDs, not browser-authored evidence. A security-definer PostgreSQL function validates the authenticated teacher, distinct batch size, ownership, and `unique_answer` status, then inserts missing approved exercises from ledger data and returns both new and prior mappings in the requested order. A unique provenance link from `exercises` to the verification record makes mixed new/replayed submissions atomic and idempotent under retries or concurrent tabs.

The React controller evolves the versioned session payload into a review batch containing per-candidate evidence/status plus selected IDs. The view exposes an explicit batch verification command, read-only evidence, successful-only checkboxes, targeted retry for indeterminate candidates, and one atomic save command. After success it removes only saved candidates, retains the remainder and their evidence, and presents a Polish completion summary.

## Critical Implementation Details

Verification evidence returned to the browser is presentation state, not authority: the approval API must reload the immutable ledger records and never accept verdict, rationale, verifier identity, timestamps, content, or canonical answers from the client. Existing approved rows predate provenance, so the new verification foreign key must be nullable for legacy data but mandatory inside the approval RPC for all S-02 inserts.

Run candidate verification concurrently with a bounded batch size of five and one 20-second attempt per candidate. Provider-level retries remain a visible teacher action for indeterminate candidates; this bounds a verification action and avoids multiplying up to five paid calls automatically.

## Phase 1: Establish Trusted Verification Persistence

### Overview

Create the authoritative server-side evidence ledger and the only atomic, idempotent path that may promote verified candidates into approved exercises.

### Changes Required:

#### 1. Verification ledger and provenance migration

**File**: `supabase/migrations/<timestamp>_add_exercise_verification_approval.sql`

**Intent**: Store immutable automated verification outcomes separately from transient browser state and link each newly approved exercise to the exact evidence that justified it. Prevent browser clients from manufacturing verification records.

**Contract**: Add `exercise_verifications` with a stable ID, authenticated teacher ID, source candidate ID, immutable candidate text/answer/grade/topic/difficulty snapshot, outcome `unique_answer | answer_mismatch | not_unique_answer`, verified answer where applicable, verifier identity/version, verification timestamp, and non-empty rationale. Enforce one record per teacher and candidate ID. Enable RLS so teachers may read only their own results; grant no authenticated insert, update, or delete access. Add a nullable unique `verification_id` foreign key to `exercises` for compatibility with existing F-01 rows.

#### 2. Atomic idempotent approval function

**File**: `supabase/migrations/<timestamp>_add_exercise_verification_approval.sql`

**Intent**: Promote a selected successful subset without trusting client evidence, creating partial batches, or duplicating exercises after ambiguous network outcomes.

**Contract**: Add `approve_verified_exercises(uuid[])` with an empty `search_path`, explicit authenticated execution grant, and no public grant. Require one to five distinct verification IDs, an authenticated teacher role, ownership of every record, and `unique_answer` for every item before writing. Insert approved rows from ledger snapshots with `creator_id` and `approver_id` set to `auth.uid()`, preserve verifier evidence exactly, reuse an exercise already linked to a supplied verification ID, and return ordered verification-to-exercise mappings plus whether each mapping was newly created. Any invalid item aborts the complete call.

#### 3. Database boundary tests

**File**: `supabase/tests/database/exercise_verification_approval.sql`

**Intent**: Prove the trust, ownership, atomicity, immutability, and replay guarantees independently of API and UI code.

**Contract**: Cover ledger constraints and grants, teacher-only own-result reads, student exclusion, direct authenticated-write denial, service-authored fixtures, rejection of mixed-owner/content-failure/duplicate/oversized inputs, complete rollback when one selected record is invalid, successful subset promotion, exact evidence copying, repeated and overlapping approval calls returning one exercise per verification, and preservation of F-01 no-update behavior.

#### 4. Server-only Supabase writer

**File**: `astro.config.mjs`, `.env.example`, `src/lib/supabase.ts`, `src/lib/config-status.ts`

**Intent**: Let the verified server route write authoritative ledger records without granting that capability to authenticated browser sessions.

**Contract**: Add optional-at-build `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_VERIFIER_MODEL` server secrets. Expose a non-persistent service client only to server modules, keep request authorization on the cookie-backed client, and report verification as unavailable unless the API key, verifier model, Supabase URL, and service-role key are present. Never expose or log either secret.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies the verification ledger, legacy-compatible provenance link, grants, RLS, and approval function to a clean local database.
- `npm run db:test` proves trusted ledger writes, ownership isolation, atomic rollback, exact evidence promotion, idempotent replay, concurrent-overlap behavior, and inherited approved-exercise immutability.
- `npm run test`, `npm run lint`, and `npx astro check` pass with the new configuration and server-client contracts.

#### Manual Verification:

- In local Supabase Studio, confirm an existing F-01 exercise remains valid without provenance, a new S-02 exercise links to one immutable verification record, and an authenticated browser client cannot insert or alter that record.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 2: Build Verification and Approval APIs

### Overview

Implement independent answer verification, granular batch outcomes, trusted evidence recording, and teacher-only approval endpoints using the established provider and route patterns.

### Changes Required:

#### 1. Verification and approval contracts

**File**: `src/types.ts`, `src/lib/exercises/schemas.ts`, `src/lib/exercises/answer-normalization.ts`, `src/lib/exercises/answer-normalization.test.ts`

**Intent**: Give service, API, storage, and UI layers one discriminated contract for settled content outcomes versus retryable technical failures. Keep answer comparison conservative and independently testable.

**Contract**: Define verification requests for one to five existing candidates; persisted results for `unique_answer`, `answer_mismatch`, and `not_unique_answer`; transient `indeterminate` results with stable provider error codes; batch response ordering by candidate ID; approval requests containing one to five distinct verification IDs; approval mappings and typed Polish errors. Export one normalization function implementing the exact rule in the approach, and validate every untrusted request, provider result, API response, and stored review payload with Zod.

#### 2. Independent OpenRouter verifier

**File**: `src/lib/services/openrouter-exercise-verifier.ts`, `src/lib/services/openrouter-exercise-verifier.test.ts`

**Intent**: Derive valid answers independently from generation and classify each candidate without allowing one provider failure to invalidate the rest of the batch.

**Contract**: Use `OPENROUTER_VERIFIER_MODEL`, non-streaming strict JSON Schema, and `provider.require_parameters`. For each candidate request the derived valid-answer set and a concise Polish rationale, enforce a 20-second abort deadline with no automatic retry, normalize/deduplicate derived answers, and classify exactly one matching answer as `unique_answer`, exactly one differing answer as `answer_mismatch`, and zero or multiple answers as `not_unique_answer`. Return typed technical failures without raw provider bodies, prompts, candidate answers, or secrets in logs. Inject `fetch`, deadline, and clock dependencies for deterministic tests; record verifier identity as OpenRouter plus a stable verification-strategy version and record the configured model as verifier version.

#### 3. Batch verification endpoint and trusted recording

**File**: `src/pages/api/exercises/verify.ts`, `src/pages/api/exercises/verify.test.ts`

**Intent**: Verify the full current batch or only its indeterminate subset while preserving successful and content-failure results independently.

**Contract**: Add non-prerendered `POST /api/exercises/verify`. Validate before authorization, authorize through the request-scoped client, reject missing verifier/service configuration with a typed `503`, return `401`/`403` consistently with generation, and process at most five distinct candidates concurrently. Reuse an existing same-teacher/same-candidate ledger result only when its complete candidate snapshot matches; return `409` for candidate-ID reuse with conflicting content. Persist each settled provider result through the service client and return it; map each technical failure to an `indeterminate` item while retaining other results and return `200` for a structurally completed mixed batch.

#### 4. Approval endpoint

**File**: `src/pages/api/exercises/approve.ts`, `src/pages/api/exercises/approve.test.ts`

**Intent**: Expose the database promotion function through a narrow teacher-only HTTP contract and preserve retry-safe success semantics.

**Contract**: Add non-prerendered `POST /api/exercises/approve`. Validate the distinct verification-ID subset, authorize the teacher, invoke `approve_verified_exercises` through the request-scoped Supabase client, and return the ordered mappings for both new and replayed approvals. Map unauthenticated, forbidden, invalid/ineligible selection, unavailable database, and unexpected persistence failures to stable Polish envelopes without leaking database details.

### Success Criteria:

#### Automated Verification:

- `npm run test -- src/lib/exercises/answer-normalization.test.ts src/lib/services/openrouter-exercise-verifier.test.ts` proves conservative normalization, unique matches, mismatches, non-unique answers, malformed responses, HTTP failures, and timeout behavior without live provider calls.
- `npm run test -- src/pages/api/exercises/verify.test.ts src/pages/api/exercises/approve.test.ts` proves validation-before-auth, teacher authorization, missing configuration, mixed settled/indeterminate verification, trusted recording, conflicting candidate replay, eligible approval, atomic failure mapping, and idempotent response handling.
- `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass without OpenRouter or service-role secrets present at build time.

#### Manual Verification:

- With a dedicated verifier model configured in local `workerd`, verify a batch containing a matching answer, a deliberate mismatch, and an ambiguous exercise; confirm the Polish evidence is concise, only the matching result is eligible, ledger identity/version fields name the actual strategy/model, and logs expose no prompts, answers, or secrets.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 3: Deliver the Batch Review Workflow

### Overview

Turn the existing candidate list into a resumable verification and approval workflow while retaining the established quiet-classroom UI contract.

### Changes Required:

#### 1. Versioned review-batch state

**File**: `src/components/hooks/use-session-exercise-batch.ts`, `src/components/hooks/use-session-exercise-batch.test.ts`

**Intent**: Preserve paid generation and verification work, current selection, and unsaved candidates across same-tab refreshes without making browser state authoritative.

**Contract**: Advance the stored envelope version and represent per-candidate `unverified | unique_answer | answer_mismatch | not_unique_answer | indeterminate` review state plus optional persisted evidence and selected verification IDs. Migrate a valid version-1 generation batch to version 2 with every candidate unverified; reject malformed evidence/status combinations. Expose operations to apply ordered verification results, select only successful records, retain settled results while replacing targeted indeterminate results, remove exactly the server-confirmed saved candidates, and clear or replace the complete batch.

#### 2. Verification and approval controller

**File**: `src/components/exercises/RequestExercisesForm.tsx`, `src/components/exercises/RequestExercisesForm.test.tsx`

**Intent**: Coordinate generation, explicit verification, targeted retry, selection, and atomic approval without concurrent actions or loss of prior results on failure.

**Contract**: Keep one controller for the existing island. Verify all unverified candidates on the first command and only indeterminate candidates on retry; merge results by candidate ID. Disable generation, verification, selection, clearing, and approval as appropriate while either mutation is pending. Submit only selected successful verification IDs for approval, preserve the complete review batch after any save failure, and after success remove server-confirmed candidates, retain all unsaved evidence/selection, and announce a Polish saved-count summary. Existing generation success still replaces the previous review batch; generation failure still preserves it.

#### 3. Review and evidence presentation

**File**: `src/components/exercises/ExerciseRequestView.tsx`, `src/components/exercises/ExerciseCandidateList.tsx`

**Intent**: Make the two gates understandable and fast to scan: automated evidence first, teacher selection and approval second.

**Contract**: Add an explicit `Zweryfikuj zestaw` action, per-candidate semantic status badges, read-only verified answer and concise rationale, successful-only checkboxes, selected count, `Ponów nierozstrzygnięte` for technical failures, and one `Zatwierdź i zapisz` action. Distinguish content failures from technical indeterminate states in Polish, explain why ineligible controls are disabled, preserve candidate order and metadata, use the existing semantic Alert/Badge/Button/Card/Field APIs, maintain accessible names and live feedback, and do not add edit or override controls.

#### 4. Deterministic visual fixtures

**File**: `src/components/exercises/ExerciseRequestStateGallery.tsx`

**Intent**: Keep every new review state inspectable on desktop/mobile and in both semantic modes without provider or database calls.

**Contract**: Extend the development gallery with unverified, verifying, mixed verification, selected subset, approval loading/error, partial post-save, and all-saved completion fixtures using the real presentational components. Preserve the production-only `404` guard and existing teacher/student light/dark controls.

### Success Criteria:

#### Automated Verification:

- `npm run test -- src/components/hooks/use-session-exercise-batch.test.ts` proves version-1 migration, version-2 evidence/selection restoration, invalid-state cleanup, targeted result replacement, and exact saved-candidate removal.
- `npm run test -- src/components/exercises/RequestExercisesForm.test.tsx` proves explicit verification, granular mixed results, indeterminate-only retry, successful-only selection, mutation lockout, atomic save failure preservation, idempotent success handling, and remainder retention.
- `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass after the production view and gallery fixtures are wired.

#### Manual Verification:

- At desktop and mobile widths, keyboard-only and pointer users can verify, inspect evidence, select an eligible subset, recover an indeterminate result, save, and continue with the remainder without clipped text, overlapping controls, unclear disabled states, or lost focus/status announcements.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 4: Verify the North-Star Flow

### Overview

Exercise the complete generation-to-approved-pool boundary under production-preview conditions and retain reproducible evidence for the milestone's north-star slice.

### Changes Required:

#### 1. Provider-free production smoke coverage

**File**: `scripts/smoke.mjs`

**Intent**: Prove the built Cloudflare application exposes the new protected boundaries correctly without spending provider credits in CI.

**Contract**: Extend the existing authenticated smoke flow with invalid verification and approval requests, missing verifier-configuration behavior, and continued development-gallery isolation. Keep OpenRouter and the service-role key absent from the provider-free build where required, avoid inserting approved exercises, and preserve all existing auth/generation assertions.

#### 2. Operational and manual verification record

**File**: `README.md`, `context/changes/approve-first-exercise-pool/manual-verification.md`, `context/changes/approve-first-exercise-pool/screenshots/*.png`

**Intent**: Document secure local verifier setup and retain reviewable evidence that the first trusted pool can actually be created.

**Contract**: Document the service-role and dedicated verifier-model settings, local database reset/test commands, and live-check prerequisites without real values. Record date, browser, OS, exact desktop/mobile viewports, configured verifier model identifier, scenarios and outcomes, database evidence, keyboard/focus/accessibility findings, and screenshot filenames for mixed verification, selected subset, save error, and post-save remainder/completion states.

### Success Criteria:

#### Automated Verification:

- `npm run db:test`, `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` all pass after the complete S-02 workflow is implemented.
- `npm run smoke` passes against a provider-free production preview, covering protected verification/approval boundaries and confirming the development gallery remains unavailable.

#### Manual Verification:

- In a live local `workerd` flow, generate a batch, verify it with the dedicated model, inspect mixed evidence, approve a successful subset, retry the identical approval and confirm no duplicate, refresh and retain the unsaved remainder, then verify the stored exercise exactly matches its immutable ledger evidence.
- Retained desktop and mobile screenshots plus keyboard checks show mixed verdicts, selected subset, approval failure, post-save remainder, and completion states with readable Polish text, visible focus, correct accessible names, no overlap, and no layout shift.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual checks before considering the change ready for implementation review.

## Addenda

- Phase 3 added `src/lib/exercises/exercise-count.ts` (Polish noun pluralization for the saved-count summary) with its test.
- Verification ledger write failures now yield a per-candidate `indeterminate` result instead of failing the whole batch.

## Testing Strategy

### Unit Tests:

- Test answer normalization at whitespace, case, Unicode, terminal-period, and meaningful-content boundaries; prefer conservative false negatives over silently treating different answers as equal.
- Drive the verifier with fake OpenRouter responses and timers for matching, mismatch, zero/multiple answers, malformed envelopes, HTTP failures, and abort deadlines.
- Test API handler factories with injected authorization, verifier, service writer, and approval RPC dependencies; no automated test spends provider credits.
- Exercise the session-state reducer/hook and rendered controller for every status transition, invalid persisted shape, duplicate action lock, retry subset, save failure, and successful removal predicate.

### Integration Tests:

- Use pgTAP fixtures with separate teachers and a student to prove ledger grants/RLS, service-authored evidence, exact promotion, atomic rollback, replay, overlap, and student exclusion.
- Run the complete Vitest suite across schema, service, endpoint, hook, and UI boundaries.
- Run the production-preview smoke flow with provider/service secrets absent to verify stable error contracts and route protection without external calls.

### Manual Testing Steps:

1. Reset local Supabase, configure the server-only service role and a dedicated structured-output verifier model, and start the Cloudflare development server.
2. Sign in as a teacher, generate a candidate batch, and invoke explicit batch verification.
3. Inspect successful, mismatch, non-unique, and simulated indeterminate states; retry only the indeterminate subset and confirm settled evidence does not change.
4. Select a subset of successful candidates, submit approval, and confirm saved candidates leave the review while unsaved evidence and selection survive refresh.
5. Repeat the identical approval payload and overlap it from another tab; confirm the same exercise IDs return and no duplicate rows appear.
6. Trigger an approval failure and confirm no selected exercise is inserted and the complete review state remains available.
7. Inspect the ledger and approved rows in Supabase, then test as another teacher and a student to confirm inherited pool visibility and answer isolation.
8. Capture and record desktop/mobile, keyboard, focus, status-announcement, and responsive findings through the development gallery and production teacher view.

## Performance Considerations

Verification is bounded to five candidates and runs independent calls concurrently, each with one 20-second deadline and no automatic retry. This keeps wall-clock latency near one provider attempt and lets the teacher decide whether indeterminate items justify more cost. Approval is one database round trip and one transaction; indexes on `(teacher_id, candidate_id)` and the unique exercise provenance link support replay and ownership checks without speculative pool-search indexes.

## Migration Notes

The migration is forward-only. Existing approved exercises remain valid with a null verification provenance link; every exercise created through S-02 must have one. `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_VERIFIER_MODEL` are server-only deployment settings and must be provisioned separately in local `.dev.vars` and Cloudflare secrets/configuration. A code rollback does not remove ledger rows or provenance, so schema corrections require a later forward migration.

The version-1 session payload is migrated locally to version 2 as an unverified review batch. Unsupported or internally inconsistent future payloads are cleared using the existing defensive recovery behavior; no durable browser-data backfill is required.

## References

- `context/foundation/prd.md` — FR-006, FR-007, and FR-008 define platform verification, Polish teacher approval, and batch saving.
- `context/foundation/roadmap.md` — S-02 is the milestone north star and keeps teacher approval as the final gate.
- `context/archive/2026-09-23-verified-exercise-persistence/plan.md` — approved-only immutable evidence and RLS contract inherited from F-01.
- `context/archive/2026-09-24-request-polish-exercises/plan.md` — transient candidate, provider, request API, and same-tab recovery contracts inherited from S-01.
- `context/archive/2026-09-28-ui-shared-components-with-role-specific-semantic-tokens/ui-contract.md` — quiet classroom utility, semantic statuses, shared components, and visual evidence gate.
- `src/lib/services/openrouter-exercise-generator.ts` — provider adapter, strict JSON, timeout, and dependency-injection pattern.
- `src/pages/api/exercises/request.ts` — typed Astro JSON endpoint and teacher-authorization pattern.
- `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql` — immutable approved-exercise schema and access boundary.
- `src/components/hooks/use-session-exercise-batch.ts` — versioned current-tab state boundary.
- `src/components/exercises/ExerciseRequestStateGallery.tsx` — deterministic view-state and screenshot surface.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Establish Trusted Verification Persistence

#### Automated

- [x] 1.1 `npx supabase db reset` applies the verification ledger, legacy-compatible provenance link, grants, RLS, and approval function to a clean local database. — 68c32ee
- [x] 1.2 `npm run db:test` proves trusted ledger writes, ownership isolation, atomic rollback, exact evidence promotion, idempotent replay, concurrent-overlap behavior, and inherited approved-exercise immutability. — 68c32ee
- [x] 1.3 `npm run test`, `npm run lint`, and `npx astro check` pass with the new configuration and server-client contracts. — 68c32ee

#### Manual

- [x] 1.4 In local Supabase Studio, confirm an existing F-01 exercise remains valid without provenance, a new S-02 exercise links to one immutable verification record, and an authenticated browser client cannot insert or alter that record. — 68c32ee

### Phase 2: Build Verification and Approval APIs

#### Automated

- [x] 2.1 `npm run test -- src/lib/exercises/answer-normalization.test.ts src/lib/services/openrouter-exercise-verifier.test.ts` proves conservative normalization, unique matches, mismatches, non-unique answers, malformed responses, HTTP failures, and timeout behavior without live provider calls. — 955f2c3
- [x] 2.2 `npm run test -- src/pages/api/exercises/verify.test.ts src/pages/api/exercises/approve.test.ts` proves validation-before-auth, teacher authorization, missing configuration, mixed settled/indeterminate verification, trusted recording, conflicting candidate replay, eligible approval, atomic failure mapping, and idempotent response handling. — 955f2c3
- [x] 2.3 `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass without OpenRouter or service-role secrets present at build time. — 955f2c3

#### Manual

- [x] 2.4 With a dedicated verifier model configured in local `workerd`, verify a batch containing a matching answer, a deliberate mismatch, and an ambiguous exercise; confirm the Polish evidence is concise, only the matching result is eligible, ledger identity/version fields name the actual strategy/model, and logs expose no prompts, answers, or secrets. — 955f2c3

### Phase 3: Deliver the Batch Review Workflow

#### Automated

- [x] 3.1 `npm run test -- src/components/hooks/use-session-exercise-batch.test.ts` proves version-1 migration, version-2 evidence/selection restoration, invalid-state cleanup, targeted result replacement, and exact saved-candidate removal. — dfa5bdf
- [x] 3.2 `npm run test -- src/components/exercises/RequestExercisesForm.test.tsx` proves explicit verification, granular mixed results, indeterminate-only retry, successful-only selection, mutation lockout, atomic save failure preservation, idempotent success handling, and remainder retention. — dfa5bdf
- [x] 3.3 `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass after the production view and gallery fixtures are wired. — dfa5bdf

#### Manual

- [x] 3.4 At desktop and mobile widths, keyboard-only and pointer users can verify, inspect evidence, select an eligible subset, recover an indeterminate result, save, and continue with the remainder without clipped text, overlapping controls, unclear disabled states, or lost focus/status announcements. — dfa5bdf

### Phase 4: Verify the North-Star Flow

#### Automated

- [x] 4.1 `npm run db:test`, `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` all pass after the complete S-02 workflow is implemented.
- [x] 4.2 `npm run smoke` passes against a provider-free production preview, covering protected verification/approval boundaries and confirming the development gallery remains unavailable.

#### Manual

- [x] 4.3 In a live local `workerd` flow, generate a batch, verify it with the dedicated model, inspect mixed evidence, approve a successful subset, retry the identical approval and confirm no duplicate, refresh and retain the unsaved remainder, then verify the stored exercise exactly matches its immutable ledger evidence.
- [x] 4.4 Retained desktop and mobile screenshots plus keyboard checks show mixed verdicts, selected subset, approval failure, post-save remainder, and completion states with readable Polish text, visible focus, correct accessible names, no overlap, and no layout shift. — verified manually on 2026-09-30 without retained screenshots (waived); see manual-verification.md
