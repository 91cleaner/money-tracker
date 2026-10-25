"""외교·안보 공식 기록(의원별): data/national/security.json

모두 열린국회정보 공식 기록 그대로이고, 사이트가 성향을 판단하거나 딱지를 붙이지 않는다.
  1) 본회의 표결: 외교·안보 관련 안건(국방·외교통일·정보위원회 소관이거나, 제목에 외교·안보 낱말이 있는 결의안 등) 중
     찬성 말고 반대·기권이 있었던 것만 골라(만장일치는 비교할 게 없어서), 의원마다 찬성·반대·기권을 남긴다.
  2) 대표 발의: 같은 세 위원회 소관 법안 중 그 의원이 대표로 낸 것.
  3) 징계안: 국회에 제출된 의원 징계안(제목·제출일·처리 결과·원문 링크).
API가 응답하지 않으면 이전 파일을 그대로 둔다.
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import collect as C  # noqa: E402  같은 api() 사용(키·재시도·기록)

OUT = os.path.join(C.OUT, "security.json")
SEC_CMT = ("국방위원회", "외교통일위원회", "정보위원회")
KW = re.compile(r"외교|안보|국방|군사|방위|북한|대북|남북|통일|한미|한일|한중|미국|일본|중국|러시아|동맹|독도|위안부|강제동원|후쿠시마|오염수|간첩|병역|전쟁|핵|미사일|NATO|나토|우크라이나|이스라엘|대만")
VOTE = {"찬성": "Y", "반대": "N", "기권": "A", "불참": "X"}


def pick(row, *names):
    for n in names:
        if row.get(n) not in (None, ""):
            return row[n]
    return None


def main():
    if not C.AK:
        print("votes: ASSEMBLY_KEY 없음, 건너뜀")
        return
    try:
        old = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        old = None
    plen = C.api("nwbpacrgavhjryiph", AGE="22", pSize=1000)
    if not plen:
        print("::warning::votes: 본회의 처리안건을 못 받아 이전 자료 유지")
        return
    sel = []
    for b in plen:
        name = b.get("BILL_NM") or ""
        cmt = b.get("COMMITTEE_NM") or ""
        no = int(b.get("NO_TCNT") or 0) + int(b.get("BLANK_TCNT") or 0)
        if (cmt in SEC_CMT or KW.search(name)) and no >= 3 and int(b.get("VOTE_TCNT") or 0) > 0:
            sel.append({"id": b["BILL_ID"], "no": b.get("BILL_NO"), "name": name, "kind": b.get("BILL_KIND"), "cmt": cmt,
                        "date": (b.get("RGS_PROC_DT") or b.get("PROC_DT") or "")[:10], "result": b.get("PROC_RESULT_CD"),
                        "yes": int(b.get("YES_TCNT") or 0), "nay": int(b.get("NO_TCNT") or 0), "blank": int(b.get("BLANK_TCNT") or 0),
                        "link": b.get("LINK_URL")})
    sel.sort(key=lambda x: x["date"], reverse=True)
    sel = sel[:120]
    votes, fields = {}, None
    for b in sel:
        rows = C.api("nojepdqqaweusdfbi", AGE="22", BILL_ID=b["id"], pSize=300)
        if rows and not fields:
            fields = sorted(rows[0].keys())
        for r in rows:
            mid = pick(r, "MONA_CD", "NAAS_CD")
            v = VOTE.get((pick(r, "RESULT_VOTE_MOD", "VOTE_RESULT", "RESULT") or "").strip())
            if mid and v:
                votes.setdefault(mid, {})[b["id"]] = v
        time.sleep(0.2)
    if sel and not votes:
        print("::warning::votes: 표결 결과를 하나도 못 받아 이전 자료 유지", fields)
        return
    vstr = {m: "".join(v.get(b["id"], "-") for b in sel) for m, v in votes.items()}
    # 대표 발의(모든 법안): 의원마다 총 건수·통과 건수·최근 8건(외교·안보 위원회 소관은 표시)
    lead, stat = {}, {}
    for r in C.api("nzmimeepazxkubdpn", AGE="22", pSize=1000):
        mid = r.get("RST_MONA_CD")
        if not mid:
            continue
        res = r.get("PROC_RESULT") or ""
        st = stat.setdefault(mid, [0, 0, 0])
        st[0] += 1
        if re.search(r"가결|대안반영|수정", res):
            st[1] += 1
        if (r.get("COMMITTEE") or "") in SEC_CMT:
            st[2] += 1
        lead.setdefault(mid, []).append({"n": r.get("BILL_NAME"), "d": (r.get("PROPOSE_DT") or "")[:10], "r": res or None,
                                         "id": r.get("BILL_ID"), "s": 1 if (r.get("COMMITTEE") or "") in SEC_CMT else 0})
    for mid in lead:
        lead[mid] = sorted(lead[mid], key=lambda x: x["d"], reverse=True)[:8]
    # 징계안
    disc = []
    for r in C.api("BILLRCP", ERACO="제22대", BILL_KIND="징계안", pSize=1000):
        nm = r.get("BILL_NM") or ""
        m = re.match(r"국회의원\s*\(([^)]+)\)\s*징계안", nm)
        if not m:
            continue
        who = [w.strip() for w in re.split(r"[·,ㆍ\s]+", m.group(1)) if w.strip()]
        disc.append({"name": nm, "who": who, "date": (r.get("PPSL_DT") or "")[:10], "result": r.get("PROC_RSLT"), "id": r.get("BILL_ID")})
    disc.sort(key=lambda x: x["date"], reverse=True)
    out = {"updated": time.strftime("%Y-%m-%d %H:%M"), "source": "열린국회정보(본회의 처리안건·의원 표결·발의법률안·의안 접수목록)",
           "rule": "국방·외교통일·정보위원회 소관이거나 제목에 외교·안보 낱말이 있는 본회의 안건 중 반대·기권이 3표 이상 있었던 것(최근 120건). 판단 없이 공식 표결 그대로.",
           "bill_url": "https://likms.assembly.go.kr/bill/billDetail.do?billId=", "vote_fields": fields,
           "bills": [{k: v for k, v in b.items() if k != "link"} for b in sel], "votes": vstr, "lead": lead, "lead_stat": stat, "discipline": disc}
    if old and not disc and old.get("discipline"):
        out["discipline"] = old["discipline"]
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"votes: 안건 {len(sel)}, 표결 의원 {len(votes)}, 대표발의 의원 {len(lead)}, 징계안 {len(disc)}")


if __name__ == "__main__":
    main()
