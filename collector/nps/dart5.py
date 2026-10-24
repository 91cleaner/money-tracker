"""국민연금 5% 넘는 지분 변동(주식등의 대량보유상황보고서) 모으기.

금융감독원 전자공시(OpenDART)에서
  1) 지분공시 목록(list.json, pblntf_ty=D)을 날짜별로 받아 제출인이 국민연금공단인 대량보유 보고만 고르고
  2) 그 회사의 대량보유 상황(majorstock.json)에서 같은 접수번호 줄을 찾아 보유비율·증감을 붙인다.
data/nps/dart5.json 에 쌓는다(접수번호 기준, 최근 180일).
DART_API_KEY 가 없으면 아무것도 하지 않고 끝난다(키가 들어오는 날부터 저절로 켜짐).
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
OUT = os.path.join("data", "nps", "dart5.json")
API = "https://opendart.fss.or.kr/api/"
KEEP_DAYS = 180
FIRST_DAYS = 89  # 처음 실행 때 거슬러 받을 날 수(목록 API는 회사 지정 없이 3개월까지)
DAYS = 10        # 평소에는 최근 열흘만 다시 훑는다(늦게 올라온 정정 보고 포함)


def get(path, **params):
    params["crtfc_key"] = os.environ["DART_API_KEY"]
    url = API + path + "?" + urllib.parse.urlencode(params)
    last = None
    for i in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # 잠깐 안 되면 쉬었다 다시
            last = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"{path} 요청 실패: {last}")


def num(s):
    try:
        return float(str(s).replace(",", "").replace("%", "").strip())
    except ValueError:
        return None


def ymd(s):
    s = str(s or "").replace("-", "").replace(".", "")
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) >= 8 else ""


def nps_reports(bgn, end):
    """기간 안에 국민연금공단이 낸 대량보유 보고 목록."""
    out, page = [], 1
    while True:
        jo = get("list.json", bgn_de=bgn, end_de=end, pblntf_ty="D", page_no=page, page_count=100)
        st = jo.get("status")
        if st == "013":  # 자료 없음
            break
        if st != "000":
            raise RuntimeError(f"list.json {st} {jo.get('message')}")
        for it in jo.get("list", []):
            if "국민연금" in (it.get("flr_nm") or "") and "대량보유" in (it.get("report_nm") or ""):
                out.append(it)
        if page >= int(jo.get("total_page") or 1):
            break
        page += 1
        time.sleep(0.2)
    return out


def main():
    if not os.environ.get("DART_API_KEY"):
        print("dart5: DART_API_KEY 없음, 건너뜀")
        return
    try:
        cur = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        cur = {"items": []}
    have = {it["rcept_no"]: it for it in cur.get("items", [])}
    today = datetime.now(KST).date()
    back = DAYS if have else FIRST_DAYS
    reps = nps_reports((today - timedelta(days=back)).strftime("%Y%m%d"), today.strftime("%Y%m%d"))
    new = [r for r in reps if r["rcept_no"] not in have]
    print(f"dart5: 국민연금 대량보유 보고 {len(reps)}건, 새로 {len(new)}건")
    cache = {}
    for r in new:
        cc = r["corp_code"]
        if cc not in cache:
            jo = get("majorstock.json", corp_code=cc)
            cache[cc] = {x.get("rcept_no"): x for x in jo.get("list", [])} if jo.get("status") == "000" else {}
            time.sleep(0.2)
        m = cache[cc].get(r["rcept_no"], {})
        stake, delta = num(m.get("stkrt")), num(m.get("stkrt_irds"))
        have[r["rcept_no"]] = {
            "rcept_no": r["rcept_no"],
            "date": ymd(r.get("rcept_dt")),
            "corp": r.get("corp_name") or m.get("corp_name") or "",
            "code": r.get("stock_code") or "",
            "report": (r.get("report_nm") or "").strip(),
            "stake": stake,
            "delta": delta,
            "prev": round(stake - delta, 2) if stake is not None and delta is not None else None,
            "shares": num(m.get("stkqy")),
            "shares_delta": num(m.get("stkqy_irds")),
            "reason": (m.get("report_resn") or "").strip()[:200],
            "url": "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + r["rcept_no"],
        }
    cut = (today - timedelta(days=KEEP_DAYS)).isoformat()
    items = sorted((v for v in have.values() if v["date"] >= cut), key=lambda x: (x["date"], x["rcept_no"]), reverse=True)
    out = {
        "updated": datetime.now(KST).isoformat(timespec="seconds"),
        "source": "금융감독원 전자공시(OpenDART) 주식등의 대량보유상황보고서, 제출인 국민연금공단",
        "note": "5% 넘게 가진 회사의 지분이 1%p 넘게 바뀌거나 5%를 넘고/밑돌면 보고해요. 국민연금은 보통 변동이 있던 달(또는 분기)의 다음 달 10일 무렵에 몰아서 내요.",
        "items": items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"dart5: 저장 {len(items)}건")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # 공시 서버 문제로 나머지 국민연금 갱신까지 막지 않는다
        print(f"::warning::dart5 실패: {e}")
        sys.exit(0)
