"""역사(나라별 전쟁) 자료 생성기. 실행: python3 scripts/wars_gen.py
data/worldhist/war_*.json, data/worldhist/wars_index.json, data/i18n/skysea_en.json(영어 문구 추가)를 만듭니다."""
import json, os, glob, importlib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EN = {}
def T(ko, en):
    EN[ko] = en; return ko
ORDER = [('us', T('미국', 'United States')), ('cn', T('중국', 'China')), ('ru', T('러시아', 'Russia')), ('kp', T('북한', 'North Korea')),
         ('kr', T('대한민국', 'South Korea')), ('jp', T('일본', 'Japan')), ('de', T('독일', 'Germany')), ('gb', T('영국', 'United Kingdom')), ('fr', T('프랑스', 'France'))]
for k, v in {'역사': 'History', '나라별 전쟁': 'Wars by country', '준비 중': 'Coming soon', '이 장면 출처:': 'Source for this scene:'}.items(): T(k, v)
NOTE = T('위치, 화살표, 칠한 땅은 대략이에요. 원 넓이는 숫자에 비례해요.', 'Positions, arrows and shaded areas are approximate. Circle area is proportional to the number.')
def main():
    import sys; sys.path.insert(0, os.path.join(ROOT, 'scripts'))
    idx = []
    for cc, name in ORDER:
        wars = []
        try: mod = importlib.import_module('wars_' + cc)
        except ModuleNotFoundError: mod = None
        if mod:
            for w in mod.wars(T):
                w.setdefault('note', NOTE)
                json.dump(w, open(os.path.join(ROOT, 'data/worldhist', w['id'] + '.json'), 'w'), ensure_ascii=False, indent=1)
                wars.append({'id': w['id'], 'title': w['title'], 'period': w['period']})
        idx.append({'k': cc, 'n': name, 'wars': wars})
    json.dump(idx, open(os.path.join(ROOT, 'data/worldhist/wars_index.json'), 'w'), ensure_ascii=False, indent=1)
    p = os.path.join(ROOT, 'data/i18n/skysea_en.json'); d = json.load(open(p)); d.update(EN)
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=0)
    print('wars:', sum(len(x['wars']) for x in idx), 'strings:', len(EN))
if __name__ == '__main__': main()
