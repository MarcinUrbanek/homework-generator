---
date: 2026-10-14T20:19:11.0050265+02:00
researcher: AI assistant using Copilot SDK in VS Code
git_commit: e4f19c17914a57562fdc26e9b5efbba856acad15
branch: master
repository: homework-generator
topic: "Authoritative, independent evidence at the exercise approval boundary"
tags: [research, codebase, exercise-verification, approval, answer-oracle]
status: complete
last_updated: 2026-10-16
last_updated_by: AI assistant using Copilot SDK in VS Code
last_updated_note: "Phase 3 database failure diagnosis, fixture correction, and passing consumer gate."
---

# Research: Trustworthy exercise approval

> The original sections below record the 2026-10-14 investigation, not the
> current implementation. The dated follow-up at the end supersedes its
> model-only admission findings and unresolved policy questions for Phase 3.

## Research Question

What currently permits an exercise to reach the approved pool, what proves the evidence is independent and bound to the approved content, and what is missing to prove correctness and uniqueness against an authoritative answer source?

Scope is [change.md:12](./change.md:12) and [test-plan.md:59](../../foundation/test-plan.md:59): Risk #3, not Risk #5 or completion of rollout Phase 2. No implementation, tests, product-policy changes, or test-plan edits are included.

## Summary

- **The inspected verification-to-approval path does not require an independently authoritative answer oracle.** It requires a server-persisted `unique_answer` outcome derived from a model-reported answer set and agreement with the candidate's proposed answer. The model can omit valid answers or agree with an incorrect proposal without violating those structural checks. This is a code-path inference, not an observed live-provider incident. Sources: [verifier:55](../../../src/lib/services/openrouter-exercise-verifier.ts:55), [classification:121](../../../src/lib/services/openrouter-exercise-verifier.ts:121), [approval predicate:110](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:110).
- **Procedural independence and provenance protections are real, but narrower than correctness.** The verifier prompt excludes the proposed answer; the API persists the candidate snapshot; approval reloads the owned verification record rather than trusting browser answer/evidence fields. Sources: [verifier:55](../../../src/lib/services/openrouter-exercise-verifier.ts:55), [snapshot:103](../../../src/pages/api/exercises/verify.ts:103), [approval:93](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:93).
- **Existing tests establish structural contracts, not a mathematical oracle.** Provider fixtures determine the answer set in verifier tests, handler tests inject verification results, and database tests prove promotion/permission rules for seeded evidence. Those layers cannot establish that an arbitrary model-reported answer set is complete and correct. Sources: [verifier tests:35](../../../src/lib/services/openrouter-exercise-verifier.test.ts:35), [handler setup:73](../../../src/pages/api/exercises/verify.test.ts:73), [database promotion assertions:625](../../../supabase/tests/database/exercise_verification_approval.sql:625).
- A test oracle and a runtime approval oracle are different contracts. Independently solved fixtures can measure false acceptance on their named cases; requiring authoritative evidence in production additionally needs a chosen trusted source, a supported problem domain, and enforcement before pool promotion. Choosing that source is an unresolved design/product decision, not a fact supplied by the current code.

## Detailed Findings

### Requirements and supported domain

[PRD FR-006:74](../../foundation/prd.md:74) requires platform verification followed by teacher approval; the [student-use guardrail:40](../../foundation/prd.md:40) requires exactly one valid answer. Teacher approval remains a content-review gate, not a substitute for the platform's verification requirement.

The inspected Grade 4 catalog contains addition/subtraction, multiplication/division, order of operations, and word problems, with natural-number guidance: [catalog:17](../../../src/lib/exercises/catalog.ts:17). Provider contracts constrain answer representation to natural-number digits: [generator schema:36](../../../src/lib/services/openrouter-exercise-generator.ts:36), [verifier schema:15](../../../src/lib/services/openrouter-exercise-verifier.ts:15). A natural-number output constraint does not prove the Polish statement is unambiguous, complete, or solvable.

### Verifier: independent prompt, model-supplied answer set

