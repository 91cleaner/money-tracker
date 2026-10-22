"""돈의 흐름 집계: 시(돈을 낸 곳) → 업체 소재지(시·군·구, 사업자 등록 주소 기준). data/flows.json 을 만든다.

collect.py 가 매시간 끝에 부른다. 혼자 돌려도 된다: python3 collector/flows.py
사람이 아니라 업체 주소의 시·군·구까지만 다루고, 지역에 다른 꼬리표는 붙이지 않는다.
"""
import json, os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "data")
SHORT = {"서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천", "광주광역시": "광주", "대전광역시": "대전",
         "울산광역시": "울산", "세종특별자치시": "세종", "경기도": "경기", "강원도": "강원", "강원특별자치도": "강원", "충청북도": "충북",
         "충청남도": "충남", "전라북도": "전북", "전북특별자치도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남",
         "제주특별자치도": "제주"}
TOP_CITY, TOP_NATION = 12, 40


class Locator:
    def __init__(self):
        self.pts = json.load(open(os.path.join(ROOT, "assets", "geo.json")))["points"]
        self.cache = {}

    def find(self, prov, rest):
        p = self.pts
        if not rest:
            return p.get(prov)
        si = rest[0]
        for k in (f"{prov} {''.join(rest)}", f"{prov} {si}"):
            if k in p:
                return p[k]
        sub = [v for k, v in p.items() if k.startswith(f"{prov} {si}")]  # 새로 생긴 구 → 그 시의 구들 평균
        if sub:
            return [round(sum(v[0] for v in sub) / len(sub), 1), round(sum(v[1] for v in sub) / len(sub), 1)]
        same = [v for k, v in p.items() if k.split(" ", 1)[-1] == si]  # 관할이 바뀐 군(예: 군위군)
        if len(same) == 1:
            return same[0]
        return p.get(prov)

    def __call__(self, region):
        if region not in self.cache:
            t = region.split()
            prov = SHORT.get(t[0], t[0][:2])
            self.cache[region] = (" ".join([prov] + t[1:]), self.find(prov, t[1:]))
        return self.cache[region]


def is_local(city, vregion):
    key = city["name"].replace("특별시", "").replace("광역시", "").replace("특별자치시", "")
    metro = city["province"] == city["name"]
    return city["name"] in vregion or (metro and vregion.startswith(key))


def build(now=None):
    now = now or datetime.now(timezone(timedelta(hours=9)))
    loc = Locator()
    idx = json.load(open(os.path.join(DATA, "index.json")))
    out = {"updated": now.isoformat(), "days": idx.get("days"), "basis": "업체 사업자 등록 주소의 시·군·구 (조달청 나라장터)",
           "cities": {}, "nation": []}
    pairs = defaultdict(lambda: [0, 0])
    pts = {}
    for c in idx["cities"]:
        try:
            d = json.load(open(os.path.join(DATA, "city", c["slug"] + ".json")))
        except (OSError, ValueError):
            continue
        city = d["city"]
        here = loc(city["province"] + ("" if city["province"] == city["name"] else " " + city["name"]))[1]
        if not here:
            continue
        agg = defaultdict(lambda: [0, 0, False])
        total = unknown = local = 0
        for r in d["rows"]:
            total += r["amount"]
            if not r.get("vregion"):
                unknown += r["amount"]; continue
            a = agg[r["vregion"]]; a[0] += r["amount"]; a[1] += 1
            a[2] = is_local(city, r["vregion"])
            if a[2]:
                local += r["amount"]
        flows = []
        for reg, (amt, n, lo) in sorted(agg.items(), key=lambda x: -x[1][0]):
            label, pt = loc(reg)
            if not pt:
                continue
            pts[label] = pt
            flows.append({"to": label, "p": pt, "amount": amt, "count": n, "local": lo})
            if not lo:
                pr = pairs[(c["slug"], label)]; pr[0] += amt; pr[1] += n
        known = total - unknown
        rest = flows[TOP_CITY:]
        out["cities"][c["slug"]] = {"name": city["short"], "p": here, "total": total, "known": known, "local": local,
                                    "count": len(d["rows"]), "flows": flows[:TOP_CITY],
                                    "other": {"n": len(rest), "amount": sum(f["amount"] for f in rest)}}
    for (slug, label), (amt, n) in sorted(pairs.items(), key=lambda x: -x[1][0])[:TOP_NATION]:
        out["nation"].append({"from": slug, "to": label, "p": pts[label],
                              "amount": amt, "count": n})
    with open(os.path.join(DATA, "flows.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    return out


if __name__ == "__main__":
    o = build()
    print(len(o["cities"]), "개 시,", len(o["nation"]), "개 큰 흐름")
