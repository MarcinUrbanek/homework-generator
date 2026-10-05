# Manual Verification

- **Status:** Passed; browser evidence and final human confirmation complete
- **Recorded:** 2026-09-28
- **Browser and version:** VS Code integrated browser 1.139.1, Chromium 150.0.7871.250
- **Operating system:** Windows (Win32; user agent Windows NT 10.0)
- **Development URL:** `http://127.0.0.1:4321/dev/ui-exercise-request`
- **Production preview URL:** `http://127.0.0.1:4322` (provider-free verification run; stopped afterward)

## Capture Matrix

Each full-page capture holds keyboard focus on `Focus target` and forces the browser `:hover` pseudo-state on `Hover target`. Role, mode, and state data attributes were asserted before every capture.

| State            | Role    | Mode  | Desktop viewport and filename                                 | Mobile viewport and filename                               | Check |
| ---------------- | ------- | ----- | ------------------------------------------------------------- | ---------------------------------------------------------- | ----- |
| Default          | Teacher | Light | `1440x1200` - `2026-09-28-desktop-teacher-light-default.png`  | `390x844` - `2026-09-28-mobile-teacher-light-default.png`  | Pass  |
| Selected         | Teacher | Dark  | `1440x1200` - `2026-09-28-desktop-teacher-dark-selected.png`  | `390x844` - `2026-09-28-mobile-teacher-dark-selected.png`  | Pass  |
| Disabled         | Student | Light | `1440x1200` - `2026-09-28-desktop-student-light-disabled.png` | `390x844` - `2026-09-28-mobile-student-light-disabled.png` | Pass  |
| Loading          | Student | Dark  | `1440x1200` - `2026-09-28-desktop-student-dark-loading.png`   | `390x844` - `2026-09-28-mobile-student-dark-loading.png`   | Pass  |
| Error            | Teacher | Light | `1440x1200` - `2026-09-28-desktop-teacher-light-error.png`    | `390x844` - `2026-09-28-mobile-teacher-light-error.png`    | Pass  |
| Empty            | Teacher | Dark  | `1440x1200` - `2026-09-28-desktop-teacher-dark-empty.png`     | `390x844` - `2026-09-28-mobile-teacher-dark-empty.png`     | Pass  |
| Partial result   | Student | Light | `1440x1200` - `2026-09-28-desktop-student-light-partial.png`  | `390x844` - `2026-09-28-mobile-student-light-partial.png`  | Pass  |
| Populated result | Student | Dark  | `1440x1200` - `2026-09-28-desktop-student-dark-populated.png` | `390x844` - `2026-09-28-mobile-student-dark-populated.png` | Pass  |

## Intended Visual Deltas

| Area             | Intended delta                                                                                             | Finding                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Role emphasis    | Teacher uses blue primary/accent/ring semantics; student uses green semantics.                             | Pass in retained role-paired captures.                                           |
| Color mode       | Light and dark modes retain readable neutral surfaces while role emphasis changes through semantic tokens. | Pass in retained light/dark captures and browser contrast checks.                |
| Request workflow | Controls, feedback, result cards, badges, and actions use the shared component contract.                   | Pass across default, disabled, loading, error, partial, and populated fixtures.  |
| Scope            | The production teacher request view changes; unrelated production views remain unchanged.                  | Pass; source scope and final visual judgment were human-confirmed on 2026-09-28. |

## Contrast

Ratios were computed in Chromium from the inherited CSS variables after browser OKLCH-to-sRGB conversion. Normal text targets `4.5:1`; focus indicators target `3:1`.

| Pair                                 | Teacher light | Teacher dark | Student light | Student dark | Check |
| ------------------------------------ | ------------: | -----------: | ------------: | -----------: | ----- |
| Primary / primary foreground         |      `7.51:1` |     `9.63:1` |      `8.01:1` |     `9.83:1` | Pass  |
| Accent / accent foreground           |     `11.21:1` |    `11.63:1` |     `11.98:1` |    `11.59:1` | Pass  |
| Ring / background                    |      `5.78:1` |     `9.50:1` |      `6.17:1` |     `9.71:1` | Pass  |
| Destructive / destructive foreground |      `4.57:1` |     `6.52:1` |      `4.57:1` |     `6.52:1` | Pass  |
| Warning / warning foreground         |      `7.93:1` |    `10.63:1` |      `7.93:1` |    `10.63:1` | Pass  |

## Keyboard And Accessibility

| Check                                                                           | Evidence                                                                                                                                                         | Result |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Tab order follows role, mode, state, capture controls, then request controls.   | Fresh-load Tab sequence traversed Teacher, Student, Light, Dark, all eight states, Default/Hover/Focus targets, topic, difficulty, and submit in document order. | Pass   |
| Every interactive control has an accessible name matching its purpose.          | Browser accessibility snapshot exposed named gallery buttons, form labels, radios, select controls, submit, and clear action.                                    | Pass   |
| Keyboard focus is visible in all four role/mode combinations.                   | `Focus target` matched `:focus-visible` and settled to a semantic `3px` ring in every combination.                                                               | Pass   |
| Disabled controls are skipped or announced as disabled and cannot be activated. | Disabled capture control and grade control were marked disabled and omitted from the Tab sequence.                                                               | Pass   |
| Selected controls expose their selected/pressed state.                          | Role, mode, and state buttons exposed `aria-pressed`; difficulty exposed checked radio state.                                                                    | Pass   |
| Desktop and mobile captures have no overlap, clipping, or unreadable text.      | All 16 specimens reported zero horizontal overflow, no elements outside the viewport, and no clipped controls; representative images were visually inspected.    | Pass   |

## Production Isolation

| Check                                                                   | Evidence                                                                                                                                   | Result |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Production preview request to `/dev/ui-exercise-request` returns `404`. | Provider-free smoke step returned `404`.                                                                                                   | Pass   |
| Production navigation contains no link to the gallery.                  | The implementation adds only the unlinked dev route and gallery component; no navigation file changed.                                     | Pass   |
| Provider-free smoke flow makes no exercise-provider call.               | The generated preview environment omitted OpenRouter values; the API returned `503 PROVIDER_NOT_CONFIGURED` and all 13 smoke steps passed. | Pass   |
