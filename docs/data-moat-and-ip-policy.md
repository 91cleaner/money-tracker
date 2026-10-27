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

## Architecture
Public UI -> allowlisted public API; protected backend -> private DB/graph and algorithms. Owner/admin actions require independent authorization; future subscribers get tier-limited server-side access. Secrets must be stored as runtime secrets, not git files.

## Release gate
- [ ] Scan git history and deployed assets for keys and private data
- [ ] Inventory all existing APIs and static JSON; classify public/private
- [ ] Ensure private data and algorithms are never exposed by direct URL
- [ ] Validate anonymous and unauthorized access denial
- [ ] Verify provenance and license metadata for published analyses
- [ ] Document deployment and test evidence before marking protected

Status: governance specification committed; no security audit or migration implied.
