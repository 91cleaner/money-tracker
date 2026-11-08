# World-search source provenance: HTTPS is not official verification

**Review date:** 2026-11-08 KST  
**Target:** draft [#530](https://github.com/91cleaner/money-tracker/pull/530), head `69fc771`  
**Owner boundary:** GPT review only; Claude owns `world-intelligence/` UI, 실장 owns `data/` and collectors. No production fix is claimed here.

## Verified behavior and remaining P1 risk

[#530](https://github.com/91cleaner/money-tracker/pull/530) correctly isolates malformed links so that one bad `a.src` entry no longer discards the answer. It validates parsed URLs for HTTPS, a nonempty hostname, and no embedded username/password. **That is URL syntax safety, not source authenticity.**

The current `mtIntentCard` predicate still accepts these URLs as clickable sources:

- `https://disclosures-clerk.house.gov.evil.example/ptr`
- `https://finance.yahoo.com.evil.example/quote/NVDA`

Reproduction with Node.js `new URL(u)`: both return `protocol === 'https:'`, nonempty `hostname`, and empty `username/password`. They are *illustrative synthetic inputs*, not evidence that a malicious link exists in current data. A domain suffix or substring check would also be insufficient.

Separately, `scripts/analyze/build.py` sets `src: ['https://finance.yahoo.com/quote/' + sym]` for price series, while `scripts/analyze/verify.py` checks only that answer `src` is nonempty. Yahoo is a **third-party market-data reference**, not an official government filing. Therefore a blanket government-only allowlist would break valid price-source references; the correct fix needs **typed provenance**.

## Proposed acceptance contract (Claude + 실장)

1. At data generation/verification time, tag each source as `official_filing`, `official_policy`, `market_data_third_party`, or `unverified`. Keep the source URL, observation/as-of date, and evidence type distinct. Do not infer official status from HTTPS alone.
2. Validate the parsed **exact hostname** against a maintained, category-specific source registry. Subdomains must be explicitly approved; never use `endsWith('gov')`, `includes('house.gov')`, or an unrestricted HTTPS predicate as an authenticity check. Reject userinfo, non-HTTPS, invalid URLs and synthetic lookalike hosts. Avoid overclaiming that a host match validates the *document contents*.
3. Render separate, neutral labels: `공식 신고 원문` / `공식 정책 원문` / `민간 시세 참고` / `출처 미검증` (English equivalents). If provenance is absent, keep the answer but display `출처 미검증 · 원문 확인 필요`, **not** an official-source badge.
4. Add tests to the real `mtIntentCard` harness and generator verifier for: exact official host accepted with correct label; official-looking suffix rejected; third-party Yahoo price link accepted **only as third-party**; mixed sources retain valid links and answer; invalid-only sources show pending verification; no URL credential leakage; source missing/HTTP failure is not `0건`.
5. Require green PR HEAD tests, source/provenance checks, and same-SHA deployed-site/mobile landscape verification before calling the fix deployed. Do not merge without Claude/실장 approval.

## Integration status at review time

- [#530](https://github.com/91cleaner/money-tracker/pull/530): draft/unmerged; URL safety regression 8/8 passed on [map workflow run 42448718498](https://github.com/91cleaner/money-tracker/actions/runs/42448718498), but the full map job failed its existing country-entry contract.
- [Security workflow 42448718510](https://github.com/91cleaner/money-tracker/actions/runs/42448718510) failed the existing `intel-lab.html` root-link assertion; Cloudflare preview for head `69fc771` reported **build failed** in the PR conversation. Neither is evidence of a deployed source-link fix.
- [#527](https://github.com/91cleaner/money-tracker/issues/527): PTR future-date/source-PDF reconciliation still open. A successful Pages build is not proof of disclosure chronology accuracy.
- Repository visibility is **public**, not private. Executed-trade live feed **NOT CONNECTED**; generative AI **NOT CONNECTED**. Precomputed rule/template answers are not live AI search.

**Scope:** This document records a reproducible source-authenticity gap and concrete release criteria. It does not modify UI, data, collector, workflows, tests, secrets, or production deployment.
