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

def is_sole(r):
    """경쟁 없는 수의계약: 체결방법이 수의계약이고 입찰공고 번호(ntce)가 없는 것. 공고를 거친 수의계약(유찰 후·견적 공고)은 뺀다."""
    return "수의" in (r.get("method") or "") and not r.get("ntce")


TODAY = D.datetime.now(D.timezone(D.timedelta(hours=9))).strftime("%Y-%m-%d")


def amt(r): return r.get("this") or r.get("amount") or 0

def main():
    rows, tot, cities = [], collections.Counter(), {}
    latest = {}  # 분야별 비교용: 계약번호마다 최신 차수 1건(변경 계약 포함, 모든 시 동일 기준)
    for f in sorted(glob.glob(os.path.join(ROOT, "data/city/*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        c = d["city"]; cities[c["slug"]] = c
        for r in d["rows"] + d.get("changes", []):  # 분야별 단가 비교는 기간 전 계약의 변경분도 포함
            if is_sole(r):
                k = r.get("no") or r.get("id")
                if k not in latest or (r.get("ord") or "00") > (latest[k].get("ord") or "00"):
                    latest[k] = {**r, "slug": c["slug"], "cname": c["short"]}
        for r in d["rows"]:
            if (r.get("odate") or r["date"]) >= TODAY: continue  # 진행 중인 오늘은 빼고 다 끝난 날까지만
            if "수의" in (r.get("method") or ""):  # 공고 거친 수의계약까지 포함한 비율(참고용)
                tot[(c["slug"], "sole_all")] += amt(r); tot[(c["slug"], "sn_all")] += 1
            # 기간 안에 처음 맺은 계약만, 계약번호당 1건(최신 차수 금액)
            tot[(c["slug"], "all")] += amt(r); tot[(c["slug"], "n")] += 1
            if is_sole(r):
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
              "sn": tot[(k, "sn")], "n": tot[(k, "n")],
              "sole_all": tot[(k, "sole_all")], "sn_all": tot[(k, "sn_all")],
              "pct": round(tot[(k, "sn")] / tot[(k, "n")] * 100, 1), "pct_all": round(tot[(k, "sn_all")] / tot[(k, "n")] * 100, 1),
              "pct_amt": round(tot[(k, "sole")] / tot[(k, "all")] * 100, 1) if tot[(k, "all")] else None,
              "pct_amt_all": round(tot[(k, "sole_all")] / tot[(k, "all")] * 100, 1) if tot[(k, "all")] else None} for k in cities if tot[(k, "n")] >= 20]
    share.sort(key=lambda x: -(x["sn"] / x["n"]))
    big = sorted(rows, key=lambda r: -amt(r))[:15]
    import statistics as st
    comp = []

    # 분야 정의: 공백을 없앤 제목에 include 가 맞고 exclude 가 안 맞는 계약만. 성격이 다른 일은 따로 묶는다.
    MIN_CITY = 3
    for kw, _, _ in KW.SOLE_SECT:
        # 기간 안에 처음 맺은 계약만(합계와 같은 기준), 기간 전 계약의 변경분 제외
        g2 = [r for r in rows if amt(r) > 0 and (r.get("ord") or "00") == "00" and KW.sole_sector(r["title"]) == kw]  # 변경 없는 원계약만(금액 비교 기준 통일)
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
        if m <= med: continue  # 중앙값보다 비싼 시가 없으면 비교 카드 안 만듦
        comp.append({"kw": kw, "n": len(g2), "cities": len(byc), "med": med, "city": c, "cmed": m, "cn": n, "small": small,
                     "pct": round((m / med - 1) * 100), "p25": q[0], "p75": q[2], "save": 0 if small else max(0, sm - med * n),
                     "ids": [{"no": x.get("no"), "ord": x.get("ord"), "a": amt(x), "d": x["date"], "t": x["title"], "u": x.get("url")} for x in v]})
    comp.sort(key=lambda x: -x["save"])
    dates = [r.get("odate") or r["date"] for r in rows]
    out = {"updated": D.datetime.now(D.timezone(D.timedelta(hours=9))).isoformat(timespec="minutes"),
           "period": [min(dates), max(dates)], "n": len(rows), "sum": sum(amt(r) for r in rows),
           "n_all": sum(tot[(k, "n")] for k in cities), "sum_all": sum(tot[(k, "all")] for k in cities),
           "share_note": "pct: 공고 없는 수의계약 건수 비율 · pct_all: 공고 거친 수의계약(유찰 후·견적 공고) 포함 건수 비율 · pct_amt/pct_amt_all: 같은 기준의 금액 비율", "flags": flags[:40], "comp": comp, "flag_n": len(flags), "share": share,
           "big": [{"t": r["title"], "a": amt(r), "d": r["date"], "inst": r["inst"], "vendor": mask(r["vendor"]),
                    "u": r.get("url"), "cname": r["cname"]} for r in big],
           "source": "조달청 나라장터 공공데이터개방표준 계약정보(공공데이터포털 15058815)"}
    json.dump(out, open(os.path.join(ROOT, "data/sec_sole.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("sec_sole", len(rows), len(flags))

if __name__ == "__main__":
    main()
