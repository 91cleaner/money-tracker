"""Real-time ships near Korea from AISStream (key from env AISSTREAM_KEY, never logged)."""
import asyncio, json, os, time, datetime
import websockets

KEY = os.environ.get('AISSTREAM_KEY', '')
OUT = 'data/skysea/ships_live.json'
SECS = int(os.environ.get('AIS_SECS', '75'))
# [[lat1, lon1], [lat2, lon2]]: Yellow Sea, East China Sea, East Sea, Korea Strait
BOXES = [[[30.0, 117.0], [41.0, 127.5]], [[24.0, 119.0], [33.5, 131.0]], [[33.0, 127.5], [46.0, 142.0]]]
MID = {}
for a, c in [((338, 339, 366, 367, 368, 369), 'US'), ((412, 413, 414), 'CN'), ((440, 441), 'KR'), ((445,), 'KP'), ((431, 432), 'JP'),
             ((416,), 'TW'), ((273,), 'RU'), ((477,), 'HK'), ((563, 564, 565, 566), 'SG'), ((351, 352, 353, 354, 355, 356, 357, 370, 371, 372, 373, 374), 'PA'),
             ((636, 637), 'LR'), ((538,), 'MH'), ((248, 249, 256, 215, 229), 'MT'), ((308, 309, 311), 'BS'), ((237, 239, 240, 241), 'GR'),
             ((257, 258, 259), 'NO'), ((232, 233, 234, 235), 'GB'), ((525,), 'ID'), ((574,), 'VN'), ((419,), 'IN'), ((548,), 'PH'), ((533,), 'MY'),
             ((567,), 'TH'), ((209, 210, 212), 'CY'), ((211, 218), 'DE'), ((226, 227, 228), 'FR'), ((244, 245, 246), 'NL'), ((219, 220), 'DK'),
             ((503,), 'AU'), ((316,), 'CA'), ((511,), 'PW'), ((576, 577), 'VU'), ((620,), 'KM'), ((671,), 'TG'), ((518,), 'CK'), ((667,), 'SL'), ((572,), 'TV'), ((457,), 'MN')]:
    for m in a: MID[m] = c

def kind(t):
    t = t or 0
    if t == 30: return '어선'
    if 60 <= t <= 69: return '여객선'
    if 70 <= t <= 79: return '화물선'
    if 80 <= t <= 89: return '유조선'
    if t in (31, 32, 52): return '예인선'
    if t == 35: return '군함'
    if 40 <= t <= 49: return '고속선'
    if t in (36, 37): return '요트'
    return '기타'

async def main():
    pos, stat = {}, {}
    sub = {'APIKey': KEY, 'BoundingBoxes': BOXES, 'FilterMessageTypes': ['PositionReport', 'ShipStaticData', 'StandardClassBPositionReport']}
    end = time.time() + SECS
    try:
        async with websockets.connect('wss://stream.aisstream.io/v0/stream', open_timeout=20, max_size=2**20) as ws:
            await ws.send(json.dumps(sub))
            while time.time() < end:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=max(1, end - time.time()))
                except asyncio.TimeoutError:
                    break
                m = json.loads(raw); mt = m.get('MessageType'); md = m.get('MetaData') or {}
                if 'error' in m: print('stream error'); break
                mm = md.get('MMSI')
                if not mm: continue
                b = (m.get('Message') or {}).get(mt) or {}
                if mt in ('PositionReport', 'StandardClassBPositionReport'):
                    la, lo = b.get('Latitude'), b.get('Longitude')
                    if la is None or abs(la) > 90 or abs(lo) > 180: continue
                    hd = b.get('TrueHeading'); hd = None if hd in (None, 511) else hd
                    pos[mm] = [round(la, 4), round(lo, 4), hd if hd is not None else round(b.get('Cog') or 0), round(b.get('Sog') or 0, 1), (md.get('time_utc') or '')[:19]]
                    nm = (md.get('ShipName') or '').strip()
                    if nm: stat.setdefault(mm, {})['n'] = nm
                elif mt == 'ShipStaticData':
                    s = stat.setdefault(mm, {}); s['t'] = b.get('Type'); nm = (b.get('Name') or '').strip()
                    if nm: s['n'] = nm
    except Exception as e:
        print('connect failed:', type(e).__name__)
    return pos, stat

pos, stat = asyncio.run(main())
if not pos:
    print('no ships received; keeping old file'); raise SystemExit(0)
rows, counts = [], {}
for mm, (la, lo, hd, sog, ts) in pos.items():
    c = MID.get(int(str(mm)[:3]), 'XX') if len(str(mm)) == 9 else 'XX'
    s = stat.get(mm, {}); counts[c] = counts.get(c, 0) + 1
    rows.append([mm, la, lo, hd, sog, s.get('n', '')[:20], c, kind(s.get('t')), ts[11:16]])
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
json.dump({'updated': now, 'seconds': SECS, 'source': 'AISStream (aisstream.io)', 'area': '한국 주변 바다 (서해, 동중국해, 동해)',
           'fields': ['mmsi', 'lat', 'lon', 'heading', 'sog_kt', 'name', 'flag', 'type', 'time_utc_hhmm'], 'counts': counts, 'ships': rows},
          open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('ships', len(rows), 'bytes', os.path.getsize(OUT))
