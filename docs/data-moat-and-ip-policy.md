# MONEY TRACKER — data moat and IP protection policy

Objective: preserve acquisition-ready proprietary value without misrepresenting public records as exclusive assets.

## Asset boundaries
**Public:** government bills, public disclosures, publicly licensed geographic facts, citations, and free-map outputs.
**Proprietary (server-only):** entity-resolution mappings with human review, normalized event graph, source reconciliation, evidence confidence scoring, proprietary heuristics/weights, private annotations, user watchlists, operational monitoring, paid entitlements, and internal exports.

Never ship secrets or proprietary raw datasets in GitHub Pages, bundled JS, source maps, public API responses, or public repository history. Treat existing public commits as disclosed; deleting files later does not undo prior exposure. Rotate exposed credentials.

## Data lineage
Every relationship must record source URL, source agency, retrieved_at, published_at (when known), jurisdiction, source record ID, parser version, review status, confidence rationale, and last_verified_at. Mark hypotheses separately from facts; never invent missing trades or claim correlation proves misconduct.

## Legal and commercial readiness
Record dataset licenses, redistribution restrictions, vendor contracts, third-party image credits, contributor agreements, and ownership of original code. Audit external dependencies. Keep changelogs, backups, retention/deletion rules, access logs, reproducible ingestion, incident response and documented export formats.

### P1 — market-price redistribution and acquisition gate (2026-10-30)
The merged [price integrity fix #375](https://github.com/91cleaner/money-tracker/pull/375) and [source-label correction #376](https://github.com/91cleaner/money-tracker/pull/376) address ticker reuse and identify **Massive (formerly Polygon) as a private price-data vendor, not an official government source**. They do **not** establish permission to publish, sublicense or transfer vendor price histories. A `source` or `as_of` field in JSON is provenance, **not a license**.

**Before releasing or marketing any public or paid price feature, the operator must:**
1. Identify every market-price supplier and all derived artifacts, including `data/us/prices/*.json`, `data/us/prices/summary.json`, `data/search-index.json`, embedded Worker snapshots, charts, cards and downloadable exports. Distinguish official filing facts from licensed market data.
2. Record the **actual governing plan/agreement and its effective date**, with documented permission or restrictions for public display, historical OHLC redistribution, adjusted prices, caching/retention, derived metrics, API access, commercial resale, sublicense and change of control/asset sale. Verify each intended use; do not infer rights from API access or attribution.
3. For each output, document supplier, source timestamp, adjustment basis, ticker/security identity and corporate-action discontinuities. A renamed/reused ticker must not inherit the prior security's history. A missing or unverifiable baseline must display **unavailable**, never a fabricated return or a different period labeled YTD.
4. If the right to publish a price artifact is **unknown or denied**, do not add it to a public Pages build or public API. Keep only permitted metadata/source links or a clearly marked unavailable state until permission is documented. This is a release requirement, **not a claim that the current deployment has been remediated**.
5. Record the evidence in a restricted operator register (vendor contract link/reference, owner, date checked, approved uses, restrictions, expiry/renewal and next review). **Do not commit confidential contracts, account IDs, API keys or commercial terms** to the public repository.
6. Re-check the live public artifact and direct URLs **after** a deployment, including unauthenticated access to `/money-tracker/data/us/prices/summary.json` and a sample `/money-tracker/data/us/prices/{ticker}.json`. A passing CI job or an authenticated Worker route does not prove GitHub Pages content is private.

**Release evidence / acceptance:** retain a dated inventory of all reachable price artifacts; a permission decision for every supplier and intended use; a sample verified ticker-reuse/corporate-action case; an unavailable-state screenshot for an unsupported price; and live direct-URL checks. If any evidence is missing, mark **market-price redistribution: NOT VERIFIED** and **acquisition transfer rights: NOT VERIFIED**. This is a manual release gate; no automated license checker or legal approval is implemented here.

## Architecture
Public UI -> allowlisted public API; protected backend -> private DB/graph and algorithms. Owner/admin actions require independent authorization; future subscribers get tier-limited server-side access. Secrets must be stored as runtime secrets, not git files.

## Release gate
- [ ] Scan git history and deployed assets for keys and private data
- [ ] Inventory all existing APIs and static JSON; classify public/private
- [ ] Ensure private data and algorithms are never exposed by direct URL
- [ ] Validate anonymous and unauthorized access denial
- [ ] Verify provenance and license metadata for published analyses
- [ ] Verify vendor price-data redistribution, public display and acquisition-transfer rights before release
- [ ] Document deployment and test evidence before marking protected

Status: governance specification committed; no security audit, vendor-rights determination, production migration or automatic enforcement implied.
