# MONEY TRACKER

A public-source intelligence prototype connecting world history, legislation, macroeconomic data, and U.S. congressional financial disclosures on a **flat world map**.

## Entry points
- `index.html` — country selection
- `world-intelligence/index.html` — flat world-map command center and guided country exploration
- `world-intelligence/us-signals.html` — U.S. macro, history, and House PTR disclosure research
- `us.html` — U.S. command entry

## Verified data and caveats
- `data/us/bills.json` — U.S. congressional legislation summary from Congress.gov. The **Congress.gov API requires a key** for its collection workflow; this is separate from the map.
- `data/us/trades.json` — parsed public U.S. House PTR transactions, linked to House Clerk source PDFs. Transaction amounts are ranges; records are not investment advice or evidence of misconduct. The Senate index has reported HTTP 403 errors; do not imply complete Senate coverage.
- `data/us-events.json` — curated historical milestones with source URLs, not causal investment signals.
- `data/us-macro.json` — generated only after a successful FRED data collection run; it may be absent.
- `data/us-house-filings.json` — generated only after successful House Clerk index collection; it may be absent.
- `data/index.json`, `data/city/` — legacy Korean municipal contract data.

## Map
The map uses Leaflet with keyless OpenStreetMap/CARTO basemap tiles and optional Esri satellite imagery. **No map API key is required.** It depends on external tile/CDN availability; a simplified offline schematic is shown when providers cannot be reached. The satellite imagery is not a live satellite feed. The country-to-country lines show exploration paths, not proof of causation.

## Collection and validation
- `.github/workflows/us-data.yml` — scheduled FRED macro and House filing index collection.
- `.github/workflows/collect.yml` — legacy Korean municipal contract collection (requires `DATA_GO_KR_KEY` repository secret).
- `.github/workflows/world-intelligence-health.yml` — static map and data integrity checks.
- `python scripts/check_world_intelligence.py` — local read-only health check. With Node.js installed, also checks inline JavaScript syntax.

**Important:** GitHub Pages is public. `noindex`, hidden links, or client-side controls are not authentication and do not restrict access to specific devices. Proper device-only access requires an authenticated gateway or private hosting.

## Principles
1. Cite original official public sources and distinguish source dates, event dates, transaction dates, and ingestion times.
2. Mark incomplete, inaccessible, stale, and unverified data explicitly.
3. Do not infer stock returns, insider misconduct, or causal links from temporal proximity.
4. Treat the intelligence-terminal visuals as a simulation, never as classified or live intelligence.
