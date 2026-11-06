"""Hourly world events for skysea.html: GDELT conflict events (24h), NASA FIRMS fires (24h, public CSV, no key),
USGS earthquakes (7 days), EASA conflict zone bulletins (active). All free, no keys."""
import csv, datetime, io, json, re, html, urllib.request, zipfile, concurrent.futures as cf, pathlib, time
UA = {'User-Agent': 'money-tracker-skysea/1.0 (github.com/91cleaner/money-tracker)'}
def fetch(u, t=60):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t) as r: return r.read()
now = datetime.datetime.now(datetime.timezone.utc)
# countries for point lookup
G = json.load(open('data/national/countries-110m.geojson'))
POLYS = []
for f in G['features']:
    p = f['properties']; c = p.get('ISO_A2') if p.get('ISO_A2') not in (None, '-99') else p.get('ISO_A2_EH')
    c = 'TW' if c == 'CN-TW' else c
    if not c or c == '-99': continue
    g = f['geometry']; ps = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in ps:
        ring = poly[0]; xs = [x for x, _ in ring]; ys = [y for _, y in ring]
        POLYS.append((c, min(xs), max(xs), min(ys), max(ys), ring))
def inside(x, y, ring):
    n = len(ring); j = n - 1; a = False
    for i in range(n):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi: a = not a
        j = i
    return a
_cache = {}
def country(la, lo):
    k = (round(la, 1), round(lo, 1))
    if k in _cache: return _cache[k]
    r = ''
    for c, x0, x1, y0, y1, ring in POLYS:
        if x0 <= lo <= x1 and y0 <= la <= y1 and inside(lo, la, ring): r = c; break
    _cache[k] = r; return r
out = {'updated': now.strftime('%Y-%m-%dT%H:%M:%SZ')}
prev = {}
try: prev = json.load(open('data/skysea/events.json'))
except Exception: pass
# 1) GDELT: material conflict, root codes 18 assault, 19 fight, 20 mass violence, last 24h of 15-minute files
try:
    last = fetch('https://data.gdeltproject.org/gdeltv2/lastupdate.txt', 30).decode().split()[2]
    ts = datetime.datetime.strptime(re.search(r'(\d{14})', last).group(1), '%Y%m%d%H%M%S')
    urls = [f"https://data.gdeltproject.org/gdeltv2/{(ts - datetime.timedelta(minutes=15 * i)).strftime('%Y%m%d%H%M%S')}.export.CSV.zip" for i in range(96)]
    cells = {}; det = {}; okf = 0
    def one(u):
        try: return fetch(u, 40)
        except Exception: return None
    with cf.ThreadPoolExecutor(8) as ex:
        for b in ex.map(one, urls):
            if not b: continue
            okf += 1
            z = zipfile.ZipFile(io.BytesIO(b))
            for row in csv.reader(io.TextIOWrapper(z.open(z.namelist()[0]), 'utf-8', errors='ignore'), delimiter='\t'):
                if len(row) < 61 or row[28] not in ('18', '19', '20'): continue
                try: la, lo = float(row[56]), float(row[57])
                except ValueError: continue
                k = (round(la), round(lo)); cells[k] = cells.get(k, 0) + 1
                d = det.setdefault(k, {'t': '', 'pl': {}, 'rc': {'18': 0, '19': 0, '20': 0}, 'u': ''})
                d['rc'][row[28]] += 1; pl = row[52].strip()
                if pl: d['pl'][pl] = d['pl'].get(pl, 0) + 1
                if row[59] >= d['t'] and row[60].startswith('http'): d['t'], d['u'] = row[59], row[60]
    def dt(t):
        try: return datetime.datetime.strptime(t, '%Y%m%d%H%M%S').strftime('%Y-%m-%dT%H:%M:%SZ')
        except ValueError: return ''
    conf = [[la, lo, n, country(la, lo), dt(det[(la, lo)]['t']), max(det[(la, lo)]['pl'], key=det[(la, lo)]['pl'].get) if det[(la, lo)]['pl'] else '',
             [det[(la, lo)]['rc'][c] for c in ('18', '19', '20')], det[(la, lo)]['u']] for (la, lo), n in cells.items() if n >= 2]
    out['conflict'] = {'source': 'GDELT 2.0 (gdeltproject.org)', 'hours': 24, 'files': okf, 'rule': 'EventRootCode 18,19,20; 1 degree cells, 2+ reports',
                       'fields': ['lat', 'lon', 'reports', 'cc', 'latest_utc', 'place', 'by_root_18_19_20', 'latest_url'], 'cells': sorted(conf, key=lambda x: -x[2])[:1500]}
