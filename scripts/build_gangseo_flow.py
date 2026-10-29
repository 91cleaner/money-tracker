#!/usr/bin/env python3
"""강서구 통합신청사 계약이 어느 시·군·구로 갔는지 지도용 자료.

data/past 에서 발주기관이 서울특별시 강서구이고 제목에 '신청사'가 있는 계약과
data/search/se/ct-2026-07..10 의 같은 조건 계약을 합친다.
같은 계약번호는 가장 높은 차수 하나만 쓰고, 과거 자료에 총액이 있으면 그 총액을 쓴다.
공동도급은 지분이 모두 있고 합이 99~101%일 때만 지분대로 나눈다.
도착지는 업체 이름이 아니라 소재 시·군·구 중심점(assets/geo.json)이다.
소재 시·군·구가 자료에 없으면 선을 만들지 않고 unmapped 에만 금액을 둔다.
"""
from __future__ import annotations

import glob
import json
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "collector"))
from flows import Locator  # noqa: E402

INST = "서울특별시 강서구"
NEEDLE = "신청사"
MONTHS = ("2026-07", "2026-08", "2026-09", "2026-10")
ORIGIN = {"name": "강서구청", "lat": 37.5509, "lng": 126.8495}
OUT = os.path.join(ROOT, "data", "focus", "gangseo-sincheongsa.json")

GK = math.cos(math.radians(36))
GSX = 600 / (6.5 * GK)


def to_ll(p):
    return [round(38.7 - p[1] / GSX, 5), round(124.5 + p[0] / (GK * GSX), 5)]


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def amount_of(rec):
    if rec["src"] == "past":
        return int(rec["tot"] or 0) or int(rec["this"] or 0)
    return int(rec["amount"] or 0)


def better(a, b):
    """같은 계약번호면 더 나중 차수, 같으면 과거 자료(총액)를 남긴다."""
    if (a.get("ord") or "") != (b.get("ord") or ""):
        return a if (a.get("ord") or "") > (b.get("ord") or "") else b
    if a["src"] != b["src"]:
        return a if a["src"] == "past" else b
    return a if amount_of(a) >= amount_of(b) else b


def shares_ok(members):
    shares = [m.get("share") for m in members]
    if len(members) < 2 or any(not s for s in shares):
        return False
    return 99 <= sum(shares) <= 101


def split(rec):
    """[(id, name, amount)] 업체 이름은 지역을 찾을 때만 쓰고 결과에는 넣지 않는다."""
    amt = amount_of(rec)
    members = rec["members"]
    if rec["src"] == "search" and members and members[0].get("part") is not None:
        return [(m.get("id"), m.get("name"), int(m["part"]), m.get("region")) for m in members]
    if shares_ok(members):
        total_share = sum(m["share"] for m in members)
        parts = []
        for m in members:
            parts.append([m.get("id"), m.get("name"), int(round(amt * m["share"] / total_share)), None])
        parts[0][2] += amt - sum(p[2] for p in parts)
        return [tuple(p) for p in parts]
    if not members:
        return [(None, None, amt, None)]
    lead = next((m for m in members if m.get("role") == "주계약업체"), members[0])
    return [(lead.get("id"), lead.get("name"), amt, lead.get("region"))]


class Regions:
    def __init__(self):
        self.by_id = load(os.path.join(ROOT, "data", "vendors.json"))
        sv = load(os.path.join(ROOT, "data", "search", "se", "vendors.json"))
        self.search_regions = sv["regions"]
        self.search_name = sv["name"]
        self.search_region_i = sv["region"]
        self.by_name = {}
        corp = sv.get("corp_file") or {}
        self.by_corp = {}
        for i, name in enumerate(sv["name"]):
            reg = sv["regions"][sv["region"][i]] if sv["region"][i] < len(sv["regions"]) else ""
            if name and reg and name not in self.by_name:
                self.by_name[name] = reg
            bh = corp.get(str(i))
            if bh and reg:
                self.by_corp[bh] = reg

    def of(self, cid, name, inline):
        if inline:
            return inline
        if cid and cid in self.by_id and self.by_id[cid].get("region"):
            return self.by_id[cid]["region"]
        path = os.path.join(ROOT, "data", "vendor", "%s.json" % cid) if cid else ""
        if path and os.path.exists(path):
            reg = (load(path) or {}).get("region")
            if reg:
                return reg
        if cid and cid in self.by_corp:
            return self.by_corp[cid]
        if name and name in self.by_name:
            return self.by_name[name]
        return None


