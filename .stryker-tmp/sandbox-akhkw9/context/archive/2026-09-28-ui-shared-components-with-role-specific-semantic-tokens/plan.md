# Role-Aware Shared UI Contract Implementation Plan

## Overview

Establish the repository's first actively consumed design-system contract for the existing exercise-request view. The change will define teacher and student semantic mappings across light and dark modes, publish the view-driven shadcn primitives that currently have ad hoc equivalents, migrate the teacher workflow without changing its behavior, and retain reproducible visual evidence for every relevant state.

## Current State Analysis

`src/styles/global.css` already contains the Tailwind v4/shadcn value source and publishes generic semantic utilities, but the current product surfaces largely bypass it. A scan found 91 raw palette-class usages across 16 source files; the exercise-request view alone hard-codes blue, cyan, amber, red, slate, and white values for controls, feedback, status, and content surfaces. Only `src/components/ui/button.tsx` is imported as a shared UI primitive.

Teacher and student roles exist in persistence and authorization, but role is not exposed by the shared layout and no student-facing view exists. The exercise-request route already establishes a teacher-only server boundary, making it the right place to apply a teacher visual scope without adding global role-loading plumbing. Existing tests cover behavior and authorization, while visual checks are manual and prior evidence did not retain viewport details.

## Desired End State

The exercise-request page uses semantic utilities and importable shared components rather than raw palette classes. A page-level teacher scope remaps generic component semantics; an equivalent student mapping exists for future consumers and is demonstrated in a development-only state gallery, but it does not invent student product UI or add runtime role fetching.

Both role mappings work in light and dark modes. Default, hover, focus, disabled, error, empty, loading, partial-result, and populated-result states are reviewable through the gallery. Dated desktop and mobile screenshots, viewport details, contrast checks, and keyboard findings are retained with the change.

### Key Discoveries:

- **Missing tokens:** `src/styles/global.css:5-109` publishes generic starter values, while `src/components/exercises/RequestExercisesForm.tsx:54-139` and `src/components/exercises/ExerciseCandidateList.tsx:16-58` use raw palette classes; users therefore receive inconsistent control, status, and focus semantics.
- **Missing shared components:** `src/components/ui/button.tsx:1-42` is the only consumed shared primitive, while the request form and results rebuild fields, selection controls, alerts, badges, and cards; future role views would otherwise fork these patterns.
- **Accidental architecture:** `src/pages/exercises/request.astro:6-14` resolves teacher authorization but provides no styling scope, which would force role-specific props or classes into individual components.
- `src/styles/global.css:4` defines class-based dark mode, but the current request view's raw colors bypass that mapping.
- `components.json:1-22` selects shadcn's `new-york` style, CSS variables, and the existing `src/components/ui` ownership path; this system must be extended rather than reinitialized.
- `context/archive/2026-09-24-request-polish-exercises/manual-verification.md:1-8` records responsive verification but not viewport or screenshot evidence, so the visual result cannot be independently reproduced.

## What We're NOT Doing

- Restyling the auth pages, dashboard, landing page, topbar, banner, or other application views.
- Adding a production theme switcher or changing the application's mode-selection behavior.
- Loading profile roles in middleware or the shared layout, or applying student styling to production routes.
- Building student-facing pages, changing authorization rules, or modifying exercise-generation behavior and state persistence.
- Installing Playwright, Storybook, axe, or another screenshot/accessibility framework.
- Reinitializing shadcn, creating a second token source, or introducing role-named component variants such as `teacherButton`.

## Implementation Approach

Keep components role-agnostic by consuming generic semantic utilities such as primary, card, muted, border, ring, destructive, warning, and success. Extend the existing CSS value source so page-level `data-role="teacher"` and `data-role="student"` scopes remap role accent and emphasis values in both light and dark modes; neutral surfaces and status meanings remain shared. Apply only the teacher scope to the production exercise-request page.

