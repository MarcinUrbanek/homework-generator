# Manual Verification: Approve First Exercise Pool

## Environment

- Date: 2026-09-30
- Browser: Chrome 154.0.8037.58
- OS: Windows 11
- Viewports: desktop 1280x800, mobile 390x844
- Runtime: local `workerd` (`npm run dev`), local Supabase
- Generator model: z-ai/glm-5.3
- Verifier model: z-ai/glm-5.3

## Automated results

| Check | Result |
| --- | --- |
| `npm run db:test` | Pass (62 tests) |
| `npm run test` | Pass (120 tests) |
| `npm run lint` | Pass |
| `npx astro check` | Pass |
| `npm run build` | Pass |
| `npm run smoke` (provider-free preview) | Pass |

## Scenario 4.3: live flow

| Step | Outcome |
| --- | --- |
| Generate batch; all answers marked `Niezweryfikowane` | Pass (5 candidates) |
| `Zweryfikuj zestaw`; mixed verdicts | Pass (unique answer: 3, mismatch: 1, not unique: 0, indeterminate: 1) |
| Only successful candidates selectable; Polish rationale concise | Pass |
| Approve successful subset | Pass |
| Replay identical approval | Pass (same exercise IDs, no duplicate rows) |
| Refresh page | Pass (unsaved remainder, evidence and selection retained) |
| Stored exercise matches ledger evidence | Pass |
| Logs free of prompts, answers, secrets | Pass |

### Database evidence

Stored exercises were compared with their linked `exercise_verifications` rows using:

```sql
select e.id, e.verification_id, v.verified_answer, v.verifier_identity, v.verifier_version, v.rationale
from exercises e join exercise_verifications v on v.id = e.verification_id
order by e.created_at desc limit 5;
```

Stored values matched the ledger evidence, and the exercise count did not change on replay.

## Scenario 4.4: keyboard and accessibility

Keyboard-only and pointer flows (verify, select, retry, save, continue with remainder) were checked at desktop and mobile widths with no blocking issues. Screenshots were not retained for this change.

## Issues found

None.
