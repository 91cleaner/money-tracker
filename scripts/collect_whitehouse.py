#!/usr/bin/env python3
"""백악관·대통령 조치 → data/us/whitehouse.json.
출처: Federal Register API(키 불필요) 대통령 문서(행정명령·포고문·메모·결정·공고) + BIS 수출통제·USTR·OFAC 규칙,
whitehouse.gov presidential-actions RSS(최신분, 관보 게재 전 보완). 섹터·국가·종목 태그는 제목/요약 키워드 기준(영향 단정 아님)."""
import datetime as dt, json, os, re, sys, html, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, "data", "us", "whitehouse.json")
UA = {"User-Agent": "money-tracker (github.com/91cleaner/money-tracker) public-data collector"}
TYPES = {"executive_order": "행정명령", "proclamation": "포고문", "memorandum": "대통령 메모", "determination": "대통령 결정", "notice": "대통령 공고"}
AG = {"industry-and-security-bureau": "상무부 BIS(수출통제)", "trade-representative-office-of-united-states": "USTR(무역대표부)", "foreign-assets-control-office": "재무부 OFAC(제재)"}
SECT = {"semiconductor": r"semiconductor|chip|integrated circuit|wafer|lithograph", "tech_ai": r"artificial intelligence|\bAI\b|computing|software|data center|cyber|telecommunication|technology",
        "energy": r"energy|oil|petroleum|natural gas|\bLNG\b|coal|electric grid|power plant|nuclear", "clean_energy": r"solar|wind|renewable|climate|carbon|hydrogen",
        "battery_ev": r"batter|lithium|electric vehicle|critical mineral|graphite|cobalt|rare earth", "auto": r"automobile|motor vehicle|auto parts|automotive|truck",
        "health": r"pharmaceutical|prescription drug|drug pric|medicare|medicaid|medical|health|biotech|vaccine", "defense": r"defense|military|armed forces|munition|weapon", "shipbuilding": r"shipbuild|maritime|vessel|naval|\bports?\b",
        "industrial": r"steel|aluminum|copper|lumber|timber|manufactur|infrastructure|industrial", "finance": r"\bbank|financial|securities|debt limit|investment", "crypto": r"crypto|digital asset|bitcoin|stablecoin",
        "consumer": r"consumer|retail|agricultur|food|seafood|beef|apparel", "housing": r"housing|mortgage|home ownership"}
TOPIC = {"tariff": r"tariff|dut(y|ies)|section 232|section 301|reciprocal|import", "export_control": r"export control|export administration|entity list|foreign direct product", "sanctions": r"sanction|blocking property|OFAC|designat"}
CTRY = {"cn": r"china|chinese|people's republic|\bPRC\b|hong kong", "ca": r"canad", "mx": r"mexic", "jp": r"japan", "kr": r"korea", "tw": r"taiwan", "eu": r"european union|\bEU\b", "in": r"\bindia", "br": r"brazil",
        "ru": r"russia", "ir": r"\biran", "ve": r"venezuel", "vn": r"vietnam", "de": r"german", "gb": r"united kingdom|\bUK\b|britain", "il": r"israel", "ua": r"ukrain", "sa": r"saudi", "ch": r"switzerland|swiss"}
CK = {"cn": "중국", "ca": "캐나다", "mx": "멕시코", "jp": "일본", "kr": "한국", "tw": "대만", "eu": "EU", "in": "인도", "br": "브라질", "ru": "러시아", "ir": "이란", "ve": "베네수엘라", "vn": "베트남", "de": "독일", "gb": "영국", "il": "이스라엘", "ua": "우크라이나", "sa": "사우디", "ch": "스위스"}
SK = {"semiconductor": "반도체", "tech_ai": "AI·기술", "energy": "에너지", "clean_energy": "청정에너지", "battery_ev": "배터리·광물", "auto": "자동차", "health": "제약·헬스", "defense": "국방", "shipbuilding": "조선·해운",
      "industrial": "철강·산업", "finance": "금융", "crypto": "가상자산", "consumer": "소비재·농식품", "housing": "주택"}
TK = {"NVDA": r"nvidia", "INTC": r"\bintel\b", "AMD": r"advanced micro devices|\bAMD\b", "TSM": r"taiwan semiconductor|\bTSMC\b", "MU": r"micron", "AAPL": r"\bapple inc", "MSFT": r"microsoft", "GOOGL": r"alphabet|google",
      "META": r"\bmeta platforms", "AMZN": r"amazon", "TSLA": r"tesla", "BA": r"boeing", "LMT": r"lockheed", "X": r"united states steel|u\.s\. steel", "NUE": r"nucor", "F": r"ford motor", "GM": r"general motors", "PFE": r"pfizer",
      "LLY": r"eli lilly", "MRK": r"merck", "ASML": r"\basml\b", "QCOM": r"qualcomm", "AVGO": r"broadcom", "ORCL": r"oracle", "XOM": r"exxon", "CVX": r"chevron"}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r: return r.read()
def tag(s):
    f = lambda D: [k for k, rx in D.items() if re.search(rx, s, re.I)]
    if re.search(r"(Month|Day|Week|Year), \d{4}", s, re.I): return [], f(TOPIC), f(CTRY), f(TK)  # 기념 포고문은 섹터 태그 안 함
    return f(SECT), f(TOPIC), f(CTRY), f(TK)
def ko(typ, sec, top, ctr):
    bits = [{"tariff": "관세", "export_control": "수출통제", "sanctions": "제재"}[t] for t in top] + [SK[x] for x in sec[:2]] + [CK[c] for c in ctr[:2]]
    return f"[{typ}] " + ("·".join(bits) if bits else "기타") + " 관련(제목 키워드 기준)"
