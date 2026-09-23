# Verified Exercise Persistence — Plan Brief

> Full plan: `context/changes/verified-exercise-persistence/plan.md`

## What & Why

This change establishes the first trusted exercise-pool data contract: teacher-approved exercises retain their canonical answer, reusable metadata, and concise proof that a verifier found exactly one valid answer. It gives the next approval and reuse slices a secure persistence boundary without building generation, review UI, or assignment features early.

## Starting Point

The Astro application already uses Supabase Auth with cookie sessions, but it has no domain tables, role model, exercise storage, or RLS policies. The Supabase CLI supports migrations and local pgTAP tests, making a database-first foundation the smallest verifiable step.

## Desired End State

Teachers can share-read an approved pool while future student accounts cannot access canonical answers. An exercise record is append-only: only its creator can remove and replace it, and every replacement must retain fresh verifier evidence rather than altering a previously approved record.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Verification evidence | Verdict, canonical answer, verifier identity/version, timestamp, and rationale | Keeps proof compact, auditable, and independent of a future provider. | Plan |
| Pool visibility | All teachers may read approved exercises | Supports the requested cross-teacher pool. | Plan |
| Future student protection | Minimal teacher/student role profile now | Shared teacher access must not reveal answers to later student accounts. | Plan |
| Ownership | Creator may remove and replace their records | Preserves accountability without allowing cross-teacher changes. | Plan |
| Correction integrity | Replace and reverify | Avoids attaching old proof to changed content or metadata. | Plan |
| Persistence boundary | Approved rows only | Leaves candidate and batch-review workflow to S-02. | Plan |
| Metadata | Required validated text for grade, topic, and difficulty | Supports later filtering without predefining S-01's catalog. | Plan |
| Verification execution | Persist verifier result only | Defers provider integration while enforcing the evidence contract. | Plan |

## Scope

**In scope:**

- A minimal role/profile relation with existing and new accounts defaulting to teacher.
- One timestamped migration for approved exercise records, verifier evidence, metadata, indexes, and RLS.
- pgTAP checks for constraints, role boundaries, shared teacher reads, ownership, and append-only corrections.
- A package script to run the local database tests.

**Out of scope:**

- Generation or execution of answer verification.
- Candidate persistence, batch approval UI, or exercise APIs.
- Catalog enums, assignments, submissions, and any student exercise view.

## Architecture / Approach

A forward-only Supabase migration creates a role-aware profile boundary before creating the teacher-shared exercise pool. RLS checks teacher status for reads, restricts writes to the authenticated creator, and prevents direct updates; a corrected exercise is a new verified row. pgTAP runs against the local Supabase database to prove these constraints without adding a new frontend or test framework.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Establish teacher authorization | Role profile, teacher defaulting, and RLS helper | Existing Auth users must be backfilled safely. |
| 2. Persist immutable approved exercises | Exercise schema, verifier evidence, and pool policies | Shared reads must not expose answers to students. |
| 3. Verify database boundaries | pgTAP suite and database test script | Policy fixtures must exercise distinct identities. |

**Prerequisites:** Docker and a running local Supabase stack for migration and pgTAP execution.
**Estimated effort:** ~2-3 focused sessions across 3 phases.

## Open Risks & Assumptions

- The eventual S-01 catalog will normalize grade, topic, and difficulty values; this slice only requires valid text and reuse-oriented indexes.
- The eventual verifier must supply the agreed evidence fields before S-02 can save an approved exercise.
- Existing accounts are treated as teachers because current self-registration is a teacher workflow; S-04 must create or assign student profiles explicitly.
- Supabase schema changes are forward-only in production, even when Cloudflare code is rolled back.

## Success Criteria (Summary)

- A clean local reset creates teacher roles and the approved-exercise pool without manual schema steps.
- Database tests prove teachers share read access, creators alone can remove/replace records, and students cannot read canonical answers.
- Every approved record retains all required reusable metadata and verifier evidence, with corrections creating a newly verified record.
