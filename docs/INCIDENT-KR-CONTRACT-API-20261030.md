# KR contract API: non-JSON response incident and safe recovery

**Incident:** 2026-10-30 19:59–20:01 KST (2026-10-30 10:59–11:01 UTC)  
**Severity:** P1 — scheduled contract ingestion blocked; not proof that existing published data was deleted.  
**Issue:** [#368](https://github.com/91cleaner/money-tracker/issues/368)  
**Evidence:** [failed Actions run 41044760130](https://github.com/91cleaner/money-tracker/actions/runs/41044760130)  
**Owner:** data ingestion / 실장 (per [AI-ROLES](../AI-ROLES.md)). This document does **not** change collector code or claim a production fix.

## Verified observations

1. Workflow `.github/workflows/collect.yml` reached `나라장터 계약 수집` (`python collector/collect.py`) and failed.
2. Logs show `getDataSetOpnStdCntrctInfo JSON이 아닌 응답: <!DOCTYPE html>` while requesting the 2026-10-27–2026-10-30 window and a historical refill window. It eventually reported `모든 요청이 실패했습니다`.
3. The later masking, validation and commit steps were skipped. This run therefore did **not** establish any new successfully published contract records.
4. The workflow injected `DATA_GO_KR_KEY` as a masked secret. That does **not** prove the key is valid, authorized for this endpoint, or within quota.
5. Root cause is **unknown**: possible API-side error, HTML error/login page, rate limit, authorization, upstream proxy or endpoint change. The observed `<!DOCTYPE html>` is not enough to choose among them.

## Triage without leaking credentials

1. Open the failed job above. Record UTC timestamp, endpoint name, HTTP status, content type, redirect count, `Retry-After` if present, and a **sanitized** provider error code/message. Do **not** print raw request URLs with query keys, request headers, tokens or full HTML bodies.
2. Verify the endpoint and dataset's current availability/response contract through its official provider documentation or support channel. Check whether the provider returns JSON on success and HTML on errors.
3. Check the repository secret **exists** using GitHub secret settings (do not print its value). Confirm endpoint permission, quota, and expiry with the data owner. If the key must be replaced, rotate it in GitHub Actions secrets and never commit it.
4. Distinguish status classes before retrying: `401/403` → credentials/permission investigation; `429` → honor `Retry-After` with bounded backoff; `5xx`/timeout → bounded retries; `200 + text/html` → treat as invalid payload and investigate, **not** as an empty JSON result.
5. If the newest required date window cannot be fetched, mark the run failed and preserve the last validated dataset. A missing response must not be represented as “0 contracts.”
6. Once provider access is restored, run a controlled `workflow_dispatch` refill for a narrow affected date range. Compare source record IDs, row counts, duplicates, dates and validation results with the last good snapshot before publishing.

## Acceptance criteria for the collector owner

- [ ] Structured, redacted diagnostics distinguish HTTP error, invalid content type, JSON parsing error, provider error and network timeout.
- [ ] Tests cover valid JSON, HTTP 200 HTML, 401/403, 429, 5xx, timeout and partial-page failures.
- [ ] Total failure of the required current window blocks publication and retains last known good data; partial coverage is labeled incomplete.
- [ ] A successful real workflow run records source, attempted window, fetched/published counts, last success time and a link to its run. No “success” label based solely on pre-existing files.
- [ ] Public UI shows `수집 실패/일부 누락/마지막 정상 수집` distinctly from a verified zero result.
- [ ] New source records are deduplicated and validated before a production deploy.

## Verification record

- 2026-10-30: Actions job log and workflow YAML read directly; failure confirmed. No collector edit, rerun, new data or deployment performed in this review.
- Independent UI smoke checks and Pages deployment for another commit may pass while this **separate** contract ingestion job fails. Never conflate these statuses.
- **AI-generated analysis: not connected. Live trade execution feed: not connected.** Public disclosures are delayed reports, not live executions.
