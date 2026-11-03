# US PTR world-map layer: chronology and failure-state review (2026-10-30)

**Scope:** independent code/data review of merged PR #311. No production code, data, map UI, or collector modified. This is a review handoff to the data owner (실장) and UI owner (클로드), under `docs/AI-ROLES.md`.

## Reproduced against main (2026-10-30 10:57 KST)

- `data/us/trades-recent.json` (blob `aeb7c46f42cb5cb9312434745d25d69895921e42`) has `updated: "2026-10-27"` and 20 rows. **1/20 rows has transaction date later than filing date:** Pete Sessions / DIS / `d: "2026-10-28"` / `fd: "2026-10-27"`. The same row is dated *after* the snapshot's `updated` date. A filed disclosure cannot report a transaction that has not yet occurred. This is a **local data chronology inconsistency**, not a claim about the contents of the linked official PDF.
- All 20 rows have a `doc` URL and matched a House (`chamber: "rep"`) member under the layer's exact name-matching algorithm; the anomaly is **not** explained by an unmatched member or absent link. The 20 rows all reference the same House Clerk PDF URL; the PDF contents and every row's transaction details have **not** been independently verified in this review.
- `assets/mt-us-layer.js` (blob `2def9dcc72abd9bd8bcaa856eccd96cf6c801b5a`) displays `t.d` and `t.doc`, but **not** `t.fd` or the dataset's `updated` timestamp. The map popup therefore cannot distinguish transaction date from filing date or show freshness.
- Its `J()` fetch helper converts HTTP failures and parse errors to `null`; `load()` memoizes that resolved empty result in `busy` without a retry path. A transient failed fetch can leave an apparently empty US PTR layer until page reload, without an error/stale message.
- The popup's `href` interpolates `t.doc` after HTML escaping, but without validating HTTPS and the official House Clerk host. Escaping prevents HTML attribute breakout, **not** unsafe URL schemes. Future untrusted records must not create arbitrary clickable URLs.

## Required owner fixes and acceptance checks

1. **실장 / data:** reconcile the DIS row against the original House Clerk PDF before editing the dates. Preserve both `d` (transaction date) and `fd` (filing date), plus the exact official source URL. If unresolved, quarantine the row or mark it unverified; **do not invent a corrected date**. Add a collector/test invariant `d <= fd <= snapshot_updated` for ISO dates, allowing an explicit documented exception only if the source really requires it. Do not label machine-extracted candidate transactions as verified executions.
2. **클로드 / UI:** display distinct `Traded` / `Filed` fields and the last successful snapshot date in the popup. When `fd`, `doc`, or the source-verification state is missing, show a clear unavailable/unverified state instead of implying verification. Only render an outbound link for validated `https://disclosures-clerk.house.gov/...` URLs.
3. **클로드 / UI:** expose loading, error, stale, and no-matching-record states separately. A failed fetch should permit explicit retry; do not cache a failed fetch as a permanent successful empty dataset. Check 375px and 390px widths for legibility and popup close/touch behavior.
4. **Tests / release:** add fixtures for (a) transaction after filing, (b) transaction after snapshot, (c) valid transaction/filing dates, (d) missing/unsafe `doc`, (e) failed HTTP/JSON followed by successful retry, and (f) ambiguous name match. Run the repository tests and deployed Pages/mobile smoke tests; report the exact run links and commit SHAs.

## Status and non-claims

- **Verified in this review:** local JSON field comparison (20 rows, 1 chronology failure), member name matching (20/20), and static source-code paths above.
- **Not verified:** House Clerk PDF content, runtime/browser behavior, automated CI, Cloudflare Worker deployment, or a fixed production release.
- Public House PTR data are delayed **disclosures**, not real-time executions. **Generative AI analysis: disconnected. Live executed-trade feed: disconnected.**
- Related but separate: #305 covers weekly PTR cards, not this new map-layer chronology regression; #289 covers Worker size. Do not close either based on this review.
