"""큰 계약(10억+)의 입찰 정보: data/sec_bid.json (키: 계약번호, 차수 제외).

출처: 조달청 나라장터 계약정보서비스(공고번호) · 입찰공고정보서비스(15129394, 지역 조건) · 낙찰정보서비스(15129397, 참가업체 수·낙찰률).
하루 한도(개발계정 API별 1,000건)를 다른 수집기와 나눠 쓴다:
  계약정보서비스는 history/backfill 이 800건을 쓰므로 여기선 하루 CNTR_CAP(40)건,
  입찰공고·낙찰정보는 이 스크립트만 쓰지만 BID_CAP(300)건씩으로 묶는다.
한 번 찾은 계약은 다시 조회하지 않는다. 낙찰 결과가 아직 없으면 3일 뒤 다시(최대 4번).
키는 출력하지 않는다. 로그에는 경로·건수만.
"""
import glob, json, os, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
K = os.environ.get("DATA_GO_KR_KEY", "")
B = "https://apis.data.go.kr/1230000/"
OP = {"공사": "Cnstwk", "용역": "Servc", "물품": "Thng"}
MIN = 1_000_000_000
CNTR_CAP = int(os.environ.get("BID_CNTR_CAP", "40"))
BID_CAP = int(os.environ.get("BID_CAP", "300"))
OUT = "data/sec_bid.json"
# 계약정보에 공고번호가 비어 있는 장기계속공사(옛 나라장터 공고)를 위해, 원문으로 확인한 것만 적는다.
KNOWN = {"R26TA01354404": "20221229877"}  # 강서구 통합신청사: 나라장터 입찰공고 20221229877-000, 낙찰 한백종합건설(88.016%)

used = {"c": 0, "b": 0}


def g(path, kind, **q):
    if used[kind] >= (CNTR_CAP if kind == "c" else BID_CAP):
        raise StopIteration
    used[kind] += 1
    q.setdefault("numOfRows", 10); q.setdefault("pageNo", 1); q.update(ServiceKey=K, type="json")
    try:
        t = urllib.request.urlopen(B + path + "?" + urllib.parse.urlencode(q), timeout=40).read().decode()
        d = json.loads(t)
    except Exception as e:
        print(f"  {path.split('/')[-1]}: {type(e).__name__}", flush=True); return None
    it = (d.get("response", {}).get("body", {}) or {}).get("items") or []
    if isinstance(it, dict): it = it.get("item", [])
    if isinstance(it, dict): it = [it]
    time.sleep(0.2)
    return it


def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None


def main():
    now = datetime.now(KST)
    try: cache = json.load(open(OUT))["rows"]
    except Exception: cache = {}
    rows = {}
    for p in glob.glob("data/city/*.json"):
        for r in json.load(open(p)).get("rows", []):
            if (r.get("amount") or 0) >= MIN and r.get("kind") in OP:
                no = r["id"][:-2]
                if no not in rows or r["amount"] > rows[no]["amount"]: rows[no] = r
    todo = sorted((r for no, r in rows.items() if not cache.get(no, {}).get("done") and
                   (cache.get(no, {}).get("next") or "") <= now.strftime("%Y-%m-%d")), key=lambda r: -r["amount"])
    print(f"10억+ 계약 {len(rows)}건, 캐시 {len(cache)}건, 이번 대상 {len(todo)}건")
    try:
        for r in todo:
            no, kind = r["id"][:-2], r["kind"]; c = cache.get(no, {"tries": 0})
            bn = c.get("bn") or KNOWN.get(no)
            if not bn:
                it = g(f"ao/CntrctInfoService/getCntrctInfoList{OP[kind]}PPSSrch", "c", inqryDiv=2, dcsnCntrctNo=r["id"], numOfRows=1)
                if it is None: continue
                bn = (it[0].get("ntceNo") or "").strip() if it else ""
                if not bn:
                    cache[no] = {"done": True, "bn": None, "at": now.strftime("%Y-%m-%d")}; continue  # 수의계약 등 공고 없음
            c["bn"] = bn
            if "rgn" not in c:
                it = g(f"ad/BidPublicInfoService/getBidPblancListInfo{OP[kind]}", "b", inqryDiv=2, bidNtceNo=bn, numOfRows=5)
                if it:
                    x = it[0]
                    c.update(ord=x.get("bidNtceOrd"), nm=x.get("bidNtceNm"), method=x.get("cntrctCnclsMthdNm"), dt=(x.get("bidNtceDt") or "")[:10],
                             duty=x.get("jntcontrctDutyRgnNm1") or None, duty_rt=num(x.get("rgnDutyJntcontrctRt")),
                             rgnlmt=x.get("rgnLmtBidLocplcJdgmBssNm") or None, site=x.get("cnstrtsiteRgnNm") or None,
                             url=x.get("bidNtceDtlUrl") or x.get("bidNtceUrl"), rgn=True)
            it = g(f"as/ScsbidInfoService/getScsbidListSttus{OP[kind]}", "b", inqryDiv=4, bidNtceNo=bn, numOfRows=5)
            if it:
                x = it[0]
                c.update(n=int(num(x.get("prtcptCnum")) or 0) or None, rate=num(x.get("sucsfbidRate")), opened=(x.get("rlOpengDt") or "")[:10], done=True)
            else:
                c["tries"] = c.get("tries", 0) + 1
                c["next"] = (now + timedelta(days=3)).strftime("%Y-%m-%d")
                if c["tries"] >= 4: c["done"] = True
            c["at"] = now.strftime("%Y-%m-%d"); cache[no] = c
    except StopIteration:
        print("오늘 몫의 조회 한도 도달, 내일 이어서")
    print(f"조회: 계약정보 {used['c']}건, 입찰·낙찰 {used['b']}건 · 입찰정보 있는 계약 {sum(1 for v in cache.values() if v.get('n'))}건")
    out = {"updated": now.isoformat(timespec="seconds"), "rows": dict(sorted(cache.items())),
           "source": "조달청 나라장터 계약정보서비스·입찰공고정보서비스·낙찰정보서비스(공공데이터포털)"}
    try: old = json.load(open(OUT)); same = old.get("rows") == out["rows"]
    except Exception: same = False
    if not same:
        json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
