# Release decision gates — MONEY TRACKER

> Operational acceptance checklist, not a claim that these gates are implemented in CI. Last reviewed: 2026-11-07 (KST). Applies to the public GitHub Pages build and the separately deployed authenticated Cloudflare Worker.

## Integration decision update — 2026-11-07 01:54 KST

This section supersedes **historical PR status statements below**; those dated observations remain as an audit trail. GitHub checks are branch-SHA-specific and do not establish deployment.

| PR / exact head | GitHub check evidence | Merge/deploy disposition |
| --- | --- | --- |
| [#403](https://github.com/91cleaner/money-tracker/pull/403) `bcb46ed` (base: `main`) | [Map PASS](https://github.com/91cleaner/money-tracker/actions/runs/42248421435), [Command PASS](https://github.com/91cleaner/money-tracker/actions/runs/42248421361), [Security PASS](https://github.com/91cleaner/money-tracker/actions/runs/42248421316) | Open, not merged. Owner must review and approve the shared entry/deployment checks. |
| [#522](https://github.com/91cleaner/money-tracker/pull/522) `cd4aa1e` (**base: #403 branch**, not `main`) | [Map PASS](https://github.com/91cleaner/money-tracker/actions/runs/42248519412), [Command PASS](https://github.com/91cleaner/money-tracker/actions/runs/42248519445), [Security PASS](https://github.com/91cleaner/money-tracker/actions/runs/42248518910) | Draft; SkySea artifact/live-entry checks are **stacked** on #403. After #403 lands, retarget #522 to `main`, inspect its diff, and rerun checks on the final SHA. |
| [#523](https://github.com/91cleaner/money-tracker/pull/523) `bf311da` (base: `main`) | [Map FAIL](https://github.com/91cleaner/money-tracker/actions/runs/42238453357), [Command PASS](https://github.com/91cleaner/money-tracker/actions/runs/42238453125), [Security FAIL](https://github.com/91cleaner/money-tracker/actions/runs/42238453180) | Draft; HTML-escaping security fix **not deployed**. Rebase on accepted CI base, investigate the failed jobs and rerun the complete suite before owner/UI review. |
| [#521](https://github.com/91cleaner/money-tracker/pull/521) `3e24717` (**base: #517**, which is based on #513) | [Map FAIL](https://github.com/91cleaner/money-tracker/actions/runs/42198956536), [Command PASS](https://github.com/91cleaner/money-tracker/actions/runs/42198956483), [Security FAIL](https://github.com/91cleaner/money-tracker/actions/runs/42198956668) | Draft; do **not** merge directly into main without the #513 → #517 dependency and UI-owner review. Retest tab persistence and late widget mounting on iPhone landscape. |

**Release sequence / no duplicate implementation:** obtain owner approval for #403; then retarget and review #522; then integrate/retest #523 and the #513 → #517 → #521 tab stack against the accepted base. Recheck the **combined** SHA, not the previously green branch SHAs. Keep the older #503 data/PTR gates, especially #412/#504/#479, separate until their owners address them. Do not report that all fixes are in production merely because individual PR checks passed.

**Current evidence boundary:** the repository is **public**, not private. These PRs remain unmerged as checked; production Pages parity, authenticated Worker, actual iPhone landscape navigation, and question → candidate → map fly-to have **NOT BEEN VERIFIED** by this review. Independently confirmed real-time executed-trade data and generative AI are **DISCONNECTED**. No UI, collector, data, workflow, or production changes were made by this documentation update.

## Non-negotiable release rule

A green **Deploy MONEY TRACKER Pages** workflow alone is **not** evidence that the research, privacy, mobile, and data checks passed. As of this review, `.github/workflows/deploy-pages.yml` is independently triggered on pushes to `main`; the security/research workflow is not a required dependency. Do not label a release *verified* until the **same commit SHA** satisfies all gates below. The owner must approve merges under `docs/AI-ROLES.md`.

| Gate | Minimum evidence | Failure state |
| --- | --- | --- |
| Identity | Record source commit SHA, Pages deployment run URL, artifact SHA/digest, and published URL. Compare published critical files with the **artifact from that run** (not just HTML text markers). | **NOT VERIFIED** if SHA/artifact parity is unknown |
| Public exposure | Run `python3 scripts/prepare-public-pages.py` and `python3 scripts/check-pages-artifact.py`. Inspect the public output for private Worker code, credentials, unpublished trade ledgers, and newly added `data/` files; an allowlist is safer than an extension-only filter. | **BLOCK** on any unexpected exposure |
| Syntax/security | Run `node --test worker/private-api.test.mjs` and `python3 -m unittest discover -s tests`; require the security/research GitHub Actions job on the candidate SHA to pass. | **BLOCK** on failure or skipped required checks |
| Map/navigation | Run `node --test tests/usa-map-smoke.test.cjs` for the active US command map. `python3 scripts/check_world_intelligence.py` also checks the world-intelligence redirect and data contracts, but does **not** test browser navigation. In a real browser verify country entry, the flat map, visible search input in KO and EN, question → candidates → selection → map fly-to, back/close, and a second query. | **NOT VERIFIED** if only static markers pass |
| Mobile | In an iPhone-size landscape viewport verify keyboard focus does not zoom or cover the question field, map remains pan/zoomable, close/back remain visible, options can reopen, and no panels obscure the entire map. Repeat KO/EN. | **NOT VERIFIED** without browser evidence |
| Public trade evidence | Validate JSON schema, impossible/future dates, empty/malformed response handling, original House Clerk PDF URLs, and date semantics (transaction date vs notice date vs filing date). A successful HTTP 200 with malformed JSON is **ERROR**, never zero trades. | **BLOCK** if data errors are presented as verified 0 |
| Bill → member → company | Show the official bill identifier and status, separately sourced member and disclosed trade, and company identifier. A shared date or sector is **not** evidence of causation or misconduct. | **UNVERIFIED** when any link lacks a source |
| Live integrations | Label live executed-trade feed and generative AI **DISCONNECTED** unless independently tested. A historical PTR disclosure is not a live execution feed. Satellite basemaps and drawn route arcs are not live intelligence. | **BLOCK** on misleading connected/live claims |
| Post-deploy | Recheck the published country entry, world map, US disclosure view, source links and public JSON against the **same deployed SHA**; retain run links/screenshots. | **NOT VERIFIED** if production was not tested |

## Reproducible local preflight on the candidate checkout

```sh
node --test worker/private-api.test.mjs
node --test tests/usa-map-smoke.test.cjs
python3 -m unittest discover -s tests
python3 scripts/check_world_intelligence.py
python3 scripts/prepare-public-pages.py
python3 scripts/check-pages-artifact.py
```

These commands exist on `main` as of 2026-11-04. They do **not** replace real browser tests, a public-file allowlist audit, or post-deploy parity checks. Do not run the artifact builder on a working tree with uncommitted data changes and then attribute the result to a different SHA.

## Verified CI blockers — 2026-11-04 16:55 KST

These are **observed failures**, not a new deployment claim. Candidate: [PR #479](https://github.com/91cleaner/money-tracker/pull/479), commit `3c5ea7bfe28a05d4ab4c09ba1aaf02cb6d8a9570`.

| Workflow / run | Verified result | Concrete next action |
| --- | --- | --- |
| [Command room smoke](https://github.com/91cleaner/money-tracker/actions/runs/41788852981) | PASS | Keep the candidate SHA and evidence |
| [Verify world intelligence](https://github.com/91cleaner/money-tracker/actions/runs/41788852863) | PASS; static checks only | Do not substitute for browser evidence |
| [Map smoke](https://github.com/91cleaner/money-tracker/actions/runs/41788852904) | **FAIL**: 8/9 tests passed; country-selection assertion in `tests/usa-map-smoke.test.cjs:68` still checks `korea.html` for the old entry links | Update the test to read the **current** root `index.html` and assert its real `korea.html` / `world-intelligence/` links. Preserve a separate Korean-screen test if needed; do not weaken the route assertion |
| [Security/research](https://github.com/91cleaner/money-tracker/actions/runs/41788852864) | **FAIL** after 147 Python tests passed: the artifact step still requires `href="intel-lab.html"` in `.public-pages/index.html`, which the current country chooser does not contain | Replace the stale grep with checks for the actual root entry links, then retain all private-file exclusion and artifact validation checks |

The current `index.html` contains `href="korea.html"` and `href="world-intelligence/"`. These failures are reproducible **CI contract drift**, not evidence that the active browser experience works. PR #403 targets entry-check repair, but remains unmerged; avoid duplicating its implementation. After it is rebased, require **both failed workflows to pass on the merged candidate SHA**, then verify the published artifact and mobile KO/EN flow. Do not merge #479 on the strength of its two green checks alone.

## Outstanding integration, not yet a release claim

- [PR #403](https://github.com/91cleaner/money-tracker/pull/403): shared Pages entry checks and CI repair. Its proposed `scripts/check-pages-entry.py` is **not on main** as of this review. Rebase and resolve conflicts before any merge; then rerun all checks.
- [PR #458](https://github.com/91cleaner/money-tracker/pull/458): public JSON/deployed parity work. Proposed scripts are **not on main** as of this review. Verify publication SHA and JSON content, not just HTTP success.
- [PR #412](https://github.com/91cleaner/money-tracker/pull/412): House PTR date quarantine. Verify the corrected notice/filing-date semantics before merging.
- [PR #479](https://github.com/91cleaner/money-tracker/pull/479): US disclosure view syntax repair. Recheck malformed JSON, zero vs error, and iPhone behavior after merge.
- [PR #495](https://github.com/91cleaner/money-tracker/pull/495): provenance review for new history layers. Replace secondary references with authoritative evidence before claiming verification.

## P1 chamber scope in US disclosure view — 2026-11-04 18:59 KST

**Observed in [PR #479](https://github.com/91cleaner/money-tracker/pull/479), HEAD `3c5ea7b`:** `world-intelligence/us-signals.html` titles its archive “미국 하원 공개 거래 기록”, yet fetches `data/us/trades_public.json` and displays all `data.trades` without checking the chamber field `c`. The JSON source metadata names **both U.S. House Clerk and U.S. Senate eFD**, and `scripts/build_public_trades.py` preserves `c`. If any Senate entries exist, they can appear as House disclosures. This is a demonstrated missing filter, **not** a verified count of Senate rows in today's snapshot.

**Merge gate:** either (A) keep a House-only archive and explicitly filter to `r.c === 'h'`, validating House Clerk original links, or (B) rename to a House/Senate archive, label the chamber per row, and apply chamber-appropriate official source links. A generic “상원 수집 미확인” footer is insufficient.

**Regression:** add a mixed-chamber fixture with one `c:'h'` and one `c:'s'` row plus a missing/unknown chamber row. Assert that A shows only the House row or B labels both chambers correctly, and unknown chamber data never silently becomes House. Run on the candidate SHA alongside existing malformed-JSON and empty-data tests. Per `docs/AI-ROLES.md`, UI implementation belongs to the UI owner; this is a review gate only.

## P1 integration check — public PTR builder PR #504 (2026-11-04 22:55 KST)

**Observed on [PR #504](https://github.com/91cleaner/money-tracker/pull/504), HEAD `3091675aa21c97c5ca5642138963a32947e13b65`:** the branch adds schema rejection for missing/non-array `trades`, rejects non-object trade rows, preserves the per-record `verification` field, and includes three Python regression cases. This is a **branch-only fix**, not an applied production protection. On `main`, `scripts/build_public_trades.py` still iterates `src.get("trades", [])` and omits `verification` from its public field allowlist.

| Evidence on #504 HEAD | Outcome / interpretation |
| --- | --- |
| [Security/research run 41834035528](https://github.com/91cleaner/money-tracker/actions/runs/41834035528) | **FAIL** in artifact step: legacy `grep -q 'href="intel-lab.html"' .public-pages/index.html`; the preceding Python suite completed. Failure does **not** establish that the new PTR tests failed. |
| [Map smoke run 41834035525](https://github.com/91cleaner/money-tracker/actions/runs/41834035525) | **FAIL**: country-entry assertion in `tests/usa-map-smoke.test.cjs`; 8/9 subtests passed. |
| [Command room run 41834035569](https://github.com/91cleaner/money-tracker/actions/runs/41834035569) | **PASS**, but only its own check scope. |
| GitHub PR status | Mergeability and check conclusions are separate: a branch can be mergeable yet **unstable/red**. Do not merge on mergeability alone. |

**Actionable integration order (avoid duplicate patches):** (1) rebase/repair existing [#403](https://github.com/91cleaner/money-tracker/pull/403) for the two stale entry assertions and rerun both CI workflows; (2) rebase [#504](https://github.com/91cleaner/money-tracker/pull/504) on the accepted CI base and verify the *actual generated* `trades_public.json` preserves warnings while rejecting malformed input without overwriting the last good artifact; (3) integrate [#479](https://github.com/91cleaner/money-tracker/pull/479) with explicit House/Senate scoping and the same generated public fixture; (4) verify the merged SHA and published Pages artifact, then KO/EN mobile landscape. All merges require owner approval. **No live trade execution feed or generative AI connection has been verified.**

## Reporting vocabulary

- **PASS**: tested on named SHA, evidence URL/log retained.
- **FAIL**: test executed and failed.
- **NOT VERIFIED**: test not executed or no matching evidence.
- **DISCONNECTED**: live data/AI integration absent or not proven operational.
- **0 RECORDS**: only after a successful request and schema-valid, source-complete response. Never substitute for fetch failure, missing file, or parser error.

**Security:** This repository and GitHub Pages are currently **public**. A private URL, `noindex`, or hidden UI does not provide access control. Cloudflare Worker authentication is a separate release/deployment boundary and must be tested independently. Do not publish secrets, tokens, or private raw datasets in PR logs or artifacts.


## P1 per-record provenance badge lost in public export — 2026-11-04 19:58 KST

**Verified source-to-view contract gap (not a measured count of affected records):** On `main`, `scripts/build_public_trades.py` constructs each published trade using `KEEP = ("id", "who", "c", "tk", "asset", "ty", "d", "fd", "filed", "amt", "doc", "r", "rspy")`. **`verification` is not exported**. In draft [PR #479](https://github.com/91cleaner/money-tracker/pull/479) `world-intelligence/us-signals.html` renders a row-level caution only when `r.verification === 'machine_parsed_requires_review'`. Thus the current builder's output cannot trigger that caution, even if the private ledger contains that flag. The view's general “원문 대조 상태 미확인” status remains visible, but its **conditional per-record badge is unreachable** through this public feed.

**Required UI/data-owner decision before merging #479:** (A) if every public row is unverified, display a **universal row-level** “원문 대조 전” warning without relying on an absent field; or (B) have the data owner explicitly approve a small **enumerated public verification status** in the export schema, validate allowed values, and render `verified`, `requires_review`, and `unknown` distinctly. Never infer `verified` from a missing field or from a successfully fetched PDF URL. Do not publish private notes or full internal ledger just to expose the badge.

**Regression acceptance:** build a public summary fixture from a source row with `verification='machine_parsed_requires_review'`; load the **actual generated summary** into the archive view (not an invented JSON payload containing fields the builder drops). Assert the warning is visible, missing/unknown status is not silently labeled verified, and House-only chamber filtering remains correct. The existing `tests/test_us_signals_inline_js.py` contract exercises a hand-crafted payload and currently cannot catch this builder-to-UI field loss. Data export changes belong to the data owner; UI changes belong to Claude per `docs/AI-ROLES.md`. **This review does not fix production code or establish live deployment success.**

## P1 partial House Clerk index refresh masquerades as complete coverage — 2026-11-04 20:53 KST

**Source-to-view defect, not a claim that a failure occurred today:** On `main`, `scripts/collect_house_filings.py` requests the previous and current calendar-year House Clerk indexes separately. If **either** succeeds, it writes a new `collected_at=NOW`, retains older cached rows, and records failures for the other year in `errors:[{year,error}]`. Only **both** failed causes a nonzero exit. On draft [PR #479](https://github.com/91cleaner/money-tracker/pull/479), `world-intelligence/us-signals.html` loads `data/us-house-filings.json` but ignores `errors` and `collected_at`, then always renders “검증된 공시 N건 보관 · ... 공식 하원 사무처 목록”. Therefore a **partial refresh** can look like complete, freshly verified coverage; cached records can mask a missing year. The archive is filing **metadata**, not independently verified underlying securities trades.

**Ownership-safe remediation:** The data owner should preserve an explicit per-year success/failure and last-successful-source timestamp in the public schema, without exposing internal error details. The UI owner should label a partial refresh **PARTIAL / 일부 연도 갱신 실패** with affected year(s), show the last successful source update where available, and avoid “검증된” for a mere count of fetched metadata. A successful HTTP 200 and a fresh top-level `collected_at` must not override `errors`. Unknown/malformed `errors` or records should fail closed with a data-status warning, not a confident count. Do not misrepresent this as live executed-trade data.

**Regression acceptance:** Mock 2025 success / 2026 failure and the reverse, with preexisting cached rows. Assert the public JSON retains an affected-year failure indicator and the browser visibly marks **partial coverage**, while valid records remain browseable with provenance. Verify both years succeed → no partial warning; both fail → collector exits nonzero and the prior file is not re-stamped; malformed response → explicit error. Exercise the **actual generated JSON** rather than a hand-written `records`-only fixture. Do not merge UI changes without the Claude owner and repository owner approval per `docs/AI-ROLES.md`.

**Scope of this change:** Review/release documentation only; neither the collector nor the UI nor production has been modified or verified by this section.


## P1 public PTR metadata escape hatch — 2026-11-05 02:54 KST

**New review of [PR #504](https://github.com/91cleaner/money-tracker/pull/504), HEAD `332c45f`:** `scripts/build_public_trades.py` copies `src.get("updated")` and `src.get("source")` verbatim into the public top-level JSON. The tightened `scripts/check-pages-artifact.py` validates scalar values **only inside `trades[]`**, and checks top-level **field names**, not their value types or public provenance. Therefore a malformed source metadata object can pass the current public-artifact gate, even though nested private fields inside trade rows are now rejected.

**Minimal synthetic reproduction for the data/security owner (not a claim that current production data contains secrets):**

```json
{"updated":"2026-11-05","source":{"private_notes":"DO_NOT_PUBLISH"},"trades":[]}
```

With this input, the branch builder serializes `source` as an object. The artifact checker sees an allowed top-level key and an empty valid `trades` list; none of its new scalar/verification checks rejects the nested `source.private_notes`. An ordinary `source` string is not itself evidence of a leak; this is a **fail-open schema boundary** that can expose future unexpected metadata in a public Pages artifact.

**Required fix before merging #504 (data/security owner, not GPT's documentation branch):**
1. Emit a fixed, reviewed public source label or strict enumerated source identifier; never copy arbitrary private source metadata. Validate `updated` as a bounded ISO date/time string (or publish an explicit unavailable state) rather than copying arbitrary JSON.
2. At the Pages artifact gate, require `updated`, `source`, and `note` to have explicitly approved scalar types/values; reject nested top-level objects and arrays. Validate both producer **and** consumer so a manually modified artifact cannot bypass the builder.
3. Add an end-to-end regression: source metadata object/array and an unexpectedly long/private source string must not be published; valid metadata and a legitimate empty `trades: []` remain accepted. Check the **generated artifact**, not a hand-crafted sanitized output.

**Updated decision (2026-11-05 04:53 KST):** The top-level metadata defect described above is **addressed on draft PR #504 at `bae0990`**, not on `main` or deployed Pages. The builder now emits fixed public `source`/`note` labels and validates `updated`; the artifact checker independently enforces these values, and producer/checker regression tests were added. **Do not keep reporting this specific defect as unfixed on #504**, but retain the overall release block until owner review, latest-head CI, and deployment checks pass. The [security run on `332c45f`](https://github.com/91cleaner/money-tracker/actions/runs/41873674584) passed 152 Python tests but failed a separate legacy country-entry assertion; those tests do not cover this metadata case. [Command room](https://github.com/91cleaner/money-tracker/actions/runs/41873674419) passed, [map smoke](https://github.com/91cleaner/money-tracker/actions/runs/41873674359) failed. No live Pages artifact, iPhone landscape behavior, live executions, or generative AI connectivity was verified by this review. Keep #403's CI repair separate and do not merge any PR without owner approval.


## P1 post-enrichment public-field validation gap — 2026-11-05 04:53 KST

**Code review of draft [#504](https://github.com/91cleaner/money-tracker/pull/504), HEAD `bae09900721e92aa5ca510234154db22794f7b3c` (not deployed):** `scripts/build_public_trades.py` checks each trade-row field against its scalar/finite-value contract **before** enriching the row from `data/us/members.json`. It then copies `info["party"]` and `info["state"]` when truthy, without validating their type, length, or approved values. A future malformed member entry could therefore inject an object/array into the generated public JSON or arbitrary private-looking text into a public string field. The Pages checker would reject nested values, but it accepts arbitrary strings under the allowed `party` and `state` keys; relying on a later checker alone does not establish a safe producer contract. This is a **synthetic risk**, not a claim of an observed data leak.

**Reproducible fixture for the data/security owner:** private `trades.json` contains `{"trades":[{"id":"M1","d":"2026-11-01"}]}`; `members.json` contains `{"members":[{"id":"M1","party":{"private_notes":"DO_NOT_PUBLISH"},"state":"analyst@example.com"}]}`. The current enrichment executes after row validation and copies these values. The artifact checker should reject the object, but a plain string with private text currently satisfies its scalar allowlist.

**Required remediation and regression before release:** validate/sanitize **after all enrichment**, or restrict `party` and `state` to documented enumerations (for example, party `D/R/I` and valid U.S. jurisdiction codes, including an explicit unknown state); reject invalid inputs before replacing the last-good public file. Test the actual builder with malformed `members.json`, assert no private marker appears in the output and no prior snapshot is overwritten, then separately test the artifact checker against tampered public `party`/`state`. Coordinate with the data owner; **GPT did not edit collector, builder, UI, or data files**.

**Latest #504 HEAD CI evidence:** [command room #41892768515](https://github.com/91cleaner/money-tracker/actions/runs/41892768515) **PASS**; [map #41892768698](https://github.com/91cleaner/money-tracker/actions/runs/41892768698) **FAIL**; [security/research #41892768627](https://github.com/91cleaner/money-tracker/actions/runs/41892768627) **FAIL**. The known country-entry CI drift is separately addressed in unmerged [#403](https://github.com/91cleaner/money-tracker/pull/403), whose own last-head checks passed but whose PR remains unmergeable. **Do not infer #504 release readiness from #403 checks**; verify the final combined SHA and published Pages. iPhone landscape and real AI/live trade execution feed remain **NOT VERIFIED / DISCONNECTED**.


## P1 impossible transaction dates and incomplete public trade rows — 2026-11-05 05:54 KST

**New, independent source-to-artifact contract review** of draft [#504](https://github.com/91cleaner/money-tracker/pull/504), HEAD `bae09900721e92aa5ca510234154db22794f7b3c` (not merged/deployed). In `scripts/build_public_trades.py`, public trade rows are checked for scalar/finite **types**, but there is no validation that `d` is a real calendar date or that a published trade row has the required identity/date/provenance fields. `scripts/check-pages-artifact.py` likewise checks allowed keys and scalar types, not transaction-date semantics. Draft [#479](https://github.com/91cleaner/money-tracker/pull/479) checks `d` using only `/^\\d{4}-\\d{2}-\\d{2}$/` before display, which accepts nonexistent dates such as February 30. This is a **code-path finding from static review**, not evidence of an invalid current disclosure.

**Minimal synthetic fixtures (do not add these to real `data/`):**

```json
{"updated":"2026-11-05","trades":[{"id":"M1","who":"Example","c":"h","d":"2026-02-30","doc":"https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/123.pdf"}]}
```

`d` is a string, so it satisfies #504's producer and artifact scalar checks; it also matches #479's date regex and is earlier than the current date, so the proposed UI can display an impossible transaction date. Independently, `{"trades":[{}]}` passes #504's array/object validation and can publish one unusable row; #479 then rejects the whole loaded archive because the row lacks a string `d`. A successful HTTP 200 is therefore not sufficient proof of valid records.

**Release-blocking fix for data/security owner (no GPT changes to data/collector/UI):**
1. At the producer boundary, require each exported row's essential transaction-date and original-source fields, validate `d` as a **real ISO calendar day** (not regex alone), and quarantine/reject malformed rows without overwriting the last-good public snapshot. Distinguish invalid rows from a legitimately empty source.
2. Revalidate the same minimum schema in the independent Pages artifact checker so a hand-edited artifact cannot bypass the producer; define chamber `c` and official `doc` provenance policy explicitly, coordinated with #479's House-only view.
3. Add a producer-to-artifact-to-view regression using a real generated fixture: invalid `2026-02-30`, missing `d`, missing `doc`, and a valid empty array. Require an **ERROR / UNVERIFIED** state for bad data, never "verified zero"; confirm the prior public file survives failed builds.
4. UI owner should replace the date regex with a calendar-validity check and keep unknown/missing chamber records out of a House-only archive.

**Status:** Review gate only, no production fix or executable regression added. #504 and #479 remain draft; #403's separate stale-entry CI failures still block release. Latest checked #504 workflows: [command room PASS](https://github.com/91cleaner/money-tracker/actions/runs/41892768515), [map FAIL](https://github.com/91cleaner/money-tracker/actions/runs/41892768698), [security FAIL](https://github.com/91cleaner/money-tracker/actions/runs/41892768627). No same-SHA Pages deployment, real iPhone verification, live execution feed, or generative AI connection verified.
