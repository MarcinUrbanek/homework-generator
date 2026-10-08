# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-07

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in an area"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/` (32
commits in the 30 days ending 2026-10-03; docs, archive, fixtures,
generated/build output, lockfiles, and snapshots excluded).

## 2. Risk Map

Risks are ordered by impact × likelihood. Sources identify evidence that
raised each scenario, never a presumed code location.

| #   | Risk (failure scenario)                                                                                                                                                        | Impact | Likelihood | Source (evidence — not anchor)                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A student accesses another student's data or teacher-only actions                                                                                                              | High   | High       | PRD Access Control and guardrails; interview Q1, Q3, Q4; hot-spot dir `src/pages/api/` (23 changes/30d)                                   |
| 2   | Repeated generation requests exhaust provider budget or availability                                                                                                           | High   | Medium     | interview Q1, Q3; archived request-polish-exercises slice; hot-spot dir `src/lib/services/` (21 changes/30d)                              |
| 3   | An ambiguous or incorrectly verified exercise reaches the approved pool                                                                                                        | High   | High       | PRD FR-006 and guardrails; archived approve-first-exercise-pool and verifier-answer-equivalence slices; interview Q3                      |
| 4   | Invitation status before enrollment is misclassified or discloses recipient data, or acceptance enrolls the wrong account, accepts an ineligible invitation, or permits replay | High   | Medium     | roadmap S-05; archived invite-students-to-class and join-teacher-managed-class slices; interview Q4                                       |
| 5   | Provider timeout or partial failure loses settled work or reports misleading success                                                                                           | Medium | High       | archived request-polish-exercises and approve-first-exercise-pool slices; interview Q3; hot-spot dir `src/lib/services/` (21 changes/30d) |
| 6   | Distinct assignment or 50% scoring uses the wrong exercise or answer state                                                                                                     | High   | Medium     | PRD US-01 and FR-010–FR-013; roadmap S-06 and S-07                                                                                        |

Impact is High when users lose access, privacy, money, or trustworthy
results; Medium when a feature degrades with a workaround. Likelihood is
High for weekly churn or an explicit recurring concern, Medium for an
occasional or upcoming surface, and Low for stable rare paths.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                                                                                                 | Must challenge                                                                                            | Context `/10x-research` must ground                                                                                                 | Likely cheapest layer                 | Anti-pattern to avoid                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| #1   | Every forbidden role or ownership request is denied without leaking protected data                                                                                                                                                                                          | Authentication implies authorization                                                                      | role/session shape, ownership boundary, API and database enforcement                                                                | API integration + database            | happy-path-only role tests                                                                     |
| #2   | Repeated costly requests are bounded and rejection is explicit without triggering provider work                                                                                                                                                                             | A disabled UI control limits server calls                                                                 | caller identity, quota semantics, concurrency, provider boundary                                                                    | API integration                       | client-only assertions                                                                         |
| #3   | Approval requires independent, uniquely answerable evidence from an authoritative source                                                                                                                                                                                    | Two agreeing model outputs prove correctness                                                              | verifier contract, immutable evidence, answer oracle, approval boundary                                                             | unit + integration + contract         | expected values copied from production logic                                                   |
| #4   | Before enrollment, invitation states receive the correct non-disclosing status; at acceptance, the database revalidates expiry, sent delivery, recipient, and redemption state, atomically creates membership, permits same-user retry, and denies another account's replay | A safe status page or successful preview authorizes enrollment; token rotation alone proves replay safety | pre-enrollment status classification and auth continuation, plus the atomic S-05 acceptance boundary and persisted redemption state | service/handler tests + focused pgTAP | treating status rejection as proof of acceptance safety, or testing only successful acceptance |
| #5   | Per-item settled outcomes survive provider failures and failures are represented honestly                                                                                                                                                                                   | A final 200 means every candidate succeeded                                                               | timeout/retry boundary, per-item state, error translation                                                                           | service integration                   | over-mocking internal modules                                                                  |
| #6   | Assignment count, distinctness, difficulty, and score threshold use approved immutable state                                                                                                                                                                                | The current exercise pool equals the assigned snapshot                                                    | persisted assignment, valid-answer source, ordering and threshold boundaries                                                        | domain unit + database integration    | copied scoring calculation                                                                     |

