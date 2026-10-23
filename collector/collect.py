"""나라장터 공개 계약 데이터를 시 단위로 모아 data/ 아래 JSON으로 저장.

환경변수 DATA_GO_KR_KEY: 공공데이터포털 일반 인증키(디코딩된 키).
처음 실행하면 최근 BACKFILL_DAYS일, 그 뒤로는 최근 RECENT_DAYS일만 다시 읽어 새 계약을 더한다.
"""
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))
from cities import CITIES, city_of, legacy
import share
from privacy import mask, loc, kor, korify, is_fest, fest_title, fest_tag, FEST_CAT
import flows
import jv
import vendors_agg
import corp
import history
import backfill

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")
KST = timezone(timedelta(hours=9))
KEY = os.environ.get("DATA_GO_KR_KEY", "").strip()
BACKFILL_DAYS = int(os.environ.get("BACKFILL_DAYS", "30"))
RECENT_DAYS = int(os.environ.get("RECENT_DAYS", "3"))
KEEP_DAYS = 90
MAX_VENDOR_LOOKUPS = int(os.environ.get("MAX_VENDOR_LOOKUPS", "300"))
LOOKUP_TIMEOUT = int(os.environ.get("LOOKUP_TIMEOUT", "15"))  # 업체 조회 1건당 대기 시간(초)
LOOKUP_BUDGET = int(os.environ.get("LOOKUP_BUDGET", "1200"))  # 업체 조회 전체 시간 상한(초), 40분 제한 안에 끝내기 위함

CNTRCT_URL = "https://apis.data.go.kr/1230000/ao/PubDataOpnStdService/getDataSetOpnStdCntrctInfo"
CORP_BASE = "https://apis.data.go.kr/1230000/ao/UsrInfoService02/"
CORP_OPS = ["getPrcrmntCorpBasicInfo02", "getPrcrmntCorpBasicInfo"]

# 응답 필드 이름이 서비스마다 조금씩 달라 후보를 순서대로 본다.
F = {
    "id": ["untyCntrctNo", "cntrctNo", "dcsnCntrctNo", "cntrctRefNo"],
    "title": ["cntrctNm", "cntrctNm1"],
    "amount": ["ttalCntrctAmt", "totCntrctAmt", "cntrctAmt", "thtmCntrctAmt", "cntrctAmount"],
    "date": ["cntrctCnclsDate", "cntrctCnclsDt", "cntrctDate"],
    "inst": ["dmndInsttNm", "dminsttNm", "cntrctInsttNm"],
    "vendor": ["rprsntCorpNm", "corpNm", "cntrctCorpNm"],
    "bizno": ["rprsntCorpBizrno", "corpBizrno", "bizno", "bizrno"],
    "method": ["cntrctCnclsMthdNm", "cntrctMthdNm", "cntrctMthd"],
    "kind": ["bsnsDivNm", "prcrmntDivNm", "cntrctBsnsDivNm"],
    "adrs": ["rprsntCorpAdrs", "corpAdrs"],
    "url": ["cntrctInfoUrl", "cntrctDtlInfoUrl", "dtlsInfoUrl"],
}


# 업종 분류: 계약명(과 업무 구분)에 들어 있는 낱말로 단순하게 나눈다. 위에서부터 먼저 맞는 것.
CATS = [
    ("청소", ["청소", "미화", "방역", "소독", "세척", "세탁", "분뇨", "정화조", "폐기물", "쓰레기", "환경정비"]),
    ("경비", ["경비", "보안", "경호", "주차관리", "순찰", "당직"]),
    ("시설관리", ["시설관리", "시설물", "유지관리", "유지보수", "승강기", "엘리베이터", "냉난방", "공조", "전기안전", "소방", "보수"]),
    ("건설·공사", ["공사", "건설", "포장", "도로", "정비사업", "설치", "철거", "토목", "조경"]),
    ("인쇄·홍보", ["인쇄", "홍보", "광고", "디자인", "영상", "책자", "현수막", "행사", "축제", "제작"]),
    ("용역·연구", ["연구", "용역", "조사", "설계", "컨설팅", "감리", "평가", "교육", "개발", "시스템"]),
    ("물품", ["구매", "구입", "물품", "임차", "차량", "장비", "기기", "비품", "소모품"]),
]


