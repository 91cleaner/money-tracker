"""돈의 흐름 집계: 시(돈을 낸 곳) → 업체 소재지(시·군·구, 사업자 등록 주소 기준). data/flows.json 을 만든다.

같은 계약·원계약일 기준으로 시·날짜·소재지별 금액은 data/flow_daily.json 에 둔다.
기간 슬라이더(assets/period.js fixFlows)가 그 파일로 local·known·flows 를 다시 더한다.

collect.py 가 매시간 끝에 부른다. 혼자 돌려도 된다: python3 collector/flows.py
사람이 아니라 업체 주소의 시·군·구까지만 다루고, 지역에 다른 꼬리표는 붙이지 않는다.
"""
import json, os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vendors_agg
import jv
from cities import legacy
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
    vregion = legacy(vregion)
    key = city["name"].replace("특별시", "").replace("광역시", "").replace("특별자치시", "")
    metro = city["province"] == city["name"]
    return city["name"] in vregion or (metro and vregion.startswith(key))


def parts(r):
    """계약 금액을 지역별로 나눔(공동도급은 지분대로, 소재지를 모르는 업체 몫은 '확인 중')."""
    return [(vr, amt, k, nm) for vr, amt, k, nm, _ in jv.alloc(r)]


def build(now=None):
    now = now or datetime.now(timezone(timedelta(hours=9)))
    loc = Locator()
    idx = json.load(open(os.path.join(DATA, "index.json")))
    out = {"updated": now.isoformat(), "days": idx.get("days"), "basis": "업체 사업자 등록 주소의 시·군·구 (조달청 나라장터). 공동도급은 지분이 확인된 계약만 지분대로, 나머지는 대표 업체 기준",
           "cities": {}, "nation": []}
    pairs = defaultdict(lambda: [0, 0])
    pts = {}
    natc = defaultdict(lambda: defaultdict(int))
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
        ven = defaultdict(lambda: defaultdict(lambda: [0, 0, ""]))  # 지역별 업체
        total = unknown = local = 0
        for r in d["rows"]:
            total += r["amount"]
            for vr, amt, k, nm in parts(r):
                if not vr:
                    unknown += amt; continue
                a = agg[vr]; a[0] += amt; a[1] += 1
                a[2] = is_local(city, vr)
                vv = ven[vr][k]; vv[0] += amt; vv[1] += 1; vv[2] = nm
                if a[2]:
                    local += amt
        flows = []
        for reg, (amt, n, lo) in sorted(agg.items(), key=lambda x: -x[1][0]):
            label, pt = loc(reg)
            if not pt:
                continue
            pts[label] = pt
            flows.append({"to": label, "p": pt, "amount": amt, "count": n, "local": lo,
                          "vendors": [{"id": k, "name": nm, "amount": va, "count": vc} for k, (va, vc, nm) in sorted(ven[reg].items(), key=lambda x: -x[1][0])[:20]]})
            if not lo:
                pr = pairs[(c["slug"], label)]; pr[0] += amt; pr[1] += n
        known = total - unknown
        # 분야별 흐름(지도에서 분야를 고를 때)
        bc = {}
        for r in d["rows"]:
            ct = r.get("cat") or "기타"
            b = bc.setdefault(ct, {"total": 0, "known": 0, "local": 0, "count": 0, "f": defaultdict(lambda: [0, 0])})
            b["total"] += r["amount"]; b["count"] += 1
            for vr, amt, _, _ in parts(r):
                if vr:
                    b["known"] += amt; ff = b["f"][vr]; ff[0] += amt; ff[1] += 1
                    if is_local(city, vr):
                        b["local"] += amt
        by_cat = {}
        for ct, b in bc.items():
            fl_ = []
            for reg, (amt, n) in sorted(b["f"].items(), key=lambda x: -x[1][0])[:8]:
                label, pt = loc(reg)
                if pt:
                    fl_.append({"to": label, "p": pt, "amount": amt, "count": n, "local": is_local(city, reg)})
                    if not is_local(city, reg):
                        natc[ct][(c["slug"], label)] += amt; pts[label] = pt
            by_cat[ct] = {"total": b["total"], "known": b["known"], "local": b["local"], "count": b["count"], "flows": fl_}
        rest = flows[TOP_CITY:]
        out["cities"][c["slug"]] = {"name": city["short"], "p": here, "total": total, "known": known, "local": local,
                                    "count": len(d["rows"]), "flows": flows[:TOP_CITY],
                                    "other": {"n": len(rest), "amount": sum(f["amount"] for f in rest)}, "by_cat": by_cat}
    for (slug, label), (amt, n) in sorted(pairs.items(), key=lambda x: -x[1][0])[:TOP_NATION]:
        out["nation"].append({"from": slug, "to": label, "p": pts[label],
                              "amount": amt, "count": n})
    out["nation_cat"] = {ct: [{"from": s_, "to": lb, "p": pts[lb], "amount": a} for (s_, lb), a in sorted(m.items(), key=lambda x: -x[1])[:25]]
                         for ct, m in natc.items()}
    with open(os.path.join(DATA, "flows.json"), "w", encoding="utf-8") as f:
        try:
            from privacy import korify
            json.dump(korify(out), f, ensure_ascii=False, separators=(",", ":"))
        except ImportError:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    write_daily(now)
    return out


