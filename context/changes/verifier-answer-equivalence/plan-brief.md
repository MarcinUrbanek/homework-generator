# Verifier Answer Equivalence — Plan Brief

> Full plan: `context/changes/verifier-answer-equivalence/plan.md`
> Frame brief: `context/changes/verifier-answer-equivalence/frame.md`

## What & Why

The actual problem to plan around is: generation and verification do not share an explicit, domain-safe canonical-answer equivalence contract, so harmless AI representation variance is classified as disagreement or non-uniqueness.

This change introduces a deterministic v2 contract for the current Grade 4 natural-number domain and resets existing exercise data so only v2 evidence remains authoritative.

## Starting Point

The verifier currently compares conservatively normalized strings: it handles case, Unicode, repeated whitespace, and a terminal period, but preserves digit-grouping spaces and prose. Generator and verifier prompts do not constrain answer shape, while settled results are immutable and replayed by candidate ID.

## Desired End State

`1234` equals valid Polish-grouped `1 234`, and prose containing exactly one standalone natural number, such as `Ania zebrała 15 jabłek`, equals `15`. Successful numeric verification stores ungrouped base-10 digits for future scoring, all new evidence identifies the v2 strategy, and no exercise or verification rows that existed at cutover remain.

## Key Decisions Made

| Decision          | Choice                                                                           | Why                                                                                                                              | Source          |
| ----------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Problem boundary  | One shared equivalence contract across generation, deduplication, and comparison | Both observed failure classes come from representation and answer-shape variance, not provider failures or untouched candidates. | Frame           |
| Digit grouping    | Valid Polish three-digit groups only                                             | Fixes `1234`/`1 234` without accepting malformed `12 34`.                                                                        | Plan            |
| Prose handling    | Extract exactly one standalone natural number                                    | Satisfies `Ania zebrała 15 jabłek`/`15` deterministically while rejecting ambiguous multi-number prose.                          | Plan            |
| Broader notation  | Natural numbers only                                                             | Matches the current catalog and avoids speculative decimal, fraction, expression, and number-word parsing.                       | Plan            |
| Canonical storage | Ungrouped base-10 digits                                                         | Gives future automatic scoring a stable machine-oriented answer.                                                                 | Plan            |
| Provider behavior | Align both prompts to bare ungrouped numbers                                     | Reduces model variance without relying on prompt compliance for correctness.                                                     | Plan            |
| Strategy history  | Bump to `grade-4-independent-answer-set-v2`                                      | Makes the changed verification semantics explicit in new evidence.                                                               | Research / Plan |
| Existing data     | Delete all exercises and verification rows                                       | The user does not need old exercises or v1 evidence retained.                                                                    | Plan            |
| Re-verification   | Future candidates only                                                           | No migration, reclassification, or UI workflow is needed for old candidates after the reset.                                     | Plan            |

## Scope

**In scope:**

- Deterministic natural-number equivalence keys and canonical digit output.
- Valid Polish grouping and exactly-one-number prose extraction.
- Generator and verifier prompt alignment.
- V2 strategy identity and focused unit/service regression coverage.
- Destructive reset of all `exercises` and `exercise_verifications` rows.
- Full automated gates and retained manual rollout evidence.

**Out of scope:**

- Decimal, fraction, percentage, expression, number-word, or semantic-model equivalence.
- Malformed grouping or multi-number prose extraction.
- Preserving or re-verifying any existing exercise or verification record.
- Changes to provider failures, UI statuses, teacher approval, or student scoring.

## Architecture / Approach

Literal normalization remains the fallback. A new verification canonicalization result supplies a namespaced comparison key plus canonical output: supported natural-number representations map to ungrouped digits, while unsupported forms remain distinct literals. The verifier deduplicates and compares keys, stores verifier-derived canonical digits, and records v2 identity. A forward migration then deletes dependent exercises before verification evidence during a coordinated no-traffic cutover.

## Phases at a Glance

| Phase                                     | What it delivers                                                           | Key risk                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Define and Prove V2 Equivalence        | Deterministic equivalence, aligned prompts, canonical digits, and v2 tests | Over-broad extraction could admit a false positive.               |
| 2. Reset Data and Validate the V2 Rollout | Empty exercise domain followed by verified v2 generation and approval      | Deployment ordering can recreate v1 rows or delete fresh v2 rows. |

**Prerequisites:** Local Supabase/Docker for migration checks, configured generator and verifier models for manual verification, and a maintenance window with verification traffic stopped.
**Estimated effort:** About 2 focused implementation sessions across 2 phases, plus one coordinated live-provider cutover check.

## Open Risks & Assumptions

- Exactly-one-number prose intentionally ignores surrounding words and units; teacher approval remains the final content-quality gate.
- Provider prompts reduce variance but do not establish correctness; deterministic canonicalization remains authoritative.
- The reset permanently removes all approved exercises and verification evidence, not only rows explicitly labeled v1.
- Code rollback cannot restore deleted data, and backup/restore is intentionally outside this change.

## Success Criteria (Summary)

- Grouped natural numbers and exactly-one-number prose pass verification against their bare-digit equivalents and store ungrouped canonical digits.
- Malformed grouping, multi-number prose, and broader notation do not gain equivalence.
- Existing exercise and verification tables are emptied, and every newly stored result uses v2 evidence while all test, lint, type, build, database, and smoke gates pass.
