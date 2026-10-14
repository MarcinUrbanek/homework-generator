---
change_id: testing-exercise-trust-and-provider-resilience
title: Exercise trust and provider resilience test rollout
status: archived
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14T20:21:33Z
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Exercise trust and provider resilience".
Risks covered: #2 repeated generation requests exhaust provider budget or availability; #3 ambiguous or incorrectly verified exercises reach the approved pool; #5 provider timeout or partial failure loses settled work or reports misleading success.
Test types planned: unit + integration + contract.
Risk response intent:
- #2: Prove repeated costly requests are bounded and rejection is explicit without triggering provider work. Challenge the assumption that disabled UI controls limit server calls; avoid client-only assertions.
- #3: Prove approval requires independent, uniquely answerable evidence from an authoritative source. Challenge the assumption that two agreeing model outputs prove correctness; avoid expected values copied from production logic.
- #5: Prove per-item settled outcomes survive provider failures and failures are represented honestly. Challenge the assumption that a final 200 means every candidate succeeded; avoid over-mocking internal modules.
Use cost x signal to select the cheapest useful protection. Coordinate scope with the existing trustworthy-exercise-approval change rather than duplicating or overwriting it.
After creating the folder, suggest the next natural /10x-research command, then continue through /10x-plan and /10x-implement unless a blocker or test-plan correction requires returning to /10x-test-plan.