def daily_doc(now=None):
    """시·원계약일·업체 소재지별 [금액, 건수]. flows.json 과 같은 parts·is_local·날짜(odate||date).

    형식: regions·p(좌표)는 소재지 이름 사전. 시마다 L(우리 시 소재지 번호),
    d[날짜] = [local, known, [[소재지번호, 금액, 건수], ...]].
    좌표 없는 소재지는 빼지 않고 오류로 남긴다(known 과 흐름 합이 어긋나지 않게).
    """
    now = now or datetime.now(timezone(timedelta(hours=9)))
    stamp = now if isinstance(now, str) else now.isoformat()
    loc = Locator()
    idx = json.load(open(os.path.join(DATA, "index.json"), encoding="utf-8"))
    reg_pts = {}
    raw = {}
    for c in idx["cities"]:
        try:
            d = json.load(open(os.path.join(DATA, "city", c["slug"] + ".json"), encoding="utf-8"))
        except (OSError, ValueError):
            continue
        city = d["city"]
        days = defaultdict(lambda: [0, 0, defaultdict(lambda: [0, 0])])
        local_labs = set()
        for r in d.get("rows") or []:
            day = days[r.get("odate") or r["date"]]
            for vr, amt, _, _ in parts(r):
                if not vr:
                    continue
                lo = is_local(city, vr)
                if lo:
                    day[0] += amt
                day[1] += amt
                label, pt = loc(vr)
                if not label or not pt:
                    raise RuntimeError(f"{c['slug']} 소재지 좌표 없음: {vr}")
                if label in reg_pts and reg_pts[label] != pt:
                    raise RuntimeError(f"소재지 좌표가 둘임: {label}")
                reg_pts[label] = pt
                slot = day[2][label]
                slot[0] += amt
                slot[1] += 1
                if lo:
                    local_labs.add(label)
        for dayk, (lo, kn, dest) in days.items():
            if sum(a for a, _ in dest.values()) != kn or sum(a for lab, (a, _) in dest.items() if lab in local_labs) != lo:
                raise RuntimeError(f"{c['slug']} {dayk} 일별 흐름 합이 local/known 과 다름")
        raw[c["slug"]] = (days, local_labs)
    regions = sorted(reg_pts)
    rid = {name: i for i, name in enumerate(regions)}
    cities = {}
    for slug, (days, local_labs) in raw.items():
        d_out = {}
        for dayk in sorted(days):
            lo, kn, dest = days[dayk]
            if not lo and not kn and not dest:
                continue
            arr = [[rid[lab], amt, cnt] for lab, (amt, cnt) in sorted(dest.items(), key=lambda x: (-x[1][0], x[0])) if amt or cnt]
            d_out[dayk] = [lo, kn, arr]
        cities[slug] = {"L": [rid[lab] for lab in sorted(local_labs)], "d": d_out}
    return {"updated": stamp, "basis": "odate", "regions": regions, "p": [reg_pts[n] for n in regions], "c": cities}


