# P1 review — newly shipped world-history categories need primary-source provenance (2026-11-04)

**Scope:** main commit `dbcfedb80f02b7b04a66f5a6fd59b5372646f37d` / merged PR #494, following the prior world-history category expansion. Review only; **no history data, UI, collectors, or deployment workflows are changed here**.

## Confirmed issue

The newly published `data/hist_nuke.json`, `data/hist_disaster.json`, and `data/hist_base.json` cite Wikipedia articles as their event-level `steps[].s` and category-level `src` references. Wikipedia can be useful for discovery, but it is **not the official/primary source** required by `docs/AI-ROLES.md` ("출처는 공식 원문 링크만 씁니다"). In addition, `data/hist_base.json` presents some historical base openings and present-day status in the same category; a date verified by an encyclopedia does not establish present-day operational status.

This is a **provenance/claim-strength failure**, not proof that a date or location is false. Do not present these records as independently verified or as live military intelligence. Approximate map pins and circle radii remain illustrative.

## Primary/authoritative replacements to validate (not automatic substitutes)

| Data / claim | Better source to inspect | Required field-level check |
|---|---|---|
| `hist_nuke.json`: first tests, DPRK six tests, CTBT | [CTBTO test monitoring](https://www.ctbto.org/our-work/detecting-nuclear-tests), [UN nuclear testing history](https://www.un.org/en/observances/end-nuclear-tests-day/history), [US DOE Trinity history](https://www.energy.gov/em/manhattan-project-department-energy-formation-1939-1977) | Event date, test vs announced test, country, approximate site; distinguish CTBT adoption, opening for signature and entry into force |
| `hist_disaster.json`: earthquake dates/magnitudes/sites | [USGS ComCat](https://earthquake.usgs.gov/earthquakes/search/), [NOAA/NCEI Significant Earthquakes](https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/earthquakes) | Exact event ID, UTC/local date, magnitude **scale and revision**, epicentre vs city label |
| `hist_disaster.json`: eruptions and VEI | [Smithsonian Global Volcanism Program](https://volcano.si.edu/), [USGS Pinatubo report](https://pubs.usgs.gov/pinatubo/wolfe/) | Eruption interval vs peak day, VEI, approximate location; no circle-as-damage-area inference |
| `hist_base.json`: overseas military installations | Relevant defence ministry, host-country government or official installation history **per base** | Opening/construction/treaty/relocation dates are different events; avoid unverified current operational status or comprehensive counts |

**Do not bulk-replace links without checking each claim against the destination record.** A source home page alone is not evidence for a particular event. Where no primary source supports a precise day, use a year/interval and mark `unverified` or omit the claim rather than fabricate precision.

## Concrete acceptance criteria for the data/UI owners

1. Inventory every `countries[].wars[].steps[].s` and `src` in these **three files**; flag Wikipedia/non-primary URLs separately from verified official citations. Include event count and exception count in the audit output.
2. For each published factual claim, retain a directly supporting official record URL and record the *specific field(s)* checked (date, site, magnitude/VEI, treaty status). Preserve the encyclopedia URL only as a labelled secondary reference if policy permits.
3. Separate historical event dates from today's military base status; no "live", "operational now" or intelligence-style claim without a dated official confirmation.
4. Automated regression: fail when a newly added verified event has no authoritative source, but allow an explicitly labelled `unverified`/secondary-only state; do not silently interpret fetch failures as verified zero events.
5. On Korean/English mobile map, confirm the source link opens the intended record, long labels do not cover the map, and approximate pins/circle semantics remain visible.
6. Run history-data validation, JS/map smoke, security/artifact checks and deployed-URL verification **on the same release SHA** before declaring the new categories verified.

## Related release status at review time

- Latest inspected main `dbcfedb8` (2026-11-04 13:55 KST) has [Pages deploy success](https://github.com/91cleaner/money-tracker/actions/runs/41776062518) and [command smoke success](https://github.com/91cleaner/money-tracker/actions/runs/41776062519), but [security/research checks failed](https://github.com/91cleaner/money-tracker/actions/runs/41776062580). Its 144 Python tests passed; the failing artifact step still checks obsolete `href="intel-lab.html"` in the root page. Existing PR #403 addresses that **separately** and is unmerged; do not duplicate its code.
- Repository is **public**; GitHub Pages is public. Live congressional executions and generative AI remain **NOT CONNECTED**. These three historical datasets are static public reference data, not a live feed.
- This document is a GPT-owned second review under `docs/AI-ROLES.md`; historical data and interface corrections belong to their respective owners. PR must remain draft/unmerged pending approval.
