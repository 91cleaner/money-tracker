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

## 7. P1 evidence-link gate: bill → lawmaker → company (reviewed 2026-11-04 KST)

**Source-level finding, not a reproduced UI failure.** The current public datasets expose different entity keys, so a map line connecting a bill, a legislator and a company must **not** be treated as a verified relationship just because names, tickers, sectors or dates are close.

| Source examined | Actual join information visible | Evidence boundary |
| --- | --- | --- |
| `data/us/members.json` | `members[].id` is a legislator's Bioguide-style ID (e.g. `C000127`); also has name, chamber and state | A name or office coordinate alone does not identify a specific House PTR filing |
| `data/us/bills/{bioguide}.json` | Files are keyed by legislator ID; each bill item includes `no`, `d`, `a`, `ad`, `u`, `law`, `pass` | This is sponsored-bill context, not evidence of a vote, committee action or financial benefit |
| `data/us/trades-recent.json` | Rows include `who` (free-text name), `tk`, `ty`, `d` (transaction date), `fd` (filing date), `amt` (range), `doc` (House Clerk PDF) | The sampled row does **not** contain a Bioguide ID; a name-only join is ambiguous and must not be auto-promoted to a verified legislator match |
| `data/us/ticker-routes.json` | `routes` is keyed by ticker, with sourced geographic/company/policy `stops` | A company or industry policy stop is contextual; it does not prove a legislator traded because of a bill |

**Required join contract before displaying a factual bill → legislator → company relationship:**

1. **Legislator identity:** resolve a filing's reported name to one Bioguide ID using a documented source-specific crosswalk with chamber, state/district and relevant term dates. Preserve the original `who` string and the crosswalk's source; reject ambiguous, unmatched, or time-inconsistent matches. Do not equate name similarity with identity.
2. **Bill role:** distinguish sponsor, cosponsor, committee member, recorded vote, and unrelated legislative context. Link the specific Congress.gov bill number, Congress session, action date and original URL. A per-member sponsored-bill file does not establish the other roles.
3. **Company identity:** separately resolve the disclosed asset to a verified issuer/security identifier (e.g. SEC CIK plus ticker as-of the relevant date); a ticker alone can be reused or changed. Distinguish individual stocks, ETFs, options, trusts and unknown assets. Do not infer a company match solely from a bill's sector keywords.
4. **Temporal integrity:** retain transaction date, filing date, bill action date, source observation date and ingestion time separately. Reject impossible chronology; do not imply that filing date is execution time or that temporal proximity proves causation.
5. **Presentation:** until all three edges are independently sourced, label the path **“공개 기록을 나란히 표시한 탐색 경로 · 관계 미검증”** (EN: **“Exploration path across public records · relationship unverified”**). Show the House Clerk PDF and Congress.gov bill URL separately, with missing/ambiguous links visibly marked. Never assign an insider-trading, profit or buy/sell conclusion from the map line.

**Release acceptance tests (owner implementation required):** (a) one filing name matching two legislators must stay unresolved; (b) same ticker reused by another issuer must not join; (c) ETF or option must not silently become a direct operating-company holding; (d) bill sponsored by a different legislator must not be presented as the filing legislator's sponsored bill; (e) filing date before transaction date must be quarantined; (f) a valid source-backed crosswalk must show each edge and its citation; (g) absent source, stale feed and zero records must remain three distinct states. Test question → choice → map trace in desktop and mobile landscape, then verify the exact published artifact SHA.

**Status:** This section fixes the **operator's evidence and release contract only**. It does not add a verified crosswalk, execute an entity join, repair the UI, or validate the current trade sample. Lead/data owner handles crosswalk and provenance; Claude/UI owner handles display; GPT does not edit their files. The repository and Pages are **PUBLIC**; real-time executed-trade feed and generative AI are **NOT CONNECTED**. PR approval and an integrated CI/deployment run remain required.

## 8. P1 integration triage: red PR checks and PTR quarantine evidence (2026-11-04 KST)

This is **historical branch-CI evidence**, not a measurement of the currently deployed public dataset. It changes release decisions, not the source data or the UI.

