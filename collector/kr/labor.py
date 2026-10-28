"""한국 노사분규·파업 공시 모으기 → data/kr/labor.json

1) OpenDART 주요사항보고(B)·거래소공시(I) 제목에서 파업·노사분규·생산중단·영업정지 관련 공시를 고르고,
   국민연금 국내주식 보유 종목(data/nps/kr_holdings.json, 우리가 추적하는 한국 종목)과 이름으로 연결한다.
   DART_API_KEY 가 없으면 이 부분은 건너뛴다(키는 출력하지 않는다).
2) 고용노동부 노사분규 통계(업종별 월별 건수·근로손실일수): 공공데이터포털 주소를 LABOR_STATS_URL 로,
   키를 DATA_GO_KR_KEY 로 받으면 읽는다. 둘 중 하나라도 없으면 건너뛴다.
3) 중앙노동위원회 조정 신청 현황: 키 없이 받을 수 있는 공개 API·파일을 확인하지 못해 수집하지 않는다(sources 에 이유 기록).
실패해도 기존 파일을 지우지 않고 종료 코드 0 으로 끝난다.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
OUT = os.path.join("data", "kr", "labor.json")
HOLD = os.path.join("data", "nps", "kr_holdings.json")
DART = "https://opendart.fss.or.kr/api/"
KEEP_DAYS = 365
FIRST_DAYS = 89
DAYS = 10

# (종류 id, 제목 정규식). 앞에서부터 먼저 맞는 것을 쓴다.
KINDS = [
    ("strike", re.compile(r"파업|노사\s*분규|쟁의|노동\s*조합|노조")),
    ("halt", re.compile(r"생산\s*중단|조업\s*중단|가동\s*중단|공장\s*가동")),
    ("suspend", re.compile(r"영업\s*정지")),
]

# 노동부 업종명 → 이 사이트 업종 id(data/market/sectors.json). 맞는 게 없으면 연결하지 않는다.
SECTOR_MAP = [
    (re.compile(r"자동차"), "auto"), (re.compile(r"조선|선박|해운"), "shipbuilding"),
    (re.compile(r"반도체|전자부품|전자"), "semiconductor"), (re.compile(r"금융|보험"), "finance"),
    (re.compile(r"건설|부동산"), "housing"), (re.compile(r"화학|전지|배터리"), "battery_ev"),
    (re.compile(r"의약|보건|제약"), "health"), (re.compile(r"기계|금속|제조"), "industrial"),
    (re.compile(r"도매|소매|유통|숙박|음식"), "consumer"), (re.compile(r"정보|통신|소프트웨어"), "tech_ai"),
]

SOURCES_BASE = [
    {"id": "dart", "name": "금융감독원 전자공시(OpenDART) 주요사항·거래소공시", "name_en": "FSS DART (Korea's corporate disclosure system)", "url": "https://opendart.fss.or.kr"},
    {"id": "moel_stats", "name": "고용노동부 노사분규 통계(공공데이터포털)", "name_en": "Ministry of Employment and Labor — labor dispute statistics (data.go.kr)", "url": "https://www.data.go.kr"},
    {"id": "nlrc", "name": "중앙노동위원회 조정 신청 현황", "name_en": "National Labor Relations Commission — mediation filings", "url": "https://www.nlrc.go.kr"},
]


def classify(title):
    t = title or ""
    for kid, rx in KINDS:
        if rx.search(t):
            return kid
    return None


def norm_name(s):
    return re.sub(r"\(주\)|㈜|주식회사|\s", "", s or "").lower()


def ymd(s):
    s = str(s or "").replace("-", "").replace(".", "")
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) >= 8 else ""


def sector_for(industry):
    for rx, sid in SECTOR_MAP:
        if rx.search(industry or ""):
            return sid
    return None


def tracked_names(path=HOLD):
    try:
        d = json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {norm_name(h.get("company")): h.get("company") for h in d.get("holdings", []) if h.get("company")}


def pick(rows, tracked):
    """DART 목록 줄에서 노사·생산중단 관련 공시만 골라 우리 형식으로."""
    out = []
    for it in rows:
        kid = classify(it.get("report_nm"))
        if not kid or not it.get("rcept_no"):
            continue
        name = it.get("corp_name") or ""
        out.append({
            "rcept_no": it["rcept_no"], "date": ymd(it.get("rcept_dt")), "corp": name,
            "code": it.get("stock_code") or "", "report": (it.get("report_nm") or "").strip(),
            "kind": kid, "tracked": norm_name(name) in tracked,
            "url": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + it["rcept_no"],
        })
    return out


def http_json(url, tries=3):
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # 주소(키 포함)는 오류 글에 넣지 않는다
            last = type(e).__name__
            time.sleep(3 * (i + 1))
    raise RuntimeError("요청 실패: " + str(last))


def dart_list(bgn, end, ty):
    out, page = [], 1
    while True:
        q = {"crtfc_key": os.environ["DART_API_KEY"], "bgn_de": bgn, "end_de": end, "pblntf_ty": ty, "page_no": page, "page_count": 100}
        jo = http_json(DART + "list.json?" + urllib.parse.urlencode(q))
        if jo.get("status") == "013":
            break
        if jo.get("status") != "000":
            raise RuntimeError(f"list.json {jo.get('status')} {jo.get('message')}")
        out += jo.get("list", [])
        if page >= int(jo.get("total_page") or 1):
            break
        page += 1
        time.sleep(0.2)
    return out


def _num(v):
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return None


def parse_stats(payload):
    """공공데이터 JSON 에서 업종·연월·건수·근로손실일수 줄을 읽는다(필드 이름 몇 가지를 모두 받아 준다)."""
    rows = payload
    for k in ("response", "body", "items", "item", "data"):
        if isinstance(rows, dict) and k in rows:
            rows = rows[k]
    if not isinstance(rows, list):
        return []

    def g(r, names):
        for n in names:
            if n in r and r[n] not in (None, ""):
                return r[n]

    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        ind, ym = g(r, ["업종", "industry", "indutyNm", "ITM_NM"]), str(g(r, ["연월", "기간", "ym", "PRD_DE", "stdrYm"]) or "")
        m = re.match(r"(\d{4})\D?(\d{2})", ym)
        cases, lost = _num(g(r, ["분규건수", "건수", "cases", "dispCnt"])), _num(g(r, ["근로손실일수", "lost_days", "lossDays"]))
        if ind and m and (cases is not None or lost is not None):
            out.append({"industry": str(ind), "month": f"{m.group(1)}-{m.group(2)}", "cases": cases, "lost_days": lost})
    return out


def build_industries(rows):
    by = {}
    for r in rows:
        o = by.setdefault(r["industry"], {"name": r["industry"], "sector_id": sector_for(r["industry"]), "months": {}})
        o["months"][r["month"]] = {"cases": r["cases"], "lost_days": r["lost_days"]}
    return sorted(by.values(), key=lambda x: x["name"])


def main():
    try:
        cur = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        cur = {}
    today = datetime.now(KST).date()
    status = {s["id"]: dict(s, status="skipped", reason="") for s in SOURCES_BASE}
    have = {d["rcept_no"]: d for d in cur.get("disclosures", [])}
    tracked = tracked_names()
    if os.environ.get("DART_API_KEY"):
        try:
            back = DAYS if have else FIRST_DAYS
            bgn, end = (today - timedelta(days=back)).strftime("%Y%m%d"), today.strftime("%Y%m%d")
            rows = []
            for ty in ("B", "I"):
                rows += dart_list(bgn, end, ty)
            for d in pick(rows, tracked):
                have[d["rcept_no"]] = d
            status["dart"].update(status="ok", reason="")
        except Exception as e:
            status["dart"].update(status="error", reason=str(e)[:120])
    else:
        status["dart"]["reason"] = "DART_API_KEY 없음 (opendart.fss.or.kr 에서 무료 발급)"
    cut = (today - timedelta(days=KEEP_DAYS)).isoformat()
    disc = sorted((v for v in have.values() if v["date"] >= cut), key=lambda x: (x["date"], x["rcept_no"]), reverse=True)
    inds = cur.get("industries", [])
    base, key = os.environ.get("LABOR_STATS_URL", ""), os.environ.get("DATA_GO_KR_KEY", "")
    if base.startswith("https://") and key:
        try:
            sep = "&" if "?" in base else "?"
            rows = parse_stats(http_json(base + sep + urllib.parse.urlencode({"serviceKey": key, "type": "json", "numOfRows": 1000})))
            if rows:
                inds = build_industries(rows)
                status["moel_stats"].update(status="ok", reason="")
            else:
                status["moel_stats"].update(status="error", reason="응답에서 업종·월·건수 줄을 읽지 못함")
        except Exception as e:
            status["moel_stats"].update(status="error", reason=str(e)[:120])
    else:
        status["moel_stats"]["reason"] = "LABOR_STATS_URL(공공데이터포털 활용신청 후 받은 주소) 또는 DATA_GO_KR_KEY 없음"
    status["nlrc"]["reason"] = "키 없이 받을 수 있는 공개 API·정기 파일을 확인하지 못해 수집하지 않음. 원문 사이트 링크만 제공."
    out = {
        "updated": datetime.now(KST).isoformat(timespec="seconds"),
        "note": "공시 제목에 해당 단어가 들어 있는 것만 모은 목록입니다. 공시가 있다고 실제 파업이 일어났다거나 주가에 영향이 있다는 뜻은 아닙니다. 투자 조언 아님.",
        "note_en": "A list of disclosures whose titles contain the listed words. A filing does not mean a strike took place or that the share price was affected. Not investment advice.",
        "sources": list(status.values()),
        "disclosures": disc,
        "industries": inds,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"labor: 공시 {len(disc)}건, 업종 {len(inds)}개, 상태 " + ", ".join(f"{k}={v['status']}" for k, v in status.items()))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"::warning::labor 실패: {type(e).__name__}")
        sys.exit(0)
