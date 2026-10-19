---
date: 2026-10-18T17:15:22.2325169+02:00
researcher: AI assistant using Copilot SDK in VS Code
git_commit: c14b83af05e54f20bc470e1c6fc2b32f9fc83029
branch: master
repository: homework-generator
topic: "Serve the authenticated dashboard at / and retire /dashboard"
tags: [research, codebase, routing, authentication, dashboard]
status: complete
last_updated: 2026-10-18
last_updated_by: AI assistant using Copilot SDK in VS Code
---

# Research: Dashboard as the authenticated homepage

## Research Question

What existing routing, authentication, navigation, and verification contracts
must be accounted for when moving the dashboard from `/dashboard` to `/`?

Source request: [change.md:13](./change.md#L13).

### Confirmed scope

In the research clarification on 2026-10-18, the user selected:

- Anonymous requests to `/` redirect to sign-in, rather than retaining the
  starter welcome page.
- `/dashboard` returns 404, rather than redirecting to `/`.
- This invocation produces research, not application implementation or approval
  of a technical plan.

These are user decisions, not observations of the current implementation.

## Summary

- The current `/` renders the starter welcome component, while the dashboard
  renders role-aware account navigation. Replacing the homepage with the existing
  dashboard behavior is a routing change, not a new dashboard design
  ([index.astro:1](../../../src/pages/index.astro#L1),
  [dashboard.astro:6](../../../src/pages/dashboard.astro#L6)).
- Successful sign-in without a supplied destination already lands on `/`.
  Sign-out also redirects there. The default destination need not change; the
  response rendered at that destination does
  ([return-destination.ts:1](../../../src/lib/auth/return-destination.ts#L1),
  [signin.ts:20](../../../src/pages/api/auth/signin.ts#L20),
  [signout.ts:9](../../../src/pages/api/auth/signout.ts#L9)).
- Root protection needs exact-path matching alongside the existing protected
  prefixes. Adding `/` to the current `startsWith` list would also match
  `/auth/signin`, creating a redirect loop for an anonymous sign-in request
  ([middleware.ts:4](../../../src/middleware.ts#L4),
  [middleware.ts:22](../../../src/middleware.ts#L22)).
- Retiring the route requires addressing its page, middleware prefix, navigation
  consumers, smoke expectations, and route documentation. Removing the page
  while retaining the `/dashboard` guard would still redirect anonymous requests
  before the missing route can produce 404
  ([middleware.ts:22](../../../src/middleware.ts#L22),
  [smoke.mjs:519](../../../scripts/smoke.mjs#L519),
  [README.md:157](../../../README.md#L157)).

## Detailed Findings

### Current request and authentication flow

The app uses server rendering through the Cloudflare adapter. The inspected
Astro configuration does not define a legacy-route redirect, and the Wrangler
asset configuration uses `404-page` for missing assets
([astro.config.mjs:10](../../../astro.config.mjs#L10),
[wrangler.jsonc:7](../../../wrangler.jsonc#L7)). These configuration observations
are not runtime proof of the proposed missing-page response.

Middleware resolves the Supabase user into `locals.user`, then checks protected
path prefixes. The current list is `/dashboard`, `/exercises`, `/classes`, and
`/homework`, with an exact `/classes/join` exemption. An unauthenticated protected
request redirects with `return_to` built from the original pathname and query
([middleware.ts:11](../../../src/middleware.ts#L11),
[middleware.ts:22](../../../src/middleware.ts#L22)).

For the agreed scope, the predicate must distinguish exact `/` from those
prefixes, stop treating retired `/dashboard` as protected, and retain public
authentication and invitation entry points. The existing production `/dev/`
denial is unrelated and should remain intact
([middleware.ts:7](../../../src/middleware.ts#L7)).

The sign-in page validates its query destination and passes it to the form,
which submits a hidden `return_to`. The handler validates the posted value again
and redirects there after successful authentication
([signin.astro:6](../../../src/pages/auth/signin.astro#L6),
[SignInForm.tsx:45](../../../src/components/auth/SignInForm.tsx#L45),
[signin.ts:20](../../../src/pages/api/auth/signin.ts#L20)).

The helper defaults to `/` for absent or rejected input, preserves the pathname
and query of accepted same-origin destinations, and does not test whether the
destination route exists
([return-destination.ts:1](../../../src/lib/auth/return-destination.ts#L1)).
Consequently, an explicit `return_to=/dashboard` remains accepted under the
current helper and would reach the retired route's 404 after the move. No
legacy-destination rewrite was requested; the selected behavior is 404.

The public invitation page builds its own complete return destination. Signup
and confirmation carry the validated destination forward. Do not replace these
continuations with an unconditional homepage redirect
([join.astro:15](../../../src/pages/classes/join.astro#L15),
[signup.ts:20](../../../src/pages/api/auth/signup.ts#L20),
[confirm-email.astro:6](../../../src/pages/auth/confirm-email.astro#L6)).

Sign-out currently redirects to `/`. With the selected root protection, the next
anonymous GET should continue to sign-in. Changing the sign-out API destination
is not necessary to achieve that flow
([signout.ts:4](../../../src/pages/api/auth/signout.ts#L4)).

### Dashboard behavior to preserve at the new address

The inspected dashboard obtains explicit account roles through
`loadProfileRoles`. Its independent student and teacher checks permit a dual-role
account to see both sections
([dashboard.astro:8](../../../src/pages/dashboard.astro#L8),
[dashboard.astro:56](../../../src/pages/dashboard.astro#L56),
[dashboard.astro:71](../../../src/pages/dashboard.astro#L71)).

- Student navigation points to `/homework`.
- Teacher navigation points to `/classes`, `/exercises/request`, and
  `/exercises/saved`.
- Class joining and joined-class navigation remain outside those role checks.
- An unavailable role lookup sets HTTP 503 and displays an alert. A successfully
  loaded empty role set displays a different alert and retains class-join links.
- The page retains the signed-in email, role-sensitive title and `data-role`
  marker, and sign-out form.

These observations are scoped to
[dashboard.astro:13](../../../src/pages/dashboard.astro#L13),
[dashboard.astro:17](../../../src/pages/dashboard.astro#L17),
[dashboard.astro:29](../../../src/pages/dashboard.astro#L29),
[dashboard.astro:40](../../../src/pages/dashboard.astro#L40),
[dashboard.astro:56](../../../src/pages/dashboard.astro#L56),
[dashboard.astro:71](../../../src/pages/dashboard.astro#L71),
[dashboard.astro:107](../../../src/pages/dashboard.astro#L107), and
[dashboard.astro:128](../../../src/pages/dashboard.astro#L128).

The role service distinguishes loaded-empty from unavailable and validates
database role rows. Its unit tests cover dual roles, loaded-empty, malformed
results, query failures, and absent caller context; they do not render the page
([profile-roles.ts:12](../../../src/lib/services/profile-roles.ts#L12),
[profile-roles.test.ts:19](../../../src/lib/services/profile-roles.test.ts#L19)).

### Navigation and documentation consumers

In the inspected `src` search for `/dashboard`, these rendered link consumers
need to target `/`:

- [Topbar.astro:10](../../../src/components/Topbar.astro#L10).
- [exercises/request.astro:19](../../../src/pages/exercises/request.astro#L19).
- [exercises/saved.astro:19](../../../src/pages/exercises/saved.astro#L19).
- [classes/index.astro:29](../../../src/pages/classes/index.astro#L29).
- [classes/joined.astro:9](../../../src/pages/classes/joined.astro#L9).
- [classes/join-code.astro:9](../../../src/pages/classes/join-code.astro#L9).
- [homework/index.astro:44](../../../src/pages/homework/index.astro#L44).
- [StudentHomeworkList.astro:48](../../../src/components/homework/StudentHomeworkList.astro#L48).

The shared layout does not inject the topbar; the starter `Welcome` component
imports it. Replacing `Welcome` at the root therefore does not automatically
carry the topbar into the dashboard
([Layout.astro:36](../../../src/layouts/Layout.astro#L36),
[Welcome.astro:2](../../../src/components/Welcome.astro#L2)).
The existing dashboard has its own sign-out form, so a new layout abstraction or
topbar redesign is not required by this request.

The README route table describes `/dashboard` as the protected example. Its
instruction to add paths to the prefix list also needs qualification for exact
root protection. Repository onboarding repeats `/dashboard` as a protected page
example
([README.md:157](../../../README.md#L157),
[README.md:162](../../../README.md#L162),
[CLAUDE.md:31](../../../CLAUDE.md#L31)). Update current guidance during
implementation; archived records describe their historical state.

### Verification impact and planning handoff

The smoke script currently expects anonymous `/` to return 200, authenticated
`/dashboard` to return 200, and anonymous `/dashboard` to redirect before login
and after logout
([smoke.mjs:514](../../../scripts/smoke.mjs#L514),
[smoke.mjs:519](../../../scripts/smoke.mjs#L519),
[smoke.mjs:574](../../../scripts/smoke.mjs#L574),
[smoke.mjs:705](../../../scripts/smoke.mjs#L705)).
Those expectations conflict with the selected target behavior and must change
with the implementation.

The inspected smoke request helper disables automatic redirects, so individual
redirect hops can be asserted. It returns parsed JSON, not retained HTML, and
the current dashboard step asserts a status rather than dashboard content
([smoke.mjs:63](../../../scripts/smoke.mjs#L63),
[smoke.mjs:574](../../../scripts/smoke.mjs#L574)).
A homepage status check alone would not establish that the role-aware panel,
rather than the starter page, rendered.

The later plan should establish:

- Anonymous `/` and `/?source=example` redirect to sign-in with their return
  destination preserved; the sign-in page remains reachable.
- Successful ordinary sign-in reaches the panel at `/`, not the starter hero.
- `/dashboard` returns 404 both without and with an authenticated session.
- Sign-out clears the session, and a subsequent root request redirects.
- Student, teacher, dual-role, loaded-empty, and unavailable-role states preserve
  the inspected dashboard behavior.
- The listed navigation links lead to `/`, and an invitation's path and query
  survive authentication.

Existing focused unit-test entry points are
[return-destination.test.ts:5](../../../src/lib/auth/return-destination.test.ts#L5),
[signin.test.ts:35](../../../src/pages/api/auth/signin.test.ts#L35), and
[profile-roles.test.ts:19](../../../src/lib/services/profile-roles.test.ts#L19).
The `src/**/*middleware*` filename search found the production middleware but no
colocated middleware-named test; the inspected tests do not prove root-route
protection or page rendering.

For implementation verification, use the relevant focused Vitest selectors,
lint and production build, then the updated smoke against the configured
production preview and Supabase. CI already runs the smoke script
([package.json:7](../../../package.json#L7),
[ci.yml:50](../../../.github/workflows/ci.yml#L50)).
No new database behavior is implied by this routing change. No build, tests,
browser session, or server was run during this source investigation.

## Architecture Insights

Reuse the existing SSR page and role service. The principal boundary is the
middleware predicate, not a new authentication mechanism. Separating an exact
homepage match from existing protected prefixes avoids broadening protection
to authentication routes. Retiring the legacy page and its guard together is
necessary for the user-selected anonymous 404 behavior.

## Historical Context

- The invitation plan's return-destination contract remains supported by the
  inspected middleware, helper, and auth consumers
  ([invitation plan:72](../../archive/2026-10-01-invite-students-to-class/plan.md#L72)).
- The homework brief's navigation decision, including dual-role entry points,
  remains supported by the current dashboard. Its separate "Starting Point"
  statement about teacher-oriented tools describes the pre-change baseline,
  not current dashboard behavior
  ([homework brief:9](../../archive/2026-10-09-submit-and-score-homework/plan-brief.md#L9),
  [homework brief:28](../../archive/2026-10-09-submit-and-score-homework/plan-brief.md#L28)).

## Related Research

[Authorization and invitation boundaries:55](../testing-authorization-and-invitation-boundaries/research.md#L55)
documents authentication continuation. Its continuation findings agree with
the inspected auth code and provide background, not approval for this change.

## Evidence and Limitations

Evidence is local source at the recorded commit plus the existing untracked
`dashboard-homepage` change identity. No commit permalinks are asserted.
The investigation followed the continuous homepage/authentication/navigation
trace directly, without delegated workers. No foundation lessons file was
present at the expected path. Product choices are settled above; runtime
verification of the future implementation remains pending.

## Open Questions

No blocking product choice remains for this research scope. The plan must choose
the smallest route/middleware verification approach that proves the target
behavior, including anonymous legacy-route 404 and actual homepage panel content.
