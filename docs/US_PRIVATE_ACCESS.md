# MONEY TRACKER: US command access-control requirement

Status: **NOT SECURE / NOT ENFORCED** as of 2026-10-27.

## Required policy

- Public: entry screen (`index.html`), Korean command (`national.html`), their specifically public assets.
- Private: American command (`usa-command.html`), global research engine, privileged APIs, related assets and admin routes.
- Allowed principals: one operator, on the operator's Windows PC and personal phone. Identity authentication is mandatory; optionally require enrolled device posture. Do not use IP geoblocking alone (mobile IP changes; VPNs evade region blocks).
- Deny all anonymous users, including anyone knowing the direct URL or requesting static JavaScript, JSON, service workers, or source maps.
- Neither a JavaScript PIN prompt nor hidden entry button is a security boundary.

## Current blocking issue

The site is served from `https://91cleaner.github.io/money-tracker/`. GitHub Pages is publicly reachable even if its source repository is private, except for enterprise-specific private Pages hosting. The US HTML and script files are presently public by direct URL. **Do not claim 'owner-only' until server-side authorization is verified.**

## Recommended protected deployment

1. Create a private deployment target for the US command using Cloudflare Pages with Cloudflare Access or an equivalent access-controlled server. The GitHub repository can remain private.
2. Configure the entire US site hostname to require an identity policy permitting ONLY the operator's verified email (OTP or passkey backed identity); enable 2FA and short sessions, and optionally require known devices.
3. Build/deploy only the private US command and dependencies to that target. Do not expose those files through public GitHub Pages, including `usa-command.html`, `us.html`, `world-intelligence/`, JavaScript query engines, JSON feeds or source maps. Public Pages deployment should use an explicit allowlist of public files. Do not point a Cloudflare Access-protected custom URL at a still-public GitHub Pages upstream route.
4. Change the US entry link on the public entrance to the protected hostname. Korean entry remains public. Keep a user-visible "관리자 전용" label, but rely on server-side authentication rather than the label.
5. Verify unauthenticated access to **every** US route returns 401/403 or an authentication challenge. Verify authenticated access works from the operator's PC and phone; verify a third-party browser cannot retrieve HTML, JS, JSON, or API responses. Verify legacy GitHub Pages US paths return 404.
6. If storing market-data keys or AI credentials, keep them server-side and never bundle them into public JavaScript.

## Deployment gate

US_PRIVATE_ENFORCED = false
Do not mark this true without observing the access tests above.

Official reference: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
