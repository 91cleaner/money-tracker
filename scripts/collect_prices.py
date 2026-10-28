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
        json.dump({"source": "Massive(구 Polygon) grouped daily, 수정종가(adjusted) 기준", "as_of": D[-1]["date"], "d": d, "c": c},
                  open(os.path.join(OUT, tk + ".json"), "w"), separators=(",", ":"))
    return len(S)
def load_days():
    files = sorted(f for f in os.listdir(OUT) if re.fullmatch(r"\d{4}-\d{2}-\d{2}\.json", f))
    return [json.load(open(os.path.join(OUT, f))) for f in files]
def summarize():
    D = load_days()
    if not D: return
    print("series", write_series(D))
    last = D[-1]; out = {}
    def at(tk, k):  # k거래일 전 종가
        return D[-1 - k]["c"].get(tk) if len(D) > k else None
    y0 = [x for x in D if x["date"][:4] < last["date"][:4]]
    for tk, c in last["c"].items():
        def ch(p): return round((c / p - 1) * 100, 2) if p else None
        sp = [(x["date"], x["c"][tk]) for x in D[-22:] if tk in x["c"]]
        out[tk] = {"c": c, "d1": ch(at(tk, 1)), "w1": ch(at(tk, 5)), "m1": ch(at(tk, 21)),
                   "ytd": ch(y0[-1]["c"].get(tk)) if y0 else None, "sp": [v for _, v in sp], "from": sp[0][0] if sp else None}
    json.dump({"date": last["date"], "days": len(D), "source": "Massive(구 Polygon) grouped daily, 수정종가(adjusted) 기준",
               "note": "종가 기준 일별 데이터. 투자 조언 아님.", "t": out}, open(os.path.join(OUT, "summary.json"), "w"), separators=(",", ":"))
    print("summary", last["date"], len(out), "days", len(D))
if __name__ == "__main__":
    if "--series" in sys.argv: print("series", write_series(load_days())); sys.exit(0)  # 키 없이 시계열만 재생성
    if not KEY: sys.exit("POLYGON_API_KEY 없음")
    collect(int(sys.argv[1]) if len(sys.argv) > 1 else 7); summarize()
