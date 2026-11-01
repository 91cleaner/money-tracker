"""World aircraft snapshot from the free adsb.lol API (no key). adsb.lol has no free whole-world feed and blocks
browser calls (no CORS), so this asks its 250 nm 'point' endpoint over a grid that covers the busy air regions
of the world (not every ocean). Stdlib only."""
import os, json, math, time, urllib.request, datetime, pathlib, concurrent.futures as cf

REGIONS = [  # lat min, lon min, lat max, lon max
    (15, -130, 62, -52), (35, -12, 64, 42), (12, 28, 42, 62), (5, 64, 36, 92), (18, 96, 46, 146),
    (-11, 94, 18, 128), (-42, 112, -10, 156), (-36, 172, -34, 178), (-35, -76, 6, -34), (-35, 14, -18, 34),
    (-6, 28, 12, 46), (4, -18, 37, 12), (45, -52, 60, -12), (18, -160, 22, -154), (42, 42, 58, 90), (55, 90, 64, 140),
]
def points():
    pts = set()
    for la in range(-40, 66, 7):
        step = 7 / max(.35, math.cos(math.radians(la)))
        lo = -180.0
        while lo < 180:
            if any(a - 3 <= la <= c + 3 and b - 3 <= lo <= d + 3 for a, b, c, d in REGIONS):
                pts.add((la, round(lo, 1)))
            lo += step
    return sorted(pts)

# ICAO 24-bit address blocks (ICAO Annex 10)
RANGES = [(0xA00000, 0xAFFFFF, 'US'), (0x780000, 0x7BFFFF, 'CN'), (0x718000, 0x71FFFF, 'KR'), (0x720000, 0x727FFF, 'KP'),
          (0x840000, 0x87FFFF, 'JP'), (0x899000, 0x8993FF, 'TW'), (0x100000, 0x1FFFFF, 'RU'), (0x400000, 0x43FFFF, 'GB'),
          (0x3C0000, 0x3FFFFF, 'DE'), (0x380000, 0x3BFFFF, 'FR'), (0x800000, 0x83FFFF, 'IN'), (0xC00000, 0xC3FFFF, 'CA'),
          (0x7C0000, 0x7FFFFF, 'AU'), (0x4B8000, 0x4BFFFF, 'TR'), (0x896000, 0x896FFF, 'AE'), (0x300000, 0x33FFFF, 'IT'),
          (0x340000, 0x37FFFF, 'ES'), (0xE40000, 0xE7FFFF, 'BR'), (0x0D0000, 0x0D7FFF, 'MX'), (0x710000, 0x717FFF, 'SA')]
def cc(h):
    try: v = int(h, 16)
    except ValueError: return 'XX'
    for a, b, c in RANGES:
        if a <= v <= b: return c
    return 'XX'

UA = {'User-Agent': 'money-tracker-skysea/1.0 (github.com/91cleaner/money-tracker)'}
T0 = time.time(); STATS = {'adsb.lol': 0, 'adsb.fi': 0}
def fetch(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=15) as r:
        d = json.load(r); return d.get('ac') if d.get('ac') is not None else (d.get('aircraft') or [])
def get(p):  # pass 1: adsb.lol, short budget (GitHub runner IPs are often throttled there)
    la, lo = p
    if time.time() - T0 > 120 or os.environ.get('SKIP_LOL'): return None
    try:
        r = fetch(f'https://api.adsb.lol/v2/point/{la}/{lo}/250'); STATS['adsb.lol'] += 1; return r
    except Exception:
        return None
def get_fi(p):  # pass 2: adsb.fi open data, same readsb fields, about 1 request per second
    la, lo = p
    for t in range(2):
        try:
            r = fetch(f'https://opendata.adsb.fi/api/v2/lat/{la}/lon/{lo}/dist/250'); STATS['adsb.fi'] += 1; return r
        except Exception:
            time.sleep(2 + 2 * t)
    return None

P = points(); seen = {}; ok = 0; gps = {}
with cf.ThreadPoolExecutor(3) as ex:
    first = list(ex.map(get, P))
