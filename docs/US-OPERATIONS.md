# MONEY TRACKER US — operational truth and release gates

Last source review: 2026-10-31 KST. This is an **implementation/status guide**, not a declaration that the public service or private command room is production-ready. See [AI-ROLES.md](AI-ROLES.md) for file ownership and PR approval.

## 1. Navigation / command map
- `/us.html` enters `/world-intelligence/`; `/world-intelligence/us-signals.html` is the US research view.
- The flat map supports country exploration and wheel/pinch zoom. External basemap tiles are **not live satellite intelligence**.
- Search → choice → map tracking is not fully verified: [#394](https://github.com/91cleaner/money-tracker/issues/394) tracks out-of-order responses and cached fetch failures. Do not call this fixed because a review PR exists.

## 2. Historical / legislative context
- `data/us-events.json` contains curated events with source links.
- `data/us/bills.json` contains Congress.gov legislative summaries; the collector requires its own API credential.
- Temporal proximity between bills, filings, events and market prices is **not proof of influence or causation**.

## 3. Official economic observations
- `scripts/collect_us_macro.py` fetches FRED observations; `.github/workflows/us-data.yml` attempts the collection.
- The workflow can continue after a failed macro or House-index step and writes `data/us-ingestion-status.json`. A green workflow or an existing JSON file **does not establish freshness or coverage**.
- Before displaying a current value, inspect the source observation date, file health, and actual last successful retrieval. If unavailable, label it unavailable/stale rather than substituting an older observation as current.

## 4. Congressional disclosures: distinguish four evidence levels

| Dataset / process | What it establishes | What it does **not** establish |
| --- | --- | --- |
| `scripts/collect_house_filings.py` → `data/us-house-filings.json` | House Clerk **filing metadata** (member, filing type/date, source PDF URL) | Individual transaction amounts or parsed securities |
| `scripts/build_ptr_research_queue.py` → `data/us-ptr-research-queue.json` | PTR documents eligible for review | Verified transactions |
| `scripts/extract_house_ptr.py` → `data/us/house-ptr-candidates.json` | Machine-parsed rows from some digital House PTR PDFs, explicitly marked `machine_parsed_requires_review` | Human-verified rows, complete House coverage, scanned-paper extraction |
| `collector/us/trades.py` → `data/us/trades.json` | Separately parsed House PTR rows and attempted Senate eFD electronic PTR rows; disclosure amount **ranges** and original links | Independently executed trades, complete Senate/House coverage, real-time prices or executions |

- `data/us/ptr-crosschecks.json` records field-level checks against House Clerk PDFs where available. Check the actual record/field status; the existence of this file does **not** certify every row.
- Senate eFD access may fail or be incomplete. `collector/us/trades.py` skips scanned PDFs and some failed individual PDF requests; a non-200 House PDF response currently can be skipped without a per-document error log. Consequently, a fresh `updated` field and a successful index scan **do not prove all filings were processed**.
- `d` is transaction date; `fd`/`filed` is disclosure filing date where available; `updated` is collection time. Do not mix them or describe PTR as a live execution feed.
- `data/us-disclosures.json`, if present as an empty verified-transaction placeholder, must **not** be used to conclude there were no trades. Do not overwrite candidate/review files with a differently scoped dataset.
- On any card/map, require source PDF, disclosure date, amount band, explicit coverage and an incomplete/unverified label when needed. Missing identity or filing date is not permission to fabricate a match.

### Weekly House PTR card release gate
- `.github/workflows/weekly-congress-card.yml` on `main` currently allows collector/member-step failures and can dispatch deployment after failed push retries. [PR #327](https://github.com/91cleaner/money-tracker/pull/327) proposes fail-closed checks and regression tests but is **unmerged as of this review**.
- Even the proposed guard does not detect every silently skipped individual House PDF. The data owner must log/flag non-200 PDF requests and test partial coverage before claiming a complete weekly card.
- `scripts/weekly/congress_trades_card.py` may fall back from the requested week to the latest week with filings. The fallback must be visible, never labelled as this week's executions. Member-to-district matching omissions must be reported rather than silently treated as a complete sample.

## 5. Security and production release gate
- Repository and GitHub Pages are **public** as checked on 2026-10-31. Hidden links, `noindex`, front-end PINs and client-side flags are not access controls.
- Authenticated Cloudflare Worker `/command` source synchronization is **not** proof of a successful Worker deployment or owner-only protection. Independently test anonymous HTML/JS/JSON/API requests and an authenticated session; see [US_PRIVATE_ACCESS.md](US_PRIVATE_ACCESS.md).
- **Generative AI analysis: NOT CONNECTED. Live executed-trade feed: NOT CONNECTED.** Do not imply otherwise based on API-key presence, static snapshots or a successful Pages build.

## Verification before declaring any US feature complete
1. **Source:** confirm the official source URL and document/observation date for a sample of displayed records, including missing/partial cases.
2. **Pipeline:** check the relevant GitHub Actions step outcome, row counts, error logs and committed artifact; a workflow marked `success` is insufficient on its own.
3. **Regression:** run the corresponding unit/health checks (e.g. `python -m unittest discover -s tests -p 'test_house_ptr_extraction.py'` and `python scripts/check_world_intelligence.py`) and record the commit SHA.
4. **Release:** verify the deployed page/Worker independently from the CI build, including 375×667 and 844×390 mobile views, failed-network/retry states, source links, and anonymous access.
5. **Approval:** branch → PR → owner review before merge. No UI/collector/data changes are authorized by this document.