## 3. Phased Rollout

Each row is a discrete rollout phase. Status is reconciled from its change
folder and moves through the fixed orchestrator vocabulary.

| #   | Phase name                              | Goal (one line)                                                                                                                | Risks covered | Test types                         | Status      | Change folder                                   |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------------------- | ----------- | ----------------------------------------------- |
| 1   | Authorization and invitation boundaries | Prove role/ownership denials and non-disclosing pre-enrollment invitation status; S-05 separately covers acceptance and replay | #1, #4        | API integration + database         | complete    | testing-authorization-and-invitation-boundaries |
| 2   | Exercise trust and provider resilience  | Prove costly calls are bounded, approval evidence is trustworthy, and partial failures preserve settled work                   | #2, #3, #5    | unit + integration + contract      | not started | —                                               |
| 3   | Assignment and scoring contracts        | Prove distinct fair assignments and the 50% result use immutable approved answers                                              | #6            | domain unit + database integration | not started | —                                               |
| 4   | Critical-flow quality gates             | Enforce the shipped risk coverage and a minimal full-flow signal before production                                             | cross-cutting | CI gates + critical-flow smoke/e2e | not started | —                                               |

## 4. Stack

The test base is **meaningful**: Vitest is configured and 25 application
tests are spread across API routes, services, domain helpers, hooks, and
React components; five pgTAP database suites cover Supabase behavior.

| Layer                         | Tool                                          | Version             | Notes                                                                                                                          |
| ----------------------------- | --------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| unit + integration            | Vitest                                        | 5.0.1               | Node by default; individual component tests opt into happy-dom as needed                                                       |
| database                      | Supabase CLI + pgTAP                          | Supabase CLI 2.23.4 | Local database suites run separately from Vitest                                                                               |
| API mocking                   | Vitest mocks                                  | 5.0.1               | Existing baseline; Phase 2 must verify that mocks remain at external boundaries                                                |
| critical-flow smoke           | Node smoke script                             | project-local       | Existing auth-flow smoke runs against a server; wider critical homework flow is deferred to Phase 4                            |
| optional runtime verification | Playwright browser tool — checked: 2026-10-03 | n/a                 | Available in the current agent session; do not use when API, database, or deterministic browser assertions give cheaper signal |

**Stack grounding tools (current session):**

- Docs: none — no Context7, Astro, Vitest, Cloudflare, or Supabase docs MCP available; local manifests and configs used; checked: 2026-10-03
- Search: none — no Exa.ai or web-search MCP available; checked: 2026-10-03
- Runtime/browser: Playwright browser tool — available for later critical-flow verification, not used during strategy discovery; checked: 2026-10-03
- Provider/platform: none — no GitHub, Cloudflare, Supabase, or database provider MCP exposed; checked: 2026-10-03

## 5. Quality Gates

Every planned gate is owned by Phase 4; no new hook, visual, or AI-native
gate is justified because deterministic tests give cheaper signal for the
ranked risks.

| Gate                      | Where      | Required?                 | Catches                                                         |
| ------------------------- | ---------- | ------------------------- | --------------------------------------------------------------- |
| lint + production build   | local + CI | required                  | syntax, type-aware lint, and SSR build drift                    |
| Vitest unit + integration | local + CI | required after §3 Phase 4 | domain, API, and provider-boundary regressions                  |
| Supabase database tests   | local + CI | required after §3 Phase 4 | RLS, ownership, token, and persistence regressions              |
| critical-flow smoke/e2e   | CI on PR   | required after §3 Phase 4 | broken role-separated homework paths across deployed boundaries |

## 6. Cookbook Patterns

How to add tests by behavior. Each entry is completed by the rollout phase
that establishes its canonical pattern.

### 6.1 Adding a role or ownership denial test