Use the repository's shadcn path to add the view-driven field/select, radio-group, alert, badge, and card primitives, while retaining and extending the existing Button. Separate the request controller from a presentational view only as far as needed for deterministic gallery fixtures. Preserve current request, session restoration, partial-batch, clear, loading, and error behavior.

Record the selected quiet-classroom-utility motif, the token source attribution, the four role/mode value sets, and the charge disposition in the change folder. Finish with a development-only kitchen-sink route and retained manual screenshots rather than adding a visual-test dependency the repository does not already own.

## Critical Implementation Details

The role scope must wrap the complete view before the React island hydrates, and shared components must consume generic semantics rather than role-named utilities. Dark mode remains an ancestor class per the existing `@custom-variant`; the gallery must therefore exercise role scopes beneath both light and `.dark` ancestors so selector order and inheritance are proven rather than simulated inside component classes.

## Phase 1: Define the Semantic Contract

### Overview

Record the visual charges and value provenance, then turn the existing token file into a role-aware light/dark contract before changing component markup.

### Changes Required:

#### 1. UI contract and charge record

**File**: `context/changes/ui-shared-components-with-role-specific-semantic-tokens/ui-contract.md`

**Intent**: Preserve the design decisions that would otherwise live only in this planning conversation and give implementation review a fixed charge list. This document is also the repository-local source for the selected raw values and their provenance.

**Contract**: Record the named motif `quiet classroom utility`; the missing-token, missing-component, accidental-architecture, and verification charges with file/line/user impact; the teacher/student × light/dark value matrix; WCAG AA target pairs; and the disposition of out-of-scope hard-coded styling. Name the existing shadcn neutral variable structure as the base source and identify any external value source if one is introduced during implementation.

#### 2. Role-aware semantic values

**File**: `src/styles/global.css`

**Intent**: Make the existing Tailwind v4 value source authoritative for the migrated view and future role-aware components. Role should alter accent and emphasis without changing the meaning of destructive, warning, success, or informational states.

**Contract**: Preserve the `:root`/`.dark` value-source and `@theme inline` publication split. Add role scopes for `teacher` and `student` in both modes that remap generic primary, accent, ring, and related foreground slots; add only the role-neutral status slots required by Alert and Badge states. Keep OKLCH values in this file, publish every component-facing slot through `@theme inline`, and do not expose color-named or role-named utility APIs to components.

### Success Criteria:

#### Automated Verification:

- `npx prettier --check src/styles/global.css context/changes/ui-shared-components-with-role-specific-semantic-tokens/ui-contract.md` passes.
- `npm run build` compiles every new semantic utility for the Cloudflare SSR target.

#### Manual Verification:

- The UI contract records all four role/mode value sets, source attribution, charge dispositions, and role-neutral status meanings without unresolved placeholders.
- Each documented foreground/background and focus-ring pair meets the agreed WCAG AA target in both modes.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual checks before proceeding.

---

## Phase 2: Publish Primitives and Migrate the Teacher View

### Overview

Add only the shared primitives required by the exercise-request workflow, establish its page-level teacher scope, and replace raw palette styling while preserving behavior.

### Changes Required:

#### 1. View-driven shadcn primitives

**File**: `src/components/ui/{alert,badge,card,field,radio-group,select}.tsx`, `src/components/ui/button.tsx`, `package.json`, `package-lock.json`

**Intent**: Replace duplicated control, feedback, status, and surface styling with importable components owned by the repository. Use the configured shadcn path so the change extends the existing component system instead of inventing parallel primitives.

**Contract**: Add the shadcn `new-york` Alert, Badge, Card, Field, Radio Group, and Select components and their generated dependencies through `npx shadcn@latest add`. Keep their public variant APIs role-agnostic, make all color/focus states consume the semantic slots from Phase 1, and reuse the existing Button for primary, secondary, destructive, loading, and disabled actions.

#### 2. Teacher-scoped page shell

**File**: `src/pages/exercises/request.astro`

