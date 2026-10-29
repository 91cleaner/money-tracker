# MONEY TRACKER: measurable product readiness

## Analytics instrumentation
- Landing: anonymous `korea_entry`, `usa_entry`, `research_lab_entry`, `local_contracts_entry`.
- Research lab: anonymous `member_selected`, `bill_opened`, `source_opened`, `mission_started`, `trace_completed`.
- GoatCounter handles aggregate page views. Event names are fixed allowlisted strings; no search queries, names, user IDs or private data are transmitted by the custom tracking code.
- These event counts measure interactions, **not** distinct people or investment outcomes. If GoatCounter is blocked, no fake values are displayed.
- Returning visitor metrics and reliable session duration need explicit privacy-aware provider configuration; do not infer them from event totals.

## Acquisition metrics
Weekly dashboard should report provider-sourced visitors, country-entry clickthrough rate (entry events / landing pageviews), research start rate, member-to-bill trace rate, citation click rate, 7/30-day retention where consented measurement exists, collection freshness, evidence coverage, monthly infra cost, and incident count. Denominators and time zones must match.

## Verified release gates (2026-10-30 KST; not production certification)
- **Public exposure:** GitHub reports the repository as `public`; GitHub Pages is public too. A separate authenticated Cloudflare Worker does not make static Pages HTML, JS or JSON private. Check the published artifact and direct anonymous asset URLs before any proprietary release. See `docs/public-ui-private-data-policy.md`.
- **Worker size — blocking:** On `main` `efa999c5b09082c59b2317a6eda3c965a15b0c1a`, the GitHub Contents API reports `cloudflare/admin-worker.js` at **1,051,223 UTF-8 bytes**, **2,647 bytes over** the `1,048,576`-byte guard in `scripts/check_world_intelligence.py`. The sync script already compacts bill actions and excludes the full trade ledger. Do not weaken the guard or remove official links. Data/infrastructure owner: [#289](https://github.com/91cleaner/money-tracker/issues/289).
- **Worker acceptance:** Measure size before and after `python scripts/sync_command_worker.py`; run the sync twice to confirm stable output, then `python scripts/check_world_intelligence.py`. Preserve `COMMAND_DATA` lookup semantics, official House Clerk PDFs, `machine_parsed_requires_review` labels, and OAuth restrictions. Verify a real Wrangler deployment and both authorized and anonymous `/command` requests. A green GitHub Pages build **does not** verify Cloudflare.
- **Disclosure integrity:** Public House PTRs are **delayed reports**, not verified real-time executions or proof of misconduct. A lawmaker → bill → company → stock join needs independently cited original official records and distinct transaction, filing, bill-event, price, and ingestion dates. When a link is missing, show **unverified / unavailable**; never infer a causal trade signal from proximity.
- **Connection labels:** **Generative AI analysis: NOT CONNECTED. Live executed-trade feed: NOT CONNECTED.** Interactive maps and scripted public-data lookups must not be presented as connected AI or live trading intelligence.
- **Functional release:** Run world-health, command, security and research checks on the **merged target commit**. Manually test question → choice → map trace, back/close, source links, keyboard behavior and no horizontal overflow at **375px and 390px**. Record merged SHA, CI URLs, Pages deployment, and separately verified Worker status. A PR-only green CI run is not production proof.
- **Failure semantics:** Distinguish empty official results from a failed fetch, stale data, missing source and unverified joins. Never display a collection error as “zero records.”

## Historical caveats
- Public legislative records alone do not establish a verified member-transaction-to-bill-to-stock join.
- Map lines depict evidence exploration, not a person's physical travel or proof of influence.
- Proprietary linkage logic, if developed, must stay server-side; static Pages files are not secret.
- This checklist does **not** change the Worker, authentication, data collector or deployment.
