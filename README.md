# MONEY TRACKER

A public-source intelligence prototype connecting world history, legislation, macroeconomic data, and U.S. congressional financial disclosures on a **flat world map**.

## Release and connection status (checked 2026-11-04)
- **Public access:** this GitHub repository and its GitHub Pages site are public. The repository tracks `data/us/trades.json`: excluding that file from the Pages build **does not make it private on GitHub**. Do not commit secrets, privileged annotations, or nonpublic records here. A separately authenticated Cloudflare route does not make Pages or the Git repository private.
- **Live executed-trade feed: NOT CONNECTED.** House Periodic Transaction Reports (PTRs) are delayed *self-reported disclosures*, not independently confirmed exchange executions. Their amounts are disclosed ranges, not exact prices or returns.
- **Generative AI analysis/search: NOT CONNECTED.** Guided map journeys and locally stored evidence should not be described as live AI responses.
- **PTR chronology release blocker (2026-11-08):** [#527](https://github.com/91cleaner/money-tracker/issues/527) documents a reported House PTR transaction date later than the collection date; the original House Clerk PDF still needs field-by-field reconciliation. The stricter [#526](https://github.com/91cleaner/money-tracker/pull/526) preflight has blocked generated Pages output on a future transaction date, but is **draft/unmerged**. Do not mark those rows verified, report the affected aggregates as accurate, or infer that a green Pages deployment validates chronology. The data owner must correct or quarantine unresolved rows and rerun preflight on the exact release SHA before production approval.
- **Missing or failed data ≠ zero events.** A failed HTTP request, invalid JSON schema, stale snapshot, or absent collection must be labeled **UNAVAILABLE / ERROR / STALE**, not presented as a verified zero. [Issue #478](https://github.com/91cleaner/money-tracker/issues/478) tracks this UI risk.
- **Unmerged fixes are not deployed protections:** [#403](https://github.com/91cleaner/money-tracker/pull/403) (Pages/CI entry checks), [#412](https://github.com/91cleaner/money-tracker/pull/412) (PTR chronology quarantine), [#458](https://github.com/91cleaner/money-tracker/pull/458) (public JSON parity), and [#479](https://github.com/91cleaner/money-tracker/pull/479) (US signals JavaScript repair) were open proposals when checked. Do not infer production readiness from their branch tests.


## Entry points
- `index.html` — country selection
- `world-intelligence/index.html` — flat world-map command center and guided country exploration
- `world-intelligence/us-signals.html` — U.S. macro, history, and House PTR disclosure research
- `us.html` — U.S. command entry

## Data sources and verification limits
- `data/us/bills.json` — U.S. congressional legislation summary from Congress.gov. The **Congress.gov API requires a key** for its collection workflow; this is separate from the map.
- `data/us/trades.json` — extracted House PTR **reported transactions** with links to House Clerk PDFs. Extraction and source linking do not independently verify execution, ownership, ticker identity, or transaction chronology. Amounts are reported ranges, not exact trade values. These records are neither investment advice nor evidence of misconduct. Senate coverage is incomplete (HTTP 403 reported).
- `data/us/trades-recent.json` — a limited recent PTR snapshot, **not a complete or real-time feed**. A reported transaction/filing-date reversal remains subject to original-PDF reconciliation; proposed public-artifact quarantine is in unmerged [#412](https://github.com/91cleaner/money-tracker/pull/412). Never treat its 20-row sample as total congressional activity.
- `data/us/trades_public.json` — a reduced public summary generated for Pages by `scripts/build_public_trades.py`. The separate `data/us/trades.json` source ledger is excluded from the **Pages artifact only** by `scripts/prepare-public-pages.py`; both tracked files remain accessible in this public GitHub repository. The US signals page's proposed switch to the public summary is in unmerged [#479](https://github.com/91cleaner/money-tracker/pull/479).
- `data/us-events.json` — curated historical milestones with source URLs, not causal investment signals.
- `data/us-macro.json` — generated only after a successful FRED data collection run; it may be absent.
- `data/us-house-filings.json` — generated only after successful House Clerk index collection; it may be absent.
- `data/index.json`, `data/city/` — legacy Korean municipal contract data.

## Map
The map uses Leaflet with keyless OpenStreetMap/CARTO basemap tiles and optional Esri satellite imagery. **No map API key is required.** It depends on external tile/CDN availability; a simplified offline schematic is shown when providers cannot be reached. The satellite imagery is not a live satellite feed. The country-to-country lines show exploration paths, not proof of causation.

## Cloudflare command room — source-level access design, deployment not verified
- The Worker source builds `/command` from `world-intelligence/index.html` rather than a separate schematic map, and is designed to require a GitHub OAuth administrator session for protected `/command`, `/evidence.js`, and `/data/us/*` routes. **This describes the source design, not a verified production authorization test.** Test anonymous denial and authorized access on the deployed Worker before calling the command room protected.
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
