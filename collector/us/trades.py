"""미국 의원 주식 거래 신고(STOCK Act, Periodic Transaction Report): data/us/trades.json

하원: 하원 사무처(Clerk) 재산공개 — 해마다 {year}FD.zip 안 XML 색인에서 PTR(FilingType=P)을 골라
      전자 제출 PDF(ptr-pdfs/{year}/{DocID}.pdf)의 거래 줄을 읽는다(손글씨 스캔본은 건너뜀).
상원: 상원 윤리위 eFD(efdsearch.senate.gov) — 이용 동의 후 PTR 목록 JSON, 전자 제출 보고서 표를 읽는다.
이미 읽은 보고서는 done 에 남겨 다음엔 새 것만. 금액은 신고서 그대로 구간(예: $1,001 - $15,000).
"""
import io
import json
import os
import re
import sys
import time
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

import requests

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "us", "trades.json")
MEM = os.path.join(ROOT, "data", "us", "members.json")
UA = {"User-Agent": "Mozilla/5.0 (money-tracker; public-data research)"}
BUDGET = float(os.environ.get("TRADES_BUDGET_MIN", "15")) * 60
T0 = time.time()
KEEP_DAYS = 400
LOG = []

AMT = r"(?:\$[\d,]+\s*-\s*\$[\d,]+|Over \$[\d,]+|\$[\d,]+\s*\+?)"
ROW = re.compile(r"(?P<asset>[^\n]*?\((?P<tk>[A-Z][A-Z0-9.\-]{0,6})\)[^\n]*?)\s*\[(?P<at>[A-Z]{2})\]\s*(?P<ty>P|S \(partial\)|S|E)\s+(?P<d>\d{2}/\d{2}/\d{4})\s+(?P<n>\d{2}/\d{2}/\d{4})\s+(?P<amt>" + AMT + ")", re.S)


