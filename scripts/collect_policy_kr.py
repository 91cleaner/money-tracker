#!/usr/bin/env python3
"""한국 의안: 열린국회정보(open.assembly.go.kr) 의원 발의 법률안 → data/policy/kr.json 누적.
KEY 없으면 열린국회정보 샘플 한도(최신 10건)만 받음. ASSEMBLY_KEY가 있으면 100건. 키는 출력하지 않음.
섹터 태그는 법안명 키워드 기준(영향 단정 아님)."""
import datetime as dt, json, os, re, sys, urllib.request, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAGS = {"semiconductor": r"반도체|파운드리|메모리", "battery_ev": r"배터리|2차전지|이차전지|전기자동차|전기차|리튬", "auto": r"자동차|모빌리티",
        "tech_ai": r"인공지능|데이터|클라우드|정보통신|소프트웨어|플랫폼", "shipbuilding": r"조선|선박|해운|해사", "defense": r"방위산업|방산|국방|군사",
        "energy": r"에너지|원자력|전력|전기사업|가스|석유|수소|신재생", "clean_energy": r"탄소|기후|재생에너지|태양광|풍력", "health": r"바이오|제약|의약품|약사법|의료기기|첨단재생",
        "trade": r"관세|수출|수출입|통상|무역|대외무역|외국환", "finance": r"금융|은행|보험|자본시장|증권|가상자산", "crypto": r"가상자산", "housing": r"주택|건축|부동산|도시정비"}
def main():
    key = os.environ.get("ASSEMBLY_KEY", "").strip(); p = os.path.join(ROOT, "data", "policy", "kr.json"); os.makedirs(os.path.dirname(p), exist_ok=True)
    old = json.load(open(p)) if os.path.exists(p) else {"items": []}; seen = {i["id"]: i for i in old["items"]}; got = 0
    q = {"Type": "json", "pIndex": 1, "pSize": 100 if key else 10, "AGE": 22}
    if key: q["KEY"] = key
    rows = []
    for pi in range(1, 6 if key else 2):
        q["pIndex"] = pi; u = "https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn?" + urllib.parse.urlencode(q)
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as r: d = json.load(r)
            rows += d["nzmimeepazxkubdpn"][1]["row"]
        except Exception as e: print("fetch fail page", pi, type(e).__name__); break
    for b in rows:
        t = b.get("BILL_NAME") or ""; bid = b.get("BILL_ID")
        if not bid or not t: continue
        if bid not in seen: got += 1
        seen[bid] = {"id": bid, "no": b.get("BILL_NO"), "t": t, "d": b.get("PROPOSE_DT"), "by": b.get("PROPOSER"), "cmte": b.get("COMMITTEE"), "res": b.get("PROC_RESULT"),
                     "u": b.get("DETAIL_LINK") or f"https://likms.assembly.go.kr/bill/billDetail.do?billId={bid}", "src": "국회 의안(열린국회정보)", "tags": [k for k, rx in TAGS.items() if re.search(rx, t)]}
    items = sorted(seen.values(), key=lambda x: x.get("d") or "", reverse=True)[:500]
    json.dump({"updated": dt.date.today().isoformat(), "country": "kr", "source": "열린국회정보 open.assembly.go.kr 국회의원 발의법률안(22대)", "source_url": "https://open.assembly.go.kr/portal/data/service/selectAPIServicePage.do/OOWY4R001216HX11439",
               "note": "법안명·발의일·소관위원회·원문 링크만. 섹터 태그는 법안명 키워드 기준, 영향 단정 아님. 투자 조언 아님." + ("" if key else " 인증키 없이 받는 샘플 한도(최신 10건/회)로 매일 누적."),
               "items": items}, open(p, "w"), ensure_ascii=False, indent=0)
    print("rows", len(rows), "new", got, "total", len(items))
    if not items: sys.exit(1)
if __name__ == "__main__": main()
