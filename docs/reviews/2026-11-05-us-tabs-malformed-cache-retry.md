# P1 review — malformed public rows poison the retry cache (#513)

Reviewed 2026-11-05 20:53 KST against [draft PR #513](https://github.com/91cleaner/money-tracker/pull/513), head `4fc549584dc3a939b43da15f8ce2af0f2fbcd06d`. **This is a verified mocked-runtime regression, not a live browser/Pages deployment test.** No UI, collector, `data/`, CI or production files were changed in this review.

## Reproduction and impact

`assets/mt-tabs.js` checks that `loaded.trades` / `loaded.items` is an array and **assigns `TR = loaded` / `WH = loaded` before rendering individual entries**. An array containing `null` passes the top-level check, but `t.map(x => x.who)` or `WH.items.filter(x => x.kind)` throws. The catch renders the new **retry** button; the cache is already populated, so `if (!TR)` / `if (!WH)` is false on every retry. Even after the server recovers, retry never refetches and the error is sticky until page reload.

A small V8 mock executed the **actual PR source** with the following deterministic cases (not a source-only guess):

| Tab | First HTTP 200 JSON | Next HTTP 200 JSON (available if refetched) | Observed after clicking retry |
| --- | --- | --- | --- |
| 의원 (`mem`) | `{"trades":[null]}` | `{"trades":[{"who":"Example","tk":"NVDA","d":"2026-11-05","fd":"2026-11-05","amt":"$1","ty":"P"}]}` | Error remains; **1 total request**; no `1건` |
| 백악관 (`wh`) | `{"items":[null]}` | `{"items":[{"kind":"presdoc","date":"2026-11-05","u":"https://www.federalregister.gov/","type":"Executive order"}]}` | Error remains; **1 total request**; no `1건` |

Both cases reproduced: first error displayed, retry still displayed error, retry did not issue a second fetch. This is a **synthetic malformed payload**, not a claim that the live public JSON currently contains `null`.

## Required owner fix and acceptance gate

1. Claude/UI owner: validate entries **before committing data to `TR` or `WH`**, or clear the relevant cache on any render/shape failure; ideally do both and make malformed-row handling explicit. Do not silently turn malformed data into a verified `0건`.
2. Retry must issue a **new network request** after malformed rows, then display the recovered rows. Test both tabs, including `null`, non-object, and unexpected field types; no unhandled exception or false zero.
3. Preserve the existing `showSeq` guard: switching tabs while a failed request is pending must not repaint the active tab; stale responses must not poison the active display.
4. Wire these regression cases into `tests/mt-tabs-load.test.cjs` and run the test in CI on the same PR SHA. Verify mobile portrait/landscape retry visibility and a live Pages post-merge deployment separately.
5. Maintain source-date distinctions, the **public House PTR delayed-disclosure** caveat, **real-time executed trades DISCONNECTED**, and **generative AI DISCONNECTED**.

## CI/release context (observed, not fixed here)

For PR #513 commit `4fc5495`: [Command smoke](https://github.com/91cleaner/money-tracker/actions/runs/42014625444) succeeded; [map smoke](https://github.com/91cleaner/money-tracker/actions/runs/42014625438) failed on the old country-entry assertion in `tests/usa-map-smoke.test.cjs:68`; [security](https://github.com/91cleaner/money-tracker/actions/runs/42014625472) failed on the obsolete `href="intel-lab.html"` check. These last two are already addressed in **unmerged PR #403**, so this review does **not** duplicate that work.

The new malformed-row cache defect is distinct from #513's existing HTTP/JSON rejection and late-response tests. **Do not mark #513 production-verified or merge without UI owner review.** Repository and Pages are currently **public**, not private.


## Additional P1 security review — unsafe document-link schemes (2026-11-05 21:54 KST)

This is **separate from the malformed-row cache bug** above and from the SkySea DOM-injection review in #472. Checked the exact \`assets/mt-tabs.js\` source on #513 head \`4fc5495\`. **Source-level reproduction only; no live malicious record or browser exploit was observed.**

- The shared \`row(href, ...)\` template inserts \`esc(href)\` into \`<a href="...">\`. HTML escaping protects the attribute syntax but **does not validate the URL scheme**. The \`/^https?:/\` test only controls \`target\`/\`rel\`; it does not reject other schemes.
- \`mem\` passes \`x.doc\` directly when \`x.tk\` is absent; \`wh\` always passes \`x.u\` directly. Thus an untrusted/synthetic JSON item with \`doc: "javascript:alert(1)"\` or \`u: "javascript:alert(1)"\` generates an active \`href="javascript:alert(1)"\` anchor. A \`data:\` URL also survives. **No evidence that current production JSON contains such a value.**
- Isolated reproduction using the source's exact \`esc\` and \`row\` expressions produced:
  - Input \`javascript:alert(1)\` → \`<a class="tbRow" href="javascript:alert(1)">...\`
  - Input \`data:text/html,hello\` → \`<a class="tbRow" href="data:text/html,hello">...\`
  - A valid \`https://www.federalregister.gov/...\` remains a normal external link.
- This is a **potential click-triggered script-navigation/injection boundary**, not a claim of an observed exploit. Browser CSP, data provenance and user interaction affect exploitability.

**UI owner fix / acceptance criteria**

1. Before rendering any data-derived \`href\`, use a single URL policy: internal ticker navigation only from the app-generated \`go(ticker)\` route; external original-source links must parse as \`https:\` (prefer a documented official-source host allowlist). Reject \`javascript:\`, \`data:\`, \`vbscript:\`, protocol-relative and malformed URLs; don't replace them with misleading \`#\` links.
2. On rejected or missing \`doc\`/\`u\`, show a **non-clickable '원문 링크 확인 불가'** state, preserving the record's status rather than silently removing the entire row or fabricating a source. For accepted external links, keep \`rel="noopener noreferrer"\`.
3. Add deterministic \`tests/mt-tabs-load.test.cjs\` cases for both tabs with synthetic \`javascript:\`/\`data:\`/missing URLs and valid official HTTPS URLs. Assert that unsafe schemes never appear as clickable \`href\`; no \`0건\` fallback for malformed records. Test real Chromium click behavior and mobile before merge.
4. This review **does not edit UI code** because \`docs/AI-ROLES.md\` assigns it to Claude. The existing #513 Draft remains unmerged; require Claude/실장 review. Public repository, delayed House PTR, live executed trades **DISCONNECTED**, generative AI **DISCONNECTED**.


## Additional P1 mobile/tab navigation regression — "오늘" widget disappears after leaving tab (2026-11-05 22:55 KST)

**New finding, separate from the retry-cache and unsafe-link findings above.** Reproduced by executing the exact \`assets/mt-tabs.js\` from #513 head \`4fc5495\` (blob \`4e0b1a7\`) in a V8 mocked-DOM/fetch harness with an initially connected \`#mtToday\` node. This is **not** a real Chromium/iPhone or deployed Pages verification.

### Root cause

- On \`show('today')\`, \`P.replaceChildren(box)\` moves the sole \`#mtToday\` node into \`#tbPanel\`.
- On switching to another tab (\`mem\`, \`wh\`, \`rank\`, or \`find\`), \`P.innerHTML = h\` destroys that child and detaches \`#mtToday\` from the document. No persistent reference or parking host is kept.
- On returning to \`today\`, \`$('mtToday')\` returns \`null\`, so the tab renders the fallback \`오늘의 기록을 불러오는 중이에요.\` indefinitely rather than restoring the daily widget. A network success cannot repair the lost DOM node.

### Executed deterministic reproduction

| Action | Panel content | \`#mtToday\` connected? |
| --- | --- | --- |
| Boot with existing \`#mtToday\` | Original today widget | Yes |
| Click \`의원\` (valid empty \`trades: []\`) | \`최근 의원 주식 신고 0건\` | No |
| Click \`오늘\` again | \`오늘의 기록을 불러오는 중이에요.\` | No |

The same destructive assignment is shared by the other non-today tabs. This reproduces **a local DOM lifecycle defect**, not a claim about current production users. The mocked environment explicitly modeled DOM detachment on \`innerHTML\` replacement.

### Required UI-owner fix and acceptance gate

1. **Preserve the original \`#mtToday\` element and its state/listeners** when changing tabs. Keep a stable reference after the widget exists and park/reparent it safely outside the replaced panel (or use separate persistent tab panels). Do not recreate it as static HTML or merely replace the fallback text.
2. Add a regression test to \`tests/mt-tabs-load.test.cjs\`: boot with a populated \`#mtToday\`; navigate \`today → mem → today → wh → today → find → today\`; assert the **same node identity**, retained content and listeners, no permanent loading fallback, and no false \`0건\`.
3. Exercise the same sequence in real desktop Chromium and iPhone portrait/landscape. Confirm the fixed bottom tab panel remains usable, and verify the deployed Pages version only **after** merge and same-SHA release checks.
4. Keep #513 in Draft pending Claude/실장 UI review. No UI, tests, \`data/\`, collectors, or production code was changed by this review. House PTR is delayed disclosure; live executions and generative AI remain **DISCONNECTED**.


## Additional P1/P2 data-visibility regression — ranking tab stays blank after late daily summary (2026-11-06 00:55 KST)

**New, distinct issue verified against the exact `assets/mt-tabs.js` source at #513 head `4fc5495`.** This is an executed V8 mocked-DOM/async-fetch reproduction, not a live browser or production incident.

### Reproduction

The daily summary is fetched asynchronously in the separate `J('../data/us/daily/index.json').then(...).then(d => { D = d; ... })` chain. The `rank` branch of `show(id)` renders synchronously from `(D && D.snap) || {}` and assigns `P.innerHTML = h` **without a loading or unavailable state**. When the user opens `순위` before the daily summary resolves, `h` is an empty string. Once `D` arrives, only the hero text is updated; `show('rank')` is never re-invoked.

Executed scenario with the actual PR JavaScript, mocked document/tab buttons and a deferred HTTP-200 daily JSON:
1. Open `rank` while `data/us/daily/2026-11-05.json` is pending → `#tbPanel.innerHTML === ''`.
2. Resolve valid daily payload `{cards: [], snap: {'federal-awards.json': {NVDA: 1234567}}}`; flush microtasks → panel **still empty**, despite `D` being populated.
3. Click `rank` a second time → panel now displays `NVDA` and `$1.2M`.

**Impact:** A slow network/mobile session can silently show a blank ranking panel even though valid data arrived; the existing tab tests cover delayed PTR and White House requests, not this daily-summary/ranking race. A failed daily request likewise leaves an unexplained empty ranking rather than `자료를 불러오지 못했습니다`.

### UI-owner fix / acceptance tests

1. Track daily summary loading/error/ready separately from genuine empty ranking data. Show an accessible `순위 자료 불러오는 중` status while pending; show an unavailable/retry state on HTTP, JSON or schema failure, **never imply verified zero**.
2. On daily completion, update the ranking panel **only if `rank` is still the selected tab**. Preserve `showSeq`/active-tab guards so an older daily completion never overwrites a newer tab. Prefer a state-based render over an unconditional `show('rank')`.
3. Add deterministic `tests/mt-tabs-load.test.cjs` cases for delayed valid daily summary (renders without a second click), rejected daily summary (visible error), legitimate empty snapshot (explicit empty state), and switch `rank → mem` before daily resolution (no stale repaint). Verify in mobile portrait/landscape Chromium.
4. No UI/test/data/CI files were changed here under `docs/AI-ROLES.md`; Claude/실장 should implement in #513 or an explicitly owned follow-up. #513 remains Draft/unmerged; live trades and generative AI remain **DISCONNECTED**.
