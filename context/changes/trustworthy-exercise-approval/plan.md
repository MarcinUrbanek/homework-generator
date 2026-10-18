# Trustworthy Exercise Approval Implementation Plan

## Overview

Implement Risk #3 protection: every newly approved exercise and every exercise
statement shown to a student must have authoritative evidence of one correct
natural-number answer. Model agreement is not that evidence. Keep teacher review,
but use versioned arithmetic structures, exact evaluation, and server-owned Polish
rendering to justify the answer for the precise displayed statement.

This is the active `trustworthy-exercise-approval` change. It does not implement
Risk #5 or complete test-rollout Phase 2.

## Current State Analysis

The [frame](./frame.md) reports a contract question, not a measured production
incident: compare authoritative runtime admission with independent tests retaining
probabilistic runtime. Its confirmed problem statement is:

> **The actual problem to plan around is**: ustalić, czy zatwierdzenie ma wymagać dowodu poprawności i jednoznaczności dla każdego ćwiczenia w ograniczonej domenie, czy produkt świadomie przyjmuje probabilistyczną ocenę wspartą testami.

The user subsequently confirmed the per-exercise condition and accepted limited
scope. Teacher approval checks usefulness and presentation; it cannot substitute
for mathematical authority.

The frame's hypothesis investigation establishes that model-reported singleton
agreement currently forms success, snapshot binding prevents substitution but
does not prove truth, supplied-answer fixtures do not independently solve content,
and an offline corpus alone cannot meet the runtime condition. Its narrowing
signals settle the guarantee, limited domain, and teacher role.

Current flow:

`model text/proposed answer -> model answer set -> persisted snapshot -> approval RPC -> pool`

The [research](./research.md) grounds the existing verifier, ledger, and browser
contracts. Focused follow-up research found:

- Homework persists exercise identity/order, not separate prompt/answer snapshots.
  Student display and first scoring join the current pool row.
- Discovery and new assignment check existing verdict/metadata, not mathematical
  authority. Service-role fixtures can insert unlinked pool rows.
- The local manual seed also inserts free-form pool exercises directly.
- Old browser storage can restore model-only `unique_answer` evidence and selection.
- No runtime template evaluator or reviewed authoritative corpus exists.
- Deployed data is unknown; quarantine must work whether legacy rows exist or not.

## Desired End State

- Grade 4 addition/subtraction, multiplication/exact division, and order-of-operations
  exercises are supported across `easy`, `medium`, and `hard`. Word problems and
  arbitrary prose are not supported for new generation, verification, or approval.
- Models propose structures/parameters, never authoritative text or answers.
  The server validates them, renders the Polish prompt, and computes its answer.
- `unique_answer` means a supported, versioned structure has been independently
  evaluated and the exact prompt, answer, metadata, and evidence agree.
- Approval, direct pool writes, discovery, new assignment, student prompt retrieval,
  and first submission all enforce the same certification contract.
- Legacy rows are retained but quarantined. Affected pending homework is explicitly
  unavailable. Persisted results remain accessible under current authorization,
  without rescoring or exposing uncertified prompts.
- Old browser batches remain visible as read-only, ineligible references with cleared
  selections and a regeneration notice.

### Key Discoveries:

- [Verifier classification](../../../src/lib/services/openrouter-exercise-verifier.ts:121)
  checks a model-supplied set, not the complete mathematical solution set.
- [Verification snapshot](../../../src/pages/api/exercises/verify.ts:103) and
  [approval](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:110)
  already provide useful ownership and content-binding boundaries.
- [Catalog](../../../src/lib/exercises/catalog.ts:17) gives the existing numeric
  and operation-count guidance for the three supported topics and difficulty buckets.
- [Latest assignment validation](../../../supabase/migrations/20261009083500_make_homework_assignment_retries_membership_stable.sql:328)
  must be replaced in a new migration, not by editing historical migrations.
