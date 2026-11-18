# P1 review — SkySea event-card HTML boundary (2026-11-08)

**Owner handoff:** Claude (screen) / data lead (schema). This is a source-level review of **unmerged** [PR #523](https://github.com/91cleaner/money-tracker/pull/523), not a confirmed malicious feed or live browser exploit. Per [AI-ROLES.md](AI-ROLES.md), GPT changes documentation only.

## Distinct finding (not covered by count-state review)

In PR #523 HEAD `bf311da`, `skysea.html` around lines 332–337, `drawE()` builds event-card HTML using unescaped values from `ev.conflict.cells`:

- `n.toLocaleString('ko-KR')` is interpolated into `evCard(..., h)`. For **string** input, `String.prototype.toLocaleString()` returns the raw string, not an escaped numeric representation.
- `rc[0]`, `rc[1]`, `rc[2]` are inserted directly into the same HTML string, without escaping or numeric validation.
- `evCard` assigns `h` to both `#info.innerHTML` and `#cardG.innerHTML` (around line 316). Escaping the title `t` does **not** sanitize the body `h`.
- Adjacent event templates similarly interpolate upstream GPS `n`/`bad`, fire counts `n`, quake magnitude `m`/depth `dp`, and coordinates. These require typed validation before HTML or URL composition; do not claim each is exploitable without checking the producer schema and reachable UI.

**Minimal isolated Node.js probe** (synthetic inputs, no network):

```js
const n = '<svg onload=alert(1)>';
const rc = ['<img src=x onerror=alert(1)>', 2, 3];
const h = `최근 24시간 기사 ${n.toLocaleString('ko-KR')}건<br>종류: 공격 ${rc[0]}`;
console.assert(h.includes('<svg') && h.includes('<img'));
```

The assertion passes: the string payload remains HTML markup. This establishes an **unsanitized DOM sink if upstream fields are malformed/untrusted**. It does not establish that the collector currently emits such fields, that the browser executed the markup, or that an attacker controls the feed.

## Required owner fix and acceptance criteria

1. At the event JSON boundary, require nonnegative finite integer counts for `n` and `rc[0..2]`, finite coordinate pairs in valid ranges, and appropriately bounded magnitude/depth; reject malformed cells rather than silently coercing them to zero. Preserve an explicit unavailable/invalid status.
2. Render external strings with `textContent` or `esc()` at every HTML sink. Format numbers **only after type validation**. Do not rely on `toLocaleString()` as an HTML sanitizer. Validate/encode coordinates before building external URLs.
3. Add behavior-level regressions exercising the actual event-card rendering for malformed string count, malformed `rc`, valid integer counts, missing fields, and invalid coordinates. Assert no `img`/`svg` node is created from injected values, both `#info` and `#cardG` are safe, and valid event cards still work.
4. Include `skysea.html` changes in PR-head CI; separately verify Pages after owner-approved merge. Never equate green escaping tests with verified source data.

## Verification scope

Read PR #523 HEAD `skysea.html` via GitHub and reproduced the raw string interpolation in Node.js on 2026-11-08. **No application code, tests, source data, or deployment was changed in this review.** PR #523 remains pending. Repository visibility: **public**. Real-time **executed stock trades: not connected**. Generative **AI: not connected**.