results = []
for p0, r0 in zip(P, first):
    if r0 is None and time.time() - T0 < 520:
        r0 = get_fi(p0); time.sleep(1.05)
    results.append(r0)
if True:
    for res in results:
        if res is None: continue
        ok += 1
        for a in res:
            h = (a.get('hex') or '').lower()
            if not h or a.get('lat') is None or a.get('lon') is None: continue
            alt = a.get('alt_baro'); alt = alt if isinstance(alt, (int, float)) else (0 if alt == 'ground' else None)
            if alt == 0: continue  # keep flying aircraft only, keeps the file small
            nacp, nic = a.get('nac_p'), a.get('nic')
            if isinstance(nacp, int) or isinstance(nic, int):
                g = gps.setdefault((int(a['lat'] // 1), int(a['lon'] // 1), h), 0)
                gps[(int(a['lat'] // 1), int(a['lon'] // 1), h)] = 1 if ((isinstance(nacp, int) and nacp < 8) or (isinstance(nic, int) and nic < 7)) else 0
            seen[h] = [h, (a.get('flight') or '').strip(), (a.get('t') or '').strip(), round(a['lat'], 2), round(a['lon'], 2),
                       round(a.get('track') or a.get('true_heading') or 0), alt,
                       round(a['gs']) if isinstance(a.get('gs'), (int, float)) else None, 'XX' if h.startswith('~') else cc(h), 1 if (a.get('dbFlags') or 0) & 1 else 0]
if ok < len(P) * .5 or len(seen) < 1500:
    raise SystemExit(f'only {ok}/{len(P)} requests worked, {len(seen)} planes; keeping previous snapshot')
counts = {}
gc = {}
for (la, lo, _), bad in gps.items():
    c = gc.setdefault((la, lo), [la + .5, lo + .5, 0, 0]); c[2] += 1; c[3] += bad
gc = [c for c in gc.values() if c[2] >= 3]
for v in seen.values(): counts[v[8]] = counts.get(v[8], 0) + 1
out = {'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'source': 'adsb.lol (ODbL) + adsb.fi', 'by_source': STATS,
       'source_url': 'https://www.adsb.lol/', 'coverage': f'{ok} of {len(P)} areas, 250 nm each, busy air regions only',
       'fields': ['hex', 'flight', 'type', 'lat', 'lon', 'track', 'alt_ft', 'gs_kt', 'cc', 'mil'], 'counts': counts, 'count': len(seen), 'mil': sum(v[9] for v in seen.values()),
       'gps_fields': ['lat', 'lon', 'planes', 'bad'], 'gps_rule': 'nac_p<8 or nic<7', 'gps': gc,
       'ac': sorted(seen.values())}
# short trails: last 6 snapshots per plane, compact and capped
tp = pathlib.Path('data/skysea/tracks.json')
try: old = json.loads(tp.read_text())
except Exception: old = {'t': [], 'p': {}}
T = (old.get('t') or [])[-5:] + [out['updated']]; k0 = len(T) - 1; ot = old.get('t') or []
P2 = {}
for h, v in seen.items():
    prevp = (old.get('p') or {}).get(h) or []
    # keep only points whose snapshot time is still in the last 5
    keep = [q for q in prevp if q[0] < len(ot) and ot[q[0]] in T]
    keep = [[T.index(ot[q[0]]), q[1], q[2]] for q in keep]
    P2[h] = keep + [[k0, v[3], v[4]]]
P2 = {h: v for h, v in P2.items() if len(v) > 1}
if len(P2) > 2500:
    P2 = dict(sorted(P2.items(), key=lambda kv: -(seen[kv[0]][7] or 0))[:2500])
tp.write_text(json.dumps({'t': T, 'fields': ['snap', 'lat', 'lon'], 'p': P2}, separators=(',', ':')))
p = pathlib.Path('data/skysea/aircraft.json'); p.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print('aircraft', len(seen), 'areas', ok, '/', len(P), 'bytes', p.stat().st_size, sorted(counts.items(), key=lambda x: -x[1])[:12])
