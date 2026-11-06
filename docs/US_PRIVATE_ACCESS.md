# MONEY TRACKER — US access boundary and release gate

**Reviewed: 2026-11-03 KST. Enforcement status: NOT VERIFIED / NOT PRIVATE.**

GitHub reports `91cleaner/money-tracker` visibility as **public**. Its GitHub Pages content is publicly reachable; a hidden navigation link, `noindex`, a client-side password, a GitHub OAuth button, or an IP allowlist in browser code cannot make those files private. This document is an access **requirement**, not evidence of deployed protection.

## Resolve the two different meanings of “US private”

The product has two separate surfaces. Do not use the word “private” for both:

| Surface | Current classification / requirement | What to verify |
| --- | --- | --- |
| Public entry, Korean pages and public-source research (including any US/World/SkySea files still on GitHub Pages) | **PUBLIC**. This matches `docs/public-ui-private-data-policy.md`; these files must contain no privileged records or secrets. | Anonymous direct URL access is expected; review the public artifact allowlist and data fields. |
| Owner-only US **admin/command** functions, private research notes, credentials and privileged API responses | **PROTECTED TARGET, NOT YET CERTIFIED**. The owner wants access from their Windows PC and phone only. | Every private HTML, JS, JSON, API and export route must be denied before authentication and authorized on the server after authentication. |

**Unresolved product decision:** If *all* US research pages, not only admin/privileged functions, must be owner-only, they must be removed from the public Pages artifact **and** served behind the protected hostname. Until that migration is completed and tested, the public US pages remain public regardless of the intended label. Do not silently treat the public research surface as protected.

`docs/owner-only-access-gate.md` describes the desired protected rollout; `docs/public-ui-private-data-policy.md` describes what may remain public. The older blanket “US HTML is private” statement is a **target**, not a statement about current deployment.

## Owner-only implementation requirements (deployment owner)

1. Deploy the privileged command surface to a separate authenticated host (for example, Cloudflare Access + Worker). Permit only the owner's verified identity; use MFA, short sessions and optionally enrolled-device posture. Identity alone is **not** proof that access is limited to exactly two devices.
2. Apply the same server-side policy to **all** protected HTML, JS, JSON, API, image, source-map, service-worker and export paths. Validate the Access JWT's signature, issuer, audience and expiration server-side; reject missing or invalid credentials before reading private data. Never trust a browser flag or CORS as authentication.
3. Keep privileged data in a server-side store. Explicitly allowlist public fields. Never ship private data, API keys or owner annotations in GitHub commits, Pages artifacts, JS bundles, build logs or public snapshots. Changing repository visibility later does **not** retract already published Pages content or commit history.
4. Decide and document whether the public US research UI remains public. If it must be private, remove *every* corresponding public Pages route and dependency, not only the landing-page link; point the US entry at the protected hostname **only after** the new deployment works.
5. Verify GitHub Actions success, the exact deployed commit/artifact, and the real production URLs **separately**. A green build or a working OAuth login is not a verified access boundary.

## Mandatory release checks (record HTTP status and final URL)

- Anonymous/incognito: direct protected page, static JS, JSON, API, export and guessed deep links must return 401/403 or an Access login challenge **without privileged bytes**.
- Allowed owner: Windows browser and phone can authenticate, open the command room and load protected API data.
- Unauthorized identity: another account is denied on every protected path, including direct file URLs.
- Expired/revoked session: private content cannot be fetched again; test logout and token expiry.
- Public GitHub Pages: inspect direct legacy US routes and source artifacts. If all-US-private was chosen, these routes must no longer expose the private app (404 or a non-sensitive public stub). If public research was chosen, its data must be explicitly non-secret and its status must be labeled **public**.
- Verify that the public repo and prior Git history do not contain credentials or private assets. Any exposed secret requires rotation; simply deleting a file in a later commit is insufficient.

## Reporting contract

Until every applicable negative and positive test passes against the **actual deployed hostname**, report:
- Repository: **PUBLIC**.
- Owner-only US command: **NOT VERIFIED** (do not claim device-only enforcement).
- Public House PTR disclosures: **delayed filings, not real-time executed-trade data**.
- Generative AI analysis: **NOT CONNECTED** unless a production backend is independently verified.

**No authentication, hosting, repository-visibility, Pages or Cloudflare settings were changed by this documentation update.** Owner approval is required before merging or changing access behavior.
