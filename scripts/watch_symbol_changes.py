#!/usr/bin/env python3
"""티커 변경 감시: SEC 8-K 표지(Trading Symbol)와 SEC 티커 목록을 우리 종목 목록과 비교해 어긋나는 것을 찾는다.
공식 무료 자료(SEC EDGAR)만 쓴다. 키 불필요. 찾은 것은 '확인 필요' 목록일 뿐이고, 사람이 공시를 읽고
data/us/symbol-changes.json의 confirmed에 넣어야 가격·회사 정보가 바뀐다.
  python3 scripts/watch_symbol_changes.py [days=45]  → data/us/symbol-watch.json"""
import datetime as dt, html, json, os, re, sys, time, urllib.request, urllib.error
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "us", "symbol-watch.json")
UA = os.environ.get("SEC_USER_AGENT") or os.environ.get("SEC_UA") or "MoneyTracker research Leecheolhan91@gmail.com"
STOP = {"LLC", "INC", "NYSE", "THE", "CLASS", "PER", "SHARE", "PAR", "NAME", "EACH", "OF", "ON", "AND", "NONE", "N", "A", "B", "C", "LP", "PLC", "SA", "NV", "AG", "SE", "ADS", "USD", "CORP", "CO", "LTD"}
def get(url, raw=False):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"}), timeout=60) as r:
                b = r.read(); return b.decode("utf-8", "replace") if raw else json.loads(b)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            time.sleep(30 if e.code in (403, 429) else 5 * (i + 1))
        except Exception: time.sleep(5 * (i + 1))
    return None
def cover_symbols(doc):
    """8-K 표지의 'Trading Symbol(s)' 칸에 적힌 기호들."""
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", doc[:400000]))).replace("\u200b", " ")
    i = t.find("Trading Symbol")
    if i < 0: return None
    j = t.find("Indicate by check mark", i)
    seg = t[i + 14: j if j > i else i + 1500]
    return sorted({w for w in re.findall(r"\b[A-Z]{1,5}(?:[.-][A-Z]{1,2})?\b", seg) if w not in STOP and not w.startswith("NASDAQ")})
def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 45
    since = str(dt.date.today() - dt.timedelta(days=days))
    ts = json.load(open(os.path.join(ROOT, "data", "us", "ticker-sectors.json")))["tickers"]
    known = json.load(open(os.path.join(ROOT, "data", "us", "symbol-changes.json")))["confirmed"]
    sec = get("https://www.sec.gov/files/company_tickers.json") or {}
    now_cik = {}
    for v in sec.values(): now_cik.setdefault(v["ticker"].upper(), []).append(v["cik_str"])
    flags, checked, docs = [], 0, 0
    for tk in sorted(ts):
        cik = ts[tk].get("cik")
        if not cik or tk in known: continue
        f = {"tk": tk, "cik": cik, "name": ts[tk].get("name")}
        if now_cik and cik not in now_cik.get(tk.replace(".", "-"), now_cik.get(tk, [])):
            flags.append(dict(f, kind="SEC 티커 목록에서 이 티커의 회사가 바뀜", sec_ciks=now_cik.get(tk, []), url="https://www.sec.gov/files/company_tickers.json"))
        j = get("https://data.sec.gov/submissions/CIK%010d.json" % int(cik)); time.sleep(0.15); checked += 1
        if not j: continue
        r = j["filings"]["recent"]
        k = next((i for i, x in enumerate(r["form"]) if x == "8-K" and r["filingDate"][i] >= since), None)
        if k is None: continue
        url = "https://www.sec.gov/Archives/edgar/data/%d/%s/%s" % (int(cik), r["accessionNumber"][k].replace("-", ""), r["primaryDocument"][k])
        doc = get(url, raw=True); time.sleep(0.15); docs += 1
        sy = cover_symbols(doc or "")
        if sy and not ({tk, tk.replace(".", "-"), tk.replace(".", "")} & (set(sy) | set(j.get("tickers") or []))):  # 표지에도 SEC 현재 티커 목록에도 없을 때만
            flags.append(dict(f, kind="8-K 표지의 거래 기호에 이 티커가 없음", cover_symbols=sy, sec_tickers=j.get("tickers"), filed=r["filingDate"][k], url=url))
    old = {(x["tk"], x["kind"]) for x in (json.load(open(OUT)).get("flags", []) if os.path.exists(OUT) else [])}
    for x in flags:
        if (x["tk"], x["kind"]) not in old: print("::warning::티커 확인 필요 %s (%s): %s %s" % (x["tk"], x["name"], x["kind"], x["url"]))
    json.dump({"updated": str(dt.date.today()), "source": "SEC EDGAR company_tickers.json + data.sec.gov submissions + 8-K 표지(Trading Symbol)",
               "note": "자동으로 찾은 '확인 필요' 목록. 공시를 사람이 읽고 확인하기 전까지 화면 숫자는 바꾸지 않음.",
               "days": days, "checked": checked, "covers_read": docs, "confirmed": sorted(known), "flags": flags},
              open(OUT, "w"), ensure_ascii=False, indent=1)
    print("checked", checked, "covers", docs, "flags", len(flags))
if __name__ == "__main__": main()
