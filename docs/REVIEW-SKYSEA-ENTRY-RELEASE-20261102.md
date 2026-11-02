# Release review: SkySea is a public entry but not in the Pages smoke contract

Reviewed: 2026-11-02 KST. Scope: [main index.html](https://github.com/91cleaner/money-tracker/blob/main/index.html), [main skysea.html](https://github.com/91cleaner/money-tracker/blob/main/skysea.html), and [PR #403](https://github.com/91cleaner/money-tracker/pull/403) head `488ff42f`. This is a static review, **not** evidence of a production outage.

## Confirmed gap (P1 release coverage)

- `main/index.html` exposes a third country/command entry: `<a class="country sky" href="skysea.html">` (world flight and ship view).
- PR #403 `scripts/check-pages-entry.py::CHECKS` validates only root, `korea.html`, `world-intelligence/`, `usa-command-legacy.html`, and `assets/mt-command-ui.js`. It does **not** request `skysea.html` or compare its bytes with the uploaded artifact.
- The PR's `tests/mt-command.test.cjs` verifies the Korea/US root links but not `skysea.html`. Therefore, a missing/stale SkySea page could pass the proposed entry-point smoke contract if the five listed files still match. This is a test-coverage counterexample, **not** an observed missing page.
- The current main Pages deploy/security workflows still contain stale entry assertions addressed in #403. PR #403 is open and GitHub currently reports `mergeable=false`; do not assume its checks are active in production.

## Owner acceptance criteria (Claude/UI + release owner; no overlapping code edits by GPT)

1. Extend the **existing** #403 entry contract (do not add a competing checker): root `href="skysea.html"` and `skysea.html` existence, HTTP 200, required DOM controls (`id="map"`, `id="side"`, `id="q"`, `id="cardX"`), and referenced local Leaflet/basemap dependencies.
2. When `--expected-dir` is used, compare published `skysea.html` with the exact generated artifact as already done for the five current paths; apply the previously reported redirect-final-URL check to this route too.
3. Add regression cases: (a) missing root SkySea link, (b) absent SkySea artifact, (c) HTML 200 containing unrelated fallback content, (d) same markers but stale SkySea bytes, (e) normal exact SkySea bytes. For the existing mobile browser smoke, exercise portrait 375×812 and landscape 844×390 to confirm map, side panel, close button, and exit remain reachable; **not tested in this review**.
4. Treat aircraft observations, delayed ship presence grids, extrapolated positions and limited AIS coverage as distinct statuses. Do not label all ship dots as verified live positions. Keep any offline/failed data source visibly marked as unavailable, not zero.
5. Before merge, resolve #403's conflict with latest main; then verify the combined #403/#412/#458 release on one commit SHA, including actual Pages URL and data checks. Do not equate a green PR job with a live deployment.

## Documentation correction delivered in this PR

`README.md` now lists `skysea.html` among entry points and distinguishes sampled aircraft, delayed ship grids, recent AIS reception and extrapolated positions. This fixes an **existing documentation omission** without changing any UI, collector, `data/`, workflow or deployment code.

**Current limits:** GitHub repository is public, not private. House PTR disclosures are delayed filings, not a connected real-time executed-trade feed. Generative AI analysis is **NOT CONNECTED**. This review does not certify official source accuracy, mobile UX, authentication or deployment parity.

**Coordination:** Per `docs/AI-ROLES.md`, GPT changes documentation only; Claude owns UI, the lead owns data, and the owner must approve merging. This PR is intended to remain draft/unmerged.

## P1 data-freshness review — failed upstream refresh can masquerade as current (2026-11-03 KST)

This is a **new, source-confirmed freshness-contract defect**, separate from the missing SkySea route in the release smoke. It does **not** establish that a specific upstream was down or that a currently displayed record is stale.

- In `scripts/build_skysea_events.py`, `out = {'updated': now.strftime(...)}` is created **before** the four upstream fetches. Each GDELT, NASA FIRMS, USGS, and EASA `except` branch assigns `out['conflict'/'fires'/'quakes'/'zones'] = prev.get(...)`. This reuses a previous section without retaining a per-source fetched-at time or setting a stale/error status.
- The generated `data/skysea/events.json` can therefore have a **new top-level `updated` timestamp while one or more sections are from an earlier run**. In `skysea.html`, `evLoad()` displays `j.updated` as `더 보기 자료` time, and the fire-card click path uses `ev.updated` as `자료 시간`. Both can overstate freshness after a partial failure. The map still renders the reused section, with no explicit stale label.
- **Owner fix (lead/data + Claude/UI):** record source-specific `fetched_at`, `status` (`ok`, `stale`, `unavailable`), and `last_error` (safe error category, no secrets) for all four sections; preserve the original successful observation time when falling back. The UI must show the section's own timestamp and a clear stale/unavailable label. If no valid prior section exists, mark unavailable rather than claiming zero events. Do not silently promote a previous 24-hour window to the current 24 hours.
- **Executable regression gate:** mock a successful first run, then fail only GDELT on the second run while FIRMS/USGS/EASA succeed. Assert GDELT records are explicitly stale with the **first** successful timestamp, the other sections remain fresh, and the map displays both statuses correctly. Repeat with all four fetches failing and with no previous JSON; assert no fresh badge, no misleading zero count, and no silent success. A normal successful refresh must clear the stale status. Verify generated public JSON and the deployed UI after owner-approved merge.

**Verification boundary:** inspected `main/scripts/build_skysea_events.py` and `main/skysea.html` (SkySea blob `c5eb5a12c6ea02759ce768fdd5af3de537e1982d`) and the `events.json` schema. No network failure was induced; no collector/UI/test code was modified; no browser or production remediation is claimed. This section extends the existing #471 review instead of creating a competing data/UI PR.
