# MONEY TRACKER US — operations and release evidence

> Audited against `main` on 2026-11-03 (KST). This is an operator runbook, **not** a claim that all features or data feeds are production-ready. The repository and GitHub Pages are **public**.

## 1. Entry, map, and mobile

- `index.html` is the country-selection entry. `world-intelligence/index.html` is the one-screen world-map command room; `world-intelligence/us-signals.html` is the U.S. research view. `us.html` is a separate U.S. entry.
- The question → candidate selection → map trace flow and mobile wheel/pinch/focus behavior require real browser tests; source-code markers and a green Pages deployment do not prove they work.
- The map is a visualization of sourced observations and exploration paths, **not** a live intelligence or physical-travel feed. Basemap imagery may be cached or unavailable.

## 2. Evidence tiers: do not collapse these datasets

| Dataset | What it can establish | What it cannot establish |
| --- | --- | --- |
| `data/us/bills.json`, `data/us/bills/` | Public congressional bill records and legislative context, subject to collector freshness | A causal relationship between a bill, a company, and a trade |
| `data/us-house-filings.json` | House Clerk filing **metadata** from official indexes | Security-by-security transactions without reading the source PDF |
| `data/us/trades.json` | Parsed House PTR research records with source-PDF links; source ledger for public summary | Independent proof of execution, beneficial ownership, return, or misconduct |
| `data/us/trades-recent.json` | A **sampled** recent House PTR disclosure window | A complete or real-time transaction feed; zero recent rows does not mean zero trades |
| Generated Pages `data/us/trades_public.json` | Trimmed public summary generated from the source ledger | Verification that every source field and chronology is correct without release checks |
| `data/us-disclosures.json` | Legacy placeholder with `awaiting_verified_records` status | Proof that other House PTR datasets do not exist or that no trades occurred |
| `data/us-macro.json` | FRED observations **when a collection succeeds** | A continuously updated live price feed |

Use the **original House Clerk PDF** for a claim about a particular filing. Show the transaction date, filing date, source URL, and collection/snapshot date separately. Filing amounts are disclosed ranges. Do not call a reported transaction an independently verified executed trade. Senate transaction coverage is **not confirmed complete**; the Senate index has returned HTTP 403.

## 3. Collection and status

- `.github/workflows/us-data.yml` runs daily and on relevant source changes. It tests House archive/PTR extraction, attempts FRED macro and House Clerk index collection, records `data/us-ingestion-status.json`, builds a PTR review queue, and extracts **candidates** from up to eight digital PDFs per run.
- The macro, House-index, and PDF-extraction steps use `continue-on-error`; a green workflow alone **does not prove each collector succeeded**. Inspect `macro_run`, `house_run`, `file_health`, extractor logs, original source links, and timestamps.
- `scripts/collect_house_filings.py` archives filing metadata, not transactions. `scripts/extract_house_ptr.py` produces research candidates; separate reconciliation is needed before labeling records verified.
- Congress.gov API collection requires a key; this is unrelated to the map tile service. Never expose API keys, OAuth credentials, or administrator tokens in a public file or log.

## 4. Known release blockers (as checked 2026-11-03)

1. **PTR chronology:** PR [#412](https://github.com/91cleaner/money-tracker/pull/412) proposes a pre-publish quarantine for impossible dates and unsafe source links. The reported 2026-10-28 transaction / 2026-10-27 filing conflict needs reconciliation with the original PDF. Until merged and deployed, do **not** assert that this guard protects the live site.
2. **Entry and mobile smoke:** PR [#403](https://github.com/91cleaner/money-tracker/pull/403) adds shared pre-/post-publish entry checks. A branch CI pass does not imply the checks are on `main` or in the published Pages artifact.
3. **Public JSON parity:** PR [#458](https://github.com/91cleaner/money-tracker/pull/458) adds deployed-byte comparisons for three public JSON files. It is separate from validating the accuracy of the source disclosures.
4. **Public-file exposure:** `scripts/prepare-public-pages.py` currently copies allowed file extensions from broad directories. Review PR [#469](https://github.com/91cleaner/money-tracker/pull/469) documents the allowlist risk. Excluding a file from Pages **does not make it private in this public GitHub repository**.

These are open PRs, not implemented protections on `main` until explicitly merged, tested, and observed in a successful deployment. Do not merge without owner approval; coordinate with the UI, data, and CI owners.

### 2026-11-03 22:58 KST CI evidence — do not confuse test success with a green job

- On [security/research run #41648957821](https://github.com/91cleaner/money-tracker/actions/runs/41648957821) for PR #475 commit `43acd97a`, **144 Python tests passed**, but the overall job **failed** in “Build and validate public artifact”. The log shows `prepare-public-pages.py` completed (94,372 generated files) and the next obsolete assertion `grep -q 'href="intel-lab.html"' .public-pages/index.html` returned exit code 1. The current country-selection `index.html` does not have that link. This is a **CI contract failure**, not evidence that the public artifact build itself failed or that Pages was safely released.
- The same SHA's [command-room smoke #41648957860](https://github.com/91cleaner/money-tracker/actions/runs/41648957860) **passed**. These independent checks must not be collapsed into a single “CI passed” status.
- [PR #403](https://github.com/91cleaner/money-tracker/pull/403) proposes replacing the obsolete grep with a shared entry smoke. Until owner-approved integration, the failing job remains **red**; do not bypass or mark it green by deleting assertions. After #403/#412/#458 integration, require the **same merged SHA** to pass security, generated-artifact privacy/PTR chronology, Pages HTML/JS smoke, and post-publish JSON parity. Check `js/mobile.js` in the generated artifact and on the live site. An Actions Pages success by itself does **not** prove those pending protections are deployed.

## 5. Read-only verification before announcing a release

From the exact checkout to be deployed, use:

```bash
python3 -m unittest discover -s tests
python3 scripts/prepare-public-pages.py
python3 scripts/check-pages-artifact.py
python3 scripts/check_world_intelligence.py
node --test worker/private-api.test.mjs
```

Then inspect the **same SHA** in GitHub Actions and confirm the Pages deployment run completed successfully. Verify public URLs and mobile navigation separately. After #403/#412/#458 are integrated, run their additional smoke, PTR, and JSON-parity checks **before** marking those protections live. Check failed collector steps, missing data, invalid dates, and missing official-source links; never replace missing or stale data with fabricated values.

## 6. Access and connection labels

- GitHub repository: **PUBLIC**. GitHub Pages: **PUBLIC**. A source ledger omitted from Pages is still accessible in the public repository.
- Administrator-only Worker: requires a **separately verified** deployed server-side session and direct-route authorization test; source synchronization is not deployment. GitHub OAuth is not a guarantee of device-only access.
- Real-time executed congressional trades: **NOT CONNECTED**. Generative AI analysis/search: **NOT CONNECTED**. Live stock-price feed: **NOT VERIFIED AS CONNECTED**.
- No trading recommendation, automatic buy/sell signal, insider misconduct allegation, or bill-to-stock causation should be inferred from the map.

This runbook is operational guidance only; it does not modify collectors, UI, release scripts, or existing data.
