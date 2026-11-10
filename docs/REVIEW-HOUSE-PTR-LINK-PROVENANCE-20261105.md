# Review: House PTR original-link provenance boundary

Reviewed 2026-11-05 KST. Static source review only; **not a confirmed production exploit or deployed fix**.

## Scope and evidence

- `scripts/collect_house_filings.py` generates `document_url` from the official House Clerk host and an XML `DocID`, but also imports previously cached `records` from `us-house-filings.json` without validating each cached `document_url` before republishing it.
- Draft PR [#479](https://github.com/91cleaner/money-tracker/pull/479), HEAD `3c5ea7bfe28a05d4ab4c09ba1aaf02cb6d8a9570`, reads `../data/us-house-filings.json` and assigns `a.href=x.document_url` for any truthy value while labeling the anchor **"공식 PTR PDF 열기"**. This is distinct from the same page's `trades_public.json` renderer, which already checks for a House Clerk URL prefix.
- The current generated links are intended to point to the official host. The problem is a **missing independent source/URL validation boundary**, particularly for retained cached rows and malformed or manually edited public JSON. No malicious record has been observed.

## Acceptance criteria (data owner + UI owner)

1. **Collector / public artifact:** validate each `document_url` after merging cached and freshly collected records. Accept only HTTPS URLs with the **exact** hostname `disclosures-clerk.house.gov`, no username/password, no unexpected port, no query or fragment, and a reviewed House PTR PDF pathname (e.g. `/public_disc/ptr-pdfs/2026/12345678.pdf`; verify the actual official DocID character policy before enforcing a numeric-only filename). Verify URL year agrees with the row's `year`. Do not silently rewrite invalid links to a different target. Quarantine invalid cached rows or omit the link and mark its provenance **UNVERIFIED**.
2. **Browser:** independently parse with `new URL(value)` and check protocol, exact hostname and expected path before setting `a.href` and showing the **official** label. Use `textContent` for labels and retain `rel="noopener noreferrer"`. A rejected URL must not render as a clickable official document.
3. **Schema:** missing/invalid `document_url` is not proof of a nonexistent filing. Keep the record with a visible **원문 링크 미검증** state when possible. A file count alone must not be called "verified" without provenance checks.
4. **Regression matrix:** a valid House Clerk PDF link; `javascript:alert(1)`; `https://evil.example/x.pdf`; `https://disclosures-clerk.house.gov.evil.example/x.pdf`; `https://disclosures-clerk.house.gov@evil.example/x.pdf`; an official-host non-PDF path; an official-host URL with query/fragment; a cached row with a mismatched year; and a valid official row plus an invalid cached row. Assert that no invalid link appears under the official label.
5. Test the **actual collector → public JSON → PR #479 browser rendering** path. Also retain separate regression coverage for partial-year `errors` and the House/Senate scope (already documented in `docs/RELEASE-GATES.md`).

## Ownership and release status

Per `docs/AI-ROLES.md`, the data collector belongs to the data owner and `world-intelligence/` HTML belongs to Claude. This GPT review changes **documentation only** and requests a coordinated patch, rather than editing their files or claiming that a vulnerability is exploitable in production. All implementation PRs require owner approval before merge.

Release is **NOT VERIFIED** until the candidate SHA passes the security, map and source-to-view checks, the deployed artifact is matched to that SHA, and mobile behavior is tested. Historical STOCK Act disclosures are not live executions; generative AI integration remains **DISCONNECTED** unless separately verified.
