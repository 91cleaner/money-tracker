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
