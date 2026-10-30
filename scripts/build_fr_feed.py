#!/usr/bin/env python3
"""대통령 문서(행정명령·각서·포고 등) → data/fr/presidential.json (알림바·관제실 카드용).
입력: data/us/whitehouse.json(scripts/collect_whitehouse.py가 Federal Register API로 수집, 키 불필요), data/us/prices/*.json.
쉬운 한국어·영어 문구는 분류 키워드로 만든 고정 문장이다(번역·요약 아님, AI 미사용).
주가는 '같은 기간 ~이 있었어요'로만 적는다. 원인 단정·투자 조언 아님.
  python3 scripts/build_fr_feed.py"""
import datetime as dt, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "us", "whitehouse.json"); OUT = os.path.join(ROOT, "data", "fr", "presidential.json")
TYPE_EN = {"행정명령": "Executive order", "포고문": "Proclamation", "대통령 메모": "Presidential memorandum", "대통령 결정": "Presidential determination", "대통령 공고": "Presidential notice", "대통령 조치": "Presidential action"}
TOP = {"tariff": ("관세", "tariffs"), "import_232": ("수입 제한", "import limits"), "export_control": ("수출 통제", "export controls"), "sanctions": ("제재", "sanctions")}
SEC = {"semiconductor": ("반도체", "chips"), "tech_ai": ("AI·기술", "AI & tech"), "energy": ("에너지", "energy"), "clean_energy": ("청정에너지", "clean energy"), "battery_ev": ("배터리·광물", "batteries & minerals"),
       "auto": ("자동차", "cars"), "health": ("제약·헬스", "health & drugs"), "defense": ("국방", "defense"), "shipbuilding": ("조선·해운", "shipping"), "industrial": ("철강·산업", "steel & industry"),
       "finance": ("금융", "finance"), "crypto": ("가상자산", "crypto"), "consumer": ("소비재·농식품", "consumer & food"), "housing": ("주택", "housing")}
CTRY = {"cn": ("중국", "China"), "ca": ("캐나다", "Canada"), "mx": ("멕시코", "Mexico"), "jp": ("일본", "Japan"), "kr": ("한국", "Korea"), "tw": ("대만", "Taiwan"), "eu": ("EU", "EU"), "in": ("인도", "India"),
        "br": ("브라질", "Brazil"), "ru": ("러시아", "Russia"), "ir": ("이란", "Iran"), "ve": ("베네수엘라", "Venezuela"), "vn": ("베트남", "Vietnam")}
def load(p):
    try: return json.load(open(p))
    except Exception: return {}
def move(sym, day, n=5):
    """서명일(없으면 게재일) 종가 → n거래일 뒤 종가 변화율(%). 기록이 모자라면 None."""
    p = load(os.path.join(ROOT, "data", "us", "prices", sym + ".json")); D, C = p.get("d") or [], p.get("c") or []
    i = max([k for k, d in enumerate(D) if d <= day], default=-1)
    if i < 0 or i + n >= len(D) or not C[i]: return None
    return {"sym": sym, "from": D[i], "to": D[i + n], "pct": round((C[i + n] / C[i] - 1) * 100, 1)}
def sector_syms():
    """업종 id → 같은 업종 종목 기호(주가 파일이 있는 앞쪽 2개). 고른 기준은 company-links.json 순서일 뿐 추천 아님."""
    out = {}
    for c in load(os.path.join(ROOT, "data", "market", "company-links.json")).get("companies") or []:
        sym = c.get("symbol") or ""
        if not sym or "." in sym or sym.startswith("^") or not os.path.exists(os.path.join(ROOT, "data", "us", "prices", sym + ".json")): continue
        for x in c.get("sectors") or []:
            if len(out.setdefault(x["id"], [])) < 2: out[x["id"]].append(sym)
    return out
def sentences(it, mv):
    t = it["type"]; top = [TOP[x] for x in it["topics"] if x in TOP]; sec = [SEC[x] for x in it["sectors"] if x in SEC][:2]; ct = [CTRY[x] for x in it["countries"] if x in CTRY][:2]
    ko_bits = [b[0] for b in top + sec + ct]; en_bits = [b[1] for b in top + sec + ct]
    ko = f"미국 대통령의 {t}이에요. " + (f"제목에 {', '.join(ko_bits)} 이야기가 나와요." if ko_bits else "제목만으로는 어떤 분야인지 알기 어려워요. 원문을 눌러 보세요.")
    en = f"A U.S. {TYPE_EN.get(t, 'presidential document').lower()}. " + (f"The title mentions: {', '.join(en_bits)}." if en_bits else "The title doesn't say which area it covers. Tap to read the original.")
    mk = mke = None
    if mv:
        parts = [f"{m['sym']} {m['pct']:+.1f}%" for m in mv]; span = f"{mv[0]['from']}→{mv[0]['to']}"
        mk = f"같은 기간 {', '.join(parts)} 움직임이 있었어요({span} 종가 기준)."; mke = f"In the same period: {', '.join(parts)} ({span}, close-to-close)."
    return ko, en, mk, mke
def main():
    W = load(SRC); items = [i for i in W.get("items") or [] if i.get("kind") == "presdoc" and (i.get("u") or "").startswith("https://") and i.get("t")]
    SS = sector_syms(); items.sort(key=lambda i: (i.get("date") or "", i["id"]), reverse=True); out = []
    for it in items[:120]:
        day = it.get("sign") or it.get("date") or ""; mv = [m for m in (move(s, day) for s in ((it.get("tickers") or [])[:3] or SS.get((it.get("sectors") or [""])[0], []))) if m]
        ko, en, mk, mke = sentences(it, mv)
        out.append({"id": it["id"], "date": it.get("date"), "sign": it.get("sign"), "type": it["type"], "type_en": TYPE_EN.get(it["type"], "Presidential document"), "eo": it.get("eo"), "procl": it.get("procl"), "title": it["t"], "easy_ko": ko, "easy_en": en, "sectors": it.get("sectors") or [], "topics": it.get("topics") or [], "countries": it.get("countries") or [],
                    "tickers": it.get("tickers") or [], "same_period_ko": mk, "same_period_en": mke, "moves": mv, "url": it["u"]})
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "source": "Federal Register API (federalregister.gov, 키 불필요)", "source_url": "https://www.federalregister.gov/developers/documentation/api/v1",
               "note": "쉬운 문구는 제목 분류 키워드로 만든 고정 문장이에요. 주가는 같은 기간에 있었던 움직임일 뿐 이유를 말하는 게 아니에요. 투자 조언 아님.",
               "note_en": "Plain sentences are fixed templates from title keywords. Price moves are shown only as what happened in the same period, not as a reason. Not investment advice.", "items": out},
              open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print("fr items", len(out), "with moves", sum(1 for o in out if o["moves"]))
    if not out: raise SystemExit(1)
if __name__ == "__main__": main()