- [Student prompt join](../../../supabase/migrations/20261009145925_add_homework_submissions.sql:244)
  and [first scoring](../../../supabase/migrations/20261009145925_add_homework_submissions.sql:501)
  depend on the current exercise row.
- [Submitted result rendering](../../../src/components/homework/StudentHomeworkView.tsx:133)
  currently displays prompts again; retaining results requires a prompt-free branch.
- [Manual seed](../../../scripts/seed-homework-manual-test.mjs:192) is another trusted
  direct-write surface that must use certified content.

## What We're NOT Doing

- Free-form word problems, model parsing of prose into supposedly proven arithmetic,
  fractions, decimals, negative answers, or the full primary-school curriculum.
- More model votes, a stronger prompt, or a model-verifier fallback for eligibility.
- Provider-resilience redesign, new quota semantics, Risk #5 completion, assignment
  allocation redesign, or changes to the at-least-50-percent scoring rule.
- Deleting historical exercises, assignments, or submissions; automatically declaring
  old evidence certified; rewriting or rescoring old results.
- A general expression language, arbitrary expression evaluation, an expert-review
  workflow, a new external corpus, or new dependencies unless implementation proves
  an existing capability genuinely insufficient.
- New CI pipelines, hooks, E2E infrastructure, or a changed test-risk strategy.

## Implementation Approach

Use a closed, versioned arithmetic representation with bounded natural-number
parameters and explicit expression grouping. Centralize its TypeScript validation,
rendering, and evaluation in one domain module. Provider output contains only
supported structure proposals. Generation derives text and proposed answer from
validated structure; verification recomputes them rather than trusting either.

Persist the complete structure and authority version with immutable candidate
evidence. The database also validates supported structure, rendered statement,
computed answer, metadata, and ledger-to-pool binding. A caller-supplied Boolean,
verifier identity string, or digest alone must never constitute certification.
Keep a small database implementation of this closed contract for trusted direct
writes, with cross-boundary fixtures proving agreement with the TypeScript contract.
This duplication is necessary for database enforcement, not a second product policy.

Preserve current API authorization, batch size, partial-batch response shape,
quota/reservation lifecycle, approval ordering/idempotency, class membership checks,
and final-result retry behavior unless this plan explicitly changes eligibility.
Distinguish unsupported evidence from mathematical mismatch and technical failure.

## Critical Implementation Details

### Release sequencing

These five phases are implementation checkpoints, not independent releases. Use
an additive migration and a maintenance window: stop application traffic, apply
all enforcement migrations, deploy the compatible application, verify, then reopen.
Do not run old student/scoring paths against newly quarantined data or release the
generation changes before downstream guards are ready.

### Historical results

Quarantine is not loss of authorization. Membership/ownership denial must still
take precedence. An authorized submitted result can be returned without prompts;
the equivalent retry returns the persisted result, never recomputes it. A pending
allocation containing any uncertified exercise returns no prompts and accepts no
first submission, including a mixed certified/uncertified allocation.

## Phase 1: Arithmetic authority and generation

### Overview

Define the exact finite arithmetic contract and bind every generated statement to
it, without treating model wording or answers as authority.

### Changes Required:

#### 1. Supported domain and exact evaluation

**Files**: [catalog.ts](../../../src/lib/exercises/catalog.ts),
[schemas.ts](../../../src/lib/exercises/schemas.ts),
[types.ts](../../../src/types.ts);
new `src/lib/exercises/arithmetic-authority.ts` and its unit test.

**Intent**: Establish one closed arithmetic vocabulary and deterministic Polish
rendering. Reuse the existing topic/difficulty guidance rather than inventing new
pedagogical buckets.

**Contract**: Version 1 has a discriminated, bounded expression structure with
natural-number integer leaves and addition, subtraction, multiplication, and
division nodes. Topic-specific operator families and numeric/operation-count limits
are explicit constants derived from the current catalog, tested at their boundaries.
Every intermediate value is a natural number; division requires a positive divisor
and exact divisibility. Reject unknown nodes/versions, oversized or excessively deep
structures, fractional/negative intermediates, and out-of-bucket parameters.
Use exact integer arithmetic, not floating-point approximation. Fully parenthesized
expressions and a fixed Polish instruction ask for exactly one scalar natural-number
result; the structure uniquely determines the rendered bytes and canonical digits.
The candidate carries its structure/version alongside existing metadata.

