# Pages exposure incident — operator runbook (2026-10-29 KST)

**Status: OPEN / NOT REMEDIATED.** This document is a response procedure, not a security fix. Do not label the public site or the repository private until the checks below pass.

## Evidence and scope

- [Live Pages restricted-file audit, failed 2026-10-28 23:58 KST](https://github.com/91cleaner/money-tracker/actions/runs/40711160284): regression tests passed, but **10 of 11** probed paths returned HTTP 200. The probe checked HTTP status only; it did **not** inspect response bodies, credentials, or whether those paths contained secrets.
- Exposed-path categories: PTR research candidates and crosschecks, Worker/server source, deployment configuration, collection code, handoff and role documents. The workflow file path returned 404. See the linked run for exact paths.
- [Latest observed legacy Pages build, 2026-10-29 00:36 KST](https://github.com/91cleaner/money-tracker/actions/runs/40717589670) succeeded for `main`. A green legacy build **does not** mean the curated `.public-pages` artifact was published.
- [PR #206](https://github.com/91cleaner/money-tracker/pull/206) checks whether Pages uses Actions; [PR #213](https://github.com/91cleaner/money-tracker/pull/213) audits live restricted paths. Both were open when this runbook was written.
- Repository metadata checked 2026-10-29 00:59 KST: visibility **public**. Public GitHub source is independently accessible even after fixing Pages. Do not treat `robots.txt`, `noindex`, hidden links, or client-side passwords as access controls.

## Immediate operator actions (GitHub settings; cannot be done by a code-only PR)

1. Open [Settings → Pages](https://github.com/91cleaner/money-tracker/settings/pages). Under **Build and deployment**, change **Source** from branch/legacy publishing to **GitHub Actions** and save. This must be checked in the actual repository settings; editing `deploy-pages.yml` alone is insufficient.
2. Confirm `.github/workflows/deploy-pages.yml` completes using `scripts/prepare-public-pages.py` and `scripts/check-pages-artifact.py`, publishing **only** `.public-pages`. Do not deploy the entire repository or the `main` root.
3. After the deployment and CDN propagation, re-run the checks from PR #213 (or run `python3 scripts/check_live_pages_exposure.py` from its branch). **Every restricted path must return 404 or 410**, while the public landing page and required assets return 200. If the check fails or is inconclusive, keep the incident open. Also verify no new dynamic `pages build and deployment` jobs are racing with Actions deployments.
4. Review GitHub repository visibility in [Settings → General](https://github.com/91cleaner/money-tracker/settings). If the intention is to keep source and internal files private, migrate them to a private repository or private backend and review Pages availability/URL implications before changing visibility. **Changing Pages Source alone cannot hide files in a public repository.** Publicly accessible files should be considered previously disclosed.
5. Review exposed configuration and source *privately* for hardcoded tokens, passwords, API keys, credentials, private datasets or personal information. If any credential was exposed, revoke/rotate it in its provider and GitHub secrets; inspect access logs where available. Do not paste credentials or file contents into issues, logs or chat. The HTTP audit **does not prove that credentials were exposed**.
6. Keep public, source-linked House PTR disclosure records separate from **unverified candidates**, crosschecks and operator-only notes. Any intentionally published data must be approved and clearly marked as disclosure data, not verified executions, insider misconduct or live trades.

## Acceptance criteria

- [ ] Pages **Source = GitHub Actions**, confirmed in Settings or by an authenticated API check (`build_type=workflow`).
- [ ] Curated Actions Pages deployment succeeds; no legacy branch publisher continues.
- [ ] Live restricted-path audit passes after propagation; public entry points still work.
- [ ] Repository/source privacy decision implemented separately; no assumption that private repository implies private Pages.
- [ ] Credential exposure assessment completed; any exposed credentials revoked.
- [ ] PR #206 and PR #213 reviewed/merged as appropriate **after owner approval** and their checks rerun.
- [ ] AI analysis and real-time execution feeds remain labeled **not connected** until backed by tested integrations.

**Release decision:** Do not claim this incident resolved solely because a GitHub Actions build is green. Verify the live URLs and the independent public-repository exposure.

Related: [public UI/private data policy](public-ui-private-data-policy.md) · [US access-control requirement](US_PRIVATE_ACCESS.md).
