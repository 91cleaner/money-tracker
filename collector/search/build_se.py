#!/usr/bin/env python3
"""세금추적단 통합 검색 색인 만들기.

이미 사이트에 공개된 수집 결과(data/)만 읽어서, 브라우저가 바로 검색할 수 있는 작은 색인을
data/search/se/ 아래에 만든다. 서버·AI·외부 API가 필요 없다.

- core.json      시·발주기관·국회의원·국민연금 종목·뉴스, 월별 계약 파일 목록, 원문 링크 규칙
- vendors.json   업체(계약 상대) 이름·소재지·합계·건수·상세 파일 유무
- bills.json     국회의원 대표 발의 법안 제목
- ct-YYYY-MM.json 계약 (월별): 날짜·금액·기관·업체·제목·원문 번호

새 정보를 만들지 않는다. 금액 기준은 data/index.json 의 amount_basis 와 같다(행의 amount).
미국 의원 주식 거래(data/us)는 2026-10-26부터 공개 화면에서 내렸으므로 색인에 넣지 않는다.
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys
from collections import defaultdict
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'collector'))
from jv import alloc  # noqa: E402  공동도급은 업체·시 화면과 같은 방식으로 지분대로 나눈다
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(DATA, 'search', 'se')
URL_RE = re.compile(r'^https://www\.g2b\.go\.kr/link/FIUA027_01/single/\?ctrtNo=([^&]+)&ctrtChgOrd=([^&]+)&prcmBsneSeCd=([^&]+)&srchName=ctrtCrst&openUrl=Y$')
G2B_URL = 'https://www.g2b.go.kr/link/FIUA027_01/single/?ctrtNo={no}&ctrtChgOrd={ord}&prcmBsneSeCd={code}&srchName=ctrtCrst&openUrl=Y'


def load(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def dump(name, obj):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, path)
    return os.path.getsize(path)


class Table:
    """문자열 → 번호 (반복되는 이름을 숫자로 줄인다)."""

    def __init__(self):
        self.items, self.pos = [], {}

    def idx(self, key):
        if key not in self.pos:
            self.pos[key] = len(self.items)
            self.items.append(key)
        return self.pos[key]


def sizes_ok(core, index):
    """빈 자료나 갑자기 반 이상 줄어든 자료로 색인을 덮어쓰지 않는다(입력 파일이 깨졌을 때)."""
    k = core['counts']
    want_cities = len(index.get('cities') or [])
    problems = []
    if want_cities and k['cities'] < want_cities:
        problems.append('cities %d < index.json %d' % (k['cities'], want_cities))
    for key in ('contracts', 'vendors', 'insts', 'members', 'bills', 'stocks'):
        if not k.get(key):
            problems.append(key + ' = 0')
    prev = load(os.path.join(OUT, 'core.json'), {}) or {}
    for key, old in (prev.get('counts') or {}).items():
        if isinstance(old, int) and old >= 20 and k.get(key, 0) < old * 0.5:
            problems.append('%s dropped %d -> %d' % (key, old, k.get(key, 0)))
    if problems:
        raise SystemExit('search index NOT written (previous index kept): ' + '; '.join(problems))


def build():
    index = load(os.path.join(DATA, 'index.json'), {}) or {}
    city_meta = {c['slug']: c for c in (index.get('cities') or []) if isinstance(c, dict) and c.get('slug')}

    cities, insts, kinds, methods, codes, regions = Table(), Table(), Table(), Table(), Table(), Table()
    inst_city, inst_tot, inst_ext = {}, defaultdict(lambda: [0, 0]), {}
    vend = {}  # bh -> [name, region, total, count]
    by_month = defaultdict(list)
    seen = set()
    first = last = None
    bad_url = 0

    for path in sorted(glob.glob(os.path.join(DATA, 'city', '*.json'))):
        d = load(path) or {}
        c = d.get('city') or {}
        slug = c.get('slug') or os.path.basename(path)[:-5]
        ci = cities.idx(slug)
        for part, ext in (('rows', 0), ('ext', 1)):
            for r in d.get(part) or []:
                key = (r.get('no') or r.get('id'), r.get('ord'), r.get('bh') or r.get('vendor'))
                if key in seen:
                    continue
                seen.add(key)
                day = (r.get('date') or '')[:10]
                if not re.match(r'^\d{4}-\d{2}-\d{2}$', day):
                    continue
                first = day if first is None or day < first else first
                last = day if last is None or day > last else last
                amt = int(r.get('amount') or 0)
                inst = (r.get('inst') or '').strip()
                ii = insts.idx(inst)
                inst_city.setdefault(ii, ci)
                inst_tot[ii][0] += amt
                inst_tot[ii][1] += 1
                inst_ext[ii] = ext
                bh = r.get('bh') or ''
                vname = (r.get('vendor') or '').strip()
                parts = alloc(dict(r, amount=amt)) if r.get('jv') else [(r.get('vregion'), amt, bh, vname, None)]
                for preg, pamt, pid, pname, _share in parts:
                    if not pid:
                        continue
                    # [이름, 소재지, 시청 합계, 시청 건수, 시청 외 기관 합계, 시청 외 기관 건수] — 업체 화면 합계는 시청 계약만
                    v = vend.setdefault(pid, [(pname or '').strip(), (preg or '').strip(), 0, 0, 0, 0])
                    v[4 if ext else 2] += pamt
                    v[5 if ext else 3] += 1
                m = URL_RE.match(r.get('url') or '')
                if m:
                    no, ord_, code = m.group(1), m.group(2), codes.idx(m.group(3))
                else:
                    no, ord_, code = r.get('no') or '', r.get('ord') or '', -1
                    bad_url += 1
                by_month[day[:7]].append({
                    'day': day, 'amt': amt, 'ii': ii, 'bh': bh, 'vname': vname, 'title': (r.get('title') or '').strip(),
                    'kind': kinds.idx(r.get('cat') or r.get('kind') or ''), 'method': methods.idx(r.get('method') or ''),
                    'no': no, 'ord': ord_, 'code': code, 'ci': ci, 'ext': ext, 'jv': 1 if r.get('jv') else 0,
                    'parts': [(pid, pamt) for _, pamt, pid, _, _ in parts] if len(parts) > 1 else None,
                })

    if not by_month:
        raise SystemExit('no contracts found under data/city — refusing to write an empty index')

    # 업체: 금액 큰 순. 상세 파일(data/vendor/<bh>.json)이 있으면 표시
    have_file = {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(DATA, 'vendor', '*.json'))}
    vorder = sorted(vend.items(), key=lambda kv: (-kv[1][2], -kv[1][4], kv[1][0]))
    vpos = {bh: i for i, (bh, _) in enumerate(vorder)}
    # 흐름(기관→업체·월별)은 브라우저가 계약 색인에서 계산한다(모든 업체 같은 기준).
    # 업체 상세 파일은 회사 정보(업종·설립일·직원 수)가 있을 때만 쓰므로, 그 업체만 ID를 싣는다.
    corp = load(os.path.join(DATA, 'corp.json'), {}) or {}
    regions_col, names, totals, counts, etotals, ecounts, corp_ids = [], [], [], [], [], [], {}
    for i, (bh, (name, region, tot, cnt, etot, ecnt)) in enumerate(vorder):
        names.append(name)
        regions_col.append(regions.idx(region))
        totals.append(tot)
        counts.append(cnt)
        etotals.append(etot)
        ecounts.append(ecnt)
        if bh in corp and bh in have_file:
            corp_ids[str(i)] = bh
    # 열 단위로 저장하면 같은 종류 값이 붙어 있어 압축이 잘 된다
    vendors = {'build': None, 'regions': regions.items, 'name': names, 'region': regions_col, 'total': totals, 'count': counts, 'ext_total': etotals, 'ext_count': ecounts, 'corp_file': corp_ids}

    # 계약: 월별 파일. 업체는 vendors.rows 번호, 이름은 번호가 없을 때만
    months = sorted(by_month, reverse=True)
    p0 = date.fromisoformat(first)
    # 모든 파일에 같은 build 를 넣는다: 화면이 서로 다른 빌드의 파일을 섞어 쓰지 않게(업체 번호가 빌드마다 바뀜)
    build = re.sub(r'[^0-9A-Za-z]', '', index.get('updated') or '') or date.today().isoformat()
    sizes = {}
    for mon in months:
        rows = sorted(by_month[mon], key=lambda x: (x['day'], -x['amt']), reverse=True)
        col = defaultdict(list)
        for x in rows:
            vi = vpos.get(x['bh'], -1)
            col['d'].append((date.fromisoformat(x['day']) - p0).days)
            col['amount'].append(x['amt'])
            col['inst'].append(x['ii'])
            col['vendor'].append(vi)
            col['vname'].append('' if vi >= 0 else x['vname'])
            col['title'].append(x['title'])
            col['kind'].append(x['kind'])
            col['method'].append(x['method'])
            col['no'].append(x['no'])
            col['ord'].append(x['ord'])
            col['code'].append(x['code'])
            col['city'].append(x['ci'])
            col['ext'].append(x['ext'])
            col['jv'].append(x['jv'])
            col['jvs'].append([[vpos[pid], pamt] for pid, pamt in x['parts'] if pid in vpos] if x['parts'] else 0)
        sizes['ct-%s.json' % mon] = dump('ct-%s.json' % mon, dict(build=build, month=mon, n=len(rows), **col))

    # 국회의원 + 법안
    mem = load(os.path.join(DATA, 'national', 'members.json'), {}) or {}
    members, mpos = [], {}
    for m in mem.get('members') or []:
        if not m.get('id') or not m.get('name'):
            continue
        mpos[m['id']] = len(members)
        members.append([m['id'], m['name'], m.get('party') or '', m.get('district') or '', m.get('region') or '', m.get('cmits') or '', 0, int(m.get('trips') or 0)])
    bills = []
    for path in sorted(glob.glob(os.path.join(DATA, 'national', 'bills', '*.json'))):
        mid = os.path.basename(path)[:-5]
        if mid not in mpos:
            continue
        lst = load(path) or []
        if isinstance(lst, dict):
            lst = lst.get('bills') or []
        members[mpos[mid]][6] = len(lst)
        for b in lst:
            if b.get('n'):
                bills.append([b['n'], b.get('d') or '', b.get('r') or '', mpos[mid], b.get('c') or '', b.get('id') or ''])
    bills.sort(key=lambda b: b[1], reverse=True)
    sec = load(os.path.join(DATA, 'national', 'security.json'), {}) or {}
    committees = Table()
    bills_doc = {
        'build': None,
        'bill_url': sec.get('bill_url') or 'https://likms.assembly.go.kr/bill/billDetail.do?billId=',
        'title': [b[0] for b in bills], 'date': [b[1] for b in bills], 'result': [b[2] for b in bills],
        'member': [b[3] for b in bills], 'committee': [committees.idx(b[4]) for b in bills], 'id': [b[5] for b in bills],
        'committees': committees.items,
    }

    bills_doc['build'] = build

    # 국민연금 보유 종목 (국내 + 미국 13F 최신 분기)
    stocks = []
    kr = load(os.path.join(DATA, 'nps', 'kr_holdings.json'), {}) or {}
    for h in kr.get('holdings') if isinstance(kr.get('holdings'), list) else []:
        if isinstance(h, dict) and h.get('company'):
            stocks.append([h['company'], 'kr', h.get('value_100m_krw'), h.get('weight_pct'), h.get('stake_pct'), h.get('as_of') or kr.get('as_of') or '', h.get('source_url') or ''])
    us_files = sorted(glob.glob(os.path.join(DATA, 'nps', 'holdings_us_*.json')))
    if us_files:
        us = load(us_files[-1], {}) or {}
        for h in us.get('holdings') if isinstance(us.get('holdings'), list) else []:
            if isinstance(h, dict) and h.get('issuer'):
                stocks.append([h['issuer'], 'us', h.get('value_100m_krw'), None, None, us.get('period') or us.get('quarter') or '', us.get('filing_url') or ''])

    news = []
    for n in load(os.path.join(DATA, 'news.json'), []) or []:
        if isinstance(n, dict) and n.get('factchecked') is not False:
            t = n.get('제목') or n.get('title')
            if t:
                news.append([n.get('id') or '', t, n.get('날짜') or n.get('date') or '', n.get('도시') or '', n.get('요약') or ''])

    city_rows = []
    for slug in cities.items:
        cm = city_meta.get(slug, {})
        ext = cm.get('ext') or {}
        city_rows.append([slug, cm.get('name') or slug, cm.get('short') or cm.get('name') or slug, cm.get('province') or '',
                          int(cm.get('total') or 0), int(cm.get('count') or 0), int(ext.get('total') or 0), int(ext.get('count') or 0),
                          cm.get('local_share')])

    core = {
        'v': 2,
        'build': build,
        'updated': index.get('updated') or '',
        'period': {'first': first, 'last': last},
        'amount_basis': index.get('amount_basis') or '',
        'source': '조달청 나라장터 공개 계약정보 · 열린국회정보 · 국민연금기금 공시 · SEC 13F',
        'g2b_url': G2B_URL,
        'codes': codes.items,
        'kinds': kinds.items,
        'methods': methods.items,
        'months': [[m, len(by_month[m])] for m in months],
        'counts': {'contracts': sum(len(v) for v in by_month.values()), 'vendors': len(vorder), 'insts': len(insts.items),
                   'cities': len(cities.items), 'members': len(members), 'bills': len(bills), 'stocks': len(stocks), 'news': len(news)},
        'cities_fields': ['slug', 'name', 'short', 'province', 'total', 'count', 'ext_total', 'ext_count', 'local_share'],
        'cities': city_rows,
        'insts_fields': ['name', 'city', 'total', 'count', 'ext'],
        'insts': [[name, inst_city.get(i, -1), inst_tot[i][0], inst_tot[i][1], inst_ext.get(i, 0)] for i, name in enumerate(insts.items)],
        'members_fields': ['id', 'name', 'party', 'district', 'region', 'committees', 'bills', 'trips'],
        'members': members,
        'stocks_fields': ['name', 'market', 'value_100m_krw', 'weight_pct', 'stake_pct', 'as_of', 'source_url'],
        'stocks': stocks,
        'news_fields': ['id', 'title', 'date', 'city', 'summary'],
        'news': news,
    }
    vendors['build'] = build
    sizes_ok(core, index)
    sizes['vendors.json'] = dump('vendors.json', vendors)
    sizes['bills.json'] = dump('bills.json', bills_doc)
    sizes['core.json'] = dump('core.json', core)

    # 지난 달 파일이 사라졌으면 지운다(수집 기간 120일이 지나간 달)
    keep = set(sizes)
    for p in glob.glob(os.path.join(OUT, 'ct-*.json')):
        if os.path.basename(p) not in keep:
            os.remove(p)

    print('search index:', json.dumps(core['counts'], ensure_ascii=False), 'period', first, '~', last, 'bad_url', bad_url)
    for k in sorted(sizes):
        print('  %-18s %8.1f KB' % (k, sizes[k] / 1024))
    return core


if __name__ == '__main__':
    build()
    sys.exit(0)
