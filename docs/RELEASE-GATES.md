# Release decision gates — MONEY TRACKER

> Operational acceptance checklist, not a claim that these gates are implemented in CI. Last reviewed: 2026-11-04 (KST). Applies to the public GitHub Pages build and the separately deployed authenticated Cloudflare Worker.

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
