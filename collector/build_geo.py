"""지도 바탕(assets/geo.json)을 한 번 만드는 스크립트. 매시간 돌릴 필요 없음.

원본: southkorea/southkorea-maps (통계청 2013 경계, 단순화본). 시·도 경계선과 시·군·구 중심점만 SVG 좌표로 바꿔 저장한다.
python3 collector/build_geo.py k_provinces.json k_municipalities.json
"""
import json, math, os, sys

W = 600
LON0, LON1, LAT0, LAT1 = 124.5, 131.0, 33.0, 38.7
K = math.cos(math.radians(36))
SX = W / ((LON1 - LON0) * K)
H = round((LAT1 - LAT0) * SX)
PROV = {"11": "서울", "21": "부산", "22": "대구", "23": "인천", "24": "광주", "25": "대전", "26": "울산", "29": "세종", "31": "경기",
        "32": "강원", "33": "충북", "34": "충남", "35": "전북", "36": "전남", "37": "경북", "38": "경남", "39": "제주"}


def xy(p):
    return ((p[0] - LON0) * K * SX, (LAT1 - p[1]) * SX)


def rings(g):
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    return [[xy(p) for p in poly[0]] for poly in polys]


def path(rs):
    out = []
    for r in rs:
        pts, last = [], None
        for x, y in r:
            if last and abs(x - last[0]) + abs(y - last[1]) < 1.2:
                continue
            pts.append((x, y)); last = (x, y)
        if len(pts) < 4:
            continue
        out.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
    return "".join(out)


def centroid(rs):
    best = None
    for r in rs:
        a = cx = cy = 0
        for (x0, y0), (x1, y1) in zip(r, r[1:] + r[:1]):
            c = x0 * y1 - x1 * y0; a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
        if a and (best is None or abs(a) > abs(best[0])):
            best = (a, cx / (3 * a), cy / (3 * a))
    return [round(best[1], 1), round(best[2], 1)]


def main(pf, mf):
    prov = json.load(open(pf))["features"]
    mun = json.load(open(mf))["features"]
    out = {"w": W, "h": H, "source": "southkorea/southkorea-maps (통계청 2013 경계)", "provinces": [], "points": {}}
    for f in prov:
        rs = rings(f["geometry"]); code = f["properties"]["code"]
        out["provinces"].append({"n": PROV[code], "d": path(rs)})
        out["points"][PROV[code]] = centroid(rs)
    for f in mun:
        code, name = f["properties"]["code"], f["properties"]["name"]
        out["points"][PROV[code[:2]] + " " + name] = centroid(rings(f["geometry"]))
    dst = os.path.join(os.path.dirname(__file__), "..", "assets", "geo.json")
    json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
    print(dst, os.path.getsize(dst))


if __name__ == "__main__":
    main(*sys.argv[1:3])
