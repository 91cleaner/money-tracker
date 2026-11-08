# MONEY TRACKER US — 5-stage delivery and verification

## 1. Navigation / command map
- /us.html enters /world-intelligence/
- Map supports country selection, mouse wheel and pinch zoom.
- /world-intelligence/us-signals.html opens the US research lab.

## 2. Historical / legislative context
- /data/us-events.json contains curated dated events with primary-source URLs.
- The lab has a touch-enabled year slider and source links.
- Events are historical context, not causality claims or trading signals.

## 3. Official economic observations
- scripts/collect_us_macro.py downloads FRED public CSV observations.
- On success, GitHub Actions stores /data/us-macro.json and the lab plots series.
- If retrieval fails, the script preserves prior data and does not fabricate values.

## 4. Congressional disclosure ingestion and evidence levels
- `scripts/collect_house_filings.py` fetches House Clerk annual public filing indexes, preferring XML and falling back to ZIP. Successful runs write filing **metadata** to `data/us-house-filings.json`; the research lab supports name/state search, PTR filtering and original-PDF links.
- Separately, `data/us/trades.json` contains **parsed House PTR transaction entries**, and `data/us/trades_public.json` is the intended public subset. Do not describe the entire US experience as metadata-only: these transaction entries exist, but are **delayed, self-reported disclosures**, not independently verified executions, exact trade sizes, real-time prices or evidence of misconduct. Source-PDF links and field-level crosschecks must remain visible.
- `data/us-disclosures.json` is a separate verified-transaction feed that may still report no verified entries. Its empty state **does not negate** the existence of parsed PTR candidates and must never be presented as proof that no legislator traded.
- House and Senate coverage, extraction completeness, issuer/ticker matching and source reconciliation require record-by-record evidence. A successful collection or Pages deployment alone does not establish complete coverage or chronology accuracy.

## 5. Security, chronology and production release gate
- **Current release gap (2026-11-08):** main's Pages workflow checks file presence and a limited field allowlist, but its `scripts/check-pages-artifact.py` does **not** enforce PTR transaction/filing-date chronology. A green Pages run therefore does **not** prove PTR accuracy. See [#527](https://github.com/91cleaner/money-tracker/issues/527) (unresolved anomalies) and draft [#526](https://github.com/91cleaner/money-tracker/pull/526) (stricter preflight, not merged). Data owner must reconcile against official House Clerk PDFs; unresolved rows must not be counted as verified. Require the *same release SHA* to pass artifact chronology checks before declaring the PTR view verified.
- The current GitHub Pages site and repository are public. HTML-only passwords, hidden links, client-side tokens and IP-based JavaScript gates DO NOT secure private access.
- Before any private/admin datasets or operations are deployed, use an access-controlled hosting layer (e.g., Cloudflare Access with identity verification) or a backend with server-side sessions and device-bound passkeys.
- Keep administrator credentials and vendor API keys out of the repository and frontend.
- Do not represent the US lab as admin-only until server-side authorization has been configured and independently verified.

## Operations
- GitHub Actions workflow: .github/workflows/us-data.yml (daily, manual, and push trigger on collector changes).
- GitHub Actions permissions must permit repository content writes for the data commit step.
- Check workflow logs for HTTP errors, no rows parsed, and failed pushes.
- Verify /data/us-macro.json and /data/us-house-filings.json actually exist after successful collection.
- If a public provider changes its schema or blocks requests, ingestion fails closed; no synthetic records are generated.
- New commits may trigger GitHub Pages deployment; wait for successful Pages deployment before testing live URLs.

## Next production gaps
- Reconcile existing parsed House PTR entries against official PDFs; quarantine impossible chronology from public aggregates until verified.
- Expand and validate House PTR extraction coverage; add Senate transaction-level records with source and chamber provenance.
- Congress.gov API integration with properly managed credentials.
- Entity resolution for issuers/tickers and deduplication.
- Source timestamps, freshness and error badges on every record.
- Server-side access control and real mobile/desktop end-to-end tests.
