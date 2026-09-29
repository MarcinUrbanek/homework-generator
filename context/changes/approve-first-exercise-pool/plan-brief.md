# Approve First Exercise Pool — Plan Brief

> Full plan: `context/changes/approve-first-exercise-pool/plan.md`

## What & Why

This change turns generated Polish exercise candidates into the first trustworthy, reusable pool. The platform independently checks that each candidate has one valid answer matching the proposed answer, then the teacher remains the final gate by selecting and atomically saving only acceptable results.

## Starting Point

S-01 already generates one to five read-only candidates and preserves them in the current tab. F-01 already stores immutable approved exercises with required evidence and teacher/student RLS, but no trusted service currently produces that evidence or connects a reviewed batch to persistence.

## Desired End State

A teacher explicitly verifies a batch, sees a concise verdict, verified answer, and rationale per candidate, retries only technical failures, selects any successful subset, and saves it in one action. The save is all-or-nothing and replay-safe; saved candidates disappear while unsaved evidence and selection survive refresh.

## Key Decisions Made

| Decision               | Choice                                                                            | Why                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Verification authority | Separate automated server check before teacher approval                           | Preserves FR-006's platform-verification and teacher-approval gates.                        |
| Verification timing    | Explicit batch action                                                             | Makes provider cost and the trust transition visible.                                       |
| Passing rule           | Exactly one derived answer matching the proposal after conservative normalization | Cross-checks uniqueness and canonical-answer correctness without silent correction.         |
| Evidence shown         | Verdict, verified answer, concise rationale                                       | Gives the teacher enough information for an informed final decision.                        |
| Editing                | Read-only candidates                                                              | Keeps verification evidence bound to the exact approved content.                            |
| Approval scope         | Teacher-selected successful subset                                                | Supports fast batch review without approving awkward wording automatically.                 |
| Save consistency       | Atomic selected-batch promotion                                                   | Avoids uncertain partial pool contents.                                                     |
| Verification failures  | Preserve settled results; retry only technical indeterminate items                | Protects paid work and distinguishes bad content from provider outages.                     |
| Idempotency            | Stable verification/candidate provenance                                          | Prevents duplicates across retries and concurrent tabs without rejecting similar exercises. |
| Post-save state        | Remove saved candidates and retain the remainder                                  | Prevents accidental reapproval while preserving unfinished work.                            |
| Refresh recovery       | Restore evidence and selection in versioned session state                         | Protects both paid generation and verification work.                                        |
| Trust boundary         | Server-owned verification ledger plus approval RPC                                | Browser state remains resumable UX state, never authoritative evidence.                     |

## Scope

**In scope:**

- A dedicated OpenRouter verifier model and conservative answer normalization.
- Immutable teacher-owned verification records with successful and content-failure outcomes.
- Granular batch verification, indeterminate-only retry, read-only evidence, and successful-only selection.
- Atomic idempotent promotion into the existing approved exercise table.
- Versioned same-tab restoration of evidence and selection, plus post-save remainder handling.
- pgTAP, service/API/UI tests, provider-free smoke checks, and retained visual/manual evidence.

**Out of scope:**

- Editing or overriding candidates, semantic duplicate detection, pool search/reuse, and other grades.
- Background verification, streaming, automatic provider fallback, classes, assignment, submission, or scoring.

## Architecture / Approach

The verification API authorizes the teacher, calls a separately configured OpenRouter verifier for each candidate, and writes settled results through a server-only Supabase client into an immutable ledger. The browser stores a validated copy for same-tab recovery, but approval sends only selected verification IDs. A PostgreSQL function reloads trusted evidence and atomically creates or reuses the linked approved exercises.

## Phases at a Glance

| Phase                      | What it delivers                                                     | Key risk                                                             |
| -------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Trusted persistence     | Verification ledger, provenance, service writer, atomic approval RPC | Browser clients must never gain evidence-write capability.           |
| 2. APIs                    | Independent verifier plus verification and approval endpoints        | Granular provider failures must not erase settled results.           |
| 3. Review workflow         | Resumable evidence, selection, retry, save, and visual fixtures      | Complex state transitions must remain understandable and accessible. |
| 4. North-star verification | Full gates, production smoke, live flow, and retained evidence       | Live model output and concurrency behavior need reproducible checks. |

**Prerequisites:** Completed F-01/S-01, local Supabase/Docker, a Supabase service-role key, and a structured-output-capable dedicated OpenRouter verifier model.
**Estimated effort:** About 5–7 focused implementation sessions across 4 phases, plus human live-provider and visual verification.

## Open Risks & Assumptions

- The verifier remains probabilistic; teacher approval is intentionally the final gate and no failure override exists.
- Conservative normalization may reject semantically equivalent formatting, which is safer than storing an incorrect canonical answer.
- Verification runs up to five provider calls concurrently; actual cost and latency must be recorded during the live check.
- Existing approved exercises have no verification provenance link; they remain valid under the completed F-01 contract.
- The server-only service-role key expands operational sensitivity and must never enter browser bundles or logs.

## Success Criteria (Summary)

- A teacher can verify a generated batch, understand every result, retry only technical failures, and select only successful candidates.
- Saving a subset creates immutable evidence-backed exercises all-or-nothing, and replay or another tab cannot duplicate them.
- Unsaved review state survives refresh; database, unit, lint, Astro, build, smoke, live-provider, responsive, and accessibility checks pass with retained evidence.
