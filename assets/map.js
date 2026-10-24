// 돈의 흐름 지도 — 위성 지도(Leaflet + Esri 위성 타일) 위에 시 원과 돈의 흐름 선을 겹친다.
// 타일을 못 받으면 가벼운 SVG 지도로 바뀐다. 검색어·주소는 어디에도 보내지 않는다(타일 요청은 좌표만).
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
// geo.json 좌표(SVG) ↔ 위경도. build_geo.py 와 같은 식.
const GK = Math.cos(36 * Math.PI / 180), GSX = 600 / (6.5 * GK);
const toLL = (p) => [38.7 - p[1] / GSX, 124.5 + p[0] / (GK * GSX)];

// 노란 고리 옆 우리 시 뱃지. 고리·처음으로·지도 가장자리와 겹치면 반대쪽으로 옮긴다.
function seatBadge(map, mk) {
  const el = mk && mk.getElement && mk.getElement();
  const span = el && el.querySelector('.loc-badge');
  if (!span || !map) return;
  const root = map.getContainer();
  const home = root.querySelector('.map-home');
  const hit = (a, b) => !!(b && a.width > 2 && b.width > 2 && a.right > b.left + 1 && a.left < b.right - 1 && a.bottom > b.top + 1 && a.top < b.bottom - 1);
  const inside = (a, box) => a.left >= box.left + 4 && a.right <= box.right - 4 && a.top >= box.top + 4 && a.bottom <= box.bottom - 4;
  const score = (cls) => {
    span.classList.remove('r', 'l'); span.classList.add(cls);
    const a = span.getBoundingClientRect(), box = root.getBoundingClientRect();
    return {off: !inside(a, box), cover: hit(a, home && home.getBoundingClientRect())};
  };
  const R = score('r'), Lft = score('l');
  const pick = (!R.cover && !R.off) ? 'r' : (!Lft.cover && !Lft.off) ? 'l' : (R.cover && !Lft.cover) ? 'l' : 'r';
  span.classList.remove('r', 'l'); span.classList.add(pick);
}

