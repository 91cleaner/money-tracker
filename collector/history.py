"""계약 차수별 이력·공동도급 참여 업체(지분): data/chg.json (키: 계약번호, 차수 제외).

출처: 조달청 나라장터 계약정보서비스 getCntrctInfoList{Cnstwk|Servc|Thng}PPSSrch (조회구분 2 = 확정계약번호).
확정계약번호 = 계약번호 + 2자리 차수이므로 차수마다 1건씩 조회한다.
개발계정 하루 1,000건이라 DAY_CAP(기본 800) 안에서, 금액이 큰 계약부터 조금씩 채운다.
업체목록에서 업체 이름·역할·단독/공동·지분만 쓰고, 대표자 이름과 사업자번호는 버린다(사업자번호는 해시만).
"""
import hashlib, json, os, time

BASE = "https://apis.data.go.kr/1230000/ao/CntrctInfoService/"
OP = {"공사": "getCntrctInfoListCnstwkPPSSrch", "용역": "getCntrctInfoListServcPPSSrch", "물품": "getCntrctInfoListThngPPSSrch"}
DAY_CAP = int(os.environ.get("CHG_DAY_CAP", "800"))
PER_RUN = int(os.environ.get("CHG_PER_RUN", "60"))
BUDGET = int(os.environ.get("CHG_BUDGET", "600"))  # 이 단계 시간 상한(초)
JV_MIN = int(os.environ.get("CHG_JV_MIN", "1000000000"))  # 1차 계약도 업체목록(공동도급)을 볼 최소 금액


def hid(s):
    return hashlib.sha1(str(s).encode()).hexdigest()[:16]  # collect.hid 와 같은 방식


def corps(s, mask):
    out = []
    for seg in (s or "").strip().strip("[]").split("],["):
        f = seg.strip("[]").split("^")
        if len(f) < 7:
            continue
        b = f[9].replace("-", "") if len(f) > 9 else ""
        try:
            sh = float(f[6])
        except ValueError:
            sh = None
        out.append({"name": mask(f[3]), "role": f[1] or None, "joint": f[2] == "공동", "share": sh, "id": hid(b) if b else None})
    return out


def fetch_ver(get_json, items_of, kind, dno):
    r = get_json(BASE + OP[kind], {"inqryDiv": 2, "dcsnCntrctNo": dno, "numOfRows": 5, "pageNo": 1}, tries=3, timeout=30)
    items, _ = items_of(r)
    if not items:
        return None
    it = items[0]
    amt = lambda k: int(float(it[k])) if str(it.get(k) or "").replace(".", "").isdigit() else None
    return {"ord": dno[-2:], "date": (it.get("cntrctCnclsDate") or "")[:10] or None, "tot": amt("totCntrctAmt"), "this": amt("thtmCntrctAmt"),
            "lt": it.get("lngtrmCtnuDivNm") or None, "prd": it.get("cntrctPrd") or None, "corps": it.get("corpList")}


def _save(path, cache):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(cache.items())), f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


class Quota(Exception):
    pass


def run(data, rows, state, get_json, items_of, mask, now):
    """rows: 모든 시의 계약 행. 돌려주는 값: chg 캐시(dict)."""
    path = os.path.join(data, "chg.json")
    try:
        cache = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}
    today = now.strftime("%Y-%m-%d")
    st = state.setdefault("chg", {})
    if st.get("day") != today:
        st.update(day=today, calls=0)
    todo = []
    for r in rows:
        if r.get("kind") not in OP or not r.get("no") or not r.get("ord"):
            continue
        c = cache.get(r["no"]) or {}
        have = {v["ord"] for v in c.get("v", [])}
        cur = int(r["ord"])
        want = [f"{i:02d}" for i in range(1, cur + 1)] if cur > 1 else ([r["ord"]] if r["amount"] >= JV_MIN else [])
        miss = [o for o in want if o not in have and o not in c.get("none", [])]
        if miss:
            todo.append((0 if cur > 1 else 1, -r["amount"], r, miss))
    todo.sort(key=lambda x: x[:2])
    n = 0
    t0 = time.monotonic()
    try:
        for _, _, r, miss in todo:
            for o in miss:
                if n >= PER_RUN or st["calls"] >= DAY_CAP or time.monotonic() - t0 > BUDGET:
                    raise Quota()
                st["calls"] += 1; n += 1
                try:
                    v = fetch_ver(get_json, items_of, r["kind"], r["no"] + o)
                except Exception as e:
                    msg = str(e)
                    if any(s in msg for s in ("403", "SERVICE_KEY", "LIMITED_NUMBER", "등록되지")):
                        st["calls"] -= 1  # 아직 활성화 전이거나 한도 초과: 이번 실행은 멈춤(다음 실행에서 다시 시도)
                        print(f"::warning::계약정보서비스 사용 불가: {type(e).__name__}", flush=True)
                        raise Quota()
                    continue
                c = cache.setdefault(r["no"], {"v": []})
                if v is None:
                    c.setdefault("none", []).append(o)
                else:
                    cs = v.pop("corps")
                    if o == max(o for o in [o] + [x["ord"] for x in c["v"]]):
                        c["corps"] = corps(cs, mask)
                    c["v"] = sorted([x for x in c["v"] if x["ord"] != o] + [v], key=lambda x: x["ord"])
                c["at"] = today
                if n % 20 == 0:
                    _save(path, cache); print(f"  차수 이력 {n}건…", flush=True)
                time.sleep(0.15)
    except Quota:
        pass
    _save(path, cache)
    print(f"계약 차수 이력 {n}건 조회, 남은 계약 {max(0, len(todo))}건 (오늘 {st['calls']}건)", flush=True)
    return cache
