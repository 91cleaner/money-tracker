"""오늘의 영수증: 마지막으로 '완전히 끝난 날'에 85개 시가 맺은 계약 가운데 가장 큰 한 건.

data/today.json 에 쓴다. 날마다 한 건씩 쌓아 두어(최근 14일) 화면에서 '어제 영수증'도 볼 수 있게 한다.
이미 고정된 날짜의 영수증은 바꾸지 않는다(같은 날 다시 돌려도 같은 결과).
금액은 이번 차수 금액(amount), 변경 계약(chg)은 빼고 새 계약만 본다.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

KEEP = 14
MIN_N = 20


def kst_today():
    return (datetime.now(timezone.utc) + timedelta(hours=9)).strftime("%Y-%m-%d")


def load(p, default):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def pick_for(day, rows):
    """그날 계약 중 금액이 가장 큰 것. 같으면 번호순(늘 같은 결과)."""
    cand = [r for r in rows if r.get("date") == day and not r.get("chg") and (r.get("amount") or 0) > 0]
    if not cand:
        return None, 0, 0
    cand.sort(key=lambda r: (-(r.get("amount") or 0), r.get("id") or ""))
    return cand, len(cand), sum(r.get("amount") or 0 for r in cand)


def slim(r):
    keys = ("id", "date", "inst", "title", "amount", "vendor", "vregion", "url", "cat", "method", "ann")
    out = {k: r.get(k) for k in keys}
    out["slug"], out["cname"] = r["_slug"], r["_cname"]
    return out


def main(data="data", today=None):
    ix = load(os.path.join(data, "index.json"), {})
    rows = []
    for c in ix.get("cities", []):
        d = load(os.path.join(data, "city", c["slug"] + ".json"), None)
        if not d:
            continue
        cname = c.get("short") or c.get("name")
        for r in d.get("rows", []):
            r = dict(r)
            r["_slug"], r["_cname"] = c["slug"], cname
            rows.append(r)
    if not rows:
        print("today: 계약 없음")
        return
    t = today or kst_today()
    days = sorted({r.get("date") for r in rows if r.get("date") and r["date"] < t})
    if not days:
        print("today: 끝난 날 없음")
        return
    p = os.path.join(data, "today.json")
    cur = load(p, {"items": []})
    have = {it["date"] for it in cur.get("items", [])}
    # 최근 끝난 날부터 거꾸로, 아직 없는 날만 채운다(최대 KEEP일)
    for day in reversed(days[-KEEP:]):
        if day in have:
            continue
        cand, n, total = pick_for(day, rows)
        if not cand or n < MIN_N:  # 주말·공휴일처럼 계약이 몇 건 없는 날은 영수증을 만들지 않는다
            continue
        cur["items"].append({
            "date": day, "n": n, "sum": total,
            "pick": slim(cand[0]),
            "next": [slim(r) for r in cand[1:3]],
        })
    cur["items"] = sorted(cur["items"], key=lambda it: it["date"], reverse=True)[:KEEP]
    cur["updated"] = (datetime.now(timezone.utc) + timedelta(hours=9)).isoformat(timespec="seconds")
    cur["note"] = "그날 85개 시가 맺은 새 계약 중 금액이 가장 큰 것(이번 차수 금액 기준). 출처 조달청 나라장터."
    with open(p, "w", encoding="utf-8") as f:
        json.dump(cur, f, ensure_ascii=False, separators=(",", ":"))
    print("today:", cur["items"][0]["date"] if cur["items"] else "없음", len(cur["items"]), "일")


if __name__ == "__main__":
    main(*(sys.argv[1:2] or ["data"]))
