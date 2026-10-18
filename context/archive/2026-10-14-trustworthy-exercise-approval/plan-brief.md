# Trustworthy Exercise Approval - Plan Brief

> Full plan: [plan.md](./plan.md)
> Frame brief: [frame.md](./frame.md)
> Research: [research.md](./research.md)

## What & Why

> **The actual problem to plan around is**: ustalić, czy zatwierdzenie ma wymagać dowodu poprawności i jednoznaczności dla każdego ćwiczenia w ograniczonej domenie, czy produkt świadomie przyjmuje probabilistyczną ocenę wspartą testami.

The frame confirms the stronger per-exercise runtime condition and accepts limited scope.
This plan makes that evidence mandatory; agreeing models or an offline test corpus alone do not establish it.

## Starting Point

Today, a model-reported singleton matching a proposed answer becomes persisted success.
Ownership, snapshot binding, and teacher approval exist, but mathematical authority does not.
Homework stores exercise IDs and reads pool prompts/answers; old browser storage can restore model-only success.

## Desired End State

Teachers generate, verify, and approve supported Polish arithmetic whose exact statement has one computed answer.
Legacy exercises stay stored but cannot enter new homework or appear as student prompts.
Old pending homework becomes explicitly unavailable; submitted results remain readable without old prompts or rescoring.

## Key Decisions Made

| Decision              | Choice                                                           | Why                                                                                                  | Source          |
| --------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------- |
| Guarantee             | Authoritative evidence for every admitted/student-shown exercise | Model agreement does not prove correctness or uniqueness.                                            | Frame           |
| Teacher role          | Review usefulness after platform verification                    | Teacher approval is not the mathematical oracle.                                                     | Frame           |
| Authority             | Versioned structures, Polish templates, exact arithmetic         | Bind the solution to the precise displayed statement.                                                | Plan            |
| Domain                | Grade 4 arithmetic; three topics, three difficulty buckets       | Addition/subtraction, multiplication/exact division, and order of operations have bounded contracts. | Plan            |
| Model role            | Propose parameters only                                          | Preserve provider-backed generation without trusting its text or answers.                            | Plan            |
| Legacy data           | Quarantine without deletion                                      | Block old prompts/first submissions but retain history and persisted results.                        | Plan            |
| Old browser batches   | Read-only reference, cleared selection, regeneration notice      | Preserve text without pretending old evidence can be approved.                                       | Plan            |
| Downstream protection | Gate database reads/scoring and provide result-only UI           | Existing homework is ID-based, not a separate content snapshot.                                      | Research / Plan |

## Scope

**In scope:** deterministic authority, structured generator proposals, immutable evidence,
database promotion/direct-write checks, discovery/assignment/student guards, storage migration,
independent fixtures, local seed updates, and directly related documentation.

**Out of scope:** word problems/arbitrary prose, model-verifier approval fallback, Risk #5,
whole Phase 2 completion, changed quotas/scoring, data deletion/rescoring, new CI/hooks/E2E tooling.

## Architecture / Approach

`model structure -> validated parameters -> server-rendered Polish prompt -> exact verification -> immutable ledger -> checked approval -> certified consumers`

Share the TypeScript contract; validate it again in PostgreSQL so trusted direct writes cannot
bypass authority. Independently solved fixtures check both runtimes. Unsupported/unknown evidence
fails closed; success requires exact structure/text/answer/metadata binding, not a Boolean or digest.

## Phases at a Glance

| Phase                                  | What it delivers                                           | Key risk                                            |
| -------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| 1. Arithmetic authority and generation | Closed structure/evaluator/renderer and provider proposals | Wording or precedence differs from solved structure |
| 2. Verification and pool admission     | Bound ledger evidence and database enforcement             | Forged/stale evidence or trusted-write bypass       |
| 3. Discovery and homework protection   | Quarantine plus prompt-free historical results             | Old prompts leak or existing results are rescored   |
| 4. Teacher review compatibility        | Supported topics and reference-only old batches            | Stale storage appears selectable                    |
| 5. Independent evidence and rollout    | Adversarial tests, certified seeds, release documentation  | Self-derived expectations or incomplete deployment  |

**Prerequisites:** Node/npm and existing dependencies; disposable local Supabase/Docker for database checks; independent fixture/Polish-template reviewer; authorized deployed-data inventory before release.
**Estimated effort:** roughly 5-8 focused implementation/review sessions; not a delivery commitment.

## Open Risks & Assumptions

- Deployed legacy data is unknown; the chosen quarantine policy applies even if existing work becomes unavailable.
- Template correctness and TypeScript/PostgreSQL agreement need independent review; naming a source authoritative is not certification.
- All phases are one compatible release: maintenance window, migrations, application, verification, then reopen; rollback must retain quarantine.

## Success Criteria (Summary)

- Only exactly bound, deterministically certified arithmetic can be approved, assigned, shown, or first-scored.
- Old reviewed text/history/results are retained without stale eligibility, uncertified student prompts, or rescoring.
- Independent/adversarial fixtures and focused database/API/UI checks pass; lint, typecheck, and production build pass before release.

## References

- [Full plan and canonical Progress](./plan.md), [frame](./frame.md), [research](./research.md).
- [Risk #3 and unchanged rollout scope](../../foundation/test-plan.md), [FR-006 and guardrails](../../foundation/prd.md).
