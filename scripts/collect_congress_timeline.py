#!/usr/bin/env python3
"""미국 의원 타임라인: 법안(발의·처리)·하원 표결 → data/us/timeline/<bioguide>.json + status.json

출처: Congress.gov API (Library of Congress, 무료 공식). 키: 환경변수 CONGRESS_API_KEY (GitHub Secrets).
- 키가 없으면 status.json 에 needs_key 만 적고 정상 종료(화면에 '키 필요'로 표시). 키 값은 어디에도 출력·저장하지 않는다.
- 법안: collector/us/bills.py 가 받아 둔 data/us/bills/<id>.json 을 그대로 타임라인 사건으로 바꾼다(추가 호출 없음).
- 하원 표결: /house-vote/{congress}/{session}[/{roll}/members] 를 시간 예산 안에서 새 표결부터 받아 의원별 파일에 쌓는다.
- 상원 표결은 이 API에 아직 없다(status.json 의 notes 에 적음).
- 사건은 날짜와 사실만 담는다. 원인·평가 문구 없음.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data", "us")
OUT = os.path.join(D, "timeline")
CONG = int(os.environ.get("US_CONGRESS", "119"))
FIRST_YEAR = 2025 + (CONG - 119) * 2  # 119대 = 2025~2026
KEY = (os.environ.get("CONGRESS_API_KEY") or "").strip()
BASE = "https://api.congress.gov/v3"
UA = {"User-Agent": "money-tracker (github.com/91cleaner/money-tracker) public-data collector"}
CAST = {"yea": "Y", "aye": "Y", "yes": "Y", "nay": "N", "no": "N", "present": "P", "not voting": "X"}
NOTES = ["상원 표결은 Congress.gov API에 아직 없어 넣지 못했어요.",
         "Senate roll-call votes are not in the Congress.gov API yet, so they are not included."]


def log(*a):
    s = " ".join(str(x) for x in a)
    print(s.replace(KEY, "***") if KEY else s)


def get(path, **q):
    q.update(api_key=KEY, format="json")
    url = BASE + path + "?" + urllib.parse.urlencode(q)
    last = ""
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:  # 400/404 는 '아직 없음'
            last = "HTTP %s" % e.code
            if e.code in (400, 404):
                return {}
            time.sleep(2 * (i + 1))
        except Exception as e:
            last = type(e).__name__  # 주소(키 포함)는 찍지 않는다
            time.sleep(2 * (i + 1))
    log("::warning::congress timeline 요청 실패", path, last)
    return None


def write(path, obj):
    """내용이 같으면 쓰지 않는다(불필요한 커밋 방지). 바뀌었으면 True."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    try:
        if open(path, encoding="utf-8").read() == s:
            return False
    except OSError:
        pass
    open(path, "w", encoding="utf-8").write(s)
    return True


def load(path, default):
    try:
        return json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        return default


def bill_events(rows):
    """data/us/bills/<id>.json 행 → 사건. k: intro(발의) / pass(한쪽 통과) / law(법이 됨)"""
    ev = []
    for b in rows or []:
        t = (b.get("n") or b.get("no") or "")[:140]
        if b.get("d"):
            ev.append({"d": b["d"], "k": "intro", "t": t, "no": b.get("no"), "u": b.get("u")})
        if b.get("ad") and (b.get("law") or b.get("pass")):
            ev.append({"d": b["ad"], "k": "law" if b.get("law") else "pass", "t": t, "no": b.get("no"),
                       "a": (b.get("a") or "")[:120], "u": b.get("u")})
    return ev


def find_list(d, *keys):
    for k in keys:
        v = (d or {}).get(k)
        if isinstance(v, list):
            return v
        if isinstance(v, dict):
            for vv in v.values():
                if isinstance(vv, list):
                    return vv
    return []


def parse_member_votes(d):
    """/house-vote/.../members 응답 → (표결 정보, {bioguide: Y/N/P/X}). 필드명이 조금 달라도 견딘다."""
    root = (d or {}).get("houseRollCallVoteMemberVotes") or (d or {}).get("houseRollCallVote") or {}
    if not isinstance(root, dict):
        root = {}
    res = root.get("results")
    if not isinstance(res, list):
        res = find_list(root, "results", "memberVotes")
    cast = {}
    for r in res:
        bid = r.get("bioguideID") or r.get("bioguideId")
        c = CAST.get(str(r.get("voteCast") or "").strip().lower())
        if bid and c:
            cast[bid] = c
    return root, cast


