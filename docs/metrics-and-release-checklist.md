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