- For each teacher-only handler, sign in as a student and assert the established generic `403` response plus that route-specific protected work was not called. Keep the unauthenticated `401` case distinct. In one representative route, use the production `authorizeTeacher` with a student session and a role lookup that returns no teacher row; injected non-teacher results in the other route tests isolate each handler guard.
- Prove persisted authorization separately with pgTAP under `authenticated` JWT claims: student-only class creation and invitation preparation are denied; another teacher sees no owner-class rows and invitation preparation raises `42501`; rejected preparation leaves no invitation rows. Handler mocks do not prove RLS or security-definer enforcement.
- Verify with `npm test -- src/pages/api/classes/create.test.ts src/pages/api/classes/list.test.ts src/pages/api/classes/invite.test.ts src/pages/api/exercises/request.test.ts src/pages/api/exercises/verify.test.ts src/pages/api/exercises/approve.test.ts src/pages/api/exercises/saved.test.ts src/lib/services/teacher-authorization.test.ts` and `npm run db:test`.

### 6.2 Adding an invitation lifecycle test

- Test `resolveClassInvitationStatus` as a coarse public contract: unknown and rotated tokens are `invalid`, expired tokens are `expired`, pending or failed delivery is `unavailable`, and a different authenticated email is `email-mismatch`. Assert that results never contain the normalized recipient. Keep authentication-continuation tests focused on preserving the complete tokenized same-origin return path.
- Use pgTAP for persisted lifecycle facts: seven-day expiry, digest replacement and pending state on refresh, current delivery-state recording, and rejection of stale delivery writes. These persistence checks and the status-service tests are separate boundaries, not a live HTTP-to-database integration.
- Verify with `npm test -- src/lib/services/class-invitation-status.test.ts src/pages/api/auth/signin.test.ts src/pages/api/auth/signup.test.ts src/lib/auth/return-destination.test.ts` and `npm run db:test`.
- Phase 1 tests only the pre-enrollment status contract and authentication continuation; they do not prove enrollment safety or replay protection. S-05 adds separate acceptance-boundary coverage: the database revalidates expiry, delivery, recipient, and redemption state while creating membership atomically; pgTAP verifies same-user retry and denial of wrong-recipient and replay attempts.

### 6.3 Adding a provider-boundary or verification test

- TBD — see §3 Phase 2 for timeout, partial-result, resource-bound, and independent-oracle patterns.

### 6.4 Adding an assignment or scoring test

- TBD — see §3 Phase 3 for distinctness, immutable-answer, and 50% threshold patterns.

### 6.5 Adding a critical-flow test or gate

- TBD — see §3 Phase 4 for server-backed smoke/e2e location, command, and CI policy.

### 6.6 Per-rollout-phase notes

- Phase implementations append two or three lines here when research or delivery changes the canonical testing approach.
- Phase 1 shipped separate route-level denial/no-work tests (including one real authorizer composition) and authenticated-claim pgTAP checks for role and ownership boundaries; run the §6.1 commands for those layers.
- Phase 1 shipped role/ownership denials and pre-enrollment invitation status/auth-continuation tests. These do not prove enrollment or replay safety.
- S-05 separately shipped the atomic acceptance operation and pgTAP coverage for acceptance-time eligibility, membership creation, same-user retry, wrong-recipient denial, and replay denial. Keep these guarantees attributed to S-05 rather than retroactively expanding Phase 1's test scope.

## 7. What We Deliberately Don't Test

- **Exhaustive UI snapshots** — churn is high and behavior-focused assertions provide better signal. Re-evaluate only if a stable visual contract becomes a top product risk. (Source: interview Q5.)
- **shadcn internals** — the project tests its integration and behavior, not third-party component implementation. Re-evaluate after local component forks or overrides. (Source: interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-03
- Risk #4 and Phase 1 rollout status reconciled with roadmap S-05: 2026-10-07
- Stack versions last verified: 2026-10-03
- AI-native tool references last verified: 2026-10-03

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework or test runner),
- §7 negative-space no longer matches what the team believes.
