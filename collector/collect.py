"""나라장터 공개 계약 데이터를 시 단위로 모아 data/ 아래 JSON으로 저장.

환경변수 DATA_GO_KR_KEY: 공공데이터포털 일반 인증키(디코딩된 키).
처음 실행하면 최근 BACKFILL_DAYS일, 그 뒤로는 최근 RECENT_DAYS일만 다시 읽어 새 계약을 더한다.
"""
import hashlib, json, os, sys, time, urllib.parse, urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))
from cities import CITIES, city_of

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")
KST = timezone(timedelta(hours=9))
KEY = os.environ.get("DATA_GO_KR_KEY", "").strip()
BACKFILL_DAYS = int(os.environ.get("BACKFILL_DAYS", "30"))
RECENT_DAYS = int(os.environ.get("RECENT_DAYS", "3"))
KEEP_DAYS = 90
MAX_VENDOR_LOOKUPS = int(os.environ.get("MAX_VENDOR_LOOKUPS", "300"))

CNTRCT_URL = "https://apis.data.go.kr/1230000/ao/PubDataOpnStdService/getDataSetOpnStdCntrctInfo"
CORP_BASE = "https://apis.data.go.kr/1230000/ao/UsrInfoService02/"
CORP_OPS = ["getPrcrmntCorpBasicInfo02", "getPrcrmntCorpBasicInfo"]

# 응답 필드 이름이 서비스마다 조금씩 달라 후보를 순서대로 본다.
F = {
    "id": ["untyCntrctNo", "cntrctNo", "dcsnCntrctNo", "cntrctRefNo"],
    "title": ["cntrctNm", "cntrctNm1"],
    "amount": ["totCntrctAmt", "cntrctAmt", "thtmCntrctAmt", "cntrctAmount"],
    "date": ["cntrctCnclsDate", "cntrctCnclsDt", "cntrctDate"],
    "inst": ["dmndInsttNm", "dminsttNm", "cntrctInsttNm"],
    "vendor": ["rprsntCorpNm", "corpNm", "cntrctCorpNm"],
    "bizno": ["rprsntCorpBizrno", "corpBizrno", "bizno", "bizrno"],
    "method": ["cntrctMthdNm", "cntrctMthd"],
    "kind": ["bsnsDivNm", "prcrmntDivNm", "cntrctBsnsDivNm"],
    "url": ["cntrctInfoUrl", "cntrctDtlInfoUrl", "dtlsInfoUrl"],
}


def pick(item, field):
    for k in F[field]:
        v = item.get(k)
        if v not in (None, ""):
            return v
    return None


def get_json(url, params, tries=3):
    q = urllib.parse.urlencode({**params, "ServiceKey": KEY, "type": "json"})
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(url + "?" + q, timeout=60) as r:
                body = r.read().decode("utf-8", "replace")
            return json.loads(body)
        except Exception as e:  # 네트워크·형식 오류는 잠시 쉬고 다시
            last = e
            time.sleep(3 * (i + 1))
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


def fetch_contracts(start, end):
    out, page = [], 1
    while True:
        resp = get_json(CNTRCT_URL, {"cntrctCnclsBgnDate": start.strftime("%Y%m%d"), "cntrctCnclsEndDate": end.strftime("%Y%m%d"),
                                     "numOfRows": 999, "pageNo": page})
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
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
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
    """사업자번호로 업체 소재지(시·군·구) 조회. 결과는 해시 키로만 저장."""
    n = 0
    for b in biznos:
        k = hid(b)
        if k in vendors or n >= MAX_VENDOR_LOOKUPS:
            continue
        n += 1
        region = None
        for op in CORP_OPS:
            try:
                resp = get_json(CORP_BASE + op, {"inqryDiv": 3, "bizno": b, "numOfRows": 1, "pageNo": 1}, tries=1)
                items, _ = items_of(resp)
                if items:
                    it = items[0]
                    region = region_from_address(it.get("adrs")) or (it.get("rgnNm") or None)
                    break
            except Exception:
                continue
        vendors[k] = {"region": region, "at": datetime.now(KST).strftime("%Y-%m-%d")}
        time.sleep(0.2)


def alerts_for(rows, explanations):
    out = []
    by = defaultdict(list)
    for r in rows:
        by[(r["date"], r["vendor"], r["title"])].append(r)
    for (d, v, t), rs in by.items():
        if len(rs) > 1 and v:
            key = "split-" + "-".join(sorted(x["id"] for x in rs))
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
            cnt[r["vendor"]].append(r)
    for v, rs in cnt.items():
        if len(rs) >= 5:
            insts = Counter(x["inst"] for x in rs).most_common(3)
            out.append({"key": "rep-" + hid(v), "kind": "repeat", "title": f"같은 업체 {len(rs)}건 반복 (최근 {KEEP_DAYS}일)",
                        "detail": f"{v} · " + ", ".join(i for i, _ in insts), "amount": sum(x["amount"] for x in rs), "ids": [x["id"] for x in rs][:20]})
    big = sorted([r for r in rows if r["amount"] >= 100_000_000], key=lambda r: -r["amount"])[:10]
    for r in big:
        out.append({"key": "big-" + r["id"], "kind": "big", "title": "1억원 이상 계약",
                    "detail": f"{r['date']} · {r['inst']} · {r['title']} · {r['vendor']}", "amount": r["amount"], "ids": [r["id"]]})
    order = {"split": 1, "threshold": 2, "repeat": 3, "big": 4}
    for a in out:
        a["explanation"] = explanations.get(a["key"])
    return sorted(out, key=lambda a: (order[a["kind"]], -(a["amount"] or 0)))


