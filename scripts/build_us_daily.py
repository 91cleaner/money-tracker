#!/usr/bin/env python3
"""Daily US fact cards from our own collected data. Facts only (who, when, how much, what).
Writes data/us/daily/YYYY-MM-DD.json (KST date) and data/us/daily/index.json. No advice, no causes."""
import json, os, glob, datetime as dt
R = os.path.join(os.path.dirname(__file__), '..', 'data', 'us')
J = lambda f: json.load(open(os.path.join(R, f), encoding='utf-8'))
today = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=9)).date()
T = today.isoformat()
D = os.path.join(R, 'daily'); os.makedirs(D, exist_ok=True)
SIDE = {'P': '샀다고', 'S': '팔았다고', 'S (partial)': '일부 팔았다고', 'E': '교환했다고'}
def recent(dates, days):
    lo = (today - dt.timedelta(days=days)).isoformat(); return [d for d in dates if d and d >= lo]
cards = []
# 1) congress stock reports: newest filing date
try:
    tr = J('trades.json')['trades']
    last = max(t.get('fd') or '' for t in tr)
    lo = (dt.date.fromisoformat(last) - dt.timedelta(days=2)).isoformat()
    new = [t for t in tr if (t.get('fd') or '') >= lo]
    if new and recent([last], 7):
        by = {}
        for t in new: by.setdefault(t['who'], []).append(t)
        items = []
        for who, ts in sorted(by.items(), key=lambda x: -len(x[1]))[:4]:
            t = next((x for x in ts if x.get('tk')), ts[0]); nm = t.get('tk') or (t.get('asset') or '종목')[:40]
            items.append({'t': f"{who} 의원이 {nm} 주식을 {SIDE.get(t['ty'], '거래했다고')} 신고했어요. 거래일 {t['d']}, 금액 범위 {t['amt']}." + (f" 다른 거래 {len(ts)-1}건도 함께 신고했어요." if len(ts) > 1 else ''),
                          'tk': t['tk'], 'who': who, 'u': t.get('doc')})
        cards.append({'id': 'ptr', 'k': '의원 주식 신고', 'h': f"{lo}~{last} 하원 신고 {len(new)}건 · 의원 {len(by)}명", 'n': [{'l': '신고', 'v': f'{len(new)}건'}, {'l': '의원', 'v': f'{len(by)}명'}], 'items': items})
except Exception as e: print('ptr', e)
# 2) White House / presidential documents
try:
    w = [x for x in J('whitehouse.json')['items'] if x.get('kind') == 'presdoc']
    last = max(x['date'] for x in w); new = [x for x in w if x['date'] == last]
    if recent([last], 7):
        cards.append({'id': 'wh', 'k': '백악관 조치', 'h': f"{last} 관보에 대통령 문서 {len(new)}건이 실렸어요", 'n': [{'l': '문서', 'v': f'{len(new)}건'}],
                      'items': [{'t': f"{x.get('type') or '대통령 문서'}" + (f" 제{x['procl']}호" if x.get('procl') else '') + (f" 제{x['eo']}호" if x.get('eo') else '') + f": {x.get('ko') or x['t'][:80]}", 'u': x.get('u'), 'tk': ','.join(x.get('tickers') or [])} for x in new[:4]]})
except Exception as e: print('wh', e)
# 3) company insiders (Form 4), newest filing day
try:
    rows = []
    for tk, c in J('insider-form4.json')['companies'].items():
        for t in c.get('trades') or []: rows.append((t.get('filed') or '', tk, t))
    last = max(r[0] for r in rows); new = [r for r in rows if r[0] == last]
    if recent([last], 7):
        tks = sorted({r[1] for r in new})
        g = {}
        for _, tk, t in new:
            k = (tk, t['who'], t['code']); a = g.setdefault(k, {'sh': 0, 'v': 0, 'n': 0, 'd': t['date'], 'u': t.get('url'), 'plan': t.get('plan')})
            a['sh'] += t.get('shares') or 0; a['v'] += (t.get('shares') or 0) * (t.get('price') or 0); a['n'] += 1
        items = [{'t': f"{tk} 신고자 {who}: {a['d']}에 {int(a['sh']):,}주를 {'샀어요' if c=='P' else '팔았어요'}, 약 ${round(a['v']):,} ({a['n']}건)" + (". 미리 정한 계획에 따른 거래예요." if a['plan'] else '.'), 'tk': tk, 'u': a['u']} for (tk, who, c), a in sorted(g.items(), key=lambda x: -x[1]['v'])[:4]]
        cards.append({'id': 'f4', 'k': '회사 임원 거래', 'h': f"{last} 임원 거래 신고 {len(new)}건 · {len(tks)}개 회사", 'n': [{'l': '신고', 'v': f'{len(new)}건'}, {'l': '회사', 'v': f'{len(tks)}곳'}], 'items': items})
except Exception as e: print('f4', e)
# 4) totals: contracts / lobbying / PAC — show change vs previous saved day
snap = {}
for f, key, lab in [('federal-awards.json', 'total_usd', '정부 계약'), ('lobbying.json', 'total_usd', '로비 신고'), ('pac-contributions.json', 'to_federal_candidates_usd', '후원금(PAC)')]:
    try: snap[f] = {tk: c.get(key) for tk, c in J(f)['companies'].items() if isinstance(c, dict) and c.get(key) is not None}
    except Exception as e: print(f, e)
prev = None
for p in sorted(glob.glob(os.path.join(D, '20*.json')), reverse=True):
    if os.path.basename(p)[:10] < T: prev = json.load(open(p, encoding='utf-8')); break
money = lambda v: f"${v/1e9:,.1f}B" if v >= 1e9 else f"${v/1e6:,.1f}M" if v >= 1e6 else f"${v:,.0f}"
for f, lab in [('federal-awards.json', '정부 계약'), ('lobbying.json', '로비 신고'), ('pac-contributions.json', '후원금(PAC)')]:
    cur = snap.get(f) or {}
    old = ((prev or {}).get('snap') or {}).get(f) or {}
    ch = [(tk, v - old[tk]) for tk, v in cur.items() if tk in old and v != old[tk]]
    if ch:
        ch.sort(key=lambda x: -abs(x[1]))
        cards.append({'id': f[:-5], 'k': lab, 'h': f"어제보다 금액이 바뀐 회사 {len(ch)}곳", 'n': [{'l': '바뀐 회사', 'v': f'{len(ch)}곳'}],
                      'items': [{'t': f"{tk}: {money(old[tk])} → {money(cur[tk])}", 'tk': tk} for tk, d in ch[:4]]})
    elif cur:
        tk, v = max(cur.items(), key=lambda x: x[1] or 0)
        cards.append({'id': f[:-5], 'k': lab, 'h': f"기록이 가장 큰 회사는 {tk}예요", 'n': [{'l': tk, 'v': money(v)}], 'items': [{'t': f"모은 회사 {len(cur)}곳 중 {tk}가 {money(v)}로 가장 커요.", 'tk': tk}]})
out = {'date': T, 'made': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'note': '우리가 모은 공개 기록으로 만든 사실 카드예요. 이유나 조언은 적지 않아요.', 'cards': cards, 'snap': snap}
json.dump(out, open(os.path.join(D, T + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
days = sorted(os.path.basename(p)[:10] for p in glob.glob(os.path.join(D, '20*.json')))
json.dump({'latest': days[-1], 'days': days[-60:]}, open(os.path.join(D, 'index.json'), 'w'), separators=(',', ':'))
print(T, len(cards), 'cards')
