# P1 security review — SkySea untrusted telemetry reaches `innerHTML`

Reviewed 2026-11-03 KST against `main/skysea.html` and the published-source JSON files. **Static source review only**: this is a plausible client-side injection path, **not** a claim of an observed attack or confirmed production exploit. The file is not changed in this PR because `docs/AI-ROLES.md` assigns UI code to Claude.

## Evidence / trust boundary

1. `skysea.html:309` fetches `data/skysea/aircraft.json` from an upstream ADS-B-derived snapshot. In `drawP`, line 236, `fl` (flight/callsign) becomes `name`, and a map icon's click handler inserts `name` and `ty` directly into `$('info').innerHTML`. The tooltip correctly calls `esc(name)`, **but the click details do not**.
2. `skysea.html:369` fetches `data/skysea/ships_live.json` (AISStream-derived snapshot, `ships[*][5]` vessel name and `ships[*][7]` type). In `drawS`, line 269, the click handler inserts `nm` and `ty` directly into `$('info').innerHTML`. These are source-controlled text fields, not trusted HTML.
3. `skysea.html:313` already defines `esc(x)` to encode `&<>"'`; it is not used at these two detail-panel sinks. Therefore a string containing HTML syntax is interpreted as markup in the detail panel instead of displayed as literal telemetry. If upstream fields contain executable HTML/event attributes, this is a potential DOM-XSS path. The existing JSON samples were inspected for field structure, **not** audited exhaustively for malicious strings.
4. This is distinct from [PR #471](https://github.com/91cleaner/money-tracker/pull/471), which reviews missing SkySea *release coverage*, and from [PR #469](https://github.com/91cleaner/money-tracker/pull/469), which reviews *public-file allowlisting*. Neither issue fixes an unsafe HTML sink.

## Requested owner fix (Claude / SkySea UI)

- Replace the affected detail-panel interpolations with DOM elements plus `textContent` for every upstream string, preserving intentional `<br>` only as code-authored nodes. A minimal alternative is to apply `esc()` to **all** upstream strings before insertion (aircraft callsign/type; AIS vessel name/type; and any other nonnumeric fields), not just the tooltip.
- Validate numeric telemetry fields and timestamps before formatting; do not assume a JSON array element has the expected type. Apply the same rule to all other telemetry-fed `innerHTML` sinks in `skysea.html`, including event/article labels and URLs. Keep user-facing labels such as "실시간" explicitly bounded by source freshness.
- Regression test with mocked aircraft callsign and vessel name equal to the inert probe `<strong>PROBE</strong>`. After clicking each icon, the panel should display the **literal angle-bracket text**, contain no injected `strong` element, and not mutate unrelated DOM. Add an executable event-handler payload in a sandboxed browser test and assert it **never executes**. Include normal Korean/English names and HTML metacharacters as positive cases.
- Add a browser smoke test of both icon-click detail paths in the existing SkySea test suite. Do not mark this finding fixed on the strength of documentation, HTML grep checks, or an unrelated green CI run.

## Verification / release gate

- **Confirmed by source inspection:** external text reaches two `innerHTML` templates without the already-present `esc()` call.
- **Not verified:** browser exploit, malicious current source records, mitigation, CI, Pages deployment, and production behavior.
- **Acceptance:** UI fix on Claude's branch, targeted browser regression green, PR review, then owner-approved merge and live Pages smoke. This PR only preserves the finding and exact fix criteria; **do not merge this documentation as proof of a security fix**.

**Current product limits:** GitHub repository and Pages are public, not private. House PTR is delayed disclosure rather than a real-time executed-trade feed; generative AI analysis is **NOT CONNECTED**. No source data, collector, or UI code is modified here.

## Follow-up static audit — two additional sinks (2026-11-03 KST)

This follow-up extends the same SkySea UI finding, rather than opening a duplicate PR. It was checked against `main/skysea.html` at blob `c5eb5a12c6ea02759ce768fdd5af3de537e1982d` and the published `data/skysea/events.json` structure. **No browser exploit or malicious current record was demonstrated.**

5. **Country detail card:** `skysea.html:352` assigns `$('cardD').innerHTML` with `ev.zones.items[*].id` and `valid_until` interpolated without `esc()`. The other zone-detail path at line 316 *does* escape those fields, so the country-card path is an independent inconsistent sink. A mock `zones.items[0].id = '<strong>ZONE-PROBE</strong>'` should render as literal text, not create a `strong` node. Escape both values or build DOM nodes using `textContent`.
6. **External article link scheme:** `skysea.html:332` uses `href="${esc(u)}"` for the `latest_url` value from `events.json` conflict cells. `esc()` is HTML-attribute encoding, **not URL-scheme validation**; it leaves strings such as `javascript:alert(1)` unchanged. Although inspected current sample URLs begin with `https://`, an upstream/collector regression could inject a dangerous scheme into the clickable link. Require a parsed absolute URL with `protocol === 'https:'` (or a separately justified `http:` policy), reject `javascript:`, `data:`, protocol-relative and malformed URLs, and only then assign `a.href`. Retain `rel="noopener noreferrer"` for external links. Avoid raw string interpolation of unvalidated URLs.

**Additional owner regression cases:** mock a zone ID containing inert `<strong>` markup and verify no injected DOM element; mock conflict `latest_url` with `javascript:`, `data:`, `//example.invalid`, malformed URLs, and a normal HTTPS article URL. Assert unsafe links are omitted or disabled, valid HTTPS opens as expected, and neither `#info` nor `#cardD` gains unintended nodes. Test with a real DOM/browser; a text grep is insufficient. Verify the same fixes in the built Pages artifact after owner-approved merge. These are **unfixed review findings**, not mitigations implemented by this document.
