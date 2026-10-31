# P1 code review: search response ownership and mobile state (2026-10-31)

**Scope:** `world-intelligence/index.html` on `main` after the 2026-10-31 mobile merges (#422, #423). This is a **review and handoff**, not an implemented UI fix or a production test. Related existing issue: [#394](https://github.com/91cleaner/money-tracker/issues/394). Do not open a duplicate defect.

## Additional unguarded asynchronous rendering path

The existing issue already documents that the submit handler executes `await mtFirstCard(q)`, `await mtIntentCard(q)`, and `await tickerRoute(q)` without a request generation check, and that `mtGet` caches failed requests as `null`. A fresh read of the current source found **another stale-render path that a submit-handler-only fix would miss**:

- In `mtIntentCard(q)`, after the main card is rendered, `A.load(pl.symbol).then(...).then(c => { MTMood.render(mc,c,en); mc.hidden=false })` updates the shared `#moodCard` **later** without checking whether the user has since submitted another question. The follow-up `MTOpinions.render(box,...)` also performs asynchronous work; the UI owner should audit its DOM writes for the same ownership rule.
- `mtFirstCard(q)` and `mtIntentCard(q)` mutate `#briefTitle`, `#briefText`, `#briefStocks`, `#mtFirst`, `#moodCard` and route state after `await`. Checking the token only in the outer submit handler is insufficient because those functions already mutate the DOM before returning.
- `mtGet(p)` stores the Promise resolving to `null` after HTTP errors, JSON errors or network failure in `mtJson[p]`. The next question can therefore display absence when a transient fetch failed.

These are source-level findings; actual Safari/iPhone or production race reproduction was **not** performed in this review.

## Additional P1: stale route and clickable old choices during a new question

Fresh source review on `main` found a separate **question → map state-ownership** defect, not merely a delayed-response race:

- `start(c)` is the path that replaces `mission` and removes the old Leaflet `route`. The `ask` submit handler instead calls only `clearFirst()` before awaiting card/intent/index lookups; `clearFirst()` removes card content but **does not clear the existing mission, polyline, or map marker**. Successful `mtFirstCard(q)` / `mtIntentCard(q)`, and `showNone(q,r)` / `showCandidates(q)`, can display question B while the previously selected question A's map route remains visible. The old route visually implies an unsupported relationship with B.
- The submit handler also does not immediately disable/hide the previous `#candidatePanel`. If A's choices are open when B is submitted, those **old A buttons remain actionable during B's async loading**; clicking one invokes `start(A)` even though B is the current question. This is independent of the Promise-resolution-order issue.
- Evidence is the current source's `clearFirst`, `start`, `showCandidates`, `showNone`, `mtFirstCard`, `mtIntentCard` and `ask` submit paths. This is a **static control-flow finding**, not an observed production/iPhone screenshot.

**UI-owner acceptance:** On each new nonempty submission, synchronously retire/disable prior candidate choices and explicitly clear or mark the prior mission, route, marker, and any pending auto-play as stale. Commit a new route **only** for the latest request, and never leave A's line/marker on screen beneath B's unrelated fact card or "no data" state. Preserve deliberate navigation back to the world map and the existing source/AI-offline disclosures. Cover both mobile orientations and keyboard/touch actions. Do not change `data/` or collector code.

## Implementation contract for UI owner (Claude)

1. Allocate a monotonically increasing `requestId` **at every nonempty submit**, before clearing or loading anything. Pass `isCurrent = () => requestId === activeRequestId` into both card paths, `tickerRoute` handling, `showNone`, `showCandidates` and the route start callback. Recheck after **each** await and before **every** shared DOM/route mutation; return without rendering when stale.
2. Apply the same ownership check inside deferred `A.load(...).then(...)` mood rendering, and audit `MTOpinions.render` for delayed writes. AbortController can reduce network work but does **not** replace render-time checks.
3. Preserve in-flight deduplication for successful `mtGet` requests, but evict rejected/HTTP-error/JSON-error entries so the next query retries. Evict only if the cached Promise is still the one that failed (avoid deleting a newer request). Distinguish a valid empty result from a fetch error; do not turn either into a fabricated trade record.
4. On fetch failure, show an explicit **load failed / retry** state in the same panel. A retry must issue a fresh request and be available by keyboard and touch, including 375×667 portrait and 844×390 landscape.
5. Keep existing country/map controls, back/close behavior and the explicit **AI analysis not connected / real-time executed-trade feed not connected** disclosure. Delayed House PTRs are reports, not live executions.

## Deterministic regression matrix

| Case | Controlled sequence | Required result |
| --- | --- | --- |
| Old search finishes last | A starts, B starts, B resolves, A resolves | Only B's card, route, mood and source remain visible |
| Deferred mood finishes last | A card resolves, A mood stalls; B card and mood resolve; A mood resolves | Mood stays on B, no A mood flashes |
| Failure then recovery | Same JSON URL returns HTTP 500 once, then valid JSON | Second request performs a **new** fetch; success renders |
| Malformed JSON then recovery | 200 with invalid JSON, then valid JSON | Error is visible, retry fetches again |
| True empty data | 200 with schema-valid empty results | Explicit 'no matching records', not network failure |
| Shared in-flight request | Two concurrent reads of one URL, both successful | One fetch is reused, both receive the same valid data |
| Mobile touch/keyboard | 375×667 and 844×390, open failure and retry | Retry and close controls visible, no map-blocking sheet or unintended zoom |
| Route A then unrelated fact B | Start A's map journey; submit B and resolve a non-route fact card | A's polyline/marker/mission must not be shown as B's route |
| Old choices while B loads | Show A's candidate buttons; submit B with delayed fetch; click an old A button | A's old button is disabled/removed and cannot start an obsolete route |

## Verification and ownership

- Require a deterministic Node/browser regression test that controls Promise resolution order; static grep or a mocked standalone pattern alone is insufficient to certify the UI fix.
- Record the actual merged SHA, CI URL, Pages published SHA, browser console errors and mobile viewport evidence separately.
- `docs/AI-ROLES.md`: GPT handles review/docs; Claude owns `world-intelligence/` UI; data owner handles `data/`. **No source, data, collector, workflow, authentication or Pages deployment was changed by this review.** Owner approval required before merging any fix.


## 2026-11-01 02:53 KST follow-up: independent Leaflet overlay survives reset (P1)

Fresh `main` source inspection found a **second, independent map-overlay owner** outside the core `mission/route/marker` state already covered above. In `<script id="mt-living-map-controller">`:

- Local `last, route, pulse` are separate from the core route/marker variables. `acquire()` adds `L.marker(...).addTo(m)` and optionally `L.polyline(...).addTo(m)` to the same `window.moneyTrackerMap`.
- The `world` click handler only removes the banner class and sets `last=null`; it does **not** call `m.removeLayer(pulse)` or `m.removeLayer(route)`. `closeBrief` also hides only the banner. The core `world` handler cannot clean these private overlay references.
- `acquire()` returns immediately for a hidden brief or a brief whose text does not begin with a recognized country, **without clearing the previous pulse/line**. Submitting a new unrelated question or closing a card can therefore leave the old target overlay on the map even if the core mission/route cleanup is correctly implemented.
- The `MutationObserver` schedules `setTimeout(acquire,40)` without invalidation. A previously scheduled callback can run after a new submission/reset; the cleanup must be guarded by the same latest-request ownership rule.

**Required UI-owner fix (Claude):** expose a scoped `clearTargetOverlay()` within `mt-living-map-controller` that removes both layers from the actual Leaflet map, sets `pulse=route=last=null`, and hides/clears the banner. Invoke it synchronously on new nonempty submit, world/reset, close, and non-geographic/no-data states. Cancel or generation-guard delayed observer work; on a new valid geography, only commit overlays belonging to the current request. Avoid double-removing the core mission layers (different owners).

**Additional deterministic acceptance tests:**

| Case | Controlled sequence | Required result |
| --- | --- | --- |
| Secondary overlay reset | Select a route with recognized geographic steps, wait for `mtTargetPulse` and `mtPath`, click World | No `mtTargetPulse`, `mtPath`, banner, or old Leaflet target layer remains |
| A geographic to B non-geographic | A creates target pulse/path; submit B yielding a stock-only/no-data card | B does not retain A's independent pulse/path, even after pending 40ms observer callback |
| Close brief | A target visible, close the brief | Target overlay and banner are cleared consistently; reopening/research does not resurrect A |

**Verification boundary:** static read of `main` `world-intelligence/index.html` (the `mt-living-map-controller` script), not a browser reproduction. This commit changes **review documentation only**; UI code, tests, data, and Pages deployment remain untouched. Keep existing #394 / PR #424 as the single handoff, do not open a duplicate issue.