#### 2. Structured provider proposals

**Files**: [openrouter-exercise-generator.ts](../../../src/lib/services/openrouter-exercise-generator.ts),
[request.ts](../../../src/pages/api/exercises/request.ts), their tests.

**Intent**: Let models choose supported parameters while the server owns both
meaning and presentation. Reject word-problem requests before provider admission.

**Contract**: Provider JSON proposes structures only; provider text/answers cannot
override server values. Validate each proposal and derive its candidate text/answer
using the shared authority module. Preserve distinct rendered text, five requested
items, one-to-five survivors, `validCount`, and `partial_batch`. Preserve existing
retry, error, quota, and reservation-release behavior; no retry solely to replace
filtered items. Unsupported topic requests receive explicit typed rejection and
make no provider call or quota reservation.

### Success Criteria:

#### Automated Verification:

- Domain tests prove exact answers, unique rendering, all nine topic/difficulty buckets, and invalid/boundary rejection: `npm test -- src/lib/exercises/arithmetic-authority.test.ts`.
- Generator/request tests preserve admission and batch contracts and reject unsupported requests without provider work: `npm test -- src/lib/services/openrouter-exercise-generator.test.ts src/pages/api/exercises/request.test.ts src/lib/services/exercise-generation-admission.test.ts`.

#### Manual Verification:

- A reviewer independently checks version 1 Polish wording, precedence/grouping, topic limits, and literal expected answers for the supported template families.

**Implementation Note**: Pause after automated verification for manual confirmation.

## Phase 2: Verification and pool admission

### Overview

Replace model-only success with immutable, independently recomputed structure
evidence and database-enforced promotion.

### Changes Required:

#### 1. Deterministic verification and evidence contracts

**Files**: [verify.ts](../../../src/pages/api/exercises/verify.ts),
[schemas.ts](../../../src/lib/exercises/schemas.ts), [types.ts](../../../src/types.ts);
new `src/lib/services/arithmetic-exercise-verifier.ts` and tests;
[openrouter-exercise-verifier.ts](../../../src/lib/services/openrouter-exercise-verifier.ts).

**Intent**: Recompute supported candidate evidence without a verifier model call.
Remove the model verifier from the production approval path; do not silently fall
back to it.

**Contract**: Success requires a current supported structure, exact regenerated
text/metadata, and the computed answer matching the candidate proposal. Persist
structure, template/authority version, and the bound snapshot. Preserve
`answer_mismatch` for an incorrect proposal. Add a settled `unsupported_evidence`
outcome for missing/unknown structure, incompatible text, or legacy model-only
evidence; do not claim an ambiguous statement was proven non-unique. It is
non-selectable and not a provider retry. Technical persistence failures remain
explicit failures, with sanitized diagnostics rather than fabricated provider
outcomes. Existing evidence reuse and insert-race recovery compare the complete
structured snapshot and authority version. Old ledger records never return current
`unique_answer`, even if their old outcome says so. Remove verification's dependency
on `OPENROUTER_VERIFIER_MODEL`; retain the service writer configuration requirement.

#### 2. Persisted authority and immutable pool entry

**Files**: new timestamped migration under [supabase/migrations](../../../supabase/migrations/);
[exercise_verification_approval.sql](../../../supabase/tests/database/exercise_verification_approval.sql),
[verified_exercise_persistence.sql](../../../supabase/tests/database/verified_exercise_persistence.sql);
[approve.ts](../../../src/pages/api/exercises/approve.ts), tests.

**Intent**: Make authority a checked data invariant rather than a label from a
trusted caller. Preserve all existing evidence/selection ownership checks.

