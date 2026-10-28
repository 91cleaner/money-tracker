#!/usr/bin/env python3
"""규칙 기반 인사이트(AI 미사용). 저장된 공개 데이터에서 비교 수치만 계산 → data/us/insights.json.
모든 줄에 출처(src)·기준일(date). 중립 표현, 인과·투자 조언 없음."""
import datetime as dt, json, os, re, statistics as st
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def J(*p, d=None):
    try: return json.load(open(os.path.join(ROOT, *p)))
    except Exception: return d if d is not None else {}
IDX = J("data", "search-index.json").get("entities", {}); SEC = {s["id"]: s["label"] for s in J("data", "market", "sectors.json").get("sectors", [])}
AW = J("data", "us", "federal-awards.json"); LB = J("data", "us", "lobbying.json"); TR = J("data", "us", "trades.json"); PR = J("data", "us", "prices", "summary.json"); FA = J("data", "us", "facilities.json")
comp = {k[8:]: e for k, e in IDX.items() if k.startswith("company:")}
sector = {tk: e.get("sector") for tk, e in comp.items()}
def rank(vals, tk):  # 내림차순 순위, 동일 섹터 비교군
    s = sorted(vals.items(), key=lambda x: -x[1]); r = [t for t, _ in s].index(tk) + 1; return r, len(s)
def peers(d, tk):
    sid = sector.get(tk); p = {t: v for t, v in d.items() if sector.get(t) == sid and v}
    return (p, SEC.get(sid, sid)) if len(p) >= 3 else ({t: v for t, v in d.items() if v}, "전체 수집 기업")
def won(x): return f"${x/1e9:,.2f}B" if x >= 1e9 else f"${x/1e6:,.1f}M"
OUT = {}
def add(tk, kind, text, src, date, flag=None):
    o = OUT.setdefault(tk, {"lines": [], "flags": []}); o["lines"].append({"kind": kind, "text": text, "src": src, "date": date})
    if flag: o["flags"].append({"text": flag, "src": src, "date": date})
