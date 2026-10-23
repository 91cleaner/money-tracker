"""수의계약 섹션: data/city/*.json(읽기 전용)에서 수의계약만 모아 data/sec_sole.json 작성.
쪼개기 의심(데이터상 이상 징후): 같은 기관이 같은 업체와 30일 안에 3건 이상 수의계약,
건마다 2천만원 이하인데 합치면 2천만원 초과(지방계약법 시행령 1인 견적 수의계약 기준선 참고)."""
import glob, json, os, sys, datetime as D, collections
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import kw as KW
try:
    from privacy import mask
except Exception:
    mask = lambda n: n
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
LIM = 20_000_000

def amt(r): return r.get("this") or r.get("amount") or 0

def main():
    rows, tot, cities = [], collections.Counter(), {}
    latest = {}  # 분야별 비교용: 계약번호마다 최신 차수 1건(변경 계약 포함, 모든 시 동일 기준)
    for f in sorted(glob.glob(os.path.join(ROOT, "data/city/*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        c = d["city"]; cities[c["slug"]] = c
        for r in d["rows"] + d.get("changes", []):  # 분야별 단가 비교는 기간 전 계약의 변경분도 포함
            if r.get("method") == "수의계약":
                k = r.get("no") or r.get("id")
                if k not in latest or (r.get("ord") or "00") > (latest[k].get("ord") or "00"):
                    latest[k] = {**r, "slug": c["slug"], "cname": c["short"]}
        for r in d["rows"]:  # 기간 안에 처음 맺은 계약만, 계약번호당 1건(최신 차수 금액)
            tot[(c["slug"], "all")] += amt(r); tot[(c["slug"], "n")] += 1
            if r.get("method") == "수의계약":
                tot[(c["slug"], "sole")] += amt(r); tot[(c["slug"], "sn")] += 1
                rows.append({**r, "date": r.get("odate") or r["date"], "slug": c["slug"], "cname": c["short"]})
    if not rows: return
    g = collections.defaultdict(list)
    for r in rows: g[(r["inst"], r.get("bh") or r["vendor"])].append(r)
    flags = []
    for (inst, _), v in g.items():
        v.sort(key=lambda r: r["date"])
        best = None
        for i in range(len(v)):
            d0 = D.date.fromisoformat(v[i]["date"])
            w = [x for x in v[i:] if (D.date.fromisoformat(x["date"]) - d0).days <= 30]
            s = sum(amt(x) for x in w)
            if len(w) >= 3 and s > LIM and all(amt(x) <= LIM for x in w) and (not best or s > best[0]):
                best = (s, w)
        if best:
            s, w = best
            flags.append({"inst": inst, "vendor": mask(w[0]["vendor"]), "vregion": w[0].get("vregion") or "",
                          "slug": w[0]["slug"], "cname": w[0]["cname"], "sum": s, "n": len(w),
                          "from": w[0]["date"], "to": w[-1]["date"],
                          "items": [{"t": x["title"], "a": amt(x), "d": x["date"], "u": x.get("url")} for x in w]})
    flags.sort(key=lambda x: -x["sum"])
    share = [{"slug": k, "name": cities[k]["short"], "sole": tot[(k, "sole")], "all": tot[(k, "all")],
              "sn": tot[(k, "sn")], "n": tot[(k, "n")]} for k in cities if tot[(k, "n")] >= 20]
    share.sort(key=lambda x: -(x["sn"] / x["n"]))
    big = sorted(rows, key=lambda r: -amt(r))[:15]
    import statistics as st
    comp = []
    import re
    # 분야 정의: 공백을 없앤 제목에 include 가 맞고 exclude 가 안 맞는 계약만. 성격이 다른 일은 따로 묶는다.
    SECT = [
        ("건설재해예방", r"재해예방(기술)?지도|건설재해예방", None),
        ("긴급누수", r"긴급누수", None),
        ("아스콘 포장", r"아스콘", r"폐아스콘|폐기물"),
        ("폐아스콘 처리", r"폐아스콘", None),
        ("폐기물", r"폐기물", None),
        ("방역", r"방역", None),
        ("CCTV", r"CCTV", None),
        ("청소", r"청소(?!년)", None),
        ("제초", r"(?<!통)제초(?!소)", None),
        ("가로등", r"가로등", None),
        ("안전점검", r"안전점검", None),
    ]
    TERM = re.compile(r"단가|연간|년간|연중|1년|12개월|반기|분기")  # 1년·반기 단가계약은 단건 일과 섞지 않음
    MIN_CITY = 3
    for kw, inc, exc in SECT:
        ri, rx = re.compile(inc, re.I), re.compile(exc) if exc else None
        g2 = []
        for r in rows:  # 기간 안에 처음 맺은 계약만(합계와 같은 기준), 기간 전 계약의 변경분 제외
            t = re.sub(r"\s+", "", r["title"] or "")
            if amt(r) > 0 and ri.search(t) and not (rx and rx.search(t)) and not TERM.search(t):
                g2.append(r)
        if len(g2) < 8: continue
        med = st.median(amt(r) for r in g2)
        q = st.quantiles([amt(r) for r in g2], n=4)
        byc = collections.defaultdict(list)
        for r in g2: byc[r["cname"]].append(r)
        cs = [(c, st.median(amt(x) for x in v), len(v), sum(amt(x) for x in v), v) for c, v in byc.items() if len(v) >= 2]
        if len(cs) < 3: continue
        ok = [x for x in cs if x[2] >= MIN_CITY]
        small = not ok
        c, m, n, sm, v = max(ok or cs, key=lambda x: x[1] / med)
        comp.append({"kw": kw, "n": len(g2), "cities": len(byc), "med": med, "city": c, "cmed": m, "cn": n, "small": small,
                     "pct": round((m / med - 1) * 100), "p25": q[0], "p75": q[2], "save": 0 if small else max(0, sm - med * n),
                     "ids": [{"no": x.get("no"), "ord": x.get("ord"), "a": amt(x), "d": x["date"], "t": x["title"][:40], "u": x.get("url")} for x in v]})
    comp.sort(key=lambda x: -x["save"])
    dates = [r.get("odate") or r["date"] for r in rows]
    out = {"updated": D.datetime.now(D.timezone(D.timedelta(hours=9))).isoformat(timespec="minutes"),
           "period": [min(dates), max(dates)], "n": len(rows), "sum": sum(amt(r) for r in rows),
           "n_all": sum(tot[(k, "n")] for k in cities), "sum_all": sum(tot[(k, "all")] for k in cities),
           "flags": flags[:40], "comp": comp, "flag_n": len(flags), "share": share,
           "big": [{"t": r["title"], "a": amt(r), "d": r["date"], "inst": r["inst"], "vendor": mask(r["vendor"]),
                    "u": r.get("url"), "cname": r["cname"]} for r in big],
           "source": "조달청 나라장터 공공데이터개방표준 계약정보(공공데이터포털 15058815)"}
    json.dump(out, open(os.path.join(ROOT, "data/sec_sole.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("sec_sole", len(rows), len(flags))

if __name__ == "__main__":
    main()
