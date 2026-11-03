# MONEY TRACKER US — operations and release verification

**Checked 2026-10-30 KST against `main` `f588dd345b51431749bc868887f2aea40944766e`.** This is a repository/source audit, **not** certification of the live site or Cloudflare deployment.

## 1. Navigation / command map
- `index.html` redirects to `world-intelligence/?lang=en` (unless the URL already specifies a language). It is **not** the country picker.
- `korea.html` is the Korean-language country-selection entry; `us.html` also enters the U.S. command flow.
- `world-intelligence/us-signals.html` is the U.S. research view. Map, question → candidate selection → trace, keyboard dismissal and pinch/zoom require separate browser/mobile verification; HTML presence alone does not prove they work.
- Map paths visualize exploration and source relationships, **not** verified physical travel or causation.

## 2. Official macroeconomic observations and legislation
- `scripts/collect_us_macro.py` attempts FRED CSV and, when `FRED_API_KEY` is configured, falls back to the official API. If no observations are retrieved, it exits without overwriting the previous snapshot.
- `data/us-macro.json` contains observations, **not** a live quote feed. Check observation dates and collection status before using any number.
- `data/us/bills.json` contains Congress.gov legislative records; the Congress.gov collection API requires its own key. A bill-to-member or bill-to-company display is **not** evidence of a transaction or policy-driven price movement.
- The committed `data/us-ingestion-status.json` snapshot at **2026-10-29 05:58 UTC** reports macro collector `success` (5 series) and House filing-index collector `success` (4,775 filing records). Those are **snapshot counts**, not fresh records collected during this audit and not proof of a currently successful live deployment.

## 3. House financial disclosures — distinguish three different datasets
- **Filing metadata:** `scripts/collect_house_filings.py` archives House Clerk XML/ZIP indexes to `data/us-house-filings.json`. A filing-index entry is **not** a security-by-security trade.
- **PDF extraction candidates:** `scripts/build_ptr_research_queue.py` builds `data/us-ptr-research-queue.json`; `scripts/extract_house_ptr.py` parses supported **digital-text** House PTR PDF tables into `data/us/house-ptr-candidates.json`. Rows are labeled `machine_parsed_requires_review`; scanned/ambiguous rows are **not** guessed. The committed extraction status dated **2026-10-29 05:58 UTC** reports 8 PDFs attempted and 18 candidate rows; this is **not** 18 verified executions.
- **Legacy/review records:** `data/us/trades.json` is a separate House PTR disclosure dataset, and `data/us/ptr-crosschecks.json` contains a small number of field-level comparisons against official House Clerk PDFs. A PDF match verifies what the member **reported**, not independent execution, ultimate ownership, or a causal link to a bill. The still-empty `data/us-disclosures.json` is a **legacy verified-record placeholder** and must **not** be used to claim there are zero disclosures or that no extraction exists.
- The House coverage is partial; do not claim comprehensive Senate ingestion or full OCR. Show transaction date, filing date, original House Clerk PDF, verification state and amount **range** when presenting any candidate.

## 4. Security and connectivity — release blockers
- GitHub reports the repository as **public**; GitHub Pages assets are public. A successful Pages build is **not** private access control or proof of authenticated Worker deployment.
- On the checked `main`, `cloudflare/admin-worker.js` is **1,051,223 bytes**, exceeding the **1,048,576-byte** repository health-check guard by **2,647 bytes**. This remains tracked in [issue #289](https://github.com/91cleaner/money-tracker/issues/289). Worker source synchronization alone is not a Wrangler deployment.
- **Generative AI analysis: NOT CONNECTED (live deployment unverified). Real-time executed-trade feed: NOT CONNECTED.** Scripted lookups and delayed public PTR filings must not be marketed as live AI/trading signals.
- Keep keys, private records and privileged APIs server-side. Confirm authorized and anonymous direct requests against **every** protected route; GitHub OAuth login is not device-only authorization.

## 5. Verification before calling a release complete
1. Review the actual GitHub Actions run, step logs, and committed `data/us-ingestion-status.json` / `data/us-ptr-extraction-status.json`. A green Pages build does not establish data freshness or Worker success.
2. Run `python -m unittest discover -s tests -p 'test_house_filing_archive.py'`, `python -m unittest discover -s tests -p 'test_ptr_research_queue.py'`, `python -m unittest discover -s tests -p 'test_house_ptr_extraction.py'`, then `python scripts/check_world_intelligence.py`. Do not weaken the Worker-size guard to obtain a green check.
3. Verify the **deployed** Pages entry and the authenticated Worker separately, including anonymous denial of privileged paths and actual official source links. Record the deployed commit SHA and workflow URLs.
4. On 375px/390px mobile viewports, test question → candidate → map trace, back/close, pinch/zoom, source opening, and no horizontal overflow. Distinguish empty results from failed fetches.
5. Follow `docs/AI-ROLES.md`: UI belongs to Claude; data/collectors to the lead. This document does **not** merge pending PRs or deploy code.

**Next operational gaps:** resolve Worker size #289; independently review extracted PTR candidates; verify Senate coverage and source freshness; establish authenticated deployment and mobile end-to-end evidence. No financial advice or inference of misconduct from filing proximity.

## 6. Weekly House PTR card — accuracy release gate (P1 #305)
- **Verified against `main` on 2026-10-30 KST:** `scripts/weekly/congress_trades_card.py` exports `weekly/latest.json` transaction rows containing asset, buy/sell label, reported amount range and trade date, **but no individual original House Clerk PDF URL or filing date**. The public `weekly/index.html` therefore cannot let a reader verify each row. See [#305](https://github.com/91cleaner/money-tracker/issues/305) and the already merged PR #291 review. A generic source attribution is **not** per-record provenance.
- The latest checked `weekly/latest.json` says **35 reported transaction rows**, **4 mapped members**, filing window **2026-10-23 through 2026-10-29**, and generation date **2026-10-29**. Individual transaction dates include **2026-09-30**, so the transaction date must never be called the filing date. These are a **committed snapshot**, not 35 newly collected or independently executed trades.
- The static heading **"This week in Congress trades"** is misleading if `pick_window()` falls back to an earlier 7-day filing period. Use **"Latest available House PTR filings, [start]–[end]"** for fallback; show the generation date and last successful collection separately. Even without fallback, explain that the date range is **filing dates**, not execution dates.
- The weekly workflow currently sets `continue-on-error: true` for the House PTR collector and can render old data as a fresh card. Require a visible **stale/collector-failed** state or suppress publishing until collection success is established. A green rendering job does not prove new filings were collected.
- The 3-attempt `git pull --rebase && git push` loop currently lacks a post-loop failure guard; after exhausted retries it may still trigger a Pages deployment. Require explicit nonzero failure and do not dispatch deploy until the new commit is on `main`.
- **Release acceptance:** per-row validated HTTPS official PDF link, filing date, transaction date, reported amount range and review status; safe link rendering; tests for missing sources, fallback heading, collector failure and exhausted push retries; then a Pages check against the exact deployed commit. If a source cannot be verified, mark the row **unverified/unavailable** rather than inventing a link. Data/collector changes belong to the lead, UI to Claude; this is review-only documentation.
