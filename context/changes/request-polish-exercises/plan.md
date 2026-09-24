# Polish Exercise Candidate Request Implementation Plan

## Overview

Deliver the first protected teacher workflow for requesting Polish Grade 4 mathematics exercise candidates. The change defines a small supported catalog, integrates OpenRouter through a server-only service, returns validated but explicitly unapproved candidates, and gives the teacher a responsive request-and-review experience without persisting candidate data before S-02.

## Current State Analysis

The application has cookie-based Supabase authentication, one protected dashboard, and redirect-oriented auth forms, but no exercise-generation page, typed JSON API, generation provider, or application test runner. The completed F-01 foundation stores only approved and verified exercises; it deliberately leaves candidate generation, the supported metadata catalog, and batch review to later slices. OpenRouter is the selected server-side provider, while Cloudflare Workers remains the target runtime.

## Desired End State

An authenticated teacher can open a Polish exercise-request page, choose one supported Grade 4 natural-number topic and one defined difficulty, and request five candidates. The application calls a configured OpenRouter model from the server, validates and deduplicates the response, and displays any valid subset of one to five candidates with proposed answers clearly marked `Niezweryfikowane`. The latest successful batch survives refreshes in the current tab only; no candidate is approved or written to Supabase.

### Key Discoveries:

- `src/middleware.ts:4-17` protects routes by path prefix and resolves the current Supabase user into `Astro.locals`.
- `src/pages/api/auth/signin.ts:1-22` establishes the Astro `APIRoute` pattern but uses untyped form data and redirects, so generation needs the repository's first typed JSON boundary.
- `supabase/migrations/20260923120000_create_verified_exercise_persistence.sql:57-73` requires content, canonical answer, grade, topic, and difficulty for approved exercises but intentionally does not constrain their vocabulary.
- `context/archive/2026-09-23-verified-exercise-persistence/plan.md:23-27` excludes candidate persistence, generation, verification execution, and exercise HTTP/UI surfaces from F-01.
- `context/foundation/infrastructure.md:64-96` identifies `workerd` compatibility and CPU limits as provider-integration risks and recommends a small standards-based service module.
- OpenRouter's API documentation supports non-streaming strict JSON Schema responses, while noting that support varies by model endpoint and should be constrained with `provider.require_parameters`.

## What We're NOT Doing

- Verifying answer uniqueness, approving candidates, or saving exercises; those remain S-02 responsibilities.
- Adding candidate tables, migrations, cross-session recovery, or server-side batch state.
- Supporting grades other than Grade 4, multiple topics in one request, or curriculum-wide coverage.
- Letting teachers select a model, adding automatic model fallback, streaming output, background jobs, or a durable request quota.
- Building exercise reuse, assignment, submission, scoring, or student-facing exercise views.
- Treating proposed model answers or generated difficulty as verified evidence.

## Implementation Approach

Define one shared source of truth for the supported catalog and request/response schemas, then isolate OpenRouter behind a standards-based service using server-only configuration and `fetch`. The service requests five structured candidates, validates the normalized response with Zod, removes exact duplicates after case-insensitive whitespace normalization, and returns any non-empty valid subset. It retries once only for a timeout, HTTP 429, HTTP 5xx, or a response from which zero valid candidates survive; a subset of one to four is returned immediately.

Expose that service through a teacher-authorized JSON endpoint and consume it from a React island hosted by a protected Astro page. The browser permits one active request, preserves selections and the previous successful batch on failure, and stores only the latest successful response in versioned `sessionStorage`. Provider behavior is covered with deterministic fakes in Vitest; CI never spends OpenRouter credits, and one manual live-provider pass verifies the `workerd` runtime.

## Critical Implementation Details

Each provider attempt has its own 30-second abort deadline, so one retry can make the complete operation last slightly over 60 seconds. Provider configuration must remain optional at build time so CI can build without secrets, but the generation endpoint must fail with a typed Polish `503` response when `OPENROUTER_API_KEY` or `OPENROUTER_MODEL` is absent. Never log prompts, proposed answers, API keys, or raw provider response bodies.

## Phase 1: Define Generation Contracts

### Overview

Create the stable catalog, shared DTO/schema boundary, server configuration, and focused test harness that every later layer uses.

### Changes Required:

#### 1. Validation and test dependencies

**File**: `package.json`, `package-lock.json`, `vitest.config.ts`

**Intent**: Add the smallest established dependencies needed to validate untrusted API/model data and test deterministic domain/service behavior, including the browser-like environment the session-storage hook test needs.

