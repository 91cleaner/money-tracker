#!/usr/bin/env python3
"""누적 데이터 → data/search-index.json (검색 개체 + 자동 생성 경로).

입력: data/market/company-links.json, data/market/sectors.json, data/us/members.json(위원회 이름만),
      data/us/ticker-sectors.json(있으면), data/us/trades.json(티커 목록만).
경로의 사실·출처는 모두 입력 데이터에서 가져온다. 손으로 쓴 사실 없음.
개별 의원 거래는 넣지 않는다(HANDOFF). AI 미연결.
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
 "crypto": ["Banking, Housing, and Urban Affairs", "Financial Services"], "safe_haven": ["Finance", "Ways and Means"], "market": ["Finance", "Ways and Means"]}

def fmt(lt):
    v = lt.get("value")
    if isinstance(v, (int, float)) and lt.get("unit") == "usd" and v >= 1e8: return f"약 {v/1e8:,.1f}억 달러"
    return f"{v:,}" if isinstance(v, (int, float)) else str(v)
def main():
    sec = J("data", "market", "sectors.json"); factors = {f["id"]: f for f in sec["factors"]}
    sectors = {s["id"]: s for s in sec["sectors"]}
    links = J("data", "market", "company-links.json")["companies"]
    members = J("data", "us", "members.json")["members"]
    cm = {}
    for m in members:
        for k in m.get("cmits", []):
            n = re.sub(r" \(.*", "", k); cm.setdefault(n, {"sen": 0, "rep": 0}); cm[n][m.get("chamber", "rep")] = cm[n].get(m.get("chamber", "rep"), 0) + 1
    ts = {}
    p = os.path.join(ROOT, "data", "us", "ticker-sectors.json")
    if os.path.exists(p): ts = json.load(open(p)).get("tickers", {})
    st_ll = {}
    for m in members:
        if m.get("ll") and m.get("state"): st_ll.setdefault(m["state"], []).append(m["ll"])
    st_ll = {k: [round(sum(a[0] for a in v) / len(v), 3), round(sum(a[1] for a in v) / len(v), 3)] for k, v in st_ll.items()}

    ent = {}
    def stop(region, lat, lon, title, fact, url, date=None, ref=None):
        return {"region": region, "lat": lat, "lon": lon, "title": title, "fact": fact, "source_url": url, "date": date, "ref": ref}
    def cmte_stops(sid):
        out = []
        for n in APP_CMTE.get(sid, []):
            if n in cm:
                c = cm[n]; d = CENT["dc"]
                out.append(stop(d[0], d[2], d[3], f"관련 상임위: {n}", f"데이터상 이 업종과 관련된 의회 상임위로 분류함(앱 분류표). 현재 위원 수 {c.get('sen',0)+c.get('rep',0)}명(members.json).",
                                "https://www.congress.gov/committees", None, "committee:" + n))
        return out[:2]
    def factor_stops(sid, limit=3):
        out, seen = [], set()
        for fid in sectors.get(sid, {}).get("factors", []):
            c = factor_country(fid); f = factors.get(fid)
            if not c or not f or c in seen: continue
            seen.add(c); k = CENT[c]
            out.append(stop(k[0], k[2], k[3], f"함께 볼 지표: {f['label']}", f"데이터상 {sectors[sid]['label']} 업종과 함께 보는 지표로 연결됨. 출처: {f.get('source','공식 통계')}.",
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
            k = CENT[c["region"]]; r.append(stop(k[0], k[2], k[3], f"대표 종목: {c['name']}", f"데이터상 {s['label']} 업종 추적 종목 {c['name']}({c['symbol']}).", None, None, "company:" + c["symbol"]))
        r += factor_stops(sid) + cmte_stops(sid)
        ent["sector:" + sid] = {"type": "sector", "name": s["label"], "aliases": [s["label"], s.get("label_en", ""), sid] + s["label"].split("·"), "route": r}
    # 추적 기업(한/영)
    for c in links:
        sid = c["sectors"][0]["id"] if c["sectors"] else None
        k = CENT.get(c["region"]); r = []
        t = ts.get(c["symbol"])
        if t and t.get("hq_state_or_country") in st_ll:
            ll = st_ll[t["hq_state_or_country"]]
            r.append(stop(f"본사 {t.get('hq_city','')}, {t['hq_state_or_country']}", ll[0], ll[1], "본사 위치(SEC 주소)", f"데이터상 SEC 제출 서류 사업장 주소가 {t.get('hq_city')} {t['hq_state_or_country']}임. 업종 코드 SIC {t.get('sic')} {t.get('sic_desc')}.", t["source_url"]))
        elif k:
            r.append(stop(k[0], k[2], k[3], f"{c['name']} 소속 시장", f"데이터상 {c['name']}({c['symbol']})은 {k[0]} 시장 종목으로 분류됨.", None))
        for f in c.get("factors", [])[:4]:
            cc = factor_country(f["id"])
            if cc and cc != c["region"] and all(x["region"] != CENT[cc][0] for x in r):
                lt = f.get("latest") or {}
                r.append(stop(CENT[cc][0], CENT[cc][2], CENT[cc][3], f"함께 볼 지표: {f['label']}", f"데이터상 최신값 {fmt(lt)} ({lt.get('date')}). 원인 관계 단정 아님.", f.get("source_url"), lt.get("date"), "factor:" + f["id"]))
        if sid: r += cmte_stops(sid)[:1]
        name_en = (t or {}).get("name") or ""
        ent["company:" + c["symbol"]] = {"type": "company", "name": c["name"], "symbol": c["symbol"], "sector": sid,
            "aliases": [c["name"], c["symbol"], c["symbol"].split(".")[0], name_en], "route": r}
    # 거래 데이터의 나머지 티커(SEC 매핑 있는 것)
    for tk, t in ts.items():
        if "company:" + tk in ent: continue
        sid = "semiconductor" if str(t.get("sic")) in SEMI_SIC else SEC2APP.get(t.get("sector"))
        r = []
        hq = t.get("hq_state_or_country")
        if hq in st_ll:
            r.append(stop(f"본사 {t.get('hq_city','')}, {hq}", st_ll[hq][0], st_ll[hq][1], "본사 위치(SEC 주소)", f"데이터상 SEC 제출 서류 사업장 주소가 {t.get('hq_city')} {hq}임. SIC {t.get('sic')} {t.get('sic_desc')}.", t["source_url"]))
        elif hq in SEC_FOREIGN:
            k = CENT[SEC_FOREIGN[hq]]; r.append(stop(k[0], k[2], k[3], "본사 소재국(SEC 주소)", f"데이터상 SEC 제출 서류 사업장 주소 소재지가 {t.get('hq_desc')}임.", t["source_url"]))
        if sid: r += factor_stops(sid, 2) + cmte_stops(sid)[:1]
        ent["company:" + tk] = {"type": "company", "name": t.get("name") or tk, "symbol": tk, "sector": sid, "aliases": [tk, t.get("name") or ""], "route": r}
    # 상임위
    for n, c in cm.items():
        d = CENT["dc"]; sids = [s for s, v in APP_CMTE.items() if n in v]
        r = [stop(d[0], d[2], d[3], f"상임위: {n}", f"데이터상 현재 위원 수 {c.get('sen',0)+c.get('rep',0)}명.", "https://www.congress.gov/committees")]
        for s in sids[:3]:
            r.append(dict(factor_stops(s, 1)[0] if factor_stops(s, 1) else {}, title=f"관련 업종: {sectors[s]['label']}") if factor_stops(s,1) else None)
        ent["committee:" + n] = {"type": "committee", "name": n, "aliases": [n], "route": [x for x in r if x]}
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
    res = {"updated": sec.get("updated"), "about": "누적 공개 데이터에서 자동 생성한 검색 색인·경로. AI 미연결. 투자 신호 아님. 개별 의원 거래 미포함.",
           "counts": {t: sum(1 for e in ent.values() if e["type"] == t) for t in ("company", "sector", "committee", "country")},
           "with_route": sum(1 for e in ent.values() if e["route"]), "entities": ent}
    json.dump(res, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print(res["counts"], "with_route", res["with_route"], "bytes", os.path.getsize(OUT))
main()
