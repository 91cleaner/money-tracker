"""입찰 정보 페이지 자료: data/sec_bidpage.json (읽기 전용으로 data/city/*.json, data/sec_bid.json 을 묶는다).

입찰하는 업체가 궁금한 것 위주:
  - 분야별: 계약 수, 경쟁입찰 비율, (큰 계약) 평균 참가 업체 수·평균 낙찰률
  - 큰 계약(10억+) 낙찰 정보 목록: 참가 업체 수, 낙찰률, 지역 업체 조건, 공고 원문
  - 최근 경쟁입찰로 맺은 계약: 누가 어디서 땄나(개인사업자 이름은 가림)
낙찰률 = 예정가격 대비 낙찰 금액 비율(나라장터 낙찰정보 그대로).
"""
import collections
import glob
import json
import os
import statistics
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    from privacy import mask
except Exception:  # 가림 모듈이 없으면 업체 이름을 아예 싣지 않는다
    mask = None

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
KST = timezone(timedelta(hours=9))
COMP = ("제한경쟁", "일반경쟁", "지명경쟁")
RECENT_DAYS, RECENT_MAX, BIG_MAX = 30, 300, 400


def is_comp(m):
    return any(c in (m or "") for c in COMP)


def vname(n):
    if not n:
        return ""
    if mask is None:
        return ""
    return mask(n)


def main(root=ROOT):
    today = datetime.now(KST).strftime("%Y-%m-%d")
    bid = (json.load(open(os.path.join(root, "data", "sec_bid.json"), encoding="utf-8")).get("rows") or {}) if os.path.exists(os.path.join(root, "data", "sec_bid.json")) else {}
    cat = collections.defaultdict(lambda: {"n": 0, "t": 0, "cn": 0, "ct": 0, "qn": 0, "rate": [], "bidders": [], "solo": 0})
    big, recent, first, last = [], [], "9999", ""
    since = (datetime.now(KST) - timedelta(days=RECENT_DAYS)).strftime("%Y-%m-%d")
    for f in sorted(glob.glob(os.path.join(root, "data", "city", "*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        c = d["city"]
        for r in d.get("rows", []):
            day = r.get("odate") or r.get("date") or ""
            if not day or day >= today or r.get("chg"):
                continue
            first, last = min(first, day), max(last, day)
            k = r.get("cat") or "기타"
            a = r.get("this") or r.get("amount") or 0
            g = cat[k]
            g["n"] += 1
            g["t"] += a
            comp = is_comp(r.get("method"))
            if comp:
                g["cn"] += 1
                g["ct"] += a
            elif r.get("ntce"):  # 공고를 낸 수의계약(견적 입찰): 공고 보고 여러 업체가 견적을 냄
                g["qn"] += 1
            b = bid.get(r.get("no") or "")
            base = {"date": day, "slug": c["slug"], "cname": c.get("short") or c.get("name"), "inst": r.get("inst") or "", "title": r.get("title") or "",
                    "cat": k, "amount": a, "vendor": vname(r.get("vendor")), "vregion": " ".join(str(r.get("vregion") or "").split()[:2]),
                    "method": r.get("method") or "", "url": r.get("url") or ""}
            if b and (b.get("n") or b.get("rate") is not None):
                if b.get("rate") is not None:
                    g["rate"].append(b["rate"])
                if b.get("n"):
                    g["bidders"].append(b["n"])
                    if b["n"] == 1:
                        g["solo"] += 1
                big.append({**base, "n": b.get("n"), "rate": b.get("rate"), "region_rule": b.get("duty") or b.get("rgnlmt") or "",
                            "region_kind": "의무" if b.get("duty") else ("제한" if b.get("rgnlmt") else ""), "bid_url": b.get("url") or "", "bmethod": b.get("method") or ""})
            if comp and day >= since:
                recent.append(base)
    rows = []
    for k, g in cat.items():
        if not g["n"]:
            continue
        rows.append({"cat": k, "n": g["n"], "total": g["t"], "comp_n": g["cn"], "comp_pct": round(g["cn"] / g["n"] * 100, 1),
                     "open_n": g["cn"] + g["qn"], "open_pct": round((g["cn"] + g["qn"]) / g["n"] * 100, 1),
                     "med_rate": round(statistics.median(g["rate"]), 1) if g["rate"] else None, "n_rate": len(g["rate"]),
                     "med_bidders": round(statistics.median(g["bidders"])) if g["bidders"] else None, "solo": g["solo"]})
    rows.sort(key=lambda x: -x["n"])
    big.sort(key=lambda x: (x["date"], x["amount"]), reverse=True)
    recent.sort(key=lambda x: (x["date"], x["amount"]), reverse=True)
    out = {
        "updated": datetime.now(KST).isoformat(timespec="seconds"),
        "period": {"from": first if first != "9999" else "", "to": last, "recent_days": RECENT_DAYS},
        "source": "조달청 나라장터 계약정보·입찰공고정보·낙찰정보(공공데이터포털)",
        "note": "낙찰률은 기관이 미리 정한 가격(예정가격) 대비 낙찰 금액 비율. 참가 업체 수·낙찰률은 10억원 이상 계약 중 확인된 것만.",
        "by_cat": rows,
        "big": big[:BIG_MAX],
        "recent": recent[:RECENT_MAX],
    }
    p = os.path.join(root, "data", "sec_bidpage.json")
    with open(p + ".tmp", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(p + ".tmp", p)
    print(f"bidpage: 분야 {len(rows)}, 낙찰 정보 {len(big)}, 최근 경쟁입찰 {len(recent)}")


if __name__ == "__main__":
    main()