**Contract**: Add Zod as a runtime dependency, Vitest plus a `happy-dom` (or `jsdom`) DOM environment as development dependencies, and a non-watch `npm run test` script. Add `vitest.config.ts` defaulting to the `node` test environment, with a `// @vitest-environment happy-dom` pragma (or equivalent per-file override) on `use-session-exercise-batch.test.ts` so only that suite gets `sessionStorage`/`window`. All test files import `describe`/`it`/`expect`/`vi` explicitly from `"vitest"` — no injected globals, so `eslint.config.js`'s existing type-checked rules apply unchanged. Preserve the existing lint, build, smoke, and database-test commands.

#### 2. Shared exercise-generation types and schemas

**File**: `src/types.ts`, `src/lib/exercises/schemas.ts`

**Intent**: Give the browser, API route, and provider service one typed contract while validating every untrusted boundary at runtime.

**Contract**: Define a request with grade `4`, one catalog topic slug, and difficulty `easy | medium | hard`. Define a transient candidate with an ID, Polish exercise text, proposed canonical answer, copied request metadata, and approval status `unverified`. Define success metadata for `requestedCount: 5`, `validCount: 1..5`, and optional `partial_batch`, plus a stable error envelope with a code and Polish message.

#### 3. Grade 4 catalog and difficulty guidance

**File**: `src/lib/exercises/catalog.ts`, `src/lib/exercises/catalog.test.ts`

**Intent**: Establish the normalized metadata values that S-01 emits and F-01 will later persist after verification and approval.

**Contract**: Expose Polish labels and generation guidance for Grade 4 natural numbers across four topics: addition/subtraction, multiplication/division, order of operations, and word problems. Each topic supplies distinct `easy`, `medium`, and `hard` criteria; the UI and prompt consume this catalog rather than duplicating option lists.

#### 4. Server-only provider configuration

**File**: `astro.config.mjs`, `.env.example`, `src/lib/config-status.ts`

**Intent**: Add explicit OpenRouter API-key and model settings while preserving builds and local UI when provider configuration is missing.

