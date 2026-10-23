"""데이터 검증 게이트. 수집 후, 커밋·배포 전에 실행한다.
위반이 하나라도 있으면 종료 코드 1 → 워크플로가 커밋하지 않고 멈춘다(마지막 정상 데이터 유지).
급격한 변동(>30%)은 위반이 아니라 '검토 필요' 경고로 남긴다.
사용: python collector/validate.py [data 폴더] [--prev 이전 data 폴더]"""
import datetime as D, glob, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kw  # noqa: E402
from collect import EXT_ATYPE  # noqa: E402

# (오탐 단어, 들어가면 안 되는 분류) — 이 단어 때문에만 그 분류가 됐다면 위반
FP_CAT = [("청소년", "청소"), ("보안등", "경비"), ("대행사업", "인쇄·홍보"), ("이행사업", "인쇄·홍보"),
          ("소방서", "시설관리"), ("소방본부", "시설관리"), ("시설관리공단", "시설관리")]
# sec_sole 비교 분야별 금지 패턴(공백 제거한 제목 기준)
FP_SOLE = {"청소": r"청소년", "제초": r"통제초소", "아스콘 포장": r"폐아스콘", "*": r"단가|연간|년간"}


def _load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def _category(title, kind):
    from collect import category  # 수집기와 같은 분류 함수
    return category(title, kind)