The candidate DTO includes text, grade, topic, difficulty, and `proposedCanonicalAnswer`: [types:61](../../../src/types.ts:61). The verifier sends the problem and metadata, instructs independent solving, and omits the proposed answer: [prompt:55](../../../src/lib/services/openrouter-exercise-verifier.ts:55). This prevents explicit answer leakage through this inspected prompt; it does not establish independence of model training, reasoning, or mistakes.

The provider response supplies `validAnswers` and a rationale. Structured-output constraints and local parsing validate their shape: [schemas:15](../../../src/lib/services/openrouter-exercise-verifier.ts:15), [request:68](../../../src/lib/services/openrouter-exercise-verifier.ts:68). Neither a strict schema nor a nonempty rationale validates the mathematics.

In the inspected classification function:

- A canonicalized answer-set cardinality other than one becomes `not_unique_answer`.
- A singleton equal to the canonicalized proposal becomes `unique_answer`.
- A singleton differing from the proposal becomes `answer_mismatch`.

Source for these branches: [classification:121](../../../src/lib/services/openrouter-exercise-verifier.ts:121). Here, singleton cardinality measures the returned set, not the full mathematical solution set.

The shared [canonicalizer:1](../../../src/lib/exercises/answer-normalization.ts:1) handles supported natural-number representations and falls back to literal comparison. Equivalence/deduplication is a representation rule, not an answer oracle or a proof that the statement asks for the extracted scalar. In particular, the historical acceptance of single-number prose intentionally ignores surrounding words/units; see [v2 caveat:68](../../archive/2026-09-30-verifier-answer-equivalence/plan-brief.md:68).

### Snapshot binding and browser authority

The verification API writes candidate identity, text, proposed answer, metadata, outcome, verified answer, verifier identity/version, time, and rationale into evidence: [snapshot:103](../../../src/pages/api/exercises/verify.ts:103). Its existing-record handling rejects reuse of a candidate ID with changed snapshot content: [comparison:149](../../../src/pages/api/exercises/verify.ts:149), [conflict branch:239](../../../src/pages/api/exercises/verify.ts:239). This binds verification reuse to the inspected content rather than silently re-verifying an edited candidate under the same identity.

The browser's review hook validates candidate/status/evidence consistency and successful selection: [restore schema:41](../../../src/components/hooks/use-session-exercise-batch.ts:41), [selection:219](../../../src/components/hooks/use-session-exercise-batch.ts:219). Approval sends selected verification IDs, not answers or a browser-authored proof: [form:121](../../../src/components/exercises/RequestExercisesForm.tsx:121).

These browser checks protect UX consistency, not the authoritative boundary. The [approval handler:70](../../../src/pages/api/exercises/approve.ts:70) validates the request and authorizes a teacher before invoking the database operation.

The rendered `unique_answer` state says the answer is confirmed and enables selection, while `not_unique_answer` says the exercise lacks an unambiguous answer: [presentation:16](../../../src/components/exercises/ExerciseCandidateList.tsx:16), [eligibility:25](../../../src/components/exercises/ExerciseCandidateList.tsx:25). If a future implementation distinguishes model assessment from authoritative proof, these labels, selection guards, response schemas, and stored review-state compatibility are affected contracts.

### Database: trusted writer and outcome-based promotion

The ledger migration validates required evidence fields and outcome/answer consistency, restricts authenticated users to reading their verification evidence, and binds exercises to verification IDs: [ledger constraints:3](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:3), [permissions:31](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:31), [provenance:44](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:44).

For the inspected approval RPC, a valid selection must belong to the current authenticated teacher, exist in the ledger, and have `outcome = 'unique_answer'`: [input/ownership checks:69](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:69), [outcome check:110](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:110). The RPC copies the stored candidate, answer, metadata, and verifier evidence into the pool: [promotion:138](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:138).

In that inspected RPC, there is no recomputation of the answer, validation of a mathematical derivation, or authoritative-source predicate in addition to the stored outcome. A server-owned claim is trusted provenance, not independently correct content.

The authenticated privilege boundary denies direct evidence insertion, mutation, deletion, and direct pool insertion; pgTAP asserts those operations are rejected: [ledger denials:451](../../../supabase/tests/database/exercise_verification_approval.sql:451), [promotion denial:521](../../../supabase/tests/database/exercise_verification_approval.sql:521). Approved-row updates are denied in the tested authenticated path: [update assertion:728](../../../supabase/tests/database/exercise_verification_approval.sql:728). Creator deletion remains permitted by the base table policy, so these are mutation protections, not permanent/append-only retention: [policies:78](../../../supabase/migrations/20260923120000_create_verified_exercise_persistence.sql:78).