def collect():
    contracts = {}
    for path in glob.glob(os.path.join(ROOT, "data", "past", "*.json")):
        if os.path.basename(path).startswith("_"):
            continue
        doc = load(path)
        if not isinstance(doc, dict):
            continue
        for row in doc.get("rows") or []:
            if not isinstance(row, dict):
                continue
            if row.get("inst") != INST or NEEDLE not in (row.get("title") or ""):
                continue
            rec = {
                "no": row.get("no"),
                "ord": row.get("ord") or "",
                "src": "past",
                "tot": row.get("tot") or 0,
                "this": row.get("this") or 0,
                "members": row.get("m") or [],
            }
            prev = contracts.get(rec["no"])
            contracts[rec["no"]] = rec if prev is None else better(prev, rec)

    core = load(os.path.join(ROOT, "data", "search", "se", "core.json"))
    inst_i = next(i for i, row in enumerate(core["insts"]) if row[0] == INST)
    sv = load(os.path.join(ROOT, "data", "search", "se", "vendors.json"))
    corp = sv.get("corp_file") or {}
    for mon in MONTHS:
        doc = load(os.path.join(ROOT, "data", "search", "se", "ct-%s.json" % mon))
        for i in range(doc["n"]):
            if doc["inst"][i] != inst_i or NEEDLE not in (doc["title"][i] or ""):
                continue
            vi = doc["vendor"][i]
            name = sv["name"][vi] if vi >= 0 else (doc["vname"][i] or "")
            reg = sv["regions"][sv["region"][vi]] if vi >= 0 else ""
            bh = corp.get(str(vi)) if vi >= 0 else None
            members = [{"name": name, "share": 100.0, "id": bh, "region": reg, "role": "주계약업체", "part": None}]
            jvs = doc["jvs"][i]
            if jvs:
                members = []
                for jvi, part in jvs:
                    members.append({
                        "name": sv["name"][jvi],
                        "id": corp.get(str(jvi)),
                        "region": sv["regions"][sv["region"][jvi]],
                        "share": None,
                        "part": int(part),
                    })
            rec = {
                "no": doc["no"][i],
                "ord": doc["ord"][i] or "",
                "src": "search",
                "amount": doc["amount"][i],
                "members": members,
            }
            prev = contracts.get(rec["no"])
            contracts[rec["no"]] = rec if prev is None else better(prev, rec)
    return contracts


def build():
    regions = Regions()
    loc = Locator()
    flows = {}
    unmapped = 0
    total = 0
    contracts = collect()
    kept = 0
    for rec in contracts.values():
        amt = amount_of(rec)
        if amt <= 0:
            continue
        kept += 1
        total += amt
        for cid, name, part, inline in split(rec):
            if part <= 0:
                continue
            reg = regions.of(cid, name, inline)
            if not reg:
                unmapped += part
                continue
            label, pt = loc(reg)
            if not pt:
                unmapped += part
                continue
            lat, lng = to_ll(pt)
            slot = flows.setdefault(label, {"region": label, "lat": lat, "lng": lng, "amount": 0})
            slot["amount"] += part
    rows = [f for f in flows.values() if f["amount"] > 0]
    rows.sort(key=lambda f: (-f["amount"], f["region"]))
    mapped = sum(f["amount"] for f in rows)
    return {
        "title": "강서구 통합신청사, 돈은 어디로 갔나",
        "inst": INST,
        "q": NEEDLE,
        "origin": ORIGIN,
        "total": total,
        "mapped": mapped,
        "unmapped": unmapped,
        "contracts": kept,
        "flows": rows,
    }


def main():
    doc = build()
    # collect() twice is fine; rebuild contract count from the same build pass
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(OUT, "contracts", doc["contracts"], "flows", len(doc["flows"]), "total", doc["total"], "unmapped", doc["unmapped"])


if __name__ == "__main__":
    main()
