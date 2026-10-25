"""미국 의회 의원(상원 100 · 하원 435 + 대표): data/us/members.json

출처: @unitedstates/congress-legislators (의회 공식 자료를 모아 공개하는 공공 데이터, CC0)
  - 의원 명단·당·주·선거구·생일·첫 임기, 지역 사무소 좌표(지도 위치), 소속 위원회
  - 사진: @unitedstates/images (의회 공식 사진, 퍼블릭 도메인)
로컬에서 돌릴 땐 US_LEGIS_DIR 에 저장소 경로를 주면 파일에서 읽는다.
"""
import json
import os
import urllib.request

import yaml

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "us", "members.json")
BASE = "https://unitedstates.github.io/congress-legislators/"
PIC = "https://unitedstates.github.io/images/congress/225x275/{}.jpg"
PARTY = {"Democrat": "D", "Republican": "R", "Independent": "I"}
# 주 중심(사무소 좌표가 없을 때)
STATE_LL = {"AL": [32.8, -86.8], "AK": [61.4, -152.3], "AZ": [34.2, -111.6], "AR": [34.9, -92.4], "CA": [37.2, -119.5], "CO": [39.0, -105.5], "CT": [41.6, -72.7], "DE": [39.0, -75.5], "FL": [28.6, -82.4], "GA": [32.7, -83.4], "HI": [20.8, -156.3], "ID": [44.4, -114.6], "IL": [40.0, -89.2], "IN": [39.9, -86.3], "IA": [42.1, -93.5], "KS": [38.5, -98.4], "KY": [37.5, -85.3], "LA": [31.1, -92.0], "ME": [45.4, -69.2], "MD": [39.0, -76.8], "MA": [42.3, -71.8], "MI": [44.3, -85.4], "MN": [46.3, -94.3], "MS": [32.7, -89.7], "MO": [38.4, -92.5], "MT": [47.0, -109.6], "NE": [41.5, -99.8], "NV": [39.3, -116.6], "NH": [43.7, -71.6], "NJ": [40.2, -74.7], "NM": [34.4, -106.1], "NY": [42.9, -75.5], "NC": [35.6, -79.4], "ND": [47.5, -100.5], "OH": [40.3, -82.8], "OK": [35.6, -97.5], "OR": [43.9, -120.6], "PA": [40.9, -77.8], "RI": [41.7, -71.5], "SC": [33.9, -80.9], "SD": [44.4, -100.2], "TN": [35.9, -86.4], "TX": [31.5, -99.3], "UT": [39.3, -111.7], "VT": [44.1, -72.7], "VA": [37.5, -78.9], "WA": [47.4, -120.5], "WV": [38.6, -80.6], "WI": [44.6, -89.9], "WY": [43.0, -107.6], "DC": [38.9, -77.0], "PR": [18.2, -66.5], "GU": [13.4, 144.8], "VI": [18.3, -64.9], "AS": [-14.3, -170.7], "MP": [15.1, 145.7]}


def load(name):
    d = os.environ.get("US_LEGIS_DIR")
    if d:
        return yaml.safe_load(open(os.path.join(d, name), encoding="utf-8"))
    req = urllib.request.Request(BASE + name, headers={"User-Agent": "money-tracker"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return yaml.safe_load(r.read().decode("utf-8"))


def main():
    leg = load("legislators-current.yaml")
    offs = {o["id"]["bioguide"]: o.get("offices") or [] for o in load("legislators-district-offices.yaml")}
    cm = load("committee-membership-current.yaml")
    cn = {c["thomas_id"]: c["name"] for c in load("committees-current.yaml")}
    cmits = {}
    for code, ms in cm.items():
        if code not in cn:  # 소위원회는 빼고 상임위만
            continue
        for x in ms:
            cmits.setdefault(x.get("bioguide"), []).append(cn[code].replace("House Committee on ", "").replace("Senate Committee on ", "").replace("Committee on ", "") + (" (" + x["title"] + ")" if x.get("title") else ""))
    out = []
    for p in leg:
        t = p["terms"][-1]
        bid = p["id"]["bioguide"]
        ll = next(([o["latitude"], o["longitude"]] for o in offs.get(bid, []) if o.get("latitude")), None)
        out.append({
            "id": bid, "name": p["name"].get("official_full") or f'{p["name"]["first"]} {p["name"]["last"]}',
            "party": PARTY.get(t.get("party"), "I"), "chamber": t["type"], "state": t["state"],
            "district": t.get("district"), "since": p["terms"][0]["start"][:4], "terms": len(p["terms"]),
            "birth": (p.get("bio") or {}).get("birthday", "")[:4] or None,
            "pic": PIC.format(bid), "url": t.get("url"), "ll": ll or STATE_LL.get(t["state"]), "ll_office": bool(ll),
            "cmits": cmits.get(bid, [])[:6], "lis": p["id"].get("lis"),
        })
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"source": "@unitedstates/congress-legislators (CC0) · 사진 @unitedstates/images", "members": out},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"us members: {len(out)} (상원 {sum(m['chamber'] == 'sen' for m in out)}, 하원 {sum(m['chamber'] == 'rep' for m in out)}), 사무소 좌표 {sum(m['ll_office'] for m in out)}")


if __name__ == "__main__":
    main()
