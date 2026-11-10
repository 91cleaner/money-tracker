# P1 review — Taiwan collection is failing, not reporting zero legislative activity

Reviewed 2026-11-04 05:54 KST against `main` and `data/search/collection-status.json` (snapshot `created_at: 2026-11-03T19:21:18.630Z`). **This is an operational review and handoff, not a collector repair or a successful Taiwan data fetch.**

## Confirmed observation

| Collector | Snapshot count | Reported errors | Interpretation |
| --- | ---: | --- | --- |
| `us_federal_register` | 108 | none listed | 108 items reported by this snapshot; not independent source verification |
| `japan_diet` | 46 | none listed | 46 items reported by this snapshot; not comprehensive Diet coverage |
| `us_sec` | 76 | none listed | 76 items reported by this snapshot; not full SEC coverage |
| **`taiwan_legislature`** | **0** | **8** | **Fetch failed; coverage unavailable, NOT zero events** |

The Taiwan error list is `members: fetch failed` plus seven query failures: `半導體`, `人工智慧`, `經濟安全`, `供應鏈`, `能源`, `台美`, `國防`. The status file does **not** identify an HTTP status, final request URL, timeout, parser exception, or whether the upstream service changed. No cause can yet be assigned.

## P1 data-owner handoff (실장)

1. Reproduce one member request and one keyword request from the same runner/environment as the scheduled collector; record sanitized URL host/path, response status, elapsed time, content type, and retry count. Never log API keys, cookies or private query tokens.
2. Distinguish transport errors, rate limits, permission denial, non-JSON/HTML challenge pages, changed response schemas, and a valid empty result. Apply bounded retries/backoff only to transient failures; do not convert failed fetches into an empty-success response.
3. Keep the previous last-known-good Taiwan snapshot, if one exists, **only with its original observation timestamp and a prominent STALE label**. If none exists, show **UNAVAILABLE — source fetch failed**. Never silently substitute invented events or a current timestamp.
4. For each accepted record, preserve the official legislature source URL, record ID, event/publication date, observed-at time, and provenance. Do not infer stock causation or bill-to-company relationships from keyword matches.
5. Add deterministic offline tests for: 200 valid nonempty response; 200 valid empty response; 403/429; timeout; 200 HTML challenge; malformed JSON; schema drift; partial keyword failure; recovery after retry; and stale cache with source time preserved. Assert `0 records + errors` is never displayed as `0 legislative events`.
6. After a fix, confirm **two consecutive scheduled runs** with source-linked records or legitimately empty successful responses, and inspect the published JSON/Pages state. Confirm question → selection → map trace in mobile landscape; data CI success alone is not a UI test.

## Acceptance / ownership

- Data owner: collector, retries, provenance, status semantics and regression tests.
- Claude/UI owner: three distinct map labels — **AVAILABLE**, **STALE**, **UNAVAILABLE (fetch failed)** — with observation time and official links; show `AI NOT CONNECTED` and `real-time executed-trade feed NOT CONNECTED` separately.
- GPT: review and copy only under `docs/AI-ROLES.md`. No `data/`, collector, UI, workflow, or deployment files changed here.
- Do not merge or publish a claim of restored Taiwan coverage until owner approval, source evidence, automated tests and post-deploy verification.

**Privacy and scope:** Repository and GitHub Pages are PUBLIC as verified via repository metadata; this document contains no secrets. The snapshot's counts are collector-reported, not new records acquired by this review.
