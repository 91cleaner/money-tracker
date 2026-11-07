# PR #517 review — official-source link identity is not yet enforced

Reviewed 2026-11-06 against [draft PR #517](https://github.com/91cleaner/money-tracker/pull/517), head `e6b6cfcabf4fee2334b3d25eb000a08586227016`. This is a **code review plus an isolated Node.js reproduction of the exact `safeHref` helper**, not a browser exploit, live malicious record, or deployed-site test. No UI, data, collector, or production file was changed by this review.

## What #517 already fixes

The new `safeHref` rejects `javascript:`, `data:`, malformed absolute URLs, and credential-bearing URLs; invalid links render as non-clickable rows. Four focused regression tests are included. Do **not** undo these improvements. The remaining issue is **source authenticity**, which is different from executable URL schemes.

## Remaining P1 provenance boundary

`safeHref` currently accepts **any** absolute HTTP(S) host. `show('wh')` supplies `x.u` from `data/us/whitehouse.json` and labels the result as an original government document. For PTR entries without a ticker, `show('mem')` supplies `x.doc`. A syntactically valid attacker-controlled HTTPS host therefore becomes a clickable link that the interface presents as an original government source. This violates `docs/AI-ROLES.md`'s **official original sources only** rule, even though it is not a `javascript:` injection.

The exact helper body from #517 was executed in isolated Node.js with synthetic URLs:

| Synthetic input | Current `safeHref` result | Desired |
| --- | --- | --- |
| `https://www.federalregister.gov.evil.example/forged` | **accepted** | Non-clickable; hostname is not `www.federalregister.gov` |
| `http://evil.example/pretend-house` | **accepted** | Non-clickable; unknown host and non-HTTPS |
| `javascript:alert(1)` | rejected | Keep rejected |
| `https://www.federalregister.gov/documents/2026/11/05/2026-22688` | accepted | Keep accepted |

The current checked-in examples use `https://www.federalregister.gov/...`, `https://www.whitehouse.gov/presidential-actions/...`, and House PTR PDFs under `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/...`. These examples are evidence for **candidate** allowlist entries, not a claim that all valid historical sources have been enumerated. Check the full source inventory before enforcing the list.

## UI-owner acceptance gate

1. Enforce a documented **HTTPS exact-host** policy for external original-source links, scoped to the dataset/source type (Federal Register and White House presidential actions for `wh`; House Clerk disclosure PDFs for `mem` fallback). Do not use substring/suffix matches that allow `www.federalregister.gov.evil.example`, Unicode lookalikes, credential tricks, or protocol downgrades. If additional official hosts are needed, document their provenance first.
2. Preserve app-generated internal ticker navigation separately. For rejected, missing, or provenance-mismatched external links, render a non-clickable row with a visible **원문 링크 확인 불가** indicator; retain the record and do not imply verified `0건`.
3. Extend `tests/mt-tabs-load.test.cjs` for both tabs with valid official HTTPS, wrong official-looking host, `http:`, `javascript:`, missing link, and valid internal ticker route. Check that the rendered `href` is absent for every rejected external link.
4. Verify same-commit Node tests and real Chromium/mobile behavior before merge. This review does not establish production deployment or an observed malicious source. Claude/실장 owns UI changes under `docs/AI-ROLES.md`; keep #517 Draft until review.

## Release evidence at the reviewed SHA

At `e6b6cfc`, [Command room smoke](https://github.com/91cleaner/money-tracker/actions/runs/42107909392) **passed**. [Map smoke](https://github.com/91cleaner/money-tracker/actions/runs/42107909343) **failed** at the legacy `href="world-intelligence/"` assertion; [security/research](https://github.com/91cleaner/money-tracker/actions/runs/42107909354) **failed** after public artifact preparation at the legacy `href="intel-lab.html"` grep. These are separate from the source-host issue and have a proposed fix in still-unmerged [PR #403](https://github.com/91cleaner/money-tracker/pull/403). No real mobile or deployed Pages verification was obtained.

Repository visibility is **public** (not private). House PTR is delayed disclosure, **not** a live execution feed; live executed-trade data and generative AI are **DISCONNECTED**.