// ---------- 위성 지도 ----------
function satView(box, geo, cities, onPick) {
  if (!window.L) throw new Error('no leaflet');
  box.classList.add('sat');
  const map = L.map(box, {zoomControl: false, attributionControl: true, minZoom: 5, maxZoom: 12, zoomSnap: 0.25, tap: true,
    maxBounds: [[30.5, 121], [41, 134]], preferCanvas: false, scrollWheelZoom: false, touchZoom: true});
  { // 크기가 바뀌거나 다시 보일 때 타일이 깨지지 않게
    let t = 0; const inv = () => { clearTimeout(t); t = setTimeout(() => { map.invalidateSize({pan: false}); view.onsize && view.onsize(); }, 80); };
    if (window.ResizeObserver) new ResizeObserver(inv).observe(box);
    addEventListener('resize', inv); addEventListener('scroll', inv, {passive: true}); addEventListener('hashchange', inv); addEventListener('pageshow', inv);
    document.addEventListener('visibilitychange', () => !document.hidden && inv()); window.__inv2 = inv; }

  if (!matchMedia('(pointer: coarse)').matches) L.control.zoom({position: 'topright'}).addTo(map);
  if (window.mtWheel) mtWheel(map, box);
  // 페이지 스크롤을 빼앗지 않도록: 터치 기기에서는 지도를 한 번 눌러야 움직임
  if (matchMedia('(pointer: coarse)').matches) {
    map.zoomControl && map.zoomControl.remove();  // 한 손가락 이동·두 손가락 확대(기본)
  }
  const homeBtn = document.createElement('button');
  homeBtn.type = 'button';
  homeBtn.className = 'map-home is-home';
  homeBtn.innerHTML = '<span aria-hidden="true">⟲</span> 처음으로';
  homeBtn.setAttribute('aria-label', '지도를 처음 본 모습으로 되돌리기');
  const homeCtl = L.control({position: 'topright'});
  homeCtl.onAdd = () => { const w = L.DomUtil.create('div', 'leaflet-control map-home-ctl'); w.append(homeBtn); L.DomEvent.disableClickPropagation(w); L.DomEvent.disableScrollPropagation(w); return w; };
  homeCtl.addTo(map);
  map.attributionControl.setPrefix(false); window.__mtMap = map;
  map.on('click', (e) => {
    const pt = e.containerPoint, hits = [];
    dots.forEach((m, s) => { const r = m.getRadius(); if (!r) return; const q = map.latLngToContainerPoint(m.getLatLng()); const d = pt.distanceTo(q); if (d <= Math.max(r, 10) + 8) hits.push([d - r, s]); });
    hits.sort((a, b) => a[0] - b[0]);
    if (!hits.length) { if (view.onempty) view.onempty(); return; }
    const inside = hits.filter((h) => h[0] <= 4);
    if (inside.length > 1 && view.onmulti) view.onmulti(inside.map((h) => h[1])); else onPick(hits[0][1]);
  });
  const korea = L.latLngBounds([[33.1, 125.0], [38.65, 129.6]]);
  map.fitBounds(korea, {animate: false});
  let ok = false, errs = 0, failed = false;
  const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 12, attribution: '지도: Esri, HERE, Garmin, &copy; OpenStreetMap 기여자', crossOrigin: false});
  box.classList.add('loading');
  tiles.on('tileload', () => { ok = true; box.classList.remove('loading'); });
  tiles.on('tileerror', () => { if (++errs >= 4 && !ok && !failed) { failed = true; view.onfail && view.onfail(); } });
  tiles.addTo(map);
  setTimeout(() => { if (!ok && !failed) { failed = true; view.onfail && view.onfail(); } }, 8000);

  const maxT = cities[0] ? cities[0].total : 1;
  const dots = new Map();
  const gC = L.layerGroup().addTo(map), gF = L.layerGroup().addTo(map);
  // 짧은 이름: '전남 여수시' → '여수', '충남 논산시' → '논산'. 같은 짧은 이름이 둘이면 앞 지역을 붙인다.
  const shortNm = (name) => { const t = String(name || '').trim().split(/\s+/).pop() || ''; const base = t.replace(/(특별자치시|특별자치도|특별시|광역시)$/, ''); const m = base.match(/^(.+)(시|군|구)$/); return (m && m[1].length >= 2) ? m[1] : (base || t); };
  const nmCount = {}; for (const c of cities) { const s = shortNm(c.name); nmCount[s] = (nmCount[s] || 0) + 1; }
  const placeNm = (c) => { const s = shortNm(c.name); if ((nmCount[s] || 0) < 2) return s; const p = String(c.name || '').trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + s : s; };
  const nameTips = [];
  let destTips = [], selSlug = null;
  cities.forEach((c, i) => {
    const m = L.circleMarker(toLL(c.p), {radius: c.total > 0 ? 4 + 13 * Math.sqrt(c.total / maxT) : 4, className: 'sdot', weight: 1.5, color: c.total > 0 ? '#fff' : '#8b97a5', fillColor: c.total > 0 ? '#0a84ff' : '#3a4450', fillOpacity: c.total > 0 ? 0.55 : 0.3, interactive: false});
    m.addTo(gC); dots.set(c.slug, m); const me2 = m.getElement && m.getElement(); if (me2) me2.setAttribute('data-s', c.slug);
    const feat = i < 14;
    const tip = L.tooltip({permanent: true, direction: 'right', className: 'klab cname' + (feat ? ' feat' : ''), offset: [6, 0], interactive: false}).setLatLng(toLL(c.p)).setContent(placeNm(c)).addTo(gC);
    tip._feat = feat; tip._rank = i; tip._m = m; nameTips.push(tip);
    const el = tip.getElement && tip.getElement(); if (el) { el.dataset.s = c.slug; if (!feat) el.style.visibility = 'hidden'; }
  });
  const hitR = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const zoomedIn = () => map.getZoom() >= map.getBoundsZoom(korea, false) + 0.75;
  // 전국 배율: 금액 큰 시 14곳만. 확대하면 화면에 보이는 시·군 마커는 짧은 이름. 실제로 겹치거나 버튼 위를 가리는 것만 숨긴다.
  const declutter = () => {
    const zIn = zoomedIn(), b = map.getBounds(), boxR = box.getBoundingClientRect(), seen = [];
    const narrow = box.clientWidth < 520, EIN = 10, btnPad = narrow ? 14 : 8;
    box.querySelectorAll('.leaflet-control, .map-home').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return; const p = (el.classList.contains('map-home') || el.querySelector('.map-home')) ? btnPad : 3; seen.push({left: r.left - p, right: r.right + p, top: r.top - p, bottom: r.bottom + p, _ctl: 1}); });
    (box.parentElement || document).querySelectorAll('.resetbtn').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width > 4 && r.height > 4 && hitR(r, boxR)) seen.push({left: r.left, right: r.right, top: r.top, bottom: r.bottom, _ctl: 1}); });
    box.querySelectorAll('.loc-badge').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return; seen.push({left: r.left - 4, right: r.right + 4, top: r.top - 4, bottom: r.bottom + 4, _badge: 1}); });
    // 고른 시 이름표 → 금액·도착지 이름표. 우리 시 뱃지·처음으로와 겹치면 밀어 보고, 안 되면 나중 것을 숨긴다.
    const placeOne = (t, keep) => {
      t.style.visibility = 'visible'; t.style.marginLeft = '0px'; t.style.marginTop = '0px';
      let r = t.getBoundingClientRect(); if (r.width < 2) { if (!keep) t.style.visibility = 'hidden'; return; }
      let dx = 0, dy = 0;
      if (r.right > boxR.right - EIN) dx += boxR.right - EIN - r.right;
      if (r.left + dx < boxR.left + EIN) dx += boxR.left + EIN - (r.left + dx);
      if (r.bottom > boxR.bottom - EIN) dy += boxR.bottom - EIN - r.bottom;
      if (r.top + dy < boxR.top + EIN) dy += boxR.top + EIN - (r.top + dy);
      if (dx || dy) { t.style.marginLeft = dx + 'px'; t.style.marginTop = dy + 'px'; r = t.getBoundingClientRect(); }
      const clear = (rect) => rect.width > 2 && rect.left >= boxR.left + 4 && rect.right <= boxR.right - 4 && rect.top >= boxR.top + 4 && rect.bottom <= boxR.bottom - 4 && !seen.some((c) => hitR(rect, c));
      if (!clear(r)) {
        const baseL = parseFloat(t.style.marginLeft) || 0, baseT = parseFloat(t.style.marginTop) || 0;
        const opts = [[0, -30], [0, 30], [0, -54], [0, 54], [-52, 0], [58, 0], [0, -78], [0, 78], [-76, 22], [76, 22], [-76, -22], [40, -40], [-40, 40]];
        if (keep) opts.push([0, -104], [0, 104], [-110, 0], [110, 0], [0, -128], [96, -36], [-96, 36]);
        let ok = false;
        for (const [sx, sy] of opts) {
          t.style.marginLeft = (baseL + sx) + 'px'; t.style.marginTop = (baseT + sy) + 'px';
          const r2 = t.getBoundingClientRect();
          if (clear(r2)) { r = r2; ok = true; break; }
        }
        if (!ok) {
          t.style.marginLeft = baseL + 'px'; t.style.marginTop = baseT + 'px';
          if (!keep) { t.style.visibility = 'hidden'; return; }
          r = t.getBoundingClientRect();
        }
      }
      seen.push({left: r.left - 4, right: r.right + 4, top: r.top - 4, bottom: r.bottom + 4, _sel: keep ? 1 : 0});
    };
    const stips = [...box.querySelectorAll('.leaflet-tooltip.stip')];
    stips.filter((t) => t.classList.contains('me')).forEach((t) => placeOne(t, true));
    stips.filter((t) => !t.classList.contains('me')).forEach((t) => placeOne(t, false));
    const rankOf = (t) => { const el = t.getElement && t.getElement(); return el && selSlug && el.dataset.s === selSlug ? -1 : t._rank; };
    const names = nameTips.concat(destTips).filter((t) => t._feat || zIn).sort((a, c) => rankOf(a) - rankOf(c));
    const want = new Set(names);
    for (const t of nameTips.concat(destTips).slice().sort((a, c) => rankOf(a) - rankOf(c))) {
      const el = t.getElement && t.getElement(); if (!el) continue;
      el.style.marginLeft = '0px'; el.style.marginTop = '0px';
      const on = want.has(t) && b.contains(t.getLatLng()) && !(t._m && !t._m.getRadius());
      if (!on) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      let r = el.getBoundingClientRect();
      if (r.right > boxR.right - EIN) { el.style.marginLeft = (boxR.right - EIN - r.right) + 'px'; r = el.getBoundingClientRect(); }
      if (r.left < boxR.left + EIN) { el.style.marginLeft = ((parseFloat(el.style.marginLeft) || 0) + (boxR.left + EIN - r.left)) + 'px'; r = el.getBoundingClientRect(); }
      if (r.bottom > boxR.bottom - EIN) { el.style.marginTop = (boxR.bottom - EIN - r.bottom) + 'px'; r = el.getBoundingClientRect(); }
      if (r.top < boxR.top + EIN) { el.style.marginTop = ((parseFloat(el.style.marginTop) || 0) + (boxR.top + EIN - r.top)) + 'px'; r = el.getBoundingClientRect(); }
      const mine = !!(selSlug && el.dataset.s === selSlug);
      const crowded = seen.some((q) => hitR(r, q)) || r.right > boxR.right - 4 || r.left < boxR.left + 4 || r.bottom > boxR.bottom - 2 || r.top < boxR.top + 2;
      if (crowded) {
        const baseL = parseFloat(el.style.marginLeft) || 0, baseT = parseFloat(el.style.marginTop) || 0;
        const tries = [[0, -28], [0, 30], [0, -52], [0, 54], [-46, -8], [50, -8], [0, -76], [0, 78], [-80, 18], [80, 18], [-80, -24]];
        if (mine) tries.push([0, -100], [0, 104], [-110, 0], [112, 0], [0, -126], [120, -20], [-120, 24]);
        let moved = null;
        for (const [dx, dy] of tries) {
          el.style.marginLeft = (baseL + dx) + 'px'; el.style.marginTop = (baseT + dy) + 'px';
          const r2 = el.getBoundingClientRect();
          const inBox = r2.width > 2 && r2.left >= boxR.left + 4 && r2.right <= boxR.right - 4 && r2.top >= boxR.top + 4 && r2.bottom <= boxR.bottom - 4;
          if (inBox && !seen.some((q) => hitR(r2, q))) { moved = r2; break; }
        }
        if (moved) r = moved; else { el.style.marginLeft = baseL + 'px'; el.style.marginTop = baseT + 'px'; r = el.getBoundingClientRect(); }
      }
      if (r.width < 2 || r.right > boxR.right - 4 || r.left < boxR.left + 4 || r.bottom > boxR.bottom - 2 || r.top < boxR.top + 2 || seen.some((q) => hitR(r, q))) el.style.visibility = 'hidden';
      else seen.push({left: r.left - 4, right: r.right + 4, top: r.top - 4, bottom: r.bottom + 4});
    }
  };
  let dcA = 0, dcB = 0;
  const scheduleDeclutter = () => { clearTimeout(dcA); clearTimeout(dcB); dcA = setTimeout(declutter, 80); dcB = setTimeout(declutter, 420); };
  map.on('zoomend moveend resize', scheduleDeclutter); setTimeout(scheduleDeclutter, 600); window.__declutter = scheduleDeclutter;
  tiles.on('load', scheduleDeclutter);
  if (document.fonts) { document.fonts.ready.then(scheduleDeclutter); document.fonts.addEventListener('loadingdone', scheduleDeclutter); }
  const bez = (a, b) => {
    if (window.mtArc) return mtArc(a, b).map(toLL);
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = d < 12 ? Math.max(d * 0.6, 2.5) : Math.min(d * 0.28, 60);
    const mx = (a[0] + b[0]) / 2 - (dy / d) * o, my = (a[1] + b[1]) / 2 + (dx / d) * o, pts = [];
    for (let t = 0; t <= 1.0001; t += 1 / 24) pts.push(toLL([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mx + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * my + t * t * b[1]]));
    return pts;
  };
  let hl = null, pend = null;
  const lg = {out: false, inn: false, line: false, badge: false, ring: false};
  const syncLg = () => {
    if (!window.mtLegend) return;
    const parts = [];
    if (!lg.line && !lg.badge) {
      parts.push({t: 'dot', c: '#0a84ff', l: '시가 맺은 계약'});
      parts.push({t: 'w', c: '#0a84ff', l: '동그라미가 클수록 돈이 많아요'});
    } else {
      if (!lg.inn && !lg.badge && lg.out) {
        parts.push({t: 'dot', c: '#0a84ff', l: '시가 맺은 계약'});
        parts.push({t: 'w', c: '#0a84ff', l: '동그라미가 클수록 돈이 많아요'});
      }
      if (lg.inn || lg.badge) parts.push({t: 'dot', c: '#0a84ff', l: '우리 시 업체'});
      if (lg.out) parts.push({t: 'ln', c: '#ff9f0a', l: '다른 지역으로 간 돈'});
      if (lg.line) parts.push({t: 'w', c: lg.out ? '#ff9f0a' : '#0a84ff', l: '선이 굵을수록 돈이 많아요'});
    }
    if (lg.ring || hl) parts.push({t: 'ring', l: '지금 고른 곳'});
    mtLegend(box, parts);
  };
  const vis = (fn) => { if (box.clientWidth > 0 && box.clientHeight > 0) { fn(); } else pend = fn; };
  addEventListener('resize', () => { if (pend && box.clientWidth > 0) { map.invalidateSize(); const f = pend; pend = null; setTimeout(f, 50); } });
  const view = {
    resize(tot, all) { const mx = Math.max(1, ...Object.values(tot)); dots.forEach((m, s) => { const t = tot[s] || 0; m.setRadius(t ? 4 + 13 * Math.sqrt(t / mx) : (all ? 4 : 0)); }); },
    highlight(p) { if (hl) hl.remove(); hl = p ? L.circleMarker(toLL(p), {radius: 16, className: 'hlring', color: '#ffd60a', weight: 3, fill: false, interactive: false}).addTo(map) : null; if (p) vis(() => map.panTo(toLL(p))); syncLg(); view.oncam && view.oncam(); },
    homeBtn, hlOn() { return !!hl; },
    readCam() { const c = map.getCenter(); return {lat: c.lat, lng: c.lng, z: map.getZoom()}; },
    sameCam(s) { if (!s || s.lat == null) return false; const c = map.getCenter(); return Math.abs(map.getZoom() - s.z) < 0.05 && Math.abs(c.lat - s.lat) < 0.02 && Math.abs(c.lng - s.lng) < 0.02; },
    previewFly(p, z) { const ll = toLL(p); return {lat: ll[0], lng: ll[1], z: Math.min(z, 9.5)}; },
    jump(p, z) { pend = null; map.stop(); map.invalidateSize(); map.setView(toLL(p), Math.min(z, 9.5), {animate: false}); },
    fitNow(pts) { if (!pts || !pts.length) return; pend = null; map.stop(); map.invalidateSize(); map._noRelocal = (map._noRelocal || 0) + 1; map.fitBounds(L.latLngBounds(pts.map(toLL)).pad(0.22), {animate: false, maxZoom: 8, padding: [40, 40]}); setTimeout(() => { map._noRelocal = Math.max(0, (map._noRelocal || 1) - 1); scheduleDeclutter(); }, 0); },
    onsize: null,
    select(slug) { selSlug = slug || null; dots.forEach((m, s) => m.setStyle(s === slug ? {fillOpacity: 0.95, fillColor: '#0a84ff', weight: 3} : {fillOpacity: slug ? 0.3 : 0.55, weight: 1.5})); },
    lines(list, maxA, labels) {
      gF.clearLayers(); destTips = []; lineArgs = [list, maxA, labels];
      lg.out = lg.inn = lg.line = lg.badge = lg.ring = false;
      const px = (p) => map.latLngToContainerPoint(toLL(p));
      const buried = [];
      list.forEach((f, i) => {
        const w = window.mtW ? mtW(f.amount, maxA) : 1.5 + 7 * Math.sqrt((f.amount || 0) / (maxA || 1)), col = f.local ? '#0a84ff' : '#ff9f0a';
        const svgD = f.a && f.p ? Math.hypot(f.a[0] - f.p[0], f.a[1] - f.p[1]) : 99;
        const near = !!(f.local && f.a && f.p && (svgD < 1 || (box.clientWidth > 40 && px(f.a).distanceTo(px(f.p)) < 28)));
        if (near) { buried.push(f); return; }
        if (svgD >= 0.5) {
          const pl = L.polyline(bez(f.a, f.p), {color: col, weight: w, opacity: 0.85, lineCap: 'round', className: 'sfl', interactive: false}).addTo(gF);
          const el2 = pl.getElement && pl.getElement(); if (el2) { el2.setAttribute('pathLength', '1'); el2.style.animationDelay = i * 60 + 'ms'; }
          lg.line = true; if (f.local) lg.inn = true; else lg.out = true;
        }
        L.circleMarker(toLL(f.p), {radius: 3 + w / 3, color: '#fff', weight: 1.5, fillColor: col, fillOpacity: 1, interactive: false}).addTo(gF);
        const dn = shortNm(f.to), ll = toLL(f.p);
        const named = labels.some(([p]) => Math.hypot(p[0] - f.p[0], p[1] - f.p[1]) < 1.5) || nameTips.some((t) => { const a = t.getLatLng(); return Math.hypot(a.lat - ll[0], a.lng - ll[1]) < 0.03; });
        if (dn && !named) {
          const tip = L.tooltip({permanent: true, direction: 'left', className: 'klab cname cdest', offset: [-6, 0], interactive: false}).setLatLng(ll).setContent(dn).addTo(gF);
          tip._feat = false; tip._rank = 1000 + i; destTips.push(tip);
        }
      });
      for (const [p, t, me] of labels) L.tooltip({permanent: true, direction: 'top', className: 'stip' + (me ? ' me' : ''), offset: [0, -6]}).setLatLng(toLL(p)).setContent(t).addTo(gF);
      const me = labels.find((x) => x[2]);
      if (me) {
        const ll = toLL(me[0]);
        L.circleMarker(ll, {radius: 16, color: '#0b0f13', weight: 6, opacity: 0.75, fill: false, interactive: false}).addTo(gF);
        L.circleMarker(ll, {radius: 16, color: '#ffd60a', weight: 3, fill: false, interactive: false, className: 'hlring'}).addTo(gF);
        lg.ring = true;
      }
      if (buried.length && list[0] && list[0].a) {
        const sum = buried.reduce((s, f) => s + (f.amount || 0), 0);
        const money = typeof krw === 'function' ? krw(sum) : '';
        const icon = L.divIcon({className: 'loc-badge-wrap', html: `<span class="loc-badge r"><i></i><b>우리 시 ${money}</b></span>`, iconSize: [1, 1], iconAnchor: [0, 0]});
        const mk = L.marker(toLL(list[0].a), {interactive: false, keyboard: false, icon, zIndexOffset: 800}).addTo(gF);
        seatBadge(map, mk);
        lg.badge = true;
      }
      syncLg();
      scheduleDeclutter();
    },
    fly(p, z) { vis(() => map.flyTo(toLL(p), Math.min(z, 9.5), {duration: 0.8, easeLinearity: 0.2})); },
    fit(pts) { vis(() => map.flyToBounds(L.latLngBounds(pts.map(toLL)).pad(0.25), {duration: 0.8, maxZoom: 8})); },
    home() { vis(() => map.flyToBounds(korea, {duration: 0.8})); },
    once(fn) { map.once('moveend', fn); },
    destroy() { map.remove(); box.classList.remove('sat'); box.replaceChildren(); },
  };
  homeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); view.onhome && view.onhome(); });
  let lineArgs = null;
  map.on('zoomend moveend', () => view.oncam && view.oncam());
  map.on('zoomend', () => { if (map._noRelocal || !lineArgs) return; const a = lineArgs; lineArgs = null; view.lines(a[0], a[1], a[2]); });
  return view;
}

