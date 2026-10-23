// 돈의 흐름 지도 — 위성 지도(Leaflet + Esri 위성 타일) 위에 시 원과 돈의 흐름 선을 겹친다.
// 타일을 못 받으면 가벼운 SVG 지도로 바뀐다. 검색어·주소는 어디에도 보내지 않는다(타일 요청은 좌표만).
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
// geo.json 좌표(SVG) ↔ 위경도. build_geo.py 와 같은 식.
const GK = Math.cos(36 * Math.PI / 180), GSX = 600 / (6.5 * GK);
const toLL = (p) => [38.7 - p[1] / GSX, 124.5 + p[0] / (GK * GSX)];

// ---------- 위성 지도 ----------
function satView(box, geo, cities, onPick) {
  if (!window.L) throw new Error('no leaflet');
  box.classList.add('sat');
  const map = L.map(box, {zoomControl: false, attributionControl: true, minZoom: 6, maxZoom: 12, zoomSnap: 0.25, tap: true,
    maxBounds: [[30.5, 121], [41, 134]], preferCanvas: false, scrollWheelZoom: false});
  { // 크기가 바뀌거나 다시 보일 때 타일이 깨지지 않게
    let t = 0; const inv = () => { clearTimeout(t); t = setTimeout(() => map.invalidateSize({pan: false}), 60); };
    if (window.ResizeObserver) new ResizeObserver(inv).observe(box);
    addEventListener('resize', inv); addEventListener('scroll', inv, {passive: true}); addEventListener('hashchange', inv); addEventListener('pageshow', inv);
    document.addEventListener('visibilitychange', () => !document.hidden && inv()); window.__inv2 = inv; }

  if (!matchMedia('(pointer: coarse)').matches) L.control.zoom({position: 'topright'}).addTo(map);
  // 페이지 스크롤을 빼앗지 않도록: 터치 기기에서는 지도를 한 번 눌러야 움직임
  if (matchMedia('(pointer: coarse)').matches) {
    map.zoomControl && map.zoomControl.remove();  // 한 손가락 이동·두 손가락 확대(기본)
  }
  const declutter = () => { const seen = []; box.querySelectorAll('.leaflet-tooltip').forEach((t) => { t.style.visibility = ''; const r = t.getBoundingClientRect(); if (seen.some((q) => !(r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom))) t.style.visibility = 'hidden'; else seen.push(r); }); };
  map.on('zoomend moveend', () => setTimeout(declutter, 30)); setTimeout(declutter, 600); window.__declutter = declutter;
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
  for (const c of cities) {
    const m = L.circleMarker(toLL(c.p), {radius: c.total > 0 ? 4 + 13 * Math.sqrt(c.total / maxT) : 4, className: 'sdot', weight: 1.5, color: c.total > 0 ? '#fff' : '#8b97a5', fillColor: c.total > 0 ? '#0a84ff' : '#3a4450', fillOpacity: c.total > 0 ? 0.55 : 0.3, interactive: false});
    m.addTo(gC); dots.set(c.slug, m); const me2 = m.getElement && m.getElement(); if (me2) me2.setAttribute('data-s', c.slug);
    if (cities.indexOf(c) < 14) L.tooltip({permanent: true, direction: 'right', className: 'klab', offset: [6, 0], interactive: false}).setLatLng(toLL(c.p)).setContent(c.name.split(' ').pop().replace(/(특별시|광역시|특별자치시)$/, '')).addTo(gC);
  }
  const bez = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = Math.min(d * 0.28, 60);
    const mx = (a[0] + b[0]) / 2 - (dy / d) * o, my = (a[1] + b[1]) / 2 + (dx / d) * o, pts = [];
    for (let t = 0; t <= 1.0001; t += 1 / 24) pts.push(toLL([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mx + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * my + t * t * b[1]]));
    return pts;
  };
  let hl = null, pend = null;
  const vis = (fn) => { if (box.clientWidth > 0 && box.clientHeight > 0) { fn(); } else pend = fn; };
  addEventListener('resize', () => { if (pend && box.clientWidth > 0) { map.invalidateSize(); const f = pend; pend = null; setTimeout(f, 50); } });
  const view = {
    resize(tot, all) { const mx = Math.max(1, ...Object.values(tot)); dots.forEach((m, s) => { const t = tot[s] || 0; m.setRadius(t ? 4 + 13 * Math.sqrt(t / mx) : (all ? 4 : 0)); }); },
    highlight(p) { if (hl) hl.remove(); hl = p ? L.circleMarker(toLL(p), {radius: 16, className: 'hlring', color: '#ffd60a', weight: 3, fill: false, interactive: false}).addTo(map) : null; if (p) vis(() => map.panTo(toLL(p))); },
    select(slug) { dots.forEach((m, s) => m.setStyle(s === slug ? {fillOpacity: 0.95, fillColor: '#0a84ff', weight: 3} : {fillOpacity: slug ? 0.3 : 0.55, weight: 1.5})); },
    lines(list, maxA, labels) {
      gF.clearLayers();
      list.forEach((f, i) => {
        const w = 2 + 9 * Math.sqrt(f.amount / maxA), col = f.local ? '#0a84ff' : '#ff6b3d';
        if (Math.hypot(f.a[0] - f.p[0], f.a[1] - f.p[1]) >= 0.5) {
          const pl = L.polyline(bez(f.a, f.p), {color: col, weight: w, opacity: 0.9, lineCap: 'round', className: 'sfl', interactive: false}).addTo(gF);
          const el2 = pl.getElement && pl.getElement(); if (el2) { el2.setAttribute('pathLength', '1'); el2.style.animationDelay = i * 60 + 'ms'; }
        }
        L.circleMarker(toLL(f.p), {radius: 3 + w / 3, color: '#fff', weight: 1.5, fillColor: col, fillOpacity: 1, interactive: false}).addTo(gF);
      });
      for (const [p, t, me] of labels) L.tooltip({permanent: true, direction: 'top', className: 'stip' + (me ? ' me' : ''), offset: [0, -6]}).setLatLng(toLL(p)).setContent(t).addTo(gF);
    },
    fly(p, z) { vis(() => map.flyTo(toLL(p), Math.min(z, 9.5), {duration: 0.8, easeLinearity: 0.2})); },
    fit(pts) { vis(() => map.flyToBounds(L.latLngBounds(pts.map(toLL)).pad(0.25), {duration: 0.8, maxZoom: 8})); },
    home() { vis(() => map.flyToBounds(korea, {duration: 0.8})); },
    once(fn) { map.once('moveend', fn); },
    destroy() { map.remove(); box.classList.remove('sat'); box.replaceChildren(); },
  };
  return view;
}

// ---------- 가벼운 SVG 지도(대체) ----------
function svgView(box, geo, cities, onPick) {
  const full = [0, 0, geo.w, geo.h];
  const svg = sv('svg', {viewBox: full.join(' '), role: 'img', 'aria-label': '대한민국 지도 위 돈의 흐름'});
  const gP = sv('g', {class: 'provs'}), gF = sv('g', {class: 'flows'}), gD = sv('g', {class: 'dests'}), gC = sv('g', {class: 'cits'}), gL = sv('g', {class: 'labels'});
  for (const p of geo.provinces) gP.append(sv('path', {d: p.d}));
  svg.append(gP, gF, gD, gC, gL); box.replaceChildren(svg);
  const maxT = cities[0] ? cities[0].total : 1, dots = new Map();
  for (const c of cities) { const e = sv('circle', {cx: c.p[0], cy: c.p[1], class: 'cdot'}); e.dataset.r = 2.5 + 16 * Math.sqrt(c.total / maxT); gC.append(e); dots.set(c.slug, e); }
  let vb = full.slice(), anim = 0;
  const sizes = () => {
    const k = vb[2] / geo.w;
    svg.querySelectorAll('.cdot, .dd').forEach((e) => e.setAttribute('r', (+e.dataset.r) * Math.max(k, 0.35)));
    gL.querySelectorAll('text').forEach((t) => { t.setAttribute('font-size', 12 * k); t.setAttribute('dy', -7 * k); });
  };
  const zoomTo = (t) => {
    cancelAnimationFrame(anim);
    const from = vb.slice(), t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 650;
    const step = (now) => { const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      vb = from.map((v, i) => v + (t[i] - v) * e); svg.setAttribute('viewBox', vb.join(' ')); sizes(); if (u < 1) anim = requestAnimationFrame(step); };
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
  const curve = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = Math.min(d * 0.28, 60);
    return `M${a[0]},${a[1]} Q${(a[0] + b[0]) / 2 - (dy / d) * o},${(a[1] + b[1]) / 2 + (dx / d) * o} ${b[0]},${b[1]}`; };
  svg.addEventListener('click', (ev) => {
    const m = svg.getScreenCTM(); if (!m) return; let best = null, bd = 30;
    for (const c of cities) { const r = (+dots.get(c.slug).getAttribute('r') || 0) * m.a;
      const d = Math.hypot(ev.clientX - (c.p[0] * m.a + m.e), ev.clientY - (c.p[1] * m.d + m.f)) - r; if (d < bd) { bd = d; best = c; } }
    if (best) onPick(best.slug); else if (view2.onempty) view2.onempty();
  });
  sizes();
  const view2 = {
    resize(tot, all) { const mx = Math.max(1, ...Object.values(tot)); dots.forEach((e, s) => { const t = tot[s] || 0; e.dataset.r = t ? 2.5 + 16 * Math.sqrt(t / mx) : (all ? 2.5 : 0); }); sizes(); },
    highlight(p) { gL.querySelectorAll('.hl').forEach((x) => x.remove()); if (p) { const c = sv('circle', {cx: p[0], cy: p[1], class: 'hl dd'}); c.dataset.r = 9; gL.prepend(c); sizes(); } },
    select(slug) { dots.forEach((e, s) => e.classList.toggle('on', s === slug)); svg.classList.toggle('picked', !!slug); },
    lines(list, maxA, labels) {
      gF.replaceChildren(); gD.replaceChildren(); gL.replaceChildren();
      list.forEach((f, i) => { const w = 1.5 + 9 * Math.sqrt(f.amount / maxA);
        if (Math.hypot(f.a[0] - f.p[0], f.a[1] - f.p[1]) >= 2) { const p = sv('path', {d: curve(f.a, f.p), class: 'fl ' + (f.local ? 'in' : 'out'), 'stroke-width': w.toFixed(1)}); p.style.animationDelay = i * 60 + 'ms'; gF.append(p); }
        const d = sv('circle', {cx: f.p[0], cy: f.p[1], class: 'dd ' + (f.local ? 'in' : 'out')}); d.dataset.r = 2 + w / 3; gD.append(d); });
      for (const [p, t, me] of labels) { const e = sv('text', {x: p[0], y: p[1], class: 'lb' + (me ? ' me' : '')}); e.textContent = t; gL.append(e); }
      sizes();
    },
    fly(p) { zoomTo(fitBox([p], 160)); },
    fit(pts) { zoomTo(fitBox(pts)); },
    home() { zoomTo(full); },
    once(fn) { setTimeout(fn, 700); },
    destroy() { box.replaceChildren(); },
  };
  return view2;
}

// ---------- 화면 ----------
async function moneyMap(root, opts = {}) {
  const [geo, fl] = await Promise.all([getJSON('assets/geo.json'), getJSON('data/flows.json')]);
  const box = $('.map', root), panel = $('.flowpanel', root);
  const cities = Object.entries(fl.cities).map(([slug, c]) => ({slug, ...c})).filter((c) => c.p).sort((a, b) => b.total - a.total);
  let cur = null, mode = 'city', view, cat = '전체';
  const dataOf = (slug) => { const c = fl.cities[slug]; if (!c || cat === '전체') return c;
    const b = (c.by_cat || {})[cat] || {total: 0, known: 0, local: 0, count: 0, flows: []}; return {...c, ...b, other: null, cat}; };
  const pickCity = (slug) => { if (opts.fixed) return; setSeg('city'); showCity(slug, {fly: true, z: 9}); if (matchMedia('(max-width: 899px)').matches) setTimeout(() => panel.scrollIntoView({behavior: 'smooth', block: 'nearest'}), 300); };
  const mount = (kind) => {
    view = (kind === 'svg' ? svgView : satView)(box, geo, cities, pickCity);
    if (!opts.fixed) view.onmulti = (slugs) => { panel.replaceChildren(el('p', 'fq', '여러 시가 겹쳐 있어요. 하나를 고르세요')); const w = el('div', 'pickrow'); for (const s2 of slugs) { const b = el('button', 'chip', (window.CITY_FULL || {})[s2] || fl.cities[s2].name); b.type = 'button'; b.onclick = () => pickCity(s2); w.append(b); } panel.append(w); panel.scrollIntoView({behavior: 'smooth', block: 'nearest'}); };
    if (!opts.fixed) view.onempty = () => { if (mode !== 'nation') { setSeg('nation'); showNation(); } };
    view.onfail = () => { view.destroy(); mount('svg'); if (cat !== '전체') ctl.setCat(cat); else redraw(false); };
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
    cur = slug; mode = 'city'; view.select(slug);
    const list = c.flows.map((f) => ({...f, a: c.p}));
    if (o.fly) { view.lines([], 1, []); view.fly(o.where || c.p, o.z || (o.where ? 12 : 11)); view.once(() => { if (cur === slug && mode === 'city') drawCity(c); }); }
    else { drawCity(c); if (o.zoom !== false) view.fit([c.p, ...list.slice(0, 8).map((f) => f.p)]); }
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
    all.addEventListener('click', () => { view.fit([c.p, ...list.slice(0, 8).map((f) => f.p)]); root.scrollIntoView({behavior: 'smooth'}); });
    panel.append(all);
    if (!opts.fixed) { const g = el('a', 'gobtn', c.name + ' 자세히 보기'); g.href = 'city.html?c=' + slug; panel.append(g);
      if (window.regionPicker) { const ob = el('button', 'ghostbtn', '다른 지역 ▾'); ob.type = 'button'; ob.onclick = () => regionPicker(slug, (s2) => pickCity(s2)); panel.append(ob); } }
  };
  const showNation = () => {
    cur = null; mode = 'nation'; view.select(null);
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
  if (opts.fixed) { const c = fl.cities[opts.fixed]; if (c) { showCity(opts.fixed, {zoom: false}); view.fly(c.p, 10); } }
  else { setSeg('city'); showCity(cities[0].slug, {zoom: false}); }
  const ctl = {setCat(c) { cat = c; view.resize(Object.fromEntries(cities.map((x) => [x.slug, (dataOf(x.slug) || {}).total || 0])), c === '전체'); view.highlight(null); redraw(true); }};
  root.append(el('p', 'sub small', `업체 위치: ${fl.basis}. 지도: Esri 다크 그레이 베이스(라벨 없음) + 자체 한글 표기, 경계 ${geo.source}. 갱신 ${when(fl.updated)}`));
  return ctl;
}
