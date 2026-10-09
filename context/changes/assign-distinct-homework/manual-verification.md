# Assign Distinct Homework: Manual Verification

This record is a checklist for human observation. `Pending` means the scenario has not been confirmed. Do not record real email addresses, credentials, class codes, assignment payloads, canonical answers, or student identifiers.

## Verification State

- Overall manual status: Pending
- Verification date and time zone: Not recorded
- App environment and non-secret origin label: Not recorded
- Browser/device and desktop/mobile viewport sizes: Not recorded
- Node.js and Supabase CLI/runtime versions: Not recorded
- Migration state and revision under test: Not recorded
- Automated verification observed on 2026-10-08:
	- `npx supabase db reset`: PASS; the assignment migration applied on a clean local schema.
	- `npm run db:test`: PASS; 7 database test files and 222 assertions.
	- `npm test`: PASS; 40 files and 296 tests.
	- `npm run lint`: PASS.
	- `npx astro check`: PASS; 135 files, 0 diagnostics.
	- `npm run build`: PASS; production SSR build completed.
	- Configured production-preview smoke: PASS; assignment authorization, roster, creation, distinctness, retry, privacy, and cleanup checks passed.
	- Deliberate-break check: NOT COMPLETED; the temporary roster authorization inversion was restored, but the preview rebuild failed with `EPERM` while clearing `dist` after overlapping build attempts.

## Controlled Accounts

Use labels only; do not retain sign-in identifiers or credentials.

| Label | Intended role | Verification status |
| --- | --- | --- |
| Teacher A | Teacher and assignment owner | Pending |
| Teacher B | Different teacher and shared-pool exercise owner | Pending |
| Student A | Current class member | Pending |
| Student B | Current class member | Pending |
| Student C | Selected member who departs before submit | Pending |
| Student D | Current but unselected member | Pending |

## Scenarios

| Scenario | Expected observation | Status | Sanitized result / evidence reference |
| --- | --- | --- | --- |
| Migration safety | A clean local reset applies the assignment migration; existing class, membership, and approved exercise behavior remains intact. | Pending | Not observed |
| Shared approved pool | Teacher A assigns exercises approved by Teacher B from the shared Grade 4 topic/difficulty pool. | Pending | Not observed |
| Initial roster selection | The owner roster displays current members, all preselected; the owner can deselect recipients before review. | Pending | Not observed |
| Recipient subset | Assignment succeeds for a non-empty subset while other current class members remain unassigned. | Pending | Not observed |
| Exercise counts | One, two, three, four, and five exercises are assignable when the approved bucket has sufficient distinct-set capacity. | Pending | Not observed |
| Distinctness and fairness | Persisted recipient sets are non-identical; when overlap is required, observed overlap is minimum for the controlled fixture and exercise reuse remains balanced. | Pending | Not observed |
| Insufficient capacity | The workflow reports required and available exercise counts, creates no assignment, and does not silently reduce the chosen count. | Pending | Not observed |
| Optional title | Blank title is omitted; a supplied title is trimmed and retained. | Pending | Not observed |
| Idempotent retry | Retrying the same confirmed request returns the same assignment without adding rows; a fresh deliberate attempt uses a new key. | Pending | Not observed |
| Mixed departed-member result | A selected member who leaves after roster load is excluded and identified to the owner; remaining selected students receive complete sets. | Pending | Not observed |
| All selected members departed | Creation fails with an actionable unavailable-recipient result and persists no assignment. | Pending | Not observed |
| Anonymous and student denial | Anonymous users and students cannot read the owner roster or create assignments. | Pending | Not observed |
| Cross-teacher denial | A different teacher cannot read the roster or create an assignment for another teacher's class. | Pending | Not observed |
| Response privacy | Roster emails appear only for the owning teacher; creation responses contain no roster emails, canonical answers, or recipient exercise IDs. | Pending | Not observed |
| Desktop accessibility | Keyboard-only operation, visible focus, review/result focus behavior, and live status feedback work without clipping or overlap. | Pending | Not observed |
| Mobile accessibility | Controls remain usable by keyboard and fit the viewport; labels, focus, live feedback, and results do not overlap or clip. | Pending | Not observed |
| S-07 boundary | No student assignment list, exercise-opening, submission, or scoring behavior is treated as part of this verification. | Pending | Not observed |

## Evidence Handling

- Record outcomes only after observing them; use neutral evidence labels and approved storage references.
- Keep screenshots free of account identifiers, credentials, class codes, assignment payloads, canonical answers, and personal data.
- Automated command results belong in their run output. Do not mark this manual checklist passed based only on automated coverage.