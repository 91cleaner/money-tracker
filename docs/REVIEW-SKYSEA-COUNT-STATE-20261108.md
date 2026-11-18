# P1 review — SkySea invalid counts must not become verified zero (2026-11-08)

**Scope:** review/acceptance criteria only. Claude owns `skysea.html` UI; data lead owns ingestion and `data/`; GPT does not edit either. See [AI-ROLES.md](AI-ROLES.md). This is a separate accuracy finding in **unmerged** [PR #523](https://github.com/91cleaner/money-tracker/pull/523), not a claim of an observed bad live feed.

## Reproduced issue

PR #523 HEAD `bf311da` adds this safety formatter to `skysea.html`:

```js
const safeCount = (x) => Number.isFinite(Number(x)) ? Number(x).toLocaleString('ko-KR') : '0';
```

It is used in the country legend, daily vessel ghost detail and vessel cell detail. Its intent is sound (do not interpolate arbitrary upstream strings into `innerHTML`), but it conflates **missing/invalid** with **confirmed zero**. V8/Node reproduction:

| Input | Current display | Correct interpretation |
| --- | --- | --- |
| `0` | `0` | Valid zero only after successful source/schema validation |
| `12` | `12` | Valid count |
| `null` | `0` | Missing / unavailable |
| `''` | `0` | Missing / unavailable |
| `undefined` | `0` | Missing / unavailable |
| `'N/A'` | `0` | Invalid / unavailable |
| `Infinity` | `0` | Invalid / unavailable |
| `-4` | `-4` | Invalid for nonnegative aircraft/vessel counts |

The existing `tests/skysea-escaping.test.cjs` **asserts** that a malicious count string becomes `'0'`, so a passing escaping test can still lock in this accuracy regression. This is distinct from the already-reviewed HTML injection and URL-scheme issues. It also echoes the product's existing `#478` principle: unavailable is not zero, but applies to a different screen and formatter.

## Required correction for Claude / data lead

1. Keep HTML escaping for all untrusted labels and date strings. Change the **count contract** so only finite, nonnegative integers (or explicitly permitted numeric count strings) can format as numbers. Treat `null`, `undefined`, empty strings, non-finite values, negative values and nonnumeric text as unavailable, **never as zero**.
2. Distinguish a confirmed `0` from `자료 확인 불가 / Count unavailable`. Where the current template expects a numeric string, render a neutral unavailable label rather than `0척` or `0대`. If a count is invalid, show an error/freshness state and avoid using it in aggregate totals until the source is validated.
3. Validate the upstream `ships.counts`, `last.counts`, `by[k]` and `t` schema before computing totals or marker sizes. A display formatter cannot repair `NaN` already introduced during aggregation. Do not silently substitute zero in the source JSON.
4. Preserve the security fix: never interpolate raw invalid count text into `innerHTML`, even when showing an error state.

## Additional P1 failure path — malformed snapshots become cached as loaded (2026-11-08 22:56 KST)

Reviewed the actual **unmerged #523** `skysea.html` load handlers, separate from the count formatter:

- **Aircraft:** `load()` assigns `last = j` **before** `top(j.counts, 7)`. If the response is valid JSON but lacks `counts`, `Object.keys(undefined)` throws. The `.catch` sets an error message **only when `!last`**, so the malformed object remains truthy and the UI can keep its initial "불러오는 중이에요" (or stale previous text) rather than report failure.
- **Daily ships:** the `ships.json` handler assigns `ships = j` before the same `top(j.counts, 7)` validation. Its catch displays "배 자료를 불러오지 못했어요", but `ships` remains truthy and can cause later `legend()`, `drawS()` and country-card reads to fail.
- **Aggregate type drift:** `legend()` uses `(o[kk] || 0) + counts[k]` and `vis()` uses `s + cnt[k]` without numeric validation. A count of string `'5'` yields string `'05'` from zero; mixed counts `'5'` and `2` yield `'052'` rather than 7. This can corrupt totals even if the final display formatter is safe.

**Isolated Node.js reproduction:** `{updated:'...', counts: undefined}` causes `TypeError` after `last` / `ships` have been set; `last` stays truthy and the aircraft error message is suppressed. `{US:'5', KR:2}` yields concatenated total `'052'`. These are **synthetic malformed inputs**, not a claim that current published JSON is malformed.

**Required behavior (UI owner):** validate `response.ok`, `updated`, `counts` object shape and every count (finite, nonnegative integer) **before** assigning to `last` / `ships`. Keep the last *validated* snapshot separately from error/loading state; on invalid refresh show "자료 갱신 실패 · 이전 정상 자료 표시" with last successful timestamp, and on initial failure show "자료 확인 불가 · 다시 시도". Reject type drift or explicitly normalize permitted numeric strings **before summing**, never through implicit `+` coercion. If the data cannot be validated, skip aggregate/marker rendering rather than fabricating a zero.

**Regression cases:** HTTP 500, JSON parse error, missing `counts`, `counts: null`, `counts: []`, `counts: {US:'5',KR:2}`, negative/fractional/non-finite count, valid empty `counts: {}`, recovery on the next successful refresh, and stale-but-valid snapshot after a failed refresh. Assert that a bad snapshot does not replace the last good one, that a failed initial load never stays on "불러오는 중", and that a verified `US:5, KR:2` totals **7**. Test both airplane and daily-ship paths.

## Regression acceptance

- Real `0` and `'0'` display zero **only after successful load and valid schema**; positive integer counts format with locale grouping.
- `null`, `undefined`, `''`, `'N/A'`, `Infinity`, negative and injected HTML counts display unavailable (or fail closed at the data boundary), not `0`.
- In country legend, ghost/cell detail and totals, unavailable values never inflate or silently reduce the reported totals; show a status if any count cannot be verified.
- Add behavior-level tests against the actual rendered templates, not only source markers. Test Korean and English status, mobile landscape clipping, and a retry after a malformed snapshot.
- Verify PR-head Actions and published Pages **separately** after integration; do not equate green deployment with data accuracy. Existing map/security entry assertions are tracked by [#403](https://github.com/91cleaner/money-tracker/pull/403), so do not duplicate their fix.

## Verification and release status

Reviewed the actual [#523 diff](https://github.com/91cleaner/money-tracker/pull/523) and comments, and ran the exact formatter in Node.js with the inputs above. **No current malicious or malformed live records were confirmed.** This review does not alter UI, data, collector, tests or deployment. PR #523 remains unmerged; its SkySea security regressions were reported 12/12 passing, while broader map/security jobs failed old entry assertions. The repository is **public**; real-time **executed stock trade feed is not connected**, and **generative AI is not connected**.


## Additional P1 accuracy defect — Out-of-order refresh can roll back a newer map (2026-11-09 KST)

**Fresh code-path check:** PR #523 HEAD \`bf311da\`, \`skysea.html\` around lines 310, 340 and 370. This is independent of the invalid-count/schema failures above.

- \`load()\` is scheduled every 30 seconds. It accepts an aircraft response whenever \`j.updated !== last.updated\`; it does **not** require \`j.updated\` to be newer. An earlier request can finish after a later request and overwrite the newer \`last\` snapshot, country totals, and on-screen timestamp.
- \`loadL()\` for live ships is scheduled every 120 seconds and likewise checks only \`j.updated === live.updated\` before replacing \`live\`; it can roll back the ship layer.
- \`evLoad()\` is scheduled every 600 seconds and unconditionally assigns \`ev = j\`, so the same issue applies to event overlays. Its catch silently suppresses refresh failures.
- The nested \`tracks.json\` fetch in \`load()\` unconditionally sets \`trk = t\` when it finishes. Even if aircraft state is guarded, a late track response can pair tracks from an older fetch with a newer aircraft snapshot.

**Isolated Node.js reproduction** (synthetic out-of-order responses; not a claim of an observed production rollback):

\`\`\`js
let last = {updated: '2026-11-08T15:00:00Z'};
const accept = (j) => { if (!last || j.updated !== last.updated) last = j; };
accept({updated: '2026-11-08T15:30:00Z'}); // newer response resolves first
accept({updated: '2026-11-08T15:10:00Z'}); // older response resolves last
console.assert(last.updated === '2026-11-08T15:10:00Z'); // rollback reproduced
\`\`\`

The same check with the \`loadL()\` equality-only guard also finishes at 15:10 instead of 15:30.

**Required correction (Claude screen owner):**

1. Validate the entire response schema and parse \`updated\` as a finite, timezone-aware timestamp before publishing state; a malformed timestamp must never replace a validated snapshot.
2. Use a monotonically increasing request-generation token to prevent an older request's response from overwriting a newer accepted request, **and** a monotonic source-\`updated\` comparison so that an older source snapshot never replaces a newer one even when its request started later. Handle clock skew explicitly rather than relying on lexicographic comparison of arbitrary date strings.
3. Apply the guard independently to aircraft, live ships, and event overlays. Tie track results to the accepted aircraft generation (or verify compatible track timestamp); late tracks must not repaint a newer map.
4. On failed or rejected refresh, keep the last **validated** snapshot and timestamp, with a separate refresh-error/stale indicator; do not replace it with \`0\` or silently claim current data.

**Behavioral regression cases:** delayed A/B responses resolved B→A; a later request containing an older source \`updated\`; same timestamp; invalid timestamp; rejected refresh followed by valid recovery; late \`tracks.json\` after a newer aircraft update; aircraft, ship and event paths separately. Assert that timestamps, country totals, marker layers and track generation never regress. Test PR HEAD and deployment independently.

**Scope:** Node.js synthetic guard reproduction only; no network manipulation, observed live rollback, or browser exploit. No screen, collector, data, or test code was changed by GPT.
