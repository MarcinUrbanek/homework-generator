---
project: "Homework generator"
version: 1
status: draft
created: 2026-09-14
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: null
  data_volume: null
timeline_budget:
  mvp_weeks: 2
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Primary-school classroom math teachers in Poland need to prepare many distinct exercises at the same difficulty so each student can receive different homework. Creating these variants and checking their answers is time-consuming and drains teachers' energy.

Existing worksheets and exercise banks provide too few distinct exercises at reliably equivalent difficulty. The validation, difficulty-grouping, assignment, and passing rules remain unchanged at roughly 100 times the initial target scale.

## User & Persona

The primary persona is a primary-school classroom math teacher in Poland who prepares and checks differentiated homework for their students.

## Success Criteria

### Primary

- A teacher can complete the full homework flow: inspect the exercise pool, request generation by subject when needed, review verified exercises, save selected exercises, choose an exercise count, automatically assign a distinct and comparably difficult set to each student, receive automatically scored submissions, and review the answers or provide feedback.

### Secondary

- Teacher-approved exercises remain available for reuse in future homework.

### Guardrails

- Every exercise shown to students has exactly one valid answer.
- Students cannot access another student's assignments, submissions, results, or feedback.

## User Stories

### US-01: Teacher assigns distinct homework to a class

- **Given** enough exercises are available in the exercise pool
- **When** a teacher chooses an exercise count and assigns homework to specific students from the same class
- **Then** each student receives a distinct set from one teacher-approved difficulty bucket, submits their answers, and immediately sees pass or fail based on the submitted score

#### Acceptance Criteria

- Each student receives exactly the exercise count selected by the teacher.
- Every assigned exercise has exactly one valid answer.

## Functional Requirements

### Access and classes

- FR-001: Teachers and students can sign in with email and password. Priority: must-have
  > Socrates: Counter-argument considered: mandatory accounts may add adoption friction. Resolution: kept; account separation and persistence justify email/password access for both roles.
- FR-002: Teacher can invite students by email and assign them to a teacher-managed class. Priority: must-have
  > Socrates: Counter-argument considered: invitations and class management may consume effort without proving generation value. Resolution: kept as written.
- FR-003: Student can join a teacher-managed class through a class code or direct invitation link. Priority: must-have
  > Socrates: Counter-argument considered: requiring students to complete an invitation flow may block younger students. Resolution: revised to support a class code or direct link.

### Exercise preparation

- FR-004: Teacher can view the supported math topics for the primary-school grades included in the MVP. Priority: must-have
  > Socrates: Counter-argument considered: a complete curriculum catalog could exceed MVP scope. Resolution: revised to a selected set of grades and topics.
- FR-005: Teacher can select a grade, math topics, and difficulty level for which exercises need to be generated. Priority: must-have
  > Socrates: Counter-argument considered: grade and topic alone may not produce comparably difficult exercises. Resolution: revised to include teacher-selected difficulty.
- FR-006: Platform can verify that an exercise has exactly one valid answer, and the teacher can approve it before it is shown to students. Priority: must-have
  > Socrates: Counter-argument considered: automated verification may create false confidence. Resolution: revised so verification is followed by teacher approval.
- FR-007: Platform can provide every exercise in Polish, subject to teacher approval before student use. Priority: must-have
  > Socrates: Counter-argument considered: polished Polish wording adds generation-quality risk. Resolution: kept as essential for the audience, with teacher approval controlling quality.
- FR-008: Teacher can batch-review generated exercises and save selected exercises to the exercise pool. Priority: must-have
  > Socrates: Counter-argument considered: reviewing every exercise could erase the time saving. Resolution: revised to support fast batch review.
- FR-009: Teacher can reuse saved exercises identified by grade and topic metadata for future homework. Priority: must-have
  > Socrates: Counter-argument considered: a growing pool may become difficult to search. Resolution: revised to require grade and topic metadata.

### Assignment and review

- FR-010: Teacher can choose an exercise count and assign each student a distinct set drawn from one teacher-approved difficulty bucket. Priority: must-have
  > Socrates: Counter-argument considered: distinct sets may be unfair if difficulty cannot be measured reliably. Resolution: revised to constrain each assignment to one teacher-approved difficulty bucket.
- FR-011: Student can open assigned homework and submit answers. Priority: must-have
  > Socrates: Counter-argument considered: digital submission adds a substantial student workflow. Resolution: kept because it is required to prove automatic grading and the selected end-to-end flow.
- FR-012: Platform can score a submission as correct answers divided by assigned exercises, classify a score of at least 50 percent as passed, and release pass or fail immediately. Priority: must-have
  > Socrates: Counter-argument considered: automatic grading may be wrong for ambiguous content. Resolution: only teacher-approved exercises with one valid answer are assigned; pass or fail is released immediately.
- FR-013: Student can view the immediate pass or fail result and any feedback later provided by the teacher. Priority: must-have
  > Socrates: Counter-argument considered: immediate results could expose unreviewed grades. Resolution: immediate pass or fail is intentional; teacher feedback may follow after review.

## Non-Functional Requirements

- No student can access another student's assignments, submissions, results, or feedback.
- Teacher-facing and student-facing product text and exercise content are available in Polish.

## Business Logic

A submission is classified as passed when the number of correct answers divided by the number of assigned exercises is at least 50 percent.

The rule consumes the student's submitted answers and the valid answer for each teacher-approved assigned exercise. It outputs an immediate passed or failed result that the student sees after submission; the teacher can subsequently review the submission and provide feedback.

## Access Control

Teachers and students sign in with email and password.

- Teachers self-register, invite students, create homework, and assign it.
- Students join through teacher invitations, open assigned homework, submit answers, and view results or feedback.

# TODO: unauthenticated protected-route behavior — see Open Questions

## Non-Goals

- The MVP does not cover the complete Polish primary-school mathematics curriculum; it supports only a selected subset of grades and topics so the end-to-end flow can be proven first.

## Open Questions

1. **What happens when an unauthenticated visitor opens a protected route?** — TBD by user.
