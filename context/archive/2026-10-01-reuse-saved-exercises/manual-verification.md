# Manual Verification

- **Date:** 2026-10-02
- **Browser:** Chromium (VS Code integrated browser)
- **OS:** Windows
- **Development gallery:** `http://127.0.0.1:4323/dev/ui-saved-exercises`
- **Production boundary:** verified by `npm run smoke` against the production preview; `/dev/ui-saved-exercises` returns 404.
- **Status:** Confirmed by reviewer.

## Captured States

- **Desktop (1440 x 1000):**
	- `screenshots/desktop-initial.png`
	- `screenshots/desktop-loading.png`
	- `screenshots/desktop-populated.png`
	- `screenshots/desktop-terminal.png`
	- `screenshots/desktop-empty.png`
	- `screenshots/desktop-search-error.png`
	- `screenshots/desktop-load-more-error.png`
- **Mobile (390 x 844):**
	- `screenshots/mobile-initial.png`
	- `screenshots/mobile-loading.png`
	- `screenshots/mobile-populated.png`
	- `screenshots/mobile-terminal.png`
	- `screenshots/mobile-empty.png`
	- `screenshots/mobile-search-error.png`
	- `screenshots/mobile-load-more-error.png`
- **Keyboard focus:** `screenshots/desktop-keyboard-focus.png`

## Accessibility And Responsive Review

- Keyboard traversal begins with the labeled gallery controls (`Light`, then `Dark`) and continues to named state controls and the exercise form controls. The focus specimen is retained.
- Form controls expose Polish labels for grade, topic, and difficulty; commands expose `Pokaż zadania`, `Wczytaj więcej`, and `Spróbuj ponownie` names.
- Feedback is presented through the view's polite live region. Error states retain the applied-filter summary and previous result cards.
- Desktop and mobile captures show readable Polish copy, wrapping result metadata, and no application overlap or clipping in the captured states.
