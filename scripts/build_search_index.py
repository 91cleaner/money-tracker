#!/usr/bin/env python3
"""누적 데이터 → data/search-index.json (검색 개체 + 자동 생성 경로).

입력: data/market/company-links.json, data/market/sectors.json, data/us/members.json(위원회 이름만),
      data/us/ticker-sectors.json(있으면), data/us/trades.json(하원 PTR 신고 거래).
경로의 사실·출처는 모두 입력 데이터에서 가져온다. 손으로 쓴 사실 없음.
미국 하원 의원 주식 거래(data/us/trades.json, PTR 신고 기준)는 2026-10-28 결정으로 공개. AI 미연결.
  python3 scripts/build_search_index.py
"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *p: json.load(open(os.path.join(ROOT, *p)))
OUT = os.path.join(ROOT, "data", "search-index.json")

CENT = {  # 나라·지역 대표 좌표(근사)
 "us": ("미국", "United States", 39.0, -98.0), "kr": ("한국", "South Korea", 36.4, 127.8),
 "tw": ("대만", "Taiwan", 23.7, 121.0), "jp": ("일본", "Japan", 36.0, 138.0),
 "cn": ("중국", "China", 35.0, 104.0), "eu": ("유럽", "Europe", 50.5, 9.0),
 "uk": ("영국", "United Kingdom", 54.0, -2.0), "commodity": ("국제 원자재 시장", "Global commodities", 25.0, -40.0),
 "dc": ("미국 워싱턴 D.C.(의회)", "Washington D.C.", 38.8899, -77.0091),
}
CITY_LL = {  # SEC 사업장 주소 도시 → 좌표(공개 지명 좌표 근사). 없으면 주 중심 근사.
 "NEW YORK,NY": (40.7128, -74.006), "HOUSTON,TX": (29.7604, -95.3698), "SAN FRANCISCO,CA": (37.7749, -122.4194),
 "ATLANTA,GA": (33.749, -84.388), "CHICAGO,IL": (41.8781, -87.6298), "DALLAS,TX": (32.7767, -96.797),
 "BOSTON,MA": (42.3601, -71.0589), "SAN JOSE,CA": (37.3382, -121.8863), "AUSTIN,TX": (30.2672, -97.7431),
 "SAN DIEGO,CA": (32.7157, -117.1611), "SANTA CLARA,CA": (37.3541, -121.9552), "MILWAUKEE,WI": (43.0389, -87.9065),
 "STAMFORD,CT": (41.0534, -73.5387), "DENVER,CO": (39.7392, -104.9903), "ARLINGTON,VA": (38.8816, -77.091),
 "PHILADELPHIA,PA": (39.9526, -75.1652), "CAMBRIDGE,MA": (42.3736, -71.1097), "SEATTLE,WA": (47.6062, -122.3321),
 "MINNEAPOLIS,MN": (44.9778, -93.265), "CHARLOTTE,NC": (35.2271, -80.8431), "RESTON,VA": (38.9586, -77.357),
 "WILMINGTON,DE": (39.7391, -75.5398), "PHOENIX,AZ": (33.4484, -112.074), "NASHVILLE,TN": (36.1627, -86.7816),
 "PALO ALTO,CA": (37.4419, -122.143), "TEMPE,AZ": (33.4255, -111.94), "IRVING,TX": (32.814, -96.9489),
 "MIAMI,FL": (25.7617, -80.1918), "JACKSONVILLE,FL": (30.3322, -81.6557), "CINCINNATI,OH": (39.1031, -84.512),
 "INDIANAPOLIS,IN": (39.7684, -86.1581), "WALTHAM,MA": (42.3765, -71.2356), "MOUNTAIN VIEW,CA": (37.3861, -122.0839),
 "PITTSBURGH,PA": (40.4406, -79.9959), "CLEVELAND,OH": (41.4993, -81.6944), "COLUMBUS,OH": (39.9612, -82.9988),
 "MEMPHIS,TN": (35.1495, -90.049), "NORWALK,CT": (41.1177, -73.4082), "ST LOUIS,MO": (38.627, -90.1994),
 "LAS VEGAS,NV": (36.1699, -115.1398), "CUPERTINO,CA": (37.323, -122.0322), "REDMOND,WA": (47.674, -122.1215),
 "MENLO PARK,CA": (37.453, -122.1817), "BETHESDA,MD": (38.9847, -77.0947), "SUNNYVALE,CA": (37.3688, -122.0363),
 "LONDON,X0": (51.5074, -0.1278), "TORONTO,A6": (43.6532, -79.3832), "DUBLIN,L2": (53.3498, -6.2603),
}
def hq_ll(t, st_ll):
    k = (t.get("hq_city") or "").upper() + "," + (t.get("hq_state_or_country") or "")
    if k in CITY_LL: return list(CITY_LL[k]), "도시 좌표"
    if t.get("hq_state_or_country") in st_ll: return st_ll[t["hq_state_or_country"]], "주 중심 근사"
    return None, None
SEC_FOREIGN = {"F4": "cn", "F5": "tw", "M5": "kr", "M0": "jp", "X0": "uk", "K3": "cn"}
def factor_country(fid):
    for p, c in (("kr_", "kr"), ("tw_", "tw"), ("jp_", "jp"), ("cn_", "cn"), ("us_", "us"), ("uk_", "uk"), ("ecb_", "eu"),
                 ("fx_krw", "kr"), ("fx_twd", "tw"), ("fx_jpy", "jp"), ("fx_eur", "eu")):
        if fid.startswith(p): return c
    return None
# SEC SIC 섹터 → sectors.json id
SEC2APP = {"technology": "tech_ai", "communications": "tech_ai", "healthcare": "health", "financials": "finance",
 "real_estate": "housing", "energy": "energy", "utilities": "energy", "mining": "industrial", "aerospace_defense": "defense",
 "industrials": "industrial", "transportation": "industrial", "construction": "housing", "consumer_staples": "consumer",
 "consumer_discretionary": "consumer", "materials": "industrial", "agriculture": "consumer"}
SEMI_SIC = {"3674", "3559"}
# 앱 섹터 → 상임위(공식 이름은 members.json cmits에서 확인된 것만 사용)
APP_CMTE = {"semiconductor": ["Commerce, Science, and Transportation", "House Select the Strategic Competition Between the United States and the Chinese Communist Party"],
 "tech_ai": ["Commerce, Science, and Transportation", "Energy and Commerce"], "finance": ["Banking, Housing, and Urban Affairs", "Financial Services"],
 "energy": ["Energy and Natural Resources", "Energy and Commerce"], "clean_energy": ["Energy and Natural Resources", "Environment and Public Works"],
 "battery_ev": ["Energy and Natural Resources", "Energy and Commerce"], "auto": ["Commerce, Science, and Transportation", "Energy and Commerce"],
 "defense": ["Armed Services"], "shipbuilding": ["Armed Services", "Transportation and Infrastructure"],
 "health": ["Health, Education, Labor, and Pensions", "Energy and Commerce"], "housing": ["Banking, Housing, and Urban Affairs", "Financial Services"],
 "industrial": ["Commerce, Science, and Transportation", "Transportation and Infrastructure"], "consumer": ["Commerce, Science, and Transportation", "Energy and Commerce"],
 "crypto": ["Banking, Housing, and Urban Affairs", "Financial Services"]}  # safe_haven·market는 근거 약해 연결 안 함

SECTOR_KW = {  # 검색용 한/영 키워드(사실 아님, 검색어 연결용)
 "defense": ["방산", "방위", "국방", "우주", "항공", "항공우주", "space", "aerospace", "defense", "스페이스", "로켓", "미사일"],
 "semiconductor": ["반도체", "칩", "chip", "chips", "semiconductor", "파운드리", "메모리", "gpu"],
 "battery_ev": ["전기차", "배터리", "2차전지", "이차전지", "ev", "battery", "리튬"],
 "auto": ["자동차", "차", "car", "auto"], "finance": ["은행", "금융", "보험", "bank", "banks", "finance"],
 "energy": ["석유", "원유", "가스", "oil", "gas", "에너지"], "health": ["제약", "바이오", "헬스케어", "병원", "pharma", "biotech", "신약"],
 "tech_ai": ["ai", "인공지능", "소프트웨어", "클라우드", "software", "cloud", "빅테크"], "housing": ["부동산", "주택", "건설", "housing"],
 "shipbuilding": ["조선", "해운", "선박", "ship"], "clean_energy": ["태양광", "풍력", "청정에너지", "탄소", "solar"],
 "consumer": ["소비재", "명품", "유통", "리테일", "retail"], "crypto": ["코인", "비트코인", "가상자산", "crypto", "bitcoin"],
 "safe_haven": ["금", "채권", "gold", "bond"], "industrial": ["기계", "산업재", "industrial"], "market": ["시장", "증시", "지수", "market"],
}
KR_NOTE = " 관세청이 품목 코드(HS 4자리)로 센 숫자라서, 산업부가 발표하는 '반도체' 전체 수출과 범위가 달라요."
KR_ALIASES = {  # 한국 주요 종목 별명(검색어 연결용, 사실 아님)
 "005930.KS": ["삼성", "삼전", "삼성 반도체", "삼성반도체", "삼성전자 반도체", "samsung", "samsung electronics", "삼성 전자"],
 "000660.KS": ["하이닉스", "하닉", "닉스", "sk hynix", "hynix", "에스케이하이닉스", "sk 하이닉스", "하이닉스 반도체"],
 "005380.KS": ["현대자동차", "현차", "현대 자동차", "hyundai motor", "hyundai"],
 "006400.KS": ["삼성sdi", "삼성 sdi", "삼성에스디아이", "samsung sdi", "삼성 배터리", "에스디아이"],
 "012450.KS": ["한화에어로", "한화 에어로", "한화에어로스페이스", "hanwha aerospace", "한화 방산", "한화 우주"],
 "035420.KS": ["naver", "네이버 포털", "네이버 ai"],
 "105560.KS": ["kb", "kb금융지주", "kb 금융", "kb financial"],
 "207940.KS": ["삼바", "삼성바이오", "삼성 바이오", "samsung biologics", "삼성 바이오로직스"],
 "329180.KS": ["현대중공업", "hd현대중공업", "hd 현대중공업", "hd hyundai heavy", "hd현대 조선", "현대 조선"],
 "373220.KS": ["엘지에너지솔루션", "lg에너지솔루션", "lg 에너지솔루션", "엔솔", "lg엔솔", "lges", "lg energy solution", "lg 배터리"],
}
def josa(w, a, b):
    """받침 있으면 a, 없으면 b (은/는, 이/가)."""
    ch = (w or " ")[-1]
    if "가" <= ch <= "힣": return a if (ord(ch) - 0xAC00) % 28 else b
    return b
def fmt(lt):
    v = lt.get("value")
    if isinstance(v, (int, float)) and lt.get("unit") == "usd" and v >= 1e8: return f"약 {v/1e8:,.1f}억 달러"
    return f"{v:,}" if isinstance(v, (int, float)) else str(v)

def usd(v):
    if v is None: return "-"
    v = float(v)
    if v >= 1e8: return f"약 {v/1e8:,.1f}억 달러"
    if v >= 1e4: return f"약 {v/1e4:,.0f}만 달러"
    return f"{v:,.0f}달러"
def opt(*p):
    f = os.path.join(ROOT, *p)
    try: return json.load(open(f)) if os.path.exists(f) else {}
    except ValueError: return {}
AW = LB = PC = {}
def money_stops(tk, st_ll, bills_by_no):
    """연방 계약·로비·PAC 정류장 (data/us 수집 파일 값만 사용)."""
    out, d = [], CENT["dc"]
    fa = AW.get("companies", {}).get(tk)
    if fa and fa.get("total_usd"):
        s0 = (fa.get("top_states") or [{}])[0]; ll = st_ll.get(s0.get("code")); ag = (fa.get("top_agencies") or [{}])[0]
        if ll:
            p = AW.get("period", ["", ""])
            out.append({"region": f"연방 계약 · {s0.get('name')}", "lat": ll[0], "lon": ll[1], "title": "연방 계약(USAspending)", "kind": "award",
                "fact": f"데이터상 {p[0]}~{p[1]} 연방 계약 합계 {usd(fa['total_usd'])}. 최다 발주 기관 {ag.get('name','-')}, 주별 집계 1위 {s0.get('name','-')}. 수령자 이름 일치 기준.",
                "source_url": fa["source_url"], "date": AW.get("updated"), "ref": "awards:" + tk})
    lb = LB.get("companies", {}).get(tk)
    if lb and lb.get("filings"):
        iss = ", ".join(i[0] for i in lb.get("top_issues", [])[:3]); yrs = LB.get("years", ["", ""])
        linked = [b for b, _ in lb.get("bills_mentioned", []) if b in bills_by_no][:3]
        fact = f"데이터상 {yrs[0]}~{yrs[-1]} 로비 공시 {lb['filings']}건, 보고 금액 합계 {usd(lb['total_usd'])}. 주요 이슈: {iss or '-'}."
        if linked: fact += " 수집 법안과 번호 일치: " + ", ".join(linked) + "(회기 확인 필요)."
        out.append({"region": f"{d[0]} · 로비", "lat": d[2] + 0.03, "lon": d[3] - 0.04, "title": "로비 공시(LDA)", "kind": "lobby", "fact": fact,
            "source_url": lb["source_url"], "date": LB.get("updated"), "ref": "lobbying:" + tk, "links": [{"label": b, "url": bills_by_no[b]} for b in linked]})
    pc = PC.get("companies", {}).get(tk)
    if pc and pc.get("to_federal_candidates_usd") is not None:
        out.append({"region": f"{d[0]} · 후원", "lat": d[2] - 0.03, "lon": d[3] + 0.04, "title": "기업 연계 PAC 후원(FEC)", "kind": "pac",
            "fact": f"데이터상 {pc['cycle']} 선거주기 {pc['committee_name']}의 연방 후보 위원회 기부 합계 {usd(pc['to_federal_candidates_usd'])}(~{pc.get('coverage_end')}). 임직원 자발 기부 PAC이며 회사 자금 아님.",
            "source_url": pc["source_url"], "date": pc.get("coverage_end"), "ref": "pac:" + tk})
    return out

TY = {"P": "구입(P)", "S": "처분(S)", "E": "교환(E)"}
KO_MEM = {"Gilbert Cisneros": "길버트 시스네로스", "Lisa McClain": "리사 매클레인", "April McClain Delaney": "에이프릴 매클레인 딜레이니", "Julie Johnson": "줄리 존슨",
    "Kevin Hern": "케빈 헌", "Josh Gottheimer": "조시 고트하이머", "Maria Elvira Salazar": "마리아 엘비라 살라자르", "Jared Moskowitz": "재러드 모스코위츠",
    "Marjorie Taylor Greene": "마조리 테일러 그린", "Byron Donalds": "바이런 도널즈", "Ro Khanna": "로 칸나", "Dan Crenshaw": "댄 크렌쇼", "Scott H. Peters": "스콧 피터스",
    "Rob Bresnahan": "롭 브레스너핸", "Nancy Pelosi": "낸시 펠로시"}
def trade_parts(ent, mem_by_id):
    T = opt("data", "us", "trades.json").get("trades", [])
    T = [t for t in T if t.get("tk") and t.get("doc")]
    T.sort(key=lambda t: (t.get("filed") or "", t.get("d") or ""), reverse=True)
    by_tk, by_who = {}, {}
    for t in T:
        m = mem_by_id.get(t.get("id")) or {}
        row = {"who": t["who"], "ps": f"{m.get('party') or '?'}-{m.get('state') or '?'}", "ty": TY.get(t["ty"], t["ty"]), "amt": t.get("amt"), "d": t.get("d"), "fd": t.get("filed"), "doc": t["doc"]}
        by_tk.setdefault(t["tk"], []).append(row); by_who.setdefault(t["who"], []).append(t)
    dc = CENT["dc"]
    for tk, rows in by_tk.items():
        e = ent.get("company:" + tk)
        if not e: continue
        e["trades"] = rows[:5]; e["trade_n"] = len(rows)
        e["route"].append({"region": f"{dc[0]} · 의원 거래", "lat": dc[2] - 0.05, "lon": dc[3] - 0.05, "title": "의원 주식 거래(하원 PTR)", "kind": "trade", "ref": "trade:" + tk,
            "fact": f"데이터상 하원 PTR 신고 {len(rows)}건, 최근 신고일 {rows[0]['fd']}. 신고 기준이며 거래일→신고일 최대 45일 차이 가능. 투자 조언 아님.",
            "source_url": rows[0]["doc"], "date": rows[0]["fd"]})
    n = 0
    for who, ts in by_who.items():
        m = mem_by_id.get(ts[0].get("id")) or {}
        cnt = {}
        for t in ts: cnt[t["tk"]] = cnt.get(t["tk"], 0) + 1
        r = []
        for tk, c in sorted(cnt.items(), key=lambda x: -x[1]):
            e = ent.get("company:" + tk)
            if not e or not e["route"] or e["route"][0].get("lat") is None: continue
            last = next(t for t in ts if t["tk"] == tk); h = e["route"][0]
            r.append({"region": f"{e['name']} ({tk})", "lat": h["lat"], "lon": h["lon"], "title": f"{e['name']} 거래 신고", "kind": "trade", "ref": "trade:" + tk,
                "fact": f"데이터상 {who} 의원 {tk} 거래 신고 {c}건. 최근: {TY.get(last['ty'], last['ty'])} {last.get('amt')}, 거래일 {last.get('d')}, 신고일 {last.get('filed')}. 신고 기준, 투자 조언 아님.",
                "source_url": last["doc"], "date": last.get("filed")})
            if len(r) >= 8: break
        if not r: continue
        last = (who.split() or [who])[-1]
        al = [who, last] + ([KO_MEM[who], KO_MEM[who].split()[-1]] if who in KO_MEM else [])
        ent["member:" + (ts[0].get("id") or who)] = {"type": "member", "name": who + (f" ({m.get('party')}-{m.get('state')})" if m else ""), "aliases": al, "route": r, "trade_n": len(ts)}
        n += 1
    json.dump({"updated": T[0].get("filed") if T else None, "note": "하원 PTR 신고 기준 최신 20건(trades.json 요약). 거래일→신고일 최대 45일 차이 가능. 투자 조언 아님.", "trades": [dict(tk=t["tk"], who=t["who"], ty=t["ty"], amt=t.get("amt"), d=t.get("d"), fd=t.get("filed"), doc=t["doc"]) for t in T[:20]]}, open(os.path.join(ROOT, "data", "us", "trades-recent.json"), "w"), ensure_ascii=False, indent=0)
    return len(T), n

LANDMARK = [  # 제정 법률(공식 congress.gov 페이지)
    {"no": "HR 4346", "n": "CHIPS and Science Act", "ko": ["칩스법", "반도체지원법", "chips act", "chips and science act"], "law": "Public Law 117-167", "ad": "2022-08-09", "a": "Became Public Law No: 117-167.", "u": "https://www.congress.gov/bill/117th-congress/house-bill/4346", "c": 117, "topic": "semis"},
    {"no": "HR 5376", "n": "Inflation Reduction Act of 2022", "ko": ["인플레이션 감축법", "ira", "인플레감축법"], "law": "Public Law 117-169", "ad": "2022-08-16", "a": "Became Public Law No: 117-169.", "u": "https://www.congress.gov/bill/117th-congress/house-bill/5376", "c": 117, "topic": "energy"}]
TOPICS = {"tariff": (["관세", "tariff", "tariffs", "무역"], r"tariff|import dut|reciprocal trade|trade agreement|trade act", "관세·무역 법안"), "export": (["수출통제", "수출 통제", "수출규제", "export control"], r"export", "수출통제 법안"),
    "china": (["중국 법안", "대중 규제", "china bill"], r"china|chinese|ccp|prc", "중국 관련 법안"), "semis": (["반도체 법안", "칩 법안", "semiconductor bill"], r"semiconductor|chip", "반도체 법안"),
    "energy": (["에너지 법안", "energy bill"], r"energy|oil|gas|nuclear", "에너지 법안")}
CTRY_RE = {"cn": r"china|chinese|prc|ccp", "tw": r"taiwan", "kr": r"korea", "jp": r"japan", "eu": r"europe|european"}
def bill_parts(ent, mem_by_id):
    d = opt("data", "us", "bills.json"); seen = {}; spons = {}
    for mid, arr in (d.get("recent") or {}).items():
        for b in arr:
            if b.get("no") and b.get("u"): seen[b["no"]] = b; spons[b["no"]] = mid
    lob = {}
    for tk, c in (LB.get("companies") or {}).items():
        for no, k in c.get("bills_mentioned", []): lob.setdefault(no, []).append((tk, k))
    cm = {e["aliases"][0].lower(): k for k, e in ent.items() if e["type"] == "committee"}
    cap = CENT["dc"]; n = 0; topic_bills = {t: [] for t in TOPICS}
    items = [dict(b, sp=spons.get(no)) for no, b in seen.items()] + [dict(x, sp=None) for x in LANDMARK]
    for b in items:
        no = re.sub(r"\s+", " ", b["no"].upper()); low = b["n"].lower()
        tops = [t for t, (_, rx, _) in TOPICS.items() if re.search(rx, low)] + ([b["topic"]] if b.get("topic") else [])
        if not (no in lob or b.get("law") or b.get("pass") or tops or b.get("c")): continue
        st = "법률 제정(" + b["law"] + ")" if isinstance(b.get("law"), str) else ("법률 제정" if b.get("law") else ("한 원 통과" if b.get("pass") else "계류"))
        r = [{"region": f"{cap[0]} · 의회", "lat": cap[2], "lon": cap[3], "title": f"{b['no']} 현재 상태", "kind": "bill", "ref": "bill:" + no,
              "fact": f"{b['n']}. 상태: {st}. 최근 조치({b.get('ad') or '-'}): {b.get('a') or '-'}", "source_url": b["u"], "date": b.get("ad")}]
        m = mem_by_id.get(b.get("sp")) or {}
        if m.get("ll"):
            r.append({"region": f"발의 의원 지역구 · {m.get('state')}", "lat": m["ll"][0], "lon": m["ll"][1], "title": "대표 발의", "kind": "cmte", "ref": "sponsor:" + m["id"],
                      "fact": f"대표 발의 {m['name']}({m.get('party')}-{m.get('state')}). 발의일 {b.get('d') or '-'}.", "source_url": b["u"], "date": b.get("d")})
        mm = re.search(r"Committee on (?:the )?([A-Z][A-Za-z ,&]+?)[.;]", b.get("a") or "")
        if mm:
            k = cm.get(mm.group(1).strip().lower())
            if k and ent[k]["route"]:
                h = ent[k]["route"][0]
                r.append({"region": h["region"], "lat": h["lat"], "lon": h["lon"], "title": "회부 위원회", "kind": "cmte", "ref": k, "fact": f"최근 조치에 회부 위원회로 {mm.group(1).strip()} 기재.", "source_url": b["u"], "date": b.get("ad")})
        for cc, rx in CTRY_RE.items():
            if re.search(rx, low) and cc in CENT:
                c0 = CENT[cc]; r.append({"region": c0[0], "lat": c0[2], "lon": c0[3], "title": "법안 제목에 언급", "kind": "reg", "ref": "country:" + cc, "fact": f"법안 제목에 {c0[0]} 관련 표현이 있음(제목 기준, 영향 단정 아님).", "source_url": b["u"], "date": b.get("ad")})
        for tk, k in sorted(lob.get(no, []), key=lambda x: -x[1])[:5]:
            e = ent.get("company:" + tk)
            if not e or not e["route"] or e["route"][0].get("lat") is None: continue
            h = e["route"][0]
            r.append({"region": f"{e['name']} ({tk})", "lat": h["lat"], "lon": h["lon"], "title": "로비 공시에 번호 언급", "kind": "lobby", "ref": "lobbying:" + tk,
                      "fact": f"데이터상 {e['name']} 로비 공시 활동 설명에 {no} 언급 {k}회(회기 미표기, 원문 확인 필요).", "source_url": LB["companies"][tk]["source_url"], "date": LB.get("updated")})
        nos = {no, no.replace(" ", ""), no.replace("HR ", "H.R.").replace("S ", "S.")}
        ent["bill:" + no + (f":{b['c']}" if b.get("c") else "")] = {"type": "bill", "name": f"{b['no']} {b['n']}", "aliases": sorted(nos) + [b["n"]] + b.get("ko", []) + (["NDAA", "국방수권법"] if "national defense authorization act" in low else []), "route": r}
        for t in set(tops): topic_bills[t].append((b.get("ad") or "", b, no))
        n += 1
    for t, lst in topic_bills.items():
        if not lst: continue
        lst.sort(key=lambda x: x[0], reverse=True); r = []
        for i, (_, b, no) in enumerate(lst[:8]):
            r.append({"region": f"{cap[0]} · {b['no']}", "lat": cap[2] + 0.02 * (i % 3 - 1), "lon": cap[3] + 0.02 * (i // 3 - 1), "title": b["no"], "kind": "bill", "ref": "bill:" + no,
                      "fact": f"{b['n']} — 최근 조치({b.get('ad') or '-'}): {b.get('a') or '-'}", "source_url": b["u"], "date": b.get("ad")})
        kw, _, label = TOPICS[t]
        ent["topic:" + t] = {"type": "topic", "name": label, "aliases": kw + [label], "route": r}
    return n
def facility_stops(ent):
    F = opt("data", "us", "facilities.json").get("companies", {}); n = 0
    for tk, fs in F.items():
        for key in ["company:" + tk] + (["company:2330.TW"] if tk == "TSM" else []):
            e = ent.get(key)
            if not e: continue
            add = []
            for f in fs:
                if f["kind"] == "hq" and e["route"] and "본사" in (e["route"][0].get("title") or ""): continue
                lab = {"hq": "본사", "factory": "공장", "supplier": "공급사"}[f["kind"]]
                add.append({"region": f["name"], "lat": f["lat"], "lon": f["lon"], "title": f"{lab}(공시)" + (" · 대략 위치" if f.get("approx") else ""), "kind": "supply", "ref": "facility:" + tk,
                    "fact": f"{f['form']} 원문: \"{f['quote']}\" (좌표는 대략 위치)", "source_url": f["source_url"], "date": None})
            e["route"][1:1] = add[:6]; n += len(add[:6])
    return n
KR_LAB = {"semiconductor": "반도체", "battery_ev": "배터리·전기차", "auto": "자동차", "tech_ai": "AI·IT", "shipbuilding": "조선", "defense": "방산", "energy": "에너지", "clean_energy": "탄소·기후",
          "health": "바이오·제약", "trade": "관세·통상", "finance": "금융", "crypto": "가상자산", "housing": "주택·부동산"}
def kr_policy(ent):
    K = opt("data", "policy", "kr.json"); A = K.get("items") or []; I = [b for b in A if b.get("kind") != "press"]; P = [b for b in A if b.get("kind") == "press"]; n = 0
    if P:
        ent["topic:kr-msit"] = {"type": "topic", "name": "한국 과학기술정보통신부 최근 보도자료", "aliases": ["과기정통부 보도자료", "과기부 보도자료", "한국 정부 보도자료", "한국 정책 보도자료", "과학기술정보통신부"],
            "route": [{"region": "과학기술정보통신부 · 정부세종청사(대략 위치)", "lat": 36.503 + 0.01 * (i % 3 - 1), "lon": 127.262 + 0.01 * (i // 3 - 1), "title": (b.get("dept") or "보도자료"), "kind": "press", "ref": "krpress:" + b["id"],
                       "fact": b["t"] + " · " + b["src"] + " (제목 기준, 영향 단정 아님)", "source_url": b["u"], "date": b.get("d")} for i, b in enumerate(P[:8])]}; n += 1
    def stops(L):
        return [{"region": "대한민국 국회 · 서울 여의도", "lat": 37.5318 + 0.01 * (i % 3 - 1), "lon": 126.9142 + 0.01 * (i // 3 - 1), "title": (b.get("no") or "") + " 발의", "kind": "bill", "ref": "krbill:" + b["id"],
                 "fact": f"{b['t']} · 발의 {b.get('by') or '-'} · 소관위 {b.get('cmte') or '미정'} (법안명 기준, 영향 단정 아님)", "source_url": b["u"], "date": b.get("d")} for i, b in enumerate(L[:8])]
    if I:
        ent["topic:kr-bills"] = {"type": "topic", "name": "한국 국회 최근 발의 법안", "aliases": ["한국 법안", "국회 법안", "한국 국회", "국회 의안", "발의 법안"], "route": stops(I)}; n += 1
    for k, lab in KR_LAB.items():
        L = [b for b in I if k in b.get("tags", [])]
        if L: ent["topic:kr-" + k] = {"type": "topic", "name": f"한국 {lab} 법안", "aliases": [f"한국 {lab} 법안", f"{lab} 법안 한국", f"국회 {lab}"], "route": stops(L)}; n += 1
    return n
def wh_topics(ent):
    W = opt("data", "us", "whitehouse.json"); I = W.get("items") or []; n = 0
    LL = {"presdoc": ("백악관 · 워싱턴 DC", 38.8977, -77.0365), "상무부 BIS(산업안보국)": ("상무부 BIS · 워싱턴 DC", 38.8936, -77.0326), "USTR(무역대표부)": ("USTR · 워싱턴 DC", 38.8992, -77.0393), "재무부 OFAC(해외자산통제국)": ("재무부 OFAC · 워싱턴 DC", 38.8981, -77.0345)}
    def stops(L):
        out = []
        for i, b in enumerate(L[:10]):
            r, la, lo = LL.get("presdoc" if b["kind"] == "presdoc" else b["type"], LL["presdoc"])
            out.append({"region": r, "lat": la + 0.004 * (i % 3 - 1), "lon": lo + 0.004 * (i // 3 - 1), "title": (b.get("grp") or "") + " · " + b["type"] + (f" EO {b['eo']}" if b.get("eo") else "") + (f" 포고문 {b['procl']}" if b.get("procl") else ""), "kind": "wh", "ref": "wh:" + b["id"],
                        "fact": b["t"] + " · " + b["ko"] + (" · 서명 " + b["sign"] if b.get("sign") else "") + (" · " + (b.get("tickers_product_label") or "") + " " + ",".join(b["tickers_product"]) if b.get("tickers_product") else "") + " · " + b["src"], "source_url": b["u"], "date": b.get("date")})
        return out
    P = [b for b in I if b["kind"] == "presdoc"]
    def T(key, name, al, L):
        nonlocal n
        if L: ent["topic:" + key] = {"type": "topic", "name": name, "aliases": al, "route": stops(L)}; n += 1
    T("wh-all", "백악관·대통령 조치(최신순)", ["백악관", "대통령 조치", "백악관 발표", "white house", "presidential actions", "트럼프 행정명령"], P)
    T("wh-eo", "행정명령(최신순)", ["행정명령", "executive order", "대통령 행정명령"], [b for b in P if b["type"] == "행정명령"])
    T("wh-procl", "대통령 포고문(최신순)", ["포고문", "proclamation"], [b for b in P if b["type"] == "포고문"])
    T("wh-tariff", "관세·수입제한 관련 백악관·대통령 조치 및 관련 부처 관보 문서", ["관세", "관세 행정명령", "백악관 관세", "tariff", "section 232", "232조", "수입제한", "section 301"], [b for b in I if "tariff" in b["topics"] or "import_232" in b["topics"]])
    T("wh-export", "미국 수출통제(백악관·대통령 조치 및 관련 부처 관보 문서)", ["수출통제", "export control", "entity list", "BIS", "미국 수출통제"], [b for b in I if "export_control" in b["topics"]])
    T("wh-sanction", "미국 제재(백악관·대통령 조치 및 관련 부처 관보 문서)", ["제재", "OFAC", "sanctions", "미국 제재"], [b for b in I if "sanctions" in b["topics"]])
    LAB = {s["id"]: s["label"] for s in J("data", "market", "sectors.json")["sectors"]}
    for sid, lab in LAB.items():
        T("wh-" + sid, f"{lab} 관련 백악관·대통령 조치 및 관련 부처 관보 문서", [f"{lab} 행정명령", f"백악관 {lab}", f"{lab} 대통령 조치"], [b for b in I if sid in b["sectors"]])
    return n
CP = {"jp": ("일본", "일본 정부·관보성 발표", "도쿄 가스미가세키", 35.6745, 139.7515, ["일본 정책", "일본 정부", "일본 규제", "일본 의견수렴", "파브코메", "일본 발표"]),
      "eu": ("EU", "EU 법령·집행위 발표", "브뤼셀", 50.8433, 4.3826, ["EU 정책", "EU 규제", "유럽 규제", "EU 법령", "유럽연합", "EU 발표"]),
      "cn": ("중국", "중국 정부 정책 발표", "베이징", 39.9087, 116.3975, ["중국 정책", "중국 정부", "중국 규제", "중국 발표", "중국 수출통제"]),
      "tw": ("대만", "대만 정부 정책 발표", "타이베이", 25.0330, 121.5200, ["대만 정책", "대만 정부", "대만 규제", "대만 발표"])}
def intl_policy(ent):
    n = 0; LAB = {s["id"]: s["label"] for s in J("data", "market", "sectors.json")["sectors"]}; LAB["trade"] = "관세·무역"
    for cc, (nm, title, place, la, lo, al) in CP.items():
        I = opt("data", "policy", cc + ".json").get("items") or []
        if not I: continue
        def stops(L):
            return [{"region": f"{nm} · {place}(대략 위치)", "lat": la + 0.01 * (i % 3 - 1), "lon": lo + 0.01 * (i // 3 - 1), "title": b.get("dept") or b["src"], "kind": "policy", "ref": f"{cc}pol:" + b["id"],
                     "fact": b["t"] + " · " + b["src"] + " (제목 키워드 기준, 영향 단정 아님)", "source_url": b["u"], "date": b.get("d")} for i, b in enumerate(L[:8])]
        ent[f"topic:{cc}-policy"] = {"type": "topic", "name": f"{title}(최신순)", "aliases": al, "route": stops(I)}; n += 1
        for k, lab in LAB.items():
            L = [b for b in I if k in b.get("tags", [])]
            if L: ent[f"topic:{cc}-{k}"] = {"type": "topic", "name": f"{nm} {lab} 관련 정부 발표", "aliases": [f"{nm} {lab} 정책", f"{nm} {lab} 규제", f"{nm} {lab}"], "route": stops(L)}; n += 1
    # JPX 상장 목록: 도쿄 상장 종목 별칭(일본어 종목명)·업종
    X = opt("data", "jp", "listed.json").get("c") or {}
    for k, e in ent.items():
        if k.startswith("company:") and k.endswith(".T") and k[8:-2] in X:
            r = X[k[8:-2]]; e.setdefault("aliases", []); e["aliases"] += [a for a in [r[0]] if a not in e["aliases"]]; e["jpx"] = {"name": r[0], "market": r[1], "s33": r[2], "s17": r[3]}
    return n
def stop(region, lat, lon, title, fact, url, date=None, ref=None):
    return {"region": region, "lat": lat, "lon": lon, "title": title, "fact": fact, "source_url": url, "date": date, "ref": ref}
KR_URL = "https://www.data.go.kr/data/15094808/openapi.do"
def kr_company_routes(ent):
    """한국 종목(.KS): 주가·국회 의안·미국 조치·미국 거래처·대만/중국/일본 정책을 출처 링크 있는 카드로 붙인다. 관련 0건이면 카드를 만들지 않는다."""
    import datetime as dt
    links = J("data", "market", "company-links.json")["companies"]
    W = opt("data", "us", "whitehouse.json"); WI = W.get("items") or []
    K = [b for b in (opt("data", "policy", "kr.json").get("items") or []) if b.get("kind") != "press"]
    FAC = opt("data", "us", "facilities.json").get("companies", {})
    try: base = dt.date.fromisoformat((W.get("updated") or "")[:10])
    except ValueError: base = None
    WIN = [(30, "한 달"), (90, "석 달")]  # 한 달에 0건이면 석 달로 넓혀 보고, 그래도 0건이면 한눈에 보기 카드를 숨김
    kr, dc, us = CENT["kr"], CENT["dc"], CENT["us"]; n = 0
    for c in links:
        sym = c["symbol"]; e = ent.get("company:" + sym)
        if not e or not sym.endswith(".KS"): continue
        sids = [x["id"] for x in c["sectors"]]; lab = c["sectors"][0]["label"] if c["sectors"] else ""
        nm = c["name"]; add = []
        pj = opt("data", "kr", "prices", sym.split(".")[0] + ".json")  # 금융위원회 주식시세정보(공공데이터포털)
        if pj.get("c") and pj.get("d"):
            last, ld = pj["c"][-1], pj["d"][-1]; prev = pj["c"][-22] if len(pj["c"]) > 22 else None
            f = f"{nm}의 마지막 종가는 {last:,}원이에요({ld})."
            if prev: f += f" 한 달쯤 전({pj['d'][-22]})에는 {prev:,}원이었어요."
            add.append(stop(kr[0] + " · 증시", kr[2], kr[3], "주가 기록(종가)", f + " 장이 끝날 때 값이고 실시간이 아니에요.", pj.get("source_url") or KR_URL, ld, "krprice:" + sym))
        us_all = sorted([b for b in WI if set(sids) & set(b.get("sectors", [])) and b.get("u")], key=lambda b: b.get("date") or "", reverse=True)
        us_month, wl = [], ""
        for days, wl in WIN:
            us_month = [b for b in us_all if base and (b.get("date") or "") >= str(base - dt.timedelta(days=days))]
            if us_month: break
        if us_month:
            first = f"{nm}{josa(nm, '은', '는')} 한국 대표 {lab} 회사예요. 최근 {wl} 미국이 {lab} 관련 문서를 {len(us_month)}번 냈어요."
            add.insert(0, stop("미국 · 백악관과 관련 부처", dc[2], dc[3], "한눈에 보기", first + " 제목 말을 보고 같은 분야로 묶은 것이라, 이 회사와 직접 관계가 있다는 뜻은 아니에요.", us_month[0]["u"], us_month[0].get("date"), "uswh:" + sym))
        for i, b in enumerate(us_all[:3]):
            add.append(stop("미국 · 워싱턴 D.C.", dc[2] + 0.02 * (i - 1), dc[3] + 0.02, f"미국 {b.get('type') or '조치'}", f"미국에서 {b.get('date')}에 {lab} 분야 문서가 나왔어요: {b['t']}", b["u"], b.get("date"), "uswh:" + b["id"]))
        for tk, fs in FAC.items():  # 미국 회사 공시에 이 회사가 공급사로 나온 경우
            for fa in fs:
                if fa.get("kind") == "supplier" and fa.get("source_url") and (fa.get("name") or "").replace("공급사 ", "", 1).startswith(nm):
                    un = (ent.get("company:" + tk) or {}).get("name") or tk
                    add.append(stop("미국 · " + un, us[2], us[3], f"미국 회사 {un}의 거래처", f"미국 회사 {un}({tk})가 낸 보고서에 {nm}{josa(nm, '이', '가')} 거래처로 나와요. 원문: \"{fa['quote']}\"", fa["source_url"], None, "supply:" + tk))
        kb = sorted([b for b in K if set(sids) & set(b.get("tags", [])) and b.get("u")], key=lambda b: b.get("d") or "", reverse=True)[:3]
        for i, b in enumerate(kb):
            add.append(stop("대한민국 국회 · 서울 여의도", 37.5318 + 0.01 * (i - 1), 126.9142 + 0.01, "국회에 올라온 법안", f"국회에 '{b['t']}' 법안이 올라왔어요({b.get('d')}). 낸 사람: {b.get('by') or '-'}. 이름만 보고 같은 분야로 묶었어요.", b["u"], b.get("d"), "krbill:" + b["id"]))
        for cc in ("tw", "cn", "jp"):
            cn_, _t, place, la, lo, _a = CP[cc]
            pl = sorted([b for b in (opt("data", "policy", cc + ".json").get("items") or []) if set(sids) & set(b.get("tags", [])) and b.get("u")], key=lambda b: b.get("d") or "", reverse=True)[:1]
            for b in pl:
                add.append(stop(f"{cn_} · {place}", la, lo, f"{cn_} 정부 발표", f"{cn_} 정부가 {b.get('d')}에 {lab} 분야로 보이는 글을 올렸어요: {b['t']} (원문 언어 그대로예요. 제목 말만 보고 묶었어요.)", b["u"], b.get("d"), f"{cc}pol:" + b["id"]))
        add = [x for x in add if x.get("source_url")]
        e["route"] = add + [x for x in e["route"] if x.get("source_url")]
        n += len(add)
    return n
def main():
    sec = J("data", "market", "sectors.json"); factors = {f["id"]: f for f in sec["factors"]}
    sectors = {s["id"]: s for s in sec["sectors"]}
    links = J("data", "market", "company-links.json")["companies"]
    members = J("data", "us", "members.json")["members"]
    CH = {"sen": "상원", "rep": "하원"}
    cm = {}  # (chamber, name) -> count  (상·하원 분리)
    for m in members:
        for k in m.get("cmits", []):
            n = re.sub(r" \(.*", "", k)
            if "January 6" in n: continue  # 118대 의회 한시 소위, 제외
            key = (m.get("chamber", "rep"), n); cm[key] = cm.get(key, 0) + 1
    ts = {}
    p = os.path.join(ROOT, "data", "us", "ticker-sectors.json")
    if os.path.exists(p): ts = json.load(open(p)).get("tickers", {})
    st_ll = {}
    for m in members:
        if m.get("ll") and m.get("state"): st_ll.setdefault(m["state"], []).append(m["ll"])
    st_ll = {k: [round(sum(a[0] for a in v) / len(v), 3), round(sum(a[1] for a in v) / len(v), 3)] for k, v in st_ll.items()}

    global AW, LB, PC
    AW, LB, PC = opt("data", "us", "federal-awards.json"), opt("data", "us", "lobbying.json"), opt("data", "us", "pac-contributions.json")
    bills_by_no = {}
    for arr in (opt("data", "us", "bills.json").get("recent") or {}).values():
        for b in arr:
            if b.get("no") and b.get("u"): bills_by_no[re.sub(r"\s+", " ", b["no"].upper())] = b["u"]
    ent = {}
    def stop(region, lat, lon, title, fact, url, date=None, ref=None):
        return {"region": region, "lat": lat, "lon": lon, "title": title, "fact": fact, "source_url": url, "date": date, "ref": ref}
    def cmte_stops(sid):
        out = []
        for n in APP_CMTE.get(sid, []):
            for ch in ("sen", "rep"):
                if (ch, n) in cm:
                    d = CENT["dc"]
                    out.append(stop(f"{d[0]} {CH[ch]}", d[2], d[3], f"연관 위원회({CH[ch]}): {n}", f"이 사이트가 직접 묶은 거라 공식 담당 위원회는 아닐 수 있어요. {CH[ch]} 위원 {cm[(ch, n)]}명이 있어요.",
                                    "https://www.congress.gov/committees", None, f"committee:{ch}:{n}"))
        return out[:2]
    def factor_stops(sid, limit=3):
        out, seen = [], set()
        for fid in sectors.get(sid, {}).get("factors", []):
            c = factor_country(fid); f = factors.get(fid)
            if not c or not f or c in seen: continue
            seen.add(c); k = CENT[c]
            out.append(stop(k[0], k[2], k[3], f"함께 볼 지표: {f['label']}", f"{sectors[sid]['label']} 분야와 같이 보는 숫자예요. 출처: {f.get('source','공식 통계')}. 원인이라는 뜻은 아니에요.",
                            f.get("source_url"), None, "factor:" + fid))
            if len(out) >= limit: break
        return out
    def sector_stop(sid):
        s = sectors[sid]; return stop("업종 · " + s["label"], None, None, f"업종: {s['label']}", f"데이터상 {s['label']} 업종으로 분류됨. 연결 지표 {len(s.get('factors',[]))}개, 법안 주제 {', '.join(s.get('law_topics',[]))}.", None, None, "sector:" + sid)

    # 업종
    for sid, s in sectors.items():
        r = []
        mk = [c for c in links if sid in [x["id"] for x in c["sectors"]] and c["region"] in CENT][:3]
        for c in mk:
            k = CENT[c["region"]]; r.append(stop(k[0], k[2], k[3], f"대표 종목: {c['name']}", f"{s['label']} 분야에서 지켜보는 회사예요: {c['name']}({c['symbol']}).", None, None, "company:" + c["symbol"]))
        r += factor_stops(sid) + cmte_stops(sid)
        ent["sector:" + sid] = {"type": "sector", "name": s["label"], "aliases": [s["label"], s.get("label_en", ""), sid] + s["label"].split("·"), "kw": SECTOR_KW.get(sid, []), "route": r, "companies": [c["symbol"] for c in links if sid in [x["id"] for x in c["sectors"]]][:6]}
    # 추적 기업(한/영)
    for c in links:
        sid = c["sectors"][0]["id"] if c["sectors"] else None
        k = CENT.get(c["region"]); r = []
        t = ts.get(c["symbol"])
        ll = hq_ll(t, st_ll)[0] if t else None
        if ll:
            r.append(stop(f"본사 {t.get('hq_city','')}, {t['hq_state_or_country']}", ll[0], ll[1], "본사 위치(SEC 주소)", f"데이터상 SEC 제출 서류 사업장 주소가 {t.get('hq_city')} {t['hq_state_or_country']}임. 업종 코드 SIC {t.get('sic')} {t.get('sic_desc')}.", t["source_url"]))
        elif k:
            if not c["symbol"].endswith(".KS"):  # 한국 종목은 kr_company_routes()가 출처 있는 카드로 채움
                r.append(stop(k[0], k[2], k[3], f"{c['name']}이(가) 상장된 나라", f"{c['name']}({c['symbol']})은 {k[0]} 증시에 올라 있는 회사예요.", None))
        for f in c.get("factors", [])[:4]:
            cc = factor_country(f["id"])
            lt = f.get("latest") or {}
            if cc and cc != c["region"] and all(x["region"] != CENT[cc][0] for x in r) and lt.get("value") is not None:
                r.append(stop(CENT[cc][0], CENT[cc][2], CENT[cc][3], f"함께 볼 지표: {f['label']}", f"요즘 값은 {fmt(lt)}이에요({lt.get('date')}).{KR_NOTE if f['id'].startswith('kr_exp_') else ''} 같이 보는 숫자일 뿐, 서로 원인이라는 뜻은 아니에요.", f.get("source_url"), lt.get("date"), "factor:" + f["id"]))
        r += money_stops(c["symbol"], st_ll, bills_by_no)
        if sid: r += cmte_stops(sid)[:1]
        name_en = (t or {}).get("name") or ""
        ent["company:" + c["symbol"]] = {"type": "company", "name": c["name"], "symbol": c["symbol"], "sector": sid,
            "aliases": [c["name"], c["symbol"], c["symbol"].split(".")[0], name_en] + KR_ALIASES.get(c["symbol"], []), "route": r}
    # 거래 데이터의 나머지 티커(SEC 매핑 있는 것)
    for tk, t in ts.items():
        if "company:" + tk in ent: continue
        sid = "semiconductor" if str(t.get("sic")) in SEMI_SIC else SEC2APP.get(t.get("sector"))
        r = []
        hq = t.get("hq_state_or_country")
        ll = hq_ll(t, st_ll)[0]
        if ll:
            r.append(stop(f"본사 {t.get('hq_city','')}, {hq}", ll[0], ll[1], "본사 위치(SEC 주소)", f"데이터상 SEC 제출 서류 사업장 주소가 {t.get('hq_city')} {hq}임. SIC {t.get('sic')} {t.get('sic_desc')}.", t["source_url"]))
        elif hq in SEC_FOREIGN:
            k = CENT[SEC_FOREIGN[hq]]; r.append(stop(k[0], k[2], k[3], "본사 소재국(SEC 주소)", f"데이터상 SEC 제출 서류 사업장 주소 소재지가 {t.get('hq_desc')}임.", t["source_url"]))
        r += money_stops(tk, st_ll, bills_by_no)
        if sid: r += factor_stops(sid, 2) + cmte_stops(sid)[:1]
        ent["company:" + tk] = {"type": "company", "name": t.get("name") or tk, "symbol": tk, "sector": sid, "aliases": [tk, t.get("name") or ""], "route": r}
    # 상임위
    for (ch, n), c in cm.items():
        d = CENT["dc"]; sids = [x for x, v in APP_CMTE.items() if n in v]
        r = [stop(f"{d[0]} {CH[ch]}", d[2], d[3], f"{CH[ch]} 위원회: {n}", f"데이터상 {CH[ch]} 위원 {c}명(members.json).", "https://www.congress.gov/committees")]
        for x in sids[:3]:
            fs = factor_stops(x, 1)
            if fs: r.append(dict(fs[0], title=f"연관 업종(자체 분류, 공식 관할 아님): {sectors[x]['label']}"))
        ent[f"committee:{ch}:{n}"] = {"type": "committee", "name": f"{n} ({CH[ch]})", "aliases": [n, f"{n} {CH[ch]}"], "route": r}
    # 나라
    for cid, k in CENT.items():
        if cid in ("dc", "commodity"): continue
        fs = [f for f in factors.values() if factor_country(f["id"]) == cid][:4]
        r = [stop(k[0], k[2], k[3], f"{k[0]} 지표: {f['label']}", f"데이터상 {k[0]} 관련 수집 지표. 출처: {f.get('source','공식 통계')}.", f.get("source_url"), None, "factor:" + f["id"]) for f in fs]
        ent["country:" + cid] = {"type": "country", "name": k[0], "aliases": [k[0], k[1], cid.upper()], "route": r}
    # 좌표 없는 정류장(업종 정류장) 제거, 빈 경로 표시
    for e in ent.values():
        e["route"] = [x for x in e["route"] if x and x.get("lat") is not None]
        e["aliases"] = sorted({a for a in e["aliases"] if a})
    mem_by_id = {m["id"]: m for m in J("data", "us", "members.json")["members"]}
    nt, nm = trade_parts(ent, mem_by_id)
    print("trades", nt, "members", nm)
    print("bills", bill_parts(ent, mem_by_id))
    print("facility stops", facility_stops(ent))
    print("kr policy", kr_policy(ent)); print("wh topics", wh_topics(ent)); print("intl policy", intl_policy(ent)); print("kr company stops", kr_company_routes(ent))
    res = {"updated": sec.get("updated"), "about": "누적 공개 데이터에서 자동 생성한 검색 색인·경로. AI 미연결. 투자 신호 아님. 의원 거래는 PTR 신고 기준(거래일→신고일 최대 45일 차이 가능), 투자 조언 아님.",
           "counts": {t: sum(1 for e in ent.values() if e["type"] == t) for t in ("company", "sector", "committee", "country")},
           "with_route": sum(1 for e in ent.values() if e["route"]), "money_stops": {k: sum(1 for e in ent.values() for x in e["route"] if (x.get("ref") or "").startswith(k)) for k in ("awards:", "lobbying:", "pac:")}, "entities": ent}
    json.dump(res, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(res["counts"], "with_route", res["with_route"], "bytes", os.path.getsize(OUT))
main()
