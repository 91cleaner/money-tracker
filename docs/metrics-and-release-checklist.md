# MONEY TRACKER: measurable product readiness

## Analytics instrumentation
- Landing: anonymous `korea_entry`, `usa_entry`, `research_lab_entry`, `local_contracts_entry`.
- Research lab: anonymous `member_selected`, `bill_opened`, `source_opened`, `mission_started`, `trace_completed`.
- GoatCounter handles aggregate page views. Event names are fixed allowlisted strings; no search queries, names, user IDs or private data are transmitted by the custom tracking code.
- These event counts measure interactions, **not** distinct people or investment outcomes. If GoatCounter is blocked, no fake values are displayed.
- Returning visitor metrics and reliable session duration need explicit privacy-aware provider configuration; do not infer them from event totals.

## Acquisition metrics
Weekly dashboard should report provider-sourced visitors, country-entry clickthrough rate (entry events / landing pageviews), research start rate, member-to-bill trace rate, citation click rate, 7/30-day retention where consented measurement exists, collection freshness, evidence coverage, monthly infra cost, and incident count. Denominators and time zones must match.

## Actual state at this change
- Public member/bill exploration uses existing `data/us/members.json` and `data/us/bills/{bioguide}.json`, sourced from public legislative records.
- There is no verified member transaction-to-bill-to-stock join. `data/us-disclosures.json` still states awaiting verified records; no stock signal is inferred.
- Map animation depicts a conceptual relationship between an official's geographic office coordinates and US Capitol, not their travel or proof of corporate influence.
- Proprietary linkage logic must remain server-side when built; static public files are not secret.
- The new private Worker is **not** deployed and returns 501 even after valid authentication; it must not be advertised as a live private database.
- A prior Cloudflare admin Worker exists at `cloudflare/admin-worker.js`. It must be audited separately; this change does not replace it.
- A passing CI run, verified production URL, Cloudflare bindings and verified authorization tests are required before declaring stages fully shipped.

## Release telemetry: distinguish CI success from published freshness (2026-11-10 KST)

A collector run, a Pages deployment, a production smoke test, and an authenticated Worker test are **different events**. A green collector must never make the release badge green. Record the following fields in the operator's release report, using GitHub Actions/API evidence rather than guessed status:

| Field | Meaning / release rule |
| --- | --- |
| `main_sha` | GitHub `refs/heads/main` SHA at verification time, not the SHA at workflow start |
| `pages_attempt_sha`, `pages_attempt_conclusion`, `pages_attempt_url` | Latest Pages attempt, including failures; do not select only successful runs |
| `pages_success_sha`, `pages_success_url` | Latest *successful* Pages workflow; success alone is not evidence of published asset parity |
| `same_sha_deployed` | `true` only when the current `main_sha` equals the deployed candidate **and** live asset/content hash checks for that candidate pass; otherwise `false` or `unknown` |
| `security_suite`, `question_choice_map_smoke`, `mobile_iphone` | Independently `pass` / `fail` / `not_run`; a PR-only test is not a production gate |
| `ptr_freshness`, `ptr_chronology`, `source_coverage` | Evidence-based disclosure date/source checks; distinguish missing data from zero trades |
| `live_execution_feed`, `generative_ai`, `private_access` | Independently `connected_verified` / `disconnected` / `unverified`; a delayed public House PTR filing is **not** a live execution feed |

**Observed incident example, 2026-11-10 13:53 KST:** current `main` was `3d44a575` (13:37 data refresh). The later Pages attempt for `518e0310` [#42755930926](https://github.com/91cleaner/money-tracker/actions/runs/42755930926) **failed** in `actions/deploy-pages@v4` after repeated `syncing_files` and a timeout; the earlier attempt for `c6558f4c` [#42755398495](https://github.com/91cleaner/money-tracker/actions/runs/42755398495) **succeeded**. Therefore `same_sha_deployed` is **unverified**, not `true`; do not infer a site outage from this evidence. The repository API reported `visibility: public` and `main.protected: false`. Public Pages cannot be called device-only private access. Existing full-suite release gate [PR #545](https://github.com/91cleaner/money-tracker/pull/545) is still open, not merged.

**Release acceptance:** mark a release ready only after the exact production candidate has (1) all required security/data and question→selection→map checks green **before** publication, (2) successful same-SHA Pages publication and verified live assets, (3) actual mobile browser/landscape navigation checks, (4) explicit source/transaction freshness and unavailable-state labels, and (5) verified server-side authorization for any owner-only path. Until independently tested, show real-time executed trades and generative AI as **미연결 / disconnected**. This is a measurement contract, not an assertion that the missing CI, deployment, or access controls were implemented.
