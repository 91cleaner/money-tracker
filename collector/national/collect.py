"""나라 세금(정치인·정당) 섹션 수집: data/national/*.json
- 열린국회정보 API(ASSEMBLY_KEY, 없으면 sample 키=5건 제한)로 국회의원 명단·정당·지역구
- collector/national/seed.json: 국회사무처 수당 지급기준·의원실 지원경비, 선관위 국고보조금(공식 발표값)
- 돈 흐름(flows): 기록마다 준 쪽(from)·받은 쪽(to)과 지역. 업체명은 공개 필드에 두지 않음(_vendor 내부 필드만).
키 값은 출력하지 않는다."""
import json, os, re, time, urllib.request, urllib.parse
from collections import defaultdict
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "national")
SEED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed.json")
AK = os.environ.get("ASSEMBLY_KEY", "").strip()
BASE = "https://open.assembly.go.kr/portal/openapi/"
KST = timezone(timedelta(hours=9))
NA = {"name": "국회사무처", "region": "서울 영등포구", "addr": "서울특별시 영등포구 의사당대로 1"}
NEC = {"name": "중앙선거관리위원회(국고)", "region": "경기 과천시", "addr": "경기도 과천시 홍촌말로 44"}
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
        if not body or len(rows) >= (total or 0) or q["pIndex"] > 50:
            break
        q["pIndex"] += 1; time.sleep(0.3)
    log.append(f"{code}: {len(rows)}/{total}건" + ("" if AK else " (인증키 없이)"))
    return rows


def sido_of(orig):
    for k, v in SIDO.items():
        if (orig or "").startswith(k):
            return v
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    seed = json.load(open(SEED, encoding="utf-8"))
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")
    old = {}
    p = os.path.join(OUT, "members.json")
    if os.path.exists(p):
        old = json.load(open(p, encoding="utf-8"))
    rows = api("nwvrqwxyaytdsfvhu")
    members = [{"id": r.get("MONA_CD"), "name": r.get("HG_NM"), "party": r.get("POLY_NM"), "district": r.get("ORIG_NM"),
                "elect": r.get("ELECT_GBN_NM"), "reele": r.get("REELE_GBN_NM"), "cmits": r.get("CMITS"),
                "office": "국회의원회관 " + (r.get("ASSEM_ADDR") or "").replace("의원회관", "").strip(),
                "region": sido_of(r.get("ORIG_NM")) or "서울 영등포구(비례대표)",
                "src": BASE + "nwvrqwxyaytdsfvhu"} for r in rows if r.get("HG_NM")]
    if len(members) < len(old.get("members", [])):  # sample 키 등으로 줄어들면 이전 명단 유지
        members = old["members"]; log.append("의원 명단: 새로 받은 건이 적어 이전 명단 유지")
    # 국외활동 신고(해외출장) — 코드가 확인되면 채움
    trips = []
    allow = {a["year"]: a for a in seed["allowance"] if a.get("amount")}
    flows = []
    y = max(allow) if allow else None
    for m in members:
        if y:
            flows.append({"kind": "수당·경비(지급기준)", "year": y, "amount": allow[y]["amount"], "basis": "1인 연간 지급기준(실수령액 아님)",
                          "from": NA, "to": {"name": f"{m['name']} 의원", "party": m["party"], "region": m["region"], "addr": m["office"]},
                          "src": allow[y]["src"], "status": "팩트체크 전"})
    by_party = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for s in seed["party_subsidy"]:
        for party, amt in s["by_party"].items():
            by_party[party][s["year"]][s["kind"]] += amt
            flows.append({"kind": s["kind"], "year": s["year"], "period": s.get("period"), "amount": amt, "from": NEC,
                          "to": {"name": f"{party} 중앙당", "party": party, "region": "서울", "addr": None},
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
    w("members.json", {"updated": now, "count": len(members), "members": members, "trips": trips})
    w("parties.json", {"updated": now, "parties": parties, "rules": seed["party_rules"]})
    w("flows.json", {"updated": now, "count": len(flows), "flows": flows,
                     "note": "from/to 지역은 시·도 단위. 업체명은 공개 필드에 넣지 않음(내부 _vendor만)."})
    w("years.json", {"updated": now, "years": {k: dict(v) for k, v in sorted(years.items())}})
    w("support.json", {"updated": now, "allowance": seed["allowance"], "office_support": seed["office_support"]})
    w("projects.json", {"updated": now, "special_activity": seed["special_activity"], "national_projects": seed["national_projects"]})
    w("index.json", {"updated": now, "assembly_key": bool(AK), "log": log,
                     "files": ["members", "parties", "flows", "years", "support", "projects"],
                     "missing": [
                         "의원별 해외출장(국외활동 신고): 열린국회정보 인증키(ASSEMBLY_KEY) 필요",
                         "정당·의원 정치자금 회계보고(후원금 모금액·지출처): 선관위 정치자금 공개시스템은 Open API 없음 — 파일 내려받기/정보공개청구 필요",
                         "의원별 실제 수령액·의원실 집행액: 공개되지 않음(지급기준만 공개)",
                         "국회 특수활동비·업무추진비 집행내역: 정보공개청구 결과 필요",
                         "대북 차관: 팩트체크 비서 확인 대기(틀만)"]})
    print("\n".join(log)); print(f"의원 {len(members)}명, 흐름 {len(flows)}건, 정당 {len(parties)}곳")


if __name__ == "__main__":
    main()