def write_daily(now=None):
    doc = daily_doc(now)
    with open(os.path.join(DATA, "flow_daily.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    return doc


def _shift(day, k):
    d = datetime.strptime(day, "%Y-%m-%d") + timedelta(days=k)
    return d.strftime("%Y-%m-%d")


def window_of(dl, days):
    """period.js 와 같은 최근 N일(0 이면 전체). 끝날은 daily.json last."""
    last = dl["last"]
    lo = dl.get("cover_from") or dl["first"]
    if not days:
        return lo, last
    fr = _shift(last, 1 - days)
    return (lo if fr < lo else fr), last


def sum_flow_window(fd, slug, fr, to):
    """(local, known, {소재지: [금액, 건수]}). 날짜는 양 끝 포함."""
    city = (fd.get("c") or {}).get(slug) or {}
    regions = fd.get("regions") or []
    local = known = 0
    dest = {}
    for day, v in (city.get("d") or {}).items():
        if day < fr or day > to:
            continue
        local += v[0]
        known += v[1]
        for ri, amt, cnt in v[2]:
            lab = regions[ri]
            g = dest.setdefault(lab, [0, 0])
            g[0] += amt
            g[1] += cnt
    return local, known, dest


def period_errors(root):
    """전체 기간 흐름은 flows.json 과 같고, 어느 기간이든 local ≤ known ≤ total(daily.json)."""
    err = []
    E = err.append
    fp, flp, dp = (os.path.join(root, n) for n in ("flow_daily.json", "flows.json", "daily.json"))
    if not (os.path.exists(fp) and os.path.exists(flp) and os.path.exists(dp)):
        E("[27 기간 흐름] flow_daily.json·flows.json·daily.json 이 함께 있어야 함")
        return err
    fd, fl, dl = (json.load(open(p, encoding="utf-8")) for p in (fp, flp, dp))
    if fd.get("basis") != "odate":
        E("[27 기간 흐름] flow_daily basis 가 odate 가 아님")
    regions = fd.get("regions") or []
    if len(fd.get("p") or []) != len(regions):
        E("[27 기간 흐름] 좌표 수와 소재지 이름이 다름")
    stops = (7, 14, 30, 60, 90, 0)
    for slug, fc in (fl.get("cities") or {}).items():
        src = (fd.get("c") or {}).get(slug)
        if not src:
            E(f"[27 기간 흐름] {slug} 일별 흐름 없음")
            continue
        local_labs = {regions[i] for i in src.get("L") or []}
        fr, to = dl["first"], dl["last"]
        lo, kn, dest = sum_flow_window(fd, slug, fr, to)
        if lo != fc.get("local") or kn != fc.get("known"):
            E(f"[27 기간 흐름] {slug} 전체 기간 local/known {lo}/{kn} ≠ flows.json {fc.get('local')}/{fc.get('known')}")
        if sum(a for a, _ in dest.values()) != kn:
            E(f"[27 기간 흐름] {slug} 전체 기간 흐름 합 ≠ known")
        if sum(a for lab, (a, _) in dest.items() if lab in local_labs) != lo:
            E(f"[27 기간 흐름] {slug} 전체 기간 우리 시 흐름 합 ≠ local")
        got = {}
        for f in fc.get("flows") or []:
            g = got.setdefault(f["to"], [0, 0])
            g[0] += f["amount"]
            g[1] += f.get("count") or 0
        for lab, (amt, cnt) in got.items():
            if dest.get(lab, [0, 0]) != [amt, cnt]:
                E(f"[27 기간 흐름] {slug} {lab} 전체 기간 금액/건수 {dest.get(lab)} ≠ flows.json {[amt, cnt]}")
                break
        daily_total = sum(v[1] for v in (dl.get("c") or {}).get(slug, {}).values())
        if kn > daily_total or lo > kn:
            E(f"[27 기간 흐름] {slug} 전체 기간 local {lo} known {kn} total {daily_total}")
        for n in stops:
            a, b = window_of(dl, n)
            wlo, wkn, _wdest = sum_flow_window(fd, slug, a, b)
            wt = sum(v[1] for day, v in (dl.get("c") or {}).get(slug, {}).items() if a <= day <= b)
            if not (wlo <= wkn <= wt):
                E(f"[27 기간 흐름] {slug} 최근 {n or '전체'}일 local {wlo} > known {wkn} > total {wt}")
                break
    return err


if __name__ == "__main__":
    if "--daily" in sys.argv:
        stamp = json.load(open(os.path.join(DATA, "daily.json"), encoding="utf-8")).get("updated")
        d = write_daily(stamp)
        print("flow_daily", len(d["c"]), "개 시,", len(d["regions"]), "개 소재지")
    else:
        o = build()
        print(len(o["cities"]), "개 시,", len(o["nation"]), "개 큰 흐름")
