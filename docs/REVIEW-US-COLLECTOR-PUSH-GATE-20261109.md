# P1 review: four US collector workflows can report success after all push retries fail

Reviewed: 2026-11-09 KST. Base: `main` at `28a2586ecd0d662486d1cd2e2c1d19858f414eb6`.
Scope: **review and acceptance criteria only**, per [AI-ROLES.md](AI-ROLES.md). Data/workflow owner implements the correction. No live collection failure or data loss is asserted here.

## Source-level finding

Four scheduled US data workflows share the following `Commit` tail after `git commit`:

```bash
for i in 1 2 3; do git pull --rebase -q origin main && git push && break; sleep 10; done
```

Affected files, confirmed on `main`:

| Workflow | Source / schedule | File |
| --- | --- | --- |
| Federal awards | USAspending, weekly Monday 18:40 UTC | `.github/workflows/collect-federal-awards.yml` |
| LDA lobbying | Lobbying disclosures, weekly Monday 19:10 UTC | `.github/workflows/collect-lobbying.yml` |
| FEC PAC contributions | PAC totals, weekly Tuesday 20:25 UTC | `.github/workflows/collect-pac-contributions.yml` |
| SEC Form 4 | Insider disclosure, weekdays 21:40 UTC | `.github/workflows/collect-form4.yml` |

**Failure mode:** if `git pull` or `git push` fails on all three iterations, the final executed command is `sleep 10`, which exits **0**. Even with Bash `set -e`, the step can be green although its new data commit was never pushed. This is a release/freshness *false-success risk*, not evidence of a failed actual push. These datasets must not be advertised as freshly updated merely because their workflow is green.

## Isolated Bash reproduction (no network, no repository writes)

```bash
bash -c 'set -e; for i in 1 2 3; do false && break; sleep 0; done; echo ACTION_STEP_STILL_GREEN'
# ACTION_STEP_STILL_GREEN; process exit status 0

bash -c 'set -e; for i in 1 2 3; do false && break; sleep 0; done; exit 1'
# process exit status 1
```

Both commands were executed locally and returned the statuses shown. No provider call, GitHub push, or production deployment was attempted.

## Minimal owner-side correction (illustrative, not applied)

After `git commit`, replace the loop with a fail-closed retry result; do not force-push:

```bash
pushed=0
for i in 1 2 3; do
  if git pull --rebase -q origin main && git push origin HEAD:main; then
    pushed=1
    break
  fi
  git rebase --abort 2>/dev/null || true
  sleep 10
done
if [ "$pushed" -ne 1 ]; then
  echo "::error::Data commit not published after three attempts"
  exit 1
fi
```

The owner should consider whether a failed rebase must be recovered with a clean checkout and how concurrent scheduled writers are serialized. The current `collect.yml` already uses an explicit nonzero exit after exhausted retries, while the separate weekly PTR card [PR #327](https://github.com/91cleaner/money-tracker/pull/327) addresses **that other workflow**. Do not duplicate #327 or assume it protects these four files.

## Required regression and release evidence

1. In each affected workflow, simulate `git pull` failing on all attempts and `git push` failing on all attempts. The **Commit** step and overall workflow must fail; no green "fresh" status.
2. Simulate a first-attempt failure then successful retry. The workflow succeeds only when the commit is reachable on `origin/main`. Test the no-change path separately (legitimate successful no-op, not a false refresh).
3. Verify a real workflow run's committed SHA exists on remote main and the generated source snapshot has a trustworthy `updated` / collection-success timestamp. A green workflow alone is insufficient.
4. Keep delayed public disclosures distinct from verified executed stock trades. When collection or publication fails, show **stale / unavailable**, not zero records or newly updated data. Live executed-trade feed: **NOT CONNECTED**. Generative AI: **NOT CONNECTED**.
5. Workflow/data owner should implement and test in a separate branch/PR. Do not merge or deploy without owner approval.

**Coordination:** GPT did not edit `data/`, collectors, UI, workflow YAML, tests, or production. The repository is currently **public**, despite references to a private repository in task wording.


## 2026-11-10 04:54 KST — P1 daily-card source freshness and partial-data delta risk

**New source-level finding, not a claim of an already published bad card.** This is separate from the push-retry defect above and from [#506](https://github.com/91cleaner/money-tracker/pull/506), which corrects Form 4/White House wording but does not change contracts/lobbying/PAC delta calculation.

- On current main, scripts/build_us_daily.py builds snapshots from each source's company totals, but drops updated, period, errors, and source completeness metadata. It compares with the most recent saved daily JSON and labels any difference "어제보다 금액이 바뀐 회사 N곳" even when collection periods differ or a source is partial. It does not establish an actual previous-day financial change.
- The current data/us/federal-awards.json snapshot is updated 2026-11-09, period 2024-10-01..2026-11-09, with errors ["FDX:partial", "GD:partial"]. Its total for GD is **$25,233,816,611.18**; the saved data/us/daily/2026-11-09.json snapshot for GD is **$20,144,072,571.92**. A subsequent build comparing those snapshots would calculate **+$5,089,744,039.26** for an explicitly partial source. This is **not evidence of $5.09B newly awarded on one day**.
- The same snapshot comparison has **23 changed companies**. LMT changes from **$120,773,983,798.97** in the saved daily snapshot to **$140,501,053,087.43** in the current source (+$19,727,069,288.46). These are cumulative/period-dependent totals, not verified day-over-day new obligations.
- data/us/lobbying.json is marked updated 2026-11-02 and data/us/pac-contributions.json updated 2026-11-03; the 2026-11-09 daily card presents their highest-company values without source-as-of dates. A fresh card date does not imply fresh source data.
- The existing 2026-11-09 daily JSON still contains the older contract snapshot, so **do not assert** the hypothetical next-build delta has already been published. This review compared repository source JSON and generator logic only.

**Owner acceptance / negative tests (not implemented here):**

1. Preserve source_updated, exact period, partial/error flags, previous snapshot date, and provenance per daily card. Show **stale / partial / unavailable** explicitly. Do not display an unqualified "어제보다" or imply new awards from cumulative snapshot revisions.
2. Fixture: previous GD=20,144,072,571.92, current GD=25,233,816,611.18, errors=["GD:partial"]. Assert the result is **not** an ordinary day-over-day change or new-award signal; suppress the comparison or label it a non-comparable source refresh with the partial flag.
3. Fixture: previous daily snapshot older than one calendar day. The output must not say "어제보다". Fixture: source updated unchanged over several daily builds. The card must not imply the source refreshed.
4. Compare only like-for-like period, filter, and source completeness. For non-comparable snapshots, show "비교 불가" and link to the official USAspending/LDA/FEC source instead of manufacturing a daily movement.
5. Data owner implements in scripts/build_us_daily.py and adds offline regression tests; release owner ensures corrected generator and source-status checks are in the same-SHA Pages gate. Per docs/AI-ROLES.md, this GPT review does **not** modify generator, data/, UI, CI, or deployment.

**Status:** confirmed current source/schema and arithmetic; downstream 2026-11-10 output, CI, browser, and production **not verified**. Repo public; live executed-trade feed **NOT CONNECTED**; generative AI **NOT CONNECTED**.
