# Public UI / protected data policy

> **Release gate (2026-10-31): NOT ENFORCED for the U.S. command room.** The GitHub repository is currently `public` and GitHub Pages is public. This document is a policy, **not** evidence that a protected deployment, Cloudflare authentication, or a private repository is in place.

## Distinguish public records from the private command room

- **Approved public material:** Korean landing and public views, official legislation citations, and deliberately released **sanitized** U.S. House PTR disclosure summaries. The 2026-10-28 decision to publish U.S. lawmakers' reported trades permits appropriately sourced public **disclosure records**, not unrestricted release of all internal U.S. datasets or the operator's research room. House PTR is delayed self-reported disclosure, **not** a live executed-trade feed.
- **Owner-only target:** the U.S./world command-room experience, private research and annotations, administrative functions, privileged APIs, credentials, and non-public source datasets. Protect the entire hostname or route tree and all required HTML/JS/JSON/assets server-side. Public map animation or an OAuth login button does not provide this protection.
- **Current mismatch:** `index.html` and `us.html` redirect to `world-intelligence/`; `scripts/prepare-public-pages.py` explicitly includes `world-intelligence` and requires `usa-command.html`. Until these public paths are removed/isolated and unauthorized requests are actually denied, **do not describe the U.S. command room as private**. Coordinate UI/deployment changes with Claude; do not silently break the public entry point.
- **Source-code boundary:** a private Cloudflare Worker does **not** hide source committed to a `public` GitHub repository. Changing repository visibility is a separate owner/admin action, and making the repository private does not automatically secure already-published Pages files or caches.

## Security and data boundary

- Public GitHub Pages may contain only explicitly approved, non-secret static code and datasets. Never commit API keys, owner identifiers, private reports, internal annotations, private raw data, or privileged source to the public repository.
- Public House PTR records must carry verified official House Clerk links, transaction date, **filing date**, amount **range**, collection/verification status, and a neutral disclaimer. Missing/failed records are not proof of no trading. Do not publish unverified machine-extraction candidates as confirmed transactions.
- Public endpoints must use explicit field allowlists; do not forward database rows or third-party API responses wholesale. Keep non-public records in an authenticated server-side store (e.g. private Cloudflare D1/R2 bindings).
- Admin writes/exports and private reads must validate a server-side identity/session or cryptographically verified JWT (signature, issuer, audience, expiration). Return 401/403 before accessing private data. Client flags, localStorage, hidden links, JavaScript PINs, CORS, or IP geoblocking alone are not authentication.
- Rate-limit sensitive routes; redact credentials and private information from logs. Confirm third-party market-data redistribution and commercial rights before release.
- **Connection status:** generative AI analysis **NOT CONNECTED / not live-verified**; real-time executed-trade feed **NOT CONNECTED**. A working map or scheduled collector is not evidence of either.

## Required release checks — separate CI from production

1. **Classify the artifact:** enumerate every public `index.html` / `us.html` redirect, `world-intelligence/`, `usa-command.html`, JS, JSON, service worker, source map, and legacy URL. Verify the public build includes only approved public files. Inspect both the default **pages build and deployment** path and `deploy-pages.yml`'s `prepare-public-pages.py` path; a successful default Pages build does not prove the allowlist was applied.
2. **Anonymous direct URL test:** after cutover, all owner-only static paths must return 404 or an authentication challenge; protected API requests must return 401/403 without private payloads. Repeat for cacheable/legacy paths and a fresh unauthenticated browser. Public disclosure summaries may remain public only if separately approved and source-verified.
3. **Authorized and denied identities:** the operator's PC and phone must succeed after login; another account, expired session, and logged-out requests must fail. Check server-side session/JWT verification, not only the appearance of a login page.
4. **Source and license check:** verify that neither the public GitHub repository nor deployed artifacts contain secrets or private datasets. Confirm official source links, reporting vs transaction dates, freshness/error state, and redistribution permissions.
5. **Deployment proof:** record the exact deployed commit, Pages Source setting, public URL HTTP results, and Worker deployment/health/auth results **separately**. Passing GitHub Actions or publishing a Worker file is not proof of operational security.

**Blocking status:** repository visibility remains `public`; owner-only U.S. route isolation, authenticated production access, actual Pages artifact exposure, live AI, and live trade-feed connectivity have **not been independently verified**. Do not mark any of these complete until the corresponding checks pass. See [US_PRIVATE_ACCESS.md](US_PRIVATE_ACCESS.md) and [owner-only-access-gate.md](owner-only-access-gate.md).
