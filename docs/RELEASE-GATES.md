# Release decision gates — MONEY TRACKER

> Operational acceptance checklist, not a claim that these gates are implemented in CI. Last reviewed: 2026-11-04 (KST). Applies to the public GitHub Pages build and the separately deployed authenticated Cloudflare Worker.

## Non-negotiable release rule

A green **Deploy MONEY TRACKER Pages** workflow alone is **not** evidence that the research, privacy, mobile, and data checks passed. As of this review, `.github/workflows/deploy-pages.yml` is independently triggered on pushes to `main`; the security/research workflow is not a required dependency. Do not label a release *verified* until the **same commit SHA** satisfies all gates below. The owner must approve merges under `docs/AI-ROLES.md`.

| Gate | Minimum evidence | Failure state |
| --- | --- | --- |
| Identity | Record source commit SHA, Pages deployment run URL, artifact SHA/digest, and published URL. Compare published critical files with the **artifact from that run** (not just HTML text markers). | **NOT VERIFIED** if SHA/artifact parity is unknown |
| Public exposure | Run `python3 scripts/prepare-public-pages.py` and `python3 scripts/check-pages-artifact.py`. Inspect the public output for private Worker code, credentials, unpublished trade ledgers, and newly added `data/` files; an allowlist is safer than an extension-only filter. | **BLOCK** on any unexpected exposure |
| Syntax/security | Run `node --test worker/private-api.test.mjs` and `python3 -m unittest discover -s tests`; require the security/research GitHub Actions job on the candidate SHA to pass. | **BLOCK** on failure or skipped required checks |
| Map/navigation | Run `python3 scripts/check_world_intelligence.py`. In a real browser verify country entry, the flat map, visible search input in KO and EN, question → candidates → selection → map fly-to, back/close, and a second query. | **NOT VERIFIED** if only static markers pass |
| Mobile | In an iPhone-size landscape viewport verify keyboard focus does not zoom or cover the question field, map remains pan/zoomable, close/back remain visible, options can reopen, and no panels obscure the entire map. Repeat KO/EN. | **NOT VERIFIED** without browser evidence |
| Public trade evidence | Validate JSON schema, impossible/future dates, empty/malformed response handling, original House Clerk PDF URLs, and date semantics (transaction date vs notice date vs filing date). A successful HTTP 200 with malformed JSON is **ERROR**, never zero trades. | **BLOCK** if data errors are presented as verified 0 |
| Bill → member → company | Show the official bill identifier and status, separately sourced member and disclosed trade, and company identifier. A shared date or sector is **not** evidence of causation or misconduct. | **UNVERIFIED** when any link lacks a source |
| Live integrations | Label live executed-trade feed and generative AI **DISCONNECTED** unless independently tested. A historical PTR disclosure is not a live execution feed. Satellite basemaps and drawn route arcs are not live intelligence. | **BLOCK** on misleading connected/live claims |
| Post-deploy | Recheck the published country entry, world map, US disclosure view, source links and public JSON against the **same deployed SHA**; retain run links/screenshots. | **NOT VERIFIED** if production was not tested |

## Reproducible local preflight on the candidate checkout

```sh
node --test worker/private-api.test.mjs
python3 -m unittest discover -s tests
python3 scripts/check_world_intelligence.py
python3 scripts/prepare-public-pages.py
python3 scripts/check-pages-artifact.py
```

These commands exist on `main` as of 2026-11-04. They do **not** replace real browser tests, a public-file allowlist audit, or post-deploy parity checks. Do not run the artifact builder on a working tree with uncommitted data changes and then attribute the result to a different SHA.

## Outstanding integration, not yet a release claim

- [PR #403](https://github.com/91cleaner/money-tracker/pull/403): shared Pages entry checks and CI repair. Its proposed `scripts/check-pages-entry.py` is **not on main** as of this review. Rebase and resolve conflicts before any merge; then rerun all checks.
- [PR #458](https://github.com/91cleaner/money-tracker/pull/458): public JSON/deployed parity work. Proposed scripts are **not on main** as of this review. Verify publication SHA and JSON content, not just HTTP success.
- [PR #412](https://github.com/91cleaner/money-tracker/pull/412): House PTR date quarantine. Verify the corrected notice/filing-date semantics before merging.
- [PR #479](https://github.com/91cleaner/money-tracker/pull/479): US disclosure view syntax repair. Recheck malformed JSON, zero vs error, and iPhone behavior after merge.
- [PR #495](https://github.com/91cleaner/money-tracker/pull/495): provenance review for new history layers. Replace secondary references with authoritative evidence before claiming verification.

## Reporting vocabulary

- **PASS**: tested on named SHA, evidence URL/log retained.
- **FAIL**: test executed and failed.
- **NOT VERIFIED**: test not executed or no matching evidence.
- **DISCONNECTED**: live data/AI integration absent or not proven operational.
- **0 RECORDS**: only after a successful request and schema-valid, source-complete response. Never substitute for fetch failure, missing file, or parser error.

**Security:** This repository and GitHub Pages are currently **public**. A private URL, `noindex`, or hidden UI does not provide access control. Cloudflare Worker authentication is a separate release/deployment boundary and must be tested independently. Do not publish secrets, tokens, or private raw datasets in PR logs or artifacts.
