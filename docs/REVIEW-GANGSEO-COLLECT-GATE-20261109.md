# P1 review: scheduled contract collection blocked by Gangseo region assertion

Reviewed: 2026-11-09 KST. Base: `main` at `2826eba49486324ed9870ec28da13b9473ab203a`.
Scope: **operational triage and acceptance criteria only**, per [AI-ROLES.md](AI-ROLES.md). GPT does not edit `data/`, collectors, UI, tests, or workflow YAML.

## Confirmed failing production run

- [Scheduled contract collection run #42517631454](https://github.com/91cleaner/money-tracker/actions/runs/42517631454) on `main` (`28a2586ecd0d662486d1cd2e2c1d19858f414eb6`) **failed** in `데이터 검증 게이트`; the subsequent `바뀐 데이터 저장` step was **skipped**.
- The failing assertion is `tests/test_gangseo_flow.py::GangseoFlowTest::test_main_contract_regions`, line 33. `g.build()` produced `by["전북 전주시 덕진구"]["amount"] == 130192831110` while the test expected `round(127283676000 * .51) == 64914674760`. 144 tests ran; 1 failed. This is **not** a successful collection/publish run.
- The committed `data/focus/gangseo-sincheongsa.json` on reviewed `main` still reports `64914674760` for that region. Thus the **recomputed value during collection** and the **checked-in snapshot** disagree; the log does not establish which is correct. The ~2x difference warrants contract-ID and amount-basis reconciliation, **not** an automatic adjustment of the expected constant.
- `.github/workflows/collect.yml` runs the full test suite after collection and before committing. The gate prevented a questionable snapshot from being published, which is the correct fail-closed behavior.

## Why this is distinct from existing work

- [#527](https://github.com/91cleaner/money-tracker/issues/527) concerns US House PTR chronology, not Korean contract-region aggregation.
- [#537](https://github.com/91cleaner/money-tracker/pull/537) concerns false-green US workflow push retries; this run failed **before** its push step, with a clear red status.
- No matching open issue/PR for `test_main_contract_regions` was returned by GitHub issue/PR search during review.

## Owner-side diagnosis (read-only)

Run in a clean checkout at the **failed run SHA** and again at the latest `main`, with the same collected inputs as the failed run when available:

```bash
python -m unittest discover -s tests -p 'test_gangseo_flow.py' -v
python - <<'PY'
from scripts import build_gangseo_flow as g
d = g.build()  # in-memory only; unlike g.main(), does not write data/focus
print('contracts', d['contracts'], 'total', d['total'], 'mapped', d['mapped'])
for f in d['flows']:
    if f['region'] in ('전북 전주시 덕진구', '서울 종로구'):
        print(f['region'], f['amount'])
PY
```

Compare the deduplicated contracts feeding `g.collect()` by `no`, `ord`, `src`, and `amount_of()`, especially main contract `R26TA01354404`; inspect `data/past/` versus `data/search/se/ct-2026-07..10` for changes and joint-venture `part` / `share` treatment. Do not publish contractor names or raw sensitive identifiers in a public issue. Confirm the contract's authoritative total and amendment basis before changing code, fixture, or expected value.

## Acceptance criteria

1. Establish whether the changed amount reflects **legitimate contract amendments**, a **duplicate/incorrect merge**, or a **unit/amount-basis mismatch**; cite an authoritative contract record and identify the affected contract IDs privately to the data owner.
2. If the algorithm is wrong, correct deduplication/aggregation and add a regression fixture covering the failing case. If the authoritative amount legitimately changed, replace the brittle fixed 51% assertion with a source-backed, independently computed expectation **without removing balance, mapping, region, and no-company-name invariants**.
3. Run the isolated test, full `python -m unittest discover -s tests`, `python collector/validate.py data --prev /tmp/prev/data` with an appropriate baseline, and the actual scheduled workflow. Confirm the data commit SHA reached `main` and that Pages serves the matching artifact before marking the issue resolved.
4. Until verified, keep the last validated snapshot; show **stale / collection failed**, not a fresh timestamp or zero contracts. Do not turn off the validation gate to get a green workflow.
5. Data/collector owner implements the fix in a separate branch/PR; GPT review PR must remain unmerged until owner approval.

**Connectivity disclosure:** GitHub repository is currently **public**. A live executed-stock-trade feed is **not connected**; generative AI is **not connected**. Korean public contract collection is separate from those two capabilities.


## 2026-11-09 15:32 KST follow-up — failure persists; contract-level attribution

- [Scheduled run #42572785586](https://github.com/91cleaner/money-tracker/actions/runs/42572785586) (created 06:24 UTC; test output 06:32 UTC) **failed again** at `데이터 검증 게이트` on `main`. The preceding `나라장터 계약 수집` step succeeded; `바뀐 데이터 저장` was skipped. The suite ran **144 tests / 1 failure**.
- The **same** `test_main_contract_regions` assertion at line 33 remains: calculated Jeonju Deokjin-gu `130192831110` vs expected `64914674760`. This establishes a **persistent collection blocker**, not a one-off timeout, but does not prove a duplicate or a valid contract amendment.
- A successful Pages deploy [#42573192672](https://github.com/91cleaner/money-tracker/actions/runs/42573192672) later in the hour is **not** evidence that this failed contract collection was committed; the collection job skipped its commit step. Keep these statuses separate.

To attribute the region aggregate **without modifying files or exposing company names**, run the following on a clean checkout with the failed-run inputs. The first three columns identify a contract record and its revision/source; the final columns show contract amount, contribution to the target region, and all allocated parts. Compare the per-record amounts and part sums against the official contract/revision before changing the test:

```bash
python - <<'PY'
from scripts import build_gangseo_flow as g

regions, locator = g.Regions(), g.Locator()
target = "전북 전주시 덕진구"
rows = []
for rec in g.collect().values():
    amount = g.amount_of(rec)
    parts = g.split(rec)
    allocated = sum(part for _, _, part, _ in parts if part > 0)
    for cid, name, part, inline in parts:
        if part <= 0:
            continue
        region = regions.of(cid, name, inline)
        if not region:
            continue
        label, coords = locator(region)
        if label == target and coords:
            rows.append((rec["no"], rec["ord"], rec["src"], amount, part, allocated))
for row in sorted(rows, key=lambda x: str(x[0])):
    print(*row)
print("TARGET_REGION_SUM", sum(row[4] for row in rows))
PY
```

**Release condition:** data owner reconciles each contributing contract/revision and verifies `sum(part)` against the authoritative amount (especially search-index joint-venture `jvs`), fixes the underlying cause or source-backed expectation, and reruns the scheduled collection with a green gate **before** claiming fresh Korean contract data. This appendix is a read-only triage improvement, **not** a data or workflow fix.


## 2026-11-09 17:15 KST follow-up — November search-index coverage gap

- On current `main`, `scripts/build_gangseo_flow.py` hard-codes `MONTHS = ("2026-07", "2026-08", "2026-09", "2026-10")`, and `collect()` iterates only those values when reading `data/search/se/ct-*.json`.
- The GitHub directory listing independently confirms that `data/search/se/ct-2026-11.json` **exists** (1,111,916 bytes). Therefore the **November search-index file is not read by this focus builder**, even though it is available. This is a source-coverage/freshness gap, not evidence that any specific November record meets the Gangseo filters; `data/past/` is a separate input. It also **does not explain** the previously observed near-doubling in the October-based regional assertion.
- Read-only owner check, after checkout at a known SHA:

```bash
python - <<'PY'
from pathlib import Path
from scripts import build_gangseo_flow as g
available = {p.stem.removeprefix('ct-') for p in
             (Path('data/search/se')).glob('ct-????-??.json')}
print('available_months', sorted(available))
print('builder_months', list(g.MONTHS))
print('available_but_unread', sorted(available - set(g.MONTHS)))
PY
```

**Additional data-owner acceptance criterion:** determine whether November contains matching Gangseo records before claiming any missing amount; if yes, extend the builder's source window with a bounded, deterministic month-selection rule (project start through latest validated index month), reconcile revisions/allocations against official records, and add a regression check ensuring newly published month files cannot be silently skipped. If no matching November records exist, document that result and still establish a freshness/coverage test. Keep the original failed-run amount investigation and fail-closed collection gate separate; do not adjust the 51% expectation without primary-source evidence. GPT has not changed the collector, test, data, or published site.
