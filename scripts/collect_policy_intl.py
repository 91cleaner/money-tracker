#!/usr/bin/env python3
"""해외 공식 정책 출처 → data/policy/{cc}.json (kr.json과 같은 항목 형식: id,kind,t,d,u,src,dept,tags).
사용: python3 scripts/collect_policy_intl.py jp|eu|cn|tw. 제목 키워드 태그(영향 단정 아님). 투자 조언 아님."""
import datetime as dt, hashlib, html, json, os, re, sys, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "money-tracker (github.com/91cleaner/money-tracker) public-data collector"}
TAGS = {  # 다국어 제목 키워드 → 섹터
    "semiconductor": r"半導体|semiconductor|\bchips?\b|晶片|芯片|積體電路|集成电路",
    "battery_ev": r"蓄電池|電池|battery|batteries|電動車|电动汽车|新能源汽车|lithium|リチウム|锂",
    "auto": r"自動車|汽车|汽車|automotive|motor vehicle",
    "tech_ai": r"人工知能|\bAI\b|artificial intelligence|情報通信|電気通信|データ|digital|数字|數位|人工智能|資通訊|cyber|サイバー",
    "shipbuilding": r"造船|船舶|海運|shipbuild|maritime|航運",
    "defense": r"防衛|defen[cs]e|国防|國防|軍|dual-use|両用|两用",
    "energy": r"エネルギー|電力|原子力|ガス|石油|水素|energy|electricity|能源|電力|核",
    "clean_energy": r"脱炭素|再生可能|太陽光|風力|CBAM|carbon|climate|renewable|碳|綠能|绿色",
    "health": r"医薬品|医療|薬|pharma|medic|health|医药|醫藥|醫療",
    "trade": r"関税|輸出|輸入|貿易|外為|tariff|anti-dumping|export|import|trade|关税|出口|进口|貿易|關稅|輸出|管制",
    "finance": r"金融|銀行|bank|financial|securities|証券|证券", "crypto": r"暗号資産|crypto|数字货币|虛擬資產",
    "industrial": r"鉄鋼|steel|aluminium|aluminum|钢|鋼|稀土|rare earth|critical raw|重要鉱物|关键矿产"}
def get(u, t=40):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t) as r: return r.read()
def tags(t): return [k for k, rx in TAGS.items() if re.search(rx, t, re.I)]
def hid(*a): return hashlib.sha1("|".join(a).encode()).hexdigest()[:12]
def T(x): return html.unescape(re.sub(r"<[^>]+>", "", x or "")).strip()
# ---------- 일본 ----------
def jp():
    out = []
    b = get("https://public-comment.e-gov.go.jp/rss/pcm_list.xml").decode("utf-8", "replace")
    for it in re.findall(r"<item [^>]*>(.*?)</item>", b, re.S):
        t = T(re.search(r"<title>(.*?)</title>", it, re.S).group(1)); u = html.unescape(re.search(r"<link>(.*?)</link>", it).group(1)); ds = T(re.search(r"<description>(.*?)</description>", it, re.S).group(1))
        d = re.search(r"公示日：(\d{4})/(\d{2})/(\d{2})", ds); dept = re.search(r"問合せ先（[^）]*）：([^\s　]+?(省|庁|府|委員会|院))", ds)
        cat = re.search(r"カテゴリー：([^<\n]+)", ds)
        out.append({"id": "egov:" + (re.search(r"id=(\d+)", u) or [0, hid(t)])[1], "kind": "pubcomment", "t": t, "d": "-".join(d.groups()) if d else None, "u": u, "dept": dept.group(1) if dept else None,
                    "src": "e-Gov パブリックコメント(意見募集)", "tags": tags(t + " " + (cat.group(1) if cat else ""))})
    try:
        b = get("https://www.kantei.go.jp/index-jnews.rdf").decode("utf-8", "replace")
        for it in re.findall(r"<item>(.*?)</item>", b, re.S):
            t = T(re.search(r"<title>(.*?)</title>", it, re.S).group(1)); u = T(re.search(r"<link>(.*?)</link>", it, re.S).group(1))
            pd = re.search(r"<pubDate>\w+, (\d+ \w+ \d{4})", it); d = dt.datetime.strptime(pd.group(1), "%d %b %Y").date().isoformat() if pd else None
            out.append({"id": "kantei:" + hid(u), "kind": "news", "t": t, "d": d, "u": u, "dept": "首相官邸", "src": "首相官邸 新着情報", "tags": tags(t)})
    except Exception as e: print("kantei fail", type(e).__name__)
    return out, {"source": "e-Gov パブリックコメント RSS + 首相官邸 新着情報 RSS", "source_url": "https://public-comment.e-gov.go.jp/rss/pcm_list.xml"}
