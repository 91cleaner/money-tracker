"""X·카카오톡 미리보기용 정적 공유 페이지 + 카드 이미지 (국민연금 투자 회사, 국회의원 출장).

미리보기는 자바스크립트를 실행하지 않으므로 og 태그를 가진 정적 HTML이 따로 있어야 한다(시는 share.py 의 c/<slug>.html).
  s/n/<코드 또는 티커>.html → nps.html?q=<이름>#find
  s/m/<의원 id>.html        → national.html?mp=<이름>
  data/og/s/...png           → 카드 이미지(내용이 같으면 같은 파일이 나와 저장소가 불지 않게 팔레트 PNG)
  data/og/s/index.json       → 어떤 공유 페이지가 있는지(화면의 '링크 복사'가 이걸 보고 공유 주소를 고름)
"""
import hashlib
import html
import json
import os
import re
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(__file__))
import share  # noqa: E402

ROOT = "."
KR_TOP, US_TOP = 150, 150
FG = re.compile(r"정부|대사관|국무부|정보방송부|감숙성|란저우|연방|인민대외우호협회|사회과학원")
SELF = re.compile(r"자비|자부담")
PUB = re.compile(r"외교부|국회미래연구원|국가지식재산위원회|한국국제교류재단|국회사무처")
PTY = re.compile(r"정당|더불어민주당|국민의힘")


