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
