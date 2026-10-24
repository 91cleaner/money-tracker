from collections import Counter
"""나라 세금(정치인·정당) 섹션 수집: data/national/*.json
- 열린국회정보 API(ASSEMBLY_KEY, 없으면 sample 키=5건 제한)로 국회의원 명단·정당·지역구
- collector/national/seed.json: 국회사무처 수당 지급기준·의원실 지원경비, 선관위 국고보조금(공식 발표값)
- 돈 흐름(flows): 기록마다 준 쪽(from)·받은 쪽(to)과 지역. 업체명은 공개 필드에 두지 않음(_vendor 내부 필드만).
키 값은 출력하지 않는다."""
import csv, json, os, re, time, urllib.request, urllib.parse
from collections import defaultdict
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "national")
SEED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed.json")
AK = os.environ.get("ASSEMBLY_KEY", "").strip()
BASE = "https://open.assembly.go.kr/portal/openapi/"
KST = timezone(timedelta(hours=9))
NA = {"name": "국회사무처", "region": "서울 영등포구"}
NEC = {"name": "중앙선거관리위원회(국고)", "region": "경기 과천시"}
SIDO = {"서울": "서울", "부산": "부산", "대구": "대구", "인천": "인천", "광주": "광주", "대전": "대전", "울산": "울산", "세종": "세종",
        "경기": "경기", "강원": "강원", "충북": "충북", "충남": "충남", "전북": "전북", "전남": "전남", "경북": "경북", "경남": "경남", "제주": "제주"}
log = []


def api(code, **p):
    q = {"Type": "json", "pIndex": 1, "pSize": 100, **({"KEY": AK} if AK else {}), **p}
    rows, total = [], None
    while True:
        url = BASE + code + "?" + urllib.parse.urlencode(q)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 money-tracker"})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e:
            log.append(f"{code}: {type(e).__name__} {str(e)[:120]}".replace(AK, "***") if AK else f"{code}: {type(e).__name__} {str(e)[:120]}")
            break
        if code not in d:
            res = d.get("RESULT", {})
            log.append(f"{code}: {res.get('CODE')} {res.get('MESSAGE')}")
            break
        head, body = d[code][0]["head"], (d[code][1].get("row", []) if len(d[code]) > 1 else [])
        total = head[0].get("list_total_count")
        rows += body
        if not AK or not body or len(rows) >= (total or 0) or q["pIndex"] > 50:  # 키 없으면 같은 5건만 반복됨
            break
        q["pIndex"] += 1; time.sleep(0.3)
    log.append(f"{code}: {len(rows)}/{total}건" + ("" if AK else " (인증키 없이)"))
    return rows


def sido_of(orig):
    for k, v in SIDO.items():
        if (orig or "").startswith(k):
            return v
    return None


TRIP = "nasnutdbapnfphwyr"   # O87UNV000897E818234 국회의원 직무상 국외활동 신고 내역
ALLM = "ALLNAMEMBER"          # 국회의원 정보 통합(역대·사직 포함)
_SPLIT = re.compile(r"[,，·、/]")


def _split_top(s):
    """괄호 밖 구분자로만 나눔: '호주(캔버라,시드니), 일본' → ['호주(캔버라,시드니)', '일본']"""
    out, buf, depth = [], "", 0
    for ch in s or "":
        if ch in "(（[": depth += 1
        elif ch in ")）]": depth = max(0, depth - 1)
        if depth == 0 and _SPLIT.match(ch):
            out.append(buf); buf = ""
        else:
            buf += ch
    out.append(buf)
    return [x.strip() for x in out if x.strip()]


def _country(d):
    d = re.sub(r"[(（].*?[)）]", "", d).strip()
    return d.split()[0] if d else None


def dests(raw, purpose, known):
    """목적지(나라만). 목적지 칸이 비었거나 머리글('목적지')이면 목적 글에서 나라 이름을 찾음(inferred)."""
    r = (raw or "").strip()
    if r and r != "목적지":
        return sorted({c for c in (_country(x) for x in _split_top(r)) if c}), False
    hit = [k for k in known if k in (purpose or "")]
    return sorted(set(hit)), bool(hit)


