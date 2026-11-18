# U.S. command-room English copy and provenance review — 2026-11-08

**Status:** Proposed wording only; not deployed. **Owner:** GPT (copy/review), per [AI-ROLES.md](AI-ROLES.md). Claude owns the screen, and the data lead owns collectors. Do not merge this review as a UI change or count it as a production fix.

## Why this is P1

The currently deployed-source HTML describes House PTR records as **"stock trades"** and says they are traced as **"live routes"**. These are *retrospective self-reported disclosures* displayed along a navigable map route, not a live transaction feed. The same social-preview copy says **"Official public records only"** even though the application can link third-party market prices (e.g. Yahoo). The pending [PTR chronology issue #527](https://github.com/91cleaner/money-tracker/issues/527) documents 11 suspect date rows in a regenerated snapshot; the source's dates cannot be represented as independently verified executions. A misleading social preview is seen *before* a visitor reaches any in-app disclaimer.

## Exact replacement proposals

All locations below were read from **main** on 2026-11-08. These are *proposals*, not assertions that a fix has shipped.

| Priority | File and current text | Proposed English text | Reason |
| --- | --- | --- | --- |
| P1 | `world-intelligence/index.html:5,7` — `US Stock Trackers \| Who in Congress traded what, and when` (OG and Twitter titles) | `MONEY TRACKER \| Explore congressional trade disclosures` | A reported transaction is not independent confirmation of execution; use the product name consistently. |
| P1 | `world-intelligence/index.html:5,7` — `Congressional stock trades, late filings, bills and contracts traced as live routes on one map. Official public records only. Not investment advice.` (OG and Twitter descriptions) | `Explore U.S. House trade disclosures, bills and related public records along map routes. Records may be delayed or unverified; price references may come from third parties. Not investment advice.` | Removes unproven “late” and “live” claims; separates official records from third-party prices. Do not imply complete House/Senate coverage. |
| P1 | `world-intelligence/index.html:3` — `A U.S. control room that follows Congress bills, lawmaker stock-trade filings, company sites and foreign policy as routes on a map. Public records only, not investment advice.` | `Explore U.S. legislation, House trade disclosures, company locations and policy records on a map. Historical disclosures are not live executions or investment advice.` | Clear scope, retrospective status and no implied causal link. |
| P1 | `assets/i18n.js:63` — `Member trades` | `Member trade disclosures` | Avoid conflating a filing with a confirmed trade. |
| P1 | `assets/i18n.js:63` — `Insider trades` | `Insider transaction filings` | SEC Form 4 data describe reported transactions. |
| P1 | `assets/i18n.js:204` — `Member stock trades · $2 most recent of $1 House PTR filings · Disclosed (PTR), up to $3-day lag · Not investment advice` | `House PTR disclosures · latest $2 of $1 records · Filing and transaction dates may differ; delayed or inconsistent reports require review · Not investment advice` | The phrase “up to” sounds like a guarantee of timeliness, even where filings are late or chronologically inconsistent. Preserve dynamic record counts, but label their unit correctly. |
| P2 | `assets/i18n.js:60` — `Filed` / `Traded` | `Filing date` / `Reported trade date` | Distinguish reporting fields from independently validated dates. Check narrow mobile tables before adopting longer labels. |
| P2 | `assets/i18n.js:63` — `Trades before announcements` | `Reported trades dated before announcements` | Chronological comparison only; not evidence of foreknowledge or misconduct. |
| P2 | `assets/i18n.js:192` — `refreshed daily from real filings` | `recomputed from available public filing records` | A daily refresh schedule or verified completeness must not be inferred from a successful build. |
| P2 | `assets/i18n.js:63` — `PAC` for `후원` | `Political contributions` | A PAC is an organization, not a synonym for all contributions; check whether the specific view only contains PAC records before final wording. |

## Required user-facing status vocabulary

| State | English copy | Korean copy | Display rule |
| --- | --- | --- | --- |
| Real-time executed trades | `Not connected — no live execution feed` | `미연결 — 실시간 체결 피드 없음` | Never use `LIVE` for delayed House PTR records. |
| Generative AI | `Not connected — rule-based search` | `미연결 — 규칙 기반 검색` | Search suggestions and scripted routes are not generated AI answers. |
| Failed retrieval | `Unavailable — retrieval failed` | `조회 실패 — 데이터 확인 불가` | Never render as zero records. |
| Delayed snapshot | `As of YYYY-MM-DD — may be stale` | `YYYY-MM-DD 기준 — 최신 여부 미확인` | Show source date and refresh date separately when available. |
| Suspect chronology | `Reported dates conflict — verification pending` | `신고 날짜 모순 — 검증 대기` | Exclude from verified summaries until the data owner resolves #527. |
| Confirmed empty result | `0 records found in the successfully loaded dataset` | `정상 조회된 자료에서 0건` | Only after successful fetch and schema validation. |

## Integration acceptance checks (Claude / data lead)

1. Update **both** Open Graph and Twitter title/description pairs together, including the ordinary HTML description; do not update only one share channel.
2. In EN mode, compare the House PTR card and its mobile landscape variant. Preserve the exact distinction among transaction date, filing date, source document and collection time; never label a date as independently verified execution.
3. Keep source-domain validation distinct from content verification. Government hostname does not verify a PDF's dates, and Yahoo is third-party market data. Do not label third-party prices as official public records.
4. Test the English and Korean states for: valid filings; malformed/failed source; zero records; stale snapshot; future/contradictory dates; AI unavailable. The latter must not silently fall back to a fabricated AI response.
5. Run relevant copy/i18n and map checks at the **same PR head SHA**. Check actual OG/Twitter preview metadata and mobile overflow after deployment; a green Pages workflow alone is not a live-site proof.
6. Confirm any `45 days` claim against the applicable disclosure rule and actual record status. A legal filing deadline is **not** evidence that all disclosures arrived within it.


## P1 follow-up code review — route source links bypass the #532 guard (2026-11-08)

**Confirmed in PR #532 HEAD `b923aae`, `world-intelligence/index.html`:** its new exact-host check covers links rendered from `mtIntentCard`'s `a.src` array, **not** the separate route brief's `#source` anchor. In `show()`, both the generated ticker route `t.source_url` and the demo route `mission.url` are assigned directly to `$('source').href` when present. `routeOf()` builds ticker routes from `searchIdx.entities[id].route`, loaded from `../data/search-index.json`. Thus the display path has no scheme/host check at the point where a dataset URL becomes clickable. This is a **potential unsafe-link path if source data is corrupted or compromised**, not evidence that any current dataset contains a malicious URL or that script execution has occurred.

**Required UI-owner fix (do not edit the screen in this review PR):** Apply one reviewed source-link policy to **all** `#source` writes in `show()`, not just the `a.src` list. Accept only explicitly reviewed HTTPS source hosts, reject relative, `javascript:`, `data:`, credential-bearing, nonstandard-port and lookalike-host URLs; remove `href` and show `Source unavailable · verification pending` / `출처 확인 불가 · 검증 대기` when rejected. Preserve the brief and map route. Treat a government hostname as a domain check, **not** document-content verification. Use the existing source taxonomy for third-party market references. Do not rely solely on the upstream JSON generator to sanitize a browser navigation sink.

**Regression acceptance cases:** (1) ticker route metadata with `source_url: 'javascript:alert(1)'` yields no clickable `#source` and retains the route text; (2) `data:`, `http:`, credential-bearing and spoofed official hosts are likewise rejected; (3) a valid official House Clerk PDF URL remains clickable; (4) an empty source removes a previously displayed link rather than leaving stale `href`; (5) demo `mission.url` obeys the same policy; (6) both Korean and English labels and iPhone landscape controls remain usable. Include a DOM-level test that calls the real `show()` route path, since #532's three tests exercise `mtIntentCard` only.

**Secondary wording issue:** #532 changes the zero-valid-source message to `Some sources unavailable` / `일부 출처 확인 불가` even when **every** source is absent or rejected. Distinguish `No verified source available` from `Some sources unavailable` based on valid/invalid counts. The existence of a third-party price link alone should not be presented as verification of an official filing claim.

**Verification boundary:** GitHub source at #532 HEAD was inspected, and Node.js URL parsing confirmed `javascript:` and `data:` have non-HTTPS schemes while a normal House Clerk PDF is HTTPS. No browser exploit, live-data compromise, merged code, mobile run or production deployment has been verified. This note is a review/acceptance specification only. Related: [#532](https://github.com/91cleaner/money-tracker/pull/532), [#527](https://github.com/91cleaner/money-tracker/issues/527).

## Scope and ownership

No `data/`, collectors, HTML, JS, workflows, credentials or production endpoints were modified by this review. It does **not** resolve [#527](https://github.com/91cleaner/money-tracker/issues/527), merge [#532](https://github.com/91cleaner/money-tracker/pull/532), or certify Pages/mobile operation. Repository visibility was **public** when checked on 2026-11-08; GitHub Pages content is not device-private. Actual trade-execution feed: **not connected**. Generative AI: **not connected**.
