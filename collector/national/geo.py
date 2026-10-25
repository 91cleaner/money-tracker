"""의원 지역구 → 지도 위치(위도·경도): data/national/geo.json

지역구 이름(예: '대구 동구군위군을', '경기 안양시만안구')을 시·군·구로 쪼개 data/flow_daily.json 의 지역 좌표와 맞춘다.
여러 시·군이 묶인 지역구는 첫 번째 시·군 자리에 둔다. 못 맞추면 시·도 가운데. 비례대표는 화면에서 국회 둘레에 둔다.
"""
import json
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
GK = __import__("math").cos(36 * __import__("math").pi / 180)
GSX = 600 / (6.5 * GK)
FULL = {"서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천", "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산",
        "세종특별자치시": "세종", "경기도": "경기", "강원특별자치도": "강원", "충청북도": "충북", "충청남도": "충남", "전북특별자치도": "전북", "전라남도": "전남",
        "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주"}


ALIAS = {"전남광주통합특별시": ["전남", "광주"], "세종": ["세종"]}


def ll(p):
    return [round(38.7 - p[1] / GSX, 4), round(124.5 + p[0] / (GK * GSX), 4)]


def main():
    fd = json.load(open(os.path.join(ROOT, "data", "flow_daily.json"), encoding="utf-8"))
    reg = {r: ll(p) for r, p in zip(fd["regions"], fd["p"]) if p}
    sido = {}
    for r, v in reg.items():
        s = r.split()[0]
        sido.setdefault(s, []).append(v)
    cen = {s: [round(sum(x[0] for x in v) / len(v), 4), round(sum(x[1] for x in v) / len(v), 4)] for s, v in sido.items()}
    mem = json.load(open(os.path.join(ROOT, "data", "national", "members.json"), encoding="utf-8"))["members"]
    out, miss = {}, []
    for m in mem:
        if m.get("elect") != "지역구":
            continue
        d = (m.get("district") or "").strip()
        parts = d.split(maxsplit=1)
        s0 = parts[0] if parts else ""
        rest = parts[1] if len(parts) > 1 else ""
        if not rest and d.startswith("세종"):
            s0, rest = "세종", ""
        ss = ALIAS.get(s0) or [FULL.get(s0, s0)]
        rest = re.sub(r"[갑을병정무]$", "", rest)
        units = re.findall(r"[가-힣]+?(?:시|군|구)", rest)
        pos = None
        cands = []
        for s in ss:
            if len(units) >= 2:
                cands.append(f"{s} {units[0]} {units[1]}")
            cands += [f"{s} {u}" for u in units]
            if not units:
                cands.append(s)
        s = ss[0]
        for c in cands:
            if c in reg:
                pos = reg[c]
                break
            hit = next((r for r in reg if r.startswith(c + " ") or r == c), None)
            if hit:
                pos = reg[hit]
                break
        if not pos:
            pos = next((cen[x] for x in ss if x in cen), None)
            miss.append(d)
        if pos:
            out[m["id"]] = pos
    json.dump({"note": "지역구 대략 위치(첫 번째 시·군·구 자리). 출처: 의원 명단 지역구 이름 + 우리 동네 세금 지도의 지역 좌표.", "pos": out},
              open(os.path.join(ROOT, "data", "national", "geo.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"geo: {len(out)}명 위치, 시·도 가운데로 대신한 곳 {len(miss)}곳", miss[:10])


if __name__ == "__main__":
    main()
