"""결과 검사: python3 scripts/analyze/verify.py [폴더=data/answers]
1) 숫자 원본 대조: 각 종목 기간 수익률을 원본 가격 파일에서 다시 계산해 비교(허용오차 0.01%p).
2) 금지어(때문에/추천/매수/매도 등) 검사: 생성 문장·사건 제목 전체.
3) 구조 검사: KO/EN 문장 수 일치, 출처 링크 존재, 반응 표본 수 표기.
하나라도 실패하면 종료코드 1 → 워크플로가 배포(커밋)하지 않는다.
"""
import json, os, sys, glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import D, PERIODS, banned_hit, jload, load_series, period_return


def check(folder):
    errs = []
    ser = load_series()
    files = [f for f in glob.glob(os.path.join(folder, "*.json")) if not os.path.basename(f).startswith("_")]
    if len(files) < 100:
        errs.append("종목 파일이 너무 적음: %d" % len(files))
    for f in files:
        raw = open(f, encoding="utf-8").read()
        j = json.loads(raw)
        sym = j["symbol"]
        for w in banned_hit(raw):
            errs.append("%s: 금지어 '%s'" % (sym, w))
        s = ser.get(sym)
        if s is None:
            errs.append("%s: 원본 가격 없음" % sym)
            continue
        if j["last"] != s[1][-1] or j["asof"] != s[0][-1]:
            errs.append("%s: 마지막 종가 불일치" % sym)
        for p, pr in j["periods"].items():
            r = period_return(s, PERIODS[p])
            if not r or abs(r[2] - pr["ret"]) > 0.01 or r[0] != pr["from"] or r[1] != pr["to"]:
                errs.append("%s %s: 수익률 불일치 %s vs %s" % (sym, p, r, pr["ret"]))
            b = pr.get("bench")
            if b:
                bs = ser.get(b["id"])
                br = period_return(bs, PERIODS[p]) if bs else None
                if not br or abs(br[2] - b["ret"]) > 0.01 or abs((pr["ret"] - br[2]) - b["diff"]) > 0.02:
                    errs.append("%s %s: 비교 지수 불일치" % (sym, p))
        for it, per in j["answers"].items():
            for p, a in per.items():
                if p not in j["periods"]:
                    errs.append("%s %s %s: 기간 값 없는 답" % (sym, it, p))
                if len(a["ko"]) != len(a["en"]) or not a["ko"]:
                    errs.append("%s %s %s: KO/EN 문장 수 불일치" % (sym, it, p))
                if not a["src"]:
                    errs.append("%s %s %s: 출처 없음" % (sym, it, p))
                for e in a["events"]:
                    if not e["u"].startswith("http"):
                        errs.append("%s %s: 사건 출처 링크 없음" % (sym, it))
                rc = a.get("reaction")
                if rc and (rc["n"] < 1 or ("표본 %d건" % rc["n"]) not in " ".join(a["ko"])):
                    errs.append("%s %s %s: 표본 수 표기 누락" % (sym, it, p))
    tp = os.path.join(folder, "_trends.json")
    if not os.path.exists(tp):
        errs.append("_trends.json 없음")
    else:
        raw = open(tp, encoding="utf-8").read()
        t = json.loads(raw)
        for w in banned_hit(raw):
            errs.append("_trends: 금지어 '%s'" % w)
        if not t.get("top_movers_1w"):
            errs.append("_trends: top_movers_1w 비어 있음")
        for m in t.get("top_movers_1w", []):
            s = ser.get(m["symbol"])
            r = period_return(s, 7) if s else None
            if not r or abs(r[2] - m["ret"]) > 0.01:
                errs.append("_trends: %s 수익률 불일치" % m["symbol"])
    return errs, len(files)


if __name__ == "__main__":
    folder = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, "answers")
    errs, n = check(folder)
    for e in errs[:50]:
        print("FAIL", e)
    print("검사 종목 %d, 오류 %d" % (n, len(errs)))
    sys.exit(1 if errs else 0)
