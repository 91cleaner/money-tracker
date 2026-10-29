# MONEY TRACKER

A public-source intelligence prototype connecting world history, legislation, macroeconomic data, and U.S. congressional financial disclosures on a **flat world map**.

## Entry points (verified against `main`, 2026-10-30)
- `index.html` — **English U.S.-first redirect** to `world-intelligence/?lang=en`; existing query parameters and the URL fragment are preserved. It is **not** the country-selection screen.
- `korea.html` — Korean-language country-selection page, with links to the Korean national view and the U.S. command room.
- `world-intelligence/index.html` — flat world-map command center and guided country exploration.
- `world-intelligence/us-signals.html` — U.S. macro, history, and House PTR disclosure research.
- `us.html` — U.S. command entry.

**Connection status:** Public House PTR disclosures are delayed reports, not live executions. **Live executed-trade feed: NOT CONNECTED. Generative AI analysis: NOT CONNECTED.** The interactive map and scripted data lookups must not be described as live trading intelligence or a connected AI search engine. A successful GitHub Actions test is not evidence that the public Pages deployment or authenticated Cloudflare Worker is working.

## Verified data and caveats
- `data/us/bills.json` — U.S. congressional legislation summary from Congress.gov. The **Congress.gov API requires a key** for its collection workflow; this is separate from the map.
- `data/us/trades.json` — parsed public U.S. House PTR transactions, linked to House Clerk source PDFs. Transaction amounts are ranges; records are not investment advice or evidence of misconduct. The Senate index has reported HTTP 403 errors; do not imply complete Senate coverage.
- `data/us/insider-form4.json` — **separate SEC EDGAR Form 4 corporate-insider filings** (officers/directors/other reporting persons at tracked issuers), with filing date (`filed`), reported transaction date (`date`), P/S code, shares, reported price and SEC filing link where available. This is **not** a congressional House PTR feed, does **not** identify a lawmaker's trades, and is not a real-time execution feed. The committed snapshot reports `updated: 2026-10-29` and a 90-day collection window; coverage is limited to tracked issuers and the collector's supported transaction codes. Do not combine Form 4 and House PTR rows or imply a member-to-company relationship without independently verified identifiers and original sources.
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
- **Blocking release issue (checked 2026-10-30):** The generated Worker exceeded the repository's 1 MiB GitHub Contents API health-check limit (1,051,223 bytes versus 1,048,576 bytes; [#289](https://github.com/91cleaner/money-tracker/issues/289)). A passing Pages build or a successful Worker source-sync commit does **not** mean the authenticated command room was deployed. Re-measure the generated file and verify the live authenticated route before marking it operational.
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

**Important:** The GitHub repository and GitHub Pages site are currently **public**, despite the intended private-development workflow. `noindex`, hidden links, or client-side controls are not authentication and do not restrict access to specific devices. Do not place secrets, unpublished research, or private datasets in the repository or Pages artifacts. Proper device-only access requires an authenticated gateway or private hosting; the Cloudflare OAuth session described above does not make GitHub Pages private.

## Principles
1. Cite original official public sources and distinguish source dates, event dates, transaction dates, and ingestion times.
2. Mark incomplete, inaccessible, stale, and unverified data explicitly.
3. Do not infer stock returns, insider misconduct, or causal links from temporal proximity.
4. Treat the intelligence-terminal visuals as a simulation, never as classified or live intelligence.