**Contract**: Declare optional-at-build, server-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` environment fields, document placeholders, and extend the existing Polish configuration-status banner. Generation treats both values as required at request time.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes catalog and schema tests for every supported topic/difficulty combination and rejects unsupported metadata or malformed envelopes.
- `npm run lint` passes with the new contracts and configuration.
- `npx astro check` passes with strict TypeScript enabled.

#### Manual Verification:

- The Grade 4 catalog's Polish labels and all twelve topic/difficulty guidance combinations match the approved natural-number scope and do not imply broader curriculum coverage.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 2: Build the Secure Generation Boundary

### Overview

Implement the provider adapter, resilience and partial-batch rules, teacher authorization, and typed HTTP endpoint independently of the UI.

### Changes Required:

#### 1. OpenRouter exercise-generation service

**File**: `src/lib/services/openrouter-exercise-generator.ts`, `src/lib/services/openrouter-exercise-generator.test.ts`

**Intent**: Keep provider-specific request construction and response handling out of the route and make all expensive/error-prone behavior deterministic under test.

**Contract**: Send a non-streaming `POST` to OpenRouter chat completions using `OPENROUTER_MODEL`, bearer authentication, strict JSON Schema, and `provider.require_parameters: true`. Prompt for exactly five Polish exercises matching the catalog guidance. Apply a 30-second `AbortController` deadline per attempt; retry once for timeout, 429, 5xx, or zero surviving candidates. Validate non-empty text/answers, normalize metadata from the trusted request, deduplicate exercise text by trimmed/collapsed/case-insensitive equality, return one to five valid candidates without retrying a non-empty short batch, and map provider failures to stable internal error codes.

#### 2. Teacher authorization helper

**File**: `src/lib/services/teacher-authorization.ts`, `src/lib/services/teacher-authorization.test.ts`

**Intent**: Reuse one server-side check for teacher-only page/API behavior rather than treating authentication alone as authorization.

**Contract**: Resolve the current user from `Astro.locals`, query only that user's `profiles.role` through the request-scoped Supabase client, and distinguish unauthenticated, non-teacher, unavailable-profile, and authorized-teacher outcomes without exposing profile data. This duplicates, rather than calls, the existing `public.is_teacher()` SQL function (used only inside RLS policies today) because that function's single boolean cannot express the unavailable-profile case; a future change to the role model must update both.

#### 3. Typed generation endpoint

**File**: `src/pages/api/exercises/request.ts`, `src/pages/api/exercises/request.test.ts`

**Intent**: Expose the generation service through a narrow JSON API that rejects invalid or unauthorized requests before spending provider credits.

**Contract**: Add non-prerendered `POST /api/exercises/request`. Return `400` for invalid JSON/metadata, `401` for no session, `403` for a non-teacher, `503` for missing provider configuration, `502` for unusable provider output/upstream failure, and `504` after exhausted timeouts. A successful `200` response contains `requestedCount: 5`, `validCount`, one to five transient candidates, and `partial_batch` only when fewer than five survive. Do not return raw provider errors or secrets.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes provider-service cases for five valid candidates, non-retried subsets of one to four, duplicate filtering, zero-result retry, retryable HTTP failures, timeout exhaustion, malformed envelopes, and non-retryable failures.
- `npm run test` passes endpoint and authorization cases for `400`, `401`, `403`, `503`, `502`, `504`, complete success, and partial success without making live OpenRouter calls.
- `npm run lint`, `npx astro check`, and `npm run build` pass in the Cloudflare-targeted project without OpenRouter secrets present.

#### Manual Verification:

- Against the local server with provider settings absent, an authenticated teacher receives the Polish configuration error while the response and logs expose no secret or raw provider payload.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual check before proceeding.

---

## Phase 3: Deliver the Teacher Request Workflow

### Overview

Add the protected Polish page, request/results interaction, tab-session recovery, dashboard entry point, and end-to-end verification.

### Changes Required:

#### 1. Protected exercise-request route and navigation

**File**: `src/middleware.ts`, `src/pages/dashboard.astro`, `src/pages/exercises/request.astro`

**Intent**: Give authenticated teachers a discoverable entry point while retaining the existing Astro page shell and server-side access boundary.

**Contract**: Protect the `/exercises` route prefix, link the dashboard to `/exercises/request`, and render a Polish page that authorizes the teacher before hydrating the interactive request component. Non-teachers receive an access-denied response rather than the form.

#### 2. Request and candidate-review components

**File**: `src/components/exercises/RequestExercisesForm.tsx`, `src/components/exercises/ExerciseCandidateList.tsx`

**Intent**: Let a teacher choose supported metadata, understand request progress/errors, and scan generated content efficiently before S-02 adds verification and approval actions.

**Contract**: Render Grade 4 and one catalog topic, a three-level difficulty control, and a generate command in Polish. Permit one active request, preserve selections and the prior successful batch after failure, and display a stable loading state. Show every candidate's exercise text and proposed answer with `Niezweryfikowane`; show `Wygenerowano X z 5` for partial success and never expose approval/save actions.

#### 3. Current-tab batch persistence

**File**: `src/components/hooks/use-session-exercise-batch.ts`, `src/components/hooks/use-session-exercise-batch.test.ts`

**Intent**: Protect paid output from accidental refreshes without introducing candidate persistence or cross-session data.

**Contract**: Store one versioned latest-successful-batch payload in `sessionStorage`, validate it before restoration, replace it only after a successful request, and provide a clear action. Ignore and remove malformed or incompatible stored values; closing the tab ends recovery.

#### 4. Preview smoke coverage and operational documentation

**File**: `scripts/smoke.mjs`, `README.md`

**Intent**: Prove the protected page and API configuration boundary in the production-preview runtime and document local/live provider setup without using provider credits in CI.

**Contract**: Extend the dependency-free smoke flow to cover anonymous redirect, authenticated teacher page access, invalid request rejection, and missing-provider configuration response. Document `.dev.vars` values, the structured-output model requirement, local commands, and the manual live-provider check; do not place real OpenRouter credentials in CI or committed files.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes session-storage restoration, replacement, clearing, and invalid-version cleanup cases.
- `npm run smoke` passes the protected page and generation API boundary against the production preview without a live OpenRouter call.
- `npm run lint`, `npx astro check`, and `npm run build` pass after the complete UI workflow is wired.

#### Manual Verification:

- On desktop and mobile, a teacher can request Grade 4 candidates through a fully Polish interface with no overlapping controls, unstable layout, or inaccessible loading/error state.
- With a structured-output-capable `OPENROUTER_MODEL` configured, the `workerd` preview returns one to five Polish candidates within the agreed per-attempt timeout and labels every proposed answer `Niezweryfikowane`.
- Refreshing restores the latest successful batch in the same tab, clearing removes it, and a later failed request leaves the previous successful batch visible.
- A student profile cannot open the request workflow or invoke its API successfully.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual checks before considering the change ready for review.

## Testing Strategy

### Unit Tests:

- Exercise every catalog enum and topic/difficulty mapping, plus rejection of unsupported grades, topics, difficulty values, empty text, and malformed API/provider envelopes.
- Drive the OpenRouter service with fake `fetch` responses and fake timers/abort signals to prove exact retry, timeout, deduplication, and partial-batch predicates without external calls.
- Test authorization outcomes and the endpoint's status/error mapping with injected service/client doubles.
- Test versioned session serialization as a pure browser-state boundary, including corrupt and obsolete payload cleanup.

### Integration Tests:

- Run the existing production-preview smoke flow with local Supabase to prove anonymous protection, authenticated teacher page access, invalid request handling, and missing provider configuration under `workerd`.
- Keep CI provider-free; a live model call is a manual environment check, not an automated test dependency.

### Manual Testing Steps:

1. Start local Supabase, configure a structured-output-capable OpenRouter model in `.dev.vars`, and run the Cloudflare development or preview server.
2. Sign in as a teacher, open the request page from the dashboard, and inspect all topic and difficulty labels in Polish.
3. Generate each selected topic/difficulty combination as needed to confirm Polish wording, non-empty proposed answers, and visibly unverified status.
4. Simulate or observe a short valid batch and confirm the page reports the exact `X z 5` count without automatically topping it up.
5. Refresh, clear the current-tab batch, and trigger a failed request to verify the agreed state-preservation behavior.
6. Change a local fixture profile to student and confirm both the page and API deny access.

## Performance Considerations

The browser permits one active request, each provider attempt is aborted after 30 seconds, and at most one retry is allowed. Generation is non-streaming and bounded to five requested candidates. The slice adds no durable quota or cache, so OpenRouter usage/cost and Worker request duration should be observed during the live check before wider access; repeated direct API calls by an authenticated teacher remain a known MVP risk.

## Migration Notes

No database migration or persisted-data backfill is required. Local provider values belong in gitignored `.dev.vars`; production `OPENROUTER_API_KEY` must be provisioned as a Cloudflare secret and `OPENROUTER_MODEL` as a server-only environment setting. Worker code rollback does not affect OpenRouter configuration, so configuration changes require their own post-change generation check.

## References

- `context/foundation/prd.md` — FR-004, FR-005, and FR-007 define the supported catalog, request inputs, and Polish content requirement.
- `context/foundation/roadmap.md` — S-01 bounds the outcome to requesting unapproved candidates.
- `context/archive/2026-09-23-verified-exercise-persistence/plan.md` — establishes the approved-only persistence boundary inherited by S-01.
- `src/middleware.ts` — current protected-route and request-user convention.
- `src/pages/api/auth/signin.ts` — current Astro API route convention.
- `src/lib/config-status.ts` — current optional server-configuration reporting pattern.
- `scripts/smoke.mjs` — dependency-free production-preview integration style.
- `context/foundation/infrastructure.md` — Cloudflare Workers provider-integration and CPU constraints.
- `https://openrouter.ai/docs/api/reference/overview` — chat-completions request, response, headers, and error contract.
- `https://openrouter.ai/docs/features/structured-outputs` — strict JSON Schema and endpoint capability requirements.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Define Generation Contracts

