# UI Contract: Quiet Classroom Utility

## Direction and provenance

The named motif is **quiet classroom utility**: restrained operational surfaces, clear hierarchy, and role identity carried by accent and emphasis rather than decoration.

The base source is the repository's existing shadcn neutral variable structure: `components.json` selects the `new-york` style, `neutral` base color, CSS variables, and `src/styles/global.css` as the Tailwind v4 value source. The existing `:root` and `.dark` neutral values remain authoritative for surfaces, typography, borders, inputs, and popovers. No external value source is introduced. The role and status OKLCH values below are repository-local additions authored for this change.

Components consume only generic semantic APIs published through `@theme inline`. Role names and color names are not utility APIs.

## Fixed charges

| Category                | Evidence                                                                                                                                                    | User impact                                                                                                                                                           | Disposition                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Missing tokens          | `src/styles/global.css:5-109`; `src/components/exercises/RequestExercisesForm.tsx:54-139`; `src/components/exercises/ExerciseCandidateList.tsx:16-58`       | Controls, focus, feedback, and result surfaces use unrelated raw colors, so meaning and dark-mode behavior drift between states.                                      | Phase 1 defines role-aware generic emphasis and role-neutral status slots; Phase 2 migrates the target view to them.            |
| Missing component       | `src/components/ui/button.tsx:1-42`; `src/components/exercises/RequestExercisesForm.tsx:54-125`; `src/components/exercises/ExerciseCandidateList.tsx:16-58` | Form fields, selections, alerts, badges, cards, and a secondary action are rebuilt locally, making state behavior inconsistent and costly to reuse.                   | Phase 2 adds only the configured shadcn primitives required by this view and reuses Button.                                     |
| Accidental architecture | `src/pages/exercises/request.astro:6-14`                                                                                                                    | Authorization identifies the teacher at the route boundary but no visual scope is applied there, encouraging role props and role-specific classes deeper in the tree. | Phase 2 applies one `data-role="teacher"` scope around the complete server-rendered view; components remain role-agnostic.      |
| Verification            | `context/archive/2026-09-24-request-polish-exercises/manual-verification.md:1-8`                                                                            | Prior responsive checks have no retained viewport or screenshot evidence, so another reviewer cannot reproduce the visual result.                                     | Phase 3 retains desktop/mobile gallery screenshots and records viewport, contrast, keyboard, focus, and accessible-name checks. |

## Role and mode values

Only `primary`, `primary-foreground`, `accent`, `accent-foreground`, and `ring` vary by role. Teacher uses a calm blue emphasis; student uses a distinct green emphasis. Neutral surfaces and all status meanings are shared.

| Role and mode | Primary                 | Primary foreground      | Accent                  | Accent foreground       | Ring                    |
| ------------- | ----------------------- | ----------------------- | ----------------------- | ----------------------- | ----------------------- |
| Teacher light | `oklch(0.43 0.105 235)` | `oklch(0.985 0 0)`      | `oklch(0.94 0.035 220)` | `oklch(0.3 0.075 235)`  | `oklch(0.5 0.12 235)`   |
| Teacher dark  | `oklch(0.78 0.1 220)`   | `oklch(0.18 0.025 235)` | `oklch(0.3 0.055 230)`  | `oklch(0.95 0.015 220)` | `oklch(0.76 0.11 220)`  |
| Student light | `oklch(0.41 0.1 155)`   | `oklch(0.985 0 0)`      | `oklch(0.94 0.04 150)`  | `oklch(0.28 0.07 155)`  | `oklch(0.48 0.115 155)` |
| Student dark  | `oklch(0.78 0.12 150)`  | `oklch(0.18 0.025 235)` | `oklch(0.3 0.06 155)`   | `oklch(0.95 0.015 150)` | `oklch(0.76 0.12 150)`  |

## Role-neutral status values

Status names retain the same meaning for teachers and students. `destructive` means an error or dangerous action, `warning` means caution or unverified content, `success` means confirmed completion, and `info` means neutral informational feedback.

| Mode  | Destructive / foreground                             | Warning / foreground                           | Success / foreground                            | Info / foreground                               |
| ----- | ---------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Light | `oklch(0.577 0.245 27.325)` / `oklch(0.985 0 0)`     | `oklch(0.43 0.11 70)` / `oklch(0.985 0 0)`     | `oklch(0.42 0.12 145)` / `oklch(0.985 0 0)`     | `oklch(0.43 0.11 250)` / `oklch(0.985 0 0)`     |
| Dark  | `oklch(0.704 0.191 22.216)` / `oklch(0.18 0.02 250)` | `oklch(0.82 0.14 80)` / `oklch(0.18 0.02 250)` | `oklch(0.78 0.14 145)` / `oklch(0.18 0.02 250)` | `oklch(0.78 0.11 245)` / `oklch(0.18 0.02 250)` |

## WCAG AA target pairs

Normal text pairs target at least `4.5:1`; focus rings against the page background target at least `3:1`. Ratios below use CSS Color 4 OKLCH-to-sRGB conversion and WCAG 2.x relative luminance. They are implementation targets for the later browser verification gate.

| Role and mode | Primary / foreground | Accent / foreground | Ring / background |
| ------------- | -------------------: | ------------------: | ----------------: |
| Teacher light |             `7.50:1` |           `11.29:1` |          `5.78:1` |
| Teacher dark  |             `9.64:1` |           `11.70:1` |          `9.51:1` |
| Student light |             `8.05:1` |           `12.08:1` |          `6.18:1` |
| Student dark  |             `9.82:1` |           `11.56:1` |          `9.66:1` |

| Status and mode   | Status / foreground |
| ----------------- | ------------------: |
| Destructive light |            `4.56:1` |
| Warning light     |            `7.93:1` |
| Success light     |            `7.70:1` |
| Info light        |            `7.76:1` |
| Destructive dark  |            `6.50:1` |
| Warning dark      |           `10.62:1` |
| Success dark      |            `9.87:1` |
| Info dark         |            `9.49:1` |

## Out-of-scope hard-coded styling

Raw palette utilities outside `src/pages/exercises/request.astro`, `src/components/exercises/RequestExercisesForm.tsx`, and `src/components/exercises/ExerciseCandidateList.tsx` are explicitly deferred. Auth pages, dashboard, landing page, topbar, banner, and the `bg-cosmic` utility remain unchanged; this contract does not imply their migration or a whole-application rebrand.
