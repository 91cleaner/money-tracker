"""지방재정365(행정안전부) OpenAPI → data/sec_fest.json, data/sec_subsidy.json.
EVFTCT 행사축제원가회계정보, GVBDAC 청사신축원가회계정보, YCEHF 행사·축제경비편성내역, UCMZQA 지방보조금(2021년 이후).
키(LOFIN_KEY)는 출력하지 않는다. 바뀐 게 없으면 파일을 다시 쓰지 않는다(하루 한 번이면 충분)."""
import glob, json, os, statistics as st, sys, time, urllib.parse, urllib.request, datetime as D
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
KEY = os.environ.get("LOFIN_KEY", "")
HUB = "https://www.lofin365.go.kr/lf/hub/"
SRC = "행정안전부 지방재정365 OpenAPI"

def call(code, **p):
    rows, page = [], 1
    while True:
        q = urllib.parse.urlencode({"Key": KEY, "Type": "json", "pIndex": page, "pSize": 1000, **p})
        for t in range(3):
            try:
                b = urllib.request.urlopen(urllib.request.Request(HUB + code + "?" + q, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
                d = json.loads(b); break
            except Exception as e:
                err = str(e).replace(KEY, "***") if KEY else str(e); time.sleep(3)
        else:
            print(f"::warning::{code} {p} 실패: {err}"); return rows
        if code not in d:
            r = d.get("RESULT", [{}]); r = r[0] if isinstance(r, list) else r
            if r.get("CODE") != "INFO-200": print(f"::warning::{code} {p} {r.get('CODE')} {r.get('MESSAGE')}")
            return rows
        part = d[code][1]["row"]; total = d[code][0]["head"][0]["list_total_count"]
        rows += part
        if len(rows) >= total or not part: return rows
        page += 1; time.sleep(0.3)

def tracked():
    out = []
    for f in glob.glob(os.path.join(ROOT, "data/city/*.json")):
        c = json.load(open(f, encoding="utf-8"))["city"]; out.append(c)
    return out

def match(cities, wa, laf):
    wa, laf = (wa or "").replace(" ", ""), (laf or "").replace(" ", "")
    for c in cities:
        s = c["short"]
        if " " not in s:
            if wa.startswith(s): return c
        else:
            p, n = s.split(" ")
            if wa.startswith(p[:2]) and laf.endswith(n): return c
    return None

def now(): return D.datetime.now(D.timezone(D.timedelta(hours=9))).isoformat(timespec="minutes")

def save(name, obj):
    path = os.path.join(ROOT, "data", name)
    old = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else None
    if old and {k: v for k, v in old.items() if k != "updated"} == {k: v for k, v in obj.items() if k != "updated"}:
        print(name, "변경 없음"); return
    json.dump(obj, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":")); print(name, "저장")

def fest(cities):
    yr = D.date.today().year
    ev = []
    for y in range(yr - 4, yr):
        ev += call("EVFTCT", fyr=str(y))
    if not ev: return None
    last = max(int(r["fyr"]) for r in ev)
    allrows = []
    for r in ev:
        c = match(cities, r.get("wa_laf_hg_nm"), r.get("laf_hg_nm"))
        cost, rev = int(r.get("tott_amt") or 0), (int(r["biz_ern_amt"]) if str(r.get("biz_ern_amt") or "").strip() != "" else None)  # 빈 값 = 기록 없음(null), 0과 구분
        try:
            days = (D.date(*map(int, (r["hdmt_end_ymd"][:4], r["hdmt_end_ymd"][4:6], r["hdmt_end_ymd"][6:8]))) -
                    D.date(*map(int, (r["hdmt_bgng_ymd"][:4], r["hdmt_bgng_ymd"][4:6], r["hdmt_bgng_ymd"][6:8])))).days + 1
            days = days if 0 < days < 400 else None
        except Exception: days = None
        allrows.append({"y": int(r["fyr"]), "gov": r.get("laf_hg_nm"), "wa": r.get("wa_laf_hg_nm"), "slug": c["slug"] if c else None,
                        "cname": c["short"] if c else None, "nm": r.get("event_fstv_nm"), "cn": (r.get("biz_cn") or "")[:160],
                        "cost": cost, "rev": rev, "net": int(r.get("nc_amt") or 0), "days": days,
                        "from": r.get("hdmt_bgng_ymd"), "to": r.get("hdmt_end_ymd")})
    L = [r for r in allrows if r["y"] == last and r["cost"] > 0]
    med = st.median(r["cost"] for r in L); q = st.quantiles([r["cost"] for r in L], n=4)
    perday = [r["cost"] / r["days"] for r in L if r["days"]]; mpd = st.median(perday)
    rr = [r["rev"] / r["cost"] for r in L if r["rev"] is not None]; mrr = st.median(rr) if rr else 0
    T = [r for r in L if r["slug"]]
    for r in T:
        r["pct"] = round((r["cost"] / med - 1) * 100)
        r["perday"] = round(r["cost"] / r["days"]) if r["days"] else None
        r["rr"] = round(r["rev"] / r["cost"] * 100, 1) if r["rev"] is not None else None
    top = sorted(T, key=lambda r: -r["cost"])[:30]
    zero = sorted([r for r in T if r["rev"] == 0], key=lambda r: -r["cost"])[:15]
    pdtop = sorted([r for r in T if r["perday"]], key=lambda r: -r["perday"])[:10]
    # 축제 편성 비율(YCEHF): 자치단체 예산 대비 행사·축제경비 편성
    yc = call("YCEHF")
    ratio = []
    if yc:
        ly = max(int(r["fyr"]) for r in yc)
        for r in yc:
            if int(r["fyr"]) != ly: continue
            c = match(cities, r.get("wa_laf_hg_nm"), r.get("laf_hg_nm"))
            if not c: continue
            if " " not in c["short"] and not str(r.get("laf_hg_nm", "")).endswith("본청"): continue
            ratio.append({"cname": c["short"], "gov": r["laf_hg_nm"], "y": ly, "budget": r["smy_cntt_amt"], "fest": r["smy_cntt_amt2"], "rt": r["smy_cntt_amt_rt"]})
        ratio.sort(key=lambda x: -x["rt"])
    # 청사 신축(GVBDAC): ㎡당 단가
    gb = []
    for y in range(yr - 6, yr):
        gb += call("GVBDAC", fyr=str(y))
    halls = []
    if gb:
        by = {}
        for r in gb:
            if r.get("puar_amt"): by.setdefault(r.get("gbd_ty_nm"), []).append(r["puar_amt"])
        for r in gb:
            c = match(cities, r.get("wa_laf_hg_nm"), r.get("laf_hg_nm"))
            t = r.get("gbd_ty_nm"); arr = by.get(t, [])
            if not c or not r.get("puar_amt") or len(arr) < 4: continue
            m = st.median(arr); qq = st.quantiles(arr, n=4)
            area = r["nct_amt"] / r["puar_amt"] if r["puar_amt"] else None
            halls.append({"y": int(r["fyr"]), "cname": c["short"], "gov": r["laf_hg_nm"], "nm": r.get("gbd_nct_biz_nm"), "ty": t,
                          "amt": r["nct_amt"], "puar": r["puar_amt"], "tymed": m, "p25": qq[0], "p75": qq[2], "tyn": len(arr),
                          "area": round(area) if area else None, "pct": round((r["puar_amt"] / m - 1) * 100),
                          "est_lo": round(area * qq[0]) if area else None, "est_hi": round(area * qq[2]) if area else None})
        halls.sort(key=lambda h: -h["pct"])
    return {"updated": now(), "year": last, "n_all": len(L), "n": len(T), "sum": sum(r["cost"] for r in T), "rev": sum(r["rev"] or 0 for r in T), "rev_none": sum(1 for r in T if r["rev"] is None),
            "med": med, "p25": q[0], "p75": q[2], "med_perday": mpd, "med_rr": round(mrr * 100, 1),
            "top": top, "zero": zero, "perday": pdtop, "ratio": ratio[:20], "halls": halls[:20],
            "visitors": False,
            "source": SRC + " · 행사축제원가회계정보(EVFTCT)·행사축제경비편성내역(YCEHF)·청사신축원가회계정보(GVBDAC)"}

def subsidy(cities):
    rows = call("UCMZQA")
    if not rows: return None
    ly = max(int(r["fyr"]) for r in rows)
    out, hist = [], {}
    for r in rows:
        c = match(cities, r.get("wa_laf_hg_nm"), r.get("laf_hg_nm"))
        if not c: continue
        if " " not in c["short"] and not str(r.get("laf_hg_nm", "")).endswith("본청"): continue
        hist.setdefault(c["short"], {})[r["fyr"]] = r["smy_cntt_amt2"]
        if int(r["fyr"]) == ly:
            out.append({"cname": c["short"], "gov": r["laf_hg_nm"], "y": ly, "limit": r["smy_cntt_amt"], "plan": r["smy_cntt_amt2"],
                        "in": r.get("smy_cntt_amt3"), "out": r.get("smy_cntt_amt4"), "rt": r.get("smy_cntt_amt_rt")})
    for o in out:
        h = hist.get(o["cname"], {}); ys = sorted(h)
        o["hist"] = [[y, h[y]] for y in ys]
        o["over"] = (o["out"] or 0) > 0
    out.sort(key=lambda o: -(o["out"] or 0))
    return {"updated": now(), "year": ly, "n": len(out), "plan": sum(o["plan"] or 0 for o in out), "outsum": sum(o["out"] or 0 for o in out),
            "rows": out, "recipients": False,
            "source": SRC + " · 지방보조금(2021년 이후, UCMZQA) · 당초예산 기준"}

def main():
    if not KEY: print("LOFIN_KEY 없음, 건너뜀"); return
    cities = tracked()
    f = fest(cities)
    if f: save("sec_fest.json", f)
    s = subsidy(cities)
    if s: save("sec_subsidy.json", s)

if __name__ == "__main__":
    main()