#### Automated

- [x] 1.1 `npm run test` passes catalog and schema tests for every supported topic/difficulty combination and rejects unsupported metadata or malformed envelopes. — b22411d
- [x] 1.2 `npm run lint` passes with the new contracts and configuration. — b22411d
- [x] 1.3 `npx astro check` passes with strict TypeScript enabled. — b22411d

#### Manual

- [x] 1.4 The Grade 4 catalog's Polish labels and all twelve topic/difficulty guidance combinations match the approved natural-number scope and do not imply broader curriculum coverage. — b22411d

### Phase 2: Build the Secure Generation Boundary

#### Automated

- [x] 2.1 `npm run test` passes provider-service cases for five valid candidates, non-retried subsets of one to four, duplicate filtering, zero-result retry, retryable HTTP failures, timeout exhaustion, malformed envelopes, and non-retryable failures. — 01fd360
- [x] 2.2 `npm run test` passes endpoint and authorization cases for `400`, `401`, `403`, `503`, `502`, `504`, complete success, and partial success without making live OpenRouter calls. — 01fd360
- [x] 2.3 `npm run lint`, `npx astro check`, and `npm run build` pass in the Cloudflare-targeted project without OpenRouter secrets present. — 01fd360

#### Manual

- [x] 2.4 Against the local server with provider settings absent, an authenticated teacher receives the Polish configuration error while the response and logs expose no secret or raw provider payload. — 01fd360

### Phase 3: Deliver the Teacher Request Workflow

#### Automated

- [x] 3.1 `npm run test` passes session-storage restoration, replacement, clearing, and invalid-version cleanup cases.
- [x] 3.2 `npm run smoke` passes the protected page and generation API boundary against the production preview without a live OpenRouter call.
- [x] 3.3 `npm run lint`, `npx astro check`, and `npm run build` pass after the complete UI workflow is wired.

#### Manual

- [x] 3.4 On desktop and mobile, a teacher can request Grade 4 candidates through a fully Polish interface with no overlapping controls, unstable layout, or inaccessible loading/error state.
- [x] 3.5 With a structured-output-capable `OPENROUTER_MODEL` configured, the `workerd` preview returns one to five Polish candidates within the agreed per-attempt timeout and labels every proposed answer `Niezweryfikowane`.
- [x] 3.6 Refreshing restores the latest successful batch in the same tab, clearing removes it, and a later failed request leaves the previous successful batch visible.
- [x] 3.7 A student profile cannot open the request workflow or invoke its API successfully.