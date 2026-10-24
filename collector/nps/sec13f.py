"""국민연금(National Pension Service, CIK 0001608046) SEC 13F-HR 최근 2분기 보유 종목."""
import json, os, re, time, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "nps"); os.makedirs(OUT, exist_ok=True)
CIK = "1608046"
UA = os.environ.get("SEC_UA", "MoneyTracker Research contact@91cleaner.dev")  # SEC 규칙: 이름+연락처
FX = {"2026-06-30": (1549.4, "https://www.yna.co.kr/view/AKR20260630138800002")}  # 분기 말 서울 15:30 종가
KST = timezone(timedelta(hours=9))

def get(url):
    time.sleep(0.2)  # SEC 초당 10회 제한 아래로
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
    return urllib.request.urlopen(req, timeout=60).read()

def quarter(period):  # 2026-06-30 -> 2026Q2
    y, m = int(period[:4]), int(period[5:7]); return f"{y}Q{(m - 1) // 3 + 1}"

def filings():
    sub = json.loads(get(f"https://data.sec.gov/submissions/CIK{CIK.zfill(10)}.json"))
    r = sub["filings"]["recent"]; seen = {}
    for i, f in enumerate(r["form"]):
        if f not in ("13F-HR", "13F-HR/A"): continue
        p = r["reportDate"][i]
        if f == "13F-HR/A" and p in seen: continue  # 원본 우선(정정은 기록만)
        seen.setdefault(p, {"period": p, "form": f, "accession": r["accessionNumber"][i], "filed": r["filingDate"][i]})
    return sub["name"], sorted(seen.values(), key=lambda x: x["period"], reverse=True)[:2]

def holdings(acc):
    base = f"https://www.sec.gov/Archives/edgar/data/{CIK}/{acc.replace('-', '')}/"
    idx = json.loads(get(base + "index.json"))
    xmls = [i["name"] for i in idx["directory"]["item"] if i["name"].lower().endswith(".xml") and "primary_doc" not in i["name"].lower()]
    root = ET.fromstring(get(base + xmls[0]))
    ns = lambda t: [e for e in root.iter() if e.tag.split("}")[-1] == t]
    agg = {}
    for it in ns("infoTable"):
        g = lambda t: next((e.text for e in it.iter() if e.tag.split("}")[-1] == t), None)
        if g("putCall"): continue  # 옵션 제외
        k = g("cusip"); a = agg.setdefault(k, {"issuer": g("nameOfIssuer"), "cusip": k, "class": g("titleOfClass"), "value_usd": 0, "shares": 0})
        a["value_usd"] += int(float(g("value") or 0)); a["shares"] += int(float(g("sshPrnamt") or 0))
    return base, base + xmls[0], sorted(agg.values(), key=lambda x: -x["value_usd"])

def main():
    name, fs = filings(); now = datetime.now(KST).strftime("%Y-%m-%d %H:%M"); res = []
    for f in fs:
        base, xurl, h = holdings(f["accession"]); q = quarter(f["period"])
        # 2023년 이후 13F value는 달러 단위(이전은 천 달러)
        tot = sum(x["value_usd"] for x in h)
        d = {"updated": now, "filer": name, "cik": CIK, "quarter": q, "period": f["period"], "filed": f["filed"], "form": f["form"],
             "filing_url": base, "infotable_url": xurl, "source": "SEC EDGAR 13F-HR", "count": len(h), "total_value_usd": tot,
             "top20": h[:20], "holdings": h}
        fx = FX.get(f["period"])
        if fx:
            d["fx"] = {"usd_krw": fx[0], "date": f["period"], "source": fx[1]}
            d["total_value_100m_krw"] = round(tot * fx[0] / 1e8)
            for x in d["top20"]: x["value_100m_krw"] = round(x["value_usd"] * fx[0] / 1e8)
        json.dump(d, open(os.path.join(OUT, f"holdings_us_{q}.json"), "w"), ensure_ascii=False, indent=1); res.append(d)
    cur, prev = res[0], res[1]; pm = {x["cusip"]: x for x in prev["holdings"]}; cm = {x["cusip"]: x for x in cur["holdings"]}
    ch = []
    for k in set(pm) | set(cm):
        c, p = cm.get(k), pm.get(k); b = c or p
        ch.append({"issuer": b["issuer"], "cusip": k, "shares_prev": p["shares"] if p else 0, "shares_cur": c["shares"] if c else 0,
                   "share_change": (c["shares"] if c else 0) - (p["shares"] if p else 0),
                   "value_prev_usd": p["value_usd"] if p else 0, "value_cur_usd": c["value_usd"] if c else 0,
                   "status": "신규" if not p else "전량 매도" if not c else "유지"})
    # 매수/매도 크기: 주식 수 변화 × 현재(또는 직전) 주가 추정
    for x in ch:
        px = x["value_cur_usd"] / x["shares_cur"] if x["shares_cur"] else (x["value_prev_usd"] / x["shares_prev"] if x["shares_prev"] else 0)
        x["est_trade_usd"] = round(x["share_change"] * px)
    ch.sort(key=lambda x: x["est_trade_usd"])
    out = {"updated": now, "from": prev["quarter"], "to": cur["quarter"], "sources": [prev["filing_url"], cur["filing_url"]],
           "caveat": "주식분할·CUSIP 변경(분사·합병)은 보정하지 않아 신규/전량매도로 잡힐 수 있음(팩트체크 전)", "method": "주식 수 변화 × 해당 분기 말 13F 평가액 기준 주가(추정 거래액)",
           "total_value_usd": {prev["quarter"]: prev["total_value_usd"], cur["quarter"]: cur["total_value_usd"]},
           "top_buys": [x for x in reversed(ch) if x["est_trade_usd"] > 0][:20], "top_sells": [x for x in ch if x["est_trade_usd"] < 0][:20],
           "new": sum(x["status"] == "신규" for x in ch), "exited": sum(x["status"] == "전량 매도" for x in ch)}
    json.dump(out, open(os.path.join(OUT, "changes_us.json"), "w"), ensure_ascii=False, indent=1)
    print(cur["quarter"], prev["quarter"], cur["count"], cur["total_value_usd"])

if __name__ == "__main__": main()
