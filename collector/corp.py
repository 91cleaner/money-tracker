"""업체 기본 정보(설립일·나라장터 등록일·등록 업종) 캐시: data/corp.json (키는 사업자번호 해시).

출처: 조달청 나라장터 사용자정보 서비스 getPrcrmntCorpBasicInfo02 / getPrcrmntCorpIndstrytyInfo02.
업체 단위 사실만 저장한다. 대표자 이름·연락처·사업자번호·상세 주소는 저장하지 않는다.
대상: 전국 순위 상위 TOP_N 업체 + 데이터상 이상 징후에 들어간 업체. 실행마다 MAX_PER_RUN 업체, 하루 DAY_CAP 요청까지만.
"""
import json, os, time
from datetime import datetime

BASE = "https://apis.data.go.kr/1230000/ao/UsrInfoService02/"
TOP_N = int(os.environ.get("CORP_TOP_N", "300"))
MAX_PER_RUN = int(os.environ.get("CORP_MAX_PER_RUN", "60"))
DAY_CAP = int(os.environ.get("CORP_DAY_CAP", "3000"))  # 서비스 하루 10,000건 한도 안에서 넉넉히
REFRESH_DAYS = 180


def _d(v):
    v = (v or "").strip()[:10]
    return v if len(v) == 10 and not v.startswith("1900") else None


def targets(data):
    out = []
    try:
        out += [v["id"] for v in json.load(open(os.path.join(data, "rank.json")))["vendors"][:TOP_N]]
    except (OSError, ValueError, KeyError):
        pass
    vdir = os.path.join(data, "vendor")
    for f in sorted(os.listdir(vdir)) if os.path.isdir(vdir) else []:
        try:
            d = json.load(open(os.path.join(vdir, f), encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if any(a.get("kind") != "big" for a in d.get("alerts", [])):
            out.append(d["id"])
    return [k for k in dict.fromkeys(out) if not k.startswith("n")]  # 해시 id(사업자번호 있음)만


def fetch_one(get_json, items_of, bz):
    r = get_json(BASE + "getPrcrmntCorpBasicInfo02", {"inqryDiv": 3, "bizno": bz, "numOfRows": 1, "pageNo": 1}, tries=2, timeout=20)
    items, _ = items_of(r)
    info = {}
    if items:
        it = items[0]
        info = {"opbiz": _d(it.get("opbizDt")), "rgst": _d(it.get("rgstDt")), "bsns": it.get("corpBsnsDivNm") or None,
                "emp": int(it["emplyeNum"]) if str(it.get("emplyeNum") or "").isdigit() else None, "hq": it.get("hdoffceDivNm") or None}
    r = get_json(BASE + "getPrcrmntCorpIndstrytyInfo02", {"inqryDiv": 1, "bizno": bz, "numOfRows": 100, "pageNo": 1}, tries=2, timeout=20)
    items, _ = items_of(r)
    seen, inds = set(), []
    for it in items:
        n = (it.get("indstrytyNm") or "").strip()
        if not n or n in seen:
            continue
        seen.add(n)
        inds.append({"n": n, "d": _d(it.get("rgstDt")), "rep": it.get("rprsntIndstrytyYn") == "Y"})
    inds.sort(key=lambda x: (not x["rep"], x["d"] or "9999"))
    info["inds"] = inds
    return info


def need(data, cache, now):
    lim = now.strftime("%Y-%m-%d")
    out = []
    for k in targets(data):
        c = cache.get(k)
        if not c or (datetime.strptime(c["at"], "%Y-%m-%d") - now.replace(tzinfo=None)).days < -REFRESH_DAYS:
            out.append(k)
    return out


def run(data, biz_by_hash, state, get_json, items_of, now):
    path = os.path.join(data, "corp.json")
    try:
        cache = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}
    today = now.strftime("%Y-%m-%d")
    st = state.setdefault("corp", {})
    if st.get("day") != today:
        st.update(day=today, calls=0)
    todo = need(data, cache, now)
    n = 0
    for k in todo:
        bz = biz_by_hash.get(k)
        if not bz:
            continue
        if n >= MAX_PER_RUN or st["calls"] + 2 > DAY_CAP:
            break
        st["calls"] += 2; n += 1
        try:
            info = fetch_one(get_json, items_of, bz)
        except Exception as e:
            print(f"::warning::업체 정보 조회 실패: {type(e).__name__}", flush=True)
            continue
        info["at"] = today
        cache[k] = info
        time.sleep(0.2)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(cache.items())), f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)
    left = [k for k in need(data, cache, now)]
    print(f"업체 정보 {n}곳 조회, 남은 대상 {len(left)}곳 (오늘 {st['calls']}건 요청)", flush=True)
    return left