| Candidate PR / tested SHA | Observed GitHub evidence | Release implication |
| --- | --- | --- |
| [#403](https://github.com/91cleaner/money-tracker/pull/403) / `488ff42` | Security, command-room and map smoke checks passed on the branch's older SHA ([security run](https://github.com/91cleaner/money-tracker/actions/runs/41187211020)); GitHub currently reports **mergeable=false** | Do not merge or assume those historical green checks cover current `main`. UI/CI owner must resolve the conflict, rebuild and rerun checks on the rebased SHA |
| [#412](https://github.com/91cleaner/money-tracker/pull/412) / `d594707` | [Security run](https://github.com/91cleaner/money-tracker/actions/runs/41278905644) failed at the obsolete root `intel-lab.html` link assertion after the artifact was generated; [map smoke](https://github.com/91cleaner/money-tracker/actions/runs/41278905650) failed a country-entry test (8/9 passed) | The proposed chronology quarantine is **not** a green release candidate; integrate the country-entry contract fix and rerun both suites |
| [#458](https://github.com/91cleaner/money-tracker/pull/458) / `58a2752` | [Public JSON parity audit](https://github.com/91cleaner/money-tracker/actions/runs/41440831957) passed; [security run](https://github.com/91cleaner/money-tracker/actions/runs/41440831931) failed | JSON parity success does not override a failing independent security check |
| `main` / `14de119` | [Pages deploy #41696465703](https://github.com/91cleaner/money-tracker/actions/runs/41696465703) completed successfully on 2026-11-04 03:43 KST | Confirms an Actions deployment result for that SHA, **not** that open PR protections are in production or that a mobile browser works |

**Observed PTR quarantine in #412's historical security log:** its pre-publish generator reported **4,396 public-summary rows retained and 15 excluded**, plus **19 recent PTR rows retained and 1 excluded** ([run #41278905644](https://github.com/91cleaner/money-tracker/actions/runs/41278905644)). These are counts from that specific branch snapshot, not newly collected records and not proof that the source PDFs were reconciled. The job subsequently failed its obsolete entry assertion. Operators must preserve the rejection counts and reasons for source review, and must not silently describe the reduced public sample as complete.

**Release order for the owners:** resolve #403's merge conflict against current `main`; integrate #412 chronology validation and #458 JSON parity without weakening either check; require security + map + command-room + generated-artifact checks to pass on one integration SHA; obtain owner approval before merge; then compare deployed HTML/JS and public JSON against that exact SHA and perform a real mobile-landscape question → candidate → map → close/reopen test. Keep unresolved source rows visibly **unverified/excluded**, not “no trades”. No UI, collector or CI code was changed by this review.

### P1 release-gate bypass confirmed in current workflow source (2026-11-04 KST)

This is a **separate deployment-order defect**, not a claim that an exploit or an incorrect public trade has occurred:

- `.github/workflows/deploy-pages.yml` publishes on **every push to `main`**. Its `deploy` job checks selected JS syntax, `worker/private-api.test.mjs`, builds the artifact and runs `check-pages-artifact.py`, then calls `actions/deploy-pages@v4`. It has **no `needs` dependency** on the separate security/research, command-room, map-smoke, or public-JSON parity jobs; those failures therefore do not themselves prevent this deployment job from publishing.
- `.github/workflows/security-and-intel-lab.yml` runs the broader Python regression suite but currently still requires `href="intel-lab.html"` in root `index.html`, even though the current country-selection entry links to `world-intelligence/`. This obsolete assertion can make security CI red while the separate Pages workflow remains green. Fix the assertion by verifying the actual entry contract, **not** by dropping security checks.
- The post-publish checks in `deploy-pages.yml` fetch root, `korea.html`, `usa-command-legacy.html` and `assets/mt-command-ui.js`; they do **not** establish that `world-intelligence/index.html`, `js/mobile.js`, PTR chronology rejection or public-JSON parity matches the released SHA. The PR #403/#412/#458 checks remain pending until integrated.

**Owner acceptance gate:** on the *same exact candidate SHA*, pass security + map + command browser tests, PTR quarantine tests and generated-artifact privacy checks **before** any publish step. Then publish that immutable artifact and verify the deployed SHA/content for world command, mobile JS and public JSON; fail the release if any required gate is red, missing or skipped. Avoid relying solely on branch protection: a successful `push`-triggered deployment can otherwise race with independent post-push CI. This is a documented review finding only; GPT has not changed the workflow, deployment or tests (CI/Claude owner action required).

