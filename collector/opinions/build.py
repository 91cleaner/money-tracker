"""'남들 의견' 수집기: 드롭 파일 검증 -> data/opinions/index.json (종목별 최신순). 표준 라이브러리만, 외부 호출 없음.

입력: data/opinions/YYYY-MM-DD.json (봇이 무료 X 읽기로 채움), data/opinions/auto/*.json (fetch_exec.py 가 SEC/IR 에서 채움)
설정: data/opinions/accounts.json
실행: python3 collector/opinions/build.py [--today YYYY-MM-DD]
"""
import glob, json, os, re, sys
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OP = os.path.join(ROOT, "data", "opinions")
ROLES = {"analyst", "trader", "influencer", "exec"}
SOURCES = {"x", "sec8k", "ir_rss"}
LANGS = {"ko", "en"}
MAX_TEXT = 280        # 드롭 파일 원문 상한
MAX_QUOTE = 160       # 화면 인용(1~2줄) 상한
KEEP_DAYS = 45
PER_TICKER_OPINIONS = 5
PER_TICKER_EXEC = 3
X_HOSTS = {"x.com", "www.x.com", "twitter.com", "www.twitter.com"}
# 투자 조언·원인 단정 표현이 든 글은 싣지 않는다 (analyze 엔진 BANNED 와 같은 기준 + 목표가류)
BANNED = ["때문에", "추천", "매수", "매도", "목표가", "recommend", "should buy", "should sell",
          "buy rating", "price target", "because of"]
ID_RE = re.compile(r"^[A-Za-z0-9_.\-]{1,80}$")
TICKER_RE = re.compile(r"^[A-Z0-9][A-Z0-9.\-]{0,11}$")


def banned_hit(text):
    low = (text or "").lower()
    return next((w for w in BANNED if w.lower() in low), None)


def short_quote(text, limit=MAX_QUOTE):
    """줄바꿈·URL 정리 후 limit 자 이내로 자른다(단어 경계, 끝에 …)."""
    t = re.sub(r"https?://\S+", "", text or "")
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) <= limit:
        return t
    cut = t[:limit - 1]
    sp = cut.rfind(" ")
    if sp > limit * 0.6:
        cut = cut[:sp]
    return cut.rstrip(" ,.;:") + "…"


def parse_ts(s):
    try:
        return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def load_accounts(path=None):
    path = path or os.path.join(OP, "accounts.json")
    with open(path, encoding="utf-8") as f:
        j = json.load(f)
    return {a["handle"].lower(): a for a in j.get("accounts", [])}


def check_item(it, accounts):
    """문제가 있으면 이유(str), 없으면 None."""
    if not isinstance(it, dict):
        return "객체 아님"
    for k in ("id", "handle", "name", "role", "tickers", "text", "lang", "created_at", "url", "source"):
        if k not in it:
            return "필드 없음: " + k
    for k in ("id", "handle", "name", "text", "lang", "created_at", "url", "source", "role"):
        if not isinstance(it[k], str) or not it[k].strip():
            return "문자열 아님/빈 값: " + k
    if not ID_RE.match(it["id"]):
        return "id 형식"
    if it["role"] not in ROLES:
        return "role"
    if it["source"] not in SOURCES:
        return "source"
    if it["lang"] not in LANGS:
        return "lang"
    if len(it["text"]) > MAX_TEXT:
        return "text %d자 > %d" % (len(it["text"]), MAX_TEXT)
    if not isinstance(it["tickers"], list) or not it["tickers"] or not all(isinstance(t, str) and TICKER_RE.match(t) for t in it["tickers"]):
        return "tickers"
    if parse_ts(it["created_at"]) is None:
        return "created_at (YYYY-MM-DDTHH:MM:SSZ)"
    u = urlparse(it["url"])
    if u.scheme != "https" or not u.netloc:
        return "url 은 https 원문 링크여야 함"
    if it["source"] == "x":
        if u.netloc.lower() not in X_HOSTS:
            return "x 글 url 호스트"
        acc = accounts.get(it["handle"].lower())
        if not acc:
            return "accounts.json 에 없는 계정"
        if acc["role"] != it["role"]:
            return "role 이 accounts.json 과 다름"
    else:
        if it["role"] != "exec":
            return "sec8k/ir_rss 는 role=exec 만"
        if u.netloc.lower() in X_HOSTS:
            return "공식 출처 url 이 아님"
    hit = banned_hit(it["text"])
    if hit:
        return "금지 표현: " + hit
    return None


def read_drops(op_dir=OP):
    files = sorted(glob.glob(os.path.join(op_dir, "20??-??-??.json")) + glob.glob(os.path.join(op_dir, "auto", "*.json")))
    for fp in files:
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, list):
            yield fp, None, "최상위가 배열 아님"
            continue
        for it in data:
            yield fp, it, None


def build(op_dir=OP, answers_dir=None, today=None):
    answers_dir = answers_dir or os.path.join(ROOT, "data", "answers")
    today = today or date.today()
    tracked = {os.path.basename(p)[:-5].upper() for p in glob.glob(os.path.join(answers_dir, "*.json")) if not os.path.basename(p).startswith("_")}
    accounts = load_accounts(os.path.join(op_dir, "accounts.json"))
    oldest = datetime.combine(today - timedelta(days=KEEP_DAYS), datetime.min.time(), tzinfo=timezone.utc)
    seen, rejected, per = set(), [], {}
    for fp, it, err in read_drops(op_dir):
        rel = os.path.relpath(fp, op_dir)
        if err:
            rejected.append((rel, err))
            continue
        err = check_item(it, accounts)
        if err:
            rejected.append((rel + ":" + str(it.get("id") if isinstance(it, dict) else "?"), err))
            continue
        key = (it["source"], it["id"])
        if key in seen:
            continue                     # 중복 id 제거
        seen.add(key)
        if parse_ts(it["created_at"]) < oldest:
            continue
        acc = accounts.get(it["handle"].lower(), {})
        for t in dict.fromkeys(it["tickers"]):
            if t not in tracked:
                continue                 # 추적 종목만
            if it["role"] == "exec" and acc.get("company_ticker") and acc["company_ticker"] != t:
                continue
            per.setdefault(t, []).append({
                "id": it["id"], "handle": it["handle"], "name": it["name"], "role": it["role"],
                "title": it.get("title") or acc.get("title") or ("CEO" if it["role"] == "exec" else ""),
                "text": short_quote(it["text"]), "lang": it["lang"], "created_at": it["created_at"],
                "url": it["url"], "source": it["source"]})
    tickers = {}
    for t, rows in sorted(per.items()):
        rows.sort(key=lambda r: (r["created_at"], r["id"]), reverse=True)
        tickers[t] = {"opinions": [r for r in rows if r["role"] != "exec"][:PER_TICKER_OPINIONS],
                      "exec": [r for r in rows if r["role"] == "exec"][:PER_TICKER_EXEC]}
    out = {"asof": today.isoformat(), "note": "남들 의견: 각 작성자의 의견이며 사실 확인 아님. 투자 조언 아님.", "tickers": tickers}
    return out, rejected


def main(argv):
    today = date.fromisoformat(argv[argv.index("--today") + 1]) if "--today" in argv else None
    out, rejected = build(today=today)
    for where, why in rejected:
        print("::warning::의견 버림 %s — %s" % (where, why))
    with open(os.path.join(OP, "index.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("종목 %d개, 버림 %d건" % (len(out["tickers"]), len(rejected)))


if __name__ == "__main__":
    main(sys.argv[1:])
