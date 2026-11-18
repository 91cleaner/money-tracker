# P1 review — First-screen evidence links bypass source validation (2026-11-09)

**Owner / scope:** Claude owns `assets/firstscreen.js` and `world-intelligence/index.html` UI; 실장 owns public-data ingestion. GPT supplies a **review and acceptance criteria only** under [AI-ROLES.md](AI-ROLES.md). This extends the provenance review in [PR #534](https://github.com/91cleaner/money-tracker/pull/534), without changing the screen or data. Distinct from the `mtIntentCard` URL fix in [#530](https://github.com/91cleaner/money-tracker/pull/530)/[#532](https://github.com/91cleaner/money-tracker/pull/532).

## Verified source-level paths (main, 2026-11-09)

1. `assets/firstscreen.js` `buildWhy`, `buildTopic`, `buildMember`, `buildMoney` build `doc.sources` and/or `cards[].lines[].url` from data-backed `e.u`, `t.doc`, `aw.source_url`, `lb.source_url`, `pc.source_url`. Most use `/^https:/` as the only URL gate. A prefix is **not** an origin or document verification.
2. `render(doc, box, onTour)` renders individual card links via `a.href = l.url` without an independent URL parse/host check.
3. The same `render` function executes `new URL(u).hostname` inside `doc.sources.slice(0, 4).forEach(...)` **without a per-link try/catch**. If `u === 'https:'`, the prefix gate passes but `new URL('https:')` throws `TypeError`. The parent `mtFirstCard` catches this and returns `false` *after* it has opened the brief and begun rendering. Thus one malformed citation can interrupt an otherwise valid first-screen card and leave a partial/alternate view. This is a **source-level reproduction**, not evidence of a bad current feed.
4. A syntactically valid `https://disclosures-clerk.house.gov.evil.example/file` passes the prefix check, as does `https://finance.yahoo.com@attacker.example/path`. Neither host is the named official institution. The browser can offer these as clickable “Source” references without a trusted-host policy.

## Reproduction (Node.js, synthetic inputs)

```js
for (const u of [
  'https:',
  'https://disclosures-clerk.house.gov.evil.example/file',
  'https://finance.yahoo.com@attacker.example/path',
  'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20033889.pdf'
]) {
  if (!/^https:/.test(u)) continue;
  try { console.log(u, new URL(u).hostname); }
  catch (e) { console.log(u, e.name); }
}
```

Observed: `https:` -> `TypeError`; spoofed host -> `disclosures-clerk.house.gov.evil.example`; userinfo host -> `attacker.example`; known House URL -> `disclosures-clerk.house.gov`. No browser exploit or actual poisoned record was observed.

## Acceptance criteria for UI owner

- Reuse a **single provenance URL parser** across `mtIntentCard`, `MTFirst.render` card lines, `MTFirst.render` footer sources, and map route source links. For each URL: parse with `new URL` in an isolated try/catch, require `https:`, reject credentials, reject non-allowlisted exact hostnames, and apply any reviewed source-path constraints. Never use suffix/substring matching. Keep third-party price sources explicitly separate from original official disclosures.
- Invalid source must **not** cancel the answer or a map trace. Render the text and a non-clickable bilingual `출처 검증 대기 / Source verification pending` state; do not silently convert missing evidence into verified evidence.
- If a source has no verified link, do not display a generic “official source” badge. Hostname allowlisting does **not** validate the actual document content, reported transaction date, or legislation-to-company relationship.
- Add behavior tests using the real `MTFirst.render` path: mixed valid/invalid links, all-invalid links, `https:`, non-HTTPS, spoofed subdomains, credential-bearing URLs, legitimate House Clerk links, legitimate separately labeled market-data references. Assert valid answer text and navigation remain intact, and unsafe anchors never enter the DOM.
- Test question -> candidate -> first-screen -> map trace in both Korean/English, including iPhone landscape layout, close/back/retry, and latest accepted query (avoid a stale card replacing a newer query). Verify PR HEAD Actions and **published** Pages/Worker independently.

## Release gates and limits

The related UI fixes [#530](https://github.com/91cleaner/money-tracker/pull/530) and [#532](https://github.com/91cleaner/money-tracker/pull/532) are draft and **not merged**; their `mtIntentCard` protection is not evidence that `MTFirst.render` is fixed. [#527](https://github.com/91cleaner/money-tracker/issues/527) House PTR chronology anomalies also remain open. Repository visibility is **public**, not private. PTR filings are delayed self-reports; real-time executed-trade feed **NOT CONNECTED**, generative AI **NOT CONNECTED**.

**Verification performed:** read actual main `assets/firstscreen.js` and `world-intelligence/index.html` from GitHub, checked PR #530/#532 scope, ran the isolated Node.js synthetic URL probe. **Not performed:** UI code fix, full browser/CI run, live URL integrity audit, production deployment or mobile device test. Merge only after owner approval.