**Intent**: Apply role semantics once at the server-rendered page boundary and move the request page from the cosmic starter surface to the approved operational layout. Preserve direct-link, anonymous redirect, and non-teacher denial behavior.

**Contract**: Add `data-role="teacher"` to the complete authorized/denied view scope, use semantic background/text/surface utilities, and retain the existing server-side authorization status and React hydration boundary. Do not query role again in React or pass visual role props into descendants.

#### 3. Request controller and presentational view

**File**: `src/components/exercises/RequestExercisesForm.tsx`, `src/components/exercises/ExerciseRequestView.tsx`, `src/components/exercises/RequestExercisesForm.test.tsx`

**Intent**: Keep the existing request/session behavior stable while making all visible states renderable through shared primitives and deterministic gallery fixtures.

**Contract**: Retain network, schema-validation, selection, loading, error, batch replacement, and clearing ownership in `RequestExercisesForm`. Move rendering behind an `ExerciseRequestView` prop contract that represents selections, callbacks, loading/error state, restored batch, and clear behavior; use Field/Select/RadioGroup/Button/Alert components without role-specific class branches. Add focused happy-dom interaction coverage that mocks the request and session boundary and proves submit payload, loading lockout, successful replacement, malformed and provider error handling, prior-result preservation, restored rendering, and clear behavior across the controller/view boundary.

#### 4. Candidate result presentation

**File**: `src/components/exercises/ExerciseCandidateList.tsx`

**Intent**: Present complete and partial candidate batches with consistent hierarchy, status meaning, and responsive behavior. Remove the duplicated raw-color card, badge, alert, divider, and secondary-action styling.

**Contract**: Render candidate surfaces with Card, the unverified state with a warning Badge, partial-batch feedback with Alert, and clearing with a secondary Button. Preserve Polish copy, candidate order, metadata, proposed answers, `aria-labelledby`, and responsive layout.

### Success Criteria:

#### Automated Verification:

- `npm run test -- src/components/exercises/RequestExercisesForm.test.tsx` proves submit, loading, error, prior-result preservation, replacement, restoration, and clear behavior, and `npm run test` passes for the complete suite.
- `npm run lint` and `npx astro check` pass for the shared components, Astro page, and React view/controller boundary.
- `npm run build` passes, and `! grep -nE '(bg|text|border|ring|outline|decoration|divide|placeholder|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-|/|[^[:alnum:]_-]|$)' src/pages/exercises/request.astro src/components/exercises/RequestExercisesForm.tsx src/components/exercises/ExerciseRequestView.tsx src/components/exercises/ExerciseCandidateList.tsx` exits successfully with no raw-palette utility matches.

#### Manual Verification:

- A teacher can request, receive, clear, restore, and retry exercise batches with the same Polish behavior and messages as before; loading, error, partial, and prior-result preservation still work.
- Anonymous visitors still redirect to sign-in, non-teachers still receive the denied view, and a direct request-page link renders the correct semantic shell without a role-style flash.
- At desktop and one mobile width, labels, controls, result text, badges, and actions remain readable without overlap or layout shift.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual checks before proceeding.

---

## Phase 3: Render and Verify Every State

### Overview

Create the visual review surface, retain reproducible screenshots and accessibility evidence, and run the complete repository gates.

### Changes Required:

#### 1. Development-only state gallery

**File**: `src/pages/dev/ui-exercise-request.astro`, `src/components/exercises/ExerciseRequestStateGallery.tsx`

**Intent**: Make the semantic contract inspectable without provider calls or production data. Reviewers must be able to compare roles, modes, breakpoints, and interactive states from one stable fixture surface.

**Contract**: Render teacher/student × light/dark specimens using the real shared components and presentational exercise view. Include default, selected, disabled, loading, error, empty, partial-result, and populated-result fixtures, with dedicated controls available for simultaneous hover and focus capture. Guard the page locally with `import.meta.env.DEV`, return a `404` response outside development, and do not add the route to production navigation.