**Contract**: Add nullable structure/version fields so historical rows remain
unchanged and uncertified. Add database functions validating the closed version 1
structure and deriving exact text/answer under the same declared domain limits.
Reject newly inserted successful evidence with unsupported structure or inconsistent
snapshot. Approval requires current authoritative evidence and copies the exact
certified snapshot. Enforce the same binding on all new pool writes, including
service-role inserts: a successful owned ledger link, correct computed answer,
matching text/metadata/version, and the existing approval requirements are mandatory.
New unlinked/model-only pool entries are rejected. Prevent mutation of certified
content, answer, metadata, or proof through ordinary and service-role data writes;
historical rows cannot be relabeled certified in place. Preserve authorized deletion
and referenced-row restrictions. Grant only necessary function permissions and
preserve RLS. Unknown versions fail closed. Schema owners changing DDL remain an
explicit administrative trust boundary, not something these checks can prevent.

### Success Criteria:

#### Automated Verification:

- Verification/approval tests prove exact structure binding, stale-evidence denial, conflict/reuse behavior, typed failures, and no model-verifier call: `npm test -- src/lib/services/arithmetic-exercise-verifier.test.ts src/pages/api/exercises/verify.test.ts src/pages/api/exercises/approve.test.ts`.
- Local migrations apply without deleting historical rows: `npx supabase migration up --local`.
- Database tests reject forged success, unlinked trusted writes, wrong-owner promotion, and certified snapshot mutation while preserving valid idempotent approval: `npx supabase test db --local supabase/tests/database/exercise_verification_approval.sql supabase/tests/database/verified_exercise_persistence.sql`.

#### Manual Verification:

- Inspect one certified and one retained legacy ledger/pool pair; only the certified pair passes approval and its structure, rendered prompt, answer, and ownership agree.

**Implementation Note**: Pause after automated verification for manual confirmation.

## Phase 3: Discovery and homework protection

### Overview

Carry authority to every student-facing consumption boundary and preserve historical
results without re-exposing uncertified statements.

### Changes Required:

#### 1. Database consumers and quarantine

**Files**: new timestamped migration replacing current functions from
[saved discovery](../../../supabase/migrations/20261002120000_add_saved_exercise_discovery.sql),
[assignment retries](../../../supabase/migrations/20261009083500_make_homework_assignment_retries_membership_stable.sql),
and [student submissions](../../../supabase/migrations/20261009145925_add_homework_submissions.sql);
their database suites.

**Intent**: Retain old data but prevent it from being reused or shown as certified.
Guard reads and first scoring in the database, not only in React.

**Contract**: Saved discovery excludes uncertified rows. New assignment rejects
uncertified IDs through the same eligibility predicate. Existing assignment replay
does not create new work or certify old rows. Pending student detail and first submit
fail closed if any allocated row is uncertified, returning no exercise statements
and writing no submission/answer rows. Keep assignment IDs/order and persisted
results unchanged. For authorized submitted homework, detail and equivalent retry
return the original result through a prompt-free historical-result shape; changed
answers still conflict. Membership and cross-user denials remain intact. Audit
direct table/RLS access as well as RPC joins so no authenticated student query can
retrieve quarantined statements. Do not backfill proof from old verdicts or overwrite
old prompt/answer data.

#### 2. Explicit result-only and unavailable contracts

**Files**: [types.ts](../../../src/types.ts), [schemas.ts](../../../src/lib/exercises/schemas.ts),
[student-homework.ts](../../../src/lib/services/student-homework.ts),
[homework-assignments.ts](../../../src/lib/services/homework-assignments.ts),
[homework detail page](../../../src/pages/homework/[assignmentId].astro),
[StudentHomeworkForm.tsx](../../../src/components/homework/StudentHomeworkForm.tsx),
[StudentHomeworkView.tsx](../../../src/components/homework/StudentHomeworkView.tsx),
and [homework API routes](../../../src/pages/api/homework/).

**Intent**: Explain unavailable pending work and show retained results without
requiring the old prompts. Integrate the discriminated shapes through SSR and API
reload/recovery, rather than pretending an empty exercise array is normal detail.

