"""Actions 안에서 지방재정365 페이지를 브라우저로 열어 데이터셋 요청주소(pdtaId)를 찾는다. 키 사용 안 함."""
import re, json, os
from playwright.sync_api import sync_playwright
out = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.on("response", lambda r: out.append(r.url) if ".do" in r.url else None)
    pg.goto("https://www.lofin365.go.kr/portal/LF8310100.do?dtsSnum=655943&curPage=1", wait_until="domcontentloaded", timeout=90000)
    pg.wait_for_timeout(10000)
    t = pg.inner_text("body")
    print("XHR:", sorted(set(u.split("?")[0] for u in out))[:30])
    for l in t.splitlines():
        if re.search(r"행사|축제|보조금|xlsx|첨부", l): print("TXT", l.strip()[:150])
    h = pg.content()
    for m in sorted(set(re.findall(r"pdtaId=[A-Z0-9]+|fileDown[^\"' ]{0,120}|atchFile[^\"' ]{0,80}", h)))[:30]: print("H", m)
    try:
        with pg.expect_download(timeout=20000) as dl:
            pg.locator("a:has-text('다운로드'), button:has-text('다운로드'), a:has-text('.xlsx')").first.click()
        path = dl.value.path(); print("DL", dl.value.suggested_filename)
        import openpyxl
        import shutil; shutil.copy(path, "/tmp/list.xlsx"); wb = openpyxl.load_workbook("/tmp/list.xlsx", read_only=True)
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                s = " | ".join(str(c) for c in row if c)
                if re.search(r"행사|축제|보조|원가", s): print("ROW", s[:300])
    except Exception as e: print("DL err", e)