def history():
    """22대 의원 전체(사직·당적 변경 포함): ALLNAMEMBER 에서 22대 경력 있는 사람."""
    rows = api(ALLM, pSize=1000)
    if rows:
        log.append("ALLNAMEMBER 필드: " + ",".join(sorted(rows[0].keys())))
    out = defaultdict(list)
    for r in rows:
        units = " ".join(str(r.get(k) or "") for k in ("GTELT_ERACO", "ERACO", "UNITS", "UNIT_NM"))
        if "22" not in units:
            continue
        nm = r.get("NAAS_NM") or r.get("HG_NM")
        out[nm].append({"id": r.get("NAAS_CD") or r.get("MONA_CD"), "party": r.get("PLPT_NM") or r.get("POLY_NM"), "raw": r})
    keep = ("NAAS_CD", "NAAS_NM", "PLPT_NM", "GTELT_ERACO", "ELECD_NM", "ELECD_DIV_NM", "BIRDY_DT", "BRF_HST", "DTY_NM")
    json.dump({n: [{k: h["raw"].get(k) for k in keep} for h in hs] for n, hs in out.items()},
              open(os.path.join(OUT, "members_hist22.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return out


def _party_at(hist_party, date):
    """'A/B/C' 처럼 당적 이력이 있으면 마지막(현재) — 시점별 날짜가 없으면 그대로 표시"""
    return hist_party


PARTY_NORM = {"더불어민주연합": "더불어민주당"}  # 22대 총선 비례 위성정당 → 2024.5 합당
# 출장 시점 당적(공개 경력 기준, 팩트체크 필요): (이름, 이 날짜 전, 그 전 당적, 이후 당적)
PARTY_AT = [("조정식", "2026-06-06", "더불어민주당", "무소속"),   # 국회의장 당선 후 무소속(국회법 20조의2), 팩트체크 확인일
            ("김상욱", "2025-05-18", "국민의힘", "더불어민주당"),  # 국민의힘 탈당·민주당 입당, 팩트체크 확인일
            ("장경태", "2026-03-20", "더불어민주당", "무소속"),
            ("김종민", "2024-09-01", "새로운미래", "무소속")]  # 2026-08까지 무소속
PARTY_SRC = {"조정식": None, "김상욱": None,
             "장경태": "https://www.yna.co.kr/view/AKR20260320032200001",
             "김종민": "https://www.yna.co.kr/view/AKR20240901018500001"}
PARTY_NOTE = {}
ALIAS = {"천아람": "천하람"}  # 신고서 오타(팩트체크 확인)
FIXED = {("박지원", "2025-07-27"): "8BF5855P"}  # 1942년생(더불어민주당). 1987년생은 2026-06-03 당선이라 출장 당시 의원 아님
NOTE_RAW = {"이준영": "이준석 오타 가능성(미확인) — 같은 신고서 PN에 이준석이 따로 적혀 있음"}
NAMESAKE_HINT = {"박지원": "22대 동명이인 2명(1942년생 전남 해남·완도·진도 / 1987년생 전북 군산·김제·부안을)"}


def _start(d):
    m = re.search(r"(20\d\d)\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})", d or "")
    return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else None


def party_at(name, party, date):
    party = (party or "").split("/")[-1].strip() or None  # 역대 당적 이력 'A/B/C' → 마지막(22대)
    party = PARTY_NORM.get(party, party)
    for n, cut, before, after in PARTY_AT:
        if n == name and date:
            return (before if date < cut else after), "출장 시점 당적"
    return party, "출장 시점 당적(당적 변경 기록 없음)" if name not in PARTY_NOTE else "현재 당적(출장 시점 확인 필요)"


SEAT_SRC = "members.json(열린국회정보 API nwvrqwxyaytdsfvhu)"
SEAT_DAY = datetime.now(KST).strftime("%Y-%m-%d")


def write_party_changes():
    with open(os.path.join(OUT, "party_changes.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["name", "change_date", "before", "after", "source"])
        for n, cut, b, a in PARTY_AT: w.writerow([n, cut, b, a, PARTY_SRC.get(n) or "팩트체크 확인(출처 미기재)"])


def collect_trips(members):
    write_party_changes()
    rows = api(TRIP, UNIT_CD="100022", pSize=1000)
    if rows:
        log.append("국외활동 필드: " + ",".join(sorted(rows[0].keys())))
    cur = defaultdict(list)
    for m in members: cur[m["name"]].append(m)
    hist = history()
    known = set()
    for r in rows:
        if (r.get("DSTN_NM") or "").strip() not in ("", "목적지"):
            known |= {c for c in (_country(x) for x in _split_top(r["DSTN_NM"])) if c}
    LEAD = next((k for k in ("LEADER", "CHIEF_NM", "LDR_NM", "HEAD_NM", "RPRS_NM") if rows and k in rows[0]), None)
    trips, unmatched = [], defaultdict(int)
    for i, r in enumerate(rows):
        names = [n.strip() for n in _split_top(r.get("PN") or "")]
        dst, inferred = dests(r.get("DSTN_NM"), r.get("PURP_RSON"), known)
        lead = (r.get(LEAD) or "").strip() if LEAD else (names[0] if names else None)
        for n0 in names:
            n = ALIAS.get(n0, n0)
            ms, how = cur.get(n, []), ("현직" if n == n0 else "오타 보정")
            fx = FIXED.get((n, _start(r.get("SCH_DYS"))))
            if fx:
                ms = [{"id": h["id"], "party": h["party"], "name": n} for h in hist.get(n, []) if h["id"] == fx]; how = "동명이인 판별"
            if len(ms) != 1 and not fx:
                hs = hist.get(n, [])
                ms = [{"id": h["id"], "party": h["party"], "name": n} for h in hs] if len(hs) == 1 else ms
                how = "22대 이력" if len(hs) == 1 else ("동명이인" if len(ms) > 1 or len(hs) > 1 else "미매칭")
            ok = len(ms) == 1
            if not ok:
                unmatched[n] += 1
            pty, basis = party_at(n, ms[0]["party"], _start(r.get("SCH_DYS"))) if ok else (None, None)
            trips.append({"trip_id": i, "name": n, "member_id": ms[0]["id"] if ok else None,
                          "party": pty, "party_basis": basis, "match": how if ok or how != "현직" else "미매칭", "name_raw": n0, "party_source": PARTY_SRC.get(n), "note": (NOTE_RAW.get(n) or NAMESAKE_HINT.get(n)) if not ok else PARTY_NOTE.get(n), "start": _start(r.get("SCH_DYS")),
                          "is_leader": n == lead, "dest": dst, "dest_inferred": inferred, "dest_label": "목적 문구로 추정" if inferred else None, "dest_raw": r.get("DSTN_NM"),
                          "dates": r.get("SCH_DYS"), "purpose": r.get("PURP_RSON"), "funder": re.sub(r"\s+", " ", r.get("EXPNS_SUPPT_INST_NM") or "").strip() or None,
                          "report": r.get("REPORT_YN"), "report_label": "신고 당시 결과보고서 유/무", "src": BASE + TRIP})
    json.dump({"count_raw": len(rows), "leader_field": LEAD or "없음(PN 첫 이름을 대표로 봄)", "unmatched": dict(unmatched), "trips": trips},
              open(os.path.join(OUT, "trips_raw.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    by_m, by_l, by_p, by_d = defaultdict(int), defaultdict(int), defaultdict(int), defaultdict(int)
    fund = defaultdict(set)
    for t in trips:
        k = (t["name"], t["party"] or "미매칭")
        by_m[k] += 1; by_p[t["party"] or "미매칭"] += 1; fund[k].add(t["funder"] or "")
        if t["is_leader"]: by_l[k] += 1
    seen = set()
    for t in trips:
        if t["trip_id"] in seen: continue
        seen.add(t["trip_id"])
        for d in t["dest"]: by_d[d] += 1
    seats = defaultdict(int)
    for m in members: seats[m["party"]] += 1
    import csv
    def wcsv(fn, head, items):
        with open(os.path.join(OUT, fn), "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f); w.writerow(head); w.writerows(items)
    wcsv("trips_by_member.csv", ["name", "party", "참가 횟수(동행 포함)", "신고서 첫 번째 기재 의원", "funders"],
         sorted(((a, b, c, by_l.get((a, b), 0), " / ".join(sorted(x for x in fund[(a, b)] if x))) for (a, b), c in by_m.items()), key=lambda x: (-x[2], x[0])))
    wcsv("trips_by_party.csv", ["party", "참가 횟수(동행 포함)", "현재 의석", "의석당 참가 횟수(현재 의석 기준 근사치)", "의석 출처", "의석 기준일"],
         sorted(((p, c, seats.get(p, 0), round(c / seats[p], 2) if seats.get(p) else None, SEAT_SRC, SEAT_DAY) for p, c in by_p.items()), key=lambda x: -x[1]))
    wcsv("trips_top_dest.csv", ["destination", "reports"], sorted(by_d.items(), key=lambda x: -x[1])[:10])
    log.append(f"국외활동: 신고 {len(rows)}건, 참가 {len(trips)}건, 미매칭 {sum(unmatched.values())}건")
    return trips


def main():
    os.makedirs(OUT, exist_ok=True)
    seed = json.load(open(SEED, encoding="utf-8"))
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
    old = {}
    p = os.path.join(OUT, "members.json")
    if os.path.exists(p):
        old = json.load(open(p, encoding="utf-8"))
        old["members"] = list({m["id"]: m for m in old.get("members", [])}.values())
    rows = api("nwvrqwxyaytdsfvhu")
    members = [{"id": r.get("MONA_CD"), "name": r.get("HG_NM"), "party": r.get("POLY_NM"), "district": r.get("ORIG_NM"),
                "elect": r.get("ELECT_GBN_NM"), "reele": r.get("REELE_GBN_NM"), "cmits": r.get("CMITS"),
                "office": "국회의원회관 " + (r.get("ASSEM_ADDR") or "").replace("의원회관", "").strip(),
                "region": sido_of(r.get("ORIG_NM")) or "서울 영등포구(비례대표)",
                "src": BASE + "nwvrqwxyaytdsfvhu"} for r in {x.get("MONA_CD"): x for x in rows}.values() if r.get("HG_NM")]
    if not AK:
        log.append(f"의원 명단: 인증키 없이 {len(members)}명만 받음 → ASSEMBLY_KEY 필요(전체 {299}명 중)")
    if len(members) < len(old.get("members", [])):  # sample 키 등으로 줄어들면 이전 명단 유지
        members = old["members"]; log.append("의원 명단: 새로 받은 건이 적어 이전 명단 유지")
    trips = collect_trips(members)  # 국외활동 신고(해외출장)
    allow = {a["year"]: a for a in seed["allowance"] if a.get("amount")}
    flows = []
    y = max(allow) if allow else None
    for m in members:
        if y:
            flows.append({"kind": "수당·경비(지급기준)", "year": y, "amount": allow[y]["amount"], "basis": "1인 연간 지급기준(실수령액 아님)",
                          "from": NA, "to": {"name": f"{m['name']} 의원", "party": m["party"], "region": m["region"]},
                          "src": allow[y]["src"], "status": "팩트체크 전"})
    by_party = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for s in seed["party_subsidy"]:
        for party, amt in s["by_party"].items():
            by_party[party][s["year"]][s["kind"]] += amt
            flows.append({"kind": s["kind"], "year": s["year"], "period": s.get("period"), "amount": amt, "from": NEC,
                          "to": {"name": f"{party} 중앙당", "party": party, "region": "서울"},
                          "src": s["src"], "status": "팩트체크 전"})
    mp = defaultdict(int)
    for m in members:
        mp[m["party"]] += 1
    parties = [{"party": k, "seats": mp.get(k, 0), "years": {yy: dict(v) for yy, v in ys.items()},
                "total": sum(sum(v.values()) for v in ys.values())} for k, ys in by_party.items()]
    for k, n in mp.items():
        if k not in by_party:
            parties.append({"party": k, "seats": n, "years": {}, "total": 0})
    parties.sort(key=lambda x: -x["total"])
    years = defaultdict(lambda: defaultdict(int))
    for f in flows:
        years[f["year"]][f["kind"]] += f["amount"] or 0
    w = lambda n, o: json.dump(o, open(os.path.join(OUT, n), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    tc = Counter(t.get("member_id") for t in trips if t.get("member_id"))
    tl = Counter(t.get("member_id") for t in trips if t.get("member_id") and t.get("is_leader"))
    for m in members:
        m["profile"] = BASE + "nwvrqwxyaytdsfvhu?Type=json&MONA_CD=" + (m.get("id") or "")
        m["trips"] = tc.get(m.get("id"), 0); m["trips_lead"] = tl.get(m.get("id"), 0)
    w("members.json", {"updated": now, "count": len(members), "members": members, "trips": trips})
    w("parties.json", {"updated": now, "parties": parties, "rules": seed["party_rules"]})
    w("flows.json", {"updated": now, "count": len(flows), "flows": flows,
                     "note": "from/to 지역은 시·도 단위. 업체명은 공개 필드에 넣지 않음(내부 _vendor만)."})
    w("years.json", {"updated": now, "years": {k: dict(v) for k, v in sorted(years.items())}})
    w("support.json", {"updated": now, "allowance": seed["allowance"], "office_support": seed["office_support"]})
    w("projects.json", {"updated": now, "special_activity": seed["special_activity"], "national_projects": seed["national_projects"]})  # 대북 항목은 seed.json에서만 관리(수동 팩트체크값)
    w("index.json", {"updated": now, "assembly_key": bool(AK), "seats": {"source": SEAT_SRC, "date": SEAT_DAY, "label": "현재 의석 기준 근사치"}, "log": log,
                     "files": ["trips_raw", "members", "parties", "flows", "years", "support", "projects"],
                     "missing": [
                         "정당·의원 정치자금 회계보고(후원금 모금액·지출처): 선관위 정치자금 공개시스템은 Open API 없음 — 파일 내려받기/정보공개청구 필요",
                         "의원별 실제 수령액·의원실 집행액: 공개되지 않음(지급기준만 공개)",
                         "국회 특수활동비·업무추진비 집행내역: 정보공개청구 결과 필요",
                         "대북 차관: 팩트체크 비서 확인 대기(틀만)"]})
    print("\n".join(log)); print(f"의원 {len(members)}명, 흐름 {len(flows)}건, 정당 {len(parties)}곳")


if __name__ == "__main__":
    main()
