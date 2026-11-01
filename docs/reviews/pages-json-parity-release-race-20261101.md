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