**Contract**: Add explicit result-only detail with assignment metadata, persisted
pass/fail/counts/time, and position-based submitted answers/correctness, but no
exercise text, canonical answers, or authority internals. Render it without an
editable form or prompt labels. Reuse generic unavailable semantics for pending
quarantine with Polish guidance to contact the teacher; do not leak unrelated data.
Clear previously displayed prompts when an open tab receives quarantine denial,
including recovery/retry paths. Preserve `private, no-store`, authorization, student
answer normalization, and the 50-percent threshold. A typed discriminator, not a
missing field interpreted as success, distinguishes historical results.

### Success Criteria:

#### Automated Verification:

- Consumer database tests prove hidden discovery rows, rejected new allocations, all-or-nothing mixed legacy detail/submission denial, and unchanged historical result/retry behavior: `npx supabase test db --local supabase/tests/database/saved_exercise_discovery.sql supabase/tests/database/homework_assignments.sql supabase/tests/database/homework_submissions.sql`.
- Homework service/API/UI tests prove result-only reload and quarantine denial without prompt or canonical-answer leakage: `npm test -- src/lib/services/student-homework.test.ts src/lib/services/homework-assignments.test.ts src/pages/api/homework src/components/homework/StudentHomeworkForm.test.tsx`.

#### Manual Verification:

- With an authorized student, legacy pending homework is unavailable, legacy submitted homework shows the original result without prompts, and current certified homework remains readable and submittable; another student and revoked membership remain denied.

**Implementation Note**: Pause after automated verification for manual confirmation.

## Phase 4: Teacher review compatibility

### Overview

Make the narrowed supported domain and authority states understandable while
preserving unsaved historical text as a reference.

### Changes Required:

#### 1. Topic selection and authority presentation

**Files**: [ExerciseRequestView.tsx](../../../src/components/exercises/ExerciseRequestView.tsx),
[RequestExercisesForm.tsx](../../../src/components/exercises/RequestExercisesForm.tsx),
[ExerciseCandidateList.tsx](../../../src/components/exercises/ExerciseCandidateList.tsx),
[SavedExerciseBrowser.tsx](../../../src/components/exercises/SavedExerciseBrowser.tsx),
[HomeworkAssignmentForm.tsx](../../../src/components/homework/HomeworkAssignmentForm.tsx),
and the exercise state galleries.

**Intent**: Align every teacher entry point with the same supported arithmetic
catalog and clarify that deterministic evidence precedes usefulness review.

**Contract**: New generation/reuse/assignment controls use the three supported
topics; explain that word problems are not supported in this authority version.
Keep historical topic types readable where necessary without permitting new work.
Present authoritative `unique_answer`, proposal mismatch, unsupported evidence,
and technical failure distinctly in Polish. Only current bound success is selectable.
Regeneration uses the existing explicit action; no automatic retries or invented
countdown. Update dev galleries to exercise the real current contracts.

#### 2. Browser storage migration

**Files**: [use-session-exercise-batch.ts](../../../src/components/hooks/use-session-exercise-batch.ts),
its tests, and [RequestExercisesForm.test.tsx](../../../src/components/exercises/RequestExercisesForm.test.tsx).

**Intent**: Preserve old reviewed text without allowing stale selection to suggest
approval eligibility.

**Contract**: Increment storage format and distinguish old reference-only batches
from current structured batches. Supported old versions retain candidate text but
clear every selected verification ID and become explicitly ineligible; unknown or
invalid formats keep the existing safe invalid-storage handling. No old model
evidence can become current success or be sent through a retry fallback. A teacher
can generate a replacement normally. New version restoration validates structured
snapshot/evidence consistency, and approval remains database-authoritative even if
storage or requests are forged.

### Success Criteria:

#### Automated Verification:

- Review/storage tests preserve old text, clear stale selections, prevent legacy verify/approve retries, and retain new structured selection semantics: `npm test -- src/components/hooks/use-session-exercise-batch.test.ts src/components/exercises/RequestExercisesForm.test.tsx src/components/exercises/SavedExerciseBrowser.test.tsx src/components/homework/HomeworkAssignmentForm.test.tsx`.

