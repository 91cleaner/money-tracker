# MONEY TRACKER

A public-source intelligence prototype connecting world history, legislation, macroeconomic data, and U.S. congressional financial disclosures on a **flat world map**.

## Release and connection status (reviewed 2026-11-02; not production certification)
- **Repository visibility: PUBLIC**, not private. The static GitHub Pages site is public as well. A Cloudflare OAuth-protected route does **not** protect files committed to this repository or published as static Pages assets.
- **Generative AI analysis: NOT CONNECTED. Real-time executed-trade feed: NOT CONNECTED.** House PTR entries are delayed *reported disclosures*; map routes and derived price comparisons are research visualizations, not verified live executions or investment signals.
- **Public data release is not yet verified:** [PR #403](https://github.com/91cleaner/money-tracker/pull/403) repairs Pages entry/deployment checks; [PR #412](https://github.com/91cleaner/money-tracker/pull/412) adds public PTR chronology and field guards; [PR #458](https://github.com/91cleaner/money-tracker/pull/458) adds public JSON byte-parity checks. These PRs were open at review time. Isolated green PR checks are **not** proof of a merged, verified live deployment. The Pages publisher/source setting and exact published SHA still need independent verification.
- **Collection health is per-source, not a universal success flag.** A collector returning zero rows *with fetch errors* is a failure/unknown result, not proof that zero records exist. Surface the error, collection timestamp and official source; never silently replace failures with zero.
- **Merge/release decision:** follow [measurable release gates](docs/metrics-and-release-checklist.md), test the combined approved SHA, verify the full public artifact/anonymous URLs and live Pages bytes, and separately test the Worker. No PR is merged by this README change.

## Entry points
- `index.html` — country selection
- `world-intelligence/index.html` — flat world-map command center and guided country exploration
- `world-intelligence/us-signals.html` — U.S. macro, history, and House PTR disclosure research
- `us.html` — U.S. command entry

## Verified data and caveats
- `data/us/bills.json` — U.S. congressional legislation summary from Congress.gov. The **Congress.gov API requires a key** for its collection workflow; this is separate from the map.
- `data/us/trades.json` — parsed U.S. House PTR disclosure ledger, linked to House Clerk source PDFs. The repository currently exposes this committed file publicly even when a Pages build excludes it; do **not** treat the source ledger as confidential because of a static-site denylist. Transaction amounts are ranges; records are not investment advice or evidence of misconduct. The Senate index has reported HTTP 403 errors; do not imply complete Senate coverage.
- `data/us-events.json` — curated historical milestones with source URLs, not causal investment signals.
- `data/us-macro.json` — generated only after a successful FRED data collection run; it may be absent.
- `data/us-house-filings.json` — generated only after successful House Clerk index collection; it may be absent.
- `data/index.json`, `data/city/` — legacy Korean municipal contract data.

## Map
The map uses Leaflet with keyless OpenStreetMap/CARTO basemap tiles and optional Esri satellite imagery. **No map API key is required.** It depends on external tile/CDN availability; a simplified offline schematic is shown when providers cannot be reached. The satellite imagery is not a live satellite feed. The country-to-country lines show exploration paths, not proof of causation.

## Authenticated command room
- Cloudflare Worker `/command` is built from `world-intelligence/index.html`, rather than maintaining a separate schematic map. `/evidence.js` and `/data/us/*` routes require the existing GitHub OAuth administrator session.
- `python scripts/sync_command_worker.py` embeds a compact, source-linked Congress.gov bill snapshot and the current House PTR research candidates into `cloudflare/admin-worker.js`. Every bill remains available; long action descriptions are shortened in the Worker only. The original full data stays in `data/us/bills.json`.
- `.github/workflows/sync-command.yml` regenerates the Worker when map or evidence data changes. `us-data.yml` also regenerates it after scheduled collection.
- **Source synchronization is not a Cloudflare deployment.** The Worker still requires a successful Wrangler deployment, and live `/command` functionality must be tested after deployment. GitHub OAuth access is not device-only access.
- `data/us/ptr-crosschecks.json` records field-level comparison with original House Clerk PDFs. It verifies what a disclosure **reported**, not independently executed trades, ownership, or any connection to legislation.

## Collection and validation
- `.github/workflows/us-data.yml` — scheduled FRED macro and House filing index collection.
- `.github/workflows/collect.yml` — legacy Korean municipal contract collection (requires `DATA_GO_KR_KEY` repository secret).
- `collector/kr/labor.py` → `data/kr/labor.json` — Korean strike / labor-dispute filings (OpenDART titles containing 파업·노사분규·생산중단·영업정지, linked to tracked Korean stocks by company name) and optional monthly industry dispute statistics. Shown on `labor.html`, sector pages and the heat map. Daily workflow template: `docs/workflows/collect-kr-labor.yml` (copy it into `.github/workflows/`).
  - **DART key (free):** sign up at <https://opendart.fss.or.kr> → 인증키 신청/관리 → add it as repository secret `DART_API_KEY`. Without it that part is skipped; the key is never printed.
  - **Ministry of Employment and Labor stats:** apply for the dispute-statistics dataset on <https://www.data.go.kr>, put the endpoint in repository variable `LABOR_STATS_URL` and reuse secret `DATA_GO_KR_KEY`. Skipped until both exist.
  - **National Labor Relations Commission mediation filings:** not collected — no key-free public API or regular file was verified. The reason is recorded in `data/kr/labor.json` `sources`.
  - A filing title match is not proof of a strike or of any price effect.
- `.github/workflows/world-intelligence-health.yml` — static map and data integrity checks.
- `python scripts/check_world_intelligence.py` — local read-only health check. With Node.js installed, also checks inline JavaScript syntax.

**Important:** GitHub Pages is public. `noindex`, hidden links, or client-side controls are not authentication and do not restrict access to specific devices. Proper device-only access requires an authenticated gateway or private hosting.

## Principles
1. Cite original official public sources and distinguish source dates, event dates, transaction dates, and ingestion times.
2. Mark incomplete, inaccessible, stale, and unverified data explicitly.
3. Do not infer stock returns, insider misconduct, or causal links from temporal proximity.
4. Treat the intelligence-terminal visuals as a simulation, never as classified or live intelligence.
