"""국민연금 국내주식 종목별 투자현황(공공데이터포털 파일데이터, 연말 기준). GitHub Actions에서 실행."""
import csv, io, json, os, re, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "nps"); os.makedirs(OUT, exist_ok=True)
PAGE = "https://www.data.go.kr/data/3070507/fileData.do"
UA = {"User-Agent": "Mozilla/5.0 (money-tracker data collector)"}
KST = timezone(timedelta(hours=9))

import time
KEY = os.environ.get("DATA_GO_KR_KEY", "")
LOG = []

def get(u, ref=None, tries=4, timeout=120):
    h = dict(UA); h.update({"Referer": ref} if ref else {})
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers=h), timeout=timeout).read()
        except Exception as e:
            LOG.append(f"{u.split('?')[0]} 시도{i+1}: {type(e).__name__} {str(e)[:80]}"); time.sleep(5 * (i + 1))
    raise RuntimeError("fail")

def via_odcloud():
    """api.odcloud.kr 자동변환 API(파일데이터 → JSON). 키는 로그에 남기지 않음."""
    doc = json.loads(get("https://infuser.odcloud.kr/oas/docs?namespace=3070507/v1"))
    def dt(pth):  # 요약의 기준일(YYYYMMDD)로 최신 파일 고르기
        m = re.search(r"(20\d{6})", doc["paths"][pth]["get"].get("summary", "") + doc["paths"][pth]["get"].get("description", ""))
        return m[1] if m else ""
    path = max(doc["paths"], key=dt); desc = dt(path)
    rows, page = [], 1
    while True:
        q = urllib.parse.urlencode({"page": page, "perPage": 1000, "serviceKey": KEY})
        d = json.loads(get(f"https://api.odcloud.kr/api{path}?{q}"))
        rows += d.get("data", []);
        if len(rows) >= d.get("totalCount", 0) or not d.get("data"): break
        page += 1
    return desc, f"https://api.odcloud.kr/api{path}", rows

def main():
    try:
        if not KEY: raise RuntimeError("DATA_GO_KR_KEY 없음")
        desc, url, rs = via_odcloud()
        m = re.search(r"(\d{8})", desc); title = m[1] if m else None
        out = []
        for r in rs:
            g = lambda *ks: next((r[k] for k in r if any(x in k for x in ks)), None)
            f = lambda v: float(str(v).replace(",", "")) if v not in (None, "", "-") else None
            out.append({"rank": int(f(g("번호"))), "company": str(g("종목명")).strip(), "value_100m_krw": f(g("평가액")),
                        "weight_pct": f(g("비중")), "stake_pct": f(g("지분율"))})
        out.sort(key=lambda x: x["rank"]); return save(title, out, list(rs[0].keys()) if rs else [], url, "api.odcloud.kr")
    except Exception as e:
        LOG.append(f"odcloud 실패: {type(e).__name__}")
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
    return save(title, out, hd, url, "data.go.kr 파일 다운로드")


def save(title, out, hd, url, via):
    asof = f"{title[:4]}-{title[4:6]}-{title[6:]}" if title else None
    d = {"updated": datetime.now(KST).strftime("%Y-%m-%d %H:%M"), "as_of": asof, "unit": "억원, %", "columns": hd,
         "source": "국민연금공단_국내주식 투자정보(공공데이터포털)", "source_url": PAGE, "file_url": url, "via": via,
         "also": "https://fund.nps.or.kr/oprtprcn/ivsmprcn/getOHED0003M0.do", "count": len(out),
         "total_value_100m_krw": round(sum(x["value_100m_krw"] or 0 for x in out)),
         "top20": out[:20], "stake_5pct_plus": [x for x in out if (x["stake_pct"] or 0) >= 5], "holdings": out}
    json.dump(d, open(os.path.join(OUT, f"holdings_kr_{asof or 'latest'}.json"), "w"), ensure_ascii=False, indent=1)
    print(asof, len(out), len(d["stake_5pct_plus"]))

if __name__ == "__main__":
    try: main()
    finally:
        json.dump({"updated": datetime.now(KST).strftime("%Y-%m-%d %H:%M"), "log": LOG, "manual_download": PAGE},
                  open(os.path.join(OUT, "kr_fetch_log.json"), "w"), ensure_ascii=False, indent=1)