def category(title, kind):
    t = title or ""
    for name, words in CATS:
        if any(w in t for w in words):
            return name
    if kind and ("물품" in kind):
        return "물품"
    if kind and ("공사" in kind):
        return "건설·공사"
    return "기타"


def pick(item, field):
    for k in F[field]:
        v = item.get(k)
        if v not in (None, ""):
            return v
    return None


class ApiError(RuntimeError):
    """API가 오류 코드를 돌려준 경우 (인증키 문제 등). 다시 시도해도 소용없음."""


def api_error_of(body):
    """응답 본문에서 오류 코드·메시지를 찾는다. 정상이면 None."""
    import re
    try:
        resp = json.loads(body)
    except ValueError:
        resp = None
    if isinstance(resp, dict):
        head = ((resp.get("response") or {}).get("header") or resp.get("header") or {})
        code = str(head.get("resultCode") or "")
        if code and code not in ("00", "0", "0000"):
            return f"resultCode={code} resultMsg={head.get('resultMsg')}"
        return None
    # JSON이 아니면 XML 오류 응답인 경우가 많다 (인증키 오류는 type=json이어도 XML로 옴)
    got = {}
    for tag in ("returnReasonCode", "returnAuthMsg", "errMsg", "resultCode", "resultMsg"):
        m = re.search(rf"<{tag}>(.*?)</{tag}>", body, re.S)
        if m:
            got[tag] = m.group(1).strip()
    if got:
        return " ".join(f"{k}={v}" for k, v in got.items())
    return "JSON이 아닌 응답: " + body[:200].replace("\n", " ")


def get_json(url, params, tries=3, timeout=60):
    q = urllib.parse.urlencode({**params, "ServiceKey": KEY, "type": "json"})
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(url + "?" + q, timeout=timeout) as r:
                body = r.read().decode("utf-8", "replace")
        except Exception as e:  # 네트워크 오류는 잠시 쉬고 다시
            last = e
            if i + 1 < tries:
                time.sleep(3 * (i + 1))
            continue
        err = api_error_of(body)
        if err:
            hint = " (인증키가 틀렸거나 아직 활성화되지 않았을 수 있습니다. 공공데이터포털에서 '디코딩' 키를 넣었는지, 활용신청이 승인됐는지 확인하세요.)" \
                if any(w in err for w in ("SERVICE_KEY", "KEY_IS_NOT", "Code=30", "인증")) else ""
            raise ApiError(f"API 오류: {url.rsplit('/', 1)[-1]} {err}{hint}")
        return json.loads(body)
    raise RuntimeError(f"요청 실패: {url} ({last})")


def items_of(resp):
    body = (resp.get("response") or {}).get("body") or resp.get("body") or {}
    items = body.get("items") or []
    if isinstance(items, dict):
        items = items.get("item") or []
    if isinstance(items, dict):
        items = [items]
    total = int(body.get("totalCount") or 0)
    return items, total


T0 = time.monotonic()
FETCH_BUDGET = int(os.environ.get("FETCH_BUDGET", "900"))  # 계약 목록 수집 시간 상한(초)
FAILS = []  # 건너뛴 요청의 오류 메시지


def fetch_contracts(start, end):
    out, page, fails = [], 1, 0
    while True:
        if time.monotonic() - T0 > FETCH_BUDGET:
            print(f"::warning::{start:%Y-%m-%d}~{end:%Y-%m-%d} 수집 시간 상한 도달, 다음 실행에서 이어서", flush=True)
            FAILS.append("budget")
            return out
        try:
            resp = get_json(CNTRCT_URL, {"cntrctCnclsBgnDate": start.strftime("%Y%m%d"), "cntrctCnclsEndDate": end.strftime("%Y%m%d"),
                                         "numOfRows": 999, "pageNo": page})
        except Exception as e:
            print(f"::warning::{start:%Y-%m-%d}~{end:%Y-%m-%d} {page}쪽 건너뜀: {e}", flush=True)
            FAILS.append(str(e))
            fails += 1
            if isinstance(e, ApiError) or page > 200 or fails >= 2:  # 연속 실패면 서버 문제, 이 주는 다음 실행에서
                return out  # 인증 오류면 같은 요청을 반복해도 소용없음
            page += 1
            continue
        fails = 0
        items, total = items_of(resp)
        out += items
        if not items or len(out) >= total or page > 200:
            return out
        page += 1
        time.sleep(0.3)


