# Frame Brief: Verifier answer equivalence

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

When we verify newly generated exercices most of them are rejected or unverified becuse answers do not match in 100% between agent that creates exercise and the one that validates them.

Examples:

- Response 1 is `1234` while response 2 is `1 234`.
- Response 1 is `Ania zebrala 15 jablek` while response 2 is `15`.
- In both cases those responses are equal and should pass the verification.

## Initial Framing (preserved)

- **User's stated cause or approach**: Answers do not match in 100% between the agent that creates an exercise and the one that validates it.
- **User's proposed direction**: Responses that are equal in value or meaning should pass verification.
- **Pre-dispatch narrowing**: Formatting-only mismatches and sentence-versus-short-answer mismatches both occur often; observed cases affect numeric and short-text answers and appear as rejected and unverified outcomes.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Representation comparison** - conservative normalization preserves digit-grouping spaces, so equivalent numeric representations remain different. This is the initial framing's main landing point.
2. **Answer-shape contract** - generation accepts an unrestricted canonical-answer string while independent verification may return a scalar, sentence, or several presentation variants.
3. **Verifier outcome formation** - multiple normalized answers become `not_unique_answer`, while provider or persistence failures become transient `indeterminate`; an untouched candidate remains `unverified`.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Representation comparison rejects equivalent formatting | [`normalizeExerciseAnswer`](../../../src/lib/exercises/answer-normalization.ts) collapses repeated whitespace but preserves the single space in `1 234`. The verifier then uses exact equality after normalization in [`classifyAnswers`](../../../src/lib/services/openrouter-exercise-verifier.ts). Existing tests preserve differences such as `1/2` versus `0,5`, but do not cover digit-grouping spaces. | **STRONG** |
| Generator and verifier use incompatible answer shapes | The [generator prompt](../../../src/lib/services/openrouter-exercise-generator.ts) requests one canonical answer without defining its shape. The [verifier prompt](../../../src/lib/services/openrouter-exercise-verifier.ts) independently requests the full set of correct answers without constraining representation. Exact comparison cannot reconcile a sentence with its scalar result. | **STRONG** |
| All rejected or unverified states are answer-equivalence failures | [`answer_mismatch` and `not_unique_answer`](../../../src/lib/services/openrouter-exercise-verifier.ts) can arise from representation variance. However, the [verification API](../../../src/pages/api/exercises/verify.ts) emits `indeterminate` for provider or persistence failures, and the [candidate UI](../../../src/components/exercises/ExerciseCandidateList.tsx) distinguishes that from initial `unverified`. | **WEAK** |

The archived verification decision confirms that this behavior was an accepted tradeoff, not an accidental regression. The [plan brief](../../archive/2026-09-29-approve-first-exercise-pool/plan-brief.md) chose exact agreement after conservative normalization and explicitly accepted rejection of semantically equivalent formatting as safer than silent correction. The [implementation plan](../../archive/2026-09-29-approve-first-exercise-pool/plan.md) likewise preferred conservative false negatives.

## Narrowing Signals

- Both formatting-only and sentence-versus-short-answer mismatches are observed frequently.
- Numeric and short-text answers are affected.
- Digit-grouping spaces, such as `1234` versus `1 234`, are the dominant directly observed numeric difference.
- Sentence-like content appears occasionally as leftover AI-model response text.
- The reported "unverified" population spans `Nie udało się rozstrzygnąć`, `Brak jednej odpowiedzi`, and `Niezweryfikowane`, which are not one technical outcome.
- A sentence or scalar answer has not yet been checked systematically for omitted units or missing parts; broad semantic containment is therefore not established as safe.

## Cross-System Convention

The current project convention deliberately treats canonical-answer verification as conservative normalized-string equality. It normalizes case, Unicode, surrounding or repeated whitespace, and a terminal period, while preserving units, punctuation, numeric notation, and internal single spaces. This prevents silent false positives but knowingly creates false negatives for equivalent presentation variants.

An independent observation-only review reached the same split: formatting variance explains `answer_mismatch` and some `not_unique_answer` results, whereas `indeterminate` reflects provider or persistence reliability and `unverified` is the pre-verification state. No evidence supports treating all three UI labels as one equivalence defect.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: generation and verification do not share an explicit, domain-safe canonical-answer equivalence contract, so harmless AI representation variance is classified as disagreement or non-uniqueness.

The dominant observed case is numeric digit grouping, while occasional prose-versus-scalar output exposes the wider answer-shape ambiguity. The existing behavior is consistent with the previous conservative safety decision, but it no longer satisfies the stated product expectation for equivalent answers. Provider failures and candidates that were never verified are separate observations and should not be used as evidence that answer equivalence failed.

## Confidence

- **HIGH** - the comparison behavior is directly visible in code, the prior tradeoff is documented, the user's dominant example maps exactly to it, and an independent review reached the same conclusion.

The frequency of each outcome is not instrumented, so confidence is high in the causal mechanism but not in the claim that it explains every unresolved candidate.

## What Changes for /10x-plan

The plan should be about defining and enforcing one safe canonical-answer equivalence contract across generation, verifier answer-set deduplication, and final comparison. It should preserve the distinction between equivalence-driven mismatch/non-uniqueness and unrelated `indeterminate` or initial `unverified` states.

## References

- Source: [`src/lib/exercises/answer-normalization.ts`](../../../src/lib/exercises/answer-normalization.ts)
- Source: [`src/lib/services/openrouter-exercise-generator.ts`](../../../src/lib/services/openrouter-exercise-generator.ts)
- Source: [`src/lib/services/openrouter-exercise-verifier.ts`](../../../src/lib/services/openrouter-exercise-verifier.ts)
- Source: [`src/pages/api/exercises/verify.ts`](../../../src/pages/api/exercises/verify.ts)
- Source: [`src/components/exercises/ExerciseCandidateList.tsx`](../../../src/components/exercises/ExerciseCandidateList.tsx)
- Prior decision: [`context/archive/2026-09-29-approve-first-exercise-pool/plan-brief.md`](../../archive/2026-09-29-approve-first-exercise-pool/plan-brief.md)
- Prior decision: [`context/archive/2026-09-29-approve-first-exercise-pool/plan.md`](../../archive/2026-09-29-approve-first-exercise-pool/plan.md)
- Prior evidence: [`context/archive/2026-09-29-approve-first-exercise-pool/manual-verification.md`](../../archive/2026-09-29-approve-first-exercise-pool/manual-verification.md)
- Investigation tasks: `H1-representation-comparison`, `H2-answer-shape-contract`, `H3-outcome-formation`, `X1-independent-pressure-test`