def jpx():
    """JPX 上場銘柄一覧(東証) → data/jp/listed.json {date,n,c:{code:[name,market,33業種,17業種]}}"""
    import io, openpyxl
    page = get("https://www.jpx.co.jp/markets/statistics-equities/misc/01.html").decode("utf-8", "replace")
    m = re.search(r'href="([^"]+data_j\.xlsx?)"', page); u = "https://www.jpx.co.jp" + m.group(1)
    ws = openpyxl.load_workbook(io.BytesIO(get(u, 90)), read_only=True).active; c = {}; day = None
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r or not r[1]: continue
        day = day or str(r[0]); c[str(r[1])] = [r[2], r[3], r[5], r[7]]
    p = os.path.join(ROOT, "data", "jp", "listed.json"); os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump({"date": f"{day[:4]}-{day[4:6]}-{day[6:8]}" if day else None, "source": "JPX 東証上場銘柄一覧", "source_url": u, "n": len(c), "c": c}, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
    print("jpx listed", len(c))
# ---------- EU ----------
FOCUS = {"chips": r"Chips Act|semiconductor", "dual_use": r"dual-use|dual use|export control", "anti_dumping": r"anti-dumping|countervailing|anti-subsidy|safeguard",
         "cbam": r"carbon border|CBAM", "batteries": r"batter(y|ies)", "sanctions": r"restrictive measures"}
FK = {"chips": "반도체법·반도체", "dual_use": "이중용도·수출통제", "anti_dumping": "반덤핑·상계관세", "cbam": "탄소국경조정(CBAM)", "batteries": "배터리", "sanctions": "제재(제한조치)"}
def eu():
    import urllib.parse
    out = []; since = (dt.date.today() - dt.timedelta(days=int(os.environ.get("DAYS") or 45))).isoformat()
    q = """PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?date ?title WHERE { ?w cdm:resource_legal_id_celex ?celex ; cdm:work_date_document ?date .
 FILTER(?date >= "%s"^^<http://www.w3.org/2001/XMLSchema#date>) FILTER(REGEX(STR(?celex), "^3[0-9]{4}[RDL][0-9]+$"))
 ?e cdm:expression_belongs_to_work ?w ; cdm:expression_title ?title ; cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> .
} ORDER BY DESC(?date) LIMIT 1500""" % since
    q2 = q.replace('"%s"' % since, '"%s"' % (dt.date.today() - dt.timedelta(days=1100)).isoformat()).replace("} ORDER BY", 'FILTER(REGEX(?title, "Chips Act|semiconductor|dual-use|carbon border|batter|critical raw", "i")) } ORDER BY').replace("LIMIT 1500", "LIMIT 400")
    B = []
    for qq in (q, q2):
        try: B += json.loads(get("https://publications.europa.eu/webapi/rdf/sparql?" + urllib.parse.urlencode({"query": qq, "format": "application/sparql-results+json"}), 150))["results"]["bindings"]
        except Exception as e: print("sparql fail", type(e).__name__)
    for b in B:
        c = b["celex"]["value"]; t = b["title"]["value"]; f = [k for k, rx in FOCUS.items() if re.search(rx, t, re.I)]
        kind = {"R": "regulation", "D": "decision", "L": "directive"}[c[5]]
        out.append({"id": "celex:" + c, "kind": kind, "t": t[:400], "d": b["date"]["value"], "u": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:" + c, "dept": "EU 관보(Official Journal)",
                    "src": "EUR-Lex/Publications Office SPARQL", "tags": tags(t), "focus": f, "focus_ko": [FK[x] for x in f]})
    p = json.loads(get("https://ec.europa.eu/commission/presscorner/api/search?language=en&pagesize=100&documentType=IP"))
    for r in p.get("docuLanguageListResources") or []:
        if (r.get("docutype") or {}).get("code") not in ("IP", "STATEMENT", "QANDA"): continue
        t = r.get("title") or ""; ref = r.get("refCode") or ""; f = [k for k, rx in FOCUS.items() if re.search(rx, t + " " + (r.get("leadText") or ""), re.I)]
        out.append({"id": "ec:" + ref, "kind": "press", "t": t, "d": r.get("eventDate"), "u": "https://ec.europa.eu/commission/presscorner/detail/en/" + ref.lower().replace("/", "_"), "dept": "EU 집행위원회",
                    "src": "European Commission Press corner", "tags": tags(t + " " + (r.get("leadText") or "")), "focus": f, "focus_ko": [FK[x] for x in f]})
    return out, {"source": "EUR-Lex/Publications Office SPARQL(규칙·결정·지침) + European Commission Press corner", "source_url": "https://op.europa.eu/en/web/webtools/linked-data-and-sparql"}
SRC = {"jp": jp, "eu": eu}
def main():
    cc = sys.argv[1]; p = os.path.join(ROOT, "data", "policy", f"{cc}.json"); os.makedirs(os.path.dirname(p), exist_ok=True)
    old = json.load(open(p)) if os.path.exists(p) else {"items": []}; seen = {i["id"]: i for i in old["items"]}; n0 = len(seen)
    items, meta = SRC[cc]()
    for i in items:
        if i.get("t"): seen[i["id"]] = i
    if cc == "jp":
        try: jpx()
        except Exception as e: print("jpx fail", type(e).__name__)
    L = sorted(seen.values(), key=lambda x: x.get("d") or "", reverse=True)[:800]
    json.dump({"updated": dt.date.today().isoformat(), "country": cc, **meta, "note": "항목별 src에 출처. 제목 키워드 태그(영향 단정 아님). 투자 조언 아님.", "items": L}, open(p, "w"), ensure_ascii=False, indent=0)
    print(cc, "fetched", len(items), "new", len(L) - n0, "total", len(L))
    if not L: sys.exit(1)
if __name__ == "__main__": main()
