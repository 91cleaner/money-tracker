"""과거 계약 거꾸로 채우기: data/past/<업체id>.json, 진행 위치는 state.json 의 "bf".

출처: 조달청 나라장터 계약정보서비스 getCntrctInfoList{Cnstwk|Servc|Thng}PPSSrch (조회구분 1 = 계약체결일, 하루씩).
수집 기간 바로 전날부터 하루씩 과거로 간다. 하루 호출 BF_DAY_CAP(기본 150) + history.py DAY_CAP(650) = 800 < 1,000.
남기는 계약: 85개 시 수요기관 계약 전부 + 순위(rank.json)에 있는 업체가 낀 계약.
업체 이름·역할·지분만 쓰고 대표자 이름·담당 공무원·사업자번호(해시만)는 버린다.
"""
import json, os, time
from datetime import datetime, timedelta

import history
from cities import CITIES, city_of

KINDS = ["공사", "용역", "물품"]
DAY_CAP = int(os.environ.get("BF_DAY_CAP", "150"))
PER_RUN = int(os.environ.get("BF_PER_RUN", "8"))
ROWS = int(os.environ.get("BF_ROWS", "500"))
BUDGET = int(os.environ.get("BF_BUDGET", "420"))
STOP = os.environ.get("BF_STOP", "2023-01-01")  # 여기까지 가면 멈춤
NAMES = {c["slug"]: c["short"] if "short" in c else c["name"] for c in CITIES}
TITLE = {"공사": "cnstwkNm", "용역": "cntrctNm", "물품": "cntrctNm"}


def num(x):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return None


def _mask_addr(t):
    from collect import mask_addr  # 화면 데이터 제목의 번지만 가림(원문은 url)
    return mask_addr(t)


def row_of(it, kind, mask):
    dm = (it.get("dminsttList") or "").strip("[]").split("],[")[0].split("^")
    inst = dm[2] if len(dm) > 2 else (it.get("cntrctInsttNm") or "")
    slug = city_of(inst)
    m = history.corps(it.get("corpList"), mask)
    dno = it.get("dcsnCntrctNo") or ""
    return {"no": dno[:-2] if len(dno) > 2 else dno, "ord": dno[-2:] if len(dno) > 2 else None,
            "date": (it.get("cntrctCnclsDate") or "")[:10], "slug": slug, "city": NAMES.get(slug), "inst": inst,
            "title": _mask_addr(it.get(TITLE[kind]) or it.get("cntrctNm") or it.get("cnstwkNm") or ""), "kind": kind,
            "tot": num(it.get("totCntrctAmt")), "this": num(it.get("thtmCntrctAmt")), "lt": it.get("lngtrmCtnuDivNm") or None,
            "m": [{"name": x["name"], "share": x["share"], "id": x["id"], "role": x["role"]} for x in m],
            "url": it.get("cntrctDtlInfoUrl") or None}


def run(data, state, get_json, items_of, mask, now, start_day):
    st = state.setdefault("bf", {})
    today = now.strftime("%Y-%m-%d")
    if st.get("calls_day") != today:
        st.update(calls_day=today, calls=0)
    if not st.get("cursor"):
        st.update(cursor=start_day, ki=0, page=1, newest=start_day)
    try:
        rank = {v["id"] for v in json.load(open(os.path.join(data, "rank.json"), encoding="utf-8")).get("vendors", []) if v.get("id")}
    except (OSError, ValueError):
        rank = set()
    pdir = os.path.join(data, "past"); os.makedirs(pdir, exist_ok=True)
    add, n, fails, t0 = {}, 0, 0, time.monotonic()
    while st["cursor"] >= STOP and n < PER_RUN and st["calls"] < DAY_CAP and time.monotonic() - t0 < BUDGET:
        kind, d = KINDS[st["ki"]], st["cursor"].replace("-", "")
        st["calls"] += 1; n += 1
        try:
            r = get_json(history.BASE + history.OP[kind], {"inqryDiv": 1, "inqryBgnDate": d, "inqryEndDate": d, "numOfRows": ROWS, "pageNo": st["page"]}, tries=3, timeout=90)
            items, total = items_of(r); fails = 0
        except Exception as e:
            msg = str(e)
            if any(s in msg for s in ("SERVICE_KEY", "LIMITED_NUMBER", "등록되지", "인증")):
                st["calls"] -= 1; print(f"::warning::과거 계약 채우기 중단(키·한도): {type(e).__name__}", flush=True); break
            fails += 1
            if fails >= 2:
                print("::warning::과거 계약 채우기: 연속 네트워크 오류로 이번 실행 멈춤(다음 실행에서 같은 위치부터)", flush=True); break
            continue
        for it in items:
            x = row_of(it, kind, mask)
            ids = {m["id"] for m in x["m"] if m["id"]}
            if x["slug"] or ids & rank:
                for i in ids:
                    add.setdefault(i, []).append(x)
        if st["page"] * ROWS < total:
            st["page"] += 1
        else:
            st["page"] = 1; st["ki"] += 1
            if st["ki"] >= len(KINDS):
                st["ki"] = 0; st["days_done"] = st.get("days_done", 0) + 1
                st["oldest"] = st["cursor"]
                st["cursor"] = (datetime.strptime(st["cursor"], "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        st["calls_total"] = st.get("calls_total", 0) + 1
        time.sleep(0.3)
    for i, rows in add.items():
        p = os.path.join(pdir, i + ".json")
        try:
            old = json.load(open(p, encoding="utf-8"))["rows"]
        except (OSError, ValueError, KeyError):
            old = []
        by = {r["no"]: r for r in old}
        for r in rows:  # 같은 계약은 가장 최근 차수만
            o = by.get(r["no"])
            if not o or (r["ord"] or "") >= (o["ord"] or ""):
                by[r["no"]] = r
        out = sorted(by.values(), key=lambda r: (r["date"], r["no"]), reverse=True)
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"id": i, "rows": out}, f, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, p)
    meta = {"updated": now.isoformat(), "ids_url": "_ids.json", "newest": st.get("newest"), "oldest": st.get("oldest"), "days_done": st.get("days_done", 0),
            "source": "조달청 나라장터 계약정보서비스(공공데이터포털 15129427)"}
    with open(os.path.join(pdir, "_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)
    print(f"과거 계약 채우기: 호출 {n}건(오늘 {st['calls']}), 위치 {st['cursor']} {KINDS[st['ki']]} p{st['page']}, 업체 {len(add)}곳 갱신", flush=True)


def write_ids(data):
    """data/past/*.json 실제 파일 기준 업체 id 목록(_ids.json). 화면이 없는 파일을 요청해 404 나는 걸 막는다. 매 실행 갱신."""
    pdir = os.path.join(data, "past")
    if not os.path.isdir(pdir):
        return 0
    ids = sorted(f[:-5] for f in os.listdir(pdir) if f.endswith(".json") and not f.startswith("_"))
    tmp = os.path.join(pdir, "_ids.json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(ids, f, separators=(",", ":"))
    os.replace(tmp, os.path.join(pdir, "_ids.json"))
    mp = os.path.join(pdir, "_meta.json")
    try:
        meta = json.load(open(mp, encoding="utf-8"))
    except (OSError, ValueError):
        meta = {}
    if meta.get("ids_url") != "_ids.json":
        meta["ids_url"] = "_ids.json"
        with open(mp, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False)
    return len(ids)