except Exception as e:
    print('gdelt failed', type(e).__name__); out['conflict'] = prev.get('conflict')
# 2) FIRMS VIIRS 24h public CSV
try:
    t = fetch('https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv', 120).decode()
    cells = {}
    for r in csv.DictReader(io.StringIO(t)):
        if r.get('confidence') == 'low': continue
        k = (round(float(r['latitude'])), round(float(r['longitude']))); cells[k] = cells.get(k, 0) + 1
    fires = [[la, lo, n, country(la, lo)] for (la, lo), n in cells.items()]
    out['fires'] = {'source': 'NASA FIRMS VIIRS S-NPP (firms.modaps.eosdis.nasa.gov)', 'hours': 24, 'rule': '1 degree cells, nominal/high confidence',
                    'fields': ['lat', 'lon', 'points', 'cc'], 'cells': sorted(fires, key=lambda x: -x[2])[:4000]}
except Exception as e:
    print('firms failed', type(e).__name__); out['fires'] = prev.get('fires')
# 3) USGS earthquakes M2.5+ past 7 days
try:
    q = json.loads(fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson'))
    qs = []
    for f in q['features']:
        lo, la = f['geometry']['coordinates'][:2]; p = f['properties']
        qs.append([round(la, 2), round(lo, 2), p.get('mag'), p.get('time'), p.get('type') or 'earthquake', country(la, lo), round(f['geometry']['coordinates'][2] or 0)])
    out['quakes'] = {'source': 'USGS (earthquake.usgs.gov)', 'days': 7, 'rule': 'M2.5+', 'fields': ['lat', 'lon', 'mag', 'time_ms', 'type', 'cc', 'depth_km'], 'items': qs}
except Exception as e:
    print('usgs failed', type(e).__name__); out['quakes'] = prev.get('quakes')
# 4) EASA conflict zone bulletins (active)
NAMES = {'Saudi Arabia': 'SA', 'Jordan': 'JO', 'Persian Gulf': 'XG', 'Lebanon': 'LB', 'Iraq': 'IQ', 'Iran': 'IR', 'Russian Federation': 'RU', 'Sudan': 'SD', 'Ukraine': 'UA',
         'Pakistan': 'PK', 'Afghanistan': 'AF', 'Yemen': 'YE', 'Mali': 'ML', 'Libya': 'LY', 'Syria': 'SY', 'Somalia': 'SO', 'Israel': 'IL', 'South Sudan': 'SS', 'Venezuela': 'VE',
         'Ethiopia': 'ET', 'Belarus': 'BY', 'Egypt': 'EG', 'Niger': 'NE', 'Burkina Faso': 'BF', 'Chad': 'TD', 'Kuwait': 'KW', 'Qatar': 'QA', 'United Arab Emirates': 'AE', 'Bahrain': 'BH', 'Oman': 'OM'}
try:
    t = fetch('https://www.easa.europa.eu/en/domains/air-operations/czibs').decode('utf-8', 'ignore')
    i = t.find('CZIB number'); j = t.find('Withdrawn', i)
    s = re.sub(r'\s*\|[\s|]*', '|', html.unescape(re.sub(r'<[^>]+>', '|', t[i:j]))).split('|')
    zs = []
    for k, v in enumerate(s):
        if v.startswith('Airspace of') or 'airspace' in v.lower():
            ccs = sorted({c for n, c in NAMES.items() if re.search(r'\b' + re.escape(n) + r'\b', v) and not (n == 'Sudan' and 'South Sudan' in v and 'Airspace of Sudan' not in v)})
            if 'Persian Gulf' in v: ccs = ['XG']
            zs.append({'subject': v, 'id': s[k + 1] if k + 1 < len(s) else '', 'valid_until': s[k - 1] if k else '', 'cc': ccs})
    if not zs: raise ValueError('none')
    out['zones'] = {'source': 'EASA Conflict Zone Information Bulletins (easa.europa.eu)', 'items': zs}
except Exception as e:
    print('easa failed', type(e).__name__); out['zones'] = prev.get('zones')
p = pathlib.Path('data/skysea/events.json'); p.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('bytes', p.stat().st_size, {k: len((v or {}).get('cells') or (v or {}).get('items') or []) for k, v in out.items() if isinstance(v, dict)})