#### Manual Verification:

- Restore an old selected batch, read the ineligibility/regeneration notice, generate a supported replacement, verify, select, and approve using keyboard controls and a narrow viewport.

**Implementation Note**: Pause after automated verification for manual confirmation.

## Phase 5: Independent evidence and rollout

### Overview

Prove the complete authority boundary using independently established expected
answers and finish the release contract without expanding the test strategy.

### Changes Required:

#### 1. Independent fixtures and real-boundary composition

**Files**: new `src/lib/exercises/__fixtures__/arithmetic-authority-v1.json`;
authority, generator, verification, approval, and homework tests;
database suites from Phases 2 and 3.

**Intent**: Make false acceptance observable without copying expected values from
the implementation under test.

**Contract**: Fixtures record exact structure, Polish statement, literal answer,
independent hand derivation/uniqueness justification, and reviewer provenance.
Cover all nine buckets, zero, numeric/count bounds, grouping and operator precedence,
exact/inexact/zero division, negative intermediates, malformed/deep structures,
wrong proposal, edited statement, unsupported topic/version, old model-only success,
and mismatched proof metadata. Include the adversarial case where generator and
model verifier agree on an incorrect answer: it cannot pass authoritative admission.
Expected values are not produced by either runtime evaluator, normalizer, or model.
Run the same independently established vectors through TypeScript and database
authority checks. Compose production generator and deterministic verifier with
only provider fetch and unavoidable transport boundaries stubbed; database fixtures
exercise real promotion and consumption functions, not mocked approval success.
Review any survivor from narrowly scoped mutation checks only if one represents
a user-visible bug; no mutation-score target is introduced.

#### 2. Trusted fixtures and directly related documentation

**Files**: [seed-homework-manual-test.mjs](../../../scripts/seed-homework-manual-test.mjs),
[README.md](../../../README.md), [astro.config.mjs](../../../astro.config.mjs),
the committed environment example(s), and the cookbook in
[test-plan.md](../../foundation/test-plan.md).

**Intent**: Keep local acceptance fixtures usable without an authority bypass and
document the narrowed guarantee, deployment order, and retained historical results.

**Contract**: Replace free-form manual seed content with supported structured
arithmetic, correct difficulty metadata, and genuine ledger/approval evidence.
Preserve local-only/refusal and fixture-ownership safeguards. Existing manual
scoring scenarios retain their expected pass/fail and grouped-answer examples, with
answers derived from the new independently reviewed fixtures. Remove unused
model-verifier configuration only where no production consumer remains; generation
still requires its provider settings. Update Risk #3 cookbook/implementation notes
and documented commands; leave strategy, Risk #5, and rollout Phase 2 completion
unchanged. Record actual manual/release evidence under this change when implementing.

### Success Criteria:

#### Automated Verification:

- Independent authority vectors and composed generator/verifier/API tests reject adversarial false acceptance and pass certified cases: `npm test -- src/lib/exercises/arithmetic-authority.test.ts src/lib/services/arithmetic-exercise-verifier.test.ts src/lib/services/openrouter-exercise-generator.test.ts src/pages/api/exercises`.
- All database suites pass with certified current fixtures and explicit legacy fixtures: `npm run db:test`.
- Final regression, type, lint, and production checks pass: `npm test`, `npx astro check`, `npm run lint`, and `npm run build`.

#### Manual Verification:

- On disposable local Supabase, `npm run seed:homework-manual-test` creates only certified current fixtures, and the teacher-to-student flow plus retained legacy result checks pass.
- A release reviewer confirms legacy-row counts, no destructive migration, maintenance-window ordering, and a rollback procedure that never re-enables uncertified student prompts.

**Implementation Note**: Pause after automated verification for manual confirmation.

## Testing Strategy

### Unit Tests:

- Closed-domain parsing, bounds, exact evaluation, and uniquely determined rendering.
- Independently solved vectors, not expected values generated by production code.
- Typed unsupported evidence, legacy storage migration, and prompt-free result rendering.
- Arithmetic equality remains separate from answer-representation normalization.

### Integration Tests:

- Structured provider proposals through real generation and deterministic verification.
- Exact snapshot conflict/reuse and concurrent insertion behavior; no model proof fallback.
- Real database approval, trusted direct-write denial, immutable binding, discovery,
  assignment, student reads, and first-submit quarantine.
- Historical results and equivalent retries stay unchanged; cross-user/role and
  revoked-membership cases retain their established protection.

### Manual Testing Steps:

1. Review literal fixtures and Polish instruction/parentheses independently.
2. Generate each supported topic/difficulty; verify and approve selected candidates.
3. Tamper with text/structure/answer in API requests; confirm explicit rejection.
4. Restore old browser evidence and confirm reference-only behavior.
5. Seed pending and submitted legacy allocations in a disposable database. Confirm
   no uncertified prompt is rendered or returned by the student APIs, including
   reload, result recovery, and equivalent retry.
6. Verify current certified homework still scores one of two as pass and two of
   five as fail, with unchanged answer normalization and access restrictions.

## Performance Considerations

Bound expression size/depth using the declared catalog limits before evaluation in
both runtimes. Keep evaluation deterministic and local; no mathematical model call
is required during verification. Preserve five-item batching and current provider
timeouts/retries/admission. Database eligibility may use immutable checked evidence
and relational binding rather than repeatedly solving every row in list queries.
No new latency SLA, caching layer, or performance infrastructure is introduced.

## Migration Notes

Add new migrations; never rewrite historical migrations. Retain legacy rows with
absent authority metadata, without updating their content, answers, verdicts, or
results. Apply immutable checks to new successful evidence and pool entry while
keeping old data present but ineligible. Do not reset a shared database to validate.

Before production release, inspect counts of legacy ledger/pool rows and their
pending/submitted references without exposing student data. Counts inform the
teacher notice; they do not change the agreed quarantine policy. Do not claim that
the deployment has no old work without actual evidence.

Use the maintenance-window sequence above. Backup before migration. If verification
fails, remain in maintenance or disable affected routes; rollback must retain the
quarantine/student-read protections. Reverting only the application to its old
model-only path is not a safe rollback. Resume traffic only with a compatible,
verified complete set of guards. Unknown future authority versions remain ineligible
until explicitly supported; version strings alone cannot silently widen the domain.

## References