def load(p, default=None):
    try:
        with open(os.path.join(ROOT, p), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def eok(n):
    """원 → '55조 1,095억원' (화면과 같은 꼴)."""
    n = round(n)
    if n >= 1e12:
        jo, e = divmod(n, 10**12)
        e = round(e / 1e8)
        return f"{jo:,}조" + (f" {e:,}억원" if e else "원")
    if n >= 1e8:
        return f"{round(n / 1e8):,}억원"
    return f"{round(n / 1e4):,}만원"


def ko_names():
    """nps-me.js 의 미국 회사 우리말 이름 표를 그대로 읽는다(한 곳에서만 관리)."""
    try:
        js = open(os.path.join(ROOT, "assets", "nps-me.js"), encoding="utf-8").read()
        body = js[js.index("const KO = {"):js.index("};", js.index("const KO = {"))]
        return dict(re.findall(r"'?([A-Z][A-Z0-9./]*)'?\s*:\s*'([^']+)'", body))
    except (OSError, ValueError):
        return {}


def tidy(n):
    n = re.sub(r"\b(CORPORATION|CORP|INCORPORATED|INC|CO|COM|LTD|PLC|HLDGS?|HLDNGS|HOLDINGS?|GROUP|TR|FD|NEW|CL [A-Z]|DEL|THE)\b\.?", "", str(n or ""), flags=re.I)
    return re.sub(r"\s{2,}", " ", n).strip().title()


PAGE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="website"><meta property="og:site_name" content="{site}">
<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}"><meta name="twitter:image" content="{img}">
<meta name="robots" content="noindex">
<link rel="canonical" href="{target}">
<meta http-equiv="refresh" content="0; url={rel}">
<script>location.replace({rel_js} + location.hash);</script>
</head><body style="font-family:sans-serif;padding:40px">
<p><a href="{rel}">{title} 보러 가기</a></p>
</body></html>
"""


def page(kind, key, title, desc, top, big, sub, rel, caveat=False):
    """공유 페이지 하나와 카드 이미지 하나. 내용이 같으면 파일도 같게(주소의 v 는 내용 해시)."""
    img_rel = f"data/og/s/{kind}/{key}.png"
    ok = share.card(os.path.join(ROOT, img_rel), top, big, sub, caveat=caveat)
    if ok:  # 팔레트로 줄여 파일을 작게(흰 바탕 글씨 카드라 32색이면 충분)
        from PIL import Image
        p = os.path.join(ROOT, img_rel)
        Image.open(p).convert("P", palette=Image.ADAPTIVE, colors=32).save(p, optimize=True)
    v = hashlib.sha1(f"{top}|{big}|{sub}|{caveat}".encode()).hexdigest()[:8]
    img = share.SITE_URL + (img_rel if ok else "assets/og.png") + f"?v={v}"
    target = share.SITE_URL + rel
    out = PAGE.format(title=html.escape(title), desc=html.escape(desc), site=share.SITE_NAME, url=f"{share.SITE_URL}s/{kind}/{key}.html",
                      img=img, target=html.escape(target), rel="../../" + html.escape(rel), rel_js=json.dumps("../../" + rel))
    d = os.path.join(ROOT, "s", kind)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, key + ".html"), "w", encoding="utf-8") as f:
        f.write(out)


def safe(k):
    return re.sub(r"[^A-Za-z0-9]", "_", str(k))


def nps():
    out = {}
    kr, hq = load("data/nps/kr_holdings.json"), load("data/nps/kr_hq_region.json", {})
    d5 = [x for x in (load("data/nps/dart5.json", {}) or {}).get("items", []) if x.get("stake") is not None]
    code = {c["company"]: c.get("code") for c in (hq or {}).get("companies", [])}
    if kr:
        rows = [x for x in kr["holdings"] if (x.get("value_100m_krw") or 0) > 0]
        want = {x["company"] for x in rows[:KR_TOP]} | {x["corp"] for x in d5}
        asof = kr.get("as_of", "")
        used = set()
        for i, x in enumerate(rows):
            if x["company"] not in want or not code.get(x["company"]):
                continue
            c = code[x["company"]]
            key = c if c not in used else f"{c}_{i + 1}"  # 우선주처럼 코드가 같은 경우
            used.add(key)
            last = next((y for y in d5 if y.get("code") == c or y["corp"] == x["company"]), None)
            sub = f"지분 {x['stake_pct']}% · 국내 주식 {len(rows):,}개 중 {i + 1}위 · {asof[:4]}년 말"
            if last:
                ch = f"{last['prev']:.2f}% → {last['stake']:.2f}%" if last.get("prev") is not None else f"{last['stake']:.2f}%"
                sub = f"최근 공시 {int(last['date'][5:7])}월 {int(last['date'][8:10])}일 지분 {ch} · 국내 {i + 1}위"
            v = x["value_100m_krw"] * 1e8
            page("n", key, f"국민연금이 가진 {x['company']} 주식 · {eok(v)}", f"국민연금은 {x['company']} 주식을 {eok(v)}어치 갖고 있어요. 공개 자료 정리, 투자 권유 아님.",
                 f"국민연금이 가진 {x['company']} 주식", eok(v), sub, "nps.html?q=" + quote(x["company"]) + "#find")
            out[x["company"]] = key
    ch = load("data/nps/changes_us.json")
    if ch:
        qb, qa = load(f"data/nps/holdings_us_{ch['to']}.json"), load(f"data/nps/holdings_us_{ch['from']}.json", {})
        tk = (load("data/nps/us_tickers.json", {}) or {}).get("cusip", {})
        ko = ko_names()
        if qb and qb.get("fx"):
            fx = qb["fx"]["usd_krw"]
            prev = {x["cusip"]: x["shares"] for x in (qa or {}).get("holdings", [])}
            prev.update({x["cusip"]: x["shares_prev_adj"] for x in ch.get("adjusted", [])})
            ql = f"{ch['to'][:4]}년 {ch['to'][-1]}분기"
            for i, x in enumerate(qb["holdings"][:US_TOP]):
                t = tk.get(x["cusip"])
                if not t:
                    continue
                name = ko.get(t) or tidy(x["issuer"])
                p = prev.get(x["cusip"], 0)
                if not p:
                    chg = f"{ch['to'][-1]}분기에 새로 삼"
                else:
                    d = (x["shares"] - p) / p * 100
                    chg = "주식 수 그대로" if abs(d) < 0.5 else f"{ch['from'][-1]}분기보다 {abs(d):.1f}% {'늘림' if d > 0 else '줄임'}"
                v = x["value_usd"] * fx
                page("n", safe(t), f"국민연금이 가진 {name}({t}) 주식 · 약 {eok(v)}", f"국민연금은 {name} 주식을 약 {eok(v)}어치 갖고 있어요({ql} 미국 공개 자료). 투자 권유 아님.",
                     f"국민연금이 가진 {name} 주식", "약 " + eok(v), f"미국 주식 {len(qb['holdings']):,}개 중 {i + 1}위 · {chg} · {ql}", "nps.html?q=" + quote(name) + "#find")
                out[name] = safe(t)
    return out


def mps():
    out = {}
    mem, trw = load("data/national/members.json", {}), load("data/national/trips_raw.json", {})
    by = {}
    for t in (trw or {}).get("trips", []):
        if t.get("member_id"):
            by.setdefault(t["member_id"], {})[t["trip_id"]] = t
    for m in (mem or {}).get("members", []):
        ts = list(by.get(m["id"], {}).values())
        if not ts:
            continue

        def ext(t):
            f = str(t.get("funder") or "")
            return bool(FG.search(f)) or any(x.strip() and not SELF.search(x) and not PUB.search(x) and not PTY.search(x) for x in re.split(r"[,/·]", f))
        e = sum(1 for t in ts if ext(t))
        nr = sum(1 for t in ts if t.get("report") != "유")
        dest = []
        for t in ts:
            for d in t.get("dest") or []:
                d = "오스트리아" if d == "오스크리아" else d
                if d not in dest:
                    dest.append(d)
        bits = [f"외부에서 낸 비용 {e}건" if e else "", f"결과보고서 없이 신고 {nr}건" if nr else "", "·".join(dest[:3]) + (" 외" if len(dest) > 3 else "")]
        sub = " · ".join(b for b in bits if b)
        page("m", safe(m["id"]), f"{m['name']} 의원 국외 출장 {len(ts)}건 · {m['party']}", f"{m['name']} 의원({m['party']}, {m['district']}) 국외 출장 신고 {len(ts)}건. 열린국회정보 공개 기록.",
             f"{m['name']} 의원 · {m['party']}", f"국외 출장 {len(ts)}건", sub, "national.html?mp=" + quote(m["name"]), caveat=bool(e or nr))
        out[m["name"]] = safe(m["id"])
    return out


def main(root="."):
    global ROOT
    ROOT = root
    idx = {"nps": nps(), "mp": mps()}
    os.makedirs(os.path.join(ROOT, "data", "og", "s"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "og", "s", "index.json"), "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print("share_more:", {k: len(v) for k, v in idx.items()})


if __name__ == "__main__":
    main(*(sys.argv[1:2] or ["."]))
