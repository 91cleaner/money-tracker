# P1 UI review — free-form question entry is hidden in English mode

Reviewed 2026-11-04 06:55 KST against `main`. This is a **source-level reproducible UI contract finding**, not a claim that a live iPhone browser test or deployment was performed.

## Evidence (current `main`)

1. `world-intelligence/index.html` defines the question form as `<form id="ask"><input id="question" ...></form>` (near line 147) and handles its `submit` event to run the question → first card / intent card / ticker route / candidate choice pipeline (near line 218).
2. The later `<style id="mt-clean">` sets **`#ask{display:none!important}` unconditionally** (near line 851), regardless of language, viewport or selected route. A hidden form can still be submitted by code, but users cannot type into its input.
3. `assets/mt-tabs.js` immediately returns for `window.MTI18N.isEn` (near line 4). Its alternative visible **찾기** tab and ticker-symbol input are only created for Korean mode (near lines 44, 69–73). This tab accepts ticker symbols, not the free-form `#ask` question flow.
4. The default clean state also hides `#mtOneDock` (near lines 852–854). `assets/mt-side.js` relocates controls but does not create a replacement question input. The visible menu contains topic/ticker buttons, which are not a free-form question field.

**Result:** The English command-room entry appears to lack an accessible free-form question control, while the underlying question handler exists. Korean users may reach a ticker-only Find tab, but this does not fulfill arbitrary question → choice → map tracking. This is a **high-confidence static regression risk**; confirm exact visible behavior in desktop/mobile browsers before declaring the incident reproduced.

## Non-overlap

- [Issue #174](https://github.com/91cleaner/money-tracker/issues/174) concerns **skipping route selection after a ticker query**; it does not fix the missing question input.
- [Issue #394](https://github.com/91cleaner/money-tracker/issues/394), [PR #395](https://github.com/91cleaner/money-tracker/pull/395), [PR #424](https://github.com/91cleaner/money-tracker/pull/424) concern **out-of-order asynchronous results and failed fetch caching**; separate from input visibility.
- [Issue #259](https://github.com/91cleaner/money-tracker/issues/259) tracks mobile/English console polish. This finding should be assigned to the Claude UI owner rather than modified here.

## UI-owner acceptance contract

1. Provide **one persistent, visibly reachable free-form question input** in both `?lang=ko` and `?lang=en`, on desktop and iPhone portrait/landscape. It must use the existing `#ask` submit pipeline or an explicitly equivalent handler. Do not leave the input visually hidden behind an `!important` rule.
2. Preserve the map-first layout: compact bottom dock; no permanent map-covering panel; a visible close/reset action; input font-size **at least 16px on iOS** to prevent focus zoom.
3. Query → candidate choice → route trace must be demonstrable with both a known company and an open-ended geopolitical question. Unknown questions must clearly say AI is **NOT CONNECTED**, offering labeled demo routes rather than pretending to answer.
4. Preserve request-generation protection when users enter question B before A completes; after close/reset, stale responses must not repaint the map or briefing (coordinate with #394).
5. In the browser, verify `getComputedStyle(document.querySelector('#ask')).display` **is not `none`** if `#ask` remains the only question control; if an alternative form is added, verify its visibility, keyboard accessibility and actual submission instead.
6. Regression matrix: desktop 1280×800 KO/EN; mobile 390×844 KO/EN; iPhone landscape 844×390 KO/EN; keyboard focus, 16px font, typing without viewport zoom, submit, candidate selection, map flyTo, reset, and unavailable-data labeling. Capture screenshots and browser-console errors. Run the checks in CI and verify the **same commit** after Pages deployment.

## Additional release-gate gap — 2026-11-04 07:58 KST

**Confirmed by reading current `main` and PR #403 (not a browser reproduction):**

- PR [#403](https://github.com/91cleaner/money-tracker/pull/403)'s `scripts/check-pages-entry.py` checks the world command page for literal `id="map"`, `id="ask"` and the disconnected-data caveat. A hidden `#ask` still satisfies all three markers, so this gate can **pass while question entry is unusable**. It checks presence, not computed visibility or interaction.
- The PR's `tests/usa-map-smoke.test.cjs` asserts a query flow on **`usa-command-legacy.html`** (`#usQuery`, `assets/mt-command-ui.js`), not on the primary **`world-intelligence/index.html`** (`#ask`). Legacy smoke passing therefore does not establish that the current main command room supports typing a question.
- These are separate from the root country-selection and Pages byte-parity checks. A deployed file can be byte-identical and still have an unusable question field.

**Actionable blocking test for the UI/CI owners:** After Claude makes the free-form input reachable, add a real-browser smoke on the **primary** `world-intelligence/?lang=en` and `?lang=ko` entry (not just legacy HTML). For each, assert a keyboard-focusable visible question field, type a known question, submit, select a displayed candidate, confirm a map/briefing transition, close/reset, and confirm the field can be used again. Repeat at 390×844 and 844×390; assert iOS input font ≥16px and no permanently map-covering overlay. Fail the test if `#ask` is hidden and no functional replacement exists. A string-marker assertion alone is insufficient.

**Release rule:** PR #403 may address stale Pages/CI markers, but its success must **not** be reported as proof that question → selection → map tracking works. The UI owner must fix the input and demonstrate the new browser test on the exact release commit. No UI/CI code was changed by this review.

## Ownership and release status

Per `docs/AI-ROLES.md`, Claude owns screen files; GPT is review/docs only. **No UI, data, collector, workflow, deployment or test code was modified in this review.** This document does not prove the fix, CI pass, live deployment, or browser behavior. GitHub repository/Pages are **PUBLIC** (not private). Generative AI analysis and real-time independently verified congressional executions are **NOT CONNECTED**; House PTR is delayed public disclosure data. Merge only after owner approval.
