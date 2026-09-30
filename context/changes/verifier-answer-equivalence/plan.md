# Verifier Answer Equivalence Implementation Plan

## Overview

Replace conservative normalized-string equality with a versioned, deterministic natural-number equivalence contract for Grade 4 exercise verification. The new contract accepts valid Polish digit grouping and a single natural number embedded in prose, persists an ungrouped digit answer for future scoring, and deliberately resets all existing exercise and verification data before v2 becomes authoritative.

## Current State Analysis

The verifier normalizes Unicode, whitespace, Polish case, and one terminal period, then deduplicates and compares normalized strings exactly. This preserves the space in `1 234`, so it differs from `1234`, and it cannot relate `Ania zebrała 15 jabłek` to `15`. Generator and verifier prompts both require answer content but do not prescribe a shared representation.

Verification evidence is immutable and keyed once per teacher and candidate. The API reuses a settled row for an unchanged candidate snapshot, and approval copies its verified answer and strategy identity into the approved exercise. A behavior change therefore needs a new strategy identity and an explicit data cutover rather than reinterpretation of v1 evidence.

## Desired End State

Newly generated and independently verified Grade 4 exercises use one v2 answer contract. `1234` and valid Polish-grouped forms such as `1 234` compare as equal; prose containing exactly one standalone natural number compares as that number, so `Ania zebrała 15 jabłek` equals `15`. Successful numeric verification stores `1234` or `15`, not grouping or prose, as the canonical answer.

Malformed grouping, zero-number or multiple-number prose, decimals, fractions, number words, operators, and nonnumeric text do not gain broad mathematical equivalence. All approved exercise and verification ledger rows existing at cutover are deleted, and subsequent evidence identifies the v2 strategy.

### Key Discoveries:

- `src/lib/exercises/answer-normalization.ts:1` is the shared comparison boundary used for verifier answer-set deduplication and final candidate comparison.
- `src/lib/services/openrouter-exercise-generator.ts:43` and `src/lib/services/openrouter-exercise-verifier.ts:51` request answers independently without a common output-shape rule.
- `src/lib/exercises/catalog.ts:14` limits the current product surface to natural-number arithmetic and word problems, so decimal and fractional equivalence are not required here.
- `src/lib/services/openrouter-exercise-verifier.ts:10` already versions the strategy identity independently from the configured model.
- `src/pages/api/exercises/verify.ts:142` and `supabase/migrations/20260929120000_add_exercise_verification_approval.sql:1` make settled evidence replayable and immutable, so old rows cannot silently acquire v2 semantics.
- `supabase/migrations/20260929120000_add_exercise_verification_approval.sql:41` links approved exercises to verification rows without cascading deletion; the reset must delete exercises before verification evidence.

## What We're NOT Doing

- Adding decimal-comma/dot, fraction/decimal, percentage, expression-evaluation, or Polish number-word equivalence.
- Treating malformed grouping such as `12 34` as the natural number `1234`.
- Extracting an answer from prose containing zero or multiple natural-number tokens.
- Using another model call to judge semantic equivalence.
- Preserving, migrating, reclassifying, or offering re-verification for any existing exercise or v1 verification row.
- Changing provider failure, `indeterminate`, initial `unverified`, teacher approval, or exercise-selection behavior.
- Expanding the Grade 4 topic catalog or implementing student answer scoring.

## Implementation Approach

Keep the existing literal normalization as the fallback and add one deterministic equivalence representation for verification. After Unicode and whitespace normalization, recognize either an ungrouped natural number, a correctly grouped Polish natural number with three-digit groups, or exactly one standalone valid natural-number token inside prose. Canonicalize that numeric value to ungrouped base-10 digits; preserve `0` and remove redundant leading zeroes. Everything else receives a namespaced literal comparison key so numeric and literal representations cannot collide accidentally.

The verifier will deduplicate provider answers by equivalence key, compare the sole derived key with the proposal key, and persist the derived canonical digits for a numeric match. Both provider prompts will request bare, ungrouped base-10 natural numbers; the verifier still derives answers independently and never receives the generator proposal. The strategy identity advances to `grade-4-independent-answer-set-v2`.

After v2 behavior is tested, add a forward migration that deletes every row from `exercises` and then every row from `exercise_verifications`. The reset preserves profiles and schema but intentionally retains no exercise content or verification audit history.

## Critical Implementation Details

The data reset and application rollout form one cutover. Delete dependent `exercises` rows before `exercise_verifications`, and do not expose verification traffic between applying the reset and deploying v2 code; otherwise old code can recreate v1 evidence after the reset, or a reset applied after deployment can delete fresh v2 evidence.

## Phase 1: Define and Prove V2 Equivalence

### Overview

Introduce the deterministic equivalence contract, align both provider prompts, and version the verification strategy without changing API or UI outcome shapes.

### Changes Required:

#### 1. Natural-number equivalence representation

**File**: `src/lib/exercises/answer-normalization.ts`

**Intent**: Give verifier deduplication, candidate comparison, and canonical answer persistence one deterministic representation while retaining conservative literal handling outside the current natural-number domain.