def vote_event(session, num, info, item, cast_code):
    date = str(info.get("startDate") or item.get("startDate") or "")[:10]
    lt = info.get("legislationType") or item.get("legislationType") or ""
    ln = info.get("legislationNumber") or item.get("legislationNumber") or ""
    bill = (str(lt) + " " + str(ln)).strip()
    q = str(info.get("voteQuestion") or info.get("voteType") or item.get("voteType") or "")[:80]
    res = str(info.get("result") or item.get("result") or "")[:40]
    year = date[:4] or str(FIRST_YEAR + session - 1)
    return {"d": date, "k": "vote", "v": cast_code, "q": q, "no": bill or None, "r": res,
            "t": bill or q, "u": "https://clerk.house.gov/Votes/%s%s" % (year, num)}


def main():
    os.makedirs(OUT, exist_ok=True)
    stp = os.path.join(OUT, "status.json")
    if not KEY:
        log("::warning::congress timeline: CONGRESS_API_KEY 가 없어 건너뜀 (무료 키: https://api.congress.gov/sign-up/)")
        write(stp, {"status": "needs_key", "congress": CONG,
                    "ko": "Congress.gov 무료 키가 아직 없어요. 키를 넣으면 법안·표결 타임라인이 채워져요.",
                    "en": "A free Congress.gov API key is needed. Once it is added, the bill and vote timeline will fill in.",
                    "signup": "https://api.congress.gov/sign-up/"})
        return 0
    budget = float(os.environ.get("TIMELINE_BUDGET_SEC", str(14 * 60)))
    t0 = time.time()
    mem = load(os.path.join(D, "members.json"), {}).get("members") or []
    ids = [m["id"] for m in mem if m.get("id")]
    stpath = os.path.join(OUT, "_state.json")
    state = load(stpath, {})
    seen = set(state.get("seen") or [])
    votes = {}  # id -> 이번에 받은 표결 사건
    fetched = fails = 0
    for session in (1, 2):
        lst, off = [], 0
        while True:
            d = get("/house-vote/%d/%d" % (CONG, session), limit=250, offset=off)
            if d is None:
                fails += 1
                break
            part = find_list(d, "houseRollCallVotes")
            lst += part
            if len(part) < 250:
                break
            off += 250
        new = [x for x in lst if x.get("rollCallNumber") and "%d-%s" % (session, x["rollCallNumber"]) not in seen]
        new.sort(key=lambda x: -int(x["rollCallNumber"]))  # 새 표결부터
        for it in new:
            if time.time() - t0 > budget:
                break
            num = it["rollCallNumber"]
            d = get("/house-vote/%d/%d/%s/members" % (CONG, session, num))
            time.sleep(0.25)
            if d is None:
                fails += 1
                continue
            info, cast = parse_member_votes(d)
            if not cast:  # 결과가 아직 없는 표결은 다음에 다시
                continue
            for bid, c in cast.items():
                votes.setdefault(bid, []).append(vote_event(session, num, info, it, c))
            seen.add("%d-%s" % (session, num))
            fetched += 1
    changed = 0
    for mid in sorted(set(ids) | set(votes)):
        p = os.path.join(OUT, mid + ".json")
        keep = [e for e in load(p, {}).get("events") or [] if e.get("k") == "vote"]
        have = {e.get("u") for e in keep}
        keep += [e for e in votes.get(mid, []) if e["u"] not in have]
        ev = bill_events(load(os.path.join(D, "bills", mid + ".json"), [])) + keep
        ev.sort(key=lambda e: (e.get("d") or "", e.get("k") or ""), reverse=True)
        if not ev:
            if os.path.exists(p):
                os.remove(p)
            continue
        changed += write(p, {"id": mid, "congress": CONG, "events": ev})
    write(stpath, {"seen": sorted(seen)})
    st = {"status": "ok", "congress": CONG, "updated": time.strftime("%Y-%m-%d", time.gmtime()),
          "house_votes": len(seen), "notes": NOTES, "source": "Congress.gov API (Library of Congress)"}
    write(stp, st)
    log("congress timeline: 새 표결 %d, 누적 표결 %d, 바뀐 의원 파일 %d, 실패 %d" % (fetched, len(seen), changed, fails))
    return 0


if __name__ == "__main__":
    sys.exit(main())
