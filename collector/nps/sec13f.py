"""국민연금(National Pension Service, CIK 0001608046) SEC 13F-HR 최근 2분기 보유 종목."""
import json, os, re, time, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "nps"); os.makedirs(OUT, exist_ok=True)
CIK = "1608046"
UA = (os.environ.get("SEC_USER_AGENT") or os.environ.get("SEC_UA") or "MoneyTracker research Leecheolhan91@gmail.com")  # SEC 규칙: 이름+연락처
FX = {"2026-03-31": (1530.1, "https://www.yna.co.kr/view/AKR20260331148100002"),
      "2026-06-30": (1549.4, "https://www.yna.co.kr/view/AKR20260630138800002"),
      "2026-09-30": (1352.8, "https://www.mt.co.kr/economy/2026/09/30/2026093015352291632")}  # 분기 말 서울 15:30 종가
# 분기 사이 기업행위: 직전 분기 주식 수를 현재 기준으로 환산(공식 공시 근거)
ACTIONS = [
 {"cusip": "482480100", "issuer": "KLA", "type": "주식분할 10:1", "ratio": 10, "date": "2026-06-11",
  "basis": "https://www.sec.gov/Archives/edgar/data/319201/000119312526269375/d144278d8k.htm"},
 {"cusip": "09857L108", "issuer": "Booking Holdings", "type": "주식분할 25:1", "ratio": 25, "date": "2026-04-02",
  "basis": "https://www.sec.gov/Archives/edgar/data/1075531/000107553126000008/bkng-20260218.htm"},
 {"cusip": "146869102", "issuer": "Carvana", "type": "주식분할 5:1", "ratio": 5, "date": "2026-05-07",
  "basis": "https://www.sec.gov/Archives/edgar/data/1690820/000169082026000039/cvna-20260505.htm"},
 {"cusip": "143658300", "new_cusip": "G2004J103", "issuer": "Carnival", "type": "통합(Carnival Corp → Carnival Corp Ltd) 1:1 + CUSIP 변경", "ratio": 1, "date": "2026-05-07",
  "basis": "https://www.sec.gov/Archives/edgar/data/815097/000110465926057200/tm2613680d1_8k.htm"},
 {"cusip": "438516106", "new_cusip": "438516205", "issuer": "Honeywell", "type": "역분할 1:2 + CUSIP 변경", "ratio": 0.5, "date": "2026-06-29",
  "basis": "https://www.sec.gov/Archives/edgar/data/773840/000077384026000084/exhibit991-pressrelease629.htm"},
 {"cusip": "438516106", "new_cusip": "43849R105", "issuer": "Honeywell Aerospace", "type": "분사(HON 2주당 HONA 1주)", "ratio": 0.5, "date": "2026-06-29", "spinoff": True,
  "basis": "https://www.nasdaqtrader.com/TraderNews.aspx?id=ECA2026-399"},
]
SUSPECT = {"26614N201": "DuPont CUSIP 변경(26614N102→26614N201) 추정, 비율 미확인 — 실제 매매 아닐 수 있음",
           "26614N102": "DuPont CUSIP 변경 추정, 비율 미확인 — 실제 매도 아닐 수 있음",
           "314352105": "FedEx Freight 분사로 받은 주식일 가능성(미확인) — 실제 매수 아닐 수 있음"}
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
            for x in d["holdings"]: x["value_100m_krw"] = round(x["value_usd"] * fx[0] / 1e8)
        json.dump(d, open(os.path.join(OUT, f"holdings_us_{q}.json"), "w"), ensure_ascii=False, indent=1); res.append(d)
    cur, prev = res[0], res[1]; cm = {x["cusip"]: x for x in cur["holdings"]}
    raw = {x["cusip"]: x for x in prev["holdings"]}; pm = {k: dict(v, adj_note=None) for k, v in raw.items()}
    acts = [a for a in ACTIONS if prev["period"] < a.get("date", "") <= cur["period"]]  # 두 분기 사이에 일어난 것만
    for act in acts:  # 직전 분기 주식 수를 현재 CUSIP·주식 수 기준으로 환산
        p = raw.get(act["cusip"])
        if not p: continue
        tgt = act.get("new_cusip", act["cusip"])
        pm[tgt] = {"issuer": p["issuer"], "cusip": tgt, "shares": round(p["shares"] * act["ratio"]),
                   "value_usd": 0 if act.get("spinoff") else p["value_usd"], "adj_note": {k: act[k] for k in ("type", "date", "basis")}}
        if tgt != act["cusip"]: pm[act["cusip"]]["moved"] = True
    ch = []
    for k in set(pm) | set(cm):
        c, p = cm.get(k), pm.get(k)
        if p and p.get("moved") and not c: continue  # CUSIP 이동분은 새 CUSIP에서 비교
        b = c or p; ps = p["shares"] if p else 0; cs = c["shares"] if c else 0
        px = c["value_usd"] / cs if cs else (p["value_usd"] / ps if ps else 0)
        ch.append({"issuer": b["issuer"], "cusip": k, "shares_prev_adj": ps, "shares_cur": cs, "share_change": cs - ps,
                   "value_prev_usd": p["value_usd"] if p else 0, "value_cur_usd": c["value_usd"] if c else 0,
                   "status": "신규" if not p else "전량 매도" if not c else "유지",
                   "adjustment": p.get("adj_note") if p else None, "est_trade_usd": round((cs - ps) * px),
                   "real": "확인 필요" if k in SUSPECT else True, "suspect_note": SUSPECT.get(k)})
    ch.sort(key=lambda x: x["est_trade_usd"])
    out = {"updated": now, "from": prev["quarter"], "to": cur["quarter"], "sources": [prev["filing_url"], cur["filing_url"]],
           "adjustments": acts, "caveat": "ACTIONS 표의 분할·CUSIP 변경·분사는 공식 공시로 보정. 그 밖의 기업행위는 미보정일 수 있음(팩트체크 전)", "method": "주식 수 변화 × 해당 분기 말 13F 평가액 기준 주가(추정 거래액)",
           "total_value_usd": {prev["quarter"]: prev["total_value_usd"], cur["quarter"]: cur["total_value_usd"]},
           "adjusted": [x for x in ch if x["adjustment"]],
           "top_buys": [x for x in reversed(ch) if x["est_trade_usd"] > 0][:20], "top_sells": [x for x in ch if x["est_trade_usd"] < 0][:20],
           "new": sum(x["status"] == "신규" for x in ch), "exited": sum(x["status"] == "전량 매도" for x in ch)}
    json.dump(out, open(os.path.join(OUT, "changes_us.json"), "w"), ensure_ascii=False, indent=1)
    print(cur["quarter"], prev["quarter"], cur["count"], cur["total_value_usd"])

if __name__ == "__main__": main()
