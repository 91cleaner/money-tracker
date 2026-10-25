"""PTR PDF 글자 모양 확인용(임시): data/us/_debug.txt"""
import io, re, zipfile, xml.etree.ElementTree as ET
import requests, pdfplumber
UA = {"User-Agent": "Mozilla/5.0 (money-tracker; public-data research)"}
z = zipfile.ZipFile(io.BytesIO(requests.get("https://disclosures-clerk.house.gov/public_disc/financial-pdfs/2026FD.zip", headers=UA, timeout=60).content))
root = ET.fromstring(z.read(next(n for n in z.namelist() if n.endswith(".xml"))))
docs = [m.findtext("DocID") for m in root.iter("Member") if m.findtext("FilingType") == "P"][-10:]
out = []
for d in docs:
    r = requests.get(f"https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/{d}.pdf", headers=UA, timeout=40)
    try:
        with pdfplumber.open(io.BytesIO(r.content)) as pdf:
            t = "\n".join((p.extract_text() or "") for p in pdf.pages)
    except Exception as e:
        t = f"ERR {e}"
    out.append(f"===== {d} ({len(t)} chars)\n{t[:3000]}")
open("data/us/_debug.txt", "w").write("\n".join(out))