Binding in these inspected migrations is relational: a verification foreign key, uniqueness constraint, and copied snapshot. It is not a content digest or cryptographic proof: [link:44](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:44), [copy:138](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:138). A digest could identify bytes but would not prove their answer correct.

The schema also permits legacy exercises without a verification link, and trusted service-role inserts are demonstrated by database tests: [legacy assertion:742](../../../supabase/tests/database/exercise_verification_approval.sql:742), [service writes:145](../../../supabase/tests/database/verified_exercise_persistence.sql:145). The later reset deletes exercise/evidence data but adds no ongoing oracle constraint: [reset:1](../../../supabase/migrations/20260930120000_reset_exercise_data_for_answer_equivalence_v2.sql:1). No claim is made here about legacy rows currently present in a deployed database.

### Existing evidence and cheapest useful test boundaries

- **Verifier contract tests:** assert prompt isolation, provider-request shape, classification, and canonicalization from supplied answers. They do not independently solve the exercise text: [tests:35](../../../src/lib/services/openrouter-exercise-verifier.test.ts:35).
- **Verification handler tests:** assert validation, authorization, snapshot reuse/conflict behavior, and orchestration using an injected verification implementation. They do not compose the production verifier with a real database: [setup:73](../../../src/pages/api/exercises/verify.test.ts:73), [cases:108](../../../src/pages/api/exercises/verify.test.ts:108).
- **Approval handler tests:** assert request/role guards, RPC use, and returned mapping validation, not correctness of seeded answers: [tests:67](../../../src/pages/api/exercises/approve.test.ts:67).
- **pgTAP:** establishes persisted permissions, owner/outcome rejection, evidence copying, and idempotent promotion for seeded rows: [denial cases:563](../../../supabase/tests/database/exercise_verification_approval.sql:563), [copy assertions:625](../../../supabase/tests/database/exercise_verification_approval.sql:625), [replay assertions:679](../../../supabase/tests/database/exercise_verification_approval.sql:679).

For planning, preserve those layers and add independently authored, reviewed fixtures whose expected answers and uniqueness are established outside the implementation under test. Fixture provenance should identify the problem, authoritative solution/derivation, supported answer domain, and ambiguity assessment. Do not obtain expected answers from the production classifier, canonicalizer, generator, or another agreeing model.

Meaningful adversarial fixture categories are: a correct unique solution; an incorrect proposal with a correct independent solution; generator/verifier agreement on an incorrect solution; an ambiguous statement for which the verifier reports a singleton; supported equivalent representations; and unsupported or insufficiently evidenced content. These are proposed test categories, not existing coverage or a promised exhaustive correctness corpus.

Use the production verifier with stubbed external fetch to prove local interpretation, then compose the production verification handler/service to prove what gets persisted. At the database boundary, seed supported and unsupported evidence under the eventual authoritative-source contract and exercise the real approval RPC. A mock returning approval success cannot prove that database gate.

Under the present implementation, a dishonest but schema-valid singleton that matches an incorrect proposal follows the successful classification branch; owned persisted success then satisfies the approval predicate. This predicted false-acceptance path follows [classification:121](../../../src/lib/services/openrouter-exercise-verifier.ts:121) and [approval:110](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:110). It has not been executed in this research. A test asserting such evidence is rejected would expose the missing production guarantee rather than merely add passing regression coverage.

## Architecture Insights and Planning Handoff

The current flow is:

`browser candidate -> independent model prompt -> canonicalized model set/proposal comparison -> server-owned snapshot -> authenticated approval RPC -> copied approved row`

Sources: [prompt:55](../../../src/lib/services/openrouter-exercise-verifier.ts:55), [persist:103](../../../src/pages/api/exercises/verify.ts:103), [promote:138](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:138).

