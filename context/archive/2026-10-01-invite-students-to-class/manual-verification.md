# Manual Verification: Invite Students to a Class

## Record

- Date: 2026-10-02
- Tester: GitHub Copilot with user-authenticated browser sessions
- Browser and version: VS Code built-in browser
- OS: Windows
- Runtime: Production preview at `localhost:4321`
- Database: Local Supabase Studio
- Resend sender domain: Configured locally; value intentionally not recorded
- Controlled recipient inboxes: `teacher`, `student`, and `mismatch-test` aliases
- Evidence: VS Code browser screenshots captured for delivery, invalid, valid, mismatch, and expiry states; no invitation URLs recorded

## Automated Results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | Passed | 185 tests passed |
| `npx supabase db reset && npm run db:test` | Passed | Clean reset and 115 database checks passed |
| `npm run lint && npm run build` | Passed | Passed after stopping the preview server that held the build directory lock |
| `SMOKE_CLASS_CHECKS=true npm run smoke` | Passed | 19 configured-preview assertions passed; no invitation email was sent |

## Manual Outcomes

| Scenario | Account or address alias | Expected outcome | Observed outcome | Evidence |
| --- | --- | --- | --- | --- |
| Create a named class | `teacher` | Generated class code and empty invitation state | Passed: a named verification class was created with a generated code | Teacher workspace screenshot |
| Validate 50 recipients | `teacher` | Exactly 50 normalized unique recipients accepted; 51 rejected | Passed: 50 left sending enabled; 51 disabled it before submission | Browser recipient counter |
| Partial provider failure | `teacher`; `student`; suppressed-recipient alias | Per-address sent and failed results; successful addresses remain usable | Passed: the `student` invitation refreshed while the Resend-suppressed recipient reported `Nie wysłano` in the same batch | VS Code browser delivery-results state |
| Resend duplicate invitation | `student` | Newest link works; older rotated link is rejected | Passed: prior link showed an unavailable state; newest link reached the ready state | Token-free browser screenshots |
| Seven-day expiry | `student` | Link is rejected after expiry | Passed: local test invitation was expired through Studio; its link showed the expired state | Token-free browser screenshot |
| Authentication continuation | `student` | Latest link resumes exact internal path and query after sign-in | Passed: matching-account sign-in returned to the non-enrolling ready state | Browser state after sign-in |
| Safe redirect fallback | `mismatch-test` | External and protocol-relative `return_to` values fall back safely | Passed: both unsafe values returned to the local signed-in landing page | Browser navigation |
| Dual-role teacher access | `teacher` | Class page and APIs remain accessible as teacher | Passed: added the student role through Studio; authenticated teacher workspace remained accessible | Studio success and class workspace |
| Email binding | `student` and `mismatch-test` | Matching account sees ready state; mismatched account receives no recipient data | Passed: matching account saw the ready state; mismatched account saw only a generic Polish message | Token-free browser screenshots |
| No membership creation | Database inspection | No membership table or membership row was created | Passed: Studio schema query returned zero public tables with `membership` in the name | Studio query result |

## Delivery Evidence

- Latest Resend delivery: Browser UI reported sent and then refreshed delivery for the `student` alias.
- Partial provider failure: Browser UI independently reported `Nie wysłano` for the Resend-suppressed recipient in the same batch.
- Previous rotated link rejected: Confirmed in the browser before explicit local expiry testing.
- Latest link survives authentication: Confirmed for the matching `student` account before explicit local expiry testing.
- No invitation token, URL, provider diagnostic, or secret recorded in this file: Confirmed

## Issues Found

No issues found during recorded manual verification.