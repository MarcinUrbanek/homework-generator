# Frame Brief: Student homework access failure

> Framing step before /10x-plan. This document captures what is actually
> at issue, separately from what was initially assumed.

## Reported Observation

> "i have a bunch of test data in supabase but homeworks assigned are unaccesible. when logged as student my homeworks list is empty. link provided in test data returns "Blad""

## Initial Framing (preserved)

- **User's stated cause or approach**: Supabase test data is the context; no specific technical cause was asserted.
- **User's proposed direction**: Make the assigned homework accessible; no concrete fix was proposed.
- **Pre-dispatch narrowing**: Student A, Student B, and the dual-role fixture account show both symptoms.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Supabase RPC/schema/runtime** — the list and detail functions, grants, or returned data contract may not match what the running app expects.
2. **Fixture relationships and environment** — assignments may not be linked to the signed-in auth IDs through recipient rows and current class memberships, or the app and test data may use different Supabase instances.
3. **Application authorization and presentation** — role checks or error handling may prevent reads or make distinct backend outcomes look alike.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Strict RPC response-envelope schema rejects the SSR client response | On the configured local instance, direct student list/detail RPCs succeeded and their data passed row/detail schemas. The Astro API returned HTTP 500 `PERSISTENCE_FAILURE`. The SSR RPC response included a boolean `success` key that `supabaseResponseSchema.strict()` did not allow. | STRONG; reproduced and isolated |
| Fixture identity, membership, recipient, or link mismatch | Student A's local list RPC returned 10 rows and detail RPC succeeded for an assigned recipient. This rules out missing local recipient/membership rows as the cause of the reproduced failure. Other instances or stale URLs may differ. | NONE for the reproduced local failure |
| Role check or UI treating failure as an empty list | The page has separate forbidden, unavailable, error, and successful-empty states. The reported list text is the error state, and the authenticated API reaches the service failure path. | NONE for the reproduced local failure |

## Narrowing Signals

Decisive observations from the user that narrowed the hypothesis space:

- Student A, Student B, and the dual-role account all reproduce the symptoms.
- The list shows **“Nie udało się wczytać zadań domowych”**, rather than **“Nie masz jeszcze zadań domowych”**.
- The provided detail link shows **“Błąd”**.
- Direct local RPC calls succeeded (10 list rows and valid detail); list and detail payload validation passed.
- The app's authenticated list and detail APIs returned HTTP 500 before the change. The SSR response contained `success` alongside `error`, `data`, `count`, `status`, and `statusText`; the strict envelope parser rejected the extra key.

## Cross-System Convention

The server-rendered list and detail routes call Supabase RPCs through a typed service. The list distinguishes a valid empty result from a thrown RPC/validation failure. In the tested local setup, the SSR client adds a `success` field to its RPC response, and the service's strict envelope parser rejected it. This caused both valid reads to surface as persistence failures.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the shared homework RPC adapter rejects the SSR client's response envelope because it contains a valid `success` field not admitted by the strict schema.

This was reproduced against the local app and Supabase: authenticated direct RPCs returned valid list/detail data, while the app APIs returned HTTP 500 `PERSISTENCE_FAILURE`. The strict response envelope rejected the SSR-only `success` key before row validation. The existing fixture records and database functions work in the tested local instance.

## Confidence

- **HIGH** — the failing app API and successful direct RPCs were reproduced locally, and the unexpected strict-schema key was identified.

## What Changes for /10x-plan

The change is implementing the shared RPC-envelope compatibility fix and a regression test. No assignment reseeding or migration change is needed for the reproduced local issue.

## References

- Source: `../../../src/pages/homework/index.astro:16-37`; `../../../src/components/homework/StudentHomeworkList.astro:24-54`
- Source: `../../../src/pages/homework/[assignmentId].astro:12-47,61-103`; `../../../src/lib/services/student-homework.ts:29-38,67-96,110-185`; `../../../src/lib/services/student-homework.test.ts:120-151`
- Source: `../../../supabase/migrations/20261009145925_add_homework_submissions.sql:139-291`; `../../../scripts/seed-homework-manual-test.mjs:26-40,157-169,232-244`
- Investigation tasks: RPC migration check (`772d9ecc-6b35-4df6-8a66-7cc9ae8bff93`); fixture recipient links (`2fc090fe-5d12-4310-94ad-699c82793c74`); app error presentation (`ce51d115-efbc-4351-a519-1f3467475a4b`)