Preserve teacher review, proposed-answer isolation, exact snapshot binding, failure-outcome ineligibility, owner checks, and server-authoritative promotion. A new authority rule needs to be enforced where settled success is formed and where pool entry is allowed, including trusted direct-write paths if the guarantee is intended to cover them. Browser labels or a stronger prompt cannot supply that rule.

Possible source choices to evaluate, not approved architecture:

- A reviewed authoritative problem/answer corpus with exact binding to approved content.
- Deterministic templates/structured problems with a checked solver and an unambiguous rendering contract for a declared subset.
- An explicit trusted human-authored verification record with solution/uniqueness evidence, if the product accepts this as platform verification.

A free-form model-generated word problem cannot acquire a uniqueness proof merely because an arithmetic solver returns a number; binding between the original statement and the solved representation must also be justified. Unsupported content should remain ineligible if the selected source cannot establish the required guarantee. Expanding model consensus or weakening FR-006 is not a substitute.

Affected surfaces for a future plan: candidate/verifier DTOs and schemas; verifier classification/version; persisted evidence and approval predicate; trusted data writers and legacy records; review-state restoration/selection; teacher-visible evidence/status wording; verifier/handler/pgTAP fixtures. Provider resilience remains separate.

## Historical Context

- **Supported, with a bounded meaning:** the approval slice introduced a server-owned ledger and ID-based promotion; that boundary remains visible in current code. [Historical trust boundary:32](../../archive/2026-09-29-approve-first-exercise-pool/plan-brief.md:32), [current promotion:138](../../../supabase/migrations/20260929120000_add_exercise_verification_approval.sql:138).
- **Supported limitation:** the same slice explicitly called the verifier probabilistic and retained teacher review. That caveat is consistent with the current model-derived answer set; it does not satisfy the stronger authoritative-source claim. [Historical caveat:68](../../archive/2026-09-29-approve-first-exercise-pool/plan-brief.md:68), [current classification:121](../../../src/lib/services/openrouter-exercise-verifier.ts:121).
- **Supported as equivalence, not mathematical authority:** the v2 slice's deterministic canonicalization resolves supported formatting variants. Its phrase "canonicalization remains authoritative" concerns representation comparison, not correctness or solution-set completeness. [Historical caveat:69](../../archive/2026-09-30-verifier-answer-equivalence/plan-brief.md:69), [current helper:1](../../../src/lib/exercises/answer-normalization.ts:1).
- **Historical starting point superseded:** the v2 brief describes the pre-change normalizer preserving grouped digits/prose. The current helper implements the later equivalence behavior; the starting-point paragraph should not be read as current behavior. [Historical starting point:13](../../archive/2026-09-30-verifier-answer-equivalence/plan-brief.md:13), [current helper:1](../../../src/lib/exercises/answer-normalization.ts:1).

## Related Research

[Generation-admission research](../../archive/2026-10-14-exercise-trust-provider-resilience/research.md) establishes the separate Risk #2 scope, not approval authority. The current [cookbook limitation:148](../../foundation/test-plan.md:148) leaves approval evidence and per-item resilience pending; this research does not change Phase 2 status.

The supplied [authorization plan brief](../testing-authorization-and-invitation-boundaries/plan-brief.md) supplies boundary-testing precedent, not an answer oracle.

## Open Questions and Limitations

- Which source is authoritative for correctness and uniqueness, and what problem subset can it actually certify?
- Is this change intended to introduce runtime authoritative evidence, or to establish an independently solved test corpus while explicitly retaining a probabilistic runtime? The latter cannot honestly claim production approval _requires_ an authoritative source.
- How should insufficiently evidenced content be represented without weakening the existing ineligibility rule or misclassifying content uncertainty as provider failure?
- If evidence semantics change, what is the policy for existing settled evidence, approved rows, trusted direct writes, and previously assigned snapshots? No deletion/re-verification policy is chosen here.
- This is complete source-backed research of the agreed approval-trust question, not a correctness certification. No live model calls, database inspection, test run, or runtime reproduction was performed. Deployed model configuration and current persisted data are unverified.

## Evidence Scope

Inspected source at the recorded local commit: verifier/generator adapters, answer helper, exercise schemas/types, verification/approval handlers and tests, review form/hook/list, exercise persistence/approval/reset/discovery migrations and database suites. Documentation inspected: active change, PRD, test plan, prior approval/equivalence briefs and equivalence frame, supplied authorization brief, and related admission research introduction. No lessons file was found at `context/foundation/lessons.md`.