def iso(d):
    try:
        return datetime.strptime(d.strip(), "%m/%d/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def house(year, done, mem, out):
    r = requests.get(f"https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip", headers=UA, timeout=60)
    if r.status_code != 200:
        LOG.append(f"house {year} zip {r.status_code}")
        return
    z = zipfile.ZipFile(io.BytesIO(r.content))
    xmlname = next(n for n in z.namelist() if n.lower().endswith(".xml"))
    root = ET.fromstring(z.read(xmlname))
    import pdfplumber  # noqa: E402
    rows = [m for m in root.iter("Member") if (m.findtext("FilingType") or "") == "P"]
    LOG.append(f"house {year}: PTR {len(rows)}")
    by_sd = {}
    for m in mem:
        if m["chamber"] == "rep":
            by_sd.setdefault(f'{m["state"]}{int(m["district"] or 0):02d}', []).append(m)
    n = 0
    for x in sorted(rows, key=lambda e: e.findtext("FilingDate") or "", reverse=False):
        doc = x.findtext("DocID")
        if not doc or ("h" + doc) in done:
            continue
        if time.time() - T0 > BUDGET:
            LOG.append("house: 시간 상한")
            break
        last, first, sd = (x.findtext("Last") or "").strip(), (x.findtext("First") or "").strip(), (x.findtext("StateDst") or "").strip()
        cand = by_sd.get(sd[:2] + sd[2:].zfill(2), [])
        who = next((m for m in cand if last.lower() in m["name"].lower()), cand[0] if len(cand) == 1 else None)
        url = f"https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{doc}.pdf"
        try:
            pr = requests.get(url, headers=UA, timeout=40)
            if pr.status_code != 200:
                continue
            with pdfplumber.open(io.BytesIO(pr.content)) as pdf:
                text = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
        except Exception as e:  # 깨진 PDF 등
            LOG.append(f"house {doc}: {type(e).__name__}")
            done.add("h" + doc)
            continue
        text = re.sub(r"[\x00\u0000]", "", text)
        got = 0
        for mm in ROW.finditer(text):
            asset = re.sub(r"\s+", " ", mm.group("asset")).strip()
            asset = re.sub(r"^(SP|JT|DC)\s+", "", asset)
            out.append({"c": "h", "id": who["id"] if who else None, "who": f"{first} {last}".strip(), "tk": mm.group("tk"), "asset": asset[:80],
                        "at": mm.group("at"), "ty": mm.group("ty")[0], "d": iso(mm.group("d")), "fd": iso(mm.group("n")), "amt": re.sub(r"\s+", " ", mm.group("amt")), "doc": url})
            got += 1
        done.add("h" + doc)
        n += 1
        time.sleep(0.3)
    LOG.append(f"house {year}: 새 보고서 {n}")


def senate(done, mem, out, since):
    s = requests.Session(); s.headers.update(UA)
    base = "https://efdsearch.senate.gov"
    h = s.get(base + "/search/home/", timeout=40)
    tok = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', h.text)
    if not tok:
        LOG.append(f"senate: 동의 화면 못 읽음 {h.status_code}")
        return
    s.post(base + "/search/home/", data={"prohibition_agreement": "1", "csrfmiddlewaretoken": tok.group(1)}, headers={"Referer": base + "/search/home/"}, timeout=40)
    csrf = s.cookies.get("csrftoken")
    by_last = {}
    for m in mem:
        if m["chamber"] == "sen":
            by_last.setdefault(m["name"].split()[-1].lower(), []).append(m)
    start, n, total = 0, 0, None
    rows = []
    while True:
        r = s.post(base + "/search/report/data/", data={"start": start, "length": 100, "report_types": "[11]", "filer_types": "[]", "submitted_start_date": since.strftime("%m/%d/%Y 00:00:00"), "submitted_end_date": "", "candidate_state": "", "senator_state": "", "office_id": "", "first_name": "", "last_name": "", "csrfmiddlewaretoken": csrf},
                   headers={"Referer": base + "/search/", "X-CSRFToken": csrf or ""}, timeout=40)
        try:
            d = r.json()
        except ValueError:
            LOG.append(f"senate: 목록 {r.status_code}")
            return
        total = d.get("recordsTotal")
        rows += d.get("data") or []
        start += 100
        if start >= (total or 0) or not d.get("data"):
            break
    LOG.append(f"senate: PTR {total}")
    for first, last, _full, link, filed in rows:
        href = re.search(r'href="([^"]+)"', link)
        if not href or "/ptr/" not in href.group(1):
            continue  # 종이(스캔) 보고서는 건너뜀
        key = "s" + href.group(1).rstrip("/").split("/")[-1]
        if key in done:
            continue
        if time.time() - T0 > BUDGET:
            LOG.append("senate: 시간 상한")
            break
        pg = s.get(base + href.group(1), timeout=40)
        if pg.status_code != 200:
            continue
        lastn = re.sub(r"[^a-z]", "", (last or "").split(",")[0].lower())
        cand = by_last.get(lastn) or [m for k, v in by_last.items() if k.startswith(lastn[:5]) for m in v]
        who = cand[0] if len(cand) == 1 else next((m for m in cand if (first or "").split()[0].lower() in m["name"].lower()), None)
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", pg.text, re.S):
            td = [re.sub(r"<[^>]+>", " ", c) for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
            td = [re.sub(r"\s+", " ", c).strip() for c in td]
            if len(td) < 8 or not re.match(r"\d{2}/\d{2}/\d{4}", td[1]):
                continue
            tk = td[3] if td[3] not in ("--", "") else None
            ty = td[6][:1] if td[6] else ""
            out.append({"c": "s", "id": who["id"] if who else None, "who": f"{first} {last}".strip(), "tk": tk, "asset": td[4][:80], "at": td[5][:12], "ty": "S" if ty == "S" else ("P" if ty == "P" else ty),
                        "d": iso(td[1]), "fd": iso((filed or "").strip()[:10]), "amt": td[7], "doc": base + href.group(1)})
        done.add(key)
        n += 1
        time.sleep(0.4)
    LOG.append(f"senate: 새 보고서 {n}")


def main():
    mem = json.load(open(MEM, encoding="utf-8"))["members"]
    try:
        cur = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        cur = {"done": [], "trades": []}
    done, out = set(cur.get("done", [])), cur.get("trades", [])
    now = datetime.utcnow()
    for y in sorted({now.year - 1, now.year}):
        try:
            house(y, done, mem, out)
        except Exception as e:
            LOG.append(f"house {y} 실패: {type(e).__name__} {e}")
    try:
        senate(done, mem, out, now - timedelta(days=KEEP_DAYS))
    except Exception as e:
        LOG.append(f"senate 실패: {type(e).__name__} {e}")
    cut = (now - timedelta(days=KEEP_DAYS)).strftime("%Y-%m-%d")
    seen, keep = set(), []
    for t in sorted(out, key=lambda t: (t.get("fd") or "", t.get("d") or ""), reverse=True):
        k = (t["c"], t["who"], t.get("tk"), t.get("asset"), t.get("ty"), t.get("d"), t.get("amt"))
        if k in seen or (t.get("d") or "9") < cut:
            continue
        seen.add(k); keep.append(t)
    json.dump({"updated": now.strftime("%Y-%m-%d %H:%M UTC"), "source": "U.S. House Clerk financial disclosures · U.S. Senate eFD (STOCK Act periodic transaction reports)",
               "note": "Amounts are reported ranges. P=purchase, S=sale, E=exchange. Filings can be up to 45 days after the trade.",
               "log": LOG, "done": sorted(done), "trades": keep}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("trades:", len(keep), LOG)


if __name__ == "__main__":
    main()
