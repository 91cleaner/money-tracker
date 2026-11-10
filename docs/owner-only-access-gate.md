# Owner-only US command center: deployment gate

**Status: NOT PROTECTED until a server-side access policy is deployed and tested.**

The public GitHub Pages URL and its static assets are accessible to anyone. Hiding the USA link or checking a password in browser JavaScript does **not** secure it. Making the repository private does not automatically revoke an already published Pages URL.

## Required rollout
1. Keep the public landing page on GitHub Pages; do not put privileged data, tokens, or owner-only HTML/JS there.
2. Serve the US command center from a separate Cloudflare-protected hostname, e.g. `us.example.com`, with Cloudflare Access application policy allowing **only the owner's verified identity**. Configure identity-provider login with MFA and a short session lifetime.
3. Protect *all* US HTML, JS, JSON, images, and API routes behind the same server-side boundary. Reject requests lacking a valid Access JWT; verify JWT signature, issuer, audience and expiration in the Worker, not just the presence of headers.
4. After deployment, change the landing page's US link to the protected hostname. Do not remove public assets until the replacement works.
5. Validate using an incognito session (403 or login redirect for every direct route), then an allowed device, then a different account, and after logout/session expiry. Check the GitHub Pages URL still cannot serve private material.
6. Check GitHub Actions deployment logs and compare deployed content version to commit SHA.

## Blockers
- Cloudflare account/domain/Access configuration and verified owner identity are required.
- Repository visibility is currently public. Changing visibility requires explicit owner confirmation and is separate from website access control.

## Non-negotiable
Never label the US room 'private' or 'owner-only' until unauthorized direct URL and API requests are actually denied.

## 2026-11-09: content studio is **not** owner-only by hiding its link

[Security review #543](https://github.com/91cleaner/money-tracker/issues/543) identifies a separate public-artifact mismatch:

- Root `studio.html` is described in source as `청소부 전용` and uses `noindex,nofollow`, but these do **not** authenticate a visitor.
- `scripts/prepare-public-pages.py` copies every eligible root `.html` file into `.public-pages`; `studio.html` is not excluded by the builder or artifact checker. This means the **build path includes the studio**, even though it is not in the site navigation.
- The studio appears to generate X drafts/images from public data. **No secret, private API operation, or unauthorized live request was demonstrated** in this review. Live HTTP behavior still requires an independent anonymous check.

**Owner decision required before changing production behavior:**

1. If studio is private: move its hosting behind verified server-side identity, exclude `studio.html` from public Pages packaging, and add a negative artifact test (`test ! -e .public-pages/studio.html`). Confirm direct anonymous Pages URL returns 404, protected URL challenges login, and old service-worker/CDN caches do not retain the page.
2. If studio is public: explicitly describe it as a public draft helper and remove wording that could imply access control. `robots` metadata and an unlinked URL are not security.
3. Keep the existing public Korea/USA records accessible as designed; do not infer a credential leak from a public page alone. UI/CI/data owners must implement any behavior changes under `docs/AI-ROLES.md`, with owner approval before merge.

**Verification:** source file and packaging path reviewed at main `f93af017`. This is a documentation/owner handoff, **not** a live authorization test, a packaging fix, or a production deployment.
