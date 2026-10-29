"""미국 의원 거래 종목의 주가로 '산 날(판 날) 이후 몇 % 움직였나' 계산: data/us/trades.json 에 붙인다.

주가: Yahoo Finance 일별 종가(chart API, 키 없음). 안 되면 Stooq CSV.
  p0 = 거래일(장 안 열린 날이면 그 다음 거래일) 종가, r = 그날부터 최근 종가까지 수익률(%),
  rspy = 같은 기간 S&P 500(SPY) 수익률(%). 매도는 '판 뒤 그 주식이 얼마나 움직였나'로 같은 숫자를 쓴다.
신고서에는 주식 수·체결가가 없어서 실제 손익이 아니라 '그 종목의 움직임'일 뿐이다.
"""
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
TR = os.path.join(ROOT, "data", "us", "trades.json")
PX = os.path.join(ROOT, "data", "us", "prices")  # 종목별 종가 파일 {d:[날짜], c:[종가]} (scripts/collect_prices.py)
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"}
BUDGET = float(os.environ.get("PRICES_BUDGET_MIN", "12")) * 60
T0 = time.time()


def yahoo(tk, start):
    sym = tk.replace(".", "-")
    p1 = int(datetime.combine(start - timedelta(days=7), datetime.min.time(), timezone.utc).timestamp())
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?period1={p1}&period2={int(time.time())}&interval=1d"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        d = json.loads(r.read().decode("utf-8"))
    res = (d.get("chart") or {}).get("result") or []
    if not res:
        return None
    ts, cl = res[0].get("timestamp") or [], ((res[0].get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    return [(datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d"), c) for t, c in zip(ts, cl) if c]


def stooq(tk, start):
    url = f"https://stooq.com/q/d/l/?s={tk.lower().replace('.', '-')}.us&i=d"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        txt = r.read().decode("utf-8", "replace")
    out = []
    for ln in txt.splitlines()[1:]:
        p = ln.split(",")
        if len(p) >= 5 and p[0] >= (start - timedelta(days=7)).isoformat():
            try:
                out.append((p[0], float(p[4])))
            except ValueError:
                pass
    return out or None


def series(tk, start):
    for f in (yahoo, stooq):
        try:
            s = f(tk, start)
            if s:
                return s
        except Exception:
            pass
        time.sleep(0.5)
    return None


def at(s, day):
    """거래일 종가(그날 장이 없으면 다음 거래일)."""
    for d, c in s:
        if d >= day:
            return d, c
    return None


def r_from_file(px, day):
    """종가 파일 px={d:[...],c:[...]} 기준 r: 거래일(휴장이면 다음 거래일) 종가 -> 파일의 마지막 종가, % 소수 1자리.
    거래일이 파일 범위 밖이면 None(계산 불가). 위 yahoo 계산(r = s[-1]/at(day) - 1)과 같은 식이다."""
    ds, cs = (px or {}).get("d") or [], (px or {}).get("c") or []
    if not ds or len(ds) != len(cs) or day < ds[0] or day > ds[-1]:
        return None
    i = next(k for k, x in enumerate(ds) if x >= day)
    if not cs[i]:
        return None
    return round(cs[i], 2), round((cs[-1] / cs[i] - 1) * 100, 1)


def reprice_from_files(T, px_dir=PX):
    """trades 의 p0/r(/rspy)을 data/us/prices/<TICKER>.json 에서 다시 계산해 화면(가격 파일)과 같은 값으로 맞춘다.
    파일이 없거나 거래일이 파일 범위 밖인 거래는 그대로 둔다. 바꾼 거래 수를 돌려준다."""
    cache, n = {}, 0

    def get(tk):
        if tk not in cache:
            f = os.path.join(px_dir, tk.replace("/", "_") + ".json")
            cache[tk] = json.load(open(f, encoding="utf-8")) if os.path.exists(f) else None
        return cache[tk]
    for t in T:
        tk, day = t.get("tk"), t.get("d")
        if not tk or not day or t.get("r") is None:
            continue
        got = r_from_file(get(tk), day)
        if not got:
            continue
        p0, r = got
        if t.get("r") != r or t.get("p0") != p0:
            n += 1
        t["p0"], t["r"] = p0, r
        spy = r_from_file(get("SPY"), day)
        if spy:
            t["rspy"] = spy[1]
    return n


def main():
    d = json.load(open(TR, encoding="utf-8"))
    T = d.get("trades", [])
    if "--reapply" in sys.argv:  # 네트워크 없이 가격 파일 기준으로만 r 다시 계산
        n = reprice_from_files(T)
        json.dump(d, open(TR, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(f"prices: 가격 파일 기준으로 r 다시 계산, 바뀐 거래 {n}")
        return
    tks = sorted({t["tk"] for t in T if t.get("tk") and t.get("d") and (t.get("at") in (None, "ST", "OP", "EF"))})
    start = min(datetime.fromisoformat(t["d"]).date() for t in T if t.get("d"))
    spy = series("SPY", start)
    if not spy:
        print("::warning::prices: S&P 500(SPY) 주가를 못 받아 건너뜀")
        return
    last_d, last_spy = spy[-1]
    px, miss = {}, []
    for tk in tks:
        if time.time() - T0 > BUDGET:
            print("prices: 시간 상한")
            break
        s = series(tk, start)
        if s:
            px[tk] = s
        else:
            miss.append(tk)
        time.sleep(0.25)
    n = 0
    for t in T:
        s = px.get(t.get("tk"))
        if not s or not t.get("d"):
            continue
        a, b = at(s, t["d"]), at(spy, t["d"])
        if not a or not b:
            continue
        t["p0"] = round(a[1], 2)
        t["r"] = round((s[-1][1] / a[1] - 1) * 100, 1)
        t["rspy"] = round((last_spy / b[1] - 1) * 100, 1)
        n += 1
    reprice_from_files(T)  # 화면이 쓰는 종가 파일과 같은 방식·같은 값으로 맞춤
    d["prices"] = {"as_of": last_d, "source": "Yahoo Finance daily close (fallback Stooq); S&P 500 = SPY",
                   "note": "r = % move of the stock from the trade date close to the latest close; rspy = S&P 500 over the same days. Not actual profit: filings show no share counts or prices.",
                   "tickers": len(px), "missing": miss[:200]}
    json.dump(d, open(TR, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"prices: 종목 {len(px)}/{len(tks)}, 수익률 붙인 거래 {n}, 기준일 {last_d}, 못 받은 종목 {len(miss)}")


if __name__ == "__main__":
    main()
