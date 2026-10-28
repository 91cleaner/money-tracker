"""관제실용 세계 주가 역사: data/markets/<심볼>.json + data/markets/index.json

한국·미국·일본·대만·유럽의 대표 지수, 주요 종목, 업종 ETF, 환율·원자재·금리를 일별 종가로 쌓는다.
- 처음(파일 없음): 10년 치. 이후: 최근 40일만 받아 겹치는 날은 새 값으로, 없던 날은 추가(과거 기록은 지우지 않음).
- 출처: Yahoo Finance chart API(키 없음). 실패하면 Stooq CSV(지원하는 심볼만). 둘 다 실패하면 이전 파일 유지 + ::warning::.
- 실시간 시세가 아니라 '하루 마감 종가 기록'이다. 투자 신호가 아니다.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "data", "markets")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"}
BUDGET = float(os.environ.get("MARKETS_BUDGET_MIN", "12")) * 60
T0 = time.time()

# (심볼, 이름, 지역, 통화, 분야 태그) — 분야 태그는 법안 주제와 시세를 잇는 데 쓴다(collector/world/topics.py)
SYMBOLS = [
    # 미국
    ("^GSPC", "S&P 500", "us", "USD", ["market"]),
    ("^IXIC", "나스닥 종합", "us", "USD", ["market", "tech"]),
    ("^DJI", "다우존스", "us", "USD", ["market"]),
    ("SOXX", "미국 반도체 ETF", "us", "USD", ["semiconductor"]),
    ("XLE", "미국 에너지 업종 ETF", "us", "USD", ["energy"]),
    ("XLF", "미국 금융 업종 ETF", "us", "USD", ["finance"]),
    ("XLI", "미국 산업재 업종 ETF", "us", "USD", ["industrial", "trade"]),
    ("XLV", "미국 헬스케어 업종 ETF", "us", "USD", ["health"]),
    ("XLK", "미국 기술 업종 ETF", "us", "USD", ["tech"]),
    ("ITA", "미국 항공우주·방산 ETF", "us", "USD", ["defense"]),
    ("ICLN", "글로벌 청정에너지 ETF", "us", "USD", ["clean_energy"]),
    ("LIT", "리튬·2차전지 ETF", "us", "USD", ["battery", "ev"]),
    ("XHB", "미국 주택건설 ETF", "us", "USD", ["housing"]),
    ("NVDA", "엔비디아", "us", "USD", ["semiconductor", "ai"]),
    ("AAPL", "애플", "us", "USD", ["tech"]),
    ("MSFT", "마이크로소프트", "us", "USD", ["tech", "ai"]),
    ("GOOGL", "알파벳(구글)", "us", "USD", ["tech", "ai"]),
    ("AMZN", "아마존", "us", "USD", ["tech"]),
    ("META", "메타", "us", "USD", ["tech"]),
    ("TSLA", "테슬라", "us", "USD", ["ev", "battery"]),
    ("INTC", "인텔", "us", "USD", ["semiconductor"]),
    ("MU", "마이크론", "us", "USD", ["semiconductor"]),
    ("LMT", "록히드마틴", "us", "USD", ["defense"]),
    ("RTX", "RTX(레이시온)", "us", "USD", ["defense"]),
    ("XOM", "엑슨모빌", "us", "USD", ["energy"]),
    ("JPM", "JP모건", "us", "USD", ["finance"]),
    ("COIN", "코인베이스", "us", "USD", ["crypto"]),
    ("PFE", "화이자", "us", "USD", ["health"]),
    # 한국
    ("^KS11", "코스피", "kr", "KRW", ["market"]),
    ("^KQ11", "코스닥", "kr", "KRW", ["market", "tech"]),
    ("005930.KS", "삼성전자", "kr", "KRW", ["semiconductor", "tech"]),
    ("000660.KS", "SK하이닉스", "kr", "KRW", ["semiconductor", "ai"]),
    ("005380.KS", "현대차", "kr", "KRW", ["auto", "ev", "trade"]),
    ("373220.KS", "LG에너지솔루션", "kr", "KRW", ["battery", "ev"]),
    ("006400.KS", "삼성SDI", "kr", "KRW", ["battery"]),
    ("035420.KS", "네이버", "kr", "KRW", ["tech", "ai"]),
    ("012450.KS", "한화에어로스페이스", "kr", "KRW", ["defense"]),
    ("329180.KS", "HD현대중공업", "kr", "KRW", ["shipbuilding", "defense"]),
    ("105560.KS", "KB금융", "kr", "KRW", ["finance"]),
    ("207940.KS", "삼성바이오로직스", "kr", "KRW", ["health"]),
    # 일본
    ("^N225", "닛케이 225", "jp", "JPY", ["market"]),
    ("7203.T", "도요타", "jp", "JPY", ["auto", "ev", "trade"]),
    ("6758.T", "소니", "jp", "JPY", ["tech"]),
    ("8035.T", "도쿄일렉트론", "jp", "JPY", ["semiconductor"]),
    ("9984.T", "소프트뱅크그룹", "jp", "JPY", ["tech", "ai"]),
    ("7011.T", "미쓰비시중공업", "jp", "JPY", ["defense", "industrial"]),
    ("8306.T", "미쓰비시UFJ", "jp", "JPY", ["finance"]),
    # 대만
    ("^TWII", "대만 가권지수", "tw", "TWD", ["market"]),
    ("2330.TW", "TSMC", "tw", "TWD", ["semiconductor", "ai"]),
    ("2317.TW", "폭스콘(홍하이)", "tw", "TWD", ["tech", "ai"]),
    ("2454.TW", "미디어텍", "tw", "TWD", ["semiconductor"]),
    ("2308.TW", "델타일렉트로닉스", "tw", "TWD", ["energy", "tech"]),
    # 유럽
    ("^STOXX50E", "유로 스톡스 50", "eu", "EUR", ["market"]),
    ("^GDAXI", "독일 DAX", "eu", "EUR", ["market"]),
    ("^FCHI", "프랑스 CAC 40", "eu", "EUR", ["market"]),
    ("ASML.AS", "ASML", "eu", "EUR", ["semiconductor"]),
    ("SAP.DE", "SAP", "eu", "EUR", ["tech", "ai"]),
    ("SIE.DE", "지멘스", "eu", "EUR", ["industrial"]),
    ("RHM.DE", "라인메탈", "eu", "EUR", ["defense"]),
    ("MC.PA", "LVMH", "eu", "EUR", ["consumer", "trade"]),
    ("TTE.PA", "토탈에너지", "eu", "EUR", ["energy"]),
    ("NOVO-B.CO", "노보 노디스크", "eu", "DKK", ["health"]),
    # 환율·원자재·금리
    ("KRW=X", "원/달러 환율", "fx", "KRW", ["fx", "trade"]),
    ("JPY=X", "엔/달러 환율", "fx", "JPY", ["fx", "trade"]),
    ("TWD=X", "대만달러/달러 환율", "fx", "TWD", ["fx", "trade"]),
    ("EURUSD=X", "유로/달러 환율", "fx", "USD", ["fx", "trade"]),
    ("CL=F", "WTI 원유 선물", "commodity", "USD", ["energy"]),
    ("GC=F", "금 선물", "commodity", "USD", ["safe_haven"]),
    ("^TNX", "미국 10년 국채 금리(%)", "rates", "%", ["rates"]),
    ("BTC-USD", "비트코인", "crypto", "USD", ["crypto"]),
]


def fname(sym):
    return "".join(ch if ch.isalnum() else "_" for ch in sym).strip("_") + ".json"


def yahoo(sym, rng):
    url = "https://query1.finance.yahoo.com/v8/finance/chart/" + urllib.parse.quote(sym, safe="") + "?range=" + rng + "&interval=1d"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        d = json.loads(r.read().decode("utf-8"))
    res = (d.get("chart") or {}).get("result") or []
    if not res:
        return None
    ts = res[0].get("timestamp") or []
    cl = (((res[0].get("indicators") or {}).get("quote") or [{}])[0].get("close")) or []
    gmt = (res[0].get("meta") or {}).get("gmtoffset") or 0  # 그 시장의 날짜로
    out = {}
    for t, c in zip(ts, cl):
        if c is None:
            continue
        out[datetime.fromtimestamp(t + gmt, timezone.utc).strftime("%Y-%m-%d")] = round(float(c), 4)
    return out or None


def stooq(sym, rng):
    # Stooq 는 미국 주식·일부 지수만 확실하다. 실패하면 None.
    m = {"^GSPC": "^spx", "^DJI": "^dji", "^IXIC": "^ndq", "^N225": "^nkx", "^GDAXI": "^dax"}.get(sym)
    if not m:
        if any(ch in sym for ch in "^=."):
            return None
        m = sym.lower() + ".us"
    url = "https://stooq.com/q/d/l/?s=" + urllib.parse.quote(m) + "&i=d"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        txt = r.read().decode("utf-8", "replace")
    out = {}
    for ln in txt.splitlines()[1:]:
        p = ln.split(",")
        if len(p) >= 5:
            try:
                out[p[0]] = round(float(p[4]), 4)
            except ValueError:
                pass
    return out or None


def fetch(sym, rng):
    errs = []
    for name, f in (("yahoo", yahoo), ("stooq", stooq)):
        try:
            s = f(sym, rng)
            if s:
                return s, name, errs
        except Exception as e:  # 원인만 남기고 다음 출처로
            errs.append(name + ":" + (("HTTP %s" % e.code) if hasattr(e, "code") else type(e).__name__))
        time.sleep(0.4)
    return None, None, errs


def pct(a, b):
    return round((a / b - 1) * 100, 2) if a and b else None


def main():
    os.makedirs(OUT, exist_ok=True)
    summary, failed, added = [], [], 0
    for sym, name, region, cur, tags in SYMBOLS:
        path = os.path.join(OUT, fname(sym))
        old = {}
        try:
            prev = json.load(open(path, encoding="utf-8"))
            old = dict(zip(prev.get("d", []), prev.get("c", [])))
        except (OSError, ValueError):
            prev = None
        if time.time() - T0 > BUDGET:
            failed.append(sym + "(시간 예산)")
            new, src = None, None
        else:
            new, src, errs = fetch(sym, "10y" if not old else "3mo")
            if not new:
                failed.append(sym + " " + ",".join(errs))
        merged = dict(old)
        if new:
            before = len(merged)
            merged.update(new)
            added += len(merged) - before
        if not merged:
            continue
        days = sorted(merged)
        doc = {
            "symbol": sym, "name": name, "region": region, "currency": cur, "tags": tags,
            "source": (src or (prev or {}).get("source") or "yahoo"), "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ") if new else (prev or {}).get("updated"),
            "note": "일별 마감 종가 기록(실시간 아님). 출처: Yahoo Finance(대체: Stooq).",
            "d": days, "c": [merged[x] for x in days],
        }
        tmp = path + ".tmp"
        json.dump(doc, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, path)
        c = doc["c"]
        def back(n):
            return c[-1 - n] if len(c) > n else None
        summary.append({"symbol": sym, "name": name, "region": region, "currency": cur, "tags": tags, "file": fname(sym),
                        "first": days[0], "last": days[-1], "n": len(days), "close": c[-1],
                        "d1": pct(c[-1], back(1)), "m1": pct(c[-1], back(21)), "y1": pct(c[-1], back(252))})
    json.dump({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "source": "Yahoo Finance chart API (fallback Stooq)",
               "note": "일별 마감 종가. d1/m1/y1 = 1일·약 1달(21거래일)·약 1년(252거래일) 변화율(%).", "series": summary},
              open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("markets: %d/%d series, +%d days, failed %d" % (len(summary), len(SYMBOLS), added, len(failed)))
    for f in failed:
        print("::warning::markets fetch failed - " + f)
    if len(summary) < len(SYMBOLS) // 2:
        print("::error::markets: fewer than half of the series are available")
        sys.exit(1)


if __name__ == "__main__":
    main()
