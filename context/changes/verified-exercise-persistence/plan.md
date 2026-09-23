# Verified Exercise Persistence Implementation Plan

## Overview

Establish the first durable, access-controlled exercise-pool contract for the homework generator. The change adds a minimal teacher role foundation and append-only approved exercise records that preserve one-answer verification evidence, reusable grade/topic/difficulty metadata, and a shared pool visible to teachers.

## Current State Analysis

The application uses Supabase Auth through a request-scoped SSR client, but has no domain migration, role model, exercise data, or RLS policies. Every current account is created through the public email/password signup route, while the product requires future teacher and student accounts to have different access to verified answers. The Supabase CLI is installed and supports local pgTAP database tests, but the repository has no existing domain-test suite.

## Desired End State

A teacher account has a durable teacher role and can save an approved, uniquely verified exercise with a canonical answer, concise verifier evidence, and filtering metadata. Every teacher can read the approved pool, but only the creator can remove and replace their record; the stored content remains immutable so a correction always needs fresh verification evidence.

### Key Discoveries:

- `src/lib/supabase.ts` creates the cookie-backed Supabase SSR client used by the app, and `src/middleware.ts` resolves the authenticated user for every request.
- `supabase/config.toml` enables ordered migrations, while `supabase/migrations/` has no domain migrations yet.
- `CLAUDE.md` requires timestamped Supabase migrations and granular per-operation, per-role RLS policies.
- `npx supabase test db --local` is available for local pgTAP database verification.

## What We're NOT Doing

- Calling an external verifier or generating exercises.
- Persisting review candidates, rejections, or batch-review UI.
- Adding exercise HTTP endpoints, React components, or teacher workflow pages.
- Defining the supported grade/topic catalog or fixed difficulty vocabulary.
- Building assignments, submissions, student exercise access, or a shared editing workflow.

## Implementation Approach

Add a single forward-only Supabase migration that first creates a minimal role profile linked to `auth.users`, defaults existing and newly registered accounts to teacher, and exposes a narrowly scoped role helper for RLS. The same migration creates only approved exercise rows, including a canonical answer and immutable verification evidence. Policies provide shared teacher reads and creator-only deletion; corrections insert a newly verified replacement instead of mutating the approved record. Database behavior is proven directly with pgTAP before any API or UI is layered on top.

## Critical Implementation Details

The migration must backfill existing Auth users before enabling exercise-pool policies, because the current signup route has no role selection and existing users are teachers by the settled product decision. Do not grant access based solely on authentication: future student accounts must be denied canonical answers even though all current accounts authenticate through the same Supabase client.

## Phase 1: Establish Teacher Authorization

### Overview

Create the minimal role record and lifecycle hook needed for RLS to recognize teacher accounts without introducing class or invitation features.

### Changes Required:

#### 1. Role-profile migration

**File**: `supabase/migrations/<timestamp>_create_verified_exercise_persistence.sql`

**Intent**: Add a public profile record linked one-to-one to `auth.users`, retain future teacher/student role capacity, and make all existing and newly self-registered users teachers. This supplies the access boundary needed before sharing verified answers across teachers.

**Contract**: Create a role-constrained profile relation, backfill current Auth users as `teacher`, and add a secure signup trigger that creates future profiles with the same default. Permit a signed-in user to read only their own profile; expose a migration-owned RLS helper that can determine whether the current user is a teacher without recursive policy evaluation.

### Success Criteria:

#### Automated Verification:

- The local migration creates and backfills the teacher-profile contract with `npx supabase db reset`.

#### Manual Verification:

- A newly registered local account receives the teacher role without a role value supplied by the browser.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 2: Persist Immutable Approved Exercises

### Overview

Add the narrow approved-pool record and RLS policies that let teachers reuse trusted exercises while preserving the link between content and its verification evidence.

### Changes Required:

#### 1. Approved-exercise schema and integrity rules

**File**: `supabase/migrations/<timestamp>_create_verified_exercise_persistence.sql`

**Intent**: Store only teacher-approved exercises with the content, canonical answer, reusable metadata, and concise verifier evidence required by F-01. Keep the record append-only so a correction cannot silently invalidate prior verification.

**Contract**: Add an `exercises` relation owned and approved by a teacher, with required non-empty exercise text, canonical valid answer, grade, topic, and difficulty values. Require successful unique-answer verification evidence consisting of the verdict, verifier identity/version, verification timestamp, and rationale. Include stable identifiers and timestamps. Reject direct updates to verification-backed content or metadata; a correction is represented by a newly inserted, freshly verified replacement record.

#### 2. Exercise-pool row-level security

**File**: `supabase/migrations/<timestamp>_create_verified_exercise_persistence.sql`

**Intent**: Make the approved pool readable by every teacher while protecting future students and preventing one teacher from removing another teacher's work.

**Contract**: Enable RLS with separate operations: a teacher may read all approved exercises; a teacher may insert only a row whose creator and approver are their own authenticated identity; only that creator may delete it. Do not add student read access, broad authenticated access, or an update policy that permits stale verification evidence.

