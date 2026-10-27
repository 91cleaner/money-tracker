# MONEY TRACKER subscription architecture (proposal, not launched)

## Plans (illustrative USD monthly prices)
- FREE $0: public world map, public legislation and disclosure source links.
- PRO $12: saved watchlists, evidence-backed research trails, alerts, extended filters.
- ELITE $29: cross-country research workspace, advanced exports and monitoring.

These are proposals, not active prices. Public records remain publicly accessible; subscriptions charge for added tools, computation and convenience, not for falsely claiming ownership of public records.

## Server-enforced entitlements
- Billing provider checkout -> signed webhook -> server verifies signature, timestamp and event id -> durable subscription table.
- Never unlock paid features based on query params, localStorage, browser payment-success screen, or frontend-only flags.
- Account/session identity -> server-side entitlement lookup -> allowlisted paid API response. Deny by default.
- Support trial, cancellation, payment failure, refund, chargeback, grace period and idempotent out-of-order webhook events.
- Keep billing secrets, webhook signing secrets, private reports and payment identifiers out of GitHub Pages and client JS.
- Use hosted checkout; do not collect raw card numbers.
- Enforce per-tier quotas and rate limits on the server; audit privileged operations without logging secrets.
- Verify applicable consumer protection, taxes, refunds, privacy policy, financial-data licenses and investment-advice disclosures before charging.
- Public disclosures are evidence of reported transactions, not proof of actual execution or wrongdoing; never fabricate missing trades.

## Acceptance tests before monetization
1. Anonymous visitor sees public map and public records.
2. Free account cannot call PRO/ELITE endpoints directly.
3. PRO cannot call ELITE endpoints directly.
4. Verified paid subscription enables only its entitled tier.
5. Cancellation, failed payment, chargeback and webhook replay cannot retain or incorrectly grant access.
6. Admin account is authorized independently from subscription tier.
7. Live checkout and webhook end-to-end tests pass in sandbox and production configurations.

Status: specification only. No billing provider connected, no checkout enabled, no customer charged.
