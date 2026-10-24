"""국민연금 기금운용본부 연간공시 '국내주식 종목별 투자 현황' 첨부파일 → data/nps/kr_holdings.json. Actions에서 실행."""
import io, json, os, re, time, urllib.parse, urllib.request, http.cookiejar
from datetime import datetime, timezone, timedelta
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "nps"); DBG = os.path.join(OUT, "debug"); os.makedirs(DBG, exist_ok=True)
BASE = "https://fund.nps.or.kr"
BOARD = BASE + "/impa/edwmpblnt/getOHEF0001M0.do?cat=YEA"
KST = timezone(timedelta(hours=9)); LOG = []
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
op.addheaders = [("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"), ("Accept-Language", "ko-KR,ko")]

def get(u, data=None, tries=3):
    for i in range(tries):
        try:
            r = op.open(urllib.request.Request(u, data=data, headers={"Referer": BOARD}), timeout=90)
            b = r.read(); LOG.append(f"OK {u[:120]} {len(b)}B {r.headers.get('Content-Type')}"); return b, r.headers
        except Exception as e:
            LOG.append(f"ERR {u[:120]} {type(e).__name__} {str(e)[:80]}"); time.sleep(5)
    raise RuntimeError(u)

def parse_xlsx(b):
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(b), data_only=True, read_only=True); rows = []
    for ws in wb.worksheets:
        for r in ws.iter_rows(values_only=True):
            rows.append([c for c in r])
    return rows

def main():
    html, _ = get(BOARD); h = html.decode("utf-8", "ignore"); open(os.path.join(DBG, "board.html"), "w").write(h)
    # 제목 근처의 상세 링크/식별자 찾기
    i = h.find("국내주식 종목별 투자 현황"); seg = h[max(0, i - 1500): i + 1500] if i >= 0 else ""
    open(os.path.join(DBG, "board_seg.html"), "w").write(seg)
    title = re.search(r"국내주식 종목별 투자 현황\((\d{4})년 말\)", h); year = title[1] if title else None
    sn = re.search(r"fnc_goBbsDetail\('(\d+)'\);\">국내주식 종목별 투자 현황", h)
    ids = []
    files = re.findall(r"atchFileId=(FL\d+)(?:&amp;|&)atchFileSn=(\d+)", seg) or re.findall(r"['\"](FL\d{8})['\"]\s*,\s*['\"]?(\d+)", seg)
    detail = None
    if sn:
        b, _ = get(BASE + "/impa/edwmpblnt/getOHEF0006M0.do", urllib.parse.urlencode({"tmpltdataSn": sn[1], "cat": "YEA"}).encode())
        detail = b.decode("utf-8", "ignore"); open(os.path.join(DBG, "detail.html"), "w").write(detail)
        files = re.findall(r"atchFileId=(FL\d+)(?:&amp;|&)atchFileSn=(\d+)", detail) or re.findall(r"\(\s*['\"](FL\d+)['\"]\s*,\s*['\"]?(\d+)", detail)
        LOG.append(f"detail sn={sn[1]} files={files[:5]}")
    pst = []
    if pst:
        for path in ("/impa/edwmpblnt/getOHEF0002M0.do", "/impa/edwmpblnt/getOHEF0001M1.do"):
            try:
                b, _ = get(f"{BASE}{path}?pstId={pst[0]}&cat=YEA"); detail = b.decode("utf-8", "ignore")
                open(os.path.join(DBG, "detail.html"), "w").write(detail)
                files = files or re.findall(r"atchFileId=(FL\d+)(?:&amp;|&)atchFileSn=(\d+)", detail) or re.findall(r"['\"](FL\d{8})['\"]\s*,\s*['\"]?(\d+)", detail)
                if files: break
            except RuntimeError: pass
    res = None
    for fid, sn in files:
        u = f"{BASE}/fileDown.do?atchFileId={fid}&atchFileSn={sn}"
        b, hd = get(u); cd = hd.get("Content-Disposition", ""); LOG.append("file " + urllib.parse.unquote(cd)[:120])
        if b[:2] == b"PK":
            rows = parse_xlsx(b); res = (u, rows); break
    if not res: raise RuntimeError("첨부 xlsx 못 찾음")
    u, rows = res
    hi = next(i for i, r in enumerate(rows) if r and any(isinstance(c, str) and "종목" in c for c in r))
    hdr = [str(c or "") for c in rows[hi]]
    col = lambda *ks: next(j for j, c in enumerate(hdr) if any(k in c for k in ks))
    jn, jv, jw, js = col("종목"), col("평가액"), col("비중"), col("지분율")
    asof = f"{year}-12-31" if year else None; out = []
    for r in rows[hi + 1:]:
        if not r or not r[jn] or not isinstance(r[jv], (int, float)): continue
        out.append({"company": str(r[jn]).strip(), "value_100m_krw": r[jv], "weight_pct": r[jw], "stake_pct": r[js], "as_of": asof, "source_url": u})
    out.sort(key=lambda x: -x["value_100m_krw"])
    for k, x in enumerate(out, 1): x["rank"] = k
    d = {"updated": datetime.now(KST).strftime("%Y-%m-%d %H:%M"), "as_of": asof, "unit": "평가액 억원, 비중·지분율 %",
         "source": f"국민연금 기금운용본부 연간공시 '국내주식 종목별 투자 현황({year}년 말)'", "board_url": BOARD, "detail": f"{BASE}/impa/edwmpblnt/getOHEF0006M0.do (tmpltdataSn={sn[1] if sn else ''}, POST)", "file_url": u,
         "count": len(out), "total_value_100m_krw": round(sum(x["value_100m_krw"] for x in out)),
         "top10": out[:10], "stake_5pct_plus": [x for x in out if (x["stake_pct"] or 0) >= 5], "holdings": out}
    json.dump(d, open(os.path.join(OUT, "kr_holdings.json"), "w"), ensure_ascii=False, indent=1)
    print(asof, len(out))

if __name__ == "__main__":
    try: main()
    finally: json.dump({"updated": datetime.now(KST).isoformat(), "log": LOG}, open(os.path.join(DBG, "kr_board_log.json"), "w"), ensure_ascii=False, indent=1)
