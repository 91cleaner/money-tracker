"""저장된 data/ 파일의 계약명에서 사람 이름을 다시 가린다(privacy.names). data/national(정치인 실명 허용)은 제외."""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from privacy import names
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
K = {"title", "t", "detail"}


def walk(o, hits):
    if isinstance(o, list):
        for x in o: walk(x, hits)
    elif isinstance(o, dict):
        for k, v in o.items():
            if k in K and isinstance(v, str):
                n = names(v)
                if n != v:
                    o[k] = n; hits.append((v, n))
            elif isinstance(v, (list, dict)):
                walk(v, hits)


def main():
    files = changed = 0; allhits = []
    for p in sorted(glob.glob(os.path.join(ROOT, "**", "*.json"), recursive=True)):
        if os.sep + "national" + os.sep in p:
            continue
        raw = open(p, encoding="utf-8").read()
        try:
            d = json.loads(raw)
        except ValueError:
            continue
        hits = []; walk(d, hits); files += 1
        if hits:
            compact = "\n" not in raw.strip()
            with open(p, "w", encoding="utf-8") as f:
                json.dump(d, f, ensure_ascii=False, **({"separators": (",", ":")} if compact else {"indent": 1}))
            changed += 1; allhits += hits
    print(f"이름 가리기: 파일 {files}개 중 {changed}개 변경, {len(allhits)}곳 (서로 다른 제목 {len({h[0] for h in allhits})}건)")
    return allhits


if __name__ == "__main__":
    for a, b in sorted(set(main()))[:400]:
        if "-v" in sys.argv: print(b)
