# Public UI / protected data policy

MONEY TRACKER's Korea and USA maps, public legislative records, and public disclosure citations are intentionally public. **Do not require login for public pages.**

## Security boundary
- Public GitHub Pages may contain only non-secret static code and explicitly public datasets.
- Never commit credentials, API tokens, owner identifiers, private reports, internal annotations, or private raw data. A private GitHub repository alone does not make Pages assets private.
- Private records must live in a server-side store (e.g. Cloudflare D1/R2 with private bindings) and be accessed only through an authenticated backend.
- Public endpoints must explicitly allowlist public fields. Never forward database rows or third-party API responses wholesale.
- Admin create/update/delete/export and private-data reads must validate a server-side identity/session or cryptographically verified JWT (issuer, audience, signature, expiration) and return 401/403 before data access. Do not trust client flags, localStorage or a hardcoded frontend password.
- Restrict CORS to approved origins where relevant; CORS is not authentication. Rate-limit sensitive routes; redact tokens and personal data from logs.
- Public financial disclosure records are not proof of illicit conduct. Do not infer missing trades.

## Release acceptance checks
1. Anonymous visitor can open both country maps and view public records.
2. Anonymous requests to private API paths and admin mutation routes receive 401/403 with no data leakage.
3. Signed-in owner can access private functions; another account cannot.
4. Direct static URLs contain no secret or privileged records.
5. Deployment logs and actual public URL are checked separately.

**Current status:** policy only. This file does not configure backend authentication, rotate any secrets, or prove the live deployment is secure.