- [Frame and settled guarantee](./frame.md).
- [Approval research](./research.md).
- [Risk #3 and quality-gate deferrals](../../foundation/test-plan.md).
- [FR-006 and student guardrail](../../foundation/prd.md).
- [Catalog](../../../src/lib/exercises/catalog.ts:17).
- [Evidence reuse and conflicts](../../../src/pages/api/exercises/verify.ts:149).
- [Original promotion](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:134).
- [Current assignment consumer](../../../supabase/migrations/20261009083500_make_homework_assignment_retries_membership_stable.sql:328).
- [Student display/scoring](../../../supabase/migrations/20261009145925_add_homework_submissions.sql:244).
- Follow-up read-only research: `authority-domain` and `authority-persistence`
  inspected current source contracts; no application changes or live-provider/database
  certification was performed during planning.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append a closing commit SHA when a step lands. Do not rename step titles.

### Phase 1: Arithmetic authority and generation

#### Automated

- [x] 1.1 Domain tests prove exact answers, unique rendering, all nine topic/difficulty buckets, and invalid/boundary rejection: `npm test -- src/lib/exercises/arithmetic-authority.test.ts`. — 3a7d6bd
- [x] 1.2 Generator/request tests preserve admission and batch contracts and reject unsupported requests without provider work: `npm test -- src/lib/services/openrouter-exercise-generator.test.ts src/pages/api/exercises/request.test.ts src/lib/services/exercise-generation-admission.test.ts`. — 3a7d6bd

#### Manual

- [x] 1.3 A reviewer independently checks version 1 Polish wording, precedence/grouping, topic limits, and literal expected answers for the supported template families. — 3a7d6bd

### Phase 2: Verification and pool admission

#### Automated

- [x] 2.1 Verification/approval tests prove exact structure binding, stale-evidence denial, conflict/reuse behavior, typed failures, and no model-verifier call: `npm test -- src/lib/services/arithmetic-exercise-verifier.test.ts src/pages/api/exercises/verify.test.ts src/pages/api/exercises/approve.test.ts`. — a74f038
- [x] 2.2 Local migrations apply without deleting historical rows: `npx supabase migration up --local`. — a74f038
- [x] 2.3 Database tests reject forged success, unlinked trusted writes, wrong-owner promotion, and certified snapshot mutation while preserving valid idempotent approval: `npx supabase test db --local supabase/tests/database/exercise_verification_approval.sql supabase/tests/database/verified_exercise_persistence.sql`. — a74f038

#### Manual

- [x] 2.4 Inspect one certified and one retained legacy ledger/pool pair; only the certified pair passes approval and its structure, rendered prompt, answer, and ownership agree. — a74f038

### Phase 3: Discovery and homework protection

#### Automated

- [x] 3.1 Consumer database tests prove hidden discovery rows, rejected new allocations, all-or-nothing mixed legacy detail/submission denial, and unchanged historical result/retry behavior: `npx supabase test db --local supabase/tests/database/saved_exercise_discovery.sql supabase/tests/database/homework_assignments.sql supabase/tests/database/homework_submissions.sql`. — 2026-10-16: 158 assertions passed across the three suites after correcting the invalid-format fixture target; uncommitted worktree.
- [x] 3.2 Homework service/API/UI tests prove result-only reload and quarantine denial without prompt or canonical-answer leakage: `npm test -- src/lib/services/student-homework.test.ts src/lib/services/homework-assignments.test.ts src/pages/api/homework src/components/homework/StudentHomeworkForm.test.tsx`. — bedd3d7

#### Manual

- [x] 3.3 With an authorized student, legacy pending homework is unavailable, legacy submitted homework shows the original result without prompts, and current certified homework remains readable and submittable; another student and revoked membership remain denied. — bedd3d7

### Phase 4: Teacher review compatibility

#### Automated

- [x] 4.1 Review/storage tests preserve old text, clear stale selections, prevent legacy verify/approve retries, and retain new structured selection semantics: `npm test -- src/components/hooks/use-session-exercise-batch.test.ts src/components/exercises/RequestExercisesForm.test.tsx src/components/exercises/SavedExerciseBrowser.test.tsx src/components/homework/HomeworkAssignmentForm.test.tsx`.

#### Manual

- [x] 4.2 Restore an old selected batch, read the ineligibility/regeneration notice, generate a supported replacement, verify, select, and approve using keyboard controls and a narrow viewport.

### Phase 5: Independent evidence and rollout

#### Automated

- [ ] 5.1 Independent authority vectors and composed generator/verifier/API tests reject adversarial false acceptance and pass certified cases: `npm test -- src/lib/exercises/arithmetic-authority.test.ts src/lib/services/arithmetic-exercise-verifier.test.ts src/lib/services/openrouter-exercise-generator.test.ts src/pages/api/exercises`.
- [ ] 5.2 All database suites pass with certified current fixtures and explicit legacy fixtures: `npm run db:test`.
- [ ] 5.3 Final regression, type, lint, and production checks pass: `npm test`, `npx astro check`, `npm run lint`, and `npm run build`.

#### Manual

- [ ] 5.4 On disposable local Supabase, `npm run seed:homework-manual-test` creates only certified current fixtures, and the teacher-to-student flow plus retained legacy result checks pass.
- [ ] 5.5 A release reviewer confirms legacy-row counts, no destructive migration, maintenance-window ordering, and a rollback procedure that never re-enables uncertified student prompts.
