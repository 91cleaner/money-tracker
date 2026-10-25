"""지금 열린 입찰(85개 시 기관이 낸, 아직 마감 안 된 입찰공고): data/open_bids.json

출처: 조달청 나라장터 입찰공고정보서비스(공공데이터포털, DATA_GO_KR_KEY).
  공사·용역·물품 공고 목록을 게시일 기준으로 받아(처음엔 14일, 평소엔 최근 3일을 겹쳐서),
  공고기관·수요기관 이름이 85개 시 중 하나로 시작하는 것만 남긴다.
  마감이 지난 공고, 취소 공고는 뺀다. 같은 공고 번호는 가장 최근 차수만.
참고값: 그 시·같은 분야 계약이 그동안 예정가격의 몇 %에 낙찰됐는지(data/sec_bid.json 의 낙찰률, 가운데 값).
키는 출력하지 않는다. 하루 호출은 수십 번 정도(하루 한도 1,000번).
"""
import glob
import json
import os
import statistics
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from collect import category  # noqa: E402  계약과 같은 분야 나누기

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "open_bids.json")
K = os.environ.get("DATA_GO_KR_KEY", "")
API = "https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfo"
KINDS = {"Cnstwk": "공사", "Servc": "용역", "Thng": "물품"}
KST = timezone(timedelta(hours=9))
FIRST_DAYS, DAYS, MAX_CALLS = 14, 3, 60
calls = 0


def get(op, **q):
    global calls
    if calls >= MAX_CALLS:
        raise StopIteration
    calls += 1
    q.update(ServiceKey=K, type="json")
    last = None
    for i in range(3):
        try:
            with urllib.request.urlopen(API + op + "?" + urllib.parse.urlencode(q), timeout=30) as r:
                d = json.loads(r.read().decode("utf-8"))
            body = (d.get("response") or {}).get("body") or {}
            items = body.get("items") or []
            if isinstance(items, dict):
                items = items.get("item") or []
            if isinstance(items, dict):
                items = [items]
            return items, int(body.get("totalCount") or 0)
        except Exception as e:  # 잠깐 안 되면 쉬었다 다시
            last = e
            time.sleep(3 * (i + 1))
    print(f"::warning::{op} 요청 실패: {type(last).__name__}", flush=True)
    return None, 0


def fetch(op, start, end):
    out, page = [], 1
    while True:
        items, total = get(op, inqryDiv=1, inqryBgnDt=start.strftime("%Y%m%d%H%M"), inqryEndDt=end.strftime("%Y%m%d%H%M"), numOfRows=999, pageNo=page)
        if items is None:
            return out, False
        out += items
        if page * 999 >= total or not items:
            return out, True
        page += 1


def dt(s):
    """'2026-10-27 10:00:00' 또는 '202610271000' → '2026-10-27 10:00'."""
    s = str(s or "").strip()
    if not s:
        return ""
    if s[:4].isdigit() and len(s) >= 12 and s[4].isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]} {s[8:10]}:{s[10:12]}"
    return s[:16]


def num(v):
    try:
        return int(float(str(v).replace(",", "")))
    except (TypeError, ValueError):
        return 0


def cities():
    """시 slug → 공고기관 이름 앞부분들('경상북도 상주시', '상주시' 등) + 그동안 계약에 나온 기관 이름들."""
    ix = json.load(open(os.path.join(ROOT, "data", "index.json"), encoding="utf-8"))
    pre, exact = {}, {}
    for c in ix.get("cities", []):
        p = os.path.join(ROOT, "data", "city", c["slug"] + ".json")
        d = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
        cc = d.get("city") or c
        heads = {cc.get("name") or ""}
        if cc.get("province") and cc.get("province") != cc.get("name"):
            heads.add(f"{cc['province']} {cc.get('name')}")
        pre[c["slug"]] = sorted((h for h in heads if len(h) >= 3), key=len, reverse=True)
        for r in d.get("rows", []):
            if r.get("inst"):
                exact[r["inst"]] = c["slug"]
    return ix, pre, exact


def which(names, pre, exact):
    for n in names:
        n = (n or "").strip()
        if not n:
            continue
        if n in exact:
            return exact[n]
        for s, heads in pre.items():
            if any(n.startswith(h) for h in heads):
                return s
    return None


def rates(ix):
    """시·분야별 그동안의 낙찰률 가운데 값(계약 10억+ 중 확인된 것). 너무 적으면 분야 전체로."""
    p = os.path.join(ROOT, "data", "sec_bidpage.json")
    if not os.path.exists(p):
        return {}, {}
    d = json.load(open(p, encoding="utf-8"))
    by_c, by_k = {}, {}
    for x in d.get("big", []):
        if x.get("rate") is None:
            continue
        by_c.setdefault((x["slug"], x["cat"]), []).append(x["rate"])
        by_k.setdefault(x["cat"], []).append(x["rate"])
    med = lambda v: round(statistics.median(v), 1)
    return ({k: (med(v), len(v)) for k, v in by_c.items() if len(v) >= 3}, {k: (med(v), len(v)) for k, v in by_k.items() if len(v) >= 3})