def summarize(city, rows, vendors):
    total = sum(r["amount"] for r in rows)
    inst = defaultdict(lambda: [0, 0])
    ven = defaultdict(lambda: [0, 0, None])
    local_amt = known_amt = 0
    region_amt = defaultdict(int)
    for r in rows:
        inst[r["inst"]][0] += r["amount"]; inst[r["inst"]][1] += 1
        v = ven[r["vendor"]]; v[0] += r["amount"]; v[1] += 1; v[2] = r.get("vregion")
        if r.get("vregion"):
            known_amt += r["amount"]
            region_amt[r["vregion"].split()[0]] += r["amount"]
            key = city["name"].replace("특별시", "").replace("광역시", "").replace("특별자치시", "")
            if city["name"] in r["vregion"] or (city["metro"] and r["vregion"].startswith(key)):
                local_amt += r["amount"]
    dates = sorted(r["date"] for r in rows)
    return {
        "count": len(rows), "total": total, "first": dates[0] if dates else None, "last": dates[-1] if dates else None,
        "top_inst": [{"name": k, "amount": a, "count": c} for k, (a, c) in sorted(inst.items(), key=lambda x: -x[1][0])[:10]],
        "top_vendors": [{"name": k, "amount": a, "count": c, "region": rg} for k, (a, c, rg) in sorted(ven.items(), key=lambda x: -x[1][0]) if k][:10],
        "local_share": (local_amt / known_amt) if known_amt else None, "region_known_share": (known_amt / total) if total else None,
        "by_region": [{"region": k, "amount": a} for k, a in sorted(region_amt.items(), key=lambda x: -x[1])[:8]],
    }


def main():
    if not KEY:
        sys.exit("DATA_GO_KR_KEY 환경변수가 없습니다.")
    now = datetime.now(KST)
    state = load(os.path.join(DATA, "state.json"), {})
    days = RECENT_DAYS if state.get("backfilled") else BACKFILL_DAYS
    raw = []
    for i in range(0, days, 7):  # 일주일씩 나눠 요청
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
    for it in raw:
        slug = city_of(pick(it, "inst"))
        if not slug:
            continue
        amt, d = to_int(pick(it, "amount")), norm_date(pick(it, "date"))
        if amt is None or not d:
            continue
        b = pick(it, "bizno")
        row = {"id": str(pick(it, "id") or hid(json.dumps(it, sort_keys=True, ensure_ascii=False))), "date": d, "inst": pick(it, "inst"),
               "title": pick(it, "title") or "", "kind": pick(it, "kind"), "method": pick(it, "method"), "amount": amt,
               "vendor": pick(it, "vendor") or "", "url": pick(it, "url"), "_b": b}
        if b:
            biznos.add(str(b).replace("-", ""))
        fresh[slug].append(row)
    lookup_regions(sorted(biznos), vendors)
    save(os.path.join(DATA, "vendors.json"), vendors)

    cutoff = (now - timedelta(days=KEEP_DAYS)).strftime("%Y-%m-%d")
    index = []
    for c in CITIES:
        path = os.path.join(DATA, "city", c["slug"] + ".json")
        old = load(path, {"rows": []})
        rows = {r["id"]: r for r in old.get("rows", []) if r["date"] >= cutoff}
        for r in fresh.get(c["slug"], []):
            b = r.pop("_b", None)
            r["vregion"] = (vendors.get(hid(str(b).replace("-", ""))) or {}).get("region") if b else None
            rows[r["id"]] = r
        rows = sorted(rows.values(), key=lambda r: (r["date"], r["id"]), reverse=True)
        al = alerts_for(rows, explanations)
        summ = summarize(c, rows, vendors)
        save(path, {"city": {k: c[k] for k in ("slug", "name", "short", "province")}, "updated": now.isoformat(), "summary": summ,
                    "alerts": al, "rows": rows})
        flagged = [a for a in al if a["kind"] != "big"]
        index.append({"slug": c["slug"], "name": c["name"], "short": c["short"], "province": c["province"], "count": summ["count"],
                      "total": summ["total"], "alerts": len(flagged), "last": summ["last"], "local_share": summ["local_share"],
                      "top_alert": flagged[0] if flagged else None})
    save(os.path.join(DATA, "index.json"), {"updated": now.isoformat(), "days": KEEP_DAYS, "cities": index})
    state.update({"backfilled": True, "last_run": now.isoformat(), "fetched": len(raw)})
    save(os.path.join(DATA, "state.json"), state)
    print(f"계약 {len(raw)}건 읽음, 시 단위 {sum(len(v) for v in fresh.values())}건 반영")


if __name__ == "__main__":
    main()