**Contract**: Keep the existing literal normalization behavior and expose a verification canonicalization result containing a namespaced comparison key and canonical answer. Numeric recognition accepts ungrouped digits, valid right-to-left three-digit groups separated by normalized Unicode whitespace, or exactly one standalone valid natural-number token in prose. Numeric canonical answers are ungrouped base-10 digits; invalid grouping, signed values, decimal/fraction/operator forms, and zero/multiple-number prose stay on the literal path.

#### 2. Equivalence boundary tests

**File**: `src/lib/exercises/answer-normalization.test.ts`

**Intent**: Lock the accepted and rejected equivalence classes before integrating them into provider classification.

**Contract**: Add table-driven cases for `1234`/`1 234`, multi-group and Unicode-space variants, malformed `12 34`, exactly-one-number prose, zero/multiple-number prose, leading zero canonicalization, and preserved distinctions for decimals, fractions, number words, operators, differing nonnumeric text, and punctuation outside existing normalization.

#### 3. Generator answer-shape guidance

**File**: `src/lib/services/openrouter-exercise-generator.ts`, `src/lib/services/openrouter-exercise-generator.test.ts`

**Intent**: Reduce preventable model variance at the source while leaving deterministic equivalence as the enforcement boundary.

**Contract**: Tell the generator that the canonical answer for the current catalog must be one bare, ungrouped base-10 natural number with no sentence, label, unit, calculation, or explanatory text. Preserve strict JSON structure and existing candidate validation; assert the new instruction in the request-body test.

#### 4. V2 verifier classification and prompt

**File**: `src/lib/services/openrouter-exercise-verifier.ts`, `src/lib/services/openrouter-exercise-verifier.test.ts`

**Intent**: Apply the same equivalence rule to answer-set uniqueness and proposal matching, and ensure successful evidence carries the stable machine answer needed by later scoring.

**Contract**: Deduplicate valid answers by the new comparison key, classify zero or multiple keys as `not_unique_answer`, compare the sole key with the proposal key, and use the verifier-derived canonical answer for `unique_answer` and `answer_mismatch`. Request bare ungrouped natural-number entries while keeping rationale separate and the proposed answer undisclosed. Set `EXERCISE_VERIFICATION_STRATEGY_VERSION` to `grade-4-independent-answer-set-v2`; tests cover grouped variants, prose/scalar matching in both directions, canonical digit persistence, ambiguous multi-number prose, non-equivalent notation, and the v2 identity.

### Success Criteria:

#### Automated Verification:

- `npm run test -- src/lib/exercises/answer-normalization.test.ts src/lib/services/openrouter-exercise-generator.test.ts src/lib/services/openrouter-exercise-verifier.test.ts` proves the accepted natural-number equivalence classes, rejected broader notation, prompt contracts, canonical digit output, and v2 strategy identity.
- `npm run lint` and `npx astro check` pass with the new canonicalization contract and unchanged API result types.

#### Manual Verification:

- With the configured live models, inspect one arithmetic candidate and one word-problem candidate and confirm both providers return bare numeric answers under normal operation while the proposed answer remains absent from the verifier request.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 2: Reset Data and Validate the V2 Rollout

### Overview

Remove all existing exercise-domain data, prove the clean cutover, and verify new v2 evidence from generation through approval.

### Changes Required:

#### 1. Destructive exercise-data reset

**File**: `supabase/migrations/<timestamp>_reset_exercise_data_for_answer_equivalence_v2.sql`

**Intent**: Ensure no approved exercise or cached verification result remains under the superseded contract, as explicitly chosen for this rollout.

**Contract**: Delete every row from `public.exercises` first and every row from `public.exercise_verifications` second. Do not alter tables, constraints, policies, profiles, users, or unrelated data. The migration is forward-only and intentionally provides no data restoration path.

#### 2. Database and full-flow regression coverage

**File**: `supabase/tests/database/exercise_verification_approval.sql`, `scripts/smoke.mjs`

**Intent**: Confirm the reset does not weaken the existing evidence, approval, authorization, or production-route contracts.

**Contract**: Keep database fixtures strategy-agnostic or update their identity to v2 where identity is material, retain all ledger immutability and atomic approval assertions, and preserve provider-free smoke coverage. Add only reset-specific assertions that are stable on a clean migrated database; do not make smoke tests call OpenRouter.

#### 3. Rollout verification record

**File**: `context/changes/verifier-answer-equivalence/manual-verification.md`

**Intent**: Retain reproducible evidence that the destructive cutover and the two reported equivalence cases work under the actual runtime and provider.

