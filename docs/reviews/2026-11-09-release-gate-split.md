# P1 release-gate review — Pages can publish while the security suite is red

Reviewed: 2026-11-09 03:56 KST. Scope: current `main` source and GitHub Actions evidence. This is a **source/workflow review**, not a claim of a browser exploit or a completed fix.

## Reproduced failing assertion (not an opinions-import failure)

- [Security/research run 42507456942](https://github.com/91cleaner/money-tracker/actions/runs/42507456942) on `81c0726570136c20a91ae3487d075cca390f1d9a` failed in **Build and validate public artifact**. Earlier steps — JS syntax, private API rejection and `python3 -m unittest discover -s tests` — passed; the log reports **144 tests OK**.
- The log shows `Prepared 106211 public files`, immediately followed by exit code 1. The final command in that step is `grep -q 'href="intel-lab.html"' .public-pages/index.html`.
- Current `main` `index.html` contains country links to `korea.html`, `world-intelligence/`, and `skysea.html`, **not** `href="intel-lab.html"`. The static assertion is obsolete after the country-selection redesign. The failure is **not evidence that the privacy unit tests failed**. Do not disable the whole security workflow to hide this red status.
- [PR #403](https://github.com/91cleaner/money-tracker/pull/403) already proposes replacing stale markers with shared entry-point checks; **do not duplicate that implementation**. It is not merged into current `main` at review time.

## Separate P1: a green Pages deploy does not require a green security/research workflow

- Current `.github/workflows/security-and-intel-lab.yml` and `.github/workflows/deploy-pages.yml` are **independent workflows**. Pages runs on `main` push or manual dispatch, and has no `needs` dependency on the security/research job or an equivalent full-suite check.
- The Pages workflow does run its own syntax, private-API, artifact and deployment smoke steps. However, it **does not run** the full `python3 -m unittest discover -s tests` security/research suite before publishing. A successful Pages run therefore does not certify that suite.
- Example evidence: [Pages run 42510786193](https://github.com/91cleaner/money-tracker/actions/runs/42510786193) succeeded on `cfbce6540d9efef675243f1f9a973edc2b48e76b`, while the cited security run failed on an **earlier, different SHA**. This demonstrates independent workflow status, **not** a same-SHA failed-security/green-deploy reproduction. Never compare these as though they tested identical code.
- The latest [Pages run 42512463710](https://github.com/91cleaner/money-tracker/actions/runs/42512463710) was still in progress at review time. Its eventual result must be checked separately.

## Proposed owner changes (not implemented here)

1. **CI owner / PR #403:** remove the obsolete `intel-lab.html` root-link grep. Preserve artifact existence, forbidden-file exclusion, country-selection links, the actual research-page path, and a negative fixture test proving missing entry links fail.
2. **Release owner:** gate Pages publication on passing security/research, map smoke and command-room checks for the **same immutable candidate SHA**. Prefer a single workflow with `needs` and a deploy job using the checked artifact; if using `workflow_run`, verify exact SHA and artifact identity, and prevent stale successful runs from authorizing a later commit. Do not silently skip tests on `workflow_dispatch`.
3. **Data owner / #527:** keep unresolved House PTR chronology anomalies out of verified public transaction summaries until source-level triage. A passing deploy alone does not certify data accuracy.
4. **UI owner:** add a real browser smoke for the primary `world-intelligence/` free-form question → candidate → map route in KO/EN desktop and iPhone landscape, including focus zoom and reset. Existing [PR #477](https://github.com/91cleaner/money-tracker/pull/477) documents the hidden question field; a string-marker test cannot prove it is usable.

## Acceptance / negative tests

- Deliberately break a required public entry link: preflight fails before upload.
- Deliberately fail one security/research test: Pages **must not deploy** that candidate SHA, even when the Pages-only syntax checks pass.
- Start a newer main commit while an older candidate is checking: only the newer fully verified SHA may publish; report the deployed SHA and artifact digest.
- Verify the published site and exact artifact/commit parity after deployment, with visible logs; report Pages green, security green and mobile browser pass **separately**.
- Disconnected states remain explicit: House PTR is delayed disclosure, **real-time executed-stock feed NOT CONNECTED**; **generative AI NOT CONNECTED**. The repository and GitHub Pages are **public**, not device-restricted.

## Ownership and verification boundary

Per `docs/AI-ROLES.md`, GPT only changes review/documentation. No UI, `data/`, collectors, workflows, test code or production deployment were changed. The existing #403/#477/#527 owners should implement the fixes, and approval is required before merge.

## 2026-11-09 13:53 KST follow-up — intermittent Pages sync timeout (new evidence)

- [Failed Pages run 42559306048](https://github.com/91cleaner/money-tracker/actions/runs/42559306048), candidate `ea69fac`: `prepare-public-pages.py` generated **106,212 files**; the uploaded `github-pages` artifact was **92,199,572 bytes**. Upload succeeded, but `actions/deploy-pages@v4` remained at `syncing_files` and **timed out after 600 seconds** (04:10:53 UTC). The deployment was canceled. This was **not** a preflight, private-API, or Python unit-test failure.
- [Successful Pages run 42563134377](https://github.com/91cleaner/money-tracker/actions/runs/42563134377), **different candidate** `259514d`: also generated **106,212 files**, with a similarly sized **92,221,024-byte** artifact, but completed deployment and four HTTP entry checks at 04:42 UTC. Therefore **file count or artifact size alone is not a demonstrated root cause**. Do not describe the earlier timeout as a permanent outage or as a fixed code bug.
- [Security run 42559601123](https://github.com/91cleaner/money-tracker/actions/runs/42559601123) on PR SHA `3414a78`: **144 Python tests OK**, then public-artifact validation failed on the known obsolete `href="intel-lab.html"` grep. This is the existing #403 defect, **not** a new regression. The green Pages run on `259514d` does not certify that red PR SHA.

**Action for release owner / existing [#116](https://github.com/91cleaner/money-tracker/issues/116):** record candidate SHA, artifact ID, file count/bytes, deploy duration and final Pages deployment ID for every run; distinguish `syncing_files` timeout from validation failures; inspect competing deployments and Pages status before retrying. If retrying, preserve the same candidate SHA and verify the resulting published artifact/entry URLs rather than assuming a later green run fixed the earlier commit. Maintain the same-SHA security and PTR gates above; do not bypass them to work around transient Pages syncing. This is a review/documentation change only, not a deployed fix.

## 2026-11-09 19:56 KST — independently verified CI status and safe merge order

The prior "CI pending" wording applies to the earlier observation, **not** to the current checked PR heads. The GitHub Actions runs attached to the exact PR head SHAs now show:

| Candidate | Head SHA | Command smoke | Map smoke | Security/research | Meaning |
| --- | --- | --- | --- | --- | --- |
| [#403](https://github.com/91cleaner/money-tracker/pull/403) (base `main`) | `bcb46ed0b779d19490960b38a805634d92fb1d32` | [pass](https://github.com/91cleaner/money-tracker/actions/runs/42248421361) | [pass](https://github.com/91cleaner/money-tracker/actions/runs/42248421435) | [pass](https://github.com/91cleaner/money-tracker/actions/runs/42248421316) | Entry-contract fix has green branch CI; **not merged** |
| [#522](https://github.com/91cleaner/money-tracker/pull/522) (base #403 branch) | `cd4aa1ef02807fdd8da7ac7945537f35b7e79146` | [pass](https://github.com/91cleaner/money-tracker/actions/runs/42248519445) | [pass](https://github.com/91cleaner/money-tracker/actions/runs/42248519412) | [pass](https://github.com/91cleaner/money-tracker/actions/runs/42248518910) | SkySea check is **stacked** on #403; not independently ready for `main` |
| [#536](https://github.com/91cleaner/money-tracker/pull/536) (this documentation PR) | `230bca239bccdf0ce32f31e226e207b8542de29b` | [pass](https://github.com/91cleaner/money-tracker/actions/runs/42564335433) | not returned for this head | [fail](https://github.com/91cleaner/money-tracker/actions/runs/42564335439) | Review documentation does **not** fix the stale `main` assertion |
| [#539](https://github.com/91cleaner/money-tracker/pull/539) (contract-data review) | `d9b69bfb42cf531c27dee87d1812ca58b51c75c8` | [pass](https://github.com/91cleaner/money-tracker/actions/runs/42597801714) | not returned for this head | [fail](https://github.com/91cleaner/money-tracker/actions/runs/42597801608) | Independent docs PR also remains red; do not interpret this as a data fix |

**Integration action:** CI owner should review and land **#403 first**, then rebase/retarget and verify **#522** against the updated `main`, rather than reimplementing their checks in another PR. After each merge, require the new `main` SHA's own green security/map/command checks and Pages deployment verification. The green branch runs above cannot certify a future merged SHA or deployed site.

**Coverage precision:** `scripts/check-pages-entry.py` in #403 verifies only its declared `CHECKS` paths and, when `--expected-dir` is supplied, byte parity **for those paths**. #522 adds SkySea to that list. Neither constitutes a whole-site artifact digest or a browser interaction test. A hidden `#ask` form can satisfy the `id="ask"` marker while remaining unusable; the UI owner must still close [#477](https://github.com/91cleaner/money-tracker/pull/477) with real KO/EN mobile and desktop interaction evidence. A future release gate must distinguish tested entry files, checked public JSON, complete artifact identity, and interactive functionality rather than reporting a single undifferentiated "all verified" status.

No workflow, tests, UI, data or deployment was changed by this review update. Public repository; real-time executed-stock feed **NOT CONNECTED**; generative AI **NOT CONNECTED**.

## 2026-11-10 00:02 KST — P1 data-integrity release gap despite green #545 CI

This is a **new cross-PR source audit**, not a fix to a collector, public data, or deployed site.

- [#545](https://github.com/91cleaner/money-tracker/pull/545) HEAD `92a0d1f1d9516f3cfbe133f99e25a8bb87ffbbd0` has three successful **PR-triggered** runs: [Command #42631971656](https://github.com/91cleaner/money-tracker/actions/runs/42631971656), [map #42631970969](https://github.com/91cleaner/money-tracker/actions/runs/42631970969), [security #42631971185](https://github.com/91cleaner/money-tracker/actions/runs/42631971185). These verify the stacked branch's checks; they do **not** verify a main Pages deployment or an iPhone interaction.
- The Cloudflare bot's [#545 preview status](https://github.com/91cleaner/money-tracker/pull/545) separately reports **Build: Failed** on the same `92a0d1f` commit (2026-11-09 14:12 UTC). The preview log is not in the GitHub Actions results. Do not summarize this candidate as “all deployments green,” or equate the Cloudflare failure with a GitHub Pages failure.
- On current `main`, `scripts/build_public_trades.py` loops over `src.get("trades", [])`; if the ledger omits the key, it silently generates an empty public `trades` array. `scripts/check-pages-artifact.py` checks permitted field **names** but does not require the `trades` key to exist, validate row types, verify official-source URLs, or reject impossible transaction/filing chronology. This is a **reproducible source-code validation gap**, not evidence that the present public dataset is empty or malicious.
- Existing work already covers this gap: [#504](https://github.com/91cleaner/money-tracker/pull/504) validates the public ledger/builder, [#412](https://github.com/91cleaner/money-tracker/pull/412) quarantines impossible House PTR dates, and [#526](https://github.com/91cleaner/money-tracker/pull/526) checks public collector status and adds a chronology audit. **Do not duplicate their code** or treat any unmerged fix as active in production.

**Release-owner acceptance:** (1) integrate and reconcile the overlapping PTR validation changes on a fresh `main` candidate (especially shared `scripts/check-pages-artifact.py`), (2) negative-test missing/non-list `trades`, nested private values, false official-source hosts, future dates and filing-before-trade, (3) confirm the exact same candidate SHA passes Python, Node, browser question→choice→map and Pages artifact/post-deploy checks, (4) separately resolve or explicitly block the failed Cloudflare preview if Cloudflare is the chosen production path. Preserve the original official PTR links and verification labels; delayed disclosures are **not** real-time executed trades. Generative AI and real-time trade feed remain **NOT CONNECTED**.

No UI, tests, collectors, `data/`, deployment workflow, or production files changed by this GPT review.

## 2026-11-10 00:56 KST — integration conflict and stale-candidate release risk

**New verified blocker, separate from the already documented PTR issues:**

- [#403](https://github.com/91cleaner/money-tracker/pull/403), the **first** PR in the #403 → #522 → #545 dependency chain, currently reports `mergeable: false` against `main`. [#522](https://github.com/91cleaner/money-tracker/pull/522) is based on #403, and [#545](https://github.com/91cleaner/money-tracker/pull/545) is based on #522. A successful #545 branch check therefore cannot authorize merging the stack; resolve #403's actual conflicts against current main first, then rebase/retest downstream PRs without force-pushing unrelated owners' branches.
- GitHub compare `main...fix/pages-predeploy-full-regression-20261109` reports **diverged, 20 commits ahead and 449 behind** at inspection time. The count is a moving snapshot, not proof that all 449 commits conflict. In particular, do not copy the old stack's workflows onto current main without checking intervening changes.
- The latest successful [main Pages run #42647552338](https://github.com/91cleaner/money-tracker/actions/runs/42647552338) published candidate `18fc24f545324649f6d363aa2a005693eb605652` (started 2026-11-09 15:43 UTC). Its job passed the existing **partial** syntax, private-API, artifact and HTTP checks; the current main `deploy-pages.yml` still **does not** execute the full Python + four map/command Node suites added only on draft #545. This green deployment is not evidence that the proposed gate is in production.
- On #545 SHA `92a0d1f`, GitHub check-runs show Command, map and security **success**, but **GitHub Pages deployment verification = skipped** and **Cloudflare Workers Builds = failure** ([Cloudflare build detail](https://dash.cloudflare.com/0dcca139f8e17d7885ac0555d89dba70/workers/services/view/red-meadow-fcc6/production/builds/4c31a6a3-6e26-46bb-9128-2fe35aaf09ff)). The Cloudflare failure cause is not verified by a GitHub Actions log and must not be guessed.

**Additional release race:** The current Pages workflow uses `concurrency: { group: pages, cancel-in-progress: false }`; #545 adds `if: github.ref == 'refs/heads/main'`, which blocks non-main manual dispatch, **but does not prove that the queued candidate SHA is still the tip of main** at the time of upload/deploy. A long-running older main candidate can still publish after a newer main commit exists, pending its later deployment. This is a source-level race possibility, **not** a confirmed stale production deployment.

**Owner-ready negative test:** queue candidate A, push candidate B before A reaches upload, and assert A cannot publish after B becomes main's tip; require a last-moment SHA freshness check and report the published SHA/artifact identity, with an explicit retry/serialization policy. Recheck just before `actions/deploy-pages`; a freshness check reduces but cannot mathematically eliminate a push racing during deployment. Preserve all #545 pre-upload data/security/map gates and the #403/#522 entry checks. Only the CI owner should change workflow code, then verify the merged SHA with a real Pages run.

This is a **review-only** improvement under `docs/AI-ROLES.md`. No workflow, screen, collector, data, test, merge or deployment changed. Repository **public**; executed-stock-trade feed **NOT CONNECTED**; generative AI **NOT CONNECTED**.

## 2026-11-10 01:55 KST — exact #403 integration dependency audit (new source evidence)

This follow-up resolves the **specific files and invariants** behind the previously reported non-mergeable #403; it does not claim to have solved its Git conflicts.

- GitHub reports [#403](https://github.com/91cleaner/money-tracker/pull/403) `mergeable: false`. The branch is **10 commits ahead / 454 behind** current `main` (moving snapshot). Its PR changes exactly seven paths: `.github/workflows/command-check.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/security-and-intel-lab.yml`, `scripts/check-pages-entry.py`, `tests/mt-command.test.cjs`, `tests/test_pages_entry_smoke.py`, and `tests/usa-map-smoke.test.cjs`. The downstream #545 stack is **20 ahead / 454 behind** current `main`; do not assume its older workflow files can be copied verbatim.
- **Atomic dependency confirmed:** `scripts/check-pages-entry.py` returns GitHub 404 on current `main` but exists on #403. The #403 security workflow calls `python3 scripts/check-pages-entry.py --local-dir .public-pages`, and its Pages workflow invokes the same script for local and live checks. Cherry-picking the workflows without the script will introduce a guaranteed missing-file failure. Bring the script, its regression tests, and the workflow callers together in one reviewed integration candidate.
- **Two independently confirmed stale main checks:** current `main` security workflow still requires `grep -q 'href="intel-lab.html"' .public-pages/index.html` (obsolete root link). Current `main` `command-check.yml` runs its `deployed` job after browser checks on branch pushes **without** a `github.ref == 'refs/heads/main'` condition; #403 adds that condition. Do not resolve conflicts by silently retaining either stale check.
- **Conflict-resolution plan for CI owner:** (1) create a fresh branch from latest `main`; (2) integrate the seven #403 paths selectively, retaining unrelated main changes; (3) ensure the new checker script and tests are present before changing workflow callers; (4) run the negative entry-link fixture and a branch-only Command run (production Pages poll must be skipped), plus security/map checks; (5) integrate #522's SkySea markers and #545's pre-upload gates **only after** the #403 candidate passes; (6) verify the final merged SHA's Pages publication and exact artifact parity. Keep PRs draft/unmerged until owner review.

**Verification boundary:** GitHub metadata, path listings, source files, and a 404 for the missing main checker were inspected; **no merge conflict was resolved**, no CI rerun, browser, Pages deployment, UI, collector, or `data/` file was changed. The repository remains **public**. Real-time executed-stock feed **NOT CONNECTED**; generative AI **NOT CONNECTED**.


## 2026-11-10 02:56 KST — PTR provenance gate missing from stacked Pages release

**New cross-workflow release review (verified against actual CI logs and source):**

- [PR #536 Command smoke run 42659792142](https://github.com/91cleaner/money-tracker/actions/runs/42659792142) failed specifically at **“Verify House PTR provenance and uncertainty labels”**, with `AssertionError [ERR_ASSERTION]: disclosure row 2: invalid dates` from `node scripts/validate_us_trades.mjs`. Its entry-marker and JS syntax steps passed. This is **not** the separate stale Pages HTML grep error; [security run 42659792411](https://github.com/91cleaner/money-tracker/actions/runs/42659792411) passed 144 Python tests then failed at the old `href="intel-lab.html"` assertion. The invalid-date observation applies to **that PR candidate snapshot**, not automatically to the latest `main` or #545 branch.
- The current `.github/workflows/command-smoke.yml` runs `node scripts/validate_us_trades.mjs`, which requires a parseable transaction and filing date for every House/Senate disclosure row, official source host, chamber and transaction category. However, the [#545 proposed Pages release gate](https://github.com/91cleaner/money-tracker/pull/545) runs Python unittests and four Node test suites **but does not invoke that dedicated validator**. Its green PR checks are not a guarantee that a future Pages candidate passes the House PTR source/date integrity command. The public artifact checker on current main also does not replicate that raw-ledger date validation.
- **CI owner action (no duplicate PR):** extend #545's pre-upload gate with `node scripts/validate_us_trades.mjs` (or a tested equivalent), and add a regression proving a missing/invalid `d` or `filed` on a temporary ledger **blocks artifact upload and deployment**. Do not alter real `data/us/trades.json` as a test fixture; use a temporary isolated copy. Run this gate against the final integrated #403 → #522 → #545 candidate, not the old stacked SHA.
- **Data owner action:** inspect the row-2 date anomaly on the exact #536 candidate against the official PTR PDF before changing data; compare with existing [issue #527](https://github.com/91cleaner/money-tracker/issues/527) and [PR #412](https://github.com/91cleaner/money-tracker/pull/412) to avoid duplicate triage. Invalid date parsing is not proof that the underlying trade occurred or that a present-day row is still invalid.

**Boundary:** This is a review-only documentation correction under `docs/AI-ROLES.md`. No data, collector, workflow, tests, UI, PR merge or production deployment was modified. Repo **public**; independently verified live executions **NOT CONNECTED**; generative AI **NOT CONNECTED**.

## 2026-11-10 03:56 KST — PTR validator false-green on impossible chronology (new reproducible bug)

**Verified in current `main` `scripts/validate_us_trades.mjs`, distinct from the missing Pages invocation above:**

- The validator increments `anomalies.transaction_after_filing` when `Date.parse(row.d) > Date.parse(row.filed)`, but only fails if **the total anomaly count exceeds `Math.max(100, Math.ceil(data.trades.length * 0.05))`**. For a 20-row disclosure ledger, the limit is **100**, so **all 20 rows can have filing dates before transaction dates and still print `Disclosure source integrity PASS`**, provided other required fields are valid. This is not merely a missing gate: the existing validator's own success result is insufficient for chronology integrity.
- `Date.parse` alone is also not a strict calendar-date validator in Node/V8: `Date.parse('2026-02-30')` returns a finite timestamp normalized to **2026-03-02**, and `Date.parse('2026-11-31')` normalizes to **2026-12-01**. These impossible date strings can therefore pass the current `Number.isFinite` date assertion. A separately observed row-2 invalid-date CI error does not prove all malformed dates are rejected.
- Reproduction was run with JavaScript Date parsing and the validator's exact threshold expression (20 anomalies / 20 rows, threshold 100, predicate evaluates true). This is a **logic-level reproduction**; the repository's real ledger was **not modified**, and no end-to-end GitHub Actions or deployed-site test was run for this finding.

**Owner action / regression contract:** In the existing PTR validation work (#412/#504), require exact `YYYY-MM-DD` round-trip validation with real calendar bounds; reject or explicitly quarantine **any** `transaction > filed` row before it is represented as verified. Do not let the generic parsing-anomaly tolerance mask impossible chronology. Add isolated negative fixtures for 20/20 reversed dates, 1/20 reversed dates, Feb 30 and Nov 31; assert failure or quarantine plus a visible unverified status. Then add `node scripts/validate_us_trades.mjs` (or equivalent strict guard) to #545's pre-upload Pages gate **after** its validator semantics are fixed. Keep the original official PDF evidence for reconciliation rather than silently rewriting source dates.

This is a review-only documentation commit per `docs/AI-ROLES.md`; no data, collector, UI, validator, workflow, test code, merge or deployment changed. GitHub repo is **public**. Independently confirmed real-time executions **NOT CONNECTED**; generative AI **NOT CONNECTED**.


## 2026-11-10 06:54 KST — two more Pages timeouts after a same-footprint success

**Fresh production evidence (GitHub Actions job logs, not inferred from workflow status):**

| Run (main candidate) | Public files | Uploaded artifact | Deploy outcome |
| --- | ---: | ---: | --- |
| [#42699618665](https://github.com/91cleaner/money-tracker/actions/runs/42699618665) (`6c600fd3`) | 106,213 | 92,406,265 B | **Success**, post-deploy entry smoke passed |
| [#42700289083](https://github.com/91cleaner/money-tracker/actions/runs/42700289083) (`f85ac073`) | 106,213 | 92,416,561 B | **Failure**, `syncing_files` until default 600 s timeout |
| [#42701176029](https://github.com/91cleaner/money-tracker/actions/runs/42701176029) (`adfc482d`) | 106,213 | 92,406,375 B | **Failure**, `syncing_files` until default 600 s timeout |

- All three passed public artifact build, privacy check and upload. The two failures occurred in `actions/deploy-pages@v4`, **before** post-deploy HTTP smoke, so a successful artifact upload must not be reported as a successful deployment.
- The successful run used **a different SHA** with the **same file count** and a comparably sized artifact. Neither the ~106k-file count nor the ~92 MB archive is established as the sole root cause. GitHub Pages backend sync, overlapping deployments, and deployment-source competition remain hypotheses requiring provider-side evidence.
- Current main tip at review was `c9487053` (2026-11-10 06:48 KST), **newer than all three candidates**. No same-SHA production success for this tip was established.
- The stacked [#545](https://github.com/91cleaner/money-tracker/pull/545) already proposes 1,200,000 ms deployment timeout and two pre-deploy remote-main SHA checks, with green map/Command/security CI on head `a289b3a`. **It is draft and unmerged**. The main workflow still has the default 600 s timeout and no full prepublish release gate. Do not claim #545 has resolved the live incident.

**CI/release owner action (no duplicate workflow implementation in this review PR):** after owner-approved #403 → #522 → #545 integration, record the candidate SHA, artifact ID, file count, archive bytes, deployment ID and elapsed `syncing_files` time for each attempt. Test the **same immutable SHA** with a bounded retry only if the first deployment times out; verify the published asset hashes and all entry routes before marking success. Avoid a blind retry of a stale SHA. Investigate which public directories contribute the file count before proposing safe, usage-tested pruning; do not delete source datasets or weaken privacy checks to speed deployment. If the 20-minute timeout also expires, escalate with those IDs rather than increasing it indefinitely.

**Review boundary:** No deployment workflow, UI, collector, `data/`, test code or live Pages deployment changed in this review. The repository is **public**. Independently verified real-time executed trades **NOT CONNECTED**; generative AI **NOT CONNECTED**.
