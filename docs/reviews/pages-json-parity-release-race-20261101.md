# Pages public JSON parity: overlapping deployments (review, 2026-11-01 KST)

**Scope:** Review only. No deployment, collector, UI or test code changed here. Implementation owner: Pages/CI owner; GPT is assigned documentation/code review by `docs/AI-ROLES.md`.

## P1 release-integrity gap: audit can compare an older deployment against a newer live site

[PR #458](https://github.com/91cleaner/money-tracker/pull/458) introduces `.github/workflows/pages-json-parity.yml`. Its `workflow_run` handler checks out `github.event.workflow_run.head_sha`, rebuilds `.public-pages`, then compares three JSON URLs against the **current** `https://91cleaner.github.io/money-tracker/` content.

The deploy workflow `.github/workflows/deploy-pages.yml` serializes *deploy runs* with `concurrency: group: pages; cancel-in-progress: false`, but the separate JSON-audit workflow has **no shared sequencing** and no check that the SHA under audit is still the deployed SHA. An older successful deploy may trigger audit A; deploy B can publish before audit A fetches the live URLs. Audit A will then report a SHA mismatch even when both deployments published their own correct artifacts. Conversely, a successful audit for A does not certify that B, now live, has passed the same check.

This is a **code-path risk, not a confirmed production incident**. High deployment cadence makes it material: on 2026-11-01 UTC, successful Pages runs [41310867156](https://github.com/91cleaner/money-tracker/actions/runs/41310867156) (13:21) and [41313246408](https://github.com/91cleaner/money-tracker/actions/runs/41313246408) (13:51) were followed by another [41313619264](https://github.com/91cleaner/money-tracker/actions/runs/41313619264) starting at 13:55. Main also received repeated collector commits. These timestamps establish frequent releases, **not** that an overlap already caused a false failure.

## Recommended minimal integration (coordinate PR #403 and #458)

1. Prefer running the JSON parity script as a **post-deployment step in the existing `Deploy MONEY TRACKER Pages` job**, using the same `.public-pages` directory uploaded earlier in that job. This keeps the upload, publication and comparison inside the existing `pages` concurrency group. Place the step after the live entry smoke check; if the smoke check fails, do not certify the release.
2. Reuse `scripts/check-pages-public-json.py --site-url "$SITE_URL" --expected-dir .public-pages` from PR #458; do **not** rebuild a different SHA or publish collector-owned raw data. Coordinate edits to `.github/workflows/deploy-pages.yml` with PR #403, which already modifies this file.
3. Remove or narrowly scope the standalone `workflow_run` production audit to prevent duplicate/conflicting release verdicts. If retained, explicitly detect a superseded SHA using trusted deployment metadata and report **SUPERSEDED / not evaluated**, never **PASS** or **data corruption** for an older SHA.
4. Preserve strict JSON parsing, three-file coverage, no-redirect checks and byte-level SHA-256 comparisons from PR #458. Passing parity means **published bytes match the expected artifact**, not that filing dates, source PDFs, live trades or AI connections are verified.

## Acceptance tests before merge

- **A then B:** Queue two different main SHAs with different valid public JSON. Both deploys complete sequentially. Each post-deploy audit checks only its own uploaded artifact, and the final published bytes match B. No stale A-vs-B false failure.
- **Bad B:** B publishes a mismatched/404/HTML/non-finite JSON response. B's deployment workflow fails closed; A's earlier success cannot mark B verified.
- **No deploy:** PR branch CI may run unit tests, but must not claim live Pages parity.
- **Data boundary:** The public copy must not include `data/us/trades.json` or other private collector files; official delayed disclosures must not be labeled live executions.
- **Evidence:** Record deployed SHA, workflow run, public URL, JSON digests, and whether the release was superseded. Check the Pages source configuration separately; workflow success alone does not prove that no alternate publisher overwrote the site.

**Current status:** PR #458's 12 JSON regression tests and command-room CI succeeded on commit `e96711857dbc35bfb303bf099a35bec0af7bf142`; the security/research workflow failed. PR #403, #412 and #458 are open. This memo does not claim combined CI or live parity has passed.

**Connections:** Generative AI analysis **NOT CONNECTED**. Real-time executed-trade feed **NOT CONNECTED**. Repository visibility **public**.


## P1 follow-up (2026-11-01 23:55 KST): successful Pages publication can be invisible to a success-only workflow_run audit

**Observed GitHub job evidence:** [Deploy run #41285843473](https://github.com/91cleaner/money-tracker/actions/runs/41285843473) reports `Build public-only artifact`, `Verify public artifact privacy and required assets`, `upload-pages-artifact@v3`, and `deploy-pages@v4` all **success**, but `Verify published entry and US command` **failure**, yielding an overall **failure** workflow. In contrast, [run #41313619264](https://github.com/91cleaner/money-tracker/actions/runs/41313619264) reports both deployment and final smoke **success**. These are observed step statuses; neither alone proves byte parity of all public JSON.

**Cross-PR gap (hypothetical if #458 were merged unchanged):** PR #458's `pages-json-parity.yml` runs its production job only for `workflow_run.conclusion == 'success'`. Therefore, when the Pages publish step succeeds but the later entry smoke fails (as in run #41285843473), the standalone JSON parity job **will not run at all**, even though the deployment action has already published. A failed entry smoke is a release failure, but it should not silently suppress separate JSON-integrity evidence. PR #458 remains **unmerged**, so do not claim that this audit was actually skipped in the historical run.

**Minimal owner fix (coordinate with #403, do not modify UI/data):**
1. Put the JSON parity check **immediately after** `actions/deploy-pages@v4` in the *same* deploy job, before the entry smoke step, using the already uploaded `.public-pages` and `steps.deployment.outputs.page_url`. A successful publication will then receive a parity attempt regardless of the outcome of a later entry smoke. Keep both checks mandatory; either failure means **release unverified/failed**.
2. Retire or de-duplicate the separate success-only `workflow_run` production audit to avoid stale-SHA and duplicate verdicts. If kept for diagnostics, report its coverage limits explicitly.
3. Add a workflow integration regression with deploy-step success + entry-smoke failure and require a recorded parity attempt; also test deploy-step failure (no live parity), mismatched JSON (nonzero), and back-to-back SHAs (no stale false-positive).
4. A post-publish check cannot prevent initial public exposure or roll back already published bytes. Protect publication **before** `deploy-pages` with artifact allowlist/privacy validation; label a post-publish failure as an incident requiring remediation, not as proof no unsafe bytes were served.

**Status:** Static workflow review plus GitHub job-step verification only. No CI, runtime code, Pages configuration, collector, or live site changed by this note. The repo is **public**; generative AI analysis and real-time executed-trade feeds are **NOT CONNECTED**.


## P2 follow-up (2026-11-02 00:53 KST): PR path filter omits public-artifact producers

**Verified workflow contract:** PR #458's `.github/workflows/pages-json-parity.yml` has a `pull_request.paths` filter with only `scripts/check-pages-public-json.py`, `scripts/test_pages_public_json.py`, and the workflow YAML itself. It does **not** match `scripts/prepare-public-pages.py`, `scripts/build_public_trades.py`, `scripts/check-pages-artifact.py`, or `data/us/trades-recent.json` / `data/search/collection-status.json`. A PR changing only one of these producer/input paths will therefore **not schedule the parity regression job**. This is an actual trigger-coverage gap confirmed from the workflow source, not evidence that a bad deployment occurred.

**Owner action and reproducible acceptance:**
1. Expand the PR path filter to include `scripts/prepare-public-pages.py`, `scripts/build_public_trades.py`, `scripts/check-pages-artifact.py`, and the relevant public JSON input paths (or remove the restrictive `paths` filter). Avoid blanket `data/**` triggering if cost is material; at minimum include every input consumed by the three audited outputs and the producer scripts.
2. Add an artifact integration smoke in PR CI: run `python3 scripts/prepare-public-pages.py`, `python3 scripts/check-pages-artifact.py`, then validate the three generated JSON files with the same strict schema rules. The existing 12 unit tests use synthetic temporary fixtures and **do not prove** that a changed real builder still produces the expected files.
3. On a throwaway PR branch, change only `scripts/build_public_trades.py` (or an allowed input JSON) and verify that **Pages public JSON parity audit** is scheduled. Restore the test change before merging. Also inject a malformed generated `trades_public.json` in an isolated fixture and require a nonzero job result.
4. Keep the post-deploy live SHA parity gate separate from this PR build gate: a PR test is **not** production verification. Do not merge until the #403 / #412 integration and release-publisher ownership are agreed.

**Scope/status:** Review finding documented only. No workflow, data, builder, test, Pages deployment or UI code was modified here. Repository **public**; generative AI analysis and real-time executed-trade feed **NOT CONNECTED**.
