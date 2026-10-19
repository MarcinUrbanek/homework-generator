# Dashboard Homepage - Plan Brief

> Full plan: [plan.md](./plan.md)
> Research: [research.md](./research.md)

## What & Why

Make the existing dashboard the logged-in starting page at `/`.
Remove the starter welcome experience from that address without redesigning the panel.

## Starting Point

The root currently renders the starter page; `/dashboard` renders the role-aware panel.
Sign-in and sign-out already default to `/`, but middleware protects `/dashboard`, not the root.

## Desired End State

Anonymous `/` redirects to reachable sign-in, preserving its path and query.
Signed-in `/` renders the current panel; `/dashboard` returns 404 for every session state.
Navigation returns to `/`, with existing role behavior and invitation continuations intact.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Anonymous root | Redirect to sign-in with complete `return_to` | The homepage is the authenticated starting page. | Research |
| Legacy route | 404, not redirect | Explicitly retire the former dashboard address. | Research |
| Existing dashboard | Relocate unchanged | This is routing work, not a new UI. | Research |
| Auth destinations | Keep default `/` and explicit safe destinations | Preserve invitation continuation; explicit `/dashboard` still reaches 404. | Research |
| Route verification | Direct middleware tests plus production-preview smoke HTML | Prove both exact protection and real panel rendering without new tooling. | Plan |
| Role verification | Existing unit regressions plus manual five-state page matrix | Preserve SSR behavior without introducing a rendering framework. | Plan |
| Delivery | Two phases, released together | Routing lands first; integrated acceptance must finish before release. | Plan |

## Scope

**In scope:**
- Root page, legacy page removal, exact-root middleware protection, and eight navigation consumers.
- Middleware regressions, smoke route/content checks, README and onboarding route guidance.
- Manual role-state and invitation-continuation acceptance.

**Out of scope:**
- Redesign, public landing page, legacy redirect, destination rewriting, or database/auth-model changes.
- New testing frameworks, CI changes, starter-asset cleanup, or historical-record edits.

## Architecture / Approach

Move the current dashboard SSR behavior into the homepage and remove its old page and guard.
Protect exact `/` separately from existing prefixes, retaining public auth/invitation entry points.
Extend smoke responses with raw HTML while preserving parsed JSON and cookie handling.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Routing and navigation | Root panel, legacy retirement, links, middleware tests | Treating `/` as a prefix creates auth loops. |
| 2. Integrated acceptance | Smoke assertions, docs, role/invitation verification | Status-only checks miss starter-page or role regressions. |

**Prerequisites:** Existing dependencies and documented Node; configured production preview and local Supabase for smoke; controlled accounts for manual roles/invitations.
**Estimated effort:** Approximately 1-2 focused sessions across two phases, depending on runtime/fixture readiness.

## Open Risks & Assumptions

- Old bookmarks intentionally return 404, including explicit legacy auth destinations.
- Phase 1 leaves obsolete smoke expectations until phase 2; neither is a standalone release.
- Manual loaded-empty and unavailable-role checks require controlled local setup and restoration.
- Planning ran no product tests/build/server; implementation must provide runtime evidence.

## Success Criteria (Summary)

- Anonymous root/query redirects preserve the destination; sign-in remains reachable and authenticated root renders actual panel content.
- Legacy URL returns 404 with or without a session; sign-out restores root protection.
- Five role states, shared class links, all changed navigation, and complete invitation continuations remain correct.

## References

- [Source request](./change.md), [research and navigation inventory](./research.md), and [full criteria and Progress](./plan.md#progress).