Two read-only research workers covered independent verifier and approval/database dimensions; the main context covered requirements, historical decisions, and browser contracts. Findings are local file anchors, not invented remote commit permalinks. Application source was clean at the metadata snapshot; the active change folder was untracked.

## Follow-up: Phase 3 database assertions (2026-10-16)

### Question and evidence scope

Review/fix the five failing `homework_submissions.sql` assertions and rerun the
database gate for Phase 3. This follow-up includes the explicitly requested test
fix; it does not reopen the authority policy or implement later phases.

Evidence snapshot: 2026-10-16T15:03:32.0225004+02:00; researcher: AI assistant using
Copilot SDK in VS Code; repository: `MarcinUrbanek/homework-generator`; branch:
`master`; HEAD: `a74f038b5d437a5fce8d17eb42268952382a5d09`, with uncommitted Phase 3
changes. Source references below describe that worktree, not a remote commit.
The original research metadata remains the historical snapshot.

### Diagnosis and correction

- The focused local run reproduced failures 33 through 37 out of 81 assertions.
  For the five rejected CSV cases (prose, trailing punctuation, signed number,
  decimal, incorrect grouping), the RPC returned `P0002: Homework is unavailable`
  instead of the expected `22023: Invalid homework answers`.
  Sources: [CSV cases](../../../supabase/tests/database/homework-answer-format-cases.csv:4),
  [parameterized assertions](../../../supabase/tests/database/homework_submissions.sql:528).
- Before correction, those assertions submitted to assignment suffix `010`,
  whose allocated exercise suffix `036` is explicitly legacy free-form content.
  In the inspected first-submission path, the certification check precedes answer
  parsing, so quarantine correctly masked the malformed-answer branch.
  Sources: [legacy fixture](../../../supabase/tests/database/homework_submissions.sql:148),
  [allocation](../../../supabase/tests/database/homework_submissions.sql:252),
  [guard and parsing order](../../../supabase/migrations/20261016140000_protect_uncertified_homework_consumers.sql:827).
- Changed the parameterized assertion target to assignment suffix `001`: it has a
  certified exercise, belongs to the same current student, and has no submission
  at this point in the test. The expected SQLSTATE/message and rejected CSV inputs
  remain unchanged. This restores format-validation coverage without changing the
  production RPC or weakening the quarantine contract.
  Sources: [certified fixture](../../../supabase/tests/database/homework_submissions.sql:123),
  [allocation](../../../supabase/tests/database/homework_submissions.sql:228),
  [corrected target](../../../supabase/tests/database/homework_submissions.sql:531).
- Existing assertions still check mixed-legacy detail/first-submit denial and no
  persisted rows, plus prompt-free legacy result reads and retry behavior.
  Sources: [mixed denial](../../../supabase/tests/database/homework_submissions.sql:359),
  [no writes](../../../supabase/tests/database/homework_submissions.sql:541),
  [retained result](../../../supabase/tests/database/homework_submissions.sql:869).

### Verification and handoff

Executed against the running local database:

```powershell
npx.cmd --no-install supabase test db --local supabase\tests\database\saved_exercise_discovery.sql supabase\tests\database\homework_assignments.sql supabase\tests\database\homework_submissions.sql
```

Observed result: `Files=3, Tests=158`, `Result: PASS`, exit code 0. This is the
consumer gate specified by [Phase 3 step 3.1](./plan.md#phase-3-discovery-and-homework-protection).
The SQL test wraps fixtures in a transaction and rolls them back
([transaction end](../../../supabase/tests/database/homework_submissions.sql:1040)).
No database reset, migration edit, or production behavior change was needed.

For this follow-up, the existing Phase 3 requirements settle quarantine precedence
and retained-result behavior ([contract](./plan.md#historical-results)); the
original research's open policy questions are historical, not current blockers.
No unresolved cause remains for the five reproduced failures. This run does not
establish the separate service/API/UI gate, manual acceptance, later phases, or
deployed-data state. Those were outside this focused correction.
