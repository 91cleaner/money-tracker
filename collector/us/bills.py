"""미국 의원 대표 발의 법안(119대 의회): data/us/bills.json + data/us/bills/<bioguide>.json

출처: Congress.gov API (Library of Congress) /member/{bioguide}/sponsored-legislation
  CONGRESS_API_KEY(api.data.gov 키, GitHub Secrets)가 없으면 건너뛴다. 키는 출력하지 않는다.
  법이 됐는지는 최근 처리 문구(Became Public Law / Signed by President)로 본다.
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
D = os.path.join(ROOT, "data", "us")
K = os.environ.get("CONGRESS_API_KEY", "")
CONG = int(os.environ.get("US_CONGRESS", "119"))
LAW = re.compile(r"Became Public Law|Signed by President|Became Private Law", re.I)
PASS1 = re.compile(r"Passed (the )?(House|Senate)|Received in the (House|Senate)|Resolution agreed to|agreed to in (the )?(House|Senate)", re.I)


def get(path, **q):
    q.update(api_key=K, format="json")
    url = "https://api.congress.gov/v3" + path + "?" + urllib.parse.urlencode(q)
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "money-tracker"}), timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # 잠깐 쉬고 다시
            last = type(e).__name__
            time.sleep(2 * (i + 1))
    print("::warning::congress.gov 요청 실패", path, last)
    return None


def bill_row(x):
    la = x.get("latestAction") or {}
    txt = la.get("text") or ""
    kind = {'HR': 'house-bill', 'S': 'senate-bill', 'HRES': 'house-resolution', 'SRES': 'senate-resolution', 'HJRES': 'house-joint-resolution',
            'SJRES': 'senate-joint-resolution', 'HCONRES': 'house-concurrent-resolution', 'SCONRES': 'senate-concurrent-resolution'}.get(x['type'].upper(), 'house-bill')
    return {"n": (x.get("title") or "")[:160], "no": f'{x["type"]} {x.get("number")}', "d": x.get("introducedDate"),
            "a": txt[:140], "ad": la.get("actionDate"), "law": 1 if LAW.search(txt) else 0, "pass": 1 if (LAW.search(txt) or PASS1.search(txt)) else 0,
            "u": f"https://www.congress.gov/bill/{CONG}th-congress/{kind}/{x.get('number')}"}


def fetch_member(mid):
    rows, off = [], 0
    while True:
        d = get(f"/member/{mid}/sponsored-legislation", limit=250, offset=off)
        if d is None:
            return None
        items = d.get("sponsoredLegislation") or []
        rows += items
        # 최신순으로 오므로, 이번 의회보다 옛날 것이 나오면 그만
        if not items or any((x.get("congress") or 0) < CONG for x in items) or len(items) < 250:
            break
        off += 250
    L = [bill_row(x) for x in rows if x.get("congress") == CONG and x.get("type")]
    L.sort(key=lambda b: b.get("d") or "", reverse=True)
    return L


def main():
    """시간 예산 안에서 마지막으로 받은 지 오래된 의원부터 갱신하고, 요약(bills.json)은 매번 다시 쓴다.
    (예전에는 539명을 한 번에 받다가 20분 제한에 걸려 요약이 저장되지 않았다: 10/27 us.yml)"""
    if not K:
        print("::warning::us bills: CONGRESS_API_KEY 가 비어 있어 법안은 건너뜀(Secrets 이름 확인)")
        return
    budget = float(os.environ.get("US_BILLS_BUDGET_SEC", str(16 * 60)))
    t0 = time.time()
    mem = json.load(open(os.path.join(D, "members.json"), encoding="utf-8"))["members"]
    os.makedirs(os.path.join(D, "bills"), exist_ok=True)
    try:
        prev = json.load(open(os.path.join(D, "bills.json"), encoding="utf-8"))
    except (OSError, ValueError):
        prev = {}
    fetched = dict(prev.get("fetched") or {})
    order = sorted(mem, key=lambda m: fetched.get(m["id"], ""))
    stat, recent, done, fails, tried = {}, {}, 0, 0, 0
    for m in order:
        mid = m["id"]
        path = os.path.join(D, "bills", mid + ".json")
        L = None
        if time.time() - t0 < budget:
            tried += 1
            L = fetch_member(mid)
            if L is None:
                fails += 1
            else:
                if L:
                    json.dump(L, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
                elif os.path.exists(path):
                    os.remove(path)
                fetched[mid] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                done += 1
            time.sleep(0.25)
        if L is None:  # 이번에 못 받았으면 지난 번 의원별 파일로 요약을 채운다
            try:
                L = json.load(open(path, encoding="utf-8"))
            except (OSError, ValueError):
                L = []
        stat[mid] = [len(L), sum(b.get("pass", 0) for b in L), sum(b.get("law", 0) for b in L)]
        recent[mid] = L[:6]
    if tried and fails > tried // 2:
        print("::warning::us bills: 실패가 많아 이전 요약 유지", fails, "/", tried)
        return
    left = len(mem) - done
    if left:
        print(f"::warning::us bills: 시간 예산 {int(budget)}초 안에 {done}명 갱신, {left}명은 지난 자료 유지(다음 실행에서 이어서)")
    json.dump({"updated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "congress": CONG,
               "source": "Congress.gov API (Library of Congress) — sponsored legislation",
               "note": "stat: [sponsored, passed a chamber or became law, became law] in the current Congress. fetched: last refresh per member.",
               "stat": stat, "recent": recent, "fetched": fetched},
              open(os.path.join(D, "bills.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"us bills: 의원 {len(stat)}, 이번에 갱신 {done}, 법안 {sum(v[0] for v in stat.values())}, 법이 됨 {sum(v[2] for v in stat.values())}, 실패 {fails}")


if __name__ == "__main__":
    main()
