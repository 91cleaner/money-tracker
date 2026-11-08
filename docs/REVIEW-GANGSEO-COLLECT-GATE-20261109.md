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
