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
