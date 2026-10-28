#!/usr/bin/env python3
"""한국 정책 브리핑(korea.kr) RSS 수집 → data/policy/kr.json. 키 불필요. 부처 보도자료 제목·날짜·링크만 저장.
섹터 태그는 제목 키워드 기준(영향 단정 아님)."""
import datetime as dt, email.utils, json, os, re, sys, urllib.request, xml.etree.ElementTree as ET
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEEDS = {"산업통상자원부": "https://www.korea.kr/rss/dept_motie.xml", "기획재정부": "https://www.korea.kr/rss/dept_moef.xml",
         "금융위원회": "https://www.korea.kr/rss/dept_fsc.xml", "과학기술정보통신부": "https://www.korea.kr/rss/dept_msit.xml",
         "정책브리핑 보도자료": "https://www.korea.kr/rss/pressrelease.xml"}
TAGS = {"semiconductor": r"반도체|파운드리|HBM|메모리|팹", "battery": r"배터리|2차전지|이차전지|양극재|리튬", "auto": r"자동차|전기차|미래차|모빌리티",
        "ai": r"인공지능|AI|데이터센터|클라우드", "shipbuilding": r"조선|선박|해운", "defense": r"방산|방위산업|국방", "energy": r"에너지|원전|원자력|전력|LNG|수소|태양광|풍력",
        "bio": r"바이오|제약|의약품|백신", "trade": r"관세|수출|수입|통상|무역|FTA"}
def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 MoneyTracker"})
    with urllib.request.urlopen(req, timeout=40) as r: return r.read()
def main():
    p = os.path.join(ROOT, "data", "policy", "kr.json")
    old = json.load(open(p)) if os.path.exists(p) else {"items": []}
    seen = {i["u"]: i for i in old["items"]}; log = {}
    for dept, u in FEEDS.items():
        try:
            root = ET.fromstring(get(u)); n = 0
            for it in root.iter("item"):
                t = (it.findtext("title") or "").strip(); l = (it.findtext("link") or "").strip(); d = it.findtext("pubDate") or ""
                if not t or not l.startswith("https://www.korea.kr/"): continue
                try: d = email.utils.parsedate_to_datetime(d).date().isoformat()
                except Exception: d = None
                tags = [k for k, rx in TAGS.items() if re.search(rx, t)]
                if l not in seen: seen[l] = {"t": t, "u": l, "d": d, "dept": dept, "tags": tags}; n += 1
            log[dept] = f"ok +{n}"
        except Exception as e: log[dept] = f"fail {type(e).__name__}: {str(e)[:80]}"
    items = sorted(seen.values(), key=lambda x: x.get("d") or "", reverse=True)[:400]
    json.dump({"updated": dt.date.today().isoformat(), "country": "kr", "source": "대한민국 정책브리핑 korea.kr RSS(부처 보도자료)",
               "note": "제목·날짜·원문 링크만. 섹터 태그는 제목 키워드 기준, 영향 단정 아님. 투자 조언 아님.", "log": log, "items": items},
              open(p, "w"), ensure_ascii=False, indent=0)
    print(json.dumps(log, ensure_ascii=False), len(items))
    if not items: sys.exit(1)
if __name__ == "__main__": main()
