"""오늘의 한 문제 고정: assets/daily.js 와 똑같은 규칙으로 날짜별 두 도시와 30일 합계를 data/daily_q.json 에 박아 둔다.
과거 자료가 나중에 채워져도 예전 날짜 문제의 숫자가 바뀌지 않도록, 이미 있는 날짜는 절대 덮어쓰지 않는다(없을 때만 추가).
형식: {"YYYY-MM-DD": {"a": slug, "b": slug, "av": 원, "bv": 원, "from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}}"""
import json, os, sys
from datetime import datetime, timedelta, timezone

M32 = 0xFFFFFFFF


def i32(x):
    x &= M32
    return x - (1 << 32) if x & 0x80000000 else x


def imul(a, b):
    return i32((a & M32) * (b & M32))


def rnd(seed):
    """daily.js rnd() 그대로(FNV-1a 해시 + mulberry32). JS 의 h 는 += 로 커지는 실수라 그대로 정수로 둔다."""
    h = 2166136261
    for ch in seed:
        h = i32(h) ^ ord(ch)
        h = imul(h, 16777619)
    st = [h]

    def nxt():
        st[0] += 0x6D2B79F5
        t = st[0]
        t = imul(i32(t) ^ ((t & M32) >> 15), i32(t) | 1)
        t = i32(t) ^ i32(t + imul(t ^ ((t & M32) >> 7), t | 61))
        return ((t ^ ((t & M32) >> 14)) & M32) / 4294967296
    return nxt


def add(s, k):
    return (datetime.strptime(s, "%Y-%m-%d") + timedelta(days=k)).strftime("%Y-%m-%d")


def kst_today():
    return (datetime.now(timezone.utc) + timedelta(hours=9)).strftime("%Y-%m-%d")


def build(D, dl, ix, today=None):
    # 기간 끝 = 문제 날짜 전날. 단 아직 끝나지 않은 날(오늘 이후)은 쓰지 않는다 → 고정 시점 기준 완전히 끝난 30일.
    to = min(add(D, -1), add(today or kst_today(), -1))
    if to > dl["last"]:
        to = dl["last"]
    frm = add(to, -29)
    if frm < (dl.get("cover_from") or dl["first"]):
        return None
    nm = {c["slug"]: c["name"] for c in ix.get("cities", [])}
    C = []
    for s in sorted(k for k in dl["c"] if k in nm):
        t = sum(v[1] for k, v in dl["c"][s].items() if frm <= k <= to)
        if t >= 1e8:
            C.append((s, t))
    if len(C) < 2:
        return None
    r = rnd("mt-daily|" + D)
    for _ in range(500):
        a = C[int(r() * len(C))]; b = C[int(r() * len(C))]
        if a is b:
            continue
        q = max(a[1], b[1]) / min(a[1], b[1])
        if 1.2 <= q <= 4:
            return {"a": a[0], "b": b[0], "av": a[1], "bv": b[1], "from": frm, "to": to}
    return None


REVISE_ONCE = {"2026-10-25": "2026-10-24"}  # 끝날짜가 아직 안 끝난 날(10/24)로 고정됐던 항목: 완전히 끝난 기간으로 한 번만 다시 계산(게이트도 이것만 허용)


def main(data="data", days=None):
    dl = json.load(open(os.path.join(data, "daily.json"), encoding="utf-8"))
    ix = json.load(open(os.path.join(data, "index.json"), encoding="utf-8"))
    p = os.path.join(data, "daily_q.json")
    try:
        q = json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        q = {}
    if days is None:
        today = kst_today()
        days = [today, add(today, 1)]
    mp = os.path.join(data, "daily_q_meta.json")  # 항목별 고정한 날(KST)·메모. daily_q.json 형식은 그대로 두고 따로 둔다(이것도 append-only)
    try:
        meta = json.load(open(mp, encoding="utf-8"))
    except (OSError, ValueError):
        meta = {}
    fixed_on = kst_today() if days is None else None
    added = []
    for D, bad_to in REVISE_ONCE.items():
        if D in q and q[D]["to"] == bad_to:
            x = build(D, dl, ix)
            if x and x["to"] < bad_to:
                q[D] = x; added.append(D + "(재계산)")
                if fixed_on: meta[D] = {"fixed": fixed_on, "note": "끝날짜가 아직 안 끝난 날로 고정됐던 것을 한 번 재계산(두 도시 같음)"}
    for D in days:
        if D in q:
            continue  # 이미 있는 날짜는 절대 덮어쓰지 않음
        x = build(D, dl, ix)
        if x:
            q[D] = x; added.append(D)
            if fixed_on and D not in meta: meta[D] = {"fixed": fixed_on}
    json.dump(dict(sorted(q.items())), open(p + ".tmp", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    os.replace(p + ".tmp", p)
    with open(mp + ".tmp", "w", encoding="utf-8") as f:
        json.dump(dict(sorted(meta.items())), f, ensure_ascii=False, indent=0)
    os.replace(mp + ".tmp", mp)
    print("daily_q 추가", added or "없음")
    return q


if __name__ == "__main__":
    main(days=sys.argv[1:] or None)
