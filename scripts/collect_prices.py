#!/usr/bin/env python3
"""Massive(구 Polygon) grouped daily 종가 수집. 하루 1콜로 전체 종목.
무료 Basic: 일봉(EOD)만, 분당 5콜 → 콜 사이 13초 대기. 키는 env POLYGON_API_KEY(출력 금지).
사용: collect_prices.py [backfill_days]  (기본 7일; 최초 실행은 YTD 위해 300 권장)"""
import datetime as dt, json, os, re, sys, time, urllib.request, urllib.error
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "us", "prices")
KEY = os.environ.get("POLYGON_API_KEY", "")
def tickers():
    idx = json.load(open(os.path.join(ROOT, "data", "search-index.json")))
    return {k[8:] for k, e in idx["entities"].items() if k.startswith("company:") and "." not in k[8:]}
def fetch(day):
    u = f"https://api.massive.com/v2/aggs/grouped/locale/us/market/stocks/{day}?adjusted=true"
    req = urllib.request.Request(u, headers={"Authorization": "Bearer " + KEY, "User-Agent": "MoneyTracker"})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(65); continue
            if e.code in (403, 404): print(day, "HTTP", e.code); return None
            time.sleep(20)
        except Exception as e: print(day, type(e).__name__); time.sleep(20)
    return None
def collect(days):
    os.makedirs(OUT, exist_ok=True); T = tickers(); today = dt.date.today(); calls = 0
    for i in range(days, 0, -1):
        d = today - dt.timedelta(days=i - 1)
        if d.weekday() >= 5: continue
        p = os.path.join(OUT, f"{d}.json")
        if os.path.exists(p): continue
        if calls: time.sleep(13)
        j = fetch(str(d)); calls += 1
        if not j or not j.get("results"): continue  # 휴장일·미확정
        c = {r["T"]: r["c"] for r in j["results"] if r.get("T") in T and r.get("c") is not None}
        json.dump({"date": str(d), "c": c}, open(p, "w"), separators=(",", ":"))
        print(d, len(c))
def write_series(D):
    """종목별 종가 시계열 data/us/prices/<TICKER>.json = {d:[날짜],c:[종가],source,as_of} (company.html 종가 차트용)."""
    S = {}
    for x in D:
        for tk, v in x["c"].items(): S.setdefault(tk, ([], []))[0].append(x["date"]); S[tk][1].append(v)
    for tk, (d, c) in S.items():
        if not tk.replace("-", "").isalnum(): continue
        json.dump({"source": SRC, "as_of": D[-1]["date"], "d": d, "c": c},
                  open(os.path.join(OUT, tk + ".json"), "w"), separators=(",", ":"))
    return len(S)
SRC = "Massive(구 Polygon) · 민간 데이터 회사, 공식 자료 아님 · 수정종가"  # 미국 가격 출처: 민간 회사라 공식 자료가 아님을 그대로 밝힌다
# 같은 티커를 다른 회사가 다시 쓴 경우: 이 날짜 전 가격은 다른 증권이라 버린다(출처: 발행사 공식 발표).
REUSE = {"SPCX": ("2026-06-12", "SpaceX Nasdaq 첫 거래일(ir.spacex.com 2026-06-11 발표). 그 전 SPCX는 다른 ETF(2026-04-07에 SPCK로 변경, spcketf.com)")}
# 이 날짜 뒤 가격은 다른 증권이라 버린다(출처: SEC 공시).
ENDED = {"SATS": ("2026-06-23", "EchoStar는 2026-06 티커를 ECHO로 바꿈(SEC 8-K 2026-06-25 표지). 2026-10-20부터 SATS는 Strive, Inc.의 우선주(SEC 8-K 2026-10-20)")}
# 공식 자료로 이유를 확인한 끊김. 분할이 아니라 조정할 비율이 없어 변화율은 계속 숨기고 이유만 밝힌다.
BR_WHY = {("CTVA", "2026-10-01"): ("spinoff", "Corteva가 종자 사업을 Vylor Inc.(VYLR)로 떼어 내 주주에게 나눠 줌, 2026-10-01 완료(SEC 8-K 2026-10-01)",
                                  "https://www.sec.gov/Archives/edgar/data/1755672/000119312526409895/d116808d8k.htm")}
GAP_DAYS, JUMP = 5, 2.0  # 5거래일 넘게 끊기거나 하루에 2배/절반 넘게 바뀌면 그 앞뒤를 잇는 변화율은 확인 전까지 숨긴다
def load_days():
    files = sorted(f for f in os.listdir(OUT) if re.fullmatch(r"\d{4}-\d{2}-\d{2}\.json", f))
    D = [json.load(open(os.path.join(OUT, f))) for f in files]
    for x in D:
        for tk, (start, _) in REUSE.items():
            if x["date"] < start: x["c"].pop(tk, None)
        for tk, (end, _) in ENDED.items():
            if x["date"] > end: x["c"].pop(tk, None)
    return D