#### 2. Retained visual and accessibility evidence

**File**: `context/changes/ui-shared-components-with-role-specific-semantic-tokens/screenshots/*.png`, `context/changes/ui-shared-components-with-role-specific-semantic-tokens/manual-verification.md`

**Intent**: Replace checkbox-only visual confirmation with reviewable evidence while avoiding a new screenshot framework. Preserve enough environment detail for another reviewer to reproduce the gate.

**Contract**: Retain dated desktop and mobile gallery screenshots covering all four role/mode combinations and named states. Record browser, exact viewport dimensions, OS, screenshot filenames, intended visual deltas, WCAG AA contrast results, keyboard/tab order, visible focus, accessible names, and confirmation that the development route is unavailable in production preview.

#### 3. Final repository verification

**File**: `scripts/smoke.mjs`

**Intent**: Prove that the UI contract does not disturb application behavior or leak its internal gallery into production. Keep the existing provider-free smoke workflow and dependency policy intact.

**Contract**: Run the full existing unit, lint, Astro, build, and production-preview smoke gates. Add a dependency-free status assertion that `/dev/ui-exercise-request` returns `404` in the production preview; do not add provider calls or otherwise expand the smoke flow.

### Success Criteria:

#### Automated Verification:

- `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` all pass after the gallery and final UI wiring are complete.
- `npm run smoke` passes against a provider-free production preview and confirms the development-only gallery is unavailable there.

#### Manual Verification:

- Retained desktop and mobile screenshots show teacher/student × light/dark specimens and every named default, hover, focus, disabled, error, empty, loading, partial, and populated state.
- Keyboard order, accessible names, visible focus, and recorded contrast checks satisfy the agreed WCAG AA state gate with no incoherent overlap or clipped text.
- The migrated production teacher view matches the approved quiet classroom utility direction, while unrelated views remain visually and behaviorally unchanged.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of the manual checks before considering the change ready for implementation review.

## Testing Strategy

### Unit Tests:

- Preserve the existing request-schema, service, endpoint, authorization, and session-storage suites; the visual refactor must not change those contracts.
- Exercise `RequestExercisesForm` through its rendered controls with the request and session boundary mocked, covering submit payload, loading lockout, successful replacement, malformed/provider errors with prior results retained, restored results, and clear behavior.
- Test newly extracted pure state-to-view mapping only if logic is introduced beyond direct prop rendering; do not add snapshot tests that merely mirror markup.

### Integration Tests:

- Build the Astro/React/Tailwind application to prove generated shadcn dependencies, semantic utilities, and development-route guards compile for Cloudflare.
- Run the existing provider-free production-preview smoke flow, including gallery non-exposure if the harness is extended.

### Manual Testing Steps:

1. Open the development gallery at the recorded desktop viewport and inspect teacher/student specimens in light and dark mode with hover and focus held on their dedicated controls.
2. Repeat at the recorded mobile viewport; verify every state fits, wraps, and remains legible.
3. Use browser contrast inspection on each documented foreground/background and focus-ring pair; record ratios and pass/fail results.
4. Traverse the gallery and production request view by keyboard, confirming logical order, visible focus, accessible names, disabled behavior, and no keyboard trap.
5. Exercise the production teacher workflow through success, partial, error-with-prior-results, loading, restored, and cleared states.
6. Open the request route anonymously, as a student, and by direct URL; then confirm the gallery returns unavailable in production preview.

## Performance Considerations

Role and mode changes are CSS-variable inheritance only and add no production role query or React context. New Radix-backed primitives remain inside the existing request React island; inspect the production build for accidental global hydration or an unexpected dependency expansion, but do not add speculative memoization or caching.

## Migration Notes

No database, API, or persisted browser-state migration is required. Existing raw styling outside the exercise-request view remains intentionally unchanged and is recorded as deferred in `ui-contract.md`. The gallery and screenshot evidence are review aids, not production features.

