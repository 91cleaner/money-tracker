"""본회의 표결 참여: data/national/vote_rate.json

22대 국회 본회의에서 전자 표결한 모든 안건의 의원별 결과(찬성·반대·기권·불참)를 센다.
이미 센 안건은 done 에 남겨 다음 번엔 새 안건만 받는다(한 번에 오래 걸리지 않게 시간 상한).
참여 = 찬성+반대+기권, 대상 = 참여+불참(그 표결 때 의원이었던 사람만 명단에 있다).
공식 표결 기록을 센 것일 뿐, 불참에는 공무·병가 등 사정이 있을 수 있다.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import collect as C  # noqa: E402

OUT = os.path.join(C.OUT, "vote_rate.json")
CODE = {"찬성": 0, "반대": 1, "기권": 2, "불참": 3}
BUDGET = float(os.environ.get("VOTES_BUDGET_MIN", "20")) * 60


def main():
    if not C.AK:
        print("votes_all: ASSEMBLY_KEY 없음, 건너뜀")
        return
    try:
        cur = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        cur = {"done": [], "m": {}}
    done, M = set(cur.get("done", [])), cur.get("m", {})
    plen = C.api("nwbpacrgavhjryiph", AGE="22", pSize=1000)
    if not plen:
        print("::warning::votes_all: 본회의 처리안건을 못 받아 이전 자료 유지")
        return
    todo = [b for b in plen if int(b.get("VOTE_TCNT") or 0) > 0 and b.get("BILL_ID") and b["BILL_ID"] not in done]
    todo.sort(key=lambda b: b.get("RGS_PROC_DT") or b.get("PROC_DT") or "")
    t0, got = time.time(), 0
    for b in todo:
        if time.time() - t0 > BUDGET:
            break
        rows = C.api("nojepdqqaweusdfbi", AGE="22", BILL_ID=b["BILL_ID"], pSize=300)
        if not rows:
            continue  # 못 받은 안건은 다음 번에 다시
        for r in rows:
            mid = r.get("MONA_CD")
            k = CODE.get((r.get("RESULT_VOTE_MOD") or "").strip())
            if mid and k is not None:
                M.setdefault(mid, [0, 0, 0, 0])[k] += 1
        done.add(b["BILL_ID"]); got += 1
        time.sleep(0.15)
    total = sum(1 for b in plen if int(b.get("VOTE_TCNT") or 0) > 0)
    out = {"updated": time.strftime("%Y-%m-%d %H:%M"), "source": "열린국회정보 본회의 처리안건·의원 표결 정보",
           "note": "m: 의원코드 → [찬성, 반대, 기권, 불참]. 참여율 = (찬성+반대+기권) ÷ 전체. 불참에는 공무·병가 등 사정이 있을 수 있음.",
           "bills_total": total, "bills_done": len(done), "done": sorted(done), "m": M}
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"votes_all: 이번에 {got}건, 누적 {len(done)}/{total}건, 의원 {len(M)}명")


if __name__ == "__main__":
    main()
