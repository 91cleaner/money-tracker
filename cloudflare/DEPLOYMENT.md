# MONEY TRACKER Cloudflare deployment

Worker: `red-meadow-fcc6`
Production branch: `main`
Deploy command: `npx wrangler deploy`
Wrangler config: `/wrangler.jsonc`
Entry point: `/cloudflare/admin-worker.js`

Secrets are configured in Cloudflare only and must never be committed.

This commit initializes the GitHub-connected Cloudflare build pipeline. Verify the build result in Cloudflare Deployments before relying on the admin site.