**Contract**: Record date, environment, deployed verifier model, database row counts before and after reset, representative generated answers, v2 ledger identity, canonical stored digits, approval result, and outcomes for `1234`/`1 234`, `Ania zebrała 15 jabłek`/`15`, malformed grouping, and multi-number prose. Do not record secrets or raw provider payloads.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies the destructive migration in foreign-key-safe order and leaves `exercises` and `exercise_verifications` empty before test fixtures or new application activity.
- `npm run db:test`, `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass after the v2 behavior and reset migration are integrated.
- `npm run smoke` passes against a provider-free production preview with existing verification and approval route protections intact.

#### Manual Verification:

- During a coordinated cutover with verification traffic stopped, confirm all prior exercise and verification rows are gone before v2 traffic resumes and that no v1 strategy identity appears afterward.
- Generate and verify representative arithmetic and word-problem candidates; confirm grouped and one-number-prose equivalents pass, malformed or multi-number cases do not gain equivalence, approved canonical answers are ungrouped digits, and stored evidence identifies v2.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual checks before considering the change ready for implementation review.

## Testing Strategy

### Unit Tests:

- Test equivalence as a matrix of accepted and rejected pairs, including symmetry, deduplication, canonical output, and idempotent canonicalization.
- Assert valid three-digit grouping across ordinary and Unicode spacing while rejecting malformed groups.
- Prove exactly-one-number prose extracts one value and multi-number prose remains literal.
- Keep explicit regression cases for decimal separators, fractions, number words, units with multiple values, operators, and punctuation.
- Inspect generator and verifier request bodies for the shared bare-number instruction, strict JSON settings, and verifier independence from the proposal.

### Integration Tests:

- Exercise verifier classification with grouped/prose variants and confirm successful evidence persists ungrouped digits with the v2 identity.
- Re-run database trust, immutability, ownership, and atomic approval tests after the reset migration.
- Run the provider-free production smoke suite without adding external calls or depending on exercise rows that the migration deletes.

### Manual Testing Steps:

1. Stop verification traffic, record current exercise and verification counts, apply the migration, and confirm both tables are empty while profiles remain.
2. Deploy v2 and generate one arithmetic batch plus one word-problem batch with the configured live models.
3. Verify a grouped-number pair and a one-number prose/scalar pair; confirm both pass and store ungrouped digits under the v2 strategy identity.
4. Verify malformed grouping and a response containing multiple numbers; confirm neither is silently reduced to the intended scalar.
5. Approve a successful candidate and confirm the exercise copies the v2 evidence and canonical digit answer exactly.

## Performance Considerations

Equivalence remains local string analysis on at most ten verifier answers per candidate and five candidates per batch. It adds no provider calls, database round trips, background work, or meaningful latency; implementation should avoid unbounded parsing or expression evaluation.

## Migration Notes

The reset is deliberately destructive: every approved exercise and every verification record is removed, including records unrelated to a particular strategy identity. Delete dependent exercises first because `exercises.verification_id` references the ledger without cascading deletion. Coordinate migration and v2 deployment as one maintenance cutover; rollback of code does not restore deleted data, and no backup/restore path is part of this change.

## References

- Problem framing and settled diagnosis: `context/changes/verifier-answer-equivalence/frame.md`
- Product guardrail and verification requirement: `context/foundation/prd.md` (Guardrails and FR-006)
- Current answer normalization: `src/lib/exercises/answer-normalization.ts:1`
- Current catalog scope: `src/lib/exercises/catalog.ts:14`
- Generator provider pattern: `src/lib/services/openrouter-exercise-generator.ts:43`
- Verifier strategy and classification: `src/lib/services/openrouter-exercise-verifier.ts:10`, `src/lib/services/openrouter-exercise-verifier.ts:84`
- Settled-result replay boundary: `src/pages/api/exercises/verify.ts:142`
- Immutable ledger and approval provenance: `supabase/migrations/20260929120000_add_exercise_verification_approval.sql:1`
- Prior conservative tradeoff: `context/archive/2026-09-29-approve-first-exercise-pool/plan-brief.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Define and Prove V2 Equivalence

#### Automated

- [x] 1.1 `npm run test -- src/lib/exercises/answer-normalization.test.ts src/lib/services/openrouter-exercise-generator.test.ts src/lib/services/openrouter-exercise-verifier.test.ts` proves the accepted natural-number equivalence classes, rejected broader notation, prompt contracts, canonical digit output, and v2 strategy identity.
- [x] 1.2 `npm run lint` and `npx astro check` pass with the new canonicalization contract and unchanged API result types.

#### Manual

- [x] 1.3 With the configured live models, inspect one arithmetic candidate and one word-problem candidate and confirm both providers return bare numeric answers under normal operation while the proposed answer remains absent from the verifier request.

### Phase 2: Reset Data and Validate the V2 Rollout

#### Automated

- [ ] 2.1 `npx supabase db reset` applies the destructive migration in foreign-key-safe order and leaves `exercises` and `exercise_verifications` empty before test fixtures or new application activity.
- [ ] 2.2 `npm run db:test`, `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` pass after the v2 behavior and reset migration are integrated.
- [ ] 2.3 `npm run smoke` passes against a provider-free production preview with existing verification and approval route protections intact.

#### Manual

- [ ] 2.4 During a coordinated cutover with verification traffic stopped, confirm all prior exercise and verification rows are gone before v2 traffic resumes and that no v1 strategy identity appears afterward.
- [ ] 2.5 Generate and verify representative arithmetic and word-problem candidates; confirm grouped and one-number-prose equivalents pass, malformed or multi-number cases do not gain equivalence, approved canonical answers are ungrouped digits, and stored evidence identifies v2.
