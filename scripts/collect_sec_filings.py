#!/usr/bin/env python3
"""SEC EDGAR(data.sec.gov submissions) → data/us/sec-filings.json
회사별 최근 10-K / 8-K 목록과 본사(사업장) 주소. 무료 공식 자료만, 키 불필요.
SEC는 초당 10회 제한 + User-Agent 필수 → 초당 약 5회로 느리게 호출한다.
  python3 scripts/collect_sec_filings.py [N]   (N: 상위 N개 회사, 기본 전체)"""
import json, os, sys, time, datetime, urllib.request, urllib.error
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "us", "sec-filings.json")
UA = os.environ.get("SEC_UA", "MoneyTracker Research contact@91cleaner.dev")
K_MAX, E_MAX = 5, 12  # 회사당 보관 개수


def get(url):
    for i in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(30 if e.code in (429, 403) else 5 * (i + 1))
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def addr(a):
    if not a:
        return None
    out = {}
    for k, f in (("street1", "street1"), ("street2", "street2"), ("city", "city"), ("state", "stateOrCountry"), ("zip", "zipCode")):
        out[k] = (a.get(f) or "").strip()
    return out if out["city"] or out["street1"] else None


def main():
    ts = json.load(open(os.path.join(ROOT, "data", "us", "ticker-sectors.json")))["tickers"]
    order = sorted(ts, key=lambda t: (-ts[t].get("trade_rows", 0), t))
    if len(sys.argv) > 1:
        order = order[:int(sys.argv[1])]
    old = {}
    try:
        old = json.load(open(OUT)).get("companies", {})
    except Exception:
        pass
    res, fail = {}, 0
    for tk in order:
        cik = ts[tk].get("cik")
        if not cik:
            continue
        j = get("https://data.sec.gov/submissions/CIK%010d.json" % int(cik))
        time.sleep(0.2)
        if not j or not j.get("filings"):
            fail += 1
            if tk in old:
                res[tk] = old[tk]  # 실패하면 지난 자료 유지
            continue
        r = j["filings"].get("recent", {})
        k, e = [], []
        for i in range(len(r.get("form", []))):
            f = r["form"][i]
            if f not in ("10-K", "10-K/A", "8-K", "8-K/A"):
                continue
            acc, doc = r["accessionNumber"][i], r["primaryDocument"][i]
            row = {"form": f, "filed": r["filingDate"][i], "period": r["reportDate"][i] or None,
                   "url": "https://www.sec.gov/Archives/edgar/data/%d/%s/%s" % (int(cik), acc.replace("-", ""), doc)}
            if f.startswith("8-K"):
                row["items"] = [x for x in (r["items"][i] or "").split(",") if x]
                if len(e) < E_MAX:
                    e.append(row)
            elif len(k) < K_MAX:
                k.append(row)
        ad = j.get("addresses", {})
        res[tk] = {"cik": int(cik), "name": j.get("name"), "hq": addr(ad.get("business")), "mail": addr(ad.get("mailing")),
                   "k10": k, "k8": e,
                   "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=%010d&type=&dateb=&owner=include&count=40" % int(cik)}
    if not res:
        print("::error::SEC에서 한 건도 받지 못했습니다")
        sys.exit(1)
    if fail:
        print("::warning::SEC 호출 실패 %d건 (지난 자료 유지)" % fail)
    with open(OUT, "w") as fh:
        json.dump({"updated": datetime.date.today().isoformat(),
                   "source": "SEC EDGAR data.sec.gov submissions (10-K, 8-K, business address)",
                   "note": "제출 목록과 주소 그대로. 해석 없음. 8-K 항목 번호는 SEC 양식 기준.",
                   "companies": res}, fh, ensure_ascii=False, separators=(",", ":"))
    print("ok", len(res), "fail", fail)


if __name__ == "__main__":
    main()
