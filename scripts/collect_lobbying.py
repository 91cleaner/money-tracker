#!/usr/bin/env python3
"""Senate LDA(lda.gov) 로비 공시 집계 → data/us/lobbying.json
대상: scripts/us_company_list.py 상위 N개(기본 150). 의뢰인(client) 이름이 회사 검색어로 시작하는 공시만.
금액: 외부 로비회사 보고는 income, 자체 로비는 expenses(LDA 보고 기준). 최근 2개 연도. 키 불필요.
로비스트 개인 이름은 저장하지 않는다.
  python3 scripts/collect_lobbying.py [N]"""
import json, os, re, sys, time, datetime, urllib.request, urllib.parse, urllib.error
from collections import defaultdict, Counter
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from us_company_list import companies, ROOT
OUT = os.path.join(ROOT, "data", "us", "lobbying.json")
BILL = re.compile(r"\b(H\.?\s?R\.?|S\.?|H\.?\s?J\.?\s?Res\.?|S\.?\s?J\.?\s?Res\.?|H\.?\s?Res\.?|S\.?\s?Res\.?)\s?(\d{1,5})\b", re.I)
def get(url):
    for i in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "MoneyTracker research"}), timeout=60))
        except urllib.error.HTTPError as e:
            time.sleep(30 if e.code == 429 else 5 * (i + 1))
        except Exception:
            time.sleep(5 * (i + 1))
    return None
def norm_bill(p, n):
    return re.sub(r"[\s.]", "", p.upper()) + " " + n
def one(c, y, errs):
    q = defaultdict(float); issues = Counter(); bills = Counter(); filings = 0
    for yr in (y - 1, y):
        url = "https://lda.gov/api/v1/filings/?" + urllib.parse.urlencode({"client_name": c["query"], "filing_year": yr, "page_size": 25})
        while url:
            d = get(url); time.sleep(1)
            if d is None: errs.append(c["ticker"]); break
            for f in d.get("results", []):
                if not (f.get("client") or {}).get("name", "").upper().startswith(c["query"]): continue
                filings += 1
                q[f"{f['filing_year']}-{(f.get('filing_type') or '')[:2]}"] += float(f.get("income") or f.get("expenses") or 0)
                for a in f.get("lobbying_activities") or []:
                    if a.get("general_issue_code"): issues[a.get("general_issue_code_display") or a["general_issue_code"]] += 1
                    for m in BILL.finditer(a.get("description") or ""): bills[norm_bill(*m.groups())] += 1
            url = d.get("next")
    if not filings: return None
    return c["ticker"], {"query": c["query"], "filings": filings, "total_usd": round(sum(q.values()), 2),
        "by_quarter": dict(sorted(q.items())), "top_issues": issues.most_common(6), "bills_mentioned": bills.most_common(12),
        "source_url": "https://lda.gov/filings/public/filing/search/?client=" + urllib.parse.quote(c["query"])}
def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 150
    y = datetime.date.today().year; errs = []
    with ThreadPoolExecutor(3) as ex:
        res = dict(r for r in ex.map(lambda c: one(c, y, errs), companies(n)) if r)
    json.dump({"updated": datetime.date.today().isoformat(), "source": "Lobbying Disclosure Act filings (lda.gov API v1)", "source_url": "https://lda.gov/api/",
               "note": "데이터상 의뢰인 이름이 회사명으로 시작하는 공시만 합산. 외부 로비회사 보고는 수입(income), 자체 로비는 지출(expenses). 법안 번호는 활동 설명에서 자동 추출(회기 미표기) — 원문 확인 필요. 로비스트 개인 이름 미저장.",
               "years": [y - 1, y], "checked": n, "matched": len(res), "errors": sorted(set(errs)), "companies": res}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print("checked", n, "matched", len(res), "errors", len(set(errs)))
main()
