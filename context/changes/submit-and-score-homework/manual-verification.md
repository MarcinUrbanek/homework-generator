# Student workflow manual verification

Implementation status: **automated and human acceptance checks passed**.

## Automated verification

- Focused UI and role tests — PASS: 2 files, 23 tests.
- Full application tests — PASS: 47 files, 392 tests.
- `npm run db:test` — PASS after `npx supabase db reset --local`: 8 files, 297 tests. The initial run against the pre-existing local database found stale verification rows.
- `npm run lint` — PASS.
- `npm run build` — PASS.
- `npm run smoke` — PASS against the configured local production preview: all 20 applicable steps. Configured-preview mode was used, so missing-provider-configuration probes were not applicable.

## Recorded outcomes

Manual acceptance was completed on 2026-10-10. The outcomes below record the verified scenarios.

| Verification                                                                                                                     | Actual outcome | Evidence                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------- |
| Two concurrent database sessions submit equivalent/different answers while membership deletion races with submission             | PASS           | Verified with two local database sessions               |
| Two students independently list/open their allocations; HTML and network payloads contain no canonical answers or classmate data | PASS           | Teacher assignment and separate student browser sessions |
| Half-correct pass boundary, below-half fail, all-blank fail, and accepted/rejected numeric formats                               | PASS           | Live assignment submissions with formatted/rejected input |
| Lost-response retry, different-vector conflict, persisted result reload, and membership revocation                               | PASS           | Live retry, conflict, reload, and revocation checks     |
| Anonymous deep-link return and student-only, teacher-only, dual-role, and not-yet-enrolled navigation                            | PASS           | Authenticated navigation role matrix                    |
| Keyboard use, screen-reader status/focus, narrow layout, empty/unavailable state, and recoverable network failure                | PASS           | Browser accessibility, responsive, and failure checks   |

## Acceptance record

Human acceptance was recorded on 2026-10-10. All required manual scenarios passed; no unresolved cases were recorded.

## Local test fixtures

Start local Supabase with the repository migrations applied, then run:

```powershell
npm.cmd run seed:homework-manual-test
```

The script reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env` or `.dev.vars`, and refuses to write unless Supabase is at `http://localhost:54321` (or an equivalent loopback URL). It creates confirmed local accounts, role rows, one class, approved exercises, and separate assignments for privacy, blank/reload, scoring boundaries, retry/conflict, membership revocation, and grouped-number input. Re-running it replaces only its named test class and tagged exercise fixtures; it does not reset the database.

The generated assignment records are setup fixtures, not proof of the teacher assignment UI/API. For that part of check 3.4, sign in as the fixture teacher, use the teacher homework form to assign two exercises to Student A and Student B, then verify their separate allocations as each student.

All accounts use password `LocalHomeworkTest!2026`:

| Role                              | Email                            |
| --------------------------------- | -------------------------------- |
| Teacher                           | `s07.teacher@example.test`       |
| Other teacher (not enrolled)      | `s07.other-teacher@example.test` |
| Student A                         | `s07.student-a@example.test`     |
| Student B                         | `s07.student-b@example.test`     |
| Dual-role student/teacher         | `s07.dual-role@example.test`     |
| Student not enrolled in the class | `s07.not-enrolled@example.test`  |

The command prints the homework URLs, recipients, and expected answers in exercise order. Keep this information in the teacher/tester context; do not paste expected answers into student-facing pages or network payloads.

## Observations

**1.4 — PASS:** With two database sessions, simultaneous equivalent/different submissions produce one final submission without partial rows; membership deletion serializes with submission and prevents later access.
**3.4 — PASS:** A teacher assigned real homework, both students accessed only their own allocations, and blank submissions reloaded with the same per-item results without canonical answers in HTML or network payloads.
**3.5 — PASS:** Exactly half correct passed, below half and all blanks failed, formatted equivalent numbers scored correctly, and prose, decimal, and negative inputs were rejected before finalization.
**3.6 — PASS:** Departed members could not list, open, submit, view, or replay homework; anonymous deep links resumed after sign-in, and student, teacher, and dual-role dashboards showed their intended entry points.
**3.7 — PASS:** Keyboard and screen-reader status/focus behavior, narrow/mobile layout, empty and unavailable states, and recoverable network errors were verified.

