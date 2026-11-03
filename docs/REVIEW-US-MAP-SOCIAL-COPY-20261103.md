# P1 copy review — U.S. map social preview and research-lab evidence claims

Checked against `main` on 2026-11-03 KST. This is a **review and handoff**, not a deployed UI correction. Source files are Claude-owned per `docs/AI-ROLES.md`; no screen, collector, `data/`, or workflow file is changed here.

## Verified source-level discrepancies

1. `world-intelligence/index.html` (main blob `9894f00a096ed5063c49f939e5e129f3bc12eb49`): both `og:description` and `twitter:description` say **"traced as live routes"**. The routes are interactive representations of accumulated disclosures and context, **not live executed-trade observations**. The same tags say **"Official public records only"** while this screen also contains curated historical/context routes. The claim should distinguish original filings from derived or curated routes.
2. The social title **"Who in Congress traded what, and when"** does not disclose that dates and trades are **reported in delayed filings** and have not been independently verified as executions. `late filings` in the description can imply verified statutory lateness; no universal lateness adjudication is demonstrated by these tags.
3. `world-intelligence/us-signals.html` starts with **"투자 판단에 필요한 세 가지 자료를 직접 대조하는 관제실입니다."** This implies an investment-decision aid rather than a neutral public-record research tool. Its **"● 공식 원문 조회"** label sits next to external-source links; it should not imply that the site's underlying trade records have all been individually source-verified.

These are confirmed **copy discrepancies**, not evidence of an erroneous trade, a compromised site, or an actual production social-card cache state. The separate root-page copy fix in PR #298 does **not** update these two files.

## Proposed exact replacement copy for Claude

| Location | Current | Proposed |
| --- | --- | --- |
| U.S. map `meta[name=description]` | `A U.S. control room that follows Congress bills, lawmaker stock-trade filings, company sites and foreign policy as routes on a map. Public records only, not investment advice.` | `Explore reported U.S. congressional trades, legislation, company locations and policy context on an interactive map. Filings may be delayed; no live trade feed or AI analysis. Not investment advice.` |
| U.S. map `og:title` / `twitter:title` | `US Stock Trackers \| Who in Congress traded what, and when` | `US Stock Trackers \| Explore congressional trade disclosures on a map` |
| U.S. map `og:description` / `twitter:description` | `Congressional stock trades, late filings, bills and contracts traced as live routes on one map. Official public records only. Not investment advice.` | `Explore reported congressional trades, legislation and company context as interactive map routes. Delayed filings; live executed-trade feed and AI analysis not connected. Not investment advice.` |
| Research lab opening paragraph (first sentence) | `투자 판단에 필요한 세 가지 자료를 직접 대조하는 관제실입니다.` | `미국 의회 거래 신고·법안·경제지표의 공개 기록을 서로 대조하는 조사 화면입니다.` |
| Research lab external-source badges | `● 공식 원문 조회` / `● 공식 데이터 조회` | `● 공식 사이트 열기` / `● 공식 데이터 사이트 열기` |

Keep the existing **real-world disclosure caveats**: transaction date versus filing date, Senate coverage gaps, no automatic trading or recommendations. Do not replace an unknown data state with a positive claim.

## Acceptance / regression gate (Claude/UI owner)

1. Parse the final **built Pages HTML** for `meta[name=description]`, `meta[property=og:title]`, `meta[property=og:description]`, `meta[name=twitter:title]`, `meta[name=twitter:description]`. Assert the proposed wording and that the two social descriptions match; do not rely only on grep of a source file.
2. Assert no `live routes`, `live trades`, or unqualified `Official public records only` in these metadata values; preserve `Not investment advice` and the **disconnected** live execution/AI status.
3. Check the Korean lab's first sentence and external-link badges; ensure that external links remain HTTPS and open the same official sources. No changes to search, map, mobile layout, source URLs, or data pipelines.
4. Check direct navigation to `/world-intelligence/` and `/world-intelligence/us-signals.html` on mobile and desktop; verify the page is not hidden by a share-preview-specific redirect.
5. Only after owner-approved merge and successful deployment, fetch published HTML with cache bypass and compare the relevant meta tags against the release artifact. Third-party social crawlers may retain cached previews; a Pages CI success alone does not prove that previews refreshed.

## Coordination and release state

- Existing related work: root-page social copy PR #298; map/data CI PRs #403, #412, #458. Do not merge or overwrite their files as part of this review.
- Repository visibility confirmed **public** on 2026-11-03. Public House PTR filings are delayed reports, **not** a connected real-time executed-trade feed. Generative AI analysis is **not connected**.
- No live-site, browser, CI, or crawler verification is claimed by this documentation-only review. Owner approval is required before merge.
