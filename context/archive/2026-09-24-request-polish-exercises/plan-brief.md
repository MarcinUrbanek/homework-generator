# Polish Exercise Candidate Request — Plan Brief

> Full plan: `context/changes/request-polish-exercises/plan.md`

## What & Why

This change lets a teacher request a small batch of Polish Grade 4 mathematics exercises by topic and defined difficulty. It creates the first real generation path while keeping every result explicitly unapproved until the verification and approval work in S-02.

## Starting Point

The Astro app already has Supabase authentication, a protected dashboard, Cloudflare Workers deployment, and an approved-exercise table. It has no generation provider, supported exercise catalog, typed JSON API, candidate UI/state, or application unit-test runner.

## Desired End State

An authenticated teacher chooses one supported Grade 4 natural-number topic and one of three defined difficulty levels, then requests five candidates. Any validated subset of one to five appears in Polish with proposed answers marked `Niezweryfikowane`; the latest successful batch survives refreshes in the current tab but is not saved or approved.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Catalog breadth | Grade 4, four natural-number topics | Keeps the first market-feedback slice narrow but varied. | Plan |
| Request scope | One topic and one defined difficulty | Makes metadata and difficulty comparison unambiguous. | Roadmap / Plan |
| Batch contract | Ask for five; accept one to five | Preserves usable provider output without adding top-up orchestration. | Plan |
| Proposed answers | Visible and marked unverified | Supports teacher judgment without implying verification. | Plan |
| Provider | OpenRouter via server `fetch` | Matches the selected stack and avoids a risky Node-oriented SDK. | Tech stack / Research |
| Model selection | Required server-side model setting | Allows model changes without deployment and keeps environments explicit. | Plan |
| Resilience | 30-second attempts; one selective retry | Bounds latency while recovering transient or wholly invalid responses. | Plan |
| Browser state | Latest success in versioned `sessionStorage` | Protects paid output from refresh without candidate persistence. | Plan |
| Persistence boundary | No database writes before S-02 | Preserves F-01's approved-only exercise contract. | Archived F-01 plan |
| Cost guard | One active browser request, no durable quota | Prevents accidental duplicate clicks without adding infrastructure. | Plan |

## Scope

**In scope:**

- Grade 4 topics: natural-number addition/subtraction, multiplication/division, order of operations, and word problems.
- `Łatwy`, `Średni`, and `Trudny` guidance per topic.
- Server-only OpenRouter integration with strict structured output, validation, deduplication, timeout, and retry handling.
- Teacher-only JSON endpoint and protected Polish request/results experience.
- Current-tab recovery, deterministic service/API tests, preview smoke checks, and one manual live-provider check.

**Out of scope:**

- Answer verification, teacher approval, candidate/approved-exercise persistence, and batch save actions.
- Other grades, multi-topic requests, model selection UI, streaming, background jobs, fallback models, and durable quotas.
- Reuse, assignment, submission, scoring, and student-facing exercise views.

## Architecture / Approach

The React request island reads one shared catalog and posts a Zod-validated JSON request to an Astro API route. The route authorizes the teacher and delegates to a small OpenRouter service, which uses non-streaming strict JSON Schema, validates and deduplicates candidates, and applies the agreed timeout/retry predicates. The browser displays the typed response and stores only the latest successful batch in versioned `sessionStorage`; Supabase remains untouched in this slice.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Define generation contracts | Catalog, DTO/schemas, configuration, and test harness | Difficulty guidance may imply unsupported curriculum coverage. |
| 2. Build the secure generation boundary | Provider service, resilience, teacher authorization, and API | Endpoint-level structured-output support varies by model/provider. |
| 3. Deliver the teacher request workflow | Protected Polish UI, session recovery, smoke and live checks | Provider latency and partial results must remain understandable. |

**Prerequisites:** Local Supabase for authenticated smoke/manual tests and an OpenRouter key plus structured-output-capable model for the live check.
**Estimated effort:** ~3–5 focused sessions across 3 phases.

## Open Risks & Assumptions

- OpenRouter structured-output support is endpoint-specific; an incompatible configured model must fail clearly rather than silently changing format.
- Prompt guidance cannot prove Polish quality, answer uniqueness, or comparable difficulty; S-02 verification and teacher approval remain mandatory.
- Exact duplicate filtering does not detect semantically equivalent wording.
- No durable request quota exists, so authenticated direct API repetition remains a bounded-MVP cost risk.
- A retry can extend total wait beyond 60 seconds because the 30-second limit applies per attempt.

## Success Criteria (Summary)

- A teacher can request one Grade 4 topic/difficulty batch and receive one to five validated Polish candidates with visible unverified answers.
- Invalid, unauthorized, unconfigured, timeout, upstream, duplicate, partial, and stale-session cases behave according to the agreed typed contracts.
- Unit tests, lint, Astro checks, build, and provider-free production-preview smoke checks pass; a manual live call succeeds under `workerd`.