// ---------- 가벼운 SVG 지도(대체) ----------
function svgView(box, geo, cities, onPick) {
  const full = [0, 0, geo.w, geo.h];
  const svg = sv('svg', {viewBox: full.join(' '), role: 'img', 'aria-label': '대한민국 지도 위 돈의 흐름'});
  const gP = sv('g', {class: 'provs'}), gF = sv('g', {class: 'flows'}), gD = sv('g', {class: 'dests'}), gC = sv('g', {class: 'cits'}), gL = sv('g', {class: 'labels'}), gN = sv('g', {class: 'names'});
  for (const p of geo.provinces) gP.append(sv('path', {d: p.d}));
  svg.append(gP, gF, gD, gC, gN, gL); box.replaceChildren(svg);
  box.style.touchAction = 'none';
  const maxT = cities[0] ? cities[0].total : 1, dots = new Map();
  const shortNm = (name) => { const t = String(name || '').trim().split(/\s+/).pop() || ''; const base = t.replace(/(특별자치시|특별자치도|특별시|광역시)$/, ''); const m = base.match(/^(.+)(시|군|구)$/); return (m && m[1].length >= 2) ? m[1] : (base || t); };
  const nmCount = {}; for (const c of cities) { const s = shortNm(c.name); nmCount[s] = (nmCount[s] || 0) + 1; }
  const placeNm = (c) => { const s = shortNm(c.name); if ((nmCount[s] || 0) < 2) return s; const p = String(c.name || '').trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + s : s; };
  const nameEls = cities.map((c, i) => { const t = sv('text', {x: c.p[0] + 6, y: c.p[1], class: 'lb nm'}); t.textContent = placeNm(c); t.style.visibility = 'hidden'; gN.append(t); return {el: t, p: c.p, rank: i}; });
  for (const c of cities) { const e = sv('circle', {cx: c.p[0], cy: c.p[1], class: 'cdot'}); e.dataset.r = 2.5 + 16 * Math.sqrt(c.total / maxT); gC.append(e); dots.set(c.slug, e); }
  let vb = full.slice(), anim = 0, camFn = () => {};
  const sizes = () => {
    const k = vb[2] / geo.w;
    svg.querySelectorAll('.cdot, .dd').forEach((e) => e.setAttribute('r', (+e.dataset.r) * Math.max(k, 0.35)));
    svg.querySelectorAll('.labels text, .names text').forEach((t) => { t.setAttribute('font-size', 12 * k); if (t.classList.contains('nm')) t.setAttribute('dy', 4 * k); else t.setAttribute('dy', -7 * k); });
  };
  const labelFit = () => {
    const m = svg.getScreenCTM(); if (!m) return;
    const br = box.getBoundingClientRect(), zIn = vb[2] < geo.w * 0.72, seen = [];
    const hit = (a, b) => !(a.right + 4 < b.left || a.left - 4 > b.right || a.bottom + 4 < b.top || a.top - 4 > b.bottom);
    gL.querySelectorAll('text').forEach((t) => { const r = t.getBoundingClientRect(); if (r.width > 2 && t.style.visibility !== 'hidden') seen.push(r); });
    const home = box.querySelector('.map-home'); if (home) { const r = home.getBoundingClientRect(); if (r.width > 2) seen.push(r); }
    nameEls.forEach(({el, p, rank}) => {
      el.style.visibility = 'hidden';
      if (!zIn && rank >= 14) return;
      const x = p[0] * m.a + m.e, y = p[1] * m.d + m.f;
      if (x < br.left + 4 || x > br.right - 4 || y < br.top + 4 || y > br.bottom - 4) return;
      el.style.visibility = 'visible';
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.left < br.left || r.right > br.right || r.top < br.top || r.bottom > br.bottom || seen.some((q) => hit(r, q))) { el.style.visibility = 'hidden'; return; }
      seen.push(r);
    });
  };
  const zoomTo = (t) => {
    cancelAnimationFrame(anim);
    const from = vb.slice(), t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 650;
    const step = (now) => { const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      vb = from.map((v, i) => v + (t[i] - v) * e); svg.setAttribute('viewBox', vb.join(' ')); sizes(); labelFit(); if (u < 1) anim = requestAnimationFrame(step); else camFn(); };
    anim = requestAnimationFrame(step);
  };
  const fitBox = (pts, minS = 90) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const ar = box.clientHeight / box.clientWidth || geo.h / geo.w;
    let w = Math.max(x1 - x0, minS) * 1.35, h = Math.max(y1 - y0, minS) * 1.35;
    if (h / w > ar) w = h / ar; else h = w * ar;
    w = Math.min(w, geo.w); h = Math.min(h, geo.h);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [Math.max(0, Math.min(geo.w - w, cx - w / 2)), Math.max(0, Math.min(geo.h - h, cy - h / 2)), w, h];
  };
  const curve = (a, b) => {
    const pts = window.mtArc ? mtArc(a, b) : null;
    if (pts) return 'M' + pts.map((p) => p[0] + ',' + p[1]).join(' L');
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = d < 12 ? Math.max(d * 0.6, 2.5) : Math.min(d * 0.28, 60);
    return `M${a[0]},${a[1]} Q${(a[0] + b[0]) / 2 - (dy / d) * o},${(a[1] + b[1]) / 2 + (dx / d) * o} ${b[0]},${b[1]}`;
  };
  const applyZoom = (base, k, sx, sy) => {
    let w = base[2] * k, h = base[3] * k;
    w = Math.max(48, Math.min(geo.w, w));
    h = w * (base[3] / base[2]);
    if (h > geo.h) { h = geo.h; w = h * (base[2] / base[3]); }
    const rx = (sx - base[0]) / base[2], ry = (sy - base[1]) / base[3];
    let x = sx - rx * w, y = sy - ry * h;
    x = Math.max(0, Math.min(geo.w - w, x));
    y = Math.max(0, Math.min(geo.h - h, y));
    cancelAnimationFrame(anim);
    vb = [x, y, w, h];
    svg.setAttribute('viewBox', vb.join(' '));
    sizes(); labelFit(); camFn();
  };
  let armed = false, pinch0 = null;
  box.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || armed)) return;
    e.preventDefault();
    const m = svg.getScreenCTM(); if (!m) return;
    applyZoom(vb, e.deltaY < 0 ? 0.8 : 1.25, (e.clientX - m.e) / m.a, (e.clientY - m.f) / m.d);
  }, {passive: false});
  box.addEventListener('mouseleave', () => { armed = false; });
  box.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2) return;
    const [t0, t1] = e.touches;
    pinch0 = {d: Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY) || 1, vb: vb.slice(), cx: (t0.clientX + t1.clientX) / 2, cy: (t0.clientY + t1.clientY) / 2};
  }, {passive: true});
  box.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !pinch0) return;
    e.preventDefault();
    const [t0, t1] = e.touches, d = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY) || 1, m = svg.getScreenCTM();
    if (!m) return;
    applyZoom(pinch0.vb, pinch0.d / d, (pinch0.cx - m.e) / m.a, (pinch0.cy - m.f) / m.d);
  }, {passive: false});
  box.addEventListener('touchend', () => { pinch0 = null; });
  box.addEventListener('touchcancel', () => { pinch0 = null; });
  svg.addEventListener('click', (ev) => {
    armed = true;
    const m = svg.getScreenCTM(); if (!m) return; let best = null, bd = 30;
    for (const c of cities) { const r = (+dots.get(c.slug).getAttribute('r') || 0) * m.a;
      const d = Math.hypot(ev.clientX - (c.p[0] * m.a + m.e), ev.clientY - (c.p[1] * m.d + m.f)) - r; if (d < bd) { bd = d; best = c; } }
    if (best) onPick(best.slug); else if (view2.onempty) view2.onempty();
  });
  sizes();
  let svgHl = false;
  const svgLg = {out: false, inn: false, line: false, badge: false, ring: false};
  const syncSvg = () => {
    if (!window.mtLegend) return;
    const parts = [];
    if (!svgLg.line && !svgLg.badge) {
      parts.push({t: 'dot', c: '#0a84ff', l: '시가 맺은 계약'});
      parts.push({t: 'w', c: '#0a84ff', l: '동그라미가 클수록 돈이 많아요'});
    } else {
      if (!svgLg.inn && !svgLg.badge && svgLg.out) {
        parts.push({t: 'dot', c: '#0a84ff', l: '시가 맺은 계약'});
        parts.push({t: 'w', c: '#0a84ff', l: '동그라미가 클수록 돈이 많아요'});
      }
      if (svgLg.inn || svgLg.badge) parts.push({t: 'dot', c: '#0a84ff', l: '우리 시 업체'});
      if (svgLg.out) parts.push({t: 'ln', c: '#ff9f0a', l: '다른 지역으로 간 돈'});
      if (svgLg.line) parts.push({t: 'w', c: svgLg.out ? '#ff9f0a' : '#0a84ff', l: '선이 굵을수록 돈이 많아요'});
    }
    if (svgLg.ring || svgHl) parts.push({t: 'ring', l: '지금 고른 곳'});
    mtLegend(box, parts);
  };
  const view2 = {
    resize(tot, all) { const mx = Math.max(1, ...Object.values(tot)); dots.forEach((e, s) => { const t = tot[s] || 0; e.dataset.r = t ? 2.5 + 16 * Math.sqrt(t / mx) : (all ? 2.5 : 0); }); sizes(); },
    highlight(p) { gL.querySelectorAll('.hl').forEach((x) => x.remove()); svgHl = !!p; if (p) { const c = sv('circle', {cx: p[0], cy: p[1], class: 'hl dd'}); c.dataset.r = 9; gL.prepend(c); sizes(); } syncSvg(); camFn(); },
    hlOn() { return !!gL.querySelector('.hl'); },
    readCam() { return {vb: vb.slice()}; },
    sameCam(s) { return !!(s && s.vb && s.vb.length === vb.length && s.vb.every((v, i) => Math.abs(v - vb[i]) < 0.6)); },
    previewFly(p) { return {vb: fitBox([p], 160).slice()}; },
    jump(p) { cancelAnimationFrame(anim); vb = fitBox([p], 160); svg.setAttribute('viewBox', vb.join(' ')); sizes(); labelFit(); camFn(); },
    fitNow(pts) { if (!pts || !pts.length) return; cancelAnimationFrame(anim); vb = fitBox(pts, 36); svg.setAttribute('viewBox', vb.join(' ')); sizes(); labelFit(); camFn(); },
    onsize: null,
    set oncam(fn) { camFn = fn || (() => {}); },
    get oncam() { return camFn; },
    onhome: null,
    select(slug) { dots.forEach((e, s) => e.classList.toggle('on', s === slug)); svg.classList.toggle('picked', !!slug); },
    lines(list, maxA, labels) {
      gF.replaceChildren(); gD.replaceChildren(); gL.replaceChildren();
      svgLg.out = svgLg.inn = svgLg.line = svgLg.badge = svgLg.ring = false;
      const buried = [];
      list.forEach((f, i) => {
        const w = window.mtW ? mtW(f.amount, maxA) : 1.5 + 7 * Math.sqrt((f.amount || 0) / (maxA || 1));
        const svgD = f.a && f.p ? Math.hypot(f.a[0] - f.p[0], f.a[1] - f.p[1]) : 99;
        if (f.local && svgD < 18) { buried.push(f); return; }
        if (svgD >= 2) {
          const p = sv('path', {d: curve(f.a, f.p), class: 'fl ' + (f.local ? 'in' : 'out'), 'stroke-width': w.toFixed(1)});
          p.style.animationDelay = i * 60 + 'ms'; gF.append(p);
          svgLg.line = true; if (f.local) svgLg.inn = true; else svgLg.out = true;
        }
        const d = sv('circle', {cx: f.p[0], cy: f.p[1], class: 'dd ' + (f.local ? 'in' : 'out')}); d.dataset.r = 2 + w / 3; gD.append(d);
      });
      for (const [p, t, me] of labels) { const e = sv('text', {x: p[0], y: p[1], class: 'lb' + (me ? ' me' : '')}); e.textContent = t; gL.append(e); }
      const me = labels.find((x) => x[2]);
      if (me) { const c = sv('circle', {cx: me[0][0], cy: me[0][1], class: 'hl dd'}); c.dataset.r = 9; c.setAttribute('stroke', '#ffd60a'); c.setAttribute('fill', 'none'); gL.prepend(c); svgLg.ring = true; }
      if (buried.length && list[0] && list[0].a) {
        const p = list[0].a, sum = buried.reduce((s, f) => s + (f.amount || 0), 0);
        const d = sv('circle', {cx: p[0] + 18, cy: p[1] - 14, class: 'dd in'}); d.dataset.r = 5; gD.append(d);
        const e = sv('text', {x: p[0] + 26, y: p[1] - 10, class: 'lb'}); e.textContent = '우리 시 ' + (typeof krw === 'function' ? krw(sum) : ''); gL.append(e);
        svgLg.badge = true;
      }
      sizes(); labelFit(); syncSvg();
    },
    fly(p) { zoomTo(fitBox([p], 160)); },
    fit(pts) { zoomTo(fitBox(pts)); },
    home() { zoomTo(full); },
    once(fn) { setTimeout(fn, 700); },
    destroy() { box.replaceChildren(); },
  };
  const homeBtn = document.createElement('button');
  homeBtn.type = 'button';
  homeBtn.className = 'map-home is-home';
  homeBtn.innerHTML = '<span aria-hidden="true">⟲</span> 처음으로';
  homeBtn.setAttribute('aria-label', '지도를 처음 본 모습으로 되돌리기');
  homeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); view2.onhome && view2.onhome(); });
  box.append(homeBtn);
  view2.homeBtn = homeBtn;
  if (window.ResizeObserver) { let ts = 0; new ResizeObserver(() => { clearTimeout(ts); ts = setTimeout(() => view2.onsize && view2.onsize(), 80); }).observe(box); }
  return view2;
}

