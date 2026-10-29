#!/usr/bin/env python3
"""SEC Form 4(내부자 거래 신고) 수집 → data/us/insider-form4.json
data.sec.gov submissions + www.sec.gov Archives 의 Form 4 XML만 사용(무료 공식, 키 없음).
SEC 규칙상 User-Agent 필수: 환경변수 SEC_USER_AGENT ("이름 연락처이메일" 형식). 값은 출력·저장하지 않는다.
공개시장 매수(코드 P)·매도(코드 S)만 집계. 스톡옵션 행사·세금 상계·증여 등은 건수만 따로 센다.
10b5-1 계획 표시(XML aff10b5One)는 그대로 전달. 해석·원인 단정 없음.
  SEC_USER_AGENT="..." python3 scripts/collect_form4.py [N] [DAYS]"""
import json, os, sys, time, datetime, urllib.request, urllib.error
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from us_company_list import ROOT, companies
OUT = os.path.join(ROOT, "data", "us", "insider-form4.json")
UA = os.environ.get("SEC_USER_AGENT", "").strip()
GAP = 0.2  # SEC 한도 초당 10회 이하


def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            time.sleep(GAP)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(30 if e.code in (403, 429) else 5 * (i + 1))
        except Exception:
            time.sleep(5 * (i + 1))
    return None


def tx(node, path):
    n = node.find(path)
    return (n.text or "").strip() if n is not None and n.text else ""


def num(s):
    try:
        return float(s)
    except ValueError:
        return None


def parse(xml):
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return None
    owners = []
    for o in root.findall("reportingOwner"):
        rel = o.find("reportingOwnerRelationship")
        role = []
        if rel is not None:
            if tx(rel, "isDirector") in ("1", "true"):
                role.append("director")
            if tx(rel, "isOfficer") in ("1", "true"):
                role.append(tx(rel, "officerTitle") or "officer")
            if tx(rel, "isTenPercentOwner") in ("1", "true"):
                role.append("10% owner")
        owners.append({"name": tx(o, "reportingOwnerId/rptOwnerName"), "role": ", ".join(role)})
    rows, other = [], 0
    for t in root.findall("nonDerivativeTable/nonDerivativeTransaction"):
        code = tx(t, "transactionCoding/transactionCode")
        if code not in ("P", "S"):
            other += 1
            continue
        rows.append({"date": tx(t, "transactionDate/value")[:10], "code": code,
                     "shares": num(tx(t, "transactionAmounts/transactionShares/value")),
                     "price": num(tx(t, "transactionAmounts/transactionPricePerShare/value")),
                     "after": num(tx(t, "postTransactionAmounts/sharesOwnedFollowingTransaction/value"))})
    other += len(root.findall("derivativeTable/derivativeTransaction"))
    return {"owners": owners, "rows": rows, "other": other, "plan10b5": tx(root, "aff10b5One") in ("1", "true")}


def one(c, since):
    cik = "%010d" % c["cik"]
    raw = get("https://data.sec.gov/submissions/CIK%s.json" % cik)
    if not raw:
        return None
    rc = json.loads(raw).get("filings", {}).get("recent", {})
    out, other, nfil = [], 0, 0
    for f, d, a, p in zip(rc.get("form", []), rc.get("filingDate", []), rc.get("accessionNumber", []), rc.get("primaryDocument", [])):
        if f != "4" or d < since:
            continue
        if nfil >= 40:
            break
        nfil += 1
        base = "https://www.sec.gov/Archives/edgar/data/%d/%s/" % (c["cik"], a.replace("-", ""))
        x = get(base + p.split("/")[-1])  # xslF345X05/ 렌더 경로를 떼면 원본 XML
        pr = parse(x) if x else None
        if not pr:
            continue
        other += pr["other"]
        o = pr["owners"][0] if pr["owners"] else {"name": "", "role": ""}
        for r in pr["rows"]:
            if r["date"] and r["date"] >= since:
                out.append({"filed": d, "date": r["date"], "code": r["code"], "shares": r["shares"], "price": r["price"],
                            "after": r["after"], "who": o["name"], "role": o["role"], "plan": pr["plan10b5"],
                            "url": base + a + "-index.htm"})
    return c["ticker"], {"cik": c["cik"], "filings": nfil, "other_rows": other, "trades": out,
                         "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=%s&type=4&dateb=&owner=only&count=40" % cik}


def main():
    if not UA:
        sys.exit("SEC_USER_AGENT 환경변수가 필요합니다(값은 출력하지 않음).")
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 150
    dayn = int(sys.argv[2]) if len(sys.argv) > 2 else 90
    today = datetime.date.today()
    since = (today - datetime.timedelta(days=dayn)).isoformat()
    ts = json.load(open(os.path.join(ROOT, "data", "us", "ticker-sectors.json")))["tickers"]
    res = {}
    for c in companies(n):
        c["cik"] = ts[c["ticker"]].get("cik")
        if not c["cik"]:
            continue
        r = one(c, since)
        if r:
            res[r[0]] = r[1]
    with open(OUT, "w") as fh:
        json.dump({"updated": today.isoformat(), "since": since, "days": dayn,
                   "source": "SEC EDGAR Form 4 (data.sec.gov / sec.gov Archives)", "source_url": "https://www.sec.gov/edgar/search/",
                   "note": "공개시장 매수(P)·매도(S) 행만 집계. 옵션 행사·세금 상계·증여 등은 other_rows 건수만. 같은 기간 일어난 일의 기록이며 이유는 알 수 없음. 투자 조언 아님.",
                   "companies": res}, fh, ensure_ascii=False, separators=(",", ":"))
    print("companies:", len(res))


if __name__ == "__main__":
    main()
