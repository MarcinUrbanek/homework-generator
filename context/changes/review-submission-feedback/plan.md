# Review Submission Feedback Implementation Plan

## Overview

Close roadmap slice S-08 (US-01, FR-013): a teacher drills down from a class to its homework assignments and then to one student's submitted answers, sees each answer next to the correct answer, and saves a single editable free-text comment per submitted homework. The student sees a "Komentarz nauczyciela" badge on the homework list and the comment on the homework result page. Feedback stays isolated to the intended student.

## Current State Analysis

- Teachers can create assignments (`/classes/[classId]/assign`) but cannot see assignments, recipients, submissions or results anywhere. `ClassWorkspace` only links to assignment creation (`src/components/classes/ClassWorkspace.tsx:20-86`).
- Submissions are immutable, one per recipient, with per-position answers and correctness (`supabase/migrations/20261009145925_add_homework_submissions.sql:47-91`). No feedback column or table exists.
- All homework tables have RLS enabled, direct privileges revoked from `public/anon/authenticated`, and are reachable only via `SECURITY DEFINER` RPCs that verify identity, ownership and current class membership (`20261008120000_add_homework_assignments.sql:53-118`, `20261009145925_add_homework_submissions.sql:93-191`).
- Student reads: `list_student_homework()` (`20261009145925_add_homework_submissions.sql:139-191`) and the latest `get_student_homework(uuid)` (`20261016140000_protect_uncertified_homework_consumers.sql:586-732`, `prompts` and `result-only` kinds). Their TS schemas are `.strict()` (`src/lib/homework/schemas.ts:287-470`), so any new RPC field breaks the app unless the schemas change in the same phase — this is the exact failure class fixed in the archived `student-homework-access` change.
- Student result UI renders pass/fail, score and answers in both live-result and `result-only` states (`src/components/homework/StudentHomeworkView.tsx:100-145,187-230`). The list is `src/components/homework/StudentHomeworkList.astro`.
- No teacher review RPC, service, API route, page or test exists.

## Desired End State

- A teacher opens a class, follows "Zadania domowe", sees each assignment with recipient/submitted/passed/feedback counts, opens an assignment to see a per-student table (current members and departed students marked "opuścił klasę"), and opens a student's submission to see prompt, submitted answer, correctness and expected answer per exercise.
- On a submitted homework of a current class member, the teacher can write, edit or clear one comment (max 2000 characters). Unsubmitted recipients show "nie oddano" with no form; departed recipients are read-only.
- The student list shows a "Komentarz nauczyciela" badge when feedback exists; the result page (both result kinds) shows the comment and its last-updated time. Students never receive expected answers, other students' data, or feedback for homework they can no longer access.
- Verified by `npm run db:test`, `npm test`, `npm run lint`, `npm run build`, the extended homework smoke, and the manual steps below.

### Key Discoveries:

- RPC error convention: `22023` invalid, `42501` forbidden, `P0002` unavailable, `P0003` conflict, `P0004` scoring unavailable, `P0005` persistence failure; mapped in `src/lib/services/student-homework.ts:67-78`. Reuse the same codes for teacher RPCs.
- Teacher ownership pattern: `is_teacher()` plus `classes.teacher_id = auth.uid()` (`20261008120000_add_homework_assignments.sql:73-118`); student emails come from `lower(btrim(auth_user.email))` (`:107`).
- Canonical answers live in `public.exercises.canonical_answer` (`20260923120000_create_verified_exercise_persistence.sql:58-61`), joined via `homework_recipient_exercises`.
- Teacher pages follow `src/pages/classes/[classId]/assign.astro` (UUID param parse → 404, `authorizeTeacher` → 403, `data-role="teacher"` layout, Polish copy).
- RPC envelope parsing must tolerate the SSR client's extra `success` key (`src/lib/services/student-homework.ts:29-38`).
- Smoke homework checks are gated by `SMOKE_HOMEWORK_CHECKS=true` and require local Supabase (`scripts/smoke.mjs:12,214-505`).

## What We're NOT Doing