// ---------- 화면 ----------
async function moneyMap(root, opts = {}) {
  const [geo, fl] = await Promise.all([getJSON('assets/geo.json'), getJSON('data/flows.json')]);
  const box = $('.map', root), panel = $('.flowpanel', root);
  const cities = Object.entries(fl.cities).map(([slug, c]) => ({slug, ...c})).filter((c) => c.p).sort((a, b) => b.total - a.total);
  let cur = null, mode = 'city', view, cat = '전체';
  let homeMode = 'city', homeCur = null, homeCam = null, resetToFirst = () => {}, seated = false, nudged = false, live = false;
  const syncMapHome = () => { if (!view || !view.homeBtn || !homeCam) return; view.homeBtn.classList.toggle('is-home', mode === homeMode && cur === homeCur && !view.hlOn() && view.sameCam(homeCam)); };
  // 지도 칸이 숨겨져 있다 열리면(도시 페이지 탭) 처음 화면을 그 크기에 다시 맞춘다
  const flowPts = (c) => [c.p, ...(c.flows || []).filter((f) => f.p).map((f) => f.p)];
  const seatFixed = () => { const c = dataOf(opts.fixed); if (!c || !view || !c.p) return; view._seating = 1; if (view.fitNow) view.fitNow(flowPts(c)); else if (view.jump) view.jump(c.p, 8); if (cur === opts.fixed) drawCity(c); view._seating = 0; homeCam = view.readCam(); homeMode = 'city'; homeCur = opts.fixed; seated = true; nudged = false; syncMapHome(); };
  const dataOf = (slug) => { const c = fl.cities[slug]; if (!c || cat === '전체') return c;
    const b = (c.by_cat || {})[cat] || {total: 0, known: 0, local: 0, count: 0, flows: []}; return {...c, ...b, other: null, cat}; };
  const pickCity = (slug) => { if (opts.fixed) return; setSeg('city'); showCity(slug, {fly: true, z: 9}); if (matchMedia('(max-width: 899px)').matches) setTimeout(() => panel.scrollIntoView({behavior: 'smooth', block: 'nearest'}), 300); };
  const mount = (kind) => {
    view = (kind === 'svg' ? svgView : satView)(box, geo, cities, pickCity);
    view.oncam = () => { if (!view._seating && homeCam && !view.sameCam(homeCam)) nudged = true; syncMapHome(); };
    view.onhome = () => { nudged = false; resetToFirst(); };
    view.onsize = () => {
      const ok = box.clientWidth > 40 && box.clientHeight > 40;
      const reveal = ok && !live; live = ok;
      if (!ok) return;
      if (opts.fixed && !view.hlOn() && !nudged && (reveal || !seated)) seatFixed();
      else syncMapHome();
    };
    if (!opts.fixed) view.onmulti = (slugs) => { panel.replaceChildren(el('p', 'fq', '여러 시가 겹쳐 있어요. 하나를 고르세요')); const w = el('div', 'pickrow'); for (const s2 of slugs) { const b = el('button', 'chip', (window.CITY_FULL || {})[s2] || fl.cities[s2].name); b.type = 'button'; b.onclick = () => pickCity(s2); w.append(b); } panel.append(w); panel.scrollIntoView({behavior: 'smooth', block: 'nearest'}); };
    if (!opts.fixed) view.onempty = () => { if (mode !== 'nation') { setSeg('nation'); showNation(); } };
    view.onfail = () => { view.destroy(); mount('svg'); if (cat !== '전체') ctl.setCat(cat); else redraw(false); view.once(() => { homeCam = view.readCam(); homeMode = mode; homeCur = cur; syncMapHome(); }); };
  };
  try { mount('sat'); } catch (e) { mount('svg'); }
  if (!opts.fixed) { const rb = el('button', 'resetbtn', '전국 보기'); rb.type = 'button'; rb.addEventListener('click', (e) => { e.stopPropagation(); setSeg('nation'); showNation(); }); (box.parentElement || root).append(rb); }

  const share = (x, t) => (t ? Math.round((x / t) * 100) + '%' : '—');
  const row = (name, sub, amt, frac, cls) => {
    const r = el('div', 'frow ' + (cls || '')); const l = el('div', 'fl-l');
    l.append(el('span', 'fn', name), el('span', 'fs', sub)); r.append(l, el('span', 'fa', amt));
    const b = el('i', 'fb'); b.style.width = Math.max(2, frac * 100) + '%'; r.append(b); return r;
  };
  const drawCity = (c) => {
    const list = c.flows.map((f) => ({...f, a: c.p}));
    const labels = list.filter((f) => !f.local).slice(0, 3).map((f) => [f.p, f.to.split(' ').slice(1).join(' ') || f.to]);
    labels.push([c.p, c.name.split(' ').pop(), true]);
    view.lines(list, Math.max(...list.map((f) => f.amount), 1), labels);
    return list;
  };
  // where: 고른 시·군·구 좌표(있으면 그곳으로 날아간 뒤 흐름을 그린다)
  const showCity = (slug, o = {}) => {
    const c = dataOf(slug); if (!c) return;
    cur = slug; mode = 'city'; view.select(slug); syncMapHome();
    const list = c.flows.map((f) => ({...f, a: c.p}));
    if (o.fly) { view.lines([], 1, []); view.fly(o.where || c.p, o.z || (o.where ? 12 : 11)); view.once(() => { if (cur === slug && mode === 'city') drawCity(c); }); }
    else { drawCity(c); if (o.zoom !== false) view.fit([c.p, ...list.map((f) => f.p)]); }
    panel.replaceChildren();
    const h = el('div', 'fh'); h.append(el('span', 'fh-n', ((window.CITY_FULL || {})[slug] || c.name) + (c.cat ? ' · ' + c.cat : '')), el('span', 'fh-v', krw(c.total)));
    if (!opts.fixed) { const x = el('button', 'fclose', '× 닫기'); x.type = 'button'; x.setAttribute('aria-label', '닫고 전국 보기'); x.onclick = () => { setSeg('nation'); showNation(); }; h.append(x); }
    panel.append(h, el('p', 'fq', '이 돈은 어디로 갔나'));
    if (!c.total) { panel.append(el('p', 'sub', '아직 수집된 계약이 없습니다. 공식 자료가 올라오면 자동으로 반영됩니다.')); return; }
    if (!c.known) { panel.append(el('p', 'sub', '업체 주소를 확인하는 중입니다.')); return; }
    const out = c.known - c.local;
    const sp = el('div', 'fsplit'); const bar = el('div', 'splitbar'); const i = el('i'); i.style.width = share(c.local, c.known); bar.append(i);
    const lg = el('div', 'legend'); lg.innerHTML = `<span><b class="dot in"></b>우리 시 업체 <b>${share(c.local, c.known)}</b></span><span><b class="dot out2"></b>다른 지역 업체 <b>${share(out, c.known)}</b></span>`;
    sp.append(bar, lg); panel.append(sp);
    const top = list.slice(0, opts.rows || 6);
    for (const f of top) {
      const r = row(f.to, `${f.count.toLocaleString('ko-KR')}건 · ${f.local ? '우리 시' : '다른 지역'}`, `${share(f.amount, c.known)} · ${krw(f.amount)}`, f.amount / c.known, f.local ? 'in' : 'out');
      if (f.vendors && f.vendors.length) {
        const btn = el('button', 'frow-btn'); btn.type = 'button'; btn.setAttribute('aria-expanded', 'false'); btn.append(r);
        const vl = el('div', 'vlist'); vl.hidden = true;
        for (const v of f.vendors) { const a = el('a', 'vrow'); a.href = 'vendor.html?v=' + v.id;
          const l = el('span', 'vn', v.name); l.append(el('small', '', v.count.toLocaleString('ko-KR') + '건')); a.append(l, el('span', 'va', krw(v.amount)), el('span', 'chev', '›')); vl.append(a); }
        btn.addEventListener('click', () => { const open = vl.hidden; panel.querySelectorAll('.vlist').forEach((x) => (x.hidden = true)); panel.querySelectorAll('.frow-btn').forEach((x) => x.setAttribute('aria-expanded', 'false'));
          vl.hidden = !open; btn.setAttribute('aria-expanded', String(open)); view.highlight(open ? f.p : null); });
        panel.append(btn, vl);
      } else panel.append(r);
    }
    const restN = list.length - top.length + (c.other ? c.other.n : 0);
    if (restN > 0) panel.append(el('p', 'sub small', `그 밖의 ${restN}곳`));
    if (c.known < c.total) panel.append(el('p', 'sub small', `주소가 확인된 계약 ${share(c.known, c.total)} 기준`));
    const all = el('button', 'ghostbtn', '흐름 전체 보기'); all.type = 'button';
    all.addEventListener('click', () => { const pts = [c.p, ...list.map((f) => f.p)]; if (view.fitNow) view.fitNow(pts); else view.fit(pts); drawCity(c); root.scrollIntoView({behavior: 'smooth'}); });
    panel.append(all);
    if (!opts.fixed) { const g = el('a', 'gobtn', c.name + ' 자세히 보기'); g.href = 'city.html?c=' + slug; panel.append(g);
      if (window.regionPicker) { const ob = el('button', 'ghostbtn', '다른 지역 ▾'); ob.type = 'button'; ob.onclick = () => regionPicker(slug, (s2) => pickCity(s2)); panel.append(ob); } }
  };
  const showNation = () => {
    cur = null; mode = 'nation'; view.select(null); syncMapHome();
    const list = (cat === '전체' ? fl.nation : (fl.nation_cat || {})[cat] || []).slice(0, 25).map((f) => ({...f, a: fl.cities[f.from].p, local: false}));
    view.lines(list, Math.max(...list.map((f) => f.amount), 1), []);
    view.home();
    panel.replaceChildren(el('p', 'fq', '시 밖으로 나간 가장 큰 돈' + (cat === '전체' ? '' : ' · ' + cat)));
    const maxA = list[0] ? list[0].amount : 1;
    for (const f of list.slice(0, 6)) panel.append(row(`${fl.cities[f.from].name} → ${f.to}`, f.count ? f.count.toLocaleString('ko-KR') + '건' : '', krw(f.amount), f.amount / maxA, 'out'));
    panel.append(el('p', 'sub small', '지도의 원을 누르면 그 시의 돈이 어디로 갔는지 보여줍니다.'));
  };
  const redraw = (zoom) => (mode === 'nation' ? showNation() : cur && showCity(cur, {zoom}));

  const seg = $('.seg', root);
  const setSeg = (v) => seg && seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === v));
  if (seg) seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; setSeg(b.dataset.v);
    if (b.dataset.v === 'nation') showNation(); else showCity(cur || cities[0].slug, {fly: true});
  });

  // 지역 찾기: 시 이름 또는 시·군·구 이름. 브라우저 안에서만 맞춰 본다(아무 데도 보내지 않음).
  const places = [];
  for (const c of cities) places.push({label: c.name, slug: c.slug, p: c.p});
  for (const [k, p] of Object.entries(geo.points)) {
    const t = k.split(' '); if (t.length < 2) continue;
    const si = t[1].match(/^(.+?시)(.+구)?$/);
    const owner = cities.find((c) => c.name === t[0] + ' ' + (si ? si[1] : t[1])) || cities.find((c) => c.name === t[0]);
    const label = t[0] + ' ' + (si && si[2] ? si[1] + ' ' + si[2] : t[1]);
    if (!places.some((x) => x.label === label)) places.push({label, slug: owner ? owner.slug : null, p});
  }
  const input = $('.placeq', root), dl = $('datalist', root);
  if (input && dl) {
    for (const x of places) { const o = el('option'); o.value = x.label; dl.append(o); }
    const go = () => {
      const q = input.value.trim().replace(/\s+/g, ' '); if (!q) return;
      const x = places.find((x) => x.label === q) || places.find((x) => x.label.replace(/ /g, '').includes(q.replace(/ /g, '')));
      if (!x) { input.setCustomValidity('찾는 지역이 없어요'); input.reportValidity(); return; }
      input.setCustomValidity(''); input.blur(); setSeg('city');
      if (x.slug) showCity(x.slug, {fly: true, where: x.p});
      else { cur = null; mode = 'city'; view.select(null); view.lines([], 1, [[x.p, x.label.split(' ').pop(), true]]); view.fly(x.p, 12);
        panel.replaceChildren(el('p', 'fq', x.label), el('p', 'sub', '이곳은 시가 아니라서(군 지역) 계약을 따로 모으지 않습니다. 가까운 시의 원을 눌러 보세요.')); }
    };
    input.addEventListener('change', go);
    input.form && input.form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
  }
  resetToFirst = () => {
    view.highlight(null);
    if (opts.fixed) { showCity(opts.fixed, {zoom: false}); seatFixed(); }
    else { setSeg('city'); showCity(cities[0].slug, {zoom: false}); view.home(); }
  };
  if (opts.fixed) { const c = fl.cities[opts.fixed]; if (c) { showCity(opts.fixed, {zoom: false}); homeCam = view.previewFly ? view.previewFly(c.p, 10) : null; homeMode = 'city'; homeCur = opts.fixed; if (box.clientWidth > 40 && box.clientHeight > 40) { live = true; seatFixed(); } } }
  else { setSeg('city'); showCity(cities[0].slug, {zoom: false}); homeCam = view.readCam(); homeMode = mode; homeCur = cur; syncMapHome(); }
  const ctl = {setCat(c) { cat = c; view.resize(Object.fromEntries(cities.map((x) => [x.slug, (dataOf(x.slug) || {}).total || 0])), c === '전체'); view.highlight(null); redraw(true); }};
  root.append(el('p', 'sub small', `업체 위치: ${fl.basis}. 지도: Esri 다크 그레이 베이스(라벨 없음) + 자체 한글 표기, 경계 ${geo.source}. 갱신 ${when(fl.updated)}`));
  return ctl;
}

