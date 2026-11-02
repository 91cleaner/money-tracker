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


## P1 UI freshness follow-up — aircraft and live AIS refresh failures retain map markers (2026-11-03 KST)

This is a **separate client-side stale-state path**, not a repeat of the event collector's partial-fallback bug above. Static source review against `main/skysea.html` blob `c5eb5a12c6ea02759ce768fdd5af3de537e1982d`; no outage, stale production record, or browser reproduction is claimed.

**Aircraft and AIS browser refresh can silently retain old markers:**

- **Aircraft (`load()`, near line 308):** the first successful fetch assigns `last = j` and renders aircraft. On a later rejected fetch, `.catch(() => { if (!last) ... })` performs **no visible update** when `last` exists. The old aircraft records and icons remain in `drawP()`, while the heading still says `비행기 (지금)` and the status says `10분마다 새로 받아요`. A source timestamp is displayed, but there is no explicit stale/error badge. This is an error-path contract defect, not proof the data are currently stale.
- **Recent AIS (`loadL()`, near line 393):** after a successful fetch sets `live = j` and `drawS()`, a subsequent rejection only changes `#liveNote`. It does not invalidate `live`, redraw `drawS()`, or hide/flag the existing `liveRec` icons. The layer toggle and country-card `실시간 배` count can still include the previous snapshot. If the server repeatedly returns the same `j.updated`, the early return prevents any age/status evaluation at all. A stale backend file can therefore remain presented as live even when HTTP requests succeed.
- **HTTP and timestamp handling:** both paths call `r.json()` without first checking `r.ok`, and neither checks that `updated` is a parseable, reasonable observation timestamp. A valid JSON body with an old timestamp is not a fresh observation.

**Owner implementation acceptance (Claude/UI; do not overlap with collector/data owner):**

1. Track separate `last_success_at` / parsed source `updated` / last fetch error for aircraft and AIS. Use a documented freshness threshold based on the actual collection cadence (aircraft advertised 10 minutes; AIS sampled intermittently), not merely whether a request returned HTTP 200.
2. After a failed fetch **even if a prior snapshot exists**, visibly mark that layer `stale` or `unavailable`, stop describing its positions as `지금` or `실시간`, and either suppress stale markers or clearly distinguish them. A successful request returning an unchanged old `updated` must not reset freshness. Preserve source timestamps; do not rewrite them to browser current time.
3. In country cards and toggles, distinguish `unknown/unavailable` from a genuine zero; prevent the retained `live` snapshot from inflating an apparently current live count. Restore normal status only after a fresh valid snapshot.
4. **Browser regression cases:** (a) first fetch fails; (b) first succeeds, second fails; (c) multiple HTTP 200 responses with identical old `updated`; (d) invalid/missing timestamp; (e) valid fresh recovery. Assert marker status, `#upd`/`#liveNote` copy, `#cardD` live count, and portrait/landscape visibility. Test aircraft and AIS independently; a green static/CI smoke without the failure-path fixture does not close this defect.

**Verification boundary:** only the source branches and existing UI text were inspected. No collector, UI, browser test, or deployed Pages code was changed. The existing PR #471 remains a docs/review change; this note is an owner handoff, not a mitigation.
