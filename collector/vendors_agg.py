"""업체별 모아 보기(data/vendor/<id>.json)와 전국 업체 순위(data/rank.json).

모은 기간 안의 85개 시 계약만 센다(전체 역사가 아님). id 는 사업자번호를 해시한 값(원래 번호는 저장하지 않음).
업체 이름은 collect.py 에서 이미 가려진 값(사람 이름처럼 보이면 '개인사업자')을 쓴다. 소재지는 시·군·구까지만.
"""
import hashlib, json, os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "data")


def vid(r):
    return r.get("bh") or "n" + hashlib.sha256((r.get("vendor") or "").encode()).hexdigest()[:15]


def save(path, obj):
    try:  # 내용이 같으면 다시 쓰지 않음(매시간 커밋이 커지지 않게)
        if json.load(open(path, encoding="utf-8")) == obj:
            return
    except (OSError, ValueError):
        pass
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def build(now=None):
    now = now or datetime.now(timezone(timedelta(hours=9)))
    idx = json.load(open(os.path.join(DATA, "index.json")))
    V = {}
    dates = []
    for c in idx["cities"]:
        try:
            d = json.load(open(os.path.join(DATA, "city", c["slug"] + ".json")))
        except (OSError, ValueError):
            continue
        byid = {}
        for r in d["rows"]:
            if not r.get("vendor"):
                continue
            k = vid(r); byid[r["id"]] = k
            v = V.setdefault(k, {"id": k, "name": r["vendor"], "region": r.get("vregion"), "total": 0, "count": 0, "cities": defaultdict(lambda: [0, 0]),
                                 "insts": defaultdict(lambda: [0, 0]), "months": defaultdict(int), "cats": defaultdict(lambda: [0, 0]), "alerts": [], "rows": []})
            v["region"] = v["region"] or r.get("vregion")
            v["total"] += r["amount"]; v["count"] += 1
            cc = v["cities"][(c["slug"], c["short"])]; cc[0] += r["amount"]; cc[1] += 1
            ii = v["insts"][r["inst"]]; ii[0] += r["amount"]; ii[1] += 1
            v["months"][r["date"][:7]] += r["amount"]
            ca = v["cats"][r.get("cat") or "기타"]; ca[0] += r["amount"]; ca[1] += 1
            v["rows"].append({"id": r["id"], "date": r["date"], "title": r["title"], "amount": r["amount"], "inst": r["inst"], "city": c["short"],
                              "slug": c["slug"], "cat": r.get("cat") or "기타", "method": r.get("method"), "url": r.get("url"),
                              **{f: r[f] for f in ("no", "ord", "this", "jv", "hist", "vers", "orig", "lt", "jvm") if r.get(f) not in (None, [])}})
            dates.append(r["date"])
        for a in d.get("alerts", []):
            for k in {byid[i] for i in a.get("ids", []) if i in byid}:
                V[k]["alerts"].append({"key": a["key"], "kind": a["kind"], "title": a["title"], "detail": a["detail"], "amount": a.get("amount"),
                                       "slug": c["slug"], "city": c["short"], "explanation": a.get("explanation")})
    try:
        CORP = json.load(open(os.path.join(DATA, "corp.json"), encoding="utf-8"))
    except (OSError, ValueError):
        CORP = {}
    period = {"first": min(dates) if dates else None, "last": max(dates) if dates else None, "cities": len(idx["cities"])}
    vdir = os.path.join(DATA, "vendor"); os.makedirs(vdir, exist_ok=True)
    keep = set()
    rank = []
    for k, v in V.items():
        prof = {"id": k, "name": v["name"], "region": v["region"], "total": v["total"], "count": v["count"], "period": period,
                "cities": [{"slug": s, "name": n, "amount": a, "count": c} for (s, n), (a, c) in sorted(v["cities"].items(), key=lambda x: -x[1][0])],
                "insts": [{"name": n, "amount": a, "count": c} for n, (a, c) in sorted(v["insts"].items(), key=lambda x: -x[1][0])],
                "months": dict(sorted(v["months"].items())),
                "cats": [{"cat": n, "amount": a, "count": c} for n, (a, c) in sorted(v["cats"].items(), key=lambda x: -x[1][0])],
                "alerts": v["alerts"], "corp": CORP.get(k), "rows": sorted(v["rows"], key=lambda r: (r["date"], r["id"]), reverse=True)}
        save(os.path.join(vdir, k + ".json"), prof); keep.add(k + ".json")
        rank.append({"id": k, "name": v["name"], "region": v["region"], "total": v["total"], "count": v["count"], "nc": len(v["cities"]), "ni": len(v["insts"])})
    for f in os.listdir(vdir):
        if f.endswith(".json") and f not in keep:
            os.remove(os.path.join(vdir, f))
    rank.sort(key=lambda x: -x["total"])
    save(os.path.join(DATA, "rank.json"), {"updated": now.isoformat(), "period": period, "source": "조달청 나라장터 공개 계약정보", "total_vendors": len(rank), "vendors": rank[:2000]})
    return len(rank)


if __name__ == "__main__":
    print(build(), "개 업체")
