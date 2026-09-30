# V2 Rollout Manual Verification

Status: Passed. Evidence below comes from the coordinated local cutover and live-provider verification. No secrets or raw provider payloads are included.

## Cutover Context

- Date and time (UTC): 2026-09-30, with live evidence recorded from 16:58 through 17:01
- Environment: Local Astro/Cloudflare runtime with local Supabase
- Application version or deployment: `47c201d` plus staged Phase 2 reset migration
- Deployed verifier model: `z-ai/glm-5.3`
- Operator: User-confirmed manual run
- Verification traffic stopped at: Before `npx supabase db reset`; the local dev server was stopped
- V2 traffic resumed at: After the clean reset; first stored v2 evidence at `2026-09-30T16:58:18.367Z`

## Reset Evidence

Record counts while verification traffic is stopped and before any v2 generation or verification activity.

| Measurement | Before reset | After reset, before v2 traffic |
| --- | ---: | ---: |
| `public.exercises` rows | Not captured before the first local reset | 0 |
| `public.exercise_verifications` rows | Not captured before the first local reset | 0 |
| `public.profiles` rows | Not captured before the first local reset | 0 |

Queries used:

```sql
select count(*) from public.exercises;
select count(*) from public.exercise_verifications;
select count(*) from public.profiles;
```

- Reset migration applied: Yes, `20260930120000_reset_exercise_data_for_answer_equivalence_v2.sql`
- Both exercise-domain tables empty before traffic resumed: Yes; service-role counts returned `0` and `0`
- Profile count unchanged: The forward migration does not target `profiles`; direct count comparison is not applicable because local `db reset` recreates the entire database
- Any v1 strategy identity observed after traffic resumed: No; query across stored evidence returned `v1Count=0`

## Representative Live Flow

Record one arithmetic candidate and one word-problem candidate. Keep rationale summaries concise and omit raw provider payloads.

| Field | Arithmetic candidate | Word-problem candidate |
| --- | --- | --- |
| Generated exercise text | `Oblicz: 23 + 35 = ?` | `W sklep weszło 67 osób, a wyszło z niego 52 osoby. Ile osób zostało w sklepie?` |
| Generated proposed answer | `58` | `15` |
| Verifier-derived answer | `58` | `15` |
| Ledger `verifier_identity` | `OpenRouter/grade-4-independent-answer-set-v2` | `OpenRouter/grade-4-independent-answer-set-v2` |
| Ledger `verifier_version` | `z-ai/glm-5.3` | `z-ai/glm-5.3` |
| Stored `verified_answer` | `58` | `15` |
| Verification outcome | `unique_answer` | `unique_answer` |
| Approval result | Saved with matching verification ID | Saved with matching verification ID |
| Approved `canonical_answer` | `58` | `15` |

## Equivalence Cases

Run each case through the deployed v2 verification path and record the actual result.

| Case | Proposed answer | Verifier answer | Expected | Actual outcome | Stored canonical answer | Evidence or notes |
| --- | --- | --- | --- | --- | --- | --- |
| Grouped digits | `1234` | `1 234` | Equivalent | `unique_answer` | `1234` | User-confirmed v2 equivalence check |
| One-number prose | `Ania zebrała 15 jabłek` | `15` | Equivalent | `unique_answer` | `15` | User-confirmed v2 equivalence check |
| Malformed grouping | `1234` | `12 34` | Not equivalent | `answer_mismatch` | `12 34` | User-confirmed rejection check |
| Multi-number prose | `15` | `Ania miała 10 jabłek i zebrała 5` | Not equivalent | `answer_mismatch` | Literal answer, not scalar `15` | User-confirmed rejection check |

## Completion Record

- All successful numeric evidence stores ungrouped digits: Yes; 15 live verification rows inspected
- Approved exercises copy the v2 identity and canonical digits exactly: Yes; 15 approved rows inspected, including 5 word problems
- Malformed grouping did not gain numeric equivalence: Yes
- Multi-number prose did not gain scalar equivalence: Yes
- Final result: Passed
- Follow-up issues or incident references: GitHub issue `#11`