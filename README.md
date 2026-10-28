# MONEY TRACKER

A public-source intelligence prototype connecting world history, legislation, macroeconomic data, and U.S. congressional financial disclosures on a **flat world map**.

## Current status and release blockers (checked 2026-10-29 KST)

> **Not a private deployment.** The GitHub repository is currently **public**, and GitHub Pages must also be treated as public. Earlier live Pages checks returned HTTP 200 for 10 restricted/source-file paths (see [exposure-check PR #213](https://github.com/91cleaner/money-tracker/pull/213) and [response PR #214](https://github.com/91cleaner/money-tracker/pull/214)). A successful Pages build does **not** mean the leak is fixed. Those PRs are pending; this README change does not fix hosting or revoke access. Do not put secrets or private data in this repository.

| Capability | Status / user-facing interpretation |
| --- | --- |
| Flat world-map command room | Prototype exists; production end-to-end behavior is not established by a build alone. |
| Question → candidate selection → map trace | **Known bug**: ticker/company search can bypass candidate selection and start a trace immediately ([issue #174](https://github.com/91cleaner/money-tracker/issues/174)). |
| U.S. House PTR disclosures | Stored **public filings**, not independently verified executed trades, live holdings, or comprehensive Congress coverage. Reported transaction values are ranges. |
| Bills → lawmakers → companies | Research navigation across records; temporal proximity is **not** evidence of influence, wrongdoing, or causation. |
| AI-generated analysis / AI search | **NOT CONNECTED**. Static/precomputed answers must not be presented as live AI responses. |
| Live quotes / live executed-trade feed | **NOT CONNECTED**. Historical prices and filed transactions are not live market data. |
| Private/admin-only access | **NOT VERIFIED for the deployed site**. Worker OAuth configuration cannot protect public GitHub Pages files. |
| Deployment security | **BLOCKED** until the Pages source, allowlisted artifact, restricted-file responses, and repository visibility are reviewed and independently rechecked. |

Before treating the site as production-ready, switch Pages to the intended allowlisted Actions deployment, confirm restricted URLs return 404/410, verify authenticated routes separately, and run the map/search mobile smoke tests. See [Pages response runbook PR #214](https://github.com/91cleaner/money-tracker/pull/214). None of these steps is claimed completed here.


## Entry points
- `index.html` — country selection
- `world-intelligence/index.html` — flat world-map command center and guided country exploration
- `world-intelligence/us-signals.html` — U.S. macro, history, and House PTR disclosure research
- `us.html` — U.S. command entry

## Data sources and verification limits
- `data/us/bills.json` — U.S. congressional legislation summary from Congress.gov. The **Congress.gov API requires a key** for its collection workflow; this is separate from the map.
- `data/us/trades.json` — parsed public U.S. House PTR transactions, linked to House Clerk source PDFs. Transaction amounts are ranges; records are not investment advice or evidence of misconduct. The Senate index has reported HTTP 403 errors; do not imply complete Senate coverage.
- `data/us-events.json` — curated historical milestones with source URLs, not causal investment signals.
- `data/us-macro.json` — generated only after a successful FRED data collection run; it may be absent.
- `data/us-house-filings.json` — generated only after successful House Clerk index collection; it may be absent.
- `data/index.json`, `data/city/` — legacy Korean municipal contract data.

## Map
The map uses Leaflet with keyless OpenStreetMap/CARTO basemap tiles and optional Esri satellite imagery. **No map API key is required.** It depends on external tile/CDN availability; a simplified offline schematic is shown when providers cannot be reached. The satellite imagery is not a live satellite feed. The country-to-country lines show exploration paths, not proof of causation.

## Authenticated command room
- The Cloudflare Worker `/command` implementation is designed around `world-intelligence/index.html`, rather than a separate schematic map. Its `/evidence.js` and `/data/us/*` handlers are intended to require a GitHub OAuth administrator session **when the Worker is correctly deployed and configured**; this has not been independently verified for the live service. It does not protect the public GitHub Pages site.
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
