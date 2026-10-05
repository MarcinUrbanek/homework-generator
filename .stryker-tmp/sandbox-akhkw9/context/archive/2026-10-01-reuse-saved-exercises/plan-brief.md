# Reuse Saved Exercises — Plan Brief

> Full plan: `context/changes/reuse-saved-exercises/plan.md`

## What & Why

This change makes the approved exercise pool discoverable after the generation and approval session ends. Teachers can find durable Grade 4 exercises by topic, optionally narrow them by difficulty, and inspect the canonical answer and metadata before a later assignment workflow consumes their stable IDs.

## Starting Point

Approved exercises already persist as immutable, evidence-backed rows in a teacher-shared, student-denied Supabase table. The application has no retrieval query, read API, browser page, or navigation for that pool, and the database deliberately deferred reuse indexes until this slice.

## Desired End State

An authenticated teacher opens a Polish saved-exercise page, submits Grade 4/topic and optional-difficulty filters, and receives the newest matching records in stable pages of 20. Exercise text, canonical answer, metadata, and approval date are visible; transient failures preserve the last successful list and its applied filters.

The retrieval boundary provides stable exercise IDs for future assignment while creating no homework, collection, or temporary selection workflow.

## Key Decisions Made

| Decision               | Choice                                                   | Why                                                                                  |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Meaning of reuse       | Browse the durable approved pool                         | Delivers FR-009 now without inventing a throwaway pre-assignment artifact.           |
| Discovery filters      | Grade 4 + topic, optional difficulty                     | Preserves the required lookup and prepares the later one-difficulty-bucket flow.     |
| Visible details        | Text, canonical answer, topic, difficulty, approval date | Gives teachers enough information to judge reuse without technical evidence clutter. |
| Ordering               | Newest approved first, ID tie-break                      | Makes database order deterministic and recent material easy to find.                 |
| Page behavior          | 20 records plus Load more                                | Bounds database and rendering work while preserving browsing context.                |
| Query trigger          | Explicit `Pokaż zadania` action                          | Avoids requests while draft filters change and gives errors a clear action boundary. |
| Failure behavior       | Preserve visible results and applied filters             | A transient failure never destroys useful context or mislabels old results.          |
| Pool access            | All teachers share-read; students denied                 | Retains the completed RLS contract and cross-teacher pool.                           |
| Retrieval architecture | Security-invoker SQL function behind a typed API         | Supports composite cursor pagination while keeping RLS authoritative.                |

## Scope

**In scope:**

- Query indexes and an RLS-preserving retrieval function for topic-wide and difficulty-refined searches.
- A teacher-only `GET` API with strict filters, filter-bound cursor, page size 20, and Polish errors.
- A protected saved-exercise page, dashboard entry point, explicit filters, result cards, empty/error states, and Load more.
- pgTAP, API, component, full-suite, smoke, responsive, keyboard, accessibility, and retained visual verification.

**Out of scope:**

- Homework assignment, student selection, saved collections, favorites, and browser-only selection.
- Full-text/semantic search, random ranking, authorship filters, ratings, and duplicate detection.
- Other grades/topics, pool editing/deletion, verifier evidence, and unrelated dashboard restyling.

## Architecture / Approach

A forward migration adds indexes and a security-invoker PostgreSQL function ordered by `(approved_at, id)` descending. A typed Astro endpoint validates teacher access, filters, rows, and an opaque filter-bound cursor, requesting 21 rows to return 20 plus a next cursor. A React controller separates draft from applied filters and preserves the last successful result state through failures; a presentational view and development-only gallery render every named state with existing semantic components.

## Phases at a Glance

| Phase                 | What it delivers                                             | Key risk                                                    |
| --------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| 1. Retrieval contract | Indexed, RLS-preserving filtering and stable keyset pages    | A function ownership mistake could bypass student denial.   |
| 2. Typed read API     | Validated query, cursor, DTO, and error boundary             | Cursor/filter mismatch could skip or mix records.           |
| 3. Teacher browser    | Protected page, explicit filters, details, and Load more     | Draft filters must never relabel preserved old results.     |
| 4. Verification       | State gallery, smoke gates, and retained responsive evidence | Error and pagination states can be missed without fixtures. |

**Prerequisites:** Completed F-01 and S-02, Docker with local Supabase for pgTAP, and the existing teacher account flow.
**Estimated effort:** About 4–6 focused implementation sessions across 4 phases, plus human responsive/accessibility verification.

## Open Risks & Assumptions

- The initial pool may be small, but the contract deliberately avoids unbounded responses and offset drift.
- Approval timestamps are not unique, so the exercise ID remains a mandatory cursor tie-breaker.
- Existing legacy rows with null verification provenance remain valid approved exercises and are included.
- The API cursor is opaque and validated, not a security token; RLS remains the authorization boundary.
- Future S-06 consumes stable IDs but may introduce its own assignment-specific difficulty and selection state.

## Success Criteria (Summary)

- A teacher can reliably find shared approved exercises by Grade 4/topic, optionally refine by difficulty, inspect answers, and load stable additional pages.
- Students cannot retrieve pool rows or canonical answers, and the API exposes no creator or verifier details.
- Empty, loading, populated, pagination, and failure-preservation states pass database, unit, build, smoke, responsive, keyboard, accessibility, and visual gates.
