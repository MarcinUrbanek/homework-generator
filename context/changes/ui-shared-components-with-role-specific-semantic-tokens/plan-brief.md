# Role-Aware Shared UI Contract — Plan Brief

> Full plan: `context/changes/ui-shared-components-with-role-specific-semantic-tokens/plan.md`

## What & Why

The exercise-request workflow works, but its controls, feedback, cards, and status styling bypass the design-system tokens already present in the repository. This change makes those tokens real, introduces reusable view-driven primitives, and defines future-compatible teacher/student semantics without expanding into student product work.

## Starting Point

Tailwind v4 and shadcn already provide `src/styles/global.css` and `src/components/ui`, but only Button is consumed as a shared primitive. The target teacher view uses raw blue, cyan, amber, red, slate, and white classes, while role authorization exists only at its server route boundary.

## Desired End State

The exercise-request page has a quiet classroom-utility presentation built entirely from semantic tokens and repository-owned components. Teacher and student mappings are reviewable in light and dark modes, every relevant state is visible in a development gallery, and dated desktop/mobile evidence records visual and WCAG AA checks.

## Key Decisions Made

| Decision         | Choice                                | Why                                                                                         |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| View scope       | Exercise-request view only            | Proves the contract on the richest current workflow without a whole-app rebrand.            |
| Role delivery    | Define both roles; apply teacher only | Establishes the future contract without inventing student routes or runtime role plumbing.  |
| Visual direction | Quiet classroom utility               | Supports repeated scanning and work better than the starter's decorative cosmic styling.    |
| Shared layer     | View-driven primitive set             | Every abstraction has a real consumer and covers the view's complete state surface.         |
| Role distinction | Accent and emphasis only              | Preserves shared neutral and status meanings while making role context legible.             |
| Color modes      | Light and dark mappings               | Keeps the existing dark contract from becoming an unverified second system.                 |
| Accessibility    | WCAG AA state gate                    | Gives contrast, focus, selected, disabled, loading, and error states measurable acceptance. |
| Visual evidence  | Manual retained screenshots           | Meets the repository gate without installing screenshot infrastructure.                     |

## Scope

**In scope:**

- Role-aware semantic values in the existing Tailwind/shadcn source.
- Role-neutral warning, success, information, and destructive meanings.
- Shared Button, Field/Select, Radio Group, Alert, Badge, and Card primitives.
- Teacher-scoped migration of the exercise-request page and all its states.
- Development-only teacher/student × light/dark gallery.
- Dated desktop/mobile screenshots and manual accessibility evidence.

**Out of scope:**

- Auth, dashboard, landing, topbar, banner, or whole-app restyling.
- Production theme switching or shared-layout role loading.
- Student-facing routes or authorization changes.
- Playwright, Storybook, axe, or another new visual/a11y framework.

## Architecture / Approach

Generic component semantics remain stable while `data-role="teacher"` and `data-role="student"` scopes remap accent and emphasis values under light and dark ancestors. The server-rendered request page applies the teacher scope once; shared components never receive role props. A thin presentational view enables deterministic gallery fixtures while the existing form retains network and session behavior.

## Phases at a Glance

| Phase                             | What it delivers                                          | Key risk                                                       |
| --------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Define the semantic contract   | Recorded charges plus four role/mode token sets           | Selector order or contrast could make one combination invalid. |
| 2. Publish primitives and migrate | Shared components and a behavior-preserving teacher view  | Refactoring presentation could disturb request/session states. |
| 3. Render and verify states       | Development gallery, screenshots, a11y record, full gates | Manual evidence must cover every named state reproducibly.     |

**Prerequisites:** Existing Supabase teacher fixture for protected-route checks; a structured-output provider is not required for gallery work.
**Estimated effort:** About 3 focused implementation sessions across 3 phases, plus human screenshot and accessibility review.

## Open Risks & Assumptions

- Student semantics are validated in the gallery, not against a real student workflow; future student work may refine emphasis while preserving token names.
- Generated shadcn primitives may add Radix dependencies and client bundle weight; they must remain inside the existing React island.
- Manual screenshots detect intended visual quality but do not provide automated regression diffs.
- Raw styling outside the target view remains deliberate follow-up debt recorded in the UI contract.

## Success Criteria (Summary)

- The exercise-request view contains no raw palette utilities and preserves all current teacher workflow behavior.
- Teacher/student mappings pass recorded WCAG AA checks in light and dark modes with visible keyboard focus.
- Desktop/mobile screenshots retain every named state, and all test, lint, Astro, build, and provider-free smoke gates pass.
