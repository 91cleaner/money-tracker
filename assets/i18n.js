/* MONEY TRACKER — KO/EN switch (US command room, company / member / sector pages, commander mode).
   One place for every screen string. Pages keep their Korean source strings; in EN mode this file translates them
   (exact strings, templates with numbers, then phrases) as they reach the DOM, so dynamically built text is covered too.
   Language: ?lang=en|ko (shareable; also saved) > localStorage "mt.lang" > ko.
   EN formats: dates "MMM D, YYYY", amounts in $ with K/M/B. KO keeps its own formats (억/만원 for KRW amounts).
   US source data stays as published (English titles etc.); Korean tags ("ko") are not shown in EN.
   Wording stays neutral: "Based on filings", "data shows", "Not investment advice", PTR = "Disclosed (PTR), up to 45-day lag".
   Untranslated Korean (rare data strings) is left as is rather than guessed. */
(function () {
  "use strict";
  var root = typeof window !== "undefined" ? window : globalThis;
  if (root.MTI18N) return;
  var KEY = "mt.lang";
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ---------- language selection ----------
  function pickLang() {
    var l = null;
    try { l = new URLSearchParams(root.location.search).get("lang"); } catch (e) { }
    l = l && String(l).toLowerCase().slice(0, 2);
    if (l === "en" || l === "ko") { try { root.localStorage.setItem(KEY, l); } catch (e) { } return l; }
    try { l = root.localStorage.getItem(KEY); } catch (e) { l = null; }
    if (l === "en" || l === "ko") return l;
    try { if (/\/world-intelligence\//.test(root.location.pathname)) return "en"; } catch (e) { }
    return "ko";
  }
  var lang = typeof document !== "undefined" ? pickLang() : "ko";
  var isEn = lang === "en";

  // ---------- number / date / money formats ----------
  function pad(n) { return String(n).padStart(2, "0"); }
  function dateEn(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m && +m[2] >= 1 && +m[2] <= 12 ? MON[+m[2] - 1] + " " + (+m[3]) + ", " + m[1] : iso; }
  function date(iso) { return isEn ? dateEn(iso) : iso; }
  function usd(v) { if (v == null || !isFinite(v)) return "-"; var a = Math.abs(v); return "$" + (a >= 1e9 ? (v / 1e9).toFixed(2) + "B" : a >= 1e6 ? (v / 1e6).toFixed(2) + "M" : a >= 1e3 ? Math.round(v / 1e3).toLocaleString("en-US") + "K" : Math.round(v).toLocaleString("en-US")); }
  function krw(v) { // KRW amount: 억/만원 in KO, $-free "KRW 1.2B" style in EN
    if (v == null || !isFinite(v)) return "-"; var a = Math.abs(v);
    if (!isEn) return a >= 1e8 ? (v / 1e8).toFixed(1).replace(/\.0$/, "") + "억원" : a >= 1e4 ? Math.round(v / 1e4).toLocaleString("ko-KR") + "만원" : Math.round(v).toLocaleString("ko-KR") + "원";
    return "KRW " + (a >= 1e9 ? (v / 1e9).toFixed(2) + "B" : a >= 1e6 ? (v / 1e6).toFixed(2) + "M" : Math.round(v).toLocaleString("en-US"));
  }
  function money(v, cur) { return cur === "KRW" ? krw(v) : usd(v); }
  // Korean-unit USD amounts that appear in stored data ("5,031만 달러", "5.0억 달러") -> $50.31M / $500.00M
  function koUsd(num, unit) { var n = parseFloat(String(num).replace(/,/g, "")); return usd(n * (unit === "억" ? 1e8 : 1e4)); }

  // ---------- exact strings (a whole text node / attribute) ----------
  var EXACT = {
    "한눈에 보기": "At a glance", "주가 기록(종가)": "Closing price record", "국회에 올라온 법안": "Bill filed in the National Assembly", "대만 정부 발표": "Taiwan government announcement", "중국 정부 발표": "Chinese government announcement", "일본 정부 발표": "Japanese government announcement",
    "의원": "Member", "종목": "Asset", "구분": "Type", "신고일": "Filed", "거래일": "Traded", "금액": "Amount", "금액 구간": "Amount range", "신고까지": "Lag", "원문": "Source",
    "티커": "Ticker", "회사": "Company", "종가": "Close", "1일": "1D", "1주": "1W", "1달": "1M", "최근 흐름": "Trend", "열기": "Open", "연초 대비": "YTD",
    "구입": "Buy", "처분": "Sale", "교환": "Exchange", "구입(P)": "Purchase (P)", "처분(S)": "Sale (S)", "교환(E)": "Exchange (E)",
    "법안": "Bills", "규제": "Regulation", "위원회": "Committee", "연방 계약": "Federal contracts", "로비": "Lobbying", "후원": "PAC", "의원 거래": "Member trades", "임원 거래": "Insider trades", "보조금·대출": "Grants & loans", "리콜": "Recalls", "발표 전 거래": "Trades before announcements", "본사·공장": "HQ & plants", "기타 지표": "Other indicators",
    "하원": "House", "상원": "Senate", "민주당": "Democratic", "공화당": "Republican", "무소속": "Independent",
    "미국": "United States", "중국": "China", "대만": "Taiwan", "한국": "South Korea", "일본": "Japan", "영국": "United Kingdom", "독일": "Germany", "사우디": "Saudi Arabia", "유럽": "Europe",
    "1년": "1Y", "주간 순위표": "Weekly ranking", "공시": "Filings", "대략 위치": "Approx. location", "관보 조치": "Federal Register actions", "포고문": "Proclamation", "행정명령": "Executive Order", "대통령 조치": "Presidential action", "대통령 메모": "Presidential memorandum", "대통령 공고": "Presidential notice", "대통령 결정": "Presidential determination",
    "상무부 BIS(산업안보국)": "Commerce BIS (Bureau of Industry and Security)", "USTR(무역대표부)": "USTR (Trade Representative)", "재무부 OFAC(해외자산통제국)": "Treasury OFAC (Office of Foreign Assets Control)",
    "전체": "All", "미정": "TBD", "대표 발의": "Sponsor", "회부 위원회": "Referred committee",
    "MONEY TRACKER — 회사 상세": "MONEY TRACKER — Company file", "MONEY TRACKER — 미국 회사 파일": "MONEY TRACKER — US Company File",
    "아래 링크": "Link below", "내부 데이터 분류": "Internal data classification", "유형(신고대로)": "Type (as filed)", "당-주": "Party-State", "법안 상세 페이지 ›": "Bill detail page ›", "수정종가": "Adjusted close", "기준": "Basis",
    // NVDA hand-written route stops (data/us/ticker-routes.json)
    "본사 위치 확인됨": "HQ location confirmed", "데이터상 SEC 제출 서류의 사업장 주소가 캘리포니아주 산타클라라임.": "Data shows the business address in SEC filings is Santa Clara, California.",
    "칩 생산은 외부 파운드리 의존": "Chip production relies on external foundries", "10-K에서 자체 공장 없이 TSMC·삼성전자 등 파운드리에 칩 생산을 맡긴다고 밝힘.": "The 10-K says it has no fabs of its own and outsources chip production to foundries such as TSMC and Samsung Electronics.",
    "중국 등 수출 허가 요건 공시": "Disclosure of export license requirement for China and others", "반도체 지원법 제정": "CHIPS Act enacted", "CHIPS and Science Act(H.R.4346, 117대 의회)가 법으로 제정됨. 업계 전반 대상 법률임.": "The CHIPS and Science Act (H.R.4346, 117th Congress) was enacted into law. It applies to the whole industry.",
    "미 정부가 H20 칩을 중국 등(홍콩·마카오, D:5 국가 포함)으로 수출할 때 허가가 필요하다고 2025-04-09 통보했다고 8-K로 공시함(제출 2025-04-15).": "The 8-K discloses that on Apr 9, 2025 the US government notified the company that a license is required to export H20 chips to China and others (incl. Hong Kong, Macau and D:5 countries) (filed Apr 15, 2025).",
    // MSFT / META route stops (data/us/ticker-routes.json)
    "미국 워싱턴주 레드먼드": "Redmond, Washington, USA", "미국 캘리포니아 멘로파크": "Menlo Park, California, USA", "미국 워싱턴 D.C.(의회)": "Washington, D.C. (U.S. Congress)", "미국 워싱턴 D.C.": "Washington, D.C., USA",
    "MS 본사 위치 확인됨": "Microsoft HQ location confirmed", "데이터상 SEC 제출 서류의 사업장 주소가 워싱턴주 레드먼드(One Microsoft Way)임.": "Data shows the business address in SEC filings is Redmond, Washington (One Microsoft Way).",
    "MS 연방 계약 약 11억 달러": "Microsoft federal contracts: approx. $1.10B", "데이터상 2024-10-01~2026-10-28 USAspending 연방 계약 합계 약 11.0억 달러. 최다 발주 기관은 국방부(약 8.4억 달러).": "Data shows approx. $1.10B in federal contracts on USAspending from Oct 1, 2024 to Oct 28, 2026. Top awarding agency: Department of Defense (approx. $838M).",
    "MS 로비 공시 148건": "Microsoft: 148 lobbying filings", "데이터상 2025~2026 MS 로비 공시(LDA) 148건, 보고 금액 합계 약 2,322만 달러.": "Data shows 148 Microsoft lobbying disclosure (LDA) filings in 2025–2026, reported total approx. $23.2M.",
    "메타 본사 위치 확인됨": "Meta HQ location confirmed", "데이터상 SEC 제출 서류의 사업장 주소가 캘리포니아주 멘로파크(1 Meta Way)임.": "Data shows the business address in SEC filings is Menlo Park, California (1 Meta Way).",
    "메타 로비 공시 163건": "Meta: 163 lobbying filings", "데이터상 2025~2026 메타 로비 공시(LDA) 163건, 보고 금액 합계 약 5,794만 달러.": "Data shows 163 Meta lobbying disclosure (LDA) filings in 2025–2026, reported total approx. $57.9M.",
    "메타 PAC 후보 기부": "Meta PAC giving to candidates", "데이터상 2026 선거주기 META PLATFORMS, INC. PAC의 연방 후보 기부 합계 34.85만 달러(~2026-10-14). 임직원 자발 기부 PAC이며 회사 자금 아님.": "Data shows the 2026 election cycle: META PLATFORMS, INC. PAC gave a total of $348,500 to federal candidate committees (through Oct 14, 2026). The PAC is funded by voluntary employee contributions, not company money.",
    // command-room demo routes
    "대만 해협의 지정학적 위험을 검토합니다.": "Reviews geopolitical risk in the Taiwan Strait.", "반도체 제조 집중과 생산 차질 가능성을 살펴봅니다.": "Looks at concentration of chip manufacturing and possible production disruptions.", "미국 기술기업의 공급망 노출을 확인합니다.": "Checks US tech companies' supply-chain exposure.",
    "연준 정책과 국채금리, 은행주·성장주의 반응을 분석합니다.": "Analyzes Fed policy, Treasury yields and the reaction of bank and growth stocks.", "중동 에너지 공급과 운송 위험을 검토합니다.": "Reviews Middle East energy supply and shipping risks.", "미국 에너지·항공·운송 업종의 상반된 영향을 비교합니다.": "Compares the opposing effects on US energy, airline and transport sectors.",
    "무역 상대국의 생산·수출 구조를 확인합니다.": "Checks the production and export structure of trading partners.", "관세 적용 대상과 미국 기업의 비용 전가 가능성을 검토합니다.": "Reviews which goods tariffs apply to and whether US companies can pass costs on.", "국방예산 승인과 실제 조달·계약의 차이를 확인합니다.": "Checks the gap between approved defense budgets and actual procurement and contracts.",
    "동맹국의 방위산업 공급망을 살펴봅니다.": "Looks at allies' defense-industry supply chains.", "미국 방산 기업의 수주와 실적을 비교합니다.": "Compares US defense companies' orders and results."
  };

  // ---------- templates with numbers (whole sentence shape; applied before phrases) ----------
  var D = "(\\d{4}-\\d{2}-\\d{2})";
  var RULES = [
    // 한국 종목 경로 카드(쉬운 말투) — build_search_index.py kr_company_routes()
    [/^(.+?)(?:은|는) 한국 대표 (.+?) 회사예요\. 최근 한 달 미국이 (?:.+?) 관련 문서를 (\d+)번 냈어요\. 제목 말을 보고 같은 분야로 묶은 것이라, 이 회사와 직접 관계가 있다는 뜻은 아니에요\./,
      "$1 is a major Korean $2 company. In the last month the US issued $3 documents about $2. They were grouped by words in the titles, so this does not mean they are directly about this company."],
    [/^(.+?)(?:은|는) 한국 대표 (.+?) 회사예요\. 최근 석 달 미국이 (?:.+?) 관련 문서를 (\d+)번 냈어요\. 제목 말을 보고 같은 분야로 묶은 것이라, 이 회사와 직접 관계가 있다는 뜻은 아니에요\./,
      "$1 is a major Korean $2 company. In the last three months the US issued $3 documents about $2. They were grouped by words in the titles, so this does not mean they are directly about this company."],
    [/^(.+?)의 마지막 종가는 ([\d,]+)원이에요\((\S+)\)\.(?: 한 달쯤 전\((\S+)\)에는 ([\d,]+)원이었어요\.)? 장이 끝날 때 값이고 실시간이 아니에요\./,
      "$1 last closed at KRW $2 ($3).$4 This is the end-of-day price, not live."],
    [/^미국에서 (\S+)에 (.+?) 분야 문서가 나왔어요: /, "A US document on $2 came out on $1: "],
    [/^국회에 '(.+)' 법안이 올라왔어요\((\S+)\)\. 낸 사람: (.+?)\. 이름만 보고 같은 분야로 묶었어요\./, "A bill was filed in the Korean National Assembly ($2): '$1'. Filed by: $3. Grouped into this field by its title only."],
    [/^(대만|중국|일본) 정부가 (\S+)에 (.+?) 분야로 보이는 글을 올렸어요: (.+) \(원문 언어 그대로예요\. 제목 말만 보고 묶었어요\.\)$/, "The $1 government posted this on $2, which looks related to $3: $4 (original language; grouped by title words only)."],
    [/^미국 회사 (.+?)\((\S+?)\)가 낸 보고서에 (.+?)(?:이|가) 거래처로 나와요\. 원문: /, "In a report filed by US company $1 ($2), $3 is named as a supplier. Original text: "],
    [/^요즘 값은 (.+?)이에요\((\S+)\)\./, "Recent value: $1 ($2)."],
    [/ 같이 보는 숫자일 뿐, 서로 원인이라는 뜻은 아니에요\./, " Shown side by side only; it does not mean one causes the other."],
    [/^이 사이트가 직접 묶은 거라 공식 담당 위원회는 아닐 수 있어요\. (상원|하원) 위원 (\d+)명이 있어요\./, "Grouped by this site, so it may not be the official committee. $2 members in the $1."],
    // insights.json lines
    [new RegExp("하원 PTR 신고 최근 (\\d+)일\\(" + D + "~" + D + "\\) (\\d+)건\\(구입 (\\d+)·처분 (\\d+),? 의원 (\\d+)명\\), 직전 (\\d+)일 (\\d+)건\\. 신고 기준, 거래일→신고일 최대 (\\d+)일 차이 가능\\."),
      "House PTR filings, last $1 days ($2~$3): $4 (buys $5 · sales $6, $7 members); prior $8 days: $9. Based on filings; disclosed (PTR), up to $10-day lag."],
    [/연방 계약 의무액 (.+?) 상위 (\d+)% \((\d+)\/(\d+), 데이터상\)/, "Federal contract obligations: top $2% in $1 (rank $3 of $4; data shows)"],
    [/^(.+?)(?:에 언급된)? (생산시설|생산 거점 지역|공급사) (\d+)곳(?:\(본사 제외\))?(?: 중|:) (.*?)[(,] ?(?:공급사 소재지 )?좌표 기준 대략\)\.$/, function (m, doc, kind, n, list) { list = list.replace(/^[:, ]+/, ""); if ((list.match(/\(/g) || []).length > (list.match(/\)/g) || []).length) list += ")"; return doc + ": " + n + " " + ({ "생산시설": "production facilities (HQ excluded)", "생산 거점 지역": "production regions mentioned", "공급사": "suppliers mentioned" }[kind]) + " — " + list.replace(/^[:, ]+/, "") + " (approx., by coordinates)."; }],
    [/의원 PTR 신고 최근 (\d+)일 (\d+)건\(직전 (\d+)건\)/, "Member PTR filings, last $1 days: $2 (prior: $3)"],
    [new RegExp("연방 계약 의무액 (\\$-?[\\d,.]+[KMB]?)\\(" + D + "~" + D + ", 회사명 키워드 매칭·자회사 포함, 리셀러 경유 계약 제외\\), (.+?) (\\d+)곳 중 (\\d+)위\\(데이터상\\)\\."),
      "Federal contract obligations $1 ($2~$3; matched on company-name keywords, subsidiaries included, reseller contracts excluded); rank $6 of $5 in $4 (data shows)."],
    [/로비 보고 금액\(외부 로비회사 수입\+자체 지출 합산, 분기별 최신 수정보고 반영\) (\d{4}) ((?:Q\d·?)+) (\$-?[\d,.]+[KMB]?)(?:, 전년 같은 분기 대비 ([+-]?[\d.]+%))?, (.+?) (\d+)곳 중 (\d+)위\(공시 기준, 데이터상\)\./,
      function (m, y, q, amt, pct, sec, tot, rk) { return "Reported lobbying amount (outside-firm income + in-house spending, latest amended filing per quarter) " + y + " " + q + ": " + amt + (pct ? ", " + pct + " vs. same quarters a year earlier" : "") + "; rank " + rk + " of " + tot + " in " + sec + " (based on filings; data shows)."; }],
    [/로비 금액 전년 같은 분기 대비 ([+-]?[\d.]+%)/, "Lobbying amount $1 vs. same quarter a year earlier"],
    [/종가 기준 (\d+)개월 ([+-]?[\d.]+%), 같은 업종\((.+?)\) (\d+)곳 중앙값 ([+-]?[\d.]+%), 연초 대비 ([+-]?[\d.]+%)\. 인과 아님\./,
      "Closing-price basis: $1-month $2; median of $4 companies in the same sector ($3): $5; YTD $6. Not causal."],
    [/종가 기준 (\d+)개월 ([+-]?[\d.]+%), 같은 업종\((.+?)\) (\d+)곳 중앙값 ([+-]?[\d.]+%)\. 인과 아님\./, "Closing-price basis: $1-month $2; median of $4 companies in the same sector ($3): $5. Not causal."],
    [/종가 기준 (\d+)개월 ([+-]?[\d.]+%), 연초 대비 ([+-]?[\d.]+%)\. 인과 아님\./, "Closing-price basis: $1-month $2; YTD $3. Not causal."],
    [new RegExp("(한국 국회 발의 법률안|EU 정부 발표|일본 정부 발표|대만 정부 발표|중국 정부 발표) " + D + "~" + D + " (\\d+)건 중 (.+?) 관련 (\\d+)건(?:, (.+?) 관련 (\\d+)건)?(?:, 과기정통부 보도자료 (\\d+)건 중 (.+?) 관련 (\\d+)건)?\\(제목 키워드 기준, 영향 단정 아님\\)\\."),
      function (m, src, d1, d2, tot, k1, n1, k2, n2, mt, mk, mn) {
        var s = { "한국 국회 발의 법률안": "Korean National Assembly bills", "EU 정부 발표": "EU government announcements", "일본 정부 발표": "Japanese government announcements", "대만 정부 발표": "Taiwan government announcements", "중국 정부 발표": "Chinese government announcements" }[src];
        return s + " " + d1 + "~" + d2 + ": " + n1 + " of " + tot + " related to " + k1 + (k2 ? ", " + n2 + " related to " + k2 : "") + (mt ? "; MSIT press releases: " + mn + " of " + mt + " related to " + mk : "") + " (title-keyword basis; no impact implied).";
      }],
    [new RegExp("백악관·대통령 조치 " + D + " (포고문|행정명령|대통령 조치|대통령 메모|대통령 공고|대통령 결정) '(.+)'\\((.+?) 키워드\\) 발표 전후 종가 " + D + " (\\$[\\d,.]+) → " + D + " (\\$[\\d,.]+) \\(([+-]?[\\d.]+%), 같은 기간 데이터상, 인과 아님\\)\\."),
      function (m, d, type, title, kw, d1, p1, d2, p2, ch) { return "White House / presidential action " + d + " " + EXACT_DOC(type) + " '" + title + "' (" + kw + " keywords): closing price " + d1 + " " + p1 + " → " + d2 + " " + p2 + " (" + ch + ", same period per data, not causal)."; }],
    [/(\d{4}) ?년 (\d)분기 보고 금액 합계 약 (\$[\d,.]+[KMB]?)/, "Q$2 $1 reported total approx. $3"],
    [/(\d{4}) ?년 (\d)분기 · 업종 내 (\d+)곳 보고 금액 합계 약 (\$[\d,.]+[KMB]?)/, "Q$2 $1 · $3 companies in sector, reported total approx. $4"],
    // company chart (company.html)
    [/^(1주|1달|1년|전체) 종가 추이 (\S+) ~ (\S+)$/, function (m, r, a, b) { return RNG[r] + " closing-price trend " + a + " ~ " + b; }],
    [/^(1주|1달|1년|전체) 종가 (\S+) ~ (\S+) · 범위 (\S+) ~ (\S+)(?: · 출처: (.+?))? · 핀 (\d+)건\. 핀은 같은 기간 공개 기록의 날짜일 뿐 주가 변동의 원인을 뜻하지 않습니다\. 의원 거래는 신고일 기준이며 실제 거래는 최대 45일 앞설 수 있습니다\. 연방 계약은 날짜별 자료가 없어 핀으로 표시하지 않습니다\.$/,
      function (m, r, a, b, lo, hi, src, n) { return RNG[r] + " closing prices " + a + " ~ " + b + " · range " + lo + " ~ " + hi + (src ? " · Source: " + src : "") + " · " + n + " pin" + (n === "1" ? "" : "s") + ". Pins are only the dates of public records in the same period and do not mean they caused price moves. Member trades are by filing date (Disclosed (PTR), up to 45-day lag), so actual trades can be up to 45 days earlier. Federal contracts have no per-date data and are not shown as pins. Not investment advice."; }],
    [/ 외 (\d+)건 — 아래 목록 참고$/, " and $1 more — see list below"], [/ 외 (\d+)건$/, " and $1 more"],
    [/ · 회사·제품명 언급 기준, 영향 단정 아님$/, " · Based on company / product-name mentions; no impact implied"],
    [/^신고 기준( · 거래일 (\S+))?( · 신고까지 (\d+)일\(법정 최대 45일\))?$/, function (m, a, td, b, n) { return "Based on filings" + (td ? " · Traded " + td : "") + (n ? " · Lag " + n + " days (statutory max 45)" : ""); }],
    // company / member / sector pages
    [/(\S.*?) 회사 상세$/, "$1 · Company file"], [/(\S.*?) 의원 상세$/, "$1 · Member file"], [/(\S.*?) 업종 상세$/, "$1 · Sector file"],
    [/(\S.*?) 회사 파일$/, "$1 · Company file"], [/(\S.*?) 의원 파일$/, "$1 · Member file"], [/(\S.*?) 업종 파일$/, "$1 · Sector file"],
    [/^SEC 등록명 (.+?) · 업종 코드 SIC (.*?) · 본사\(SEC 주소\) (.*?) ·$/, "SEC registered name $1 · SIC code $2 · HQ (SEC address) $3 ·"],
    [/종가 \((\d{4}-\d{2}-\d{2})\)/, "Close ($1)"],
    [/최근 (\d+)거래일 종가 추이 (\S+) ~ (\S+)/, "Closing-price trend, last $1 trading days, $2 ~ $3"],
    [/최근 (\d+)거래일 종가 (\S+) ~ (\S+) · 범위 (\S+) ~ (\S+)/, "Closing prices, last $1 trading days, $2 ~ $3 · range $4 ~ $5"],
    [/ · 출처: /, " · Source: "],
    [/저장소 데이터에 '(.+)' 티커가 없습니다\./, "Ticker '$1' is not in the repository data."],
    [/주소 끝에 \?t=티커 를 붙여 주세요\. 예: company\.html\?t=NVDA/, "Add ?t=TICKER to the address, e.g. company.html?t=NVDA"],
    [/주소 끝에 \?n=의원이름 을 붙여 주세요\. 예: member\.html\?n=Cleo Fields/, "Add ?n=MEMBER_NAME to the address, e.g. member.html?n=Cleo Fields"],
    [/저장소 데이터에서 '(.+)' 의원을 찾지 못했습니다\. 영문 이름으로 입력해 주세요\./, "No member named '$1' in the repository data. Please enter the English name."],
    [/하원 PTR 신고 (\d+)건, 가장 최근 신고일 (\S+) \(신고 기준, 데이터상\)/, "House PTR filings: $1; most recent filing date $2 (based on filings; data shows)"],
    [/SEC 등록 업종 SIC (\S+) (.*)/, "SEC-registered industry SIC $1 $2"],
    [/주식 거래 신고\(PTR\) (\d+)건\(구입 (\d+)·처분 (\d+)\), 가장 최근 신고일 (\S+) \(신고 기준, 데이터상\)/, "Stock trade filings (PTR): $1 (buys $2 · sales $3); most recent filing date $4 (based on filings; data shows)"],
    [/최근 (\d+)일 의원 거래 신고 (\d+)건\(구입 (\d+)·처분 (\d+)\), 소속 회사 (\d+)곳 \(신고 기준, 데이터상\)/, "Member trade filings, last $1 days: $2 (buys $3 · sales $4); $5 companies in the sector (based on filings; data shows)"],
    [/^(\d+)일 · (\d+)일 초과$/, "$1 days · over $2 days"],
    [/(\d+)일 · 숙제 기한\(45일\) 넘김/, "$1 days · past the homework due date (45 days)"],
    [/^(\d+)일$/, "$1 days"],
    [/더 보기 \((\d+)건 남음\)/, "Show more ($1 left)"], [/더 보기 \((\d+)곳 남음\)/, "Show more ($1 left)"],
    [/이달 신고 (\d+)건 \(신고일 기준, 위 목록 참고\)/, "$1 filings this month (by filing date; see list above)"],
    [/이달 업종 종목 신고 (\d+)건 \(신고일 기준\)/, "$1 filings this month for sector tickers (by filing date)"],
    [/(\d{4}) 선거주기 (.+?) · 연방 후보 위원회 기부 합계 (\$[\d,.]+[KMB]?) \(~(\S+)\)/, "$1 election cycle $2 · total contributions to federal candidate committees $3 (through $4)"],
    [/로비 공시 활동 설명에 나온 법안 번호\(자동 추출, 회기 미표기 — 원문 확인 필요\): /, "Bill numbers mentioned in lobbying-filing activity descriptions (auto-extracted, session not stated — check the source): "],
    [/데이터상 의뢰인 이름이 회사명으로 시작하는 공시 합산/, "Data shows: filings summed where the client name starts with the company name"], [/ · 주요 이슈: /, " · Top issues: "],
    [/데이터상 이 업종으로 분류된 회사 (\d+)곳 \(종가 자료 있는 곳 (\d+)곳\)\. 업종은 data\/search-index\.json의 자체 분류이며 공식 산업 분류가 아닙니다\./, "Data shows $1 companies classified in this sector ($2 with closing-price data). Sectors are this site's own classification in data/search-index.json, not an official industry classification."],
    [/최근 (\d+)일 의원 거래 신고/, "Member trade filings, last $1 days"],
    [/종가는 수정종가\(adjusted\) 기준 (\S+) · 등락은 종가 대비 변화율이며 사거나 팔라는 뜻이 아닙니다\./, "Adjusted closing prices as of $1 · changes are percent change in close; not a suggestion to buy or sell."],
    [/신고일 기준\((\S+) ~ (\S+)\)입니다\. 거래 후 최대 45일 안에 신고하므로 실제 거래일과 차이가 있을 수 있습니다\. 공개 기록일 뿐 잘잘못 판단이 아니며 투자 조언이 아닙니다\./, "Based on filings, by filing date ($1 ~ $2). Disclosed (PTR), up to 45-day lag, so actual trade dates can differ. Public records only — not a judgment of wrongdoing and not investment advice."],
    [/ · 교환 (\d+)건 포함/, " · incl. $1 exchanges"],
    [/연방 계약 합계 \((\d+)곳\)/, "Federal contracts total ($1 companies)"], [/로비 보고 금액 합계 \((\d+)곳\)/, "Reported lobbying total ($1 companies)"],
    [/연방 계약 회사 순위 · /, "Federal contracts by company · "], [/로비 보고 금액 회사 순위 · /, "Reported lobbying by company · "],
    [/공시 사업장 자료가 있는 회사 (\d+)곳: /, "$1 companies with filed site data: "],
    [/공시에 나온 공급사 위치\(회사 시설 아님\): /, "Supplier locations named in filings (not company facilities): "],
    [/'(.+)' 업종을 찾지 못했습니다\./, "Sector '$1' not found."],
    [/^(\d+)곳 · (\S+)$/, "$1 companies · $2"],
    [/(\d+)종목$/, "$1 tickers"], [/(\d+)개$/, "$1"],
    [/티커가 없는 신고\(국채·채권·비상장 자산 등\) (\d+)건은 종목 집계에서 뺐습니다\./, "$1 filings without a ticker (Treasuries, bonds, unlisted assets, etc.) are excluded from the ticker tally."],
    [/거래일과 신고일이 모두 있는 (\d+)건 기준\./, "Based on the $1 filings that have both a trade date and a filing date."],
    [/금액은 신고서의 구간이라 합계를 내지 않고 건수로만 셉니다\./, "Amounts are ranges from the filings, so they are counted, not summed."],
    [/전체 신고 \((.+)\)/, "All filings ($1)"],
    [/ — 연결 업종 중 거래 신고가 있는 것: /, " — linked sectors with trade filings: "],
    [/^(.+) 의원$/, "$1"],
    [/(\d{4})년부터 의회 활동/, "In Congress since $1"], [/(\d+)번째 임기/, "Term $1"], [/의원 ID (\S+)/, "Member ID $1"],
    [/ 제(\d+)선거구/, " District $1"], [/ 전체구/, " At-large"],
    [/의원 명부\(members\.json\)에 없는 이름입니다\. 신고서에 적힌 이름: /, "Not in the member roster (members.json). Name on the filing: "],
    // commander
    [/가장 최근 신고일\((\S+)\)에 신고한 의원 (.+) 기록 확인/, "Check the record of $2, who filed on the latest filing date ($1)"],
    [/최근 30일 신고가 많은 종목 중 (\S+) 회사 카드 열람 \(신고 (\d+)건\)/, "Open the company card for $1, one of the most-filed tickers in the last 30 days ($2 filings)"],
    [/업종 '(.+)' 살펴보기/, "Explore the sector '$1'"], [/종목 (\S+) 회사 카드 열람/, "Open the company card for $1"],
    [/조사한 카드 (\d+)개 · 다음 '(.+)'까지 (\d+)개/, "$1 cards opened · $3 more to '$2'"], [/조사한 카드 (\d+)개 · 최고 계급/, "$1 cards opened · top rank"],
    [/🔥 연속 임무 완료 (\d+)일/, "🔥 $1-day mission streak"],
    [/(\d+) \/ (\d+) 완료 · 매일 실제 신고 자료로 새로 정해짐 \((\S+)\)/, "$1 / $2 done · refreshed daily from real filings ($3)"],
    [/^(회사|의원|업종) (?!거래|주식|상세|파일|선택|미분류)(\S.*)$/, function (m, k, v) { return { "회사": "Company ", "의원": "Member ", "업종": "Sector " }[k] + v; }],
    [/지난 확인 이후 새 신고 (\d+)건/, "$1 new filings since last check"], [/ · 기준 신고일 /, " · baseline filing date "], [/ · 추적 시작 /, " · tracking since "],
    [/ · 지난 방문 이후 새 신고/, " · new since last visit"], [/신고 (\S+) · 거래 (\S+)/, "Filed $1 · Traded $2"],
    // world command room
    [/기준일 (\S+) · 출처: /, "As of $1 · Source: "], [/미국 종목·ETF 조사 대상: /, "US tickers / ETFs to research: "],
    [/^◉ (.+) · 비상장 기업$/, "◉ $1 · Private company"],
    [/(.+)은\(는\) 증시에 상장되지 않아 주가 데이터가 없습니다\. 같은 업종의 상장 기업·업종 경로를 대신 보여드려요\./, "$1 is not publicly listed, so there is no price data. Showing listed companies and the sector route instead."],
    [/"(.+)"와 딱 맞는 항목은 없어요\. 많이 찾는 경로를 대신 골라봤어요\./, "No exact match for \"$1\". Here are popular routes instead."],
    [/"(.+)"와 딱 맞는 항목은 없지만 가까운 항목이 있어요\./, "No exact match for \"$1\", but there are close ones."],
    [/^(?!◉)(.+) 경로$/, "$1 route"], [/ 경로 시작$/, " · start route"],
    [/(\d+)곳\. 공개 기록 경로를 따라가세요\./, "$1 stops. Follow the public-record route."], [/ · 정류장 /, " · stops "],
    [/의원 주식 거래 · 하원 PTR 신고 기준 (\d+)건 중 최근 (\d+)건 · 거래일→신고일 최대 (\d+)일 차이 가능 · 투자 조언 아님/, "Member stock trades · $2 most recent of $1 House PTR filings · Disclosed (PTR), up to $3-day lag · Not investment advice"],
    [/하원 PTR 신고 · /, "House PTR filings · "],
    [/미 의회 법안 (\S+) 수집/, "U.S. Congress bills: $1 collected"],
    [/ · 소관위 /, " · committee "],
    [/(\d+)년 제(\d+)호/, "No. $2, $1"],
    // route facts / titles from data/search-index.json
    [/자체 분류, 공식 관할 아님\. 데이터상 (상원|하원) 위원 (\d+)명\(members\.json\)\./, function (m, c, n) { return "Own classification, not official jurisdiction. Data shows " + n + " " + (c === "상원" ? "Senate" : "House") + " members (members.json)."; }],
    [/연관 위원회\((상원|하원)\): /, function (m, c) { return "Related committee (" + (c === "상원" ? "Senate" : "House") + "): "; }],
    [/데이터상 하원 PTR 신고 (\d+)건, 최근 신고일 (\S+?)\. 신고 기준이며 거래일→신고일 최대 (\d+)일 차이 가능\. 투자 조언 아님\./, "Data shows $1 House PTR filings, most recent filed $2. Based on filings; disclosed (PTR), up to $3-day lag. Not investment advice."],
    [/데이터상 (.+?) 의원 (\S+) 거래 신고 (\d+)건\. 최근: (구입|처분|교환)\((.)\) (.+?), 거래일 (\S+), 신고일 (\S+)\. 신고 기준, 투자 조언 아님\./,
      function (m, who, tk, n, ty, c, amt, td, fd) { return "Data shows " + n + " trade filings by " + who + " for " + tk + ". Latest: " + { "구입": "Purchase", "처분": "Sale", "교환": "Exchange" }[ty] + " (" + c + ") " + amt + ", traded " + td + ", filed " + fd + ". Based on filings; not investment advice."; }],
    [/데이터상 SEC 제출 서류 사업장 주소가 (.+?)임\./, "Data shows the business address in SEC filings is $1."],
    [/요즘 값은 (.+?)이에요\((.+?)\)\. 같이 보는 숫자일 뿐, 서로 원인이라는 뜻은 아니에요\./, "Latest value: $1 ($2). Shown side by side only; it does not mean one causes the other."],
    [/이 사이트가 직접 묶은 거라 공식 담당 위원회는 아닐 수 있어요\. (상원|하원) 위원 (\d+)명이 있어요\./, function (m, h, n) { return "Grouped by this site; may not be the official committee of jurisdiction. " + (h === "상원" ? "Senate" : "House") + " members: " + n + "."; }],
    [/^(.+?) 분야와 같이 보는 숫자예요\. 출처: (.+?)\. 원인이라는 뜻은 아니에요\./, "An indicator viewed alongside the $1 sector. Source: $2. Not a cause."],
    [/요즘 값은 (.+?)이에요\(/, "Latest value: $1 ("],
    [/본사 위치\(SEC 주소\)/, "HQ location (SEC address)"], [/^본사 /, "HQ "],
    [/데이터상 (.+?) 업종과 함께 보는 지표로 연결됨\. 출처: /, "Data shows this is linked as an indicator watched with the $1 sector. Source: "],
    [/ · 시세 /, " · quote "], [/ \(월간, 매일 확인\) · 원 출처 한국은행/, " (monthly, checked daily) · original source Bank of Korea"],
    [/\(공공데이터포털, 매일 확인\)/, "(Korea public data portal, checked daily)"],
    [/데이터상 (\S+)~(\S+) SEC Form 4 공개시장 매수 (\d+)건, 매도 (\d+)건\(임원·이사 신고\)\. 최근 거래일 (\S+): (.+?)\((.*?)\) (매수|매도) ([\d,]+)주, 주당 (\$[\d,.]+)\. 거래 이유는 공시에 없음\./,
      function (m, a, b, p, q, d, w, r, sd, sh, pr) { return "Data shows " + p + " open-market buys and " + q + " sells on SEC Form 4 (officers and directors), " + a + "~" + b + ". Latest trade date " + d + ": " + w + " (" + r + ") " + (sd === "매수" ? "bought" : "sold") + " " + sh + " shares at " + pr + " per share. Filings do not give a reason."; }],
    [/데이터상 (\S+)~(\S+) 연방 보조금 의무액 (\$[\d,.-]+), 대출 의무액 (\$[\d,.-]+)\((\d+)건, 수령자 이름 정확 일치, 계약 제외\)\. 최근 (\S+) (.+?)\./,
      function (m, a, b, g, l, n, d, ag) { return "Data shows federal grant obligations of " + g + " and loan obligations of " + l + " (" + n + " awards, exact recipient-name match, contracts excluded), " + a + "~" + b + ". Latest: " + d + ", " + ag + "."; }],
    [/데이터상 (\S+) 이후 리콜 (\d+)건\(NHTSA (\d+)건, openFDA (\d+)건\), 제조사·회수업체 이름 정확 일치\. 최근 (\S+) (\S+)\./,
      function (m, a, n, x, y, d, id) { return "Data shows " + n + " recalls since " + a + " (NHTSA " + x + ", openFDA " + y + "), exact manufacturer or recalling-firm name match. Latest: " + d + ", " + id + "."; }],
    [/데이터상 공시·발표 30일 이내 앞선 거래 (\d+)건\(의원 (\d+)건, 임원 (\d+)건\)\. 최근 예: (.+?), 거래일 (\S+), 이벤트 (\S+) (.+?)\((\d+)일 전\)\. 날짜를 나란히 놓은 것이며 사전 인지나 인과를 뜻하지 않음\./,
      function (m, n, a, b, w, td, ed, ev, k) { return "Data shows " + n + " trades dated within 30 days before a filing or announcement (" + a + " by House members, " + b + " by insiders). Latest example: " + w + ", trade date " + td + "; event " + ed + " " + ev + " (" + k + " days later). Dates are placed side by side only; this does not show prior knowledge or cause."; }],
    [/데이터상 (\S+)~(\S+) 연방 계약 합계 약 ([\d,.]+)(억|만) 달러\. 최다 발주 기관 (.+?), 주별 집계 (\d+)위 (.+?)\.? 수령자 이름 일치 기준\./,
      function (m, a, b, n, u, ag, r, st) { return "Data shows federal contracts total approx. " + koUsd(n, u) + " (" + a + "~" + b + "). Top awarding agency: " + ag + "; #" + r + " by state: " + st + ". Based on recipient-name matches."; }],
    [/(.+?) 상태: (계류|한 원 통과|양원 통과|대통령 서명|법률 제정|폐기)\. 최근 조치\((\S+?)\): /,
      function (m, t, s, d) { return t + " Status: " + { "계류": "pending", "한 원 통과": "passed one chamber", "양원 통과": "passed both chambers", "대통령 서명": "signed by the President", "법률 제정": "enacted", "폐기": "died" }[s] + ". Latest action (" + d + "): "; }],
    [/데이터상 최신값 (\S+) \((\S+?)\)\. 원인 관계 단정 아님\./, "Data shows latest value $1 ($2). No causal claim."],
    [/대표 발의 (.+?)\. 발의일 (\S+?)\./, "Sponsor: $1. Introduced $2."], [/(\S+) 발의$/, "$1 introduced"],
    [/최근 조치에 회부 위원회로 (.+) 기재\./, "Latest action lists $1 as the referred committee."], [/(.+) 현재 상태$/, "$1 current status"],
    [/데이터상 (.+) 로비 공시 활동 설명에 (.+) 언급 (\d+)회\(회기 미표기, 원문 확인 필요\)\./, "Data shows $2 mentioned $3 times in $1's lobbying-filing activity descriptions (session not stated; check the source)."],
    [/(.+?) 거래 신고$/, "$1 trade filings"],
    [/미국 워싱턴 D\.C\.\(의회\)/, "Washington, D.C. (U.S. Congress)"], [/발의 의원 지역구 · /, "Sponsor's district · "], [/백악관 · 워싱턴 DC/, "White House · Washington, DC"],
    [/대한민국 국회 · 서울 여의도/, "National Assembly of Korea · Yeouido, Seoul"], [/\(대략 위치\)/, "(approx. location)"], [/브뤼셀/, "Brussels"], [/베이징/, "Beijing"],
    [/백악관·대통령 조치 · (행정명령|포고문|대통령 조치) (.+)/, function (m, t, rest) { return "White House / presidential action · " + EXACT_DOC(t) + " " + rest.replace(/^(포고문|행정명령) /, ""); }],
    [/미국 (\d+)년 국채 ?금리/, "US $1-year Treasury yield"],
    // NVDA hand-written route stops (data/us/ticker-routes.json), indicator note, lobbying / PAC lines (data/search-index.json)
    [/^(.+?)\((H\.R\.\d+|S\.\d+), (\d+)대 의회\)가 법으로 제정됨\. 업계 전반 대상 법률임\.$/, function (m, t, b, c) { var o = c % 100 > 10 && c % 100 < 14 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[c % 10] || "th"); return "The " + t + " (" + b + ", " + c + o + " Congress) was enacted into law. It applies to the industry as a whole."; }],
    [/관세청이 품목 코드\(HS (\d+)자리\)로 센 숫자라서, 산업부가 발표하는 '(.+?)' 전체 수출과 범위가 달라요\./, "Counted by the Korea Customs Service by product code (HS $1-digit), so its scope differs from total '$2' exports published by the Ministry of Trade, Industry and Energy."],
    [/데이터상 (\S+) 로비 공시 (\d+)건, 보고 금액 합계 약 ([\d,.]+(?:억|만)? ?달러)\./, "Data shows $2 lobbying disclosure filings for $1, reported total approx. $3."],
    [/주요 이슈: /, "Top issues: "], [/수집 법안과 번호 일치: (.+?)\(회기 확인 필요\)\./, "Bill numbers matching collected bills: $1 (session needs checking)."],
    [/데이터상 (\d{4}) 선거주기 (.+?)의 연방 후보 위원회 기부 합계 ([\d,.]+(?:억|만)? ?달러)\(~(\S+?)\)\. 임직원 자발 기부 PAC이며 회사 자금 아님\./, "Data shows the $1 election cycle: $2 contributed a total of $3 to federal candidate committees (through $4). A PAC funded by voluntary employee contributions, not company funds."],
    [/^(.+?) · 로비$/, "$1 · Lobbying"], [/^(.+?) · 후원$/, "$1 · PAC"],
    [/^(.+?) 원문: /, "$1 source text: "],
    [/함께 볼 지표: 한국 (.+?)\((HS \d+), 월간\)/, function (m, n, hs) { return "Indicator to watch: Korea " + ({ "통신기기 수출": "telecom equipment exports", "석유제품 수출": "petroleum product exports", "집적회로 수출": "integrated circuit exports" }[n.replace(/ $/, "")] || n) + " (" + hs + ", monthly)"; }]
  ];
  var RNG = { "1주": "1W", "1달": "1M", "1년": "1Y", "전체": "All-time" };
  function EXACT_DOC(t) { return { "포고문": "Proclamation", "행정명령": "Executive Order", "대통령 조치": "Presidential action", "대통령 메모": "Presidential memorandum", "대통령 공고": "Presidential notice", "대통령 결정": "Presidential determination" }[t] || t; }

  // ---------- phrases (substring, longest first) ----------
  var PH = [
    // facility names (data/us/facilities.json)
    ["본사 · 텍사스 오스틴", "HQ · Austin, Texas"], ["기가팩토리 텍사스 · 오스틴", "Gigafactory Texas · Austin"], ["프리몬트 공장 · 캘리포니아", "Fremont Factory · California"], ["기가팩토리 네바다 · 스파크스", "Gigafactory Nevada · Sparks"], ["기가팩토리 베를린 · 그륀하이데", "Gigafactory Berlin · Grünheide"], ["기가팩토리 상하이", "Gigafactory Shanghai"], ["기가팩토리 뉴욕 · 버펄로", "Gigafactory New York · Buffalo"], ["메가팩토리 래스롭 · 캘리포니아", "Megafactory Lathrop · California"], ["생산 팹 · 오리건", "Production fab · Oregon"], ["생산 팹 · 애리조나", "Production fab · Arizona"], ["생산 팹 · 아일랜드", "Production fab · Ireland"], ["생산 팹 · 이스라엘", "Production fab · Israel"], ["조립·테스트 · 뉴멕시코", "Assembly & test · New Mexico"], ["조립·테스트 · 말레이시아", "Assembly & test · Malaysia"], ["조립·테스트 · 베트남", "Assembly & test · Vietnam"], ["본사 · 아이다호 보이시", "HQ · Boise, Idaho"], ["대만 · 웨이퍼 생산", "Taiwan · wafer fabrication"], ["싱가포르 · 웨이퍼 생산", "Singapore · wafer fabrication"], ["일본 · 웨이퍼 생산", "Japan · wafer fabrication"], ["말레이시아 · 조립·테스트", "Malaysia · assembly & test"], ["중국 · 조립·테스트", "China · assembly & test"], ["인도 · 조립·테스트", "India · assembly & test"], ["뉴욕 · 신규 메모리 생산지(계획)", "New York · new memory fab (planned)"], ["본사 · 캘리포니아 샌타클래라", "HQ · Santa Clara, California"], ["공급사 TSMC(파운드리) · 대만 신주", "Supplier TSMC (foundry) · Hsinchu, Taiwan"], ["공급사 삼성전자(파운드리·메모리) · 한국", "Supplier Samsung Electronics (foundry & memory) · Korea"], ["공급사 SK하이닉스(메모리) · 한국 이천", "Supplier SK hynix (memory) · Icheon, Korea"], ["공급사 마이크론(메모리) · 아이다호", "Supplier Micron (memory) · Idaho"], ["본사 · 캘리포니아 쿠퍼티노", "HQ · Cupertino, California"], ["본사 · 신주과학단지", "HQ · Hsinchu Science Park"], ["타이중 팹 · 중부과학단지", "Taichung fabs · Central Taiwan Science Park"], ["타이난 팹 · 남부과학단지", "Tainan fabs · Southern Taiwan Science Park"], ["애리조나 · 생산능력 확대", "Arizona · capacity expansion"], ["구마모토 · 생산능력 확대", "Kumamoto · capacity expansion"], ["드레스덴 · 생산능력 확대", "Dresden · capacity expansion"],
    // map page: source panel, Federal Register tooltips; glossary/price-source leftovers
    ["공식 자료 조사 결과", "Official source findings"], ["자료창 닫기", "Close source panel"], ["(구 Polygon)", " (formerly Polygon)"],
    ["제목 키워드 기준", "title-keyword basis"], ["관세·수입제한(232조)·청정에너지", "tariffs, import limits (Section 232) and clean energy"], ["수입제한", "import limits"], ["청정에너지", "clean energy"],
    ["232조", "Section 232"], ["에너지", "energy"], ["주택", "housing"], ["기타", "other"], ["관세", "tariffs"], ["제재", "sanctions"], ["이란", "Iran"], ["베네수엘라", "Venezuela"], ["관련", "related"],
    // sectors (data/search-index.json names)
    ["시장 전체(지수)", "Broad market"], ["IT·소프트웨어·AI", "Tech, software & AI"], ["금융·은행·보험", "Finance, banking & insurance"], ["에너지·석유·가스", "Energy, oil & gas"], ["청정에너지·탄소", "Clean energy & carbon"],
    ["배터리·전기차", "Batteries & EVs"], ["방산·항공우주", "Defense & aerospace"], ["조선·해운", "Shipbuilding & shipping"], ["헬스케어·제약·바이오", "Healthcare, pharma & biotech"], ["주택·건설·부동산", "Housing, construction & real estate"],
    ["산업재·기계", "Industrials & machinery"], ["소비재·명품·유통", "Consumer, luxury & retail"], ["가상자산", "Crypto assets"], ["전체 수집 기업", "all tracked companies"], ["신주 본사", "Hsinchu HQ"], ["타이중", "Taichung"], ["타이난", "Tainan"], ["각 ", "each "], ["미국", "US"], ["한국", "Korea"], ["중국", "China"], ["일본", "Japan"], ["독일", "Germany"], ["증설 언급 포함, 팹 수 아님", "incl. mentioned expansions, not a fab count"], ["안전자산(금·채권)", "Safe havens (gold & bonds)"], ["반도체", "Semiconductors"], ["자동차", "Autos"], ["관세·통상", "tariffs & trade"], ["무역·관세", "trade & tariffs"],
    // shared disclaimers
    ["신고 기준입니다. STOCK Act상 의원은 거래 후 최대 45일 안에 신고하므로 거래일과 신고일 사이에 차이가 있을 수 있고, 최근 거래는 아직 신고되지 않았을 수 있습니다. 금액은 신고서에 적힌 구간입니다. 공개 기록일 뿐 잘잘못 판단이 아니며, 투자 조언이 아닙니다.",
      "Based on filings. Under the STOCK Act, members disclose within 45 days of a trade, so trade and filing dates can differ (Disclosed (PTR), up to 45-day lag) and recent trades may not be filed yet. Amounts are the ranges stated on the filing. Public records only — not a judgment of wrongdoing, and not investment advice."],
    ["신고 기준입니다. STOCK Act상 의원은 거래 후 최대 45일 안에 신고하므로 거래일과 신고일 사이에 차이가 있을 수 있습니다. 금액은 신고서에 적힌 구간입니다. 공개 기록일 뿐 잘잘못 판단이 아니며, 투자 조언이 아닙니다.",
      "Based on filings. Under the STOCK Act, members disclose within 45 days of a trade, so trade and filing dates can differ (Disclosed (PTR), up to 45-day lag). Amounts are the ranges stated on the filing. Public records only — not a judgment of wrongdoing, and not investment advice."],
    ["데이터상 공개 기록을 정리한 화면입니다. 사거나 팔라는 뜻이 아니며 거래의 이유나 원인 관계를 단정하지 않습니다.", "This page organizes public records as the data shows them. It is not a suggestion to buy or sell and does not claim reasons or causes for any trade."],
    ["데이터상 공개 기록을 정리한 화면입니다. 사거나 팔라는 뜻이 아니며 원인 관계를 단정하지 않습니다.", "This page organizes public records as the data shows them. It is not a suggestion to buy or sell and makes no causal claim."],
    ["브라우저에만 저장(로그인 없음). 하원 PTR 신고 기준이며 거래일→신고일 최대 45일 차이가 있을 수 있습니다. 공개 기록일 뿐 잘잘못 판단이 아니며 투자 조언 아님.", "Saved in this browser only (no login). Based on House PTR filings; disclosed (PTR), up to 45-day lag between trade and filing. Public records only — not a judgment of wrongdoing; not investment advice."],
    ["같은 기간 있었던 공개 기록을 날짜순으로 나열한 것입니다. 서로의 원인 관계를 뜻하지 않습니다.", "Public records from the same period, listed by date. No causal link between them is implied."],
    ["위원회와 업종의 연결은 이 사이트의 자체 분류이며 공식 관할이 아닙니다. 겹침은 두 기록이 같은 업종에 걸쳐 있다는 뜻일 뿐, 거래 이유나 잘잘못을 뜻하지 않습니다.", "Links between committees and sectors are this site's own classification, not official jurisdiction. An overlap only means two records fall in the same sector — it says nothing about reasons or wrongdoing."],
    ["데이터상 수령자·의뢰인 이름이 회사명으로 시작하는 기록만 합산한 값입니다. 자회사·동명 법인이 빠지거나 섞일 수 있어 원문 확인이 필요합니다.", "Sums only records where the recipient / client name starts with the company name. Subsidiaries may be missing and same-name entities may be mixed in, so check the source."],
    ["SEC 연차보고서 사업장 항목 기준. 좌표가 도시·단지 단위 대략 위치라 나라는 좌표로 대략 분류했습니다.", "Based on the sites item of SEC annual reports. Coordinates are approximate city / campus locations, so countries are roughly classified from coordinates."],
    ["신고 기준입니다.", "Based on filings."], ["투자 조언 아님. ", "Not investment advice. "], ["투자 조언이 아닙니다", "not investment advice"], ["투자 조언 아님", "Not investment advice"], ["투자 신호 아님", "not an investment signal"], ["인과 아님", "not causal"],
    // route labels / indicators / White House block (world command room)
    ["함께 볼 지표: ", "Indicator to watch: "], ["유로/달러 환율", "EUR/USD exchange rate"], ["원/달러 환율", "KRW/USD exchange rate"], ["미국 산업생산지수", "US industrial production index"], ["미국 소비자물가지수", "US consumer price index"], ["한국은행 기준금리", "Bank of Korea base rate"], ["미국 기준금리(연방기금 실효금리)", "US policy rate (effective federal funds rate)"],
    ["의원 주식 거래(하원 PTR)", "Member stock trades (House PTR)"], ["의원 주식 거래", "Member stock trades"], ["로비 공시(LDA)", "Lobbying disclosure (LDA)"], ["로비 공시에 번호 언급", "Number mentioned in lobbying disclosures"], ["로비 공시", "Lobbying disclosure"], ["연계 PAC 후원", "Linked PAC contributions"], ["연방 계약", "Federal contracts"], ["SEC 임원 거래(Form 4)", "SEC insider trades (Form 4)"], ["연방 보조금·대출(USAspending)", "Federal grants and loans (USAspending)"], ["리콜(NHTSA·openFDA)", "Recalls (NHTSA, openFDA)"], ["발표 전 30일 거래", "Trades within 30 days before an announcement"], ["연방 보조금·대출", "Federal grants and loans"], ["발표 전 거래", "Trades before announcements"], ["임원 거래", "Insider trades"], ["리콜", "Recalls"],
    ["공장(공시)", "Plant (filed)"], ["공급사(공시)", "Supplier (filed)"], ["대략 위치", "approx. location"], ["관보(", "Federal Register ("], ["관보", "Federal Register"], ["본사 위치", "HQ location"], ["현재 상태", "current status"], ["법안 제목에 언급", "Mentioned in bill title"],
    ["상무부 BIS(산업안보국)", "Commerce BIS (Bureau of Industry and Security)"], ["USTR(무역대표부)", "USTR (Trade Representative)"], ["재무부 OFAC(해외자산통제국)", "Treasury OFAC (Office of Foreign Assets Control)"], ["산업안보국", "Bureau of Industry and Security"],
    ["포고문", "Proclamation"], ["행정명령", "Executive Order"], ["대통령 조치", "Presidential action"], ["대통령 메모", "Presidential memorandum"], ["대통령 공고", "Presidential notice"], ["대통령 결정", "Presidential determination"],
    ["백악관·관보 조치", "White House / Federal Register actions"], ["관보 조치", "Federal Register actions"], ["의원 거래 신고(신고일 기준)", "Member trade filings (by filing date)"], ["(Filed 기준)", "(by filing date)"], ["신고일 기준", "by filing date"], ["(신고일 기준)", "(by filing date)"], ["차트 기간", "Chart period"],
    ["주간 순위표", "Weekly ranking"],
    // page chrome
    ["MONEY TRACKER — 미국 회사 파일", "MONEY TRACKER — US Company File"], ["MONEY TRACKER — 회사 상세", "MONEY TRACKER — Company file"],
    ["미국 상장사별 공개 기록: 의원 거래 신고, 로비 공시, PAC, 공시 연결. 데이터상 정리이며 투자 조언 아님.", "Public records by US listed company: member trade filings, lobbying disclosures, PAC, filing links. Organized from the data; not investment advice."],
    ["미국 의회 법안·의원 거래 신고·회사 공장·다른 나라 정책을 지도 위 경로로 따라가는 관제실. 공개 자료 정리이며 투자 조언 아님.", "A control room that follows US congressional bills, member trade filings, company plants and other countries' policies as routes on a map. Based on public filings; not investment advice."],
    ["MONEY TRACKER | 세계 관제실", "MONEY TRACKER | Global Command Room"], ["세금추적단", "Money Tracker"],
    ["공개 기록 정리", "Public records, organized"], ["공개 자료 불러오는 중…", "Loading public data…"], ["미국 의원 공개 기록 정리 · 신고 기준 · 투자 조언 아님", "US member public records · based on filings · not investment advice"], ["미국 상장사 공개 기록 정리 · 투자 조언 아님", "US listed-company public records · not investment advice"],
    ["MONEY TRACKER 관제실 — ", "MONEY TRACKER Command Room — "],
    ["티커 입력", "Enter ticker"], ["의원 이름 입력", "Enter member name"], ["의원 이름", "Member name"], ["업종 선택", "Select sector"],
    ["주가 · 종가 기준", "Price · closing basis"], ["주가 데이터 준비 중", "Price data coming soon"],
    ["의원 거래 신고 (하원 PTR)", "Member trade filings (House PTR)"], ["이 종목의 의원 거래 신고 기록이 없습니다", "No member trade filings for this ticker"],
    ["최근 무슨 일이 있었나 · 날짜순", "What happened recently · by date"], ["날짜가 있는 연결 기록이 아직 없습니다", "No dated linked records yet"], ["날짜 없는 연결", "Undated links"],
    ["연방 계약(USAspending): 이 저장소에는 아직 수집된 자료가 없습니다.", "Federal contracts (USAspending): no data collected in this repository yet."],
    ["연관 위원회 — 자체 분류이며 공식 관할이 아닙니다.", "Related committees — own classification, not official jurisdiction."], ["연관 위원회", "Committee"],
    ["회사를 찾지 못했습니다", "Company not found"], ["의원을 찾지 못했습니다", "Member not found"], ["여러 의원이 맞습니다 — 골라 주세요", "Multiple members match — please choose"],
    ["거래 신고가 많은 의원 (신고 건수 기준)", "Members with the most trade filings (by filing count)"], ["지도에서 보기", "View on map"], ["공식 홈페이지 ↗", "Official website ↗"], ["SEC 원문 ↗", "SEC filing ↗"], ["SEC 업종 정보 없음", "No SEC industry information"],
    ["로비 공시 (LDA)", "Lobbying disclosure (LDA)"], ["기업 연계 PAC (FEC)", "Company-linked PAC (FEC)"], ["공시·규제 기록 · ", "Filing / regulatory record · "], ["공시·규제 기록", "Filing / regulatory record"], ["의원 거래 신고", "Member trade filings"], ["참고 기록", "Reference record"],
    ["임직원 자발 기부로 운영되는 PAC이며 회사 자금이 아님 · 개별 후보 미표시", "A PAC funded by voluntary employee contributions, not company funds · individual candidates not shown"],
    ["데이터상 의뢰인 이름이 회사명으로 시작하는 공시 합산", "Data shows: filings summed where the client name starts with the company name"],
    ["소속 위원회", "Committees"], ["데이터에 위원회 정보가 없습니다.", "No committee information in the data."], ["정당 미상", "Party unknown"],
    ["거래 신고 요약 · 신고 기준", "Trade filing summary · based on filings"], ["신고까지 중앙값", "Median lag"], ["주식 숙제 늦게 낸 것 (45일 넘김)", "Stock homework turned in late (past 45 days)"], ["가장 최근 신고일", "Most recent filing date"], ["기록 없음", "no records"], ["전체 신고", "All filings"],
    ["많이 거래한 종목 · 건수 기준", "Most-traded tickers · by filing count"], ["티커가 있는 거래 신고가 없습니다", "No trade filings with a ticker"], ["업종별 · 건수 기준", "By sector · by filing count"], ["업종으로 묶을 거래가 없습니다", "No trades to group by sector"], ["업종 미분류", "Unclassified sector"],
    ["업종은 data/search-index.json의 자체 분류입니다.", "Sectors are this site's own classification in data/search-index.json."],
    ["위원회와 거래 업종 · 데이터상 겹침", "Committees and traded sectors · overlap in the data"], ["데이터상 겹침이 없습니다 (위원회에 연결된 업종에서 거래 신고가 없거나, 위원회에 연결된 업종 분류가 아직 없음)", "No overlap in the data (no trade filings in sectors linked to the committees, or no sector classification linked to the committees yet)"], ["위원회 정보가 없어 비교하지 않았습니다", "No committee information, so no comparison was made"],
    ["거래 신고 목록 (PTR)", "Trade filing list (PTR)"], ["이 의원의 거래 신고 기록이 저장소에 없습니다", "No trade filings for this member in the repository"],
    ["현재 저장소의 거래 자료(data/us/trades.json)에는 하원 신고만 들어 있어, 상원의원 신고는 아직 보이지 않습니다.", "The trade data in this repository (data/us/trades.json) contains only House filings, so Senate filings are not shown yet."],
    ["종목·자산 이름으로 거르기", "Filter by ticker / asset name"], ["종목 거르기", "Filter by ticker"], ["구분 거르기", "Filter by type"], ["전체 구분", "All types"], ["조건에 맞는 신고가 없습니다", "No filings match"],
    ["구입", "Buy"], ["처분", "Sale"], ["처분·교환", "Sales & exchanges"], ["건수 순", "by count"], ["많이 신고된 종목 (건수 순)", "Most-filed tickers (by count)"], ["신고가 많은 의원 (건수 순)", "Members with the most filings (by count)"],
    ["업종을 고르세요", "Choose a sector"], ["소속 회사 · 종가 기준", "Companies · closing basis"], ["이 업종으로 분류된 회사가 없습니다", "No companies classified in this sector"], ["소속 회사", "Companies"], ["구입(P) / 처분(S) 신고", "Purchase (P) / sale (S) filings"], ["거래 신고 기준일", "Filing data as of"],
    ["구입(P)", "Purchase (P)"], ["처분(S)", "Sale (S)"], ["교환(E)", "Exchange (E)"], ["처분(S)·교환(E)", "Sale (S) / exchange (E)"],
    ["이 기간에 이 업종 종목의 거래 신고가 없습니다", "No trade filings for this sector's tickers in this period"], ["연방 계약 · 로비 합계", "Federal contracts · lobbying totals"], ["이 업종 회사의 연방 계약 자료가 없습니다.", "No federal contract data for this sector's companies."], ["이 업종 회사의 로비 공시 자료가 없습니다.", "No lobbying disclosure data for this sector's companies."],
    ["공장·시설 나라 분포 (공시 사업장)", "Plants & facilities by country (filed sites)"], ["이 업종 회사의 공시 사업장 자료가 아직 없습니다", "No filed-site data for this sector's companies yet"], ["기타(분류 불가)", "Other (unclassified)"],
    ["대만", "Taiwan"], ["싱가포르", "Singapore"], ["말레이시아", "Malaysia"], ["베트남", "Vietnam"], ["인도", "India"], ["이스라엘", "Israel"], ["아일랜드", "Ireland"],
    ["최근 90일 의원 거래 신고 (하원 PTR)", "Member trade filings, last 90 days (House PTR)"],
    ["주가: ", "Prices: "], ["의원 거래: 미국 하원 사무처 재산공개 PTR", "Member trades: US House Clerk financial disclosure PTR"], ["회사·업종: SEC EDGAR", "Company / sector: SEC EDGAR"], ["연결 색인: ", "Link index: "],
    ["로비: ", "Lobbying: "], ["PAC: ", "PAC: "], ["공시·규제 경로: ", "Filing / regulatory route: "], ["핵심 비교: ", "Key comparisons: "], ["규칙 계산, 인과 아님", "rule-computed, not causal"], ["자료 없음(준비 중)", "no data (coming soon)"],
    ["의원 명부·정당·위원회: ", "Member roster, party, committees: "], ["종목·업종·위원회 연결: ", "Ticker / sector / committee links: "], ["자체 분류, 공식 관할 아님", "own classification, not official jurisdiction"],
    ["업종·회사 분류: ", "Sector / company classification: "], ["자체 분류", "own classification"], ["SEC 업종 코드: ", "SEC industry codes: "], ["연방 계약: ", "Federal contracts: "], ["사업장: ", "Sites: "], ["SEC 연차보고서", "SEC annual reports"], ["참고 기록: ", "Reference records: "],
    [" · 기준일 ", " · as of "], ["기준일 ", "As of "], ["표기 없음", "not stated"], ["원문 ↗", "Source ↗"], ["출처 ↗", "Source ↗"], ["출처: ", "Source: "], ["PTR 원문 ↗", "PTR source ↗"], ["PTR 원문", "PTR source"],
    ["신고일", "Filed"], ["거래일", "Traded"], ["신고 ", "Filed "], ["건 남음", " left"], ["더 보기", "Show more"], ["열기", "Open"],
    // insights card
    ["핵심 · 데이터상 비교", "Key points · what the data shows"], ["핵심 문장 전체 ", "All key lines · "], ["정책·법안", "Policy & bills"], ["공급사", "Suppliers"], ["기록", "Record"],
    ["저장된 공개 데이터에서 규칙으로 계산한 비교 수치. AI 미연결. 인과 아님. 투자 조언 아님.", "Comparison figures computed by rule from stored public data. No AI. Not causal. Not investment advice."],
    ["저장된 공개 데이터에서 계산한 비교 수치. 인과 아님. 투자 조언 아님.", "Comparison figures computed from stored public data. Not causal. Not investment advice."], [" · 파일 기준일 ", " · file as of "],
    ["한국 국회 발의 법률안", "Korean National Assembly bills"],
    // commander
    ["대장 모드 패널", "Commander mode panel"], ["대장 모드", "Commander mode"], ["신입 요원", "Rookie Agent"], ["정보 분석관", "Intelligence Analyst"], ["현장 추적관", "Field Tracker"], ["수석 조사관", "Senior Investigator"], ["작전 지휘관", "Operations Commander"], ["관제실 대장 기록", "Commander log"], ["관제실 대장", "Control Room Commander"],
    ["★ 추적 중", "★ Tracking"], ["☆ 추적", "☆ Track"], ["추적 목록에서 빼기", "Remove from tracking list"], ["추적 목록에 넣기", "Add to tracking list"], ["추적 임무", "Missions"], ["추적 목록", "Watchlist"], ["새 신고", "New filings"], ["닫기", "Close"],
    ["오늘 만들 임무 자료가 없습니다.", "No mission data available today."], ["아직 추적 중인 카드가 없습니다. 회사·의원·업종 페이지에서 ☆ 추적을 누르세요.", "Nothing tracked yet. Press ☆ Track on a company, member or sector page."],
    ["지난 확인 이후 새 신고 없음", "No new filings since last check"], ["신고 자료가 없습니다.", "No filing data."], ["신고일 순(같은 날은 거래일 순). 신고 시각은 원문에 없어 날짜까지만 표시합니다.", "Sorted by filing date (same day by trade date). Filing times are not in the source, so only dates are shown."],
    [" · 신고 ", " · Filed "], [" · 거래 ", " · Traded "],
    // world command room
    ["오프라인 개략 세계지도", "Offline rough world map"], ["실제 좌표 기반 세계지도", "World map based on real coordinates"], ["세계지도 준비 중 · 지도를 직접 이동할 수 있습니다", "World map loading · you can pan the map yourself"], ["관제실 조작", "Command room controls"], ["경로 조작", "Route controls"],
    ["🌐 전체지도", "🌐 Full map"], ["☷ 메뉴", "☷ Menu"], ["✕ 설명 닫기", "✕ Close brief"], ["주제를 선택하거나 아래 질문창에서 직접 명령하세요.", "Pick a topic or type a command in the box below."], ["추적 경로 선택", "Choose a route"],
    ["규칙 기반 경로 선택 · AI 분석 미연결 · 실시간 거래 데이터 미연결", "Rule-based route selection · no AI analysis · no live trade data"], ["← 이전", "← Prev"], ["다음 지역 →", "Next stop →"], ["다음 →", "Next →"], ["자동 재생 멈춤", "Pause autoplay"], ["자동 재생", "Autoplay"],
    ["관련 공식 자료 확인 ↗", "Official source ↗"], ["추적 질문", "Ask"], ["무엇을 추적할까요? 예: 미국 금리가 주식에 미치는 영향", "What should we track? e.g. How US interest rates affect stocks"], ["추적 ↵", "Track ↵"], ["전체화면", "Fullscreen"], ["전체 보기", "Show all"],
    ["통합 관제실 도구", "Command room tools"], ["◎ 전체", "◎ All"], ["◉ 미국", "◉ US"], ["◉ 한국", "◉ Korea"], ["⌁ 세계사", "⌁ World history"], ["▤ 법안", "▤ Bills"], ["⌕ 추적", "⌕ Track"],
    ["세계사와 미국 시장의 관계", "World history and the US market"], ["미국 법안이 주식시장에 미치는 영향", "How US bills affect the stock market"], ["◉ GLOBAL COMMAND · 미국 / 한국 / 세계 / 법안 · 하나의 지도", "◉ GLOBAL COMMAND · US / Korea / World / Bills · one map"],
    ["◉ 오늘의 임무 · ", "◉ Today's mission · "], ["대상: ", "Target: "], ["데이터 기반 자동 선택 · 투자 신호 아님", "Auto-selected from data · not an investment signal"], ["▶ 추적 시작", "▶ Start tracking"], [" (신고 기준)", " (based on filings)"],
    ["중국 상무부 공고 ", "China MOFCOM notices "], ["지표 갱신 · ", "Indicators updated · "], ["● 수집 기록", "● Collected records"], ["본사·공장", "HQ & plants"], ["선 = 공개 자료상 연결, 인과 아님", "Line = link in public data, not causal"], ["관련 법안: ", "Related bills: "],
    ["가격 · ", "Price · "], [" 종가 ", " close "], [" · 1일 ", " · 1D "], [" · 1주 ", " · 1W "], [" · 1개월 ", " · 1M "], [" · 연초 대비 ", " · YTD "], ["최근 종가 추이", "Recent closing trend"], ["의원 거래 신고: ", "Member trade filings: "],
    ["같은 기간 데이터상 있었던 일 (", "What the data shows for the same period ("], [", 인과 아님)", ", not causal)"], [" · 연결된 기록 없음", " · no linked records"], ["출처: Massive(구 Polygon) 종가 기준, ", "Source: Massive (formerly Polygon), closing basis, "],
    ["최근 무슨 일이 있었나 · 데이터상 날짜순(인과 아님)", "What happened recently · by date per the data (not causal)"], [" 출처 ↗", " Source ↗"], [" · 기준 ", " · as of "], ["핵심 · ", "Key · "], ["요약 3줄 (데이터상, 인과 아님)", "3-line summary (data shows; not causal)"],
    ["눈에 띄는 점 (기준 충족 시만 표시)", "Notable points (shown only when criteria are met)"], ["규칙 기반 계산 · AI 미연결 · 투자 조언 아님", "Rule-based calculation · no AI · Not investment advice"],
    ["최근 이 나라의 관련 법안·정책 · 국회 발의 법률안·정부 보도자료(제목 키워드 기준, 영향 단정 아님)", "Recent related bills & policy in this country · National Assembly bills and government press releases (title-keyword basis; no impact implied)"],
    ["수집 기간 내 업종 키워드에 맞는 법안 없음", "No bills matching sector keywords in the collection period"], ["의안 ↗", "Bill ↗"], [" · [과기정통부 보도자료] ", " · [MSIT press release] "], ["출처: 열린국회정보(국회)", "Source: Open Assembly Information (National Assembly)"], ["·과학기술정보통신부(공공데이터포털)", " · Ministry of Science and ICT (public data portal)"],
    [" · 같은 기간 데이터상 · 투자 조언 아님", " · same period per the data · Not investment advice"], ["백악관·대통령 조치", "White House / presidential actions"], ["관련 부처 관보 문서", "Related agency Federal Register documents"], [" · 최근 관련(제목 키워드 기준, 영향 단정 아님)", " · recent related (title-keyword basis; no impact implied)"],
    ["제품명 예시 언급 기업", "company named as a product example"], ["출처: Federal Register(관보)·whitehouse.gov · 날짜=관보 게재일 · 투자 조언 아님", "Source: Federal Register · whitehouse.gov · date = Federal Register publication date · Not investment advice"], [" 원문 ↗", " Source ↗"], ["백악관·", "White House · "],
    ["최근 이 나라의 관련 정책·발표", "Recent related policy & announcements in this country"], [" · 공식 발표(제목 키워드 기준, 영향 단정 아님)", " · official announcements (title-keyword basis; no impact implied)"], ["수집 기간 내 업종 키워드에 맞는 발표 없음", "No announcements matching sector keywords in the collection period"],
    [" · 같은 기간 데이터상 · 투자 조언 아님", " · same period per the data · Not investment advice"],
    ["반도체 공급망", "Semiconductor supply chain"], ["미국 금리와 주식시장", "US interest rates and the stock market"], ["에너지와 지정학", "Energy and geopolitics"], ["무역과 관세", "Trade and tariffs"], ["미국 국방·방산", "US defense"],
    ["데이터상 공개 자료 정리임. 투자 신호 아님.", "Public data organized as the data shows. Not an investment signal."], ["누적 공개 데이터에서 자동 생성한 경로 · AI 미연결 · 투자 신호 아님. 원인 관계를 단정하지 않습니다.", "Route auto-generated from accumulated public data · no AI · not an investment signal. No causal claim is made."],
    ["시연용 가상 탐색 경로입니다. AI·실시간 거래 데이터 미연결. 표시된 관계는 투자 신호나 입증된 인과관계가 아닙니다.", "Demo exploration route. No AI or live trade data. The relationships shown are not investment signals or proven causation."],
    ["AI 미연결 · 수집된 데이터만 검색합니다.", "No AI · searches collected data only."], ["◉ 이런 건 어때요", "◉ How about these"], ["◉ 아직 데이터 없음 · 대신 이건 있어요", "◉ No data yet · here is what we have"], ["◉ 관련 작전 경로 선택", "◉ Choose a related route"], ["◉ 지원되는 작전 경로", "◉ Supported routes"],
    ["질문과 관련된 탐색 경로입니다. 하나를 선택해야 지도가 이동합니다.", "Routes related to your question. Pick one to move the map."], ["질문을 분석할 AI가 아직 연결되지 않았습니다. 아래 시연 경로 중 하나를 선택할 수 있습니다.", "No AI is connected to analyze questions yet. You can pick one of the demo routes below."],
    ["기업", "Company"], ["업종", "Sector"], ["나라", "Country"], ["상임위", "Committee"], ["법안 주제", "Bill topic"],
    ["실제 지리 기반 세계지도 · 자유 탐색", "World map based on real geography · free exploration"], ["세계지도 · 자유 탐색", "World map · free exploration"], ["수동 탐색 · 자유롭게 지도를 이동하세요", "Manual exploration · pan the map freely"],
    ["지도 서버 연결 확인 중 · 대체 지도 표시", "Checking map server connection · showing fallback map"], ["지도 타일 지연 · 개략 지도 표시 (연결 복구 시 자동 전환)", "Map tiles delayed · showing rough map (switches automatically when connection recovers)"],
    ["지도 엔진 오류 · 개략 지도 표시", "Map engine error · showing rough map"], ["지도 라이브러리 연결 실패 · 개략 지도 표시", "Map library failed to load · showing rough map"],
    ["Alphabet Inc.", "Alphabet Inc."], ["Massive(구 Polygon)", "Massive (formerly Polygon)"],
    ["미 정부가 H20 칩을 중국 등(홍콩·마카오, D:5 국가 포함)으로 수출할 때 허가가 필요하다고", "The US government notified the company that a license is required to export H20 chips to China and others (incl. Hong Kong, Macau and D:5 countries) on"],
    ["통보했다고 8-K로 공시함(제출 ", "as disclosed in an 8-K (filed "], ["10-K에서 자체 공장 없이 TSMC·삼성전자 등 파운드리에 칩 생산을 맡긴다고 밝힘.", "The 10-K says it has no fabs of its own and outsources chip production to foundries such as TSMC and Samsung Electronics."],
    ["CHIPS and Science Act(H.R.4346, 117대 의회)가 법으로 제정됨. 업계 전반 대상 법률임.", "The CHIPS and Science Act (H.R.4346, 117th Congress) was enacted into law. It applies to the industry as a whole."],
    // indicators, names and places in route data (NVDA etc.)
    ["대만달러/달러 환율", "TWD/USD exchange rate"], ["엔/달러 환율", "JPY/USD exchange rate"], ["위안/달러 환율", "CNY/USD exchange rate"], ["달러 환율", "USD exchange rate"], ["국채 금리", "Treasury yield"], ["미 의회 법안", "U.S. Congress bills"],
    ["업종 코드", "industry code"], ["SEC 등록명", "SEC registered name"], ["SEC 등록 업종", "SEC-registered industry"], ["본사(SEC 주소)", "HQ (SEC address)"], ["(좌표는 대략 위치)", "(coordinates are approximate)"], ["원문: ", "Source text: "],
    ["미국 워싱턴 D.C.", "Washington, D.C."], ["워싱턴 D.C.", "Washington, D.C."], ["캘리포니아", "California"], ["샌타클래라", "Santa Clara"], ["산타클라라", "Santa Clara"], ["신주", "Hsinchu"], ["이천", "Icheon"], ["아이다호", "Idaho"],
    ["삼성전자", "Samsung Electronics"], ["SK하이닉스", "SK Hynix"], ["마이크론", "Micron"], ["파운드리", "foundry"], ["메모리", "memory"],
    ["스페이스X", "SpaceX"], ["오픈AI", "OpenAI"], ["앤트로픽", "Anthropic"], ["스트라이프", "Stripe"], ["바이트댄스", "ByteDance"], ["데이터브릭스", "Databricks"], ["쉬인", "Shein"],
    // generic units / words (last)
    ["의원 거래", "Member trades"], ["하원 PTR", "House PTR"], ["하원", "House"], ["상원", "Senate"], ["의원", "Member"], ["신고", "filing"], ["데이터상", "data shows"],
    // last-resort single words for text that reaches the page in pieces
    ["수정종가", "adjusted close"], ["위원회", "committee"], ["경로", "route"], ["수집", "collected"], ["원문", "source"], ["후원", "PAC"], ["유형", "type"], ["대로", "as filed"], ["로비", "lobbying"], ["기준일", "as of"], ["기준", "basis"], ["출처", "Source"], ["지표 갱신", "Indicators updated"], ["관련 법안", "Related bills"], ["오늘의 임무", "Today's mission"], ["대상", "Target"], ["가격", "Price"], ["핵심", "Key"], ["주가", "Prices"], ["종가", "close"]
  ];
  var PHS = PH.slice().sort(function (a, b) { return b[0].length - a[0].length; });

  var HANGUL = /[가-힣]/;
  var ISO = /(\d{4})-(\d{2})-(\d{2})/g, YM = /(\d{4})-(\d{2})(?![\d-])/g;
  function datesEn(s) {
    return s.replace(ISO, function (m, y, mo, d) { return +mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31 ? MON[+mo - 1] + " " + (+d) + ", " + y : m; })
      .replace(YM, function (m, y, mo) { return +mo >= 1 && +mo <= 12 && +y > 1990 ? MON[+mo - 1] + " " + y : m; });
  }
  var cache = Object.create(null), cacheN = 0;
  /** Korean screen string -> English (EN only; KO returns the input). Text with no Korean/ISO date is returned untouched. */
  function tr(s) {
    if (!isEn || typeof s !== "string") return s;
    return toEn(s);
  }
  function toEn(s) {
    if (typeof s !== "string" || !(HANGUL.test(s) || /\d{4}-\d{2}/.test(s))) return s;
    if (cache[s] != null) return cache[s];
    var lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0], core = s.slice(lead.length, s.length - trail.length), out;
    var dot = /\s*[·•]\s*$/.exec(core), bare = dot ? core.slice(0, dot.index) : core; // "fact ·" : text node followed by a source link
    if (EXACT[core] != null) out = EXACT[core];
    else if (dot && EXACT[bare] != null) out = EXACT[bare] + core.slice(dot.index);
    else {
      out = core;
      for (var i = 0; i < RULES.length; i++) {
        var r = RULES[i]; if (!r[0].test(out)) continue;
        out = out.replace(new RegExp(r[0].source, r[0].flags.replace("g", "") + "g"), r[1]);
      }
      // Korean-unit dollar amounts in stored data: "약 431.2억 달러", "1,538만 달러", "0달러"
      out = out.replace(/약 ?([\d,.]+)(억|만) ?달러/g, function (m, n, u) { return "approx. " + koUsd(n, u); }).replace(/([\d,.]+)(억|만) ?달러/g, function (m, n, u) { return koUsd(n, u); }).replace(/(\d[\d,]*)달러/g, function (m, n) { return usd(parseFloat(n.replace(/,/g, ""))); });
      if (HANGUL.test(out)) for (var j = 0; j < PHS.length; j++) if (out.indexOf(PHS[j][0]) >= 0) out = out.split(PHS[j][0]).join(PHS[j][1]);
      // leftover count suffixes (numbers followed by Korean units)
      out = out.replace(/(\d)건/g, function (m, d, i, str) { return /(^|[^\d,.])1$/.test(str.slice(0, i + 1)) ? d + " filing" : d + " filings"; }).replace(/(\d)곳/g, function (m, d, i, str) { return /(^|[^\d,.])1$/.test(str.slice(0, i + 1)) ? d + " company" : d + " companies"; }).replace(/(\d)일(?![가-힣])/g, "$1 days").replace(/(\d)명/g, "$1 members").replace(/(\d)개월/g, "$1 months");
      out = datesEn(out);
    }
    if (HANGUL.test(out)) out = out.replace(/(\d{4}) 선거주기 /g, "$1 election cycle: ").replace(/의 연방 후보 (?:committee|위원회) 기부 합계/g, " contributions to federal candidate committees total").replace(/임직원 자발 기부 PAC이며 회사 자금 아님\.?/g, "Employee-funded voluntary PAC, not company money.").replace(/최다 발주 기관/g, "Top awarding agency:").replace(/주별 집계 1위/g, "top state:").replace(/수령자 이름 일치 (?:basis|기준)\.?/g, "Matched by recipient name.").replace(/\s?합계\s?/g, " total ").replace(/연방 계약/g, "Federal contracts").replace(/약 /g, "approx. ");
    out = lead + out + trail;
    if (cacheN > 4000) { cache = Object.create(null); cacheN = 0; }
    cache[s] = out; cacheN++;
    return out;
  }
  // Korean company name -> English (EN only): first Latin alias of a search-index entity, else the name as is
  function name(ent) {
    var n = ent && ent.name; if (!isEn || !n || !HANGUL.test(n)) return n;
    var al = (ent.aliases || []).filter(function (a) { return !HANGUL.test(a) && /[A-Za-z]{3}/.test(a.replace(/\.[A-Z]{1,2}$/, "")) && a !== ent.symbol; }).sort(function (a, b) { var ua = /[A-Z]/.test(a) ? 1 : 0, ub = /[A-Z]/.test(b) ? 1 : 0; return ub - ua || b.length - a.length; })[0];
    if (al && /[A-Z]/.test(al)) al = al.replace(/,?\s+(CORP|INC|LTD|PLC|CO|Corp|Inc|Ltd|Plc)\.?$/, "");
    return al ? al.replace(/\b([A-Z])([A-Z]+)\b/g, function (m, a, b) { return /^(INC|CORP|CO|LTD|PLC|ETF|ADR|USA|AMD|IBM|TSMC|NVIDIA)$/.test(m) ? (m === "INC" || m === "CORP" || m === "LTD" ? a + b.toLowerCase() + "." : m) : a + b.toLowerCase(); }).replace(/\b(Inc|Corp|Ltd)\.?$/, "$1.") : n;
  }
  // UI string that is not Korean source text (button labels owned by this file)
  var UI = {
    ko: { aria: "English로 전환", title: "Switch to English" },
    en: { aria: "Switch to Korean", title: "Switch to Korean" }
  };

  var api = { lang: lang, name: name, isEn: isEn, tr: tr, toEn: toEn, date: date, dateEn: dateEn, usd: usd, krw: krw, money: money, koUsd: koUsd,
    set: function (l) { setLang(l); }, url: function (l) { return withLang(root.location ? root.location.href : "", l); } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MTI18N = api;
  if (typeof document === "undefined") return;

  // ---------- language switch ----------
  function withLang(href, l) { try { var u = new URL(href); if (u.searchParams.has("lang")) u.searchParams.set("lang", l); return u.toString(); } catch (e) { return href; } }
  function setLang(l) {
    l = l === "en" ? "en" : "ko";
    try { root.localStorage.setItem(KEY, l); } catch (e) { }
    // A shared ?lang= in the address would win over the saved choice, so keep it in sync, then reload so every part of the page rebuilds.
    var h = withLang(root.location.href, l);
    if (h !== root.location.href) root.location.replace(h); else root.location.reload();
  }
  document.documentElement.lang = lang;

  function buildButton() {
    if (document.getElementById("mtLangBtn")) return;
    var b = document.createElement("button"); b.id = "mtLangBtn"; b.type = "button";
    var ui = UI[lang];
    b.setAttribute("aria-label", ui.aria); b.title = ui.title; b.setAttribute("data-mt-lang", lang);
    var ko = document.createElement("span"), sep = document.createTextNode("/"), en = document.createElement("span");
    ko.textContent = "KO"; en.textContent = "EN";
    (isEn ? en : ko).className = "on";
    b.append(ko, sep, en);
    b.addEventListener("click", function () { setLang(isEn ? "ko" : "en"); });
    var header = document.querySelector("header.bar") || document.querySelector("header");
    var css = document.createElement("style");
    css.textContent = "#mtLangBtn{font:700 12px ui-monospace,Menlo,Consolas,monospace;height:30px;min-width:64px;padding:0 10px;border-radius:8px;border:1px solid #2f8a55;background:#04150df2;color:#7fa58f;cursor:pointer;white-space:nowrap;letter-spacing:.04em;flex:none}" +
      "#mtLangBtn .on{color:#5dff9e;text-decoration:underline;text-underline-offset:3px}#mtLangBtn:hover{border-color:#5dff9e}" +
      "#mtLangBtn.fixed{position:fixed;z-index:2100;top:8px;right:8px}";
    (document.head || document.documentElement).appendChild(css);
    if (header) { var fs = header.querySelector("#fullscreen"); if (fs) header.insertBefore(b, fs); else header.appendChild(b); }
    else { b.className = "fixed"; document.body.appendChild(b); }
  }

  // ---------- DOM translation (EN only) ----------
  var ATTRS = ["placeholder", "aria-label", "title", "alt", "data-l", "content"];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };
  function node(n) {
    if (n.nodeType === 3) {
      var p = n.parentNode; if (p && SKIP[p.nodeName]) return;
      var v = n.nodeValue, t = toEn(v); if (t !== v) n.nodeValue = t;
    } else if (n.nodeType === 1) {
      if (SKIP[n.nodeName]) return;
      if (n.nodeName === "META") { var nm = n.getAttribute("name") || n.getAttribute("property") || ""; if (!/^(description|og:title|og:description|og:site_name|twitter:title|twitter:description)$/.test(nm)) return; }
      for (var i = 0; i < ATTRS.length; i++) {
        var a = ATTRS[i]; if (a === "content" && n.nodeName !== "META") continue;
        if (n.hasAttribute(a)) { var av = n.getAttribute(a), at = toEn(av); if (at !== av) n.setAttribute(a, at); }
      }
      for (var c = n.firstChild; c; c = c.nextSibling) node(c);
    }
  }
  if (isEn) {
    var busy = false;
    var obs = new MutationObserver(function (list) {
      if (busy) return; busy = true;
      try {
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (m.type === "childList") m.addedNodes.forEach(node);
          else if (m.type === "characterData") node(m.target);
          else if (m.type === "attributes") { var a = m.attributeName, v = m.target.getAttribute(a), t = toEn(v); if (t !== v) m.target.setAttribute(a, t); }
        }
      } finally { busy = false; }
      obs.takeRecords();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    var full = function () { busy = true; try { node(document.documentElement); } finally { busy = false; } obs.takeRecords(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", full); else full();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildButton); else buildButton();
})();
