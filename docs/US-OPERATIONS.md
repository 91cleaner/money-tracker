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

## 4. Congressional disclosure ingestion
- scripts/collect_house_filings.py fetches House Clerk annual public filing indexes, preferring XML and falling back to ZIP.
- Successful runs append verified *filing metadata* to /data/us-house-filings.json.
- The lab supports name/state search, PTR-only filtering and original-PDF links.
- This is **not** parsed security-by-security transaction data. Senate ingestion, OCR/PDF extraction, issuer matching, and source reconciliation are NOT yet implemented.
- /data/us-disclosures.json explicitly represents an empty *verified transaction* dataset; never confuse missing data with no trades.

## 5. Security and production release gate
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
- House PTR PDF extraction and transaction-level validation.
- Senate transaction-level records.
- Congress.gov API integration with properly managed credentials.
- Entity resolution for issuers/tickers and deduplication.
- Source timestamps, freshness and error badges on every record.
- Server-side access control and real mobile/desktop end-to-end tests.
