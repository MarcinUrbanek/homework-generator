---
change_id: testing-authorization-and-invitation-boundaries
title: Test authorization and invitation boundaries
status: implemented
created: 2026-10-03
updated: 2026-10-05
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Authorization and invitation boundaries".
Risks covered:
- Risk #1: A student accesses another student's data or teacher-only actions.
- Risk #4: An expired, rotated, replayed, or wrong-recipient invitation grants class access.
Test types planned: API integration + database.
Risk response intent:
- Risk #1: Prove every forbidden role or ownership request is denied without leaking protected data.
- Risk #4: Prove expired, rotated, replayed, and wrong-recipient invitations cannot enroll while valid invitation state survives authentication.