- Per-exercise comments, feedback revision history, or unread/seen tracking.
- Feedback on unsubmitted homework or messaging/reminders to students.
- Feedback edits for students who left the class (teacher view is read-only for them).
- A cross-class "to review" inbox, notifications or email.
- Changing scoring, pass threshold, submission immutability, or showing expected answers to students.
- Changing `submit_student_homework` output (feedback cannot exist at submit time).
- Editing the manual seed script; feedback fixtures live in database tests and smoke.

## Implementation Approach

Database first, keeping student read schemas in lockstep so the running app never sees an unknown RPC field. Then the teacher service/API, then server-rendered teacher pages with one React island for the feedback form, and finally the student display plus smoke coverage. Feedback lives in its own table keyed by submission so submissions stay immutable; clearing feedback deletes the row.

## Critical Implementation Details

- **State sequencing**: `list_student_homework` changes its return type, so it must be dropped and recreated (not `create or replace`), with grants re-applied. `get_student_homework` must be replaced starting from the latest body in `20261016140000_protect_uncertified_homework_consumers.sql:586-732` so the uncertified-exercise protections are preserved. Phase 1 must update `studentHomeworkSummaryRpcRowSchema` and `studentHomeworkDetailRpcSchema` (and their public counterparts) in the same commit.
- **Timing & lifecycle**: the save RPC must lock the recipient and class membership rows (`for key share`, as `get_student_homework` does) so a concurrent student removal cannot leave feedback written for a departed recipient.

## Phase 1: Feedback storage and database functions

### Overview

Add feedback persistence and all RPCs, expose feedback to the student read path, and keep the app's student schemas compatible.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_add_homework_submission_feedback.sql`

**Intent**: Store one teacher comment per submission and provide ownership-checked teacher RPCs plus feedback-aware student RPCs.

**Contract**:
- Table `public.homework_submission_feedback`: `submission_id uuid primary key references homework_submissions(id) on delete cascade`, `teacher_id uuid not null references auth.users(id)`, `body text not null` with check `btrim(body) <> '' and char_length(body) <= 2000`, `created_at`, `updated_at timestamptz not null`. RLS enabled; revoke all from `public, anon, authenticated`; grant all to `service_role`.
- `list_teacher_class_homework(p_class_id uuid)` → rows `(assignment_id, title, grade, topic, difficulty, exercise_count, created_at, recipient_count, submitted_count, passed_count, feedback_count)`, newest first. Requires authenticated teacher owning the class, otherwise `P0002`.
- `get_teacher_homework_assignment(p_assignment_id uuid)` → jsonb `{assignment: {assignment_id, class_id, class_name, title, grade, topic, difficulty, exercise_count, created_at}, recipients: [{student_id, student_email, is_member, submitted, submitted_at, correct_count, passed, has_feedback}]}` ordered by email. Non-owner or unknown → `P0002`.
- `get_teacher_homework_submission(p_assignment_id uuid, p_student_id uuid)` → jsonb `{assignment: {…same…}, student: {student_id, student_email, is_member}, submission: null | {submission_id, submitted_at, correct_count, assigned_count, passed, answers: [{position, prompt, answer, is_correct, expected_answer}]}, feedback: null | {body, updated_at}}`. Non-owner, unknown assignment or non-recipient → `P0002`.
- `save_homework_submission_feedback(p_assignment_id uuid, p_student_id uuid, p_body text)` → jsonb `{feedback: null | {body, updated_at}}`. Ownership as above (`P0002`); body over 2000 chars → `22023`; no submission or student no longer a member → `P0003`; blank/whitespace body deletes the row (clear); otherwise upsert with `updated_at = statement_timestamp()`.
- `list_student_homework()`: drop and recreate with an extra trailing `has_feedback boolean` column; all other behavior unchanged.
- `get_student_homework(uuid)`: add top-level `feedback: null | {body, updated_at}` to both `prompts` and `result-only` results; non-null only when the caller's own submission has feedback.
- All new functions `SECURITY DEFINER`, `set search_path = ''`, revoke from `public, anon, authenticated`, grant execute to `authenticated`.

#### 2. Student schema compatibility

**File**: `src/lib/homework/schemas.ts`, `src/types.ts`, `src/lib/services/student-homework.ts`

**Intent**: Accept and map the new student fields so existing list/detail pages keep working.

**Contract**: `studentHomeworkSummaryRpcRowSchema` gains `has_feedback: boolean` → public `hasFeedback`. Both detail RPC kinds gain `feedback: {body, updated_at} | null` → public `feedback: {body, updatedAt} | null` on both detail success kinds. A feedback object is only valid when a submission/result is present. Corresponding types in `src/types.ts`.

#### 3. Database tests

**File**: `supabase/tests/database/homework_submission_feedback.sql`

**Intent**: Prove the authorization and isolation boundaries for risk #1 and the feedback rules.

**Contract**: Fixtures for owning teacher, other teacher, student, classmate, departed student, dual-role user. Assert: table RLS enabled and no direct privileges for `authenticated`; teacher RPCs return `P0002` for other teacher, students and anonymous callers; assignment counts and recipient flags are correct including departed students; submission view includes expected answers only for the teacher; save rejects unsubmitted (`P0003`), departed (`P0003`) and over-length (`22023`), upserts, updates `updated_at`, and clears on blank; student list `has_feedback` and detail `feedback` are visible only to the owning student and disappear once they leave the class; classmates never see another student's feedback. Update `homework_submissions.sql` only if its `list_student_homework` column assertions change.

#### 4. Unit tests

**File**: `src/lib/homework/student-schemas.test.ts`, `src/lib/services/student-homework.test.ts`

**Intent**: Cover the new student fields and the invalid "feedback without submission" shape.

**Contract**: Existing tests updated for the new required fields.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on local Supabase: `npx supabase db reset`
- Database tests pass, including the new feedback suite: `npm run db:test`
- Unit tests pass: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- With local seed data, the student homework list and a submitted homework detail still render (no "Nie udało się wczytać zadań domowych"), confirming schema compatibility

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Teacher review service and API

### Overview

Typed service over the teacher RPCs and the feedback mutation endpoint.

### Changes Required:

#### 1. Teacher review schemas and types

**File**: `src/lib/homework/schemas.ts` (or a sibling `review-schemas.ts` if `schemas.ts` grows unwieldy), `src/types.ts`

**Intent**: Validate teacher RPC payloads and the feedback request/response.

**Contract**: RPC row/detail schemas for the three teacher reads; camelCase public types `TeacherClassHomeworkSummary`, `TeacherHomeworkAssignmentDetail`, `TeacherHomeworkSubmissionReview`, `HomeworkFeedback`; request schema `{feedback: string}` with max 2000 characters after trimming; error-code union for the review API.

#### 2. Service

**File**: `src/lib/services/homework-review.ts`

**Intent**: Call the teacher RPCs and map database errors to service errors.

**Contract**: `listTeacherClassHomework(supabase, classId)`, `getTeacherHomeworkAssignment(supabase, assignmentId)`, `getTeacherHomeworkSubmission(supabase, assignmentId, studentId)`, `saveHomeworkSubmissionFeedback(supabase, assignmentId, studentId, body)`. `HomeworkReviewServiceError` codes: `INVALID_REQUEST` (22023), `HOMEWORK_UNAVAILABLE` (P0002), `FEEDBACK_NOT_ALLOWED` (P0003), `DATABASE_UNAVAILABLE`, `PERSISTENCE_FAILURE`. Envelope parsing tolerates the SSR `success` key.

#### 3. Feedback API route

**File**: `src/pages/api/homework/[assignmentId]/students/[studentId]/feedback.ts`

**Intent**: Let the teacher save or clear feedback.

**Contract**: `export const prerender = false`; `PUT` with JSON `{feedback: string}`; requires authenticated teacher via `authorizeTeacher` (401/403); validates UUID params and body (400); maps `HOMEWORK_UNAVAILABLE` → 404, `FEEDBACK_NOT_ALLOWED` → 409, `DATABASE_UNAVAILABLE` → 503, other → 500; success `200 {feedback: {body, updatedAt} | null}`.

#### 4. Tests

**File**: `src/lib/services/homework-review.test.ts`, `src/pages/api/homework/[assignmentId]/students/[studentId]/feedback.test.ts`

**Intent**: Cover mapping, validation and status codes following the existing `student-homework` and `submit` test patterns.

**Contract**: Service: success mapping, each error code, malformed payload → `PERSISTENCE_FAILURE`, `success` key tolerated. Route: 401, 403, 400 (bad UUID, too long, wrong type), 404, 409, 503, 200 save and 200 clear.

