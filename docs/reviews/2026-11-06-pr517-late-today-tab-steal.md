# P1 mobile navigation review — late Today widget steals the selected tab (#517)

Reviewed 2026-11-06 08:54 KST against draft [#517](https://github.com/91cleaner/money-tracker/pull/517) head `29756a7312c92aef503bd8cd2cb7873b850453ec`, `assets/mt-tabs.js` blob `33d85a808c15f18c8a9a25e091a605eb6e6e56a6`. **Executed source in an isolated V8 mocked-DOM harness; not a real Chromium/iPhone or deployed Pages test.** Distinct from the already-fixed Today-node round-trip, retry-cache, ranking repaint and source-link issues.

## Root cause

`boot()` schedules a one-shot 2500ms callback:

```js
if (!tk && $('mtToday') && !root.contains($('mtToday'))) show('today');
```

This checks whether a late-created `#mtToday` node exists outside the tab root, **but not whether the visitor has since selected another tab**. When the widget appears after boot and the visitor is reading/searching another tab, the timer unconditionally calls `show('today')`. It overwrites the active tab and panel without any user interaction. The new `activeTab` state added in #517 is available but not used to guard this timer.

## Deterministic executed reproduction

1. Execute the exact #517 source with `document.readyState = 'complete'`, mocked `setTimeout` and DOM, `#mtToday` initially absent, and valid mocked daily JSON.
2. Run the 400ms boot callback. Then click the **찾기** tab. Observed `aria-selected=true` on `find` and the ticker search form in `#tbPanel`.
3. Simulate the asynchronous Today widget being added outside the tab root before 2500ms.
4. Run the scheduled 2500ms callback. Observed `aria-selected=true` on **today** and the Today widget replacing the search form **without a click**.

The isolated harness reported `before.selected = "find"`, `after.selected = "today"`, `issue = true`. This is a deterministic control-flow reproduction, **not proof that a real user or production browser has experienced it**.

## Owner fix / acceptance

- Limit late-widget auto-mount to `activeTab === 'today'`; when another tab is active, preserve its DOM, focus, scroll position and user-entered search text. On a later intentional Today click, attach the original widget by node identity.
- Add a fake-timer regression to `tests/mt-tabs-load.test.cjs`: widget absent at boot → user opens `find` or `mem` → widget appears → advance to 2500ms → selected tab and panel remain unchanged. Then explicitly click Today and assert the widget appears. Cover widget present at boot and widget never created.
- Run desktop Chromium and iPhone portrait/landscape checks including typing into the Find input before the timer fires. Verify focus and input text are not lost.
- Keep #517 Draft and unmerged pending Claude (UI owner)/실장 review. **No UI, data, collector, CI or production code changed by this review.** House PTR is delayed public filing, not live executions; generative AI is disconnected. Repository visibility is public, not private.
