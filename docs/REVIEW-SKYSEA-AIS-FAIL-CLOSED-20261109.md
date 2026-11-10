# P1 review — SkySea AIS collector can report success without publishing fresh observations

Reviewed: 2026-11-09 06:53 KST. Source: [AIS collector](../scripts/build_skysea_ais.py), [AIS workflow](../.github/workflows/collect-skysea-ais.yml), [SkySea UI](../skysea.html). **Review/owner handoff only** per [AI-ROLES.md](AI-ROLES.md); GPT did not change collector, workflow, data, UI or tests.

## Confirmed source-level failure paths

1. `scripts/build_skysea_ais.py` catches a WebSocket exception, prints only its exception *class*, and returns `pos = {}`. The module then runs `if not pos: ... raise SystemExit(0)`. **No positions received — including connection, authentication or upstream errors — exits with status 0 and preserves the previous `ships_live.json`.** A legitimate zero-observation sample is also indistinguishable from failed collection. The collector has no separate source-health/status record.
2. The same collector treats an upstream message containing `error` as `print('stream error'); break`. If some positions arrived before the error, `pos` is nonempty and the script writes a normal-looking snapshot with a new `updated` timestamp and counts from the **partial** 75-second sample. No partial/error flag is emitted.
3. `.github/workflows/collect-skysea-ais.yml` runs every ten minutes and does not assert that the source was healthy or that a new valid snapshot was produced. A no-change `git diff --staged --quiet` makes the Commit step succeed; the workflow can be **green while the old file remains**.
4. The Commit step retries `git push` three times, but does not check that a push ever succeeded. After all three fail, the `for` loop's last `sleep 5` returns success; `gh workflow run deploy-pages.yml --ref main` may then be dispatched. The trailing `|| true` can mask a deployment-dispatch failure too. This is a separate AIS instance of the false-green class described for four US collectors in [#538](https://github.com/91cleaner/money-tracker/issues/538).
5. `skysea.html` `loadL()` accepts an unchanged JSON timestamp without marking the data stale, and the UI continues to label the layer `실시간 배` / recent live AIS. The general stale-display issue is **already reviewed in [#471](https://github.com/91cleaner/money-tracker/pull/471)**; this review focuses on the **upstream false-success and partial-publication causes**, not a duplicate UI implementation.

## Evidence and isolated reproduction

- [AIS run #42525276781](https://github.com/91cleaner/money-tracker/actions/runs/42525276781) succeeded on 2026-11-08 21:29 UTC. The inspected `main/data/skysea/ships_live.json` had `updated=2026-11-08T21:29:17Z`, `seconds=75`, 98 vessel records. **This is a successful sample, not evidence that the failures above occurred in production.**
- Executed an isolated Python subprocess with the collector's exact `if not pos: ... raise SystemExit(0)` branch: printed `no ships received; keeping old file`, process exit code **0**.
- Executed an isolated Bash simulation of the workflow's exact retry/dispatch control flow with three mocked failed pushes: output `SIMULATED_PUSH_FAILURE` three times, then `DEPLOY_DISPATCH_WITHOUT_PUSH`; step exit code **0**. No real network, secrets, GitHub push or deployment was used in these tests.
- Source-level control-flow review proves the failure **possibility**; it does not prove a real AIS outage, failed push or misleading live page at this moment.

## Owner fix (data/CI lead) — fail closed, preserve last good snapshot

1. Separate **source-health** from **observation count**. A missing/invalid AIS key, WebSocket exception, upstream `error`, unexpected termination, invalid message/schema, or incomplete sample must return **nonzero** and preserve the last validated `ships_live.json`. Do not interpret an upstream failure as verified zero ships. A genuinely healthy sample with zero observations needs an explicit, independently verified source-health signal and a documented zero-count policy.
2. Do not publish a partial 75-second sample as a normal successful one. Either fail closed, or publish an explicitly marked `partial` status with an observation-window duration and last-good timestamp; the UI must never treat it as complete/live.
3. Record `sample_started_at`, `sample_finished_at`, `last_success_at`, and `status` (`ok`/`partial`/`stale`/`unavailable`) in a validated public status schema, without exposing `AISSTREAM_KEY` or error payloads. Keep the last-good observation time unchanged on failure. The UI owner should display age and an unambiguous stale/unavailable badge and avoid presenting retained markers as current.
4. In the workflow, fail if the collector failed or if a claimed successful sample has no valid output. For a changed snapshot, require a confirmed push before dispatching Pages. After retry exhaustion, `exit 1` (or equivalent); do not use unconditional `|| true` on the critical publication path. Keep unchanged-but-healthy samples distinguishable from no-source failures.
5. Keep this fix separate from [#537](https://github.com/91cleaner/money-tracker/pull/537) (four US workflows), [#471](https://github.com/91cleaner/money-tracker/pull/471) (SkySea UI freshness), and [#535](https://github.com/91cleaner/money-tracker/pull/535) (SkySea count validation/out-of-order responses). Coordinate with those owners rather than editing their files concurrently.

## Regression / release acceptance

- Mock WebSocket connect failure, missing key, upstream error before first position, and upstream error **after** a position: no new normal snapshot, nonzero CI, previous validated bytes retained, status stale/unavailable.
- Mock a full healthy 75-second sample: correct deduplicated MMSI count, UTC observation window, valid status and fresh timestamp. Exercise a documented healthy zero-observation sample separately.
- Mock three failed `git push` attempts: CI red, no Pages dispatch. Mock first/second push success: CI green, exactly one dispatch after successful push. Test `gh workflow run` failure explicitly.
- Check the public JSON status and mobile/desktop SkySea browser state at the **same deployed SHA**; a green AIS workflow is not proof of fresh data without source-health and publication evidence.
- Do not merge before the owner approves and confirms CI. **GitHub repository is public**; live *executed stock trade* feed **NOT CONNECTED**, generative AI **NOT CONNECTED**. AIS vessel observations are a separate sampled feed.
