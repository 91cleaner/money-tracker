# P1 review — US daily fact cards: counts, provenance and freshness

Reviewed 2026-11-05 KST. Source-level review of `main` at `scripts/build_us_daily.py` blob `39f13a9347058d926d41456b61c622d32eb06446` and published JSON `data/us/daily/2026-11-05.json` blob `367441e25a4f5b089cb272bbbad2dcf9886cf832`. **The current published artifact is affected by misleading labels; no underlying transaction fraud or live execution is alleged.** This document is a handoff, **not a deployed code fix**.

## Verified independent defects

1. **SEC Form 4 transaction rows are called filing counts.** The generator iterates `companies[*].trades`, then computes `len(new)` where `new` contains individual P/S rows. It renders `"임원 거래 신고 {len(new)}건"`. The 2026-11-05 card says **49건 / 14개 회사** and separately groups eight META rows for one reporting person. Those are **49 selected transaction rows**, not 49 independently counted Form 4 filing documents. The generator does not retain an accession ID on each row, so unique filing counts cannot be inferred safely from this data structure. Change headline and metric to `공개시장 매수·매도 거래 항목 49건 (수집된 회사 14곳)`, or add verified unique accession IDs and report both counts separately.

2. **“임원” overstates reporting-owner roles.** `scripts/collect_form4.py` includes reporting owners who are directors or 10% owners, not only officers. `build_us_daily.py` labels all as `회사 임원 거래`. Prefer `SEC Form 4 내부자 신고` and `신고자`, retaining the source role when available. The reported code P/S is not independently verified exchange execution, and reported `shares * price` is an approximation when values are present.

3. **White House web publication is labeled “관보”.** The generator selects `whitehouse.json` entries of `kind == 'presdoc'` and uses the latest `date`, then says `{date} 관보에 대통령 문서 N건이 실렸어요`. The 2026-11-05 card links to `whitehouse.gov/presidential-actions/...`, not a Federal Register publication record. Without a matched `federalregister.gov` document and publication date, say `{date} 백악관 공개 대통령 문서 N건`. Distinguish White House posting date from Federal Register publication date.

4. **The congressional card calls all recent rows “하원” without chamber filtering.** The `trades.json` loop selects by `fd` only and never checks `c == 'h'`. If the ledger includes Senate or unknown-chamber rows, they will be counted as House disclosures. This is a *conditional scope bug*, not a claim that the 2026-11-05 snapshot includes a Senate row. Filter House records and reject unknown chamber for a House-only card, or label chambers separately.

5. **Partial upstream failures can silently create a complete-looking daily card.** Each data-source section uses broad `except Exception: print(...)` and the script still writes `YYYY-MM-DD.json` and advances `index.json.latest`. The file has `made` but no per-source success, partial, error or source-last-updated fields. Therefore a failed collector or invalid source can disappear from the daily brief without a visible warning. A new card's creation timestamp is **not** evidence that every upstream source refreshed.

6. **Contract, lobbying and PAC comparison lacks displayed provenance/window.** The `snap` totals come from a selected company universe and may be cumulative or partial. `max(cur.items())` is only the maximum **among collected companies**; the daily card does not display the source URL, as-of timestamp, reporting period or partial/rate-limit status. Do not imply a nationwide ranking, actual contract payments, a company's own lobbying spending, or direct corporate political donations.

## Data-owner / UI-owner acceptance criteria (not implemented here)

- SEC: label `len(new)` **transaction rows**, not filings; if reporting filing counts, preserve and deduplicate official accession IDs. Use `내부자` rather than `임원` unless role is independently checked. Distinguish reported transaction date from SEC filing date. Ensure every displayed row has a verifiable SEC filing link.
- White House: use `백악관 공개` unless a Federal Register publication identifier/date is independently present; display the relevant date type.
- Congressional: filter `c == 'h'` before the House card; do not silently label unknown or Senate rows as House. Require official original PDF and separate `fd`/transaction `d` semantics.
- Source freshness: record `status: ok | partial | unavailable | stale` and `source_updated` per section, and do **not** render a successful empty response when a collector failed. Do not advance a verified snapshot claim solely because the daily JSON was written.
- Aggregates: attach official source/period/coverage metadata and display `수집 대상 N개 중`; surface rate limits and partial coverage; distinguish federal contract **obligations** from disbursements, lobbying disclosures from own spend, and PAC activity from direct corporate giving.
- SEC collector privacy hygiene: `scripts/collect_form4.py` contains a hard-coded fallback User-Agent contact address. Require a configured nonpersonal `SEC_USER_AGENT` rather than committing a contact address to public code; do not print the value in CI logs. This is a source-code privacy hygiene finding, not proof of account compromise.

## Offline regression scenarios

| Fixture | Required result |
| --- | --- |
| One SEC Form 4 accession with eight P/S rows | Eight transaction rows; **not eight filings** |
| SEC director-only or 10%-owner report | Label “내부자”, not necessarily “임원” |
| White House posting with no Federal Register ID | “백악관 공개”; never “관보 게재” |
| Mixed House `c=h`, Senate `c=s`, unknown `c=?` | House-only card counts only `h`; unknown remains unverified |
| Source JSON absent, malformed, stale or partially collected | Explicit `UNAVAILABLE/PARTIAL/STALE`, not “0건” or a silently complete daily report |
| PAC source with rate limit, federal obligations with partial agency coverage | Coverage and period warning next to the amount; no national-total claim |
| Valid official source plus invalid link | Reject or visibly mark invalid link; no “공식 원문” badge |

**Integration gate:** test the real collector → daily builder → generated `data/us/daily/YYYY-MM-DD.json` → browser card path on the **same commit SHA**. Record Actions run and deployed Pages evidence; a document review or successful file write is not a passing end-to-end test.

## Ownership / status

`docs/AI-ROLES.md` assigns `data/` and collectors to the data owner, and the UI to Claude. This GPT review changes **documentation only** and must not be mistaken for a code fix. No data, script, UI, CI, or production deployment was changed. Owner approval is required before merge. GitHub repository/Pages are **PUBLIC**; live executed-trade feed and generative AI remain **DISCONNECTED** until independently verified.
