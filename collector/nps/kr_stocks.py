"""국민연금 국내주식 종목별 투자현황(공공데이터포털 파일데이터, 연말 기준). GitHub Actions에서 실행."""
import csv, io, json, os, re, urllib.request
from datetime import datetime, timezone, timedelta
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "nps"); os.makedirs(OUT, exist_ok=True)
PAGE = "https://www.data.go.kr/data/3070507/fileData.do"
UA = {"User-Agent": "Mozilla/5.0 (money-tracker data collector)"}
KST = timezone(timedelta(hours=9))

def get(u, ref=None):
    h = dict(UA); h.update({"Referer": ref} if ref else {})
    return urllib.request.urlopen(urllib.request.Request(u, headers=h), timeout=60).read()

def main():
    html = get(PAGE).decode("utf-8", "ignore")
    title = (re.search(r"국민연금공단_국내주식 투자정보_(\d{8})", html) or [None, None])[1]
    pk = re.search(r"publicDataPk\s*[=:]\s*['\"]?(\d+)", html); dk = re.search(r"publicDataDetailPk\s*[=:]\s*['\"]?([\w-]+)", html)
    meta = json.loads(get(f"https://www.data.go.kr/tcs/dss/selectFileDataDownload.do?publicDataPk={pk[1] if pk else '3070507'}"
                          f"&publicDataDetailPk={dk[1] if dk else ''}&fileDetailSn=1", PAGE))
    url = "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=%s&fileDetailSn=%s" % (meta["atchFileId"], meta.get("fileDetailSn", 1))
    raw = get(url, PAGE)
    for enc in ("utf-8-sig", "cp949"):
        try: txt = raw.decode(enc); break
        except UnicodeDecodeError: pass
    rows = list(csv.reader(io.StringIO(txt))); hd = rows[0]; out = []
    num = lambda s: float(s.replace(",", "")) if s and s.strip() not in ("", "-") else None
    for r in rows[1:]:
        if len(r) < 5: continue
        out.append({"rank": int(num(r[0])), "company": r[1].strip(), "value_100m_krw": num(r[2]), "weight_pct": num(r[3]), "stake_pct": num(r[4])})
    asof = f"{title[:4]}-{title[4:6]}-{title[6:]}" if title else None
    d = {"updated": datetime.now(KST).strftime("%Y-%m-%d %H:%M"), "as_of": asof, "unit": "억원, %", "columns": hd,
         "source": "국민연금공단_국내주식 투자정보(공공데이터포털)", "source_url": PAGE, "file_url": url,
         "also": "https://fund.nps.or.kr/oprtprcn/ivsmprcn/getOHED0003M0.do", "count": len(out),
         "total_value_100m_krw": round(sum(x["value_100m_krw"] or 0 for x in out)),
         "top20": out[:20], "stake_5pct_plus": [x for x in out if (x["stake_pct"] or 0) >= 5], "holdings": out}
    json.dump(d, open(os.path.join(OUT, f"holdings_kr_{asof or 'latest'}.json"), "w"), ensure_ascii=False, indent=1)
    print(asof, len(out), len(d["stake_5pct_plus"]))

if __name__ == "__main__": main()