STD = "https://www.g2b.go.kr/link/PNPE027_01/single/?bidPbancNo={no}&bidPbancOrd={ord}"


def slim(it):
    """파일을 작게: 빈 값·기본 주소·같은 기관 이름은 뺀다(화면에서 다시 만든다)."""
    it = dict(it)
    if it.get("url") == STD.format(no=it["no"], ord=it.get("ord", "000")):
        it.pop("url")
    if it.get("dem") == it.get("inst"):
        it.pop("dem")
    it.pop("open", None)
    return {k: v for k, v in it.items() if v not in (None, "", 0)}


def main():
    if not K:
        print("open_bids: DATA_GO_KR_KEY 없음, 건너뜀")
        return
    now = datetime.now(KST)
    nowtxt = now.strftime("%Y-%m-%d %H:%M")
    try:
        cur = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        cur = {"items": []}
    keep = {it["no"]: it for it in cur.get("items", []) if (it.get("close") or "9") > nowtxt}
    start = now - timedelta(days=DAYS if keep else FIRST_DAYS)
    ix, pre, exact = cities()
    names = {c["slug"]: c.get("short") or c.get("name") for c in ix.get("cities", [])}
    got, ok_all = 0, True
    try:
        for op, kind in KINDS.items():
            rows, ok = fetch(op, start, now)
            ok_all &= ok
            for x in rows:
                got += 1
                if "취소" in (x.get("ntceKindNm") or ""):
                    keep.pop(str(x.get("bidNtceNo") or ""), None)
                    continue
                close = dt(x.get("bidClseDt"))
                if not close or close <= nowtxt:
                    continue
                slug = which([x.get("ntceInsttNm"), x.get("dminsttNm")], pre, exact)
                if not slug:
                    continue
                no = str(x.get("bidNtceNo") or "")
                ordn = str(x.get("bidNtceOrd") or "000")
                if no in keep and keep[no].get("ord", "000") > ordn:
                    continue
                title = (x.get("bidNtceNm") or "").strip()
                keep[no] = {
                    "no": no, "ord": ordn, "slug": slug, "cname": names.get(slug, slug),
                    "title": title, "inst": (x.get("ntceInsttNm") or "").strip(), "dem": (x.get("dminsttNm") or "").strip(),
                    "kind": kind, "cat": category(title, kind),
                    "method": (x.get("cntrctCnclsMthdNm") or "").strip(), "award": (x.get("sucsfbidMthdNm") or "").strip(),
                    "price": num(x.get("presmptPrce")) or num(x.get("asignBdgtAmt")),
                    "low": (str(x.get("sucsfbidLwltRate") or "").strip() or None),
                    "posted": dt(x.get("bidNtceDt")), "close": close, "open": dt(x.get("opengDt")),
                    "rgn": (x.get("rgnLmtBidLocplcJdgmBssNm") or "").strip(),
                    "url": x.get("bidNtceDtlUrl") or x.get("bidNtceUrl") or "",
                }
    except StopIteration:
        ok_all = False
        print("open_bids: 이번 회차 호출 상한 도달")
    if got == 0 and not ok_all:
        print("::warning::open_bids: 공고를 하나도 못 받아 이번 회차는 건너뜀(기존 자료 유지)")
        return
    rc, rk = rates(ix)
    items = []
    for it in keep.values():
        if (it.get("close") or "") <= nowtxt:
            continue
        r = rc.get((it["slug"], it["cat"])) or rk.get(it["cat"])
        it["ref"] = {"rate": r[0], "n": r[1], "scope": "city" if (it["slug"], it["cat"]) in rc else "all"} if r else None
        items.append(slim(it))
    items.sort(key=lambda x: (x["close"], x["no"]))
    out = {"updated": now.isoformat(timespec="seconds"), "source": "조달청 나라장터 입찰공고정보서비스(공공데이터포털)",
           "note": "85개 시 기관(공고기관·수요기관)이 낸 공고 중 아직 마감 안 된 것. 참고 낙찰률은 10억원 이상 계약에서 확인된 값의 가운데 값.",
           "calls": calls, "items": items}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT + ".tmp", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(OUT + ".tmp", OUT)
    print(f"open_bids: 받은 공고 {got}건, 85개 시 열린 공고 {len(items)}건, 호출 {calls}번")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # 이 칸 때문에 다른 갱신이 멈추지 않게
        print(f"::warning::open_bids 실패: {type(e).__name__}: {e}")