def breaks(D, tk):
    """tk 가격을 이어 볼 수 없는 날짜들(끊김 뒤 재개일, 급변일)과 이유."""
    pts = [(i, x["date"], x["c"][tk]) for i, x in enumerate(D) if tk in x["c"]]
    out = []
    for (i0, d0, c0), (i1, d1, c1) in zip(pts, pts[1:]):
        if i1 - i0 > GAP_DAYS: out.append((d1, "gap"))
        elif c0 and (c1 / c0 >= JUMP or c1 / c0 <= 1 / JUMP): out.append((d1, "jump"))
    return out, (pts[0][1] if pts else None)
def summarize():
    D = load_days()
    if not D: return
    print("series", write_series(D))
    last = D[-1]; out = {}
    def at(tk, k):  # k거래일 전 종가
        return D[-1 - k]["c"].get(tk) if len(D) > k else None
    y0 = [x for x in D if x["date"][:4] < last["date"][:4]]
    for tk, c in last["c"].items():
        br, first = breaks(D, tk)
        def ok(base):  # base 날짜부터 오늘까지 끊김·급변이 없고, 그 종목 첫 기록 이후여야 계산
            return base is not None and first is not None and base >= first and not any(base < b <= last["date"] for b, _ in br)
        def ch(p, base=None): return round((c / p - 1) * 100, 2) if p and ok(base) else None
        sp = [(x["date"], x["c"][tk]) for x in D[-22:] if tk in x["c"]]
        bd = lambda k: D[-1 - k]["date"] if len(D) > k else None
        sp = [(d, v) for d, v in sp if ok(d) or d == last["date"]]
        out[tk] = {"c": c, "d1": ch(at(tk, 1), bd(1)), "w1": ch(at(tk, 5), bd(5)), "m1": ch(at(tk, 21), bd(21)),
                   "ytd": ch(y0[-1]["c"].get(tk), y0[-1]["date"]) if y0 else None, "sp": [v for _, v in sp], "from": sp[0][0] if sp else None}
        if tk in REUSE or (first and y0 and first > y0[-1]["date"]):  # 올해 새로 상장: 연초 대비 대신 첫 거래일 종가 대비
            f0 = next(x for x in D if tk in x["c"])
            out[tk]["ls"] = {"d": f0["date"], "c0": f0["c"][tk], "pct": round((c / f0["c"][tk] - 1) * 100, 2) if not any(b > f0["date"] for b, _ in br) else None}
        if br: out[tk]["br"] = [dict({"d": b, "why": w}, **({"ok": BR_WHY[(tk, b)][0], "note": BR_WHY[(tk, b)][1], "url": BR_WHY[(tk, b)][2]} if (tk, b) in BR_WHY else {})) for b, w in br]
    json.dump({"date": last["date"], "days": len(D), "source": SRC, "m1": "최근 21거래일", "ended": {k: v[1] for k, v in ENDED.items()},
               "note": "종가 기준 일별 데이터. 투자 조언 아님.", "t": out}, open(os.path.join(OUT, "summary.json"), "w"), separators=(",", ":"))
    print("summary", last["date"], len(out), "days", len(D))
EXTRA = ["BRK.B"]  # 점(.) 들어간 미국 종목: grouped daily에 안 잡혀서 종목별 range로 따로 받음
def extra_series(start="2025-12-15"):
    for tk in EXTRA:
        u = f"https://api.massive.com/v2/aggs/ticker/{tk}/range/1/day/{start}/{dt.date.today()}?adjusted=true&sort=asc&limit=50000"
        req = urllib.request.Request(u, headers={"Authorization": "Bearer " + KEY, "User-Agent": "MoneyTracker"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r: j = json.load(r)
        except Exception as e: print(tk, type(e).__name__); continue
        R = j.get("results") or []
        if not R: print(tk, "no results"); continue
        d = [dt.datetime.utcfromtimestamp(x["t"] / 1000).strftime("%Y-%m-%d") for x in R]
        json.dump({"source": SRC, "as_of": d[-1], "d": d, "c": [x["c"] for x in R]},
                  open(os.path.join(OUT, tk + ".json"), "w"), separators=(",", ":"))
        print(tk, len(d), d[-1]); time.sleep(13)
if __name__ == "__main__":
    if "--extra" in sys.argv: extra_series(); sys.exit(0)
    if "--summary" in sys.argv: summarize(); sys.exit(0)  # 키 없이 저장된 일별 파일로 요약·시계열 재계산
    if "--series" in sys.argv: print("series", write_series(load_days())); sys.exit(0)  # 키 없이 시계열만 재생성
    if not KEY: sys.exit("POLYGON_API_KEY 없음")
    collect(int(sys.argv[1]) if len(sys.argv) > 1 else 7); summarize(); time.sleep(13); extra_series()