// 도시 페이지 위쪽 작은 지도: 주황 흐름만 보여 주고, 누르면 본 지도로 간다.
window.moneyPeek = (el, slug) => {
  if (!el || !slug || typeof getJSON !== 'function') return;
  Promise.all([getJSON('assets/geo.json'), getJSON('data/flows.json')]).then(([geo, fl]) => {
    const c = fl.cities && fl.cities[slug]; if (!c || !c.p) return;
    const orange = (c.flows || []).filter((f) => f.p && !f.local);
    const local = (c.flows || []).some((f) => f.local);
    const pts = [c.p, ...orange.map((f) => f.p)];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const pad = 36; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const w = Math.max(80, x1 - x0), h = Math.max(80, y1 - y0);
    const svg = sv('svg', {viewBox: [x0, y0, w, h].join(' '), 'aria-hidden': 'true'});
    for (const p of geo.provinces || []) svg.append(sv('path', {d: p.d, fill: '#121a22', stroke: '#2c3a48', 'stroke-width': '1.4', 'vector-effect': 'non-scaling-stroke'}));
    const curve = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = Math.min(d * 0.28, 60); return `M${a[0]},${a[1]} Q${(a[0] + b[0]) / 2 - (dy / d) * o},${(a[1] + b[1]) / 2 + (dx / d) * o} ${b[0]},${b[1]}`; };
    for (const f of orange) svg.append(sv('path', {d: curve(c.p, f.p), fill: 'none', stroke: '#ff9f0a', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke'}));
    const rr = Math.max(w, h) * 0.018;
    svg.append(sv('circle', {cx: c.p[0], cy: c.p[1], r: rr, fill: 'none', stroke: '#ffd60a', 'stroke-width': '2.5', 'vector-effect': 'non-scaling-stroke'}));
    if (local) svg.append(sv('circle', {cx: c.p[0] + rr * 2.4, cy: c.p[1] - rr * 1.6, r: Math.max(3, rr * 0.65), fill: '#0a84ff', stroke: '#fff', 'stroke-width': '1.5', 'vector-effect': 'non-scaling-stroke'}));
    const cap = document.createElement('span'); cap.className = 'mappeek-cap'; cap.textContent = '돈이 어디로 갔나';
    el.replaceChildren(svg, cap);
  }).catch(() => {});
};
