# Dashboard Homepage Implementation Plan

## Overview

Serve the existing authenticated, role-aware dashboard at `/` instead of `/dashboard`. Anonymous visitors to the homepage must sign in; the retired dashboard URL must return 404 for every session state. Preserve the panel's current appearance, role behavior, and authentication continuations.

## Current State Analysis

The [change identity](./change.md) requests the dashboard as the logged-in starting page. The [research](./research.md) records two explicit user decisions: anonymous `/` redirects to sign-in, and `/dashboard` returns 404 rather than redirecting.

- [index.astro:1](../../../src/pages/index.astro#L1) renders the starter welcome page.
- [dashboard.astro:6](../../../src/pages/dashboard.astro#L6) loads account roles and renders student and teacher tools independently, plus shared class navigation and sign-out.
- [middleware.ts:4](../../../src/middleware.ts#L4) protects pathname prefixes including `/dashboard`. Adding `/` to that list would protect every route, including sign-in.
- [smoke.mjs:63](../../../scripts/smoke.mjs#L63) reads response text but returns only parsed JSON, status, and redirect information. Its current homepage/dashboard expectations conflict with the target.
- Existing auth tests cover validated return destinations; role-service tests distinguish loaded-empty from unavailable. Neither proves middleware root matching or the rendered homepage.
- There is no foundation lessons file. The roadmap contains no exact `dashboard-homepage` Change ID; this is a standalone change.

## Desired End State

- Anonymous `/` returns a 302 redirect to `/auth/signin` with `return_to=/`; `/?source=example` preserves `return_to=/?source=example`.
- Sign-in remains public and reachable without a redirect loop. Ordinary successful sign-in still redirects to `/`, which now renders the panel and signed-in email rather than starter content.
- `/dashboard` returns 404 both anonymously and authenticated; its former middleware guard is removed with its page.
- All current dashboard/home navigation links target `/`.
- Sign-out still redirects to `/`; the following anonymous homepage GET redirects to sign-in.
- Student-only, teacher-only, dual-role, loaded-empty, and unavailable-role states preserve existing content, titles, markers, shared links, and HTTP status behavior.
- Invitation path/query continuations remain intact across sign-in, signup, and confirmation.

### Key Discoveries:

- [middleware.ts:22](../../../src/middleware.ts#L22): root protection must use exact pathname equality, retain existing other prefixes and the exact `/classes/join` public exception, and preserve query data in return destinations.
- [dashboard.astro:13](../../../src/pages/dashboard.astro#L13): unavailable roles produce HTTP 503, not a successful empty-role panel.
- [return-destination.ts:1](../../../src/lib/auth/return-destination.ts#L1): the default landing destination is already `/`; valid explicit destinations need no rewriting.
- [research navigation inventory](./research.md#navigation-and-documentation-consumers): eight current link consumers and current onboarding/README guidance reference the old route.

## What We're NOT Doing

- No dashboard redesign, new topbar/layout abstraction, or new dashboard features.
- No public landing page or anonymous access to the panel.
- No `/dashboard` compatibility redirect; an explicit validated `return_to=/dashboard` still reaches 404.
- No changes to destination validation, invitation semantics, Supabase roles, RLS, database schema, or auth API defaults.
- No broader protected-prefix cleanup, unrelated error-handling changes, starter asset deletion, or edits to archived records.
- No new rendering framework, browser-test framework, CI pipeline, feature flag, or dependencies.

## Implementation Approach

Reuse the existing SSR dashboard at the root with its role service unchanged. Test the middleware boundary directly with Vitest using mocked Astro middleware plumbing and Supabase user resolution, following existing test conventions without a production abstraction solely for testing. Use the existing production-preview smoke runner for real route resolution and panel HTML assertions; retain focused auth/role unit tests and explicit manual role/invitation acceptance checks.

Phase 1 establishes routing and navigation. Phase 2 aligns integrated checks and documentation. The current smoke suite intentionally has stale route expectations until phase 2; both phases are required before release, and no full-smoke success is claimed at phase 1.

## Critical Implementation Details

### Route matching and retirement

Protect only exact `/` in addition to the existing exercise/class/homework prefixes. Retiring the route requires removing protection for the exact `/dashboard` path while preserving protection for other paths with that prefix; otherwise anonymous requests to the legacy route would redirect instead of returning the agreed 404. Keep the production `/dev/` denial and public invitation exception unchanged.

## Phase 1: Move the dashboard and rewire navigation

### Overview

Make the root the authenticated panel, retire the old page, and cover the middleware predicate independently of a running server.

### Changes Required:

#### 1. SSR page relocation

**Files**: `src/pages/index.astro`, `src/pages/dashboard.astro`.

**Intent**: Replace the starter homepage with the existing dashboard and remove the old page. Preserve the panel rather than recreating or restyling it.

**Contract**: `/` owns the current dashboard SSR behavior, including role lookup, 503 on unavailable roles, loaded-empty alert, independent student/teacher sections, email, title, `data-role`, class links, and sign-out. No routable `/dashboard` page remains.

#### 2. Authentication boundary and focused regression tests

**Files**: `src/middleware.ts`, new `src/middleware.test.ts`.

**Intent**: Protect the homepage without broadening authentication requirements or intercepting the retired route. Exercise the actual middleware handler with controlled user/client outcomes.

**Contract**: Exact root protection preserves pathname/query in `return_to`; existing `/exercises`, `/classes`, and `/homework` prefix behavior, exact `/classes/join` exemption, and production `/dev/` denial are unchanged. Preserve `/dashboard` prefix protection for non-exact sibling paths (for example, anonymous `/dashboardish` remains protected), but let exact `/dashboard` reach `next()` for both session states; the running application, not the unit stub, proves 404.

Test anonymous `/` and `/?source=example`, authenticated `/`, missing Supabase client, public sign-in/signup/confirmation and invitation paths, representative existing protected paths with queries, both session states at `/dashboard`, and anonymous `/dashboardish`. Assert redirect destination values, `next()` calls, and resolved `locals.user`; mock `astro:middleware` so `defineMiddleware` returns its handler and mock `astro:env/server` before importing the middleware. Retain a production `/dev/` denial case using `vi.stubEnv("PROD", true)`.

#### 3. Current navigation consumers

**Files**: `src/components/Topbar.astro`, `src/pages/exercises/request.astro`, `src/pages/exercises/saved.astro`, `src/pages/classes/index.astro`, `src/pages/classes/joined.astro`, `src/pages/classes/join-code.astro`, `src/pages/homework/index.astro`, `src/components/homework/StudentHomeworkList.astro`.

**Intent**: Point existing dashboard/home links at the canonical root so normal navigation never enters the retired route.

**Contract**: Change only the destination from `/dashboard` to `/`; retain labels, accessibility attributes, styling, and surrounding behavior. Leave the now-unused welcome component and assets alone.

### Success Criteria:

#### Automated Verification:

- Focused middleware and auth/role regressions pass: `npm test -- src/middleware.test.ts src/lib/auth/return-destination.test.ts src/pages/api/auth/signin.test.ts src/lib/services/profile-roles.test.ts`.
- Lint and production build pass: `npm run lint` and `npm run build`.
- Route/link inspection confirms the legacy page is absent and no current rendered navigation link targets `/dashboard`.

#### Manual Verification:

- Anonymous `/` opens reachable sign-in; ordinary sign-in reaches the unchanged panel at `/`, and representative back-to-panel links return there.

**Implementation Note**: Pause after automated verification for human confirmation of the manual criterion before proceeding. Do not release with phase 2 pending.

---

## Phase 2: Align integrated verification and documentation

### Overview

Prove the changed behavior in the deployed runtime shape, preserve the role/invitation contracts, and bring current route guidance into alignment.

### Changes Required:

#### 1. Production-preview smoke assertions

**File**: `scripts/smoke.mjs`.

**Intent**: Replace obsolete homepage/dashboard expectations and prove actual panel content. Preserve the current runner and unrelated checks.

**Contract**: Return raw HTML text alongside existing parsed `body` without changing JSON consumers. Keep manual redirect following and cookie handling. Use exact/parsed Location validation for the new auth cases rather than the runner's existing prefix-only Location check.

The smoke must assert anonymous `/` and `/?source=example` return 302 to sign-in with exact decoded return destinations; GET the sign-in destination and assert 200. Ordinary sign-in returns exactly `/`; authenticated GET `/` returns 200 with panel-specific heading, signed-in email, existing teacher navigation and sign-out form, and no starter hero. Assert `/dashboard` is 404 before and after authentication. After sign-out, assert the exact API redirect `/`, then a fresh root redirect to sign-in and a still-retired `/dashboard`.

Keep new core route checks unconditional rather than behind class/homework flags. Use existing validation callbacks and explicit assertion failures; do not log raw authenticated HTML or credentials.

#### 2. Current route and verification guidance

**Files**: `README.md`, `CLAUDE.md`.

**Intent**: Document the real protected starting page, exact-root matching rule, retired route, and required verification.

**Contract**: Update current route examples/table and middleware guidance from `/dashboard` to `/`; explain that `/` is not a protected prefix. State anonymous root redirect and legacy 404 behavior. Preserve historical change/research/archive records.

#### 3. Acceptance of preserved roles and continuations

**Files**: Existing `src/lib/services/profile-roles.test.ts`, `src/lib/auth/return-destination.test.ts`, and `src/pages/api/auth/signin.test.ts` as regression selectors; no production changes are expected.

**Intent**: Verify that page relocation leaves role-dependent tools and explicit authentication continuations unchanged.

**Contract**: Run existing focused regressions and complete the manual matrix below using local, controlled test accounts. Test role-lookup failure by a temporary development-only fault with restoration, never by changing shared/production permissions or committing a fault. Empty and unavailable roles remain observably distinct.

### Success Criteria:

#### Automated Verification:

- Updated smoke passes against production preview with local Supabase: `npm run smoke`, including exact root/query redirects, reachable sign-in, authenticated panel HTML, both-session legacy 404, and post-signout root protection.
- Focused regressions, lint, and production build pass: `npm test -- src/middleware.test.ts src/lib/auth/return-destination.test.ts src/pages/api/auth/signin.test.ts src/lib/services/profile-roles.test.ts`, `npm run lint`, and `npm run build`.
- Current README/onboarding guidance describes protected `/`, exact root matching, and retired `/dashboard`; no current rendered link points to the retired route.

#### Manual Verification:

- At `/`, student-only and teacher-only accounts show only their respective tools, dual-role shows both, loaded-empty shows its dedicated alert, and unavailable-role shows its distinct alert with HTTP 503; shared class links and sign-out remain present in all five states.
- A controlled invitation URL retains its complete path and query through sign-in and through signup/confirmation; explicit `return_to=/dashboard` reaches 404 without a compatibility rewrite.
- Sign out and revisit `/`; sign-in remains reachable, and exercise/class/homework back links return to `/` without unexpected layout or keyboard-navigation changes.

**Implementation Note**: Pause for human confirmation of the manual matrix. Do not mark manual criteria complete from service-unit success alone.

---

## Testing Strategy

### Unit Tests:

Use direct middleware tests for exact root matching, public exceptions, preserved protected prefixes, user/client states, and production development-route denial. Retain auth destination and role-service regressions; do not substitute a new pure predicate test for coverage of the middleware itself.

### Integration Tests:

Use the existing smoke runner against the built Cloudflare production preview and local Supabase. Assert response content and parsed redirect values, not status alone. Keep existing class/homework/provider checks and cleanup behavior intact; no networked production fixture mutation is required.

### Manual Testing Steps:

1. Follow anonymous root and query-root redirects, log in, and inspect the panel at `/`.
2. Visit `/dashboard` with and without a session and confirm 404 in the real runtime.
3. Exercise the five-state role matrix, including titles, markers, tools, alerts, status, shared class links, and sign-out.
4. Follow every changed back/home link, including the student homework empty state and topbar.
5. Complete both invitation continuation flows and the explicit retired-destination case.
6. Sign out, verify the next root request redirects, and restore any temporary role fixtures/fault.

## Performance Considerations

The root inherits the existing dashboard's role lookup and SSR cost. No new queries, caching layer, or client hydration are required. Keep smoke response text in memory only for assertions.

## Migration Notes

No database migration or data conversion is needed. Existing `/dashboard` bookmarks intentionally break with 404; communicate the new root in current documentation. Release both phases together. A rollback restores the former homepage, dashboard route/guard, navigation, smoke expectations, and documentation as one coherent change; it must not reverse unrelated work.

Prerequisites for implementation verification: installed project dependencies, the documented Node version, configured application secrets, and a production preview with a local Supabase instance supporting the current smoke auth setup. Planning did not run product tests, a build, a server, or the manual matrix; missing runtime prerequisites must be reported as blockers, not successful checks.

## References

- [Change identity](./change.md) and [source research](./research.md).
- [Middleware](../../../src/middleware.ts#L4), [current dashboard](../../../src/pages/dashboard.astro#L6), and [current homepage](../../../src/pages/index.astro#L1).
- [Smoke helper](../../../scripts/smoke.mjs#L63) and [route expectations](../../../scripts/smoke.mjs#L514).
- [Vitest configuration](../../../vitest.config.ts#L1) and [package scripts](../../../package.json#L7).
- [Authentication regression pattern](../../../src/pages/api/auth/signin.test.ts#L35).

## Progress

> Convention: unchecked means pending, checked means done. Append a closing commit SHA when a step lands. Do not rename step titles.

### Phase 1: Move the dashboard and rewire navigation

#### Automated

- [x] 1.1 Focused middleware and auth/role regressions pass: `npm test -- src/middleware.test.ts src/lib/auth/return-destination.test.ts src/pages/api/auth/signin.test.ts src/lib/services/profile-roles.test.ts`. — ea0cfd4
- [x] 1.2 Lint and production build pass: `npm run lint` and `npm run build`. — ea0cfd4
- [x] 1.3 Route/link inspection confirms the legacy page is absent and no current rendered navigation link targets `/dashboard`. — ea0cfd4

#### Manual

- [x] 1.4 Anonymous `/` opens reachable sign-in; ordinary sign-in reaches the unchanged panel at `/`, and representative back-to-panel links return there. — ea0cfd4

### Phase 2: Align integrated verification and documentation

#### Automated

- [x] 2.1 Updated smoke passes against production preview with local Supabase: `npm run smoke`, including exact root/query redirects, reachable sign-in, authenticated panel HTML, both-session legacy 404, and post-signout root protection. — f1d622d
- [x] 2.2 Focused regressions, lint, and production build pass: `npm test -- src/middleware.test.ts src/lib/auth/return-destination.test.ts src/pages/api/auth/signin.test.ts src/lib/services/profile-roles.test.ts`, `npm run lint`, and `npm run build`. — f1d622d
- [x] 2.3 Current README/onboarding guidance describes protected `/`, exact root matching, and retired `/dashboard`; no current rendered link points to the retired route. — f1d622d

#### Manual

- [x] 2.4 At `/`, student-only and teacher-only accounts show only their respective tools, dual-role shows both, loaded-empty shows its dedicated alert, and unavailable-role shows its distinct alert with HTTP 503; shared class links and sign-out remain present in all five states. — f1d622d
- [x] 2.5 A controlled invitation URL retains its complete path and query through sign-in and through signup/confirmation; explicit `return_to=/dashboard` reaches 404 without a compatibility rewrite. — f1d622d
- [x] 2.6 Sign out and revisit `/`; sign-in remains reachable, and exercise/class/homework back links return to `/` without unexpected layout or keyboard-navigation changes. — f1d622d