## References

- `src/styles/global.css:4-120` — current Tailwind v4 value publication and dark-mode contract.
- `components.json:1-22` — configured shadcn style, token source, component path, and icon library.
- `src/components/ui/button.tsx:1-42` — existing CVA, `cn()`, semantic-token, and component-export pattern.
- `src/pages/exercises/request.astro:1-40` — target view and teacher authorization boundary.
- `src/components/exercises/RequestExercisesForm.tsx:1-145` — request behavior and duplicated control/feedback styling.
- `src/components/exercises/ExerciseCandidateList.tsx:1-61` — result behavior and duplicated surface/status styling.
- `context/archive/2026-09-24-request-polish-exercises/manual-verification.md:1-12` — previous visual verification and evidence limitation.
- `.github/skills/10x-ui/SKILL.md` — repository UI-change contract: tokens, shared components, one view, named states, and screenshot gate.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Define the Semantic Contract

#### Automated

- [x] 1.1 `npx prettier --check src/styles/global.css context/changes/ui-shared-components-with-role-specific-semantic-tokens/ui-contract.md` passes. — d9fc90e
- [x] 1.2 `npm run build` compiles every new semantic utility for the Cloudflare SSR target. — d9fc90e

#### Manual

- [x] 1.3 The UI contract records all four role/mode value sets, source attribution, charge dispositions, and role-neutral status meanings without unresolved placeholders. — d9fc90e
- [x] 1.4 Each documented foreground/background and focus-ring pair meets the agreed WCAG AA target in both modes. — d9fc90e

### Phase 2: Publish Primitives and Migrate the Teacher View

#### Automated

- [x] 2.1 `npm run test -- src/components/exercises/RequestExercisesForm.test.tsx` proves submit, loading, error, prior-result preservation, replacement, restoration, and clear behavior, and `npm run test` passes for the complete suite. — cf15375
- [x] 2.2 `npm run lint` and `npx astro check` pass for the shared components, Astro page, and React view/controller boundary. — cf15375
- [x] 2.3 `npm run build` passes, and `! grep -nE '(bg|text|border|ring|outline|decoration|divide|placeholder|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-|/|[^[:alnum:]_-]|$)' src/pages/exercises/request.astro src/components/exercises/RequestExercisesForm.tsx src/components/exercises/ExerciseRequestView.tsx src/components/exercises/ExerciseCandidateList.tsx` exits successfully with no raw-palette utility matches. — cf15375

#### Manual

- [x] 2.4 A teacher can request, receive, clear, restore, and retry exercise batches with the same Polish behavior and messages as before; loading, error, partial, and prior-result preservation still work. — cf15375
- [x] 2.5 Anonymous visitors still redirect to sign-in, non-teachers still receive the denied view, and a direct request-page link renders the correct semantic shell without a role-style flash. — cf15375
- [x] 2.6 At desktop and one mobile width, labels, controls, result text, badges, and actions remain readable without overlap or layout shift. — cf15375

### Phase 3: Render and Verify Every State

#### Automated

- [x] 3.1 `npm run test`, `npm run lint`, `npx astro check`, and `npm run build` all pass after the gallery and final UI wiring are complete. — ee1c41e
- [x] 3.2 `npm run smoke` passes against a provider-free production preview and confirms the development-only gallery is unavailable there. — ee1c41e

#### Manual

- [x] 3.3 Retained desktop and mobile screenshots show teacher/student × light/dark specimens and every named default, hover, focus, disabled, error, empty, loading, partial, and populated state. — ee1c41e
- [x] 3.4 Keyboard order, accessible names, visible focus, and recorded contrast checks satisfy the agreed WCAG AA state gate with no incoherent overlap or clipped text. — ee1c41e
- [x] 3.5 The migrated production teacher view matches the approved quiet classroom utility direction, while unrelated views remain visually and behaviorally unchanged. — ee1c41e