### Success Criteria:

#### Automated Verification:

- Unit and route tests pass: `npm test`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

---

## Phase 3: Teacher review pages

### Overview

Server-rendered drill-down pages and the feedback form island.

### Changes Required:

#### 1. Class homework list

**File**: `src/pages/classes/[classId]/homework/index.astro`

**Intent**: Show the class's assignments with recipient/submitted/passed/feedback counts, each linking to its detail.

**Contract**: Same guard pattern as `assign.astro` (404 invalid/unavailable class, 403 non-teacher); empty state "Brak przydzielonych zadań" with a link to `/classes/[classId]/assign`; error state on database failure.

#### 2. Assignment detail

**File**: `src/pages/classes/[classId]/homework/[assignmentId].astro`

**Intent**: Per-student table: email, status (nie oddano / zaliczone / nie zaliczone with score), feedback marker, departed badge "opuścił klasę"; submitted rows link to the review page.

**Contract**: 404 when the RPC reports unavailable or the returned `class_id` differs from the route `classId`.

#### 3. Submission review

**File**: `src/pages/classes/[classId]/homework/[assignmentId]/[studentId].astro`, `src/components/homework/HomeworkFeedbackForm.tsx`

**Intent**: Show the result summary and per-exercise rows (prompt, student answer, correctness, expected answer); render the feedback form for submitted current members, read-only feedback for departed students, and "nie oddano" for unsubmitted.

**Contract**: The form is a React island (`client:load`) posting `PUT` to the Phase 2 route; textarea with live character count (max 2000); save and clear actions; Polish success, validation, 409 ("Nie można już dodać komentarza") and retryable error states; uses `src/components/ui` primitives and `cn()`.

#### 4. Navigation

**File**: `src/components/classes/ClassWorkspace.tsx`

**Intent**: Add a "Zadania domowe" link per class next to "Przydziel zadania".

**Contract**: Link to `/classes/[classId]/homework`.

#### 5. Tests

**File**: `src/components/homework/HomeworkFeedbackForm.test.tsx`, `src/components/classes/ClassWorkspace.test.tsx`

**Intent**: Cover form states (initial value, count limit, save, clear, 409, network error) and the new link.

### Success Criteria:

#### Automated Verification:

- Component tests pass: `npm test`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- As the seeded teacher, navigate class → Zadania domowe → assignment → student and see correct counts, statuses and expected answers
- Save, edit and clear feedback; the assignment table's feedback marker updates after reload
- A departed student's submission is read-only and an unsubmitted student has no form
- Another teacher gets 404/403 on all three pages for a class they don't own

---

## Phase 4: Student feedback display and smoke

### Overview

Show feedback to the student and extend the end-to-end smoke checks.

### Changes Required:

#### 1. Student list badge

**File**: `src/components/homework/StudentHomeworkList.astro`

**Intent**: Show a "Komentarz nauczyciela" badge on rows where `hasFeedback` is true.

**Contract**: Uses the shared `Badge` component.

#### 2. Student feedback card

**File**: `src/components/homework/StudentHomeworkView.tsx`, `src/components/homework/StudentHomeworkForm.tsx`

**Intent**: Render the teacher comment (preserving line breaks, as plain text) and "Zaktualizowano <date>" after the result summary in both live-result and `result-only` states; nothing when feedback is null.

**Contract**: Detail `feedback` passed through from the page props; freshly submitted results show no card.

#### 3. Smoke checks

**File**: `scripts/smoke.mjs`

**Intent**: Extend the `SMOKE_HOMEWORK_CHECKS` flow: teacher saves feedback on the student's submission, the student sees it on the detail API and badge flag on the list API, a classmate cannot see it, another teacher gets 404 from the feedback route, and clear removes it.

**Contract**: Reuses existing smoke helpers and cleanup.

#### 4. Tests and docs

**File**: `src/components/homework/StudentHomeworkForm.test.tsx`, `README.md` (homework smoke section if present)

**Intent**: Cover the card in both result states and its absence; mention feedback in the homework smoke description.

### Success Criteria:

#### Automated Verification:

- Component tests pass: `npm test`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- Configured production-preview smoke passes with feedback checks: `$env:SMOKE_CLASS_CHECKS='true'; $env:SMOKE_HOMEWORK_CHECKS='true'; npm run smoke`

#### Manual Verification:

- As the student, the list shows the badge and the result page shows the teacher's comment with line breaks preserved; after the teacher clears it, both disappear
- A classmate and the dual-role account never see another student's feedback
- After the student is removed from the class, they can no longer open the homework or its feedback

---

## Testing Strategy

### Unit Tests:

- Student and teacher schema validation, including feedback without submission and over-length bodies.
- Service error mapping and envelope tolerance.
- API route status codes and request validation.
- Feedback form states and the student feedback card.

### Integration Tests:

- pgTAP suite `homework_submission_feedback.sql` for ownership, isolation, departed/unsubmitted rules, clear, and expected-answer exposure only to teachers.
- Smoke flow end to end against the production preview with local Supabase.

### Manual Testing Steps:

1. `npx supabase db reset`, `npm run seed:homework-manual-test`, submit homework as Student A.
2. As the teacher, review Student A, save a multi-line comment, then edit it.
3. As Student A, confirm the badge and comment; as Student B, confirm nothing is visible.
4. Remove Student A from the class; confirm the teacher view is read-only and Student A loses access.
5. Clear the feedback for another submitted student and confirm the badge disappears.

## Performance Considerations

Counts are aggregated in SQL per class (expected tens of assignments, ≤ 30 students each); no caching or pagination needed for the MVP.

## Migration Notes

Additive table and functions; `list_student_homework` is dropped/recreated within one migration, so deploy the migration and app together (student schemas in the same release).

## References

- Roadmap: `context/foundation/roadmap.md` (S-08)
- PRD: `context/foundation/prd.md` (US-01, FR-013, Access Control)
- Prior slice: `context/archive/2026-10-09-submit-and-score-homework/plan.md`
- Envelope lesson: `context/archive/2026-10-10-student-homework-access/frame.md`
- Teacher page pattern: `src/pages/classes/[classId]/assign.astro`
- Student read RPCs: `supabase/migrations/20261009145925_add_homework_submissions.sql:139-191`, `supabase/migrations/20261016140000_protect_uncertified_homework_consumers.sql:586-732`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Feedback storage and database functions

#### Automated

- [ ] 1.1 Migration applies cleanly on local Supabase: `npx supabase db reset`
- [ ] 1.2 Database tests pass, including the new feedback suite: `npm run db:test`
- [ ] 1.3 Unit tests pass: `npm test`
- [ ] 1.4 Lint passes: `npm run lint`

#### Manual

- [ ] 1.5 With local seed data, the student homework list and a submitted homework detail still render (no "Nie udało się wczytać zadań domowych"), confirming schema compatibility

### Phase 2: Teacher review service and API

#### Automated

- [ ] 2.1 Unit and route tests pass: `npm test`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Build succeeds: `npm run build`

### Phase 3: Teacher review pages

#### Automated

- [ ] 3.1 Component tests pass: `npm test`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Build succeeds: `npm run build`

#### Manual

- [ ] 3.4 As the seeded teacher, navigate class → Zadania domowe → assignment → student and see correct counts, statuses and expected answers
- [ ] 3.5 Save, edit and clear feedback; the assignment table's feedback marker updates after reload
- [ ] 3.6 A departed student's submission is read-only and an unsubmitted student has no form
- [ ] 3.7 Another teacher gets 404/403 on all three pages for a class they don't own

### Phase 4: Student feedback display and smoke

#### Automated

- [ ] 4.1 Component tests pass: `npm test`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 Build succeeds: `npm run build`
- [ ] 4.4 Configured production-preview smoke passes with feedback checks: `$env:SMOKE_CLASS_CHECKS='true'; $env:SMOKE_HOMEWORK_CHECKS='true'; npm run smoke`

#### Manual

- [ ] 4.5 As the student, the list shows the badge and the result page shows the teacher's comment with line breaks preserved; after the teacher clears it, both disappear
- [ ] 4.6 A classmate and the dual-role account never see another student's feedback
- [ ] 4.7 After the student is removed from the class, they can no longer open the homework or its feedback
