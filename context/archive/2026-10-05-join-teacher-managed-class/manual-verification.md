# Join Teacher-Managed Class: Manual Verification

This record captures manual verification without retaining sensitive data. Record only outcomes and sanitized evidence references that were actually supplied; do not infer missing environment or scenario details. Never include passwords, session data, email addresses, class codes, invitation tokens or URLs, or personal data.

## User-Confirmed Result

- Status: Passed, confirmed by the user on 2026-10-06.
- Scope: The user confirmed the real code and controlled invitation checks passed, and that no roster, leave, teacher removal, code rotation, or homework behavior is exposed.
- Evidence: User confirmation in this session. Environment details, account labels, and scenario-specific evidence references were not provided and have not been inferred.

## Environment

- Verification date and time zone: 2026-10-06; time zone not provided.
- App environment and non-secret origin label: Not provided.
- Browser/device and viewport(s): Not provided.
- Node.js version: Not provided.
- Supabase CLI/runtime version: Not provided.
- Migration state (including whether reset from a clean schema): Not provided for manual verification.
- Revision under test: Not provided.

## Controlled Accounts

Use labels only. Do not write login identifiers or credentials here.

| Label | Intended role(s) before test | Role(s) after test | Notes |
| --- | --- | --- | --- |
| Teacher A | Teacher | | |
| Student A | Student | | |
| Student B | Student | | |
| Dual-role account | Teacher and student | | |

## Scenarios

`Pending` is the initial state, not a result. For each row, record the observed outcome and a sanitized evidence reference, or leave it pending.

| Scenario | Expected boundary | Status | Observed outcome / sanitized evidence reference |
| --- | --- | --- | --- |
| Class-code preview | Shows the intended class and teacher display name before confirmation; creates no membership. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Class-code confirmation | A separate explicit confirmation creates one membership and grants the student role. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Class-only fallback | A class owned by a teacher without a display name remains previewable and joinable without exposing another identity. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Teacher display name | A teacher can set or update the display name; subsequent previews show the saved value. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Multiple classes | One student can join two classes; the joined list shows both, with one membership per class. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Dual roles | Joining does not remove teacher access; both teacher-managed and joined-class surfaces remain available. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Invitation preview | A delivered invitation for the signed-in recipient shows the safe class preview and does not create membership before confirmation. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Invitation confirmation | Explicit confirmation enrolls the matching recipient and consumes the invitation atomically. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Wrong recipient | A different signed-in account receives a generic unavailable response and no recipient identity is disclosed. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Expired invitation | An invitation expired at confirmation is denied without membership. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Failed delivery | An invitation whose delivery failed is unavailable and cannot enroll an account. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Rotated token | A previously issued invitation link is unavailable after its token is rotated. Record only that the prior link was rejected. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Same-user retries | Repeating the same code or redeemed invitation for the same account and class returns the existing membership, without a duplicate row. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Replayed invitation | A different account cannot reuse an invitation already redeemed by another account; denial is non-disclosing. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Cross-student isolation | Student A cannot see Student B's memberships or private identity through joined-class reads or join responses. | Passed | User confirmed the manual verification passed; scenario-specific evidence was not provided. |
| Join-only scope | No roster, leave, teacher removal, code rotation, or homework behavior is exposed from the class-join surfaces. | Passed | User confirmed no roster, leave, teacher removal, code rotation, or homework behavior is exposed. |

## Evidence Handling

- Keep any controlled invitation link in the approved test inbox only; do not paste or screenshot its URL or token here.
- Screenshots must omit account identifiers, browser address bars containing invitation data, and unrelated personal information.
- Reference evidence by a neutral label and storage location approved for the project; do not attach raw API payloads if they contain identifiers.
- Automated test, database, lint, build, and smoke results belong in their respective run output; do not infer or copy a passing result into this manual record without running and observing it.