def fr(params):
    out, page = [], 1
    while True:
        q = params + [("per_page", "1000"), ("page", str(page)), ("order", "newest")] + [("fields[]", f) for f in ("title", "type", "signing_date", "publication_date", "html_url", "document_number", "executive_order_number", "abstract", "agencies")]
        d = json.loads(get("https://www.federalregister.gov/api/v1/documents.json?" + urllib.parse.urlencode(q))); out += d.get("results") or []
        if not d.get("next_page_url") or page >= 10: return out
        page += 1
def main():
    old = json.load(open(OUT)) if os.path.exists(OUT) else {"items": []}; seen = {i["id"]: i for i in old["items"]}
    days = int(os.environ.get("DAYS") or (14 if old["items"] else 730)); since = (dt.date.today() - dt.timedelta(days=days)).isoformat(); n0 = len(seen)
    P = [("conditions[publication_date][gte]", since)]
    pres = []
    for t in TYPES:
        for d in fr(P + [("conditions[type][]", "PRESDOCU"), ("conditions[presidential_document_type][]", t)]): d["presidential_document_type"] = t; pres.append(d)
    rules = fr(P + [("conditions[type][]", "RULE")] + [("conditions[agencies][]", a) for a in AG])
    ustr = [d for d in fr(P + [("conditions[type][]", "NOTICE"), ("conditions[agencies][]", "trade-representative-office-of-united-states")]) if re.search(TOPIC["tariff"] + "|section 301", (d.get("title") or "") + " " + (d.get("abstract") or ""), re.I)]
    rules += ustr
    for d in pres + rules:
        pt = d.get("presidential_document_type"); s = (d.get("title") or "") + " " + (d.get("abstract") or "")
        sec, top, ctr, tks = tag(s); ag = [AG[a.get("slug")] for a in d.get("agencies") or [] if a.get("slug") in AG]
        typ = TYPES.get(pt) if pt else (ag[0] if ag else "규칙")
        if not pt and "상무부 BIS" in typ and "export_control" not in top: top.append("export_control")
        if not pt and "OFAC" in typ and "sanctions" not in top: top.append("sanctions")
        seen["fr:" + d["document_number"]] = {"id": "fr:" + d["document_number"], "kind": "presdoc" if pt else "rule", "type": typ, "eo": d.get("executive_order_number"), "date": d.get("publication_date"), "sign": d.get("signing_date"),
            "t": d.get("title"), "ko": ko(typ, sec, top, ctr), "u": d.get("html_url"), "src": "Federal Register(관보)", "sectors": sec, "topics": top, "countries": ctr, "tickers": tks}
    wn = 0
    try:
        x = get("https://www.whitehouse.gov/presidential-actions/feed/").decode("utf-8", "replace"); have = {re.sub(r"\W", "", (i.get("t") or "").lower())[:80] for i in seen.values()}
        for it in re.findall(r"<item>(.*?)</item>", x, re.S):
            t = html.unescape(re.search(r"<title>(.*?)</title>", it, re.S).group(1)).strip(); u = re.search(r"<link>(.*?)</link>", it).group(1).strip()
            pd = dt.datetime.strptime(re.search(r"<pubDate>(.*?)</pubDate>", it).group(1)[5:16], "%d %b %Y").date().isoformat()
            if re.sub(r"\W", "", t.lower())[:80] in have: continue
            m = re.search(r"/presidential-actions/\d{4}/\d{2}/([^/]+)", u); i = "wh:" + (m.group(1)[:80] if m else u[-60:]); sec, top, ctr, tks = tag(t); wn += i not in seen
            typ = "행정명령" if "executive-order" in u or re.search(r"^executive order", t, re.I) else ("포고문" if re.search(r"proclamation|month, \d{4}|day, \d{4}|week, \d{4}", t, re.I) else "대통령 조치")
            seen[i] = {"id": i, "kind": "presdoc", "type": typ, "eo": None, "date": pd, "sign": pd, "t": t.title() if t.isupper() else t, "ko": ko(typ, sec, top, ctr), "u": u, "src": "whitehouse.gov(관보 게재 전)",
                       "sectors": sec, "topics": top, "countries": ctr, "tickers": tks}
    except Exception as e: print("wh feed fail", type(e).__name__)
    # 관보 게재되면 wh: 중복 제거
    frt = {re.sub(r"\W", "", (i["t"] or "").lower())[:80] for k, i in seen.items() if k.startswith("fr:")}
    for k in [k for k, i in seen.items() if k.startswith("wh:") and re.sub(r"\W", "", (i["t"] or "").lower())[:80] in frt]: del seen[k]
    items = sorted(seen.values(), key=lambda i: (i.get("date") or "", i["id"]), reverse=True)
    json.dump({"updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "source": "Federal Register API(대통령 문서·BIS·USTR·OFAC 규칙) + whitehouse.gov presidential-actions RSS", "source_url": "https://www.federalregister.gov/developers/documentation/api/v1",
               "note": "date=관보 게재일(whitehouse.gov 항목은 게시일), sign=서명일. ko는 제목 키워드로 만든 짧은 분류(번역 아님). 섹터·국가·종목 태그는 키워드 기준, 영향 단정 아님. 투자 조언 아님.", "items": items},
              open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print("pres", len(pres), "rules", len(rules), "wh_feed_new", wn, "total", len(items), "new", len(items) - n0)
    if not items: sys.exit(1)
if __name__ == "__main__": main()
