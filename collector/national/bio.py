"""의원 프로필: data/national/bio.json  (국회 공개 약력 그대로, 줄만 정리)

출처: 열린국회정보 ALLNAMEMBER(collect.py 가 members_hist22.json 에 남긴 BRF_HST·BIRDY_DT).
  y: 태어난 해, edu: 학력 줄, hist: 경력 줄(앞 14줄). 약력 글 모양이 의원마다 달라서
  '<학력>' 칸이 있으면 그 아래를, 없으면 학교·졸업·학위 낱말이 있는 줄을 학력으로 본다.
"""
import html
import json
import os
import re

D = os.path.join(os.path.dirname(__file__), "..", "..", "data", "national")
EDU = re.compile(r"(초등학교|중학교|고등학교|대학교|대학원|대학\b|대학 |졸업|학사|석사|박사|수료|고졸|고교)")
NOT_EDU = re.compile(r"(교수|총장|강사|위원|이사|원장|회장|부회장|연구원|객원|학생회|동문|부처장|실장|겸임)")


def lines(t):
    t = html.unescape(t or "").replace("\r", "")
    out = []
    for x in t.split("\n"):
        x = re.sub(r"^\s*[-·•▶▷■□◆◇●○◦*※]+\s*", "", x).strip()
        if x:
            out.append(x)
    return out


def split(t):
    L = lines(t)
    sec, edu, hist = None, [], []
    for x in L:
        core = re.sub(r"[^가-힣]", "", x)
        if len(core) <= 7 and re.search(r"학력|경력|약력", core) and len(x) <= 14:  # '<학력>', '▷학력사항', 'ㅇ경력', '학력 -' 같은 제목 줄
            sec = "edu" if "학력" in core else "hist"
            continue
        if sec == "edu":
            edu.append(x)
        elif sec == "hist":
            hist.append(x)
        elif EDU.search(x) and not NOT_EDU.search(x) and not re.match(r"^(前|전\)|현\)|現)", x):
            edu.append(x)
        else:
            hist.append(x)
    return edu[:6], hist[:14]


def main():
    mem = json.load(open(os.path.join(D, "members.json"), encoding="utf-8"))["members"]
    hist = json.load(open(os.path.join(D, "members_hist22.json"), encoding="utf-8"))
    out = {}
    for m in mem:
        rows = [r for r in hist.get(m["name"], []) if r.get("NAAS_CD") == m["id"]] or hist.get(m["name"], [])[:1]
        if not rows:
            continue
        r = rows[0]
        edu, hs = split(r.get("BRF_HST"))
        y = (r.get("BIRDY_DT") or "")[:4]
        out[m["id"]] = {k: v for k, v in {"y": int(y) if y.isdigit() else None, "edu": edu, "hist": hs}.items() if v}
    json.dump({"source": "열린국회정보 국회의원 정보(ALLNAMEMBER) 약력", "members": out},
              open(os.path.join(D, "bio.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"bio: {len(out)}명, 학력 있음 {sum(1 for v in out.values() if v.get('edu'))}명")


if __name__ == "__main__":
    main()
