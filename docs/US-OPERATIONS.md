# MONEY TRACKER US — operations and release verification

> Updated 2026-10-30. This document distinguishes code that exists from independently verified production behavior. A passing workflow or a Pages deployment is **not** proof that every filing was collected, parsed, or linked correctly.

## 1. Navigation and command map
- `/us.html` links into `/world-intelligence/`; `/world-intelligence/us-signals.html` provides U.S. research context.
- The map depends on external basemap/CDN availability. A successful static build does not verify mobile pinch zoom, question → choice → map tracking, or the live authenticated Worker.
- Test 375 px and 390 px portrait widths and landscape on a real phone before declaring mobile UX complete. Confirm search focus does not zoom the page, the close/back controls remain visible, and the map can be re-entered after a detail view.

## 2. Historical, legislative, and macroeconomic context
- `data/us-events.json` contains curated dated events with source URLs. Temporal proximity is **not** evidence of causation or a trading signal.
- `data/us/bills.json` contains Congress.gov-derived bill summaries; collecting new Congress.gov data requires an API key. A bill → member → company association is a research link, not evidence of misconduct.
- `scripts/collect_us_macro.py` collects public FRED observations into `data/us-macro.json` on successful runs. Missing or stale observations must not be silently replaced with invented values.

## 3. Congressional financial disclosures: actual coverage and limits
Two distinct pipelines exist; do not describe either as verified real-time executions.

**Filing metadata**
- `scripts/collect_house_filings.py` fetches House Clerk filing indexes into `data/us-house-filings.json` after successful collection.
- These entries establish that a filing was indexed, **not** that its individual securities or amounts have been verified.

**Transaction extraction candidates**
- `collector/us/trades.py` reads House Clerk annual ZIP/XML indexes, fetches eligible electronic PTR PDFs and extracts transaction-like rows with `pdfplumber`. It also attempts Senate eFD collection, which may fail or be blocked. It writes `data/us/trades.json`.
- House rows can include `doc` (official House Clerk PDF URL), `filed` (index filing date), `d` (reported transaction date), `fd` (date parsed from a PDF row), and `amt` (reported amount **range**). These fields are not interchangeable.
- The PDF parser skips scanned/handwritten reports. Extraction candidates are **not** independently confirmed executions, complete House/Senate coverage, or a validated investment-return dataset. Consult `data/us/ptr-crosschecks.json` for available field-level source comparisons; do not assume all rows were cross-checked.
- **Known P1 loss mode:** `house()` silently skips a non-200 response for an individual PDF. It also adds a PDF to `done` after a parsing exception, preventing automatic retry on later runs. Both require collector-owner changes and source-based regression tests. An updated timestamp alone cannot prove completeness.
- **Known P1 presentation gap (#305):** `scripts/weekly/congress_trades_card.py` reduces card rows to asset, side, amount and transaction date; `weekly/latest.json` consequently lacks per-row PDF links and filing dates. The static `This week` title can mislead when `pick_window()` falls back to older filings. Do not describe the weekly card as fully source-auditable until fixed.

## 4. Weekly House PTR publication gate (PR #327)
- Workflow: `.github/workflows/weekly-congress-card.yml`. Proposed PR #327 removes ignored collector errors, requires a fresh House index/scan log and blocks deployment dispatch after exhausted Git push retries.
- The proposed check rejects missing/old `updated`, collector-logged House errors and time-budget exhaustion. **It cannot detect unlogged individual PDF HTTP failures or recover reports already marked `done` after parsing errors.**
- Tests: `python -m unittest discover -s tests -p 'test_weekly_workflow_guard.py' -v`. A test pass proves the simulated cases, not a successful production collection.
- **As checked on 2026-10-30:** PR #327 is open. Two checks on its latest commit succeeded; the map smoke check failed due to stale Korea-home text assertions. PR #328 fixes those assertions and its three checks passed, but it is also open. Neither PR is verified as merged or deployed. Recheck status at review time.

### Release acceptance checklist
1. Reproduce current-year House Clerk index retrieval and confirm individual PDF failures are logged, retried safely, and never silently treated as complete.
2. Confirm PDF parse errors are not permanently added to `done` until an explicit, reviewable terminal disposition is recorded.
3. Compare representative `doc`, `filed`, `d`, `fd`, and `amt` values with the **original official filing**. Reject future-dated or impossible date sequences for manual review rather than rewriting them by guess (#317).
4. Keep official per-row source URLs and filing dates in the published JSON and UI; label fallback windows by their **actual dates**, not simply `This week` (#305).
5. Require full relevant CI success, successful push, confirmed Pages deployment and a live-site source-link/phone check. A Pages 200 response alone is insufficient.
6. Merge only after owner review and coordination with the data collector and UI owners; avoid concurrent edits to `data/`, collector files, or world-map screens.

## 5. Access control, deployment, and truthful connection labels
- **The repository and GitHub Pages are public as of this review.** `noindex`, obscured URLs and frontend passwords are not access control. Do not upload proprietary/private datasets, API credentials or admin-only assets there.
- A Cloudflare Worker route with OAuth must be separately deployed and tested for unauthenticated denial and authenticated access. GitHub OAuth does **not** mean only two physical devices can connect. Worker synchronization into source is not deployment; check Wrangler size/deployment independently (known Worker size issue #289).
- **Generative AI analysis: NOT CONNECTED. Live executed-trade feed: NOT CONNECTED.** Public congressional PTRs are delayed disclosures. Distinguish unavailable, stale, candidate-extracted and source-checked data in every release note.
- Keep secrets in protected server-side settings; never print API keys or OAuth credentials.

## 6. Routine checks
- `.github/workflows/us-data.yml`: scheduled U.S. data collection; inspect source HTTP responses, extraction coverage, commit success and data freshness, not just green workflow status.
- `.github/workflows/world-intelligence-health.yml` and `python scripts/check_world_intelligence.py`: static and syntax checks. These do not replace browser/mobile or authenticated-route tests.
- `.github/workflows/collect.yml`: legacy Korean municipal collection.
- After each relevant deployment, record the commit SHA, workflow run URL, deployed URL, source-file sample, and whether the verified content matches the current commit.
