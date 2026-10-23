"""공동도급 계약 금액 나누기 (조달청 나라장터 계약정보서비스 업체목록의 지분).

참여 업체가 2곳 이상이고 모든 업체의 지분이 있고 합이 99~101%면 지분대로 나눈다.
지분이 하나라도 비면 대표 업체에 전부(화면에 '금액은 대표 업체 기준' 안내).
"""
import hashlib


def vid(r):
    return r.get("bh") or "n" + hashlib.sha256((r.get("vendor") or "").encode()).hexdigest()[:15]


def ok(r):
    m = r.get("jvm") or []
    return len(m) > 1 and all(x.get("share") for x in m) and 99 <= sum(x["share"] for x in m) <= 101


def alloc(r):
    """[(업체 소재지 또는 None, 금액, 업체 id, 업체 이름, 지분%)]"""
    if ok(r):
        m = r["jvm"]; tot = sum(x["share"] for x in m)
        out = [[x.get("region"), round(r["amount"] * x["share"] / tot), x.get("id") or ("n" + hashlib.sha256(x["name"].encode()).hexdigest()[:15]), x["name"], x["share"]] for x in m]
        out[0][1] += r["amount"] - sum(o[1] for o in out)  # 반올림 차이는 첫 업체에
        return [tuple(o) for o in out]
    return [(r.get("vregion"), r["amount"], vid(r), r["vendor"], None)]
