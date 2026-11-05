# P1 review — malformed public rows poison the retry cache (#513)

Reviewed 2026-11-05 20:53 KST against [draft PR #513](https://github.com/91cleaner/money-tracker/pull/513), head `4fc549584dc3a939b43da15f8ce2af0f2fbcd06d`. **This is a verified mocked-runtime regression, not a live browser/Pages deployment test.** No UI, collector, `data/`, CI or production files were changed in this review.

## Reproduction and impact

`assets/mt-tabs.js` checks that `loaded.trades` / `loaded.items` is an array and **assigns `TR = loaded` / `WH = loaded` before rendering individual entries**. An array containing `null` passes the top-level check, but `t.map(x => x.who)` or `WH.items.filter(x => x.kind)` throws. The catch renders the new **retry** button; the cache is already populated, so `if (!TR)` / `if (!WH)` is false on every retry. Even after the server recovers, retry never refetches and the error is sticky until page reload.

A small V8 mock executed the **actual PR source** with the following deterministic cases (not a source-only guess):

| Tab | First HTTP 200 JSON | Next HTTP 200 JSON (available if refetched) | Observed after clicking retry |
| --- | --- | --- | --- |
| 의원 (`mem`) | `{"trades":[null]}` | `{"trades":[{"who":"Example","tk":"NVDA","d":"2026-11-05","fd":"2026-11-05","amt":"$1","ty":"P"}]}` | Error remains; **1 total request**; no `1건` |
| 백악관 (`wh`) | `{"items":[null]}` | `{"items":[{"kind":"presdoc","date":"2026-11-05","u":"https://www.federalregister.gov/","type":"Executive order"}]}` | Error remains; **1 total request**; no `1건` |

Both cases reproduced: first error displayed, retry still displayed error, retry did not issue a second fetch. This is a **synthetic malformed payload**, not a claim that the live public JSON currently contains `null`.

## Required owner fix and acceptance gate

1. Claude/UI owner: validate entries **before committing data to `TR` or `WH`**, or clear the relevant cache on any render/shape failure; ideally do both and make malformed-row handling explicit. Do not silently turn malformed data into a verified `0건`.
2. Retry must issue a **new network request** after malformed rows, then display the recovered rows. Test both tabs, including `null`, non-object, and unexpected field types; no unhandled exception or false zero.
3. Preserve the existing `showSeq` guard: switching tabs while a failed request is pending must not repaint the active tab; stale responses must not poison the active display.
4. Wire these regression cases into `tests/mt-tabs-load.test.cjs` and run the test in CI on the same PR SHA. Verify mobile portrait/landscape retry visibility and a live Pages post-merge deployment separately.
5. Maintain source-date distinctions, the **public House PTR delayed-disclosure** caveat, **real-time executed trades DISCONNECTED**, and **generative AI DISCONNECTED**.

## CI/release context (observed, not fixed here)

For PR #513 commit `4fc5495`: [Command smoke](https://github.com/91cleaner/money-tracker/actions/runs/42014625444) succeeded; [map smoke](https://github.com/91cleaner/money-tracker/actions/runs/42014625438) failed on the old country-entry assertion in `tests/usa-map-smoke.test.cjs:68`; [security](https://github.com/91cleaner/money-tracker/actions/runs/42014625472) failed on the obsolete `href="intel-lab.html"` check. These last two are already addressed in **unmerged PR #403**, so this review does **not** duplicate that work.

The new malformed-row cache defect is distinct from #513's existing HTTP/JSON rejection and late-response tests. **Do not mark #513 production-verified or merge without UI owner review.** Repository and Pages are currently **public**, not private.