# 1) 연방 계약
awd = {t: c.get("total_usd") or 0 for t, c in (AW.get("companies") or {}).items()}
for tk, v in awd.items():
    if not v or tk not in comp: continue
    p, lab = peers(awd, tk); r, n = rank(p, tk)
    add(tk, "award", f"연방 계약 의무액 {won(v)}({AW['period'][0]}~{AW['period'][1]}, 회사명 키워드 매칭·자회사 포함, 리셀러 경유 계약 제외), {lab} {n}곳 중 {r}위(데이터상).", AW["companies"][tk]["source_url"], AW.get("updated"),
        f"연방 계약 의무액 {lab} 상위 10% ({r}/{n}, 데이터상)" if n >= 10 and r <= max(1, n // 10) else None)
# 2) 로비: 같은 분기끼리 전년 비교
lbs = {}
for tk, c in (LB.get("companies") or {}).items():
    q = c.get("by_quarter") or {}; ys = sorted({k[:4] for k in q if "-Q" in k})
    if len(ys) < 2: continue
    y1, y0 = ys[-1], ys[-2]; qs = [k[5:] for k in q if k.startswith(y1 + "-Q")]
    v = lambda y, x: q.get(f"{y}-{x[1]}A", q.get(f"{y}-{x}", 0))  # 수정보고(nA) 있으면 그것 사용
    a = sum(v(y1, x) for x in qs); b = sum(v(y0, x) for x in qs); lbs[tk] = (a, b, y1, y0, qs)
tot = {t: x[0] for t, x in lbs.items()}
for tk, (a, b, y1, y0, qs) in lbs.items():
    if tk not in comp or not a: continue
    p, lab = peers(tot, tk); r, n = rank(p, tk); ch = (a / b - 1) * 100 if b else None; qq = "·".join(sorted(qs))
    t = f"로비 보고 금액(외부 로비회사 수입+자체 지출 합산, 분기별 최신 수정보고 반영) {y1} {qq} {won(a)}" + (f", 전년 같은 분기 대비 {ch:+.0f}%" if ch is not None else "") + f", {lab} {n}곳 중 {r}위(공시 기준, 데이터상)."
    add(tk, "lobby", t, LB["companies"][tk]["source_url"], LB.get("updated"), f"로비 금액 전년 같은 분기 대비 {ch:+.0f}%" if ch is not None and abs(ch) >= 50 and a >= 1e5 else None)
# 3) 의원 PTR 신고 최근 90일 vs 직전 90일
T = [t for t in TR.get("trades", []) if t.get("tk") and t.get("filed")]
end = max((t["filed"] for t in T), default=None)
if end:
    e = dt.date.fromisoformat(end); a0 = str(e - dt.timedelta(days=90)); b0 = str(e - dt.timedelta(days=180)); by = {}
    for t in T: by.setdefault(t["tk"], []).append(t)
    for tk, L in by.items():
        if tk not in comp: continue
        cur = [t for t in L if t["filed"] > a0]; prv = [t for t in L if b0 < t["filed"] <= a0]
        if not cur and not prv: continue
        P = sum(t["ty"].startswith("P") for t in cur); S = sum(t["ty"].startswith("S") for t in cur); m = len({t["id"] for t in cur})
        txt = f"하원 PTR 신고 최근 90일({a0}~{end}) {len(cur)}건(구입 {P}·처분 {S}, 의원 {m}명), 직전 90일 {len(prv)}건. 신고 기준, 거래일→신고일 최대 45일 차이 가능."
        add(tk, "trade", txt, "https://disclosures-clerk.house.gov/FinancialDisclosure", end, f"의원 PTR 신고 최근 90일 {len(cur)}건(직전 {len(prv)}건)" if len(cur) >= 5 and len(cur) >= 2 * max(1, len(prv)) else None)
# 4) 가격: 1개월 변화 vs 같은 섹터 중앙값
pt = PR.get("t") or {}
for tk, x in pt.items():
    if tk not in comp or x.get("m1") is None: continue
    sid = sector.get(tk); ps = [v["m1"] for t, v in pt.items() if sector.get(t) == sid and v.get("m1") is not None]
    med = st.median(ps) if len(ps) >= 3 else None
    add(tk, "price", f"종가 기준 1개월 {x['m1']:+.2f}%" + (f", 같은 업종({SEC.get(sid, sid)}) {len(ps)}곳 중앙값 {med:+.2f}%" if med is not None else "") + (f", 연초 대비 {x['ytd']:+.2f}%" if x.get("ytd") is not None else "") + ". 인과 아님.",
        "https://massive.com", PR.get("date"))
# 5) 공시 시설: 생산시설(본사 제외, 근접 좌표 중복 제거) 국가 분포, 공급사는 별도
BOX = [("대만", 21.5, 25.5, 119, 122.5), ("한국", 33, 39, 124, 131), ("일본", 30, 46, 129, 146), ("싱가포르", 1.1, 1.5, 103.6, 104.1), ("말레이시아", 0.8, 7.5, 99.5, 119.5),
       ("베트남", 8, 23.5, 102, 110), ("인도", 6, 36, 68, 97.5), ("중국", 18, 54, 73, 135), ("미국", 24, 50, -125, -66), ("독일", 47, 55.1, 5.8, 15.1),
       ("아일랜드", 51.3, 55.5, -10.7, -5.9), ("이스라엘", 29.4, 33.4, 34.2, 35.9)]
def ctry(f):
    for c, a, b, cc, d in BOX:
        if a <= f["lat"] <= b and cc <= f["lon"] <= d: return c
    return "기타"
def uniq(fs):
    out = []
    for f in fs:
        if not any(abs(f["lat"] - g["lat"]) < 0.05 and abs(f["lon"] - g["lon"]) < 0.05 and f["kind"] == g["kind"] for g in out): out.append(f)
    return out
def dist(fs):
    cnt = {}
    for f in fs: cnt[ctry(f)] = cnt.get(ctry(f), 0) + 1
    return ", ".join(f"{a} {b}" for a, b in sorted(cnt.items(), key=lambda x: -x[1]))
SPECIAL = {"TSM": "2025 20-F에 언급된 생산 거점 지역 6곳: 대만 3(신주 본사·타이중·타이난), 미국·일본·독일 각 1(증설 언급 포함, 팹 수 아님, 좌표 기준 대략)."}
for tk, fs in (FA.get("companies") or {}).items():
    if tk not in comp: continue
    form = re.sub(r"^(10-K|20-F) (\S+)", r"\2 \1", fs[0].get("form") or "공시"); src = fs[0]["source_url"]
    if tk in SPECIAL: add(tk, "supply", SPECIAL[tk], src, None); continue
    prod = uniq([f for f in fs if f["kind"] == "factory"]); sup = [f for f in fs if f["kind"] == "supplier"]
    if len(prod) >= 2: add(tk, "supply", f"{form} 생산시설 {len(prod)}곳(본사 제외) 중 {dist(prod)}(좌표 기준 대략).", src, None)
    elif sup: add(tk, "supply", f"{form}에 언급된 공급사 {len(sup)}곳: {dist(sup)}(공급사 소재지 좌표 기준 대략).", src, None)
# 6) 한국 국회 의안(경로에 한국 정류장 있는 기업)
KP = J("data", "policy", "kr.json"); KI = [i for i in KP.get("items") or [] if i.get("kind") != "press"]; KS = [i for i in KP.get("items") or [] if i.get("kind") == "press"]
if KI:
    d0 = min(i["d"] for i in KI if i.get("d")); d1 = max(i["d"] for i in KI if i.get("d"))
    for tk, e in comp.items():
        if not any(33 <= (t.get("lat") or 0) <= 39 and 124 <= (t.get("lon") or 0) <= 131 for t in e.get("route", [])): continue
        sid = sector.get(tk); k = [i for i in KI if sid in i["tags"]]; tr = [i for i in KI if "trade" in i["tags"]]
        add(tk, "policy", f"한국 국회 발의 법률안 {d0}~{d1} {len(KI)}건 중 {SEC.get(sid, sid)} 관련 {len(k)}건, 관세·통상 관련 {len(tr)}건" + (f", 과기정통부 보도자료 {len(KS)}건 중 {SEC.get(sid, sid)} 관련 {sum(1 for i in KS if sid in i['tags'])}건" if KS else "") + "(제목 키워드 기준, 영향 단정 아님).", KP.get("source_url"), d1)
# 요약 3줄: 우선순위 award > lobby > trade > supply > price
PRI = {"award": 0, "lobby": 1, "trade": 2, "supply": 3, "policy": 4, "price": 5}
for tk, o in OUT.items(): o["summary"] = [l["text"] for l in sorted(o["lines"], key=lambda l: PRI[l["kind"]])[:3]]
if "TSM" in OUT: OUT["2330.TW"] = OUT["TSM"]
json.dump({"updated": dt.date.today().isoformat(), "about": "저장된 공개 데이터에서 규칙으로 계산한 비교 수치. AI 미연결. 인과 아님. 투자 조언 아님.", "companies": OUT},
          open(os.path.join(ROOT, "data", "us", "insights.json"), "w"), ensure_ascii=False, separators=(",", ":"))
print("insights", len(OUT), "flags", sum(len(o["flags"]) for o in OUT.values()))
