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


def main():
    if not K:
        print("us bills: CONGRESS_API_KEY 없음, 건너뜀")
        return
    mem = json.load(open(os.path.join(D, "members.json"), encoding="utf-8"))["members"]
    os.makedirs(os.path.join(D, "bills"), exist_ok=True)
    stat, recent, fails = {}, {}, 0
    for m in mem:
        rows, off = [], 0
        while True:
            d = get(f"/member/{m['id']}/sponsored-legislation", limit=250, offset=off)
            if d is None:
                fails += 1
                break
            items = d.get("sponsoredLegislation") or []
            rows += items
            # 최신순으로 오므로, 이번 의회보다 옛날 것이 나오면 그만
            if not items or any((x.get("congress") or 0) < CONG for x in items) or len(items) < 250:
                break
            off += 250
        cur = [x for x in rows if x.get("congress") == CONG and x.get("type")]
        L = []
        for x in cur:
            la = x.get("latestAction") or {}
            txt = la.get("text") or ""
            L.append({"n": (x.get("title") or "")[:160], "no": f'{x["type"]} {x.get("number")}', "d": x.get("introducedDate"),
                      "a": txt[:140], "ad": la.get("actionDate"), "law": 1 if LAW.search(txt) else 0, "pass": 1 if (LAW.search(txt) or PASS1.search(txt)) else 0,
                      "u": f"https://www.congress.gov/bill/{CONG}th-congress/{ {'HR':'house-bill','S':'senate-bill','HRES':'house-resolution','SRES':'senate-resolution','HJRES':'house-joint-resolution','SJRES':'senate-joint-resolution','HCONRES':'house-concurrent-resolution','SCONRES':'senate-concurrent-resolution'}.get(x['type'].upper(), 'house-bill') }/{x.get('number')}"})
        L.sort(key=lambda b: b.get("d") or "", reverse=True)
        if L:
            json.dump(L, open(os.path.join(D, "bills", m["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        stat[m["id"]] = [len(L), sum(b["pass"] for b in L), sum(b["law"] for b in L)]
        recent[m["id"]] = L[:6]
        time.sleep(0.25)
    if fails > len(mem) // 2:
        print("::warning::us bills: 실패가 많아 이전 자료 유지", fails)
        return
    json.dump({"updated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "congress": CONG,
               "source": "Congress.gov API (Library of Congress) — sponsored legislation",
               "note": "stat: [sponsored, passed a chamber or became law, became law] in the current Congress.", "stat": stat, "recent": recent},
              open(os.path.join(D, "bills.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"us bills: 의원 {len(stat)}, 법안 {sum(v[0] for v in stat.values())}, 법이 됨 {sum(v[2] for v in stat.values())}, 실패 {fails}")


if __name__ == "__main__":
    main()