def norm_date(v):
    s = str(v or "").replace("-", "").replace(".", "").replace("/", "")[:8]
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) == 8 and s.isdigit() else None


def to_int(v):
    try:
        return int(float(str(v).replace(",", "")))
    except Exception:
        return None


def hid(s):
    return hashlib.sha1(str(s).encode()).hexdigest()[:16]


def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(korify(obj), f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def region_from_address(adrs):
    """주소에서 시·도 + 시·군·구까지만 남긴다 (번지·상세주소는 버림)."""
    if not adrs:
        return None
    parts = str(adrs).replace(",", " ").split()
    if not parts:
        return None
    keep = [parts[0]]
    if len(parts) > 1 and parts[1][-1:] in ("시", "군", "구"):
        keep.append(parts[1])
        if len(parts) > 2 and parts[1].endswith("시") and parts[2][-1:] == "구":
            keep.append(parts[2])
    return " ".join(keep)


def lookup_regions(biznos, vendors):
    """사업자번호로 업체 소재지(시·군·구) 조회. 결과는 해시 키로만 저장.
    조회 건수(MAX_VENDOR_LOOKUPS)와 전체 시간(LOOKUP_BUDGET)에 상한이 있고, 남은 것은 다음 실행에서 이어서 조회한다.
    돌려주는 값: 아직 조회하지 못한 사업자번호 수."""
    n, t0, left = 0, time.monotonic(), 0
    for b in biznos:
        k = hid(b)
        if k in vendors:
            continue
        if n >= MAX_VENDOR_LOOKUPS or time.monotonic() - t0 > LOOKUP_BUDGET:
            left += 1
            continue
        n += 1
        region, answered = None, False
        for op in CORP_OPS:
            try:
                resp = get_json(CORP_BASE + op, {"inqryDiv": 3, "bizno": b, "numOfRows": 1, "pageNo": 1}, tries=1, timeout=LOOKUP_TIMEOUT)
            except Exception:
                continue
            answered = True
            items, _ = items_of(resp)
            if items:
                it = items[0]
                region = region_from_address(it.get("adrs")) or (it.get("rgnNm") or None)
                break
        if answered:  # 응답을 받았을 때만 저장 (네트워크 실패는 다음에 다시 시도)
            vendors[k] = {"region": region, "at": datetime.now(KST).strftime("%Y-%m-%d")}
        else:
            left += 1
        time.sleep(0.2)
    print(f"업체 주소 조회 {n}건, 남은 것 {left}건", flush=True)
    return left


def alerts_for(rows, explanations):
    out = []
    by = defaultdict(list)
    for r in rows:
        by[(r["date"], r.get("bh") or r["vendor"], r["title"])].append(r)
    for (d, _, t), rs in by.items():
        v = rs[0]["vendor"]
        if len(rs) > 1 and v:
            key = "split-" + hid(f"{d}|{v}|{t}")  # 날짜+업체+계약명 기준이라 건이 늘어도 키가 그대로
            out.append({"key": key, "kind": "split", "title": f"같은 날 같은 업체에 같은 이름 계약 {len(rs)}건",
                        "detail": f"{d} · {rs[0]['inst']} · {t} · {v}", "amount": sum(x["amount"] for x in rs), "ids": [x["id"] for x in rs]})
    for r in rows:
        m = r.get("method") or ""
        if 19_500_000 <= r["amount"] <= 22_000_000 and (not m or "수의" in m):
            out.append({"key": "thr-" + r["id"], "kind": "threshold", "title": "견적 1곳만 받아도 되는 금액선(추정가 2천만원) 근처",
                        "detail": f"{r['date']} · {r['inst']} · {r['title']} · {r['vendor']}" + (f" · {m}" if m else ""), "amount": r["amount"], "ids": [r["id"]]})
    cnt = defaultdict(list)
    for r in rows:
        if r["vendor"] and "조달청" not in r["vendor"]:
            cnt[r.get("bh") or r["vendor"]].append(r)
    for vk, rs in cnt.items():
        v = rs[0]["vendor"]
        if len(rs) >= 5:
            insts = Counter(x["inst"] for x in rs).most_common(3)
            out.append({"key": "rep-" + hid(v if v != "개인사업자" else vk), "kind": "repeat", "title": f"같은 업체 {len(rs)}건 반복 (최근 {KEEP_DAYS}일)",
                        "detail": f"{v} · " + ", ".join(i for i, _ in insts), "amount": sum(x["amount"] for x in rs), "ids": [x["id"] for x in rs][:20]})
    for r in rows:  # 변경 계약: 1차(없으면 확인된 첫 차수) 총 계약금액보다 크게 늘어난 경우 (중립 표시)
        h = r.get("hist") or []
        if r.get("orig"):
            h = [{"ord": "01", "amount": r["orig"]}]
        if h and h[0]["amount"] > 0:
            o = h[0]["amount"]; up = r["amount"] - o
            if up >= 10_000_000 and up / o >= 0.1:
                vs = [v for v in (r.get("vers") or []) if v.get("tot")]
                last = ""
                if len(vs) >= 2 and int(vs[-1]["ord"]) - int(vs[-2]["ord"]) == 1:
                    dd = vs[-1]["tot"] - vs[-2]["tot"]
                    last = f" · 직전 {int(vs[-2]['ord'])}차 대비 {'+' if dd > 0 else '−' if dd < 0 else '±'}{man(abs(dd))}"
                out.append({"key": "inc-" + cno(r), "kind": "increase", "title": f"데이터상 이상 징후: 계약 금액 증가 ({'1차' if r.get('orig') else '확인된 첫 ' + str(int(h[0]['ord'])) + '차'} 대비 +{up / o * 100:.0f}%{last})",
                            "detail": f"{r['date']} · {r['inst']} · {r['title']} · {r['vendor']}", "amount": r["amount"], "orig": o, "ids": [r["id"]]})
    big = sorted([r for r in rows if r["amount"] >= 100_000_000], key=lambda r: -r["amount"])[:10]
    for r in big:
        out.append({"key": "big-" + r["id"], "kind": "big", "title": "1억원 이상 계약",
                    "detail": f"{r['date']} · {r['inst']} · {r['title']} · {r['vendor']}", "amount": r["amount"], "ids": [r["id"]]})
    order = {"split": 1, "threshold": 2, "increase": 3, "repeat": 4, "big": 5}
    for a in out:
        a["explanation"] = explanations.get(a["key"])
    return sorted(out, key=lambda a: (order[a["kind"]], -(a["amount"] or 0)))


def cno(r):
    """계약번호(차수 제외). 예전 행은 id(통합계약번호 = 계약번호 + 2자리 차수)에서 구한다."""
    if r.get("no"):
        return r["no"]
    i = r["id"]
    return i[:-2] if re.fullmatch(r"[A-Z0-9]{13}\d{2}", i) else i


def merge_orders(rows):
    """같은 계약의 여러 차수(변경 계약)는 최신 차수 하나만 세고, 이전 차수 금액은 hist 에 남긴다(중복 합산 방지)."""
    g = defaultdict(list)
    for r in rows.values():
        g[cno(r)].append(r)
    out = {}
    for no, rs in g.items():
        if len(rs) == 1:
            out[rs[0]["id"]] = rs[0]; continue
        rs.sort(key=lambda r: (r.get("ord") or r["id"][-2:], r["date"]))
        cur = dict(rs[-1]); cur["no"] = no
        h = {x["ord"]: x for x in cur.get("hist", [])}
        for r in rs[:-1]:
            for x in r.get("hist", []):
                h.setdefault(x["ord"], x)
            o = r.get("ord") or r["id"][-2:]
            h[o] = {"ord": o, "amount": r["amount"], "date": r["date"]}
        h.pop(cur.get("ord") or cur["id"][-2:], None)
        cur["hist"] = sorted(h.values(), key=lambda x: x["ord"])
        out[cur["id"]] = cur
    return out


def set_odate(r):
    """원계약일(odate): 0차(최초 계약) 날짜. 표준 계약정보의 cntrctCnclsDate 는 해당 차수의 체결일이라
    변경 차수 행의 date 는 변경일이다. 0차를 수집 기간 안에서 봤으면(ord 00 또는 hist 의 00) 그 날짜, 못 봤으면
    기간 전에 맺은 계약으로 보고 odate 없음. oy = 계약번호 앞자리로 본 등록 연도(참고)."""
    o = r.get("ord") or "00"
    h = {x["ord"]: x for x in r.get("hist", [])}
    r["odate"] = r["date"] if o == "00" else (h["00"].get("date") if "00" in h else None)
    r["chg"] = o != "00"
    m = re.match(r"R(\d{2})", r.get("no") or "") or re.match(r"(?:20)(\d{2})", r.get("no") or "")
    r["oy"] = 2000 + int(m.group(1)) if m else None


def man(n):
    """금액을 '1.2억' / '9,195만' / '0원' 처럼."""
    if n >= 100_000_000:
        return f"{n / 1e8:.1f}억".replace(".0억", "억")
    return f"{round(n / 10000):,}만" if n >= 10000 else f"{n:,}원"


def method_label(r):
    m = r.get("method") or ""
    # 공고 번호가 붙은 수의계약이면서 소액 수의 한도(2억)를 넘으면 경쟁입찰이 유찰된 뒤 수의로 바뀐 것으로 본다
    return "유찰 후 수의계약(추정)" if "수의" in m and "유찰" not in m and r.get("ntce") and (r.get("amount") or 0) > 200_000_000 else m


def annotate(r, c, vendors):
    """계약정보서비스 결과를 행에 붙임: 차수별 금액(vers), 1차 총액(orig), 장기계속 구분(lt), 공동도급 참여 업체(jvm)."""
    for k in ("vers", "orig", "lt", "jvm"):
        r.pop(k, None)
    if not c or not c.get("v"):
        return
    vs = list(c["v"])
    o = r.get("ord")
    if o and o not in {v["ord"] for v in vs}:  # 이력 조회가 아직 못 따라온 최신 차수: 기본 계약 자료의 금액으로 채움
        vs = sorted(vs + [{"ord": o, "date": r.get("date"), "tot": r.get("amount"), "this": r.get("this")}], key=lambda v: v["ord"])
    r["vers"] = [{k: v.get(k) for k in ("ord", "date", "tot", "this")} for v in vs]
    if vs[0]["ord"] == "01" and vs[0].get("tot"):
        r["orig"] = vs[0]["tot"]
    r["lt"] = vs[-1].get("lt")
    m = c.get("corps") or []
    if len(m) > 1:
        r["jv"] = True
        r["jvm"] = [dict(x, region=legacy((vendors.get(x["id"]) or {}).get("region")) if x.get("id") else None) for x in m]
    elif m:
        r["jv"] = False


def corp_step(now, state, biz_by_hash):
    """업체 설립일·등록 업종 캐시(data/corp.json). 대상 업체의 사업자번호가 이번 실행에 없으면
    보관 기간 안의 날짜를 하루씩 돌아가며 다시 읽어 번호를 얻는다(번호는 메모리에만)."""
    left = corp.run(DATA, biz_by_hash, state, get_json, items_of, now)
    scans = int(os.environ.get("CORP_SCAN_DAYS", "1"))
    while left and scans > 0 and any(k not in biz_by_hash for k in left):
        scans -= 1
        i = state.get("corp_scan", 0) % KEEP_DAYS
        state["corp_scan"] = i + 1
        d = datetime.combine((now - timedelta(days=i)).date(), datetime.min.time())
        for it in fetch_contracts(d, d):
            b = pick(it, "bizno")
            if b:
                biz_by_hash.setdefault(hid(str(b).replace("-", "")), str(b).replace("-", ""))
        left = corp.run(DATA, biz_by_hash, state, get_json, items_of, now)
    save(os.path.join(DATA, "state.json"), state)


def summarize(city, rows, vendors):
    total = sum(r["amount"] for r in rows)
    inst = defaultdict(lambda: [0, 0])
    ven = defaultdict(lambda: [0, 0, None])
    local_amt = known_amt = 0
    region_amt = defaultdict(int)
    key = city["name"].replace("특별시", "").replace("광역시", "").replace("특별자치시", "")
    for r in rows:
        inst[r["inst"]][0] += r["amount"]; inst[r["inst"]][1] += 1
        for vr, amt, k, nm, sh in jv.alloc(r):  # 공동도급은 지분대로 나눔
            v = ven[(nm, k)]; v[0] += amt; v[1] += 1; v[2] = vr or v[2]
            if vr:
                known_amt += amt
                region_amt[vr.split()[0]] += amt
                if city["name"] in vr or (city["metro"] and vr.startswith(key)):
                    local_amt += amt
    dates = sorted(r.get("odate") or r["date"] for r in rows)
    return {
        "count": len(rows), "total": total, "first": dates[0] if dates else None, "last": dates[-1] if dates else None,
        "top_inst": [{"name": k, "amount": a, "count": c} for k, (a, c) in sorted(inst.items(), key=lambda x: -x[1][0])[:10]],
        "top_vendors": [{"name": k[0], "id": k[1], "amount": a, "count": c, "region": rg} for k, (a, c, rg) in sorted(ven.items(), key=lambda x: -x[1][0]) if k[0]][:10],
        "local_share": (local_amt / known_amt) if known_amt else None, "region_known_share": (known_amt / total) if total else None,
        "by_region": [{"region": k, "amount": a} for k, a in sorted(region_amt.items(), key=lambda x: -x[1])[:8]],
    }


def main():
    rebuild = bool(os.environ.get("REBUILD_ONLY"))  # 새로 받지 않고 저장된 자료로 집계만 다시
    if not KEY and not rebuild:
        sys.exit("DATA_GO_KR_KEY 환경변수가 없습니다.")
    now = datetime.now(KST)
    state = load(os.path.join(DATA, "state.json"), {})
    days = RECENT_DAYS if state.get("backfilled") else BACKFILL_DAYS
    if not state.get("jngj1"):  # 전남광주통합특별시 이름으로 빠졌던 계약을 한 번 다시 받음
        days = max(days, BACKFILL_DAYS)
    raw = []
    for i in (range(0) if rebuild else range(0, days, 7)):  # 일주일씩 나눠 요청
        s = (now - timedelta(days=min(days, i + 7))).date()
        e = (now - timedelta(days=i)).date()
        raw += fetch_contracts(datetime.combine(s, datetime.min.time()), datetime.combine(e, datetime.min.time()))
    if raw:  # 필드 이름 확인용: 키와 값의 형태만 남김 (값은 저장하지 않음)
        save(os.path.join(DATA, "_fields.json"), {"at": now.isoformat(), "keys": sorted({k for it in raw[:50] for k in it}),
                                                    "types": {k: type(v).__name__ for k, v in raw[0].items()}})
    vendors = load(os.path.join(DATA, "vendors.json"), {})
    explanations = load(os.path.join(DATA, "explanations.json"), {})
    fresh = defaultdict(list)
    biznos = set()
    biz_by_hash = {}  # 메모리에만: 업체 정보 조회용 (저장하지 않음)
    for it in raw:
        slug = city_of(pick(it, "inst"))
        if not slug:
            continue
        amt, d = to_int(pick(it, "amount")), norm_date(pick(it, "date"))
        if amt is None or not d:
            continue
        b = pick(it, "bizno")
        row = {"id": str(pick(it, "id") or hid(json.dumps(it, sort_keys=True, ensure_ascii=False))), "date": d, "inst": pick(it, "inst"),
               "title": loc(pick(it, "title") or ""), "kind": pick(it, "kind"), "method": pick(it, "method"), "amount": amt,
               "vendor": kor(pick(it, "vendor") or ""), "url": pick(it, "url"), "bh": hid(str(b).replace("-", "")) if b else None,
               "no": it.get("cntrctNo") or None, "ord": it.get("cntrctOrd") or None, "this": to_int(it.get("cntrctAmt")),
               "jv": (it.get("cmmnCntrctYn") == "Y") if it.get("cmmnCntrctYn") in ("Y", "N") else None,
               "ntce": next((str(it[k]) for k in ("ntceNo", "bidNtceNo", "untyNtceNo") if it.get(k)), None)}  # 입찰공고 번호(있으면 공고를 거친 계약)
        row["method"] = method_label(row)
        if b:
            biz_by_hash[row["bh"]] = str(b).replace("-", "")
        if b:
            biznos.add(str(b).replace("-", ""))
            reg = region_from_address(pick(it, "adrs"))  # 계약 자료에 들어 있는 업체 주소 → 시·군·구만
            if reg and row["bh"] and not (vendors.get(row["bh"]) or {}).get("region"):
                vendors[row["bh"]] = {"region": reg, "at": now.strftime("%Y-%m-%d")}
        fresh[slug].append(row)
    left = lookup_regions(sorted(biznos), vendors)
    save(os.path.join(DATA, "vendors.json"), vendors)

    cutoff = (now - timedelta(days=KEEP_DAYS)).strftime("%Y-%m-%d")
    chg = load(os.path.join(DATA, "chg.json"), {})
    if KEY:  # 계약정보서비스: 차수별 금액·공동도급 지분 (하루 한도 따로)
        try:
            allrows = []
            for c in CITIES:
                old = load(os.path.join(DATA, "city", c["slug"] + ".json"), {"rows": []})
                rr = {r["id"]: r for r in old.get("rows", []) + old.get("changes", []) if r["date"] >= cutoff and city_of(r.get("inst")) == c["slug"]}
                rr.update({r["id"]: r for r in fresh.get(c["slug"], [])})
                for r in rr.values():
                    if not r.get("ord") and re.fullmatch(r"[A-Z0-9]{13}\d{2}", r["id"]):
                        r["ord"] = r["id"][-2:]
                    r["no"] = cno(r)
                allrows += merge_orders(rr).values()
            chg = history.run(DATA, allrows, state, get_json, items_of, mask, now, vendors)
            pb = sorted(b for h, b in history.PARTNERS.items() if not (vendors.get(h) or {}).get("region"))
            if pb:  # 공동도급 참여 업체 소재지 (기존 조회 한도 안에서)
                left_p = lookup_regions(pb, vendors)
                save(os.path.join(DATA, "vendors.json"), vendors)
                print(f"공동도급 참여 업체 소재지 {len(pb) - left_p}/{len(pb)}곳 조회", flush=True)
        except Exception as e:
            print(f"::warning::계약 이력 단계 실패: {type(e).__name__}", flush=True)
        try:  # 과거 계약 거꾸로 채우기 (수집 기간 바로 전날부터)
            start = (now - timedelta(days=KEEP_DAYS + 1)).strftime("%Y-%m-%d")
            backfill.run(DATA, state, get_json, items_of, mask, now, start)
        except Exception as e:
            print(f"::warning::과거 계약 단계 실패: {type(e).__name__}", flush=True)
    index = []
    for c in CITIES:
        path = os.path.join(DATA, "city", c["slug"] + ".json")
        old = load(path, {"rows": []})
        rows = {r["id"]: r for r in old.get("rows", []) + old.get("changes", []) if r["date"] >= cutoff and city_of(r.get("inst")) == c["slug"]}
        for r in fresh.get(c["slug"], []):
            rows[r["id"]] = r
        rows = merge_orders(rows)
        for r in rows.values():  # 예전 계약도 주소가 새로 확인됐으면 채운다
            r.pop("_b", None)
            if not r.get("ord") and re.fullmatch(r"[A-Z0-9]{13}\d{2}", r["id"]):
                r["ord"] = r["id"][-2:]  # 통합계약번호 끝 2자리 = 차수
            r["title"] = loc(r.get("title"))  # 지번 가리기 (예전에 저장된 행도)
            r["vendor"] = kor(mask(r.get("vendor")))  # 사람 이름처럼 보이면 '개인사업자'
            if is_fest(r.get("title"), r.get("kind")) or r.get("cat") == FEST_CAT:
                r["ftag"] = fest_tag(r.get("title"))
                r["cat"] = FEST_CAT; r["title"] = fest_title(r.get("title"))  # 출연자 이름 제거
            else:
                r["cat"] = category(r.get("title"), r.get("kind"))
            if r.get("bh"):
                r["vregion"] = legacy((vendors.get(r["bh"]) or {}).get("region"))
            else:
                r["vregion"] = legacy(r.get("vregion"))
            annotate(r, chg.get(cno(r)), vendors)
            set_odate(r)
        allr = sorted(rows.values(), key=lambda r: (r["date"], r["id"]), reverse=True)
        # 집계는 기간 안에 처음 맺은 계약만(계약번호당 1건, 금액은 최신 차수의 총계약금액).
        # 기간 전에 맺은 계약의 변경(차수) 기록은 changes 에 따로 두고 '변경' 표시로만 보여 준다.
        rows = [r for r in allr if r.get("odate")]
        changes = [r for r in allr if not r.get("odate")]
        ids_new = {r["id"] for r in rows}
        al = [a for a in alerts_for(allr, explanations) if a["kind"] == "increase" or all(i in ids_new for i in a.get("ids", []))]
        summ = summarize(c, rows, vendors)
        save(path, {"city": {k: c[k] for k in ("slug", "name", "short", "province")}, "updated": now.isoformat(), "summary": summ,
                    "alerts": al, "rows": rows, "changes": changes})
        flagged = [a for a in al if a["kind"] != "big"]
        by_cat = defaultdict(int); n_cat = defaultdict(int); cat_of = {}
        for r in rows:
            by_cat[r["cat"]] += r["amount"]; n_cat[r["cat"]] += 1; cat_of[r["id"]] = r["cat"]
        alert_cat = {}  # 분야별 대표 징후 하나씩
        for a in flagged:
            for ct in {cat_of.get(i) for i in a.get("ids", [])} - {None}:
                alert_cat.setdefault(ct, a)
        try:
            share.build(ROOT, c, summ, al, now.strftime("%Y%m%d%H"))
        except Exception as e:  # 공유 카드가 실패해도 데이터 저장은 계속
            print(f"::warning::{c['slug']} 공유 카드 실패: {e}", flush=True)
        index.append({"slug": c["slug"], "name": c["name"], "short": c["short"], "province": c["province"], "count": summ["count"],
                      "total": summ["total"], "alerts": len(flagged), "last": summ["last"], "today": sum(1 for r in rows if (r.get("odate") or r["date"]) == summ["last"]), "changes": len(changes), "local_share": summ["local_share"], "by_cat": dict(by_cat), "n_cat": dict(n_cat),
                      "alerts_cat": {k: sum(1 for a in flagged if k in {cat_of.get(i) for i in a.get("ids", [])}) for k in by_cat},
                      "top_alert_cat": alert_cat,
                      "top_alert": flagged[0] if flagged else None})
    save(os.path.join(DATA, "index.json"), {"updated": now.isoformat(), "days": KEEP_DAYS, "cities": index})
    if KEY:
        try:
            corp_step(now, state, biz_by_hash)
        except Exception as e:
            print(f"::warning::업체 정보 단계 실패: {type(e).__name__}", flush=True)
    try:
        flows.build(now)  # 지도용 돈의 흐름 (시 → 업체 소재지 시·군·구)
        vendors_agg.build(now)  # 업체별 모아 보기·전국 순위
    except Exception as e:
        print(f"::warning::흐름 집계 실패: {e}", flush=True)
    # 처음 기간의 업체 주소를 다 조회할 때까지는 다음 실행에서도 같은 기간을 다시 읽어 남은 업체를 이어서 조회한다.
    # (원래 사업자번호는 저장하지 않으므로 다시 읽어야 알 수 있음.) 요청이 실패해 비었으면 완료로 치지 않는다.
    if rebuild:
        print("저장된 자료로 다시 집계함"); return
    done = state.get("backfilled") or (raw and left == 0 and not FAILS)
    if raw and not FAILS:
        state["jngj1"] = True
    state.update({"backfilled": bool(done), "last_run": now.isoformat(), "fetched": len(raw), "lookups_left": left,
                  "failed_requests": len(FAILS)})
    save(os.path.join(DATA, "state.json"), state)
    print(f"계약 {len(raw)}건 읽음, 시 단위 {sum(len(v) for v in fresh.values())}건 반영, 건너뛴 요청 {len(FAILS)}건")
    if FAILS and not raw:
        sys.exit("모든 요청이 실패했습니다. 첫 오류: " + FAILS[0])


if __name__ == "__main__":
    main()
