# World command-room source-link failure: review and acceptance test

Reviewed: 2026-11-08 (KST). Scope: source-link rendering in `world-intelligence/index.html` on `main` and draft [#525](https://github.com/91cleaner/money-tracker/pull/525), stacked on [#524](https://github.com/91cleaner/money-tracker/pull/524). This is a **read-only code review**, not a UI fix or release approval.

## P1 — malformed source URL aborts an otherwise usable answer

In `mtIntentCard`, the `a.src` loop checks only `/^https:/`, then invokes `new URL(u).hostname` **inside the surrounding card-level try/catch**. A string such as `https:` passes the regular expression but throws `TypeError` in the URL constructor. The catch returns `false`, so a malformed *single citation* can discard the entire answer and trigger a fallback despite valid answer text. This is present on `main`; draft #525 does not introduce or fix it.

Reproduction with Node 22:

```js
const u = 'https:';
console.log(/^https:/.test(u)); // true
new URL(u).hostname;             // TypeError: Invalid URL
```

**Owner action (Claude UI / 실장 data):** Parse each candidate source URL in its **own** try/catch, require `protocol === 'https:'`, nonempty `hostname`, and an approved original-official-source host/path appropriate to that record. Skip invalid links without dropping valid answer content; render a clearly labeled **source unavailable / verification pending** state when no approved original source remains. Do not silently relabel a third-party link as an official citation. Avoid storing or echoing malformed URL strings in UI/error logs.

**Regression acceptance:** An answer fixture with valid text and `src: ['https:', 'https://[', 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20033889.pdf']` renders its text and only the validated official link; an all-invalid source list renders the text with a missing-source warning rather than a false verified badge. Test also a network/JSON failure separately so **unavailable** is not displayed as **zero records**.

## Integration / release status

- Draft #525 adds A→B response-order tests and isolated late-render slots, but its tests do not exercise malformed citation links. It is stacked on #524; neither should be merged by this review.
- At review time, the GitHub workflow runs for #525 head `ba88b73be66522367083e18d7e759ef3caff49e6` reported world-intelligence and command-room checks successful, map-smoke and security/research checks failed. These are **not** a production release pass.
- Source records are delayed, self-reported House PTR entries, not confirmed executions. Generative AI and live executed-trade feeds are **DISCONNECTED**. The repository and GitHub Pages are **public**.
- After the owner fixes the UI, require a test of the actual answer handler, same-head CI, deployed Pages smoke, and iPhone landscape verification. Keep `data/`, collectors, and Claude-owned screen files out of this review PR.

Reference: [#394](https://github.com/91cleaner/money-tracker/issues/394) (question reliability); [#527](https://github.com/91cleaner/money-tracker/issues/527) (unresolved PTR chronology).
