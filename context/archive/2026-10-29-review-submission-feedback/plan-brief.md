# Review Submission Feedback — Plan Brief

> Full plan: `context/changes/review-submission-feedback/plan.md`

## What & Why

Close roadmap slice S-08 (US-01, FR-013): teachers can review each student's submitted homework and leave feedback the student later sees. This completes the PRD's end-to-end homework flow; pass/fail is already released immediately, and feedback is the teacher's follow-up.

## Starting Point

Teachers can create assignments but have no view of assignments, recipients or submissions. Submissions are immutable (one per recipient) with per-exercise answers and correctness; no feedback storage exists. All homework data is reachable only through ownership-checked `SECURITY DEFINER` RPCs, and the student list/detail TS schemas are strict.

## Desired End State

A teacher goes class → "Zadania domowe" → assignment → student, sees prompts, the student's answers, correctness and the expected answers, and writes, edits or clears one comment on submitted work. The student sees a "Komentarz nauczyciela" badge on their list and the comment on their result page. Departed students stay visible to the teacher, read-only; unsubmitted recipients can't receive feedback.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Feedback format | One free-text comment per submission | Smallest schema/UI and keeps review fast; matches PRD wording |
| Editing | Editable, latest wins; blank clears; shown with "updated at" | Lets teachers fix mistakes without a history table |
| Review surface | Class → assignments → per-student table → submission page | Mirrors the existing `/classes/[classId]/assign` nesting and ownership checks |
| Expected answers | Shown to the teacher only | Teacher already approved them; needed for useful feedback |
| Unsubmitted homework | No feedback ("nie oddano") | Review targets submitted work; avoids a messaging feature |
| Departed students | Visible, labelled "opuścił klasę", read-only | Honest record without writing feedback nobody can read |
| Student discovery | Badge on the homework list row | Students find feedback that arrives later, with one boolean |
| Storage | Separate `homework_submission_feedback` table, max 2000 chars | Keeps submissions immutable; clear = delete row |

## Scope

**In scope:**
- Feedback table, teacher RPCs (list, assignment detail, submission review, save/clear), feedback-aware student RPCs.
- Teacher service, `PUT /api/homework/[assignmentId]/students/[studentId]/feedback`, three teacher pages, feedback form, class link.
- Student badge and feedback card; database, unit, component and smoke tests.

**Out of scope:**
- Per-exercise comments, revision history, unread tracking, notifications.
- Feedback on unsubmitted work or for departed students; cross-class review inbox.
- Changes to scoring, submission immutability, or the submit RPC output.

## Architecture / Approach

Postgres owns authorization: new `SECURITY DEFINER` RPCs verify `is_teacher()` + class ownership (teacher) or recipient + current membership (student), using the existing error codes (`22023`, `P0002`, `P0003`). A typed service (`homework-review.ts`) parses RPC payloads with zod and maps errors. Teacher pages are server-rendered Astro calling the service directly; only the feedback form is a React island calling the PUT route. Student pages keep their current flow and render the new `feedback` field.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Feedback storage and database functions | Table, RPCs, student schema compatibility, pgTAP isolation tests | Changing student RPC shapes breaks strict schemas if not shipped together |
| 2. Teacher review service and API | Service, schemas/types, PUT feedback route, tests | Error-code mapping drift between SQL and API |
| 3. Teacher review pages | Drill-down pages, feedback form, class link | Route/class mismatch leaking another class's assignment |
| 4. Student feedback display and smoke | Badge, feedback card, extended smoke | Feedback visible to the wrong student or after departure |

**Prerequisites:** S-07 done (it is); local Supabase via Docker for `db:test`, seed and smoke.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- `get_student_homework` must be rebuilt from its latest version (`20261016140000_…`) to keep uncertified-exercise protections.
- The 2000-character limit and Polish copy are planner defaults; adjust during review if needed.
- Smoke requires a local Supabase target; it refuses non-local instances.

## Success Criteria (Summary)

- A teacher can review any submitted homework in their classes and save, edit or clear feedback.
- The student sees the badge and comment for their own homework only; nobody else ever sees it.
- `db:test`, unit/component tests, lint, build and the homework smoke all pass.