### Success Criteria:

#### Automated Verification:

- The local migration creates the approved-exercise schema, required constraints, and RLS policies with `npx supabase db reset`.

#### Manual Verification:

- In local Supabase Studio, an approved exercise visibly contains its canonical answer, grade, topic, difficulty, and verifier evidence.
- A content correction is represented by a new approved row rather than a direct edit to the original row.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual checks before proceeding.

---

## Phase 3: Verify Database Boundaries

### Overview

Turn the persistence and authorization decisions into repeatable database tests, then run the project gates that protect the server-rendered application.

### Changes Required:

#### 1. pgTAP persistence and RLS tests

**File**: `supabase/tests/database/verified_exercise_persistence.sql`

**Intent**: Prove the foundation contract independently of future API and UI work, including the cross-teacher read requirement and the student exclusion that protects canonical answers.

**Contract**: Add local pgTAP cases for profile backfill/defaulting, required exercise fields, accepted verified evidence, rejected malformed or incomplete records, teacher-wide read visibility, creator-only deletion, denied student access, and append-only correction behavior. Use distinct fixture identities to ensure policies do not pass only because the creator is querying their own row.

#### 2. Verification commands

**File**: `package.json`

**Intent**: Provide a discoverable repository command for the new local database test suite alongside the existing lint, build, and smoke commands.

**Contract**: Add a script that invokes `supabase test db --local` against the database test directory; preserve the existing scripts and dependency set.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies the migration to a clean local Supabase database.
- The new database-test script passes all pgTAP role, RLS, constraint, and immutability cases locally.
- `npm run lint` passes.
- `npm run build` passes.

#### Manual Verification:

- Using separate local teacher and student test accounts, confirm teachers share read access, only the creator can remove a record, and a student cannot retrieve exercise answers.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before considering the change ready for review.

## Testing Strategy

### Unit Tests:

- Do not add a JavaScript unit-test framework for this migration-only slice.
- Use pgTAP assertions for required columns, non-empty metadata, verification-evidence completeness, and immutable approved records.

### Integration Tests:

- Reset the local Supabase database to prove the migration is self-contained and can backfill Auth users.
- Exercise RLS as separate teacher creators, a non-creator teacher, and a student fixture to prove shared read access does not become shared modification or student answer access.

### Manual Testing Steps:

1. Start local Supabase and reset the database with the new migration.
2. Register a new account and confirm its profile is assigned the teacher role.
3. Create an approved exercise through the permitted database path; inspect all persisted evidence and metadata in Studio.
4. Query it as another teacher, then as a student; confirm only teachers can read it.
5. Attempt a direct correction and confirm the record must be removed/replaced with new verification evidence.

## Performance Considerations

The initial pool is small and queried by grade/topic/difficulty in later slices. Add indexes only for the agreed reuse dimensions and RLS ownership paths; avoid speculative full-text or provider-trace indexes before the reuse workflow exists.

## Migration Notes

This is the first domain migration, so it must be forward-only, runnable on an empty local database, and safe for existing Auth accounts through the teacher-profile backfill. Cloudflare code rollback does not reverse Supabase changes; a production correction must be a later forward migration, not a destructive rollback.

## References

- `context/foundation/prd.md` — FR-006, FR-008, and FR-009 define unique-answer verification, approval, and reuse metadata.
- `context/foundation/roadmap.md` — F-01 bounds the work to verifiable approved-exercise persistence.
- `src/lib/supabase.ts` — Supabase SSR client convention.
- `supabase/config.toml` — local migrations and database configuration.
- `CLAUDE.md` — migration naming and RLS requirements.
- `scripts/smoke.mjs` — existing dependency-free integration-check style.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Establish Teacher Authorization

#### Automated

- [x] 1.1 The local migration creates and backfills the teacher-profile contract with `npx supabase db reset`.

#### Manual

- [x] 1.2 A newly registered local account receives the teacher role without a role value supplied by the browser.

### Phase 2: Persist Immutable Approved Exercises

#### Automated

- [ ] 2.1 The local migration creates the approved-exercise schema, required constraints, and RLS policies with `npx supabase db reset`.

#### Manual

- [ ] 2.2 In local Supabase Studio, an approved exercise visibly contains its canonical answer, grade, topic, difficulty, and verifier evidence.
- [ ] 2.3 A content correction is represented by a new approved row rather than a direct edit to the original row.

### Phase 3: Verify Database Boundaries

#### Automated

- [ ] 3.1 `npx supabase db reset` applies the migration to a clean local Supabase database.
- [ ] 3.2 The new database-test script passes all pgTAP role, RLS, constraint, and immutability cases locally.
- [ ] 3.3 `npm run lint` passes.
- [ ] 3.4 `npm run build` passes.

#### Manual

- [ ] 3.5 Using separate local teacher and student test accounts, confirm teachers share read access, only the creator can remove a record, and a student cannot retrieve exercise answers.