def check(root, prev=None):
    err, warn = [], []
    E = lambda m: err.append(m)
    idx = _load(os.path.join(root, "index.json"))
    days = idx.get("days", 90)
    cities = {}
    for p in sorted(glob.glob(os.path.join(root, "city", "*.json"))):
        cities[os.path.basename(p)[:-5]] = _load(p)

    # (1) 계약번호 중복, (2) 기간 전 계약의 변경분이 합계에 섞였는지, (3) 분류 오탐
    seen = {}
    for slug, d in cities.items():
        rows, chg, ext = d.get("rows", []), d.get("changes", []), d.get("ext", [])
        last = max([r.get("odate") or r["date"] for r in rows] + [r["date"] for r in chg] or [idx["updated"][:10]])
        start = (D.date.fromisoformat(last) - D.timedelta(days=days)).isoformat()
        for r in rows + chg + ext:
            no = r.get("no") or r["id"]
            if no in seen:
                E(f"[1 중복] {no} 가 {seen[no]} 와 {slug} 에 두 번 집계")
            seen[no] = slug
        for r in rows:
            o = r.get("odate")
            if r.get("ord", "00") != "00":
                E(f"[2 변경 차수] {slug} {r.get('no')} ord={r.get('ord')} odate={o} 가 신규 합계(rows)에 포함(changes 로 가야 함)")
            elif not o or o < start:
                E(f"[2 기간 전] {slug} {r.get('no')} odate={o} 가 기간 시작 {start} 이전")
            last_tok = (r.get("inst") or "").split(" ")[-1]
            if "소방" in (r.get("inst") or "") or (" " not in d.get("city", {}).get("short", "x y") and re.search(r"군(청)?$", last_tok) and " " in (r.get("inst") or "")):
                E(f"[18 시 밖 기관] {slug} {r.get('no')} '{r.get('inst')}'(소방·광역시 자치군)이 시 합계(rows)에 포함")
            full = max(r.get("amount") or 0, r.get("tot_amt") or 0)
            if r.get("this") and "장기" in (r.get("lt") or "") and r.get("amount") != r["this"] and r["this"] < full:
                E(f"[22 금액 기준] {slug} {r.get('no')} 장기계속인데 합계 금액 {r.get('amount')} ≠ 이번 차수 {r['this']}")
            if r.get("tot_amt") is None:
                E(f"[22 금액 기준] {slug} {r.get('no')} tot_amt(전체 계약금액) 칸 없음")
            elif r["tot_amt"] < (r.get("amount") or 0):
                E(f"[22 금액 기준] {slug} {r.get('no')} 전체 계약금액 tot_amt < 합계 금액")
            if r.get("atype") in EXT_ATYPE:
                E(f"[18 시 밖 기관] {slug} {r.get('no')} {r.get('atype')} 가 시 합계(rows)에 포함(ext 로 가야 함)")
            t = r.get("title") or ""
            for w, cat in FP_CAT:
                if r.get("cat") == cat and w in t and _category(t.replace(w, " "), r.get("kind")) != cat:
                    E(f"[3 오탐] {slug} {r.get('no')} '{t[:40]}' 가 '{w}' 때문에 '{cat}'")
        # (5) 합계 일치
    byslug = {c["slug"]: c for c in idx["cities"]}
    if set(byslug) != set(cities):
        E(f"[5 합계] index 도시 {len(byslug)}개 ≠ city 파일 {len(cities)}개")
    for slug, d in cities.items():
        c = byslug.get(slug)
        if not c: continue
        rows = d.get("rows", [])
        if c["count"] != len(rows) or c["total"] != sum(r["amount"] or 0 for r in rows):
            E(f"[5 합계] {slug} index count/total {c['count']}/{c['total']} ≠ 파일 {len(rows)}/{sum(r['amount'] or 0 for r in rows)}")
        ext = d.get("ext", [])
        ce = c.get("ext") or {"count": 0, "total": 0}
        if ce["count"] != len(ext) or ce["total"] != sum(r["amount"] or 0 for r in ext):
            E(f"[18 시 밖 기관] {slug} index ext {ce['count']}/{ce['total']} ≠ 파일 {len(ext)}/{sum(r['amount'] or 0 for r in ext)}")
        if any(r.get("atype") not in EXT_ATYPE for r in ext):
            E(f"[18 시 밖 기관] {slug} ext 에 시 기관 계약이 섞임")
        if c.get("changes", 0) != len(d.get("changes", [])):
            E(f"[5 합계] {slug} index changes {c.get('changes')} ≠ {len(d.get('changes', []))}")
        if sum(c.get("n_cat", {}).values()) not in (0, len(rows)):
            E(f"[5 합계] {slug} 분야별 건수 합 ≠ count")

    # (17) 기간 슬라이더용 일별 집계 = 도시 파일의 신규 계약(건수·금액·분야) 그대로
    dp = os.path.join(root, "daily.json")
    if os.path.exists(dp):
        dl = _load(dp)
        for slug, d in cities.items():
            m = dl.get("c", {}).get(slug, {})
            rows = d.get("rows", [])
            n, t = sum(v[0] for v in m.values()), sum(v[1] for v in m.values())
            if n != len(rows) or t != sum(r["amount"] or 0 for r in rows):
                E(f"[17 일별 집계] {slug} 일별 합 {n}건/{t} ≠ 도시 파일 {len(rows)}건/{sum(r['amount'] or 0 for r in rows)}")
            for day, v in m.items():
                if v[0] != sum(x[0] for x in v[2].values()) or v[1] != sum(x[1] for x in v[2].values()):
                    E(f"[17 일별 집계] {slug} {day} 분야별 합 ≠ 그날 합"); break
            byday = {}
            for r in rows:
                byday[r.get("odate") or r["date"]] = byday.get(r.get("odate") or r["date"], 0) + 1
            if any(m.get(k, [0])[0] != v for k, v in byday.items()):
                E(f"[17 일별 집계] {slug} 날짜별 건수가 도시 파일과 다름")
        if cities and dl.get("first") and dl.get("last"):
            span = (D.date.fromisoformat(dl["last"]) - D.date.fromisoformat(dl["first"])).days + 1
            if idx.get("days") != span:
                E(f"[23 기간] index days {idx.get('days')} ≠ 실제 담긴 기간 {span}일({dl['first']}~{dl['last']})")
        if cities and not idx.get("amount_basis"):
            E("[22 금액 기준] index.json 에 amount_basis(합계 금액 기준) 없음")
        if "daily" not in idx:
            E("[17 일별 집계] index.json 에 daily 필드 없음(슬라이더가 꺼짐)")
        if cities and not dl.get("last"):
            E("[17 일별 집계] daily.json 에 last 없음")
    elif cities:
        E("[17 일별 집계] daily.json 없음")
    # (22) changes·ext 도 tot_amt 채움
    for slug, d in cities.items():
        nt = sum(1 for r in d.get("changes", []) + d.get("ext", []) if r.get("tot_amt") is None)
        if nt: E(f"[22 금액 기준] {slug} changes/ext {nt}건 tot_amt 없음")
    # (24) 화면 데이터의 계약 제목에 번지(지번·건물번호)가 그대로 있는지
    from collect import ADDR_RX
    leak = []
    def scan(o, where):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("title", "t") and isinstance(v, str):
                    m = ADDR_RX.search(v)
                    if m and re.search(r"\d", m.group(2)): leak.append(f"{where}: '{v[:40]}'")
                else: scan(v, where)
        elif isinstance(o, list):
            for v in o: scan(v, where)
    for p in glob.glob(os.path.join(root, "**", "*.json"), recursive=True):
        if os.path.basename(p).startswith("_") or os.path.basename(p) == "index.json": continue
        try: scan(_load(p), os.path.relpath(p, root))
        except Exception: pass
    # (25) 업체 이름이 비정상적으로 긴 곳(한글 읽기가 실행마다 덧붙던 문제 재발 방지)
    for slug, d in cities.items():
        long_ = [r.get("vendor", "")[:30] for r in d.get("rows", []) + d.get("changes", []) + d.get("ext", []) if len(r.get("vendor") or "") > 200]
        if long_: E(f"[25 업체 이름] {slug} 이름이 200자 넘는 행 {len(long_)}건, 예: {long_[:2]}")
    if leak: E(f"[24 번지] 계약 제목에 번지가 가려지지 않은 곳 {len(leak)}건, 예: {leak[:3]}")
    # (8) 수집 공백: 기간 안 평일(공휴일 제외)마다 계약이 있고 최근 평일 평균의 20% 이상
    from collect import HOLIDAYS, SIDO
    cnt = {}
    allrows = [r for d in cities.values() for r in d.get("rows", []) + d.get("changes", []) + d.get("ext", [])]
    for r in allrows:
        cnt[r["date"]] = cnt.get(r["date"], 0) + 1
    newrows = [r for d in cities.values() for r in d.get("rows", [])]
    if len(allrows) >= 200:
        first = min(r.get("odate") or r["date"] for r in newrows)
        last = max(cnt)
        d0, d1 = D.date.fromisoformat(first), D.date.fromisoformat(last)
        wd = [d0 + D.timedelta(days=k) for k in range((d1 - d0).days)]  # 마지막 날(수집 중일 수 있음) 제외
        wd = [x.isoformat() for x in wd if x.weekday() < 5 and x.isoformat() not in HOLIDAYS]
        rec = [cnt.get(x, 0) for x in wd[-10:]]
        avg = sum(rec) / len(rec) if rec else 0
        bad = [x for x in wd if cnt.get(x, 0) == 0 or cnt.get(x, 0) < 0.2 * avg]
        if bad:
            E(f"[8 수집 공백] 평일 {len(bad)}일 계약이 없거나 최근 평일 평균({avg:.0f}건)의 20% 미만: {', '.join(bad[:12])}{' …' if len(bad) > 12 else ''}")
    # (9) 공동도급·장기계속 필드가 실제로 채워지는지
    if len(newrows) >= 500:
        if not any(r.get("jv") is True for r in newrows):
            E("[9 공동도급] 공동도급(jv=True) 비율이 0% — cmmnCntrctYn 처리가 안 되는 것")
        if all(r.get("lt") is None for r in newrows):
            E("[9 장기계속] 모든 행의 lt 가 비어 있음 — lngtrmCtnuDivNm 처리가 안 되는 것")
    lastd = max(cnt) if cnt else idx["updated"][:10]
    pend = []
    for slug, d in cities.items():
        for r in d.get("rows", []):
            if r.get("jv") is True and not r.get("jvm"):
                if not r.get("jvp"):
                    E(f"[9 공동도급] {slug} {r.get('no')} 공동도급인데 참여 업체(jvm) 없고 조회 대기 표시도 없음")
                else:
                    pend.append(r)
            if r.get("ltc") and not (r.get("this") and r.get("amount")):
                E(f"[9 장기계속] {slug} {r.get('no')} 장기계속인데 금차/총액 중 하나 없음")
            if r.get("ord", "00") != "00" and "00" not in {x.get("ord") for x in r.get("hist") or []}:
                E(f"[10 원계약] {slug} {r.get('no')} ord={r.get('ord')} 인데 hist 에 00 차수 없음")
            v = r.get("vregion")
            if v and v.split(" ")[0] not in SIDO:
                E(f"[11 시도] {slug} {r.get('no')} 업체 소재지 '{v}' 가 공식 시도 이름 아님")
            if not r.get("atype"):
                E(f"[12 기관 종류] {slug} {r.get('no')} atype 없음"); break
    if pend:
        warn.append(f"[9 공동도급] 참여 업체 조회 대기 {len(pend)}건(화면엔 '참여 업체 확인 중' 표시)")
    for c in idx["cities"]:
        if "today_basis" in c and c["today_basis"] != c.get("last"):
            E(f"[13 오늘 기준] {c['slug']} today_basis ≠ last")

    # sec_sole: (1)(2)(3)(4)
    # (19) 공고 있음/없음: 모든 계약에 ann 필드, 입찰공고 번호(ntce)와 일치
    byno, bad_ann = {}, 0
    for slug, d in cities.items():
        for r in d.get("rows", []) + d.get("changes", []) + d.get("ext", []):
            byno[r.get("no") or r["id"]] = r
            if r.get("ann") is not bool(r.get("ntce")): bad_ann += 1
    if bad_ann: E(f"[19 공고] ann(공고 있음/없음)이 없거나 입찰공고 번호와 다른 계약 {bad_ann}건")
    cmp_seen = {}
    sp = os.path.join(root, "sec_sole.json")
    if os.path.exists(sp):
        s = _load(sp)
        for c in s.get("comp", []):
            ids = c.get("ids") or []
            nos = [x.get("no") for x in ids]
            if len(nos) != len(set(nos)): E(f"[1 중복] sec_sole '{c['kw']}' 근거 계약번호 중복")
            if not c.get("small") and (c["cn"] < 3 or len(ids) < 3):
                E(f"[4 표본] sec_sole '{c['kw']}' 1위 {c['city']} {c['cn']}건 < 3 인데 표본 적음 표시 없음")
            if ids and not c.get("small") and abs(c.get("save", 0) - max(0, sum(x.get("a") or 0 for x in ids) - c.get("med", 0) * c["cn"])) > 1 and "med" in c:
                E(f"[16 절감액] sec_sole '{c['kw']}' save 가 카드 공식(합계 − 전국 중앙값 × 건수)과 다름")
            if len(ids) != c["cn"]: E(f"[4 표본] sec_sole '{c['kw']}' cn {c['cn']} ≠ 근거 {len(ids)}건")
            for x in ids:
                if x.get("ord") != "00":
                    E(f"[2/4 차수] sec_sole '{c['kw']}' {x.get('no')} ord={x.get('ord')}")
                if c["kw"] in kw.SOLE_SECT_NAMES and kw.sole_sector(x.get("t")) != c["kw"]:
                    E(f"[21 분야] sec_sole '{c['kw']}' {x.get('no')} '{x.get('t')}' 가 '{kw.sole_sector(x.get('t'))}' 분야(성격이 다른 계약끼리 비교)")
                if x.get("no") in cmp_seen and cmp_seen[x["no"]] != c["kw"]:
                    E(f"[21 분야] sec_sole {x['no']} 가 '{cmp_seen[x['no']]}'·'{c['kw']}' 두 비교에 들어감")
                cmp_seen.setdefault(x.get("no"), c["kw"])
                rr_ = byno.get(x.get("no"))
                if rr_ is not None and rr_.get("ntce"):
                    E(f"[19 공고] sec_sole '{c['kw']}' {x.get('no')} 는 입찰공고({rr_['ntce']})가 있는데 '경쟁 없음' 비교에 들어감")
                if c["kw"] in kw.SOLE_SECT_NAMES and not kw.sole_hit(x.get("t"), c["kw"]):
                    E(f"[3 오탐] sec_sole '{c['kw']}' {x.get('no')} '{x.get('t')}' 가 분야 규칙에 안 맞음(낱말 경계·제외어·단가계약)")
                t = re.sub(r"\s+", "", x.get("t") or "")
                for k, rx in FP_SOLE.items():
                    if k in ("*", c["kw"]) and re.search(rx, t):
                        E(f"[3 오탐] sec_sole '{c['kw']}' {x.get('no')} '{x.get('t')}' ({rx})")
                if x.get("no") and seen.get(x["no"]) is None:
                    E(f"[2 기간 전 변경분] sec_sole 근거 {x['no']} 가 어느 도시 rows에도 없음")
                elif x.get("no"):
                    d = cities[seen[x["no"]]]
                    if not any(r.get("no") == x["no"] for r in d["rows"]):
                        E(f"[2 기간 전 변경분] sec_sole 근거 {x['no']} 가 changes(기간 전 계약)에서 옴")

    # (6) 지방재정 수입: 기록 없음은 null, 0과 섞지 않음
    fp = os.path.join(root, "sec_fest.json")
    if os.path.exists(fp):
        f = _load(fp)
        if "rev_none" not in f: E("[6 null] sec_fest 에 rev_none 없음")
        elif f.get("n", 0) >= 50 and f["rev_none"] == 0:
            E(f"[6 null] sec_fest 사업수입 '기록 없음'이 0건(행사 {f['n']}건) — 빈 값이 0원으로 바뀐 회귀")
        if f.get("ratio") and not (f.get("cost_year") and f.get("ratio_year")):
            E("[14 연도] sec_fest 에 cost_year/ratio_year 없음(원가 연도와 예산 연도 혼동)")
        for r in f.get("ratio") or []:
            if " " not in r.get("cname", "") and r.get("scope") != "본청":
                E(f"[15 범위] 광역시 {r.get('cname')} 축제 예산 비율에 범위(본청) 표시 없음")
        for k in ("top", "perday", "ratio", "zero"):
            for r in f.get(k) or []:
                if not isinstance(r, dict): continue
                if r.get("rev") is None and r.get("rr") not in (None,):
                    E(f"[6 null] sec_fest.{k} {r.get('nm')} 수입 기록 없음인데 비율 {r.get('rr')}")
                if k == "zero" and r.get("rev") != 0:
                    E(f"[6 null] sec_fest.zero 에 수입 0이 아닌 행 {r.get('nm')} rev={r.get('rev')}")
                if r.get("rev") == 0 and r.get("rr") is None:
                    E(f"[6 null] sec_fest.{k} {r.get('nm')} 수입 0인데 비율 없음(null/0 혼동)")

        # (20) 축제 수입: 0 과 기록 없음이 섞이지 않게 — 0 은 '기록 없음'(null) 하나로, 실행마다 같은 결과
        for k in ("top", "perday", "zero"):
            for r in f.get(k) or []:
                if isinstance(r, dict) and r.get("rev") == 0:
                    E(f"[20 축제 수입] sec_fest.{k} {r.get('nm')} 수입 0 (0 은 기록 없음 null 로 통일해야 실행마다 같음)")
        if prev and os.path.exists(os.path.join(prev, "sec_fest.json")):
            pf = _load(os.path.join(prev, "sec_fest.json"))
            if pf.get("year") == f.get("year"):
                key = lambda r: (r.get("gov"), r.get("nm"), r.get("from"))
                po = {key(r): r.get("rev") for r in pf.get("top") or [] if isinstance(r, dict)}
                for r in f.get("top") or []:
                    if isinstance(r, dict) and key(r) in po and (po[key(r)] in (None, 0)) != (r.get("rev") in (None, 0)):
                        warn.append(f"[20 축제 수입] {r.get('nm')} 수입 {po[key(r)]} → {r.get('rev')} (같은 연도인데 값이 바뀜)")
                if pf.get("rev_none") is not None and f.get("n") == pf.get("n") and f.get("rev_none") != pf.get("rev_none"):
                    E(f"[20 축제 수입] 같은 연도·같은 행사 수({f.get('n')})인데 기록 없음 {pf.get('rev_none')} → {f.get('rev_none')} (실행마다 달라짐)")

    # rank: 업체별 건수 합이 전체 건수 이하
    rp = os.path.join(root, "rank.json")
    if os.path.exists(rp):
        ids = [v.get("id") for v in _load(rp).get("vendors", [])]
        if len([i for i in ids if i]) != len({i for i in ids if i}): E("[1 중복] rank.json 같은 업체가 두 번")

    # (7) 급변 경고
    if prev and os.path.exists(os.path.join(prev, "index.json")):
        pi = _load(os.path.join(prev, "index.json"))
        a, b = sum(c["total"] for c in pi["cities"]), sum(c["total"] for c in idx["cities"])
        if a and abs(b - a) / a > 0.3:
            warn.append(f"[7 급변] 전국 합계 {a:,} → {b:,} ({(b - a) / a:+.0%})")
        t0 = [c["slug"] for c in sorted(pi["cities"], key=lambda c: -c["total"])[:10]]
        t1 = [c["slug"] for c in sorted(idx["cities"], key=lambda c: -c["total"])[:10]]
        moved = sum(1 for i, s in enumerate(t1) if i >= len(t0) or t0[i] != s)
        if moved > 3:
            warn.append(f"[7 급변] 상위 10위 순서 {moved}곳 바뀜: {t0} → {t1}")
        pc = {c["slug"]: c["total"] for c in pi["cities"]}
        for c in idx["cities"]:
            o = pc.get(c["slug"])
            if o and o > 1e9 and abs(c["total"] - o) / o > 0.3:
                warn.append(f"[7 급변] {c['slug']} 합계 {o:,} → {c['total']:,}")
    return err, warn


def main(argv):
    root, prev = "data", None
    a = list(argv)
    if "--prev" in a:
        i = a.index("--prev"); prev = a[i + 1]; del a[i:i + 2]
    if a: root = a[0]
    err, warn = check(root, prev)
    for w in warn: print("::warning::" + w)
    for e in err[:200]: print("::error::" + e)
    sm = os.environ.get("GITHUB_STEP_SUMMARY")
    if sm:
        with open(sm, "a", encoding="utf-8") as f:
            f.write(f"## 데이터 검증: 위반 {len(err)} · 검토 {len(warn)}\n" + "".join(f"- {x}\n" for x in (err[:50] + warn)))
    print(f"검증 결과: 위반 {len(err)}건, 검토 필요 {len(warn)}건")
    return 1 if err else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
