// 홈 '세금 길' 다이브: 지도 → 지역 검색 시 비행 → 돈 흐름 선 → 바텀시트(총액 → 데이터상 이상 징후 → 업체)
(async () => {
  const root = document.getElementById('dive'); if (!root || !window.L) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GK = Math.cos(36 * Math.PI / 180), GSX = 600 / (6.5 * GK);
  const toLL = (p) => [38.7 - p[1] / GSX, 124.5 + p[0] / (GK * GSX)];
  const inKR = (ll) => ll[0] > 32.8 && ll[0] < 38.9 && ll[1] > 124.3 && ll[1] < 131.2;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const krw = (n) => { if (n == null || isNaN(n)) return '—'; const a = Math.abs(n);
    if (a >= 1e12) return (a / 1e12).toFixed(1).replace(/\.0$/, '') + '조원';
    if (a >= 1e8) return (a / 1e8 >= 100 ? Math.round(a / 1e8).toLocaleString('ko-KR') : (a / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원';
    if (a >= 1e4) return Math.round(a / 1e4).toLocaleString('ko-KR') + '만원'; return a.toLocaleString('ko-KR') + '원'; };
  const J = {}; const get = (u) => (J[u] ||= fetch(u).then((r) => { if (!r.ok) throw r.status; return r.json(); }));
  root.innerHTML = `<div class="dv-map map loading"></div><button type="button" class="dv-down" aria-label="아래 카드로">↓ 자세히</button><h1 class="dv-h1">우리 시는 얼마 썼을까?</h1>
    <form class="dv-q" role="search" autocomplete="off"><span aria-hidden="true">⌕</span><input type="search" placeholder="지역·업체 검색 (예: 수성구)" aria-label="지역 검색" enterkeyhint="search"><button type="button" class="dv-all" aria-label="전체 지역 목록">목록</button></form>
    <div class="dv-sheet" role="region" aria-label="지역 정보"><div class="dv-grab" aria-hidden="true"></div><div class="dv-body"></div></div>`;
  const box = root.querySelector('.dv-map'), sheet = root.querySelector('.dv-sheet'), body = root.querySelector('.dv-body'), form = root.querySelector('.dv-q'), inp = form.querySelector('input');
  const touch = matchMedia('(pointer: coarse)').matches;
  const map = L.map(box, {zoomControl: false, attributionControl: false, dragging: true, tap: false, scrollWheelZoom: false, minZoom: 5, maxZoom: 12, zoomSnap: 0.25});
  L.control.attribution({position: 'bottomright', prefix: false}).addTo(map); if (!touch && innerWidth >= 900) L.control.zoom({position: 'bottomleft'}).addTo(map);
  const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {maxZoom: 12, attribution: '지도: Esri, HERE, Garmin, &copy; OpenStreetMap 기여자'}).addTo(map);
  tiles.once('tileload', () => box.classList.remove('loading'));
  const KR = L.latLngBounds([[33.1, 125.0], [38.65, 129.6]]); const krPad = () => (innerWidth >= 900 ? {paddingTopLeft: [10, 10], paddingBottomRight: [10, 10]} : {paddingTopLeft: [10, 10], paddingBottomRight: [10, 10]}); map.fitBounds(KR, {...krPad(), animate: false});
  window.__dvMap = map;
  map.on('moveend', () => { if (cur && map.getZoom() < (map._dvFloor || 8) - 0.3 && !map._dvFix) { map._dvFix = 1; const c = fl && fl.cities[cur]; c && map.setView(toLL(c.p), map._dvFloor || 8, {animate: false}); map._dvFix = 0; } });
  // 휠은 페이지 스크롤 · Ctrl+휠 또는 지도를 클릭한 뒤에만 확대
  box.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() + (e.deltaY < 0 ? 0.5 : -0.5)); } }, {passive: false});
  map.on('click', () => map.scrollWheelZoom.enable()); box.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());
  root.querySelector('.dv-down').onclick = () => { const t = root.querySelector('.dv-sheet'); t && scrollTo({top: t.getBoundingClientRect().top + scrollY - 52, behavior: RM ? 'auto' : 'smooth'}); };
  { // 크기가 바뀌거나 다시 보일 때 타일이 깨지지 않게
    let t = 0; const inv = () => { clearTimeout(t); t = setTimeout(() => map.invalidateSize({pan: false}), 60); };
    if (window.ResizeObserver) new ResizeObserver(inv).observe(box);
    addEventListener('resize', inv); addEventListener('scroll', inv, {passive: true}); addEventListener('hashchange', inv); addEventListener('pageshow', inv);
    document.addEventListener('visibilitychange', () => !document.hidden && inv()); window.__inv = inv; }
  let fl, idx; try { [fl, idx] = await Promise.all([get('data/flows.json'), get('data/index.json')]); } catch (e) { body.innerHTML = '<p class="sub">지도 자료를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>'; return; }
  const C = idx.cities, BY = Object.fromEntries(C.map((c) => [c.slug, c]));
  const cities = Object.entries(fl.cities).map(([slug, c]) => ({slug, ...c})).filter((c) => c.p).sort((a, b) => b.total - a.total);
  const maxT = cities[0].total || 1, dots = new Map();
  const gC = L.layerGroup().addTo(map), gF = L.layerGroup().addTo(map);
  for (const c of cities) {
    const m = L.circleMarker(toLL(c.p), {radius: c.total ? 4 + 13 * Math.sqrt(c.total / maxT) : 4, weight: 1.5, color: c.total ? '#fff' : '#8b97a5', fillColor: c.total ? '#0a84ff' : '#3a4450', fillOpacity: c.total ? 0.5 : 0.3, interactive: false}).addTo(gC);
    dots.set(c.slug, m); const e = m.getElement(); if (e) e.setAttribute('data-s', c.slug);
  }
  const gB = L.layerGroup().addTo(map);
  window.__dvBlink = (ss) => { gB.clearLayers(); (ss || []).forEach((s, i) => { const m = dots.get(s); if (!m) return;
    const col = i ? '#ffb020' : '#5ac8fa'; L.circleMarker(m.getLatLng(), {radius: Math.max(18, m.getRadius() + 10), color: col, weight: 4, fill: false, interactive: false, className: 'dv-blink'}).addTo(gB);
    const nm = (BY[s] || {}).short || (BY[s] || {}).name || ''; L.tooltip({permanent: true, direction: i ? 'right' : 'left', offset: [i ? 20 : -20, 0], className: 'klab gm-tip gm-tip' + i, interactive: false}).setLatLng(m.getLatLng()).setContent(esc(nm)).addTo(gB); });
    if (ss && ss.length === 2 && !cur) { const b = L.latLngBounds(ss.map((s) => dots.get(s)).filter(Boolean).map((m) => m.getLatLng())); if (b.isValid() && !map.getBounds().pad(-0.1).contains(b)) map.fitBounds(b.pad(0.6), {maxZoom: 9, animate: !RM}); } };
  // 홈: 큰 시 8곳에 '이름 금액' 라벨
  const gL = L.layerGroup();
  const HL = new Map(), gLead = L.layerGroup().addTo(map);
  const homeLab = (c, v) => { const nm = (BY[c.slug] || {}).short || (BY[c.slug] || {}).name || '', ll = toLL(c.p);
    const t = L.tooltip({permanent: true, direction: 'right', className: 'klab dv-amt dv-hl', offset: [6, 0], interactive: false}).setLatLng(ll).setContent(esc(nm + ' ' + krw(v))).addTo(gL);
    HL.set(t, ll); };
  cities.filter((c) => c.total).slice(0, 8).forEach((c) => homeLab(c, c.total));
  map.on('click', (e) => { const hits = [];
    dots.forEach((m, s) => { const d = e.containerPoint.distanceTo(map.latLngToContainerPoint(m.getLatLng())); const r = m.getRadius(); if (d <= Math.max(r + 6, 22)) hits.push([d - r, s]); });
    if (!hits.length) return; hits.sort((a, b) => a[0] - b[0]);
    const inside = hits.filter((h) => h[0] <= 4);
    if (inside.length > 1) multi(inside.map((h) => h[1])); else go({c: hits[0][1]}); });

  // 라벨 겹침: 발주 라벨 먼저 자리 잡고, 나머지는 위아래로 조금씩 밀어 보고 그래도 겹치면 숨김
  const declutter = () => { const G = 8, hit = (r, q) => !(r.right + G < q.left || r.left - G > q.right || r.bottom + G < q.top || r.top - G > q.bottom), seen = [], miss = [];
    const bb = box.getBoundingClientRect(), inB = (r) => r.left >= bb.left + 2 && r.right <= bb.right - 2 && r.top >= bb.top + 2 && r.bottom <= bb.bottom - 18;
    const live = new Set(); for (const g of [gF, gL]) if (map.hasLayer(g)) g.eachLayer((l) => { const e = l.getElement && l.getElement(); if (e) live.add(e); });
    box.querySelectorAll('.dv-org, .dv-amt').forEach((e) => { if (!live.has(e)) e.remove(); });
    const L_ = [...box.querySelectorAll('.dv-org'), ...box.querySelectorAll('.dv-amt')];
    gLead.clearLayers(); const tipOf = new Map(); HL.forEach((ll, tp) => { const e = tp.getElement(); if (e) tipOf.set(e, ll); });
    const DOT = []; if (map.hasLayer(gL)) dots.forEach((m) => { const p = map.latLngToContainerPoint(m.getLatLng()); DOT.push([bb.left + p.x, bb.top + p.y, m.getRadius() + 2]); });
    const onDot = (r, own) => DOT.some(([x, y, rr]) => (!own || Math.hypot(x - own[0], y - own[1]) > 2) && Math.max(r.left - x, 0, x - r.right) ** 2 + Math.max(r.top - y, 0, y - r.bottom) ** 2 < rr * rr);
    const place = (t, strict) => { const r0 = t.getBoundingClientRect(), flip = t.classList.contains('dv-org') ? 0 : -(r0.width + 16), ll = tipOf.get(t);
      const pull = Math.min(0, bb.right - 4 - r0.right) || Math.max(0, bb.left + 4 - r0.left);
      let own = null; if (ll) { const p = map.latLngToContainerPoint(ll); own = [bb.left + p.x, bb.top + p.y]; }
      const C = []; if (ll) { for (const [dx, k] of [[0, 0], [flip, 0], [36, 36], [flip - 36, 36], [72, 72], [flip - 72, 72], [pull, 0]]) for (const dy of [0, 18, -18, 34, -34, 52, -52, 72, -72, 92, -92]) C.push([dx, dy, k + Math.abs(dy)]); C.sort((a, b) => a[2] - b[2]); }
      else for (const dx of [0, flip, pull]) for (const dy of [0, 18, -18, 34, -34, 50, -50]) C.push([dx, dy, 0]);
      for (const [dx, dy, k] of C) { const r = {left: r0.left + dx, right: r0.right + dx, top: r0.top + dy, bottom: r0.bottom + dy};
        if (inB(r) && !seen.some((q) => hit(r, q)) && (!strict || !onDot(r, own))) { t.style.marginTop = dy + 'px'; t.style.marginLeft = dx + 'px'; seen.push(r);
          if (own && k > 0) { const left = r.left > own[0], ex = left ? r.left : r.right, ey = Math.max(r.top + 4, Math.min(r.bottom - 4, own[1]));
            const toL = (x, y) => map.containerPointToLatLng([x - bb.left, y - bb.top]);
            L.polyline([ll, toL(ex, ey)], {color: '#ffd60a', weight: 1.5, opacity: 0.85, interactive: false, className: 'dv-leader'}).addTo(gLead);
            L.circleMarker(ll, {radius: 2.5, color: '#ffd60a', weight: 1.5, fillColor: '#ffd60a', fillOpacity: 1, interactive: false}).addTo(gLead); }
          return true; } }
      return false; };
    L_.forEach((t) => { t.style.visibility = ''; t.style.marginTop = '0px'; t.style.marginLeft = '0px'; t.classList.remove('dv-sm');
      if (tipOf.has(t) && place(t, true)) return;
      if (place(t)) return;
      if (t.classList.contains('dv-rc')) { t.classList.add('dv-sm'); if (place(t)) return; t.classList.remove('dv-sm'); }  // 작게 줄여서 한 번 더
      t.style.visibility = 'hidden'; if (t.classList.contains('dv-rc')) miss.push(t.textContent); });
    // 지도에 끝내 못 넣은 도착지 라벨은 지도 아래 줄에 (지도 위에 겹치지 않게)
    let m = root.querySelector('.dv-miss'); if (!m) { m = document.createElement('p'); m.className = 'dv-miss'; const dn = root.querySelector('.dv-down'); dn ? dn.before(m) : box.after(m); }
    const rs = cur && map.hasLayer(gF) && REST.n ? `그 밖 ${REST.n}곳${REST.unk ? '(주소 미확인 포함)' : ''} ${krw(REST.amt)}` : '';
    const parts = miss.map((x) => x.replace(/^→\s*/, '')); if (rs) parts.push(rs);
    m.textContent = [miss.length ? '이름표를 못 단 화살표: ' + parts.slice(0, miss.length).join(' · ') : '', rs ? '화살표 없는 곳: ' + rs : ''].filter(Boolean).join(' / '); m.hidden = !parts.length; };
  let REST = {n: 0, amt: 0};
  map.on('zoomend moveend', () => setTimeout(declutter, 30));
  const dim = (slug) => dots.forEach((m, s) => m.setStyle({opacity: !slug || s === slug ? 1 : 0.3, fillOpacity: !slug || s === slug ? 0.5 : 0.12}));
  // 세금 길: 도시 → 업체 소재지 선 그리기
  const drawFlows = (slug, hold) => {
    gF.clearLayers(); FX.set([]); REST = {n: 0, amt: 0}; const c = fl.cities[slug]; if (!c || !c.flows.length) return; const arcs = [];
    const a = c.p, top = c.flows.filter((f) => f.p && inKR(toLL(f.p))).slice(0, 10), mx = top[0] ? top[0].amount : 1;
    { const inTop = new Set(top), others = c.flows.filter((f) => !inTop.has(f)), sh = top.reduce((t, f) => t + f.amount, 0), unk = Math.max(0, (c.total || 0) - (c.known || 0));
      REST = {n: others.length, amt: others.reduce((t, f) => t + f.amount, 0) + unk, unk: unk > 0}; if (REST.amt > 0 && !REST.n) REST.n = 1; if (REST.amt <= 0) REST.n = 0;
      window.__dvLast = {slug, shown: sh, rest: REST.amt, tot: c.total, card: (BY[slug] || {}).total, re: !!c.__re, top: top.map((f) => [f.to, f.amount])}; }
    top.forEach((f, i) => {
      const b = f.p, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = d < 12 ? Math.max(d * 0.6, 2.5) : Math.min(d * 0.28, 60); // 아주 짧은 흐름도 휘어서 보이게
      const mxp = (a[0] + b[0]) / 2 - (dy / d) * o, myp = (a[1] + b[1]) / 2 + (dx / d) * o, pts = [];
      for (let t = 0; t <= 1.0001; t += 1 / 24) pts.push(toLL([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mxp + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * myp + t * t * b[1]]));
      const w = 1.5 + 7 * Math.sqrt(f.amount / mx), col = f.local ? '#0a84ff' : '#ff9f0a';
      const ln = L.polyline(pts, {color: col, weight: w, opacity: 0.85, interactive: false, className: 'dv-line'}).addTo(gF);
      const p = ln.getElement();
      if (p && !RM) { /* 확대 후에도 끊기지 않게 길이를 1로 정규화(줌마다 d가 바뀌어도 비율 유지) */ p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; p.style.transition = `stroke-dashoffset .9s ease-out ${i * 0.12}s`; p.addEventListener('transitionend', () => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; p.style.transition = ''; }, {once: true}); requestAnimationFrame(() => requestAnimationFrame(() => (p.style.strokeDashoffset = '0'))); }
      arcs.push({pts, w, col, n: Math.max(1, Math.round(1 + 5 * Math.sqrt(f.amount / mx))), d: i * 0.12});
      L.circleMarker(toLL(b), {radius: 3 + w / 3, color: col, weight: 1, fillOpacity: 0.9, interactive: false, className: RM ? '' : 'dv-rcv'}).addTo(gF);
      L.tooltip({permanent: true, direction: 'right', className: 'klab dv-amt dv-rc', offset: [4, 0], interactive: false}).setLatLng(toLL(b)).setContent('→ ' + esc(((f.to || '').split(' ').slice(-1)[0] || '') + ' ' + krw(f.amount))).addTo(gF);
    });
    const oc = BY[slug] || {}; L.circleMarker(toLL(a), {radius: 11, color: '#ffd60a', weight: 2.5, fill: false, interactive: false, className: 'dv-ring'}).addTo(gF);
    L.tooltip({permanent: true, direction: 'top', className: 'klab dv-org', offset: [0, -10], interactive: false}).setLatLng(toLL(a)).setContent(esc((oc.name || '') + ' (일을 맡긴 곳)')).addTo(gF);
    setTimeout(declutter, 50); FX.set(arcs, hold);
  };
  // 돈 흐름 입자 (canvas · 도시 화면에서만)
  const FX = (() => { const pane = map.createPane('fx'); pane.style.zIndex = 450; pane.style.pointerEvents = 'none'; const cv = document.createElement('canvas'); cv.className = 'dv-fx'; cv.setAttribute('aria-hidden', 'true'); pane.append(cv); let held = false;
    const g = cv.getContext('2d'), ph = matchMedia('(pointer:coarse)').matches, CAP = ph ? 40 : 120; let A = [], P = [], raf = 0, t0 = 0, moving = false;
    const size = () => { const r = devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight; cv.width = w * r; cv.height = h * r; cv.style.width = w + 'px'; cv.style.height = h + 'px'; g.setTransform(r, 0, 0, r, 0, 0); };
    const at = (pts, u) => { const k = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(k)), f = k - i, a = map.latLngToContainerPoint(pts[i]), b = map.latLngToContainerPoint(pts[i + 1]); return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f]; };
    const loop = (ts) => { raf = 0; if (!A.length || document.hidden || held) return; L.DomUtil.setPosition(cv, map.containerPointToLayerPoint([0, 0])); g.clearRect(0, 0, cv.width, cv.height);
      if (!moving) { const el = (ts - t0) / 1000; g.globalCompositeOperation = 'lighter';
        for (const p of P) { const a = A[p.a]; if (el < a.d * 0.5 + 0.1) continue; p.u += p.s; if (p.u > 1) p.u -= 1;
          const [x, y] = at(a.pts, p.u), r = 1.2 + a.w / 4; g.fillStyle = a.col; g.globalAlpha = 0.25; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill(); g.globalAlpha = 0.95; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      raf = requestAnimationFrame(loop); };
    const go = () => { if (!raf && A.length) raf = requestAnimationFrame(loop); };
    map.on('movestart zoomstart', () => { moving = true; g.clearRect(0, 0, cv.width, cv.height); }); map.on('moveend zoomend', () => { moving = false; });
    map.on('resize', size); document.addEventListener('visibilitychange', go);
     return {on() { if (!held) return; held = false; t0 = performance.now(); go(); }, set(arcs, hold) { held = !!hold; A = RM ? [] : arcs; P = []; g.clearRect(0, 0, cv.width, cv.height); if (!A.length) return; size();
      const tot = A.reduce((s, a) => s + a.n, 0), k = Math.min(1, CAP / tot);
      A.forEach((a, i) => { const n = Math.max(1, Math.round(a.n * k)); for (let j = 0; j < n; j++) P.push({a: i, u: j / n + Math.random() * 0.1, s: 0.004 + Math.random() * 0.002}); });
      t0 = performance.now(); go(); }}; })();
  let seq = 0;
  const fly = (slug) => { const c = fl.cities[slug]; if (!c) return; gL.remove(); gLead.clearLayers(); const ll = toLL(c.p); const my = ++seq; gF.clearLayers(); map.stop();
    const pts = [ll, ...c.flows.filter((f) => f.p && inKR(toLL(f.p))).slice(0, 10).map((f) => toLL(f.p))]; let bd = L.latLngBounds(pts);
    const wide = innerWidth >= 900, sh = wide ? 0 : sheet.offsetHeight || Math.round(root.clientHeight * 0.25);
    const o = {paddingTopLeft: [24, 24], paddingBottomRight: [24, 24], maxZoom: 9.5};
    if (map.getBoundsZoom(bd, false, L.point(48, 48)) >= 8.5) bd = bd.extend(L.latLngBounds([[ll[0] - 0.3, ll[1] - 0.35], [ll[0] + 0.3, ll[1] + 0.35]])); // 도착지 전부 보이게(전국 범위 안)
    map._dvFloor = Math.min(8, map.getBoundsZoom(bd, false, L.point(170, 60)) - 0.25);
    o.paddingBottomRight = [wide ? 140 : 110, 24]; o.paddingTopLeft = [wide ? 60 : 40, 30];
    map.invalidateSize({pan: false}); drawFlows(slug, true);
    if (RM || !box.clientWidth) { map.fitBounds(bd, {...o, animate: false}); FX.on(); return; }
    map.flyToBounds(bd, {...o, duration: 0.7});
    map.once('moveend', () => { if (my !== seq) return; map.invalidateSize({pan: false}); declutter(); FX.on(); }); setTimeout(() => { if (my === seq) FX.on(); }, 900); };

  // 검색: 시 이름·주소(시+구)
  const GU = {seoul: '종로 중 용산 성동 광진 동대문 중랑 성북 강북 도봉 노원 은평 서대문 마포 양천 강서 구로 금천 영등포 동작 관악 서초 강남 송파 강동', busan: '중 서 동 영도 부산진 동래 남 북 해운대 사하 금정 강서 연제 수영 사상', daegu: '중 동 서 남 북 수성 달서', incheon: '중 동 미추홀 연수 남동 부평 계양 서', gwangju: '동 서 남 북 광산', daejeon: '동 중 서 유성 대덕', ulsan: '중 남 동 북',
    suwon: '장안 권선 팔달 영통', seongnam: '수정 중원 분당', goyang: '덕양 일산동 일산서', yongin: '처인 기흥 수지', anyang: '만안 동안', ansan: '상록 단원', cheongju: '상당 서원 흥덕 청원', cheonan: '동남 서북', jeonju: '완산 덕진', pohang: '남 북', changwon: '의창 성산 마산합포 마산회원 진해'};
  const guOf = (w) => { w = w.replace(/구$/, ''); if (w.length < 2) return null; for (const [sl, l] of Object.entries(GU)) if (BY[sl] && l.split(' ').includes(w)) return {c: sl, gu: w + '구'}; return null; };
  const norm = (s) => s.replace(/\s/g, '').replace(/(특별시|광역시|특별자치시|특별자치도)/g, '');
  const find = (q) => { const t = norm(q); if (!t) return null; const toks = q.trim().split(/\s+/);
    let best = C.find((c) => norm(c.name) === t || norm(c.short) === t) || C.find((c) => t.startsWith(norm(c.name).replace(/시$/, ''))) || C.find((c) => norm(c.short).includes(t) || norm(c.name).includes(t));
    if (!best && toks.length > 1) best = C.find((c) => norm(c.name).replace(/시$/, '') === norm(toks[0]).replace(/시$/, ''));
    return best ? {c: best.slug, gu: toks.length > 1 && /구$/.test(toks[toks.length - 1]) ? toks[toks.length - 1] : null} : null; };
  form.addEventListener('submit', (e) => { e.preventDefault(); const f0 = !sug.hidden && sug.querySelector('button.on'); if (f0) { f0.click(); return; } const r = find(inp.value) || guOf(inp.value.trim().split(/\s+/).pop() || ''); if (!r) { inp.setCustomValidity('찾는 지역이 없어요. 85개 시만 추적해요'); inp.reportValidity(); return; } inp.setCustomValidity(''); inp.blur(); go(r); });
  const sug = document.createElement('div'); sug.className = 'dv-sug'; sug.hidden = true; form.after(sug);
  let VN = null; const loadV = () => fetch('data/rank.json').then((r) => r.json()).then((d) => { VN = (d.vendors || []).map((v) => ({...v, k: norm(v.name).replace(/주식회사|\(주\)|㈜/g, '')})); inp.value && inp.dispatchEvent(new Event('input')); }).catch(() => {});
  const pickV = (id) => { sug.hidden = true; inp.value = ''; inp.blur(); let best = null, ba = 0;
    for (const [slug, c] of Object.entries(fl.cities || {})) for (const f of c.flows || []) for (const v of f.vendors || []) if (v.id === id && v.amount > ba) { ba = v.amount; best = slug; }
    best ? go({c: best, v: id}) : (location.href = 'vendor.html?v=' + id); };
  const pickS = (r) => { sug.hidden = true; inp.value = ''; inp.blur(); go(r); };
  inp.addEventListener('input', () => { inp.setCustomValidity(''); const q = inp.value.trim(), t = norm(q);
    if (!t) { sug.hidden = true; return; }
    const toks = q.split(/\s+/), gu = toks.length > 1 ? toks[toks.length - 1] : '';
    let L_ = C.filter((c) => (norm(c.province) + norm(c.name) + norm(c.short)).includes(norm(toks[0]))).slice(0, 6);
    if (!L_.length) L_ = C.filter((c) => norm(c.name + c.short).includes(t)).slice(0, 6);
    const g = !L_.length && guOf(toks[toks.length - 1]);
    if (g) { sug.innerHTML = `<button type="button" class="on" data-s="${g.c}" data-g="${g.gu}"><b>${esc(g.gu)}는 ${esc(BY[g.c].short || BY[g.c].name)}에 포함</b><small>${esc(BY[g.c].short || BY[g.c].name)} 보기 ›</small></button>`; sug.hidden = false; sug.querySelector('button').onclick = () => pickS({c: g.c, gu: g.gu}); return; }
    const V_ = t.length >= 2 && VN ? VN.filter((v) => v.k.includes(t)).slice(0, 5) : [];
    sug.innerHTML = (L_.length || V_.length) ? L_.map((c) => `<button type="button" data-s="${c.slug}" data-g="${esc(gu)}"><b>${esc(c.name)}${gu ? ' ' + esc(gu) : ''}</b><small>${esc(c.province)}</small></button>`).join('')
      + V_.map((v) => `<button type="button" data-v="${v.id}"><b>${esc(v.name)}</b><small>업체 · ${krw(v.total)}</small></button>`).join('') : '<p class="small">찾는 지역·업체가 없어요 · 85개 시만 추적해요</p>';
    sug.hidden = false; const f0 = sug.querySelector('button'); f0 && f0.classList.add('on'); f0 && f0.dataset.s && get('data/city/' + f0.dataset.s + '.json').catch(() => {});
    sug.querySelectorAll('button').forEach((b) => (b.onclick = () => b.dataset.v ? pickV(b.dataset.v) : pickS({c: b.dataset.s, gu: /구$/.test(b.dataset.g) ? b.dataset.g : null}))); });
  inp.addEventListener('focus', loadV, {once: true});
  inp.addEventListener('focus', () => { if (inp.value.trim()) return; const q = C.filter((c) => c.alerts).sort((a, b) => b.alerts - a.alerts).slice(0, 5);
    sug.innerHTML = '<p class="small">이상 징후가 많은 곳</p>' + q.map((c) => `<button type="button" data-s="${c.slug}"><b>${esc(c.name)}</b><small>이상 징후 ${c.alerts}건</small></button>`).join('');
    sug.hidden = false; sug.querySelectorAll('button').forEach((b) => (b.onclick = () => pickS({c: b.dataset.s}))); });
  inp.addEventListener('blur', () => setTimeout(() => (sug.hidden = true), 200));
  form.querySelector('.dv-all').onclick = () => window.regionPicker && regionPicker(cur, (s) => go({c: s}));

  // 시트 레이어
  let cur = null;
  const setH = (lv) => sheet.dataset.lv = lv;
  const src = '<p class="dv-src"><abbr title="데이터상 이상 징후는 위법을 뜻하지 않으며 정상적인 이유가 있을 수 있습니다. 여러 업체가 함께 맡은 계약은 나눈 비율이 확인된 것만 그 비율대로 나눠 셉니다.">ⓘ</abbr> 출처 조달청 나라장터</p>';
  const share = (title, u) => { u = new URL(u, location.href).href;
    if (navigator.share) return navigator.share({title, url: u}).catch(() => {});
    window.mtCopy ? mtCopy(u) : toast('링크: ' + u); };
  const toast = (m) => { const d = document.createElement('div'); d.className = 'dv-toast'; d.textContent = m; box.append(d); setTimeout(() => d.remove(), 1800); };
  const shb = (t, u) => `<button type="button" class="dv-sh" data-t="${esc(t)}" data-u="${esc(u)}" aria-label="공유">공유</button>`;
  const CARD = (slug) => { const c = BY[slug]; if (!c) return null; const w = (window.__pdCW && window.__pdCW()) || {}; const to = w.to || '', fr = w.from || '';
    const arr = Object.values(BY).filter((x) => x.total != null).sort((a, b) => (b.total || 0) - (a.total || 0)); const rank = arr.findIndex((x) => x.slug === slug) + 1;
    const nEl = body.querySelector('.dv-n'), n = nEl ? +nEl.textContent || 0 : 0; const d = w.d != null ? w.d : 30;
    const base = location.origin + location.pathname.replace(/[^/]*$/, ''); const link = `${base}?c=${slug}&d=${d}${to ? '&to=' + to : ''}`;
    return {name: c.name, total: c.total || 0, fr, to, label: (window.__pdLabel && window.__pdLabel()) || `최근 ${d}일`, when: (window.__pdWhen && window.__pdWhen()) || `최근 ${d}일 동안`, rank, of: arr.length, n, link}; };
  const drawCard = (k) => { const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 675; const g = cv.getContext('2d'), F = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
    const bg = g.createLinearGradient(0, 0, 1200, 675); bg.addColorStop(0, '#0b1118'); bg.addColorStop(1, '#05080c'); g.fillStyle = bg; g.fillRect(0, 0, 1200, 675);
    g.strokeStyle = 'rgba(80,140,200,.08)'; g.lineWidth = 1; for (let x = 0; x <= 1200; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 675); g.stroke(); } for (let y = 0; y <= 675; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); }
    g.fillStyle = '#ffb020'; g.fillRect(64, 64, 8, 52); g.textBaseline = 'alphabetic';
    const T = (t, x, y, sz, col, wt = 700, al = 'left') => { g.font = `${wt} ${sz}px ${F}`; g.fillStyle = col; g.textAlign = al; g.fillText(t, x, y); };
    T('우리 시 돈 추적기', 92, 102, 30, '#8fa0b3', 600); T(k.label, 1136, 102, 30, '#ffb020', 700, 'right');
    T(k.name, 64, 205, 64, '#e8eef5', 800);
    let sz = 132; g.font = `800 ${sz}px ${F}`; while (g.measureText(krw(k.total)).width > 1072 && sz > 80) { sz -= 4; g.font = `800 ${sz}px ${F}`; } T(krw(k.total), 64, 345, sz, '#ffb020', 800);
    const fd = (x) => x ? x.replace(/-/g, '.') : ''; T(`${fd(k.fr)} ~ ${fd(k.to)} 동안 맺은 계약 금액 합계`, 64, 400, 32, '#cfd8e3', 500);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(64, 436, 1072, 2);
    T(`전국 ${k.of}개 시 중 ${k.rank}번째로 많이 씀`, 64, 506, 44, '#e8eef5', 700); T(`데이터상 이상 징후 ${k.n.toLocaleString('ko-KR')}건`, 1136, 506, 44, '#ff9f0a', 700, 'right');
    T('출처: 조달청 나라장터 공공데이터', 64, 600, 26, '#8fa0b3', 500); T(k.link.replace(/^https?:\/\//, '').replace(/\?.*$/, ''), 1136, 600, 26, '#8fa0b3', 600, 'right');
    return cv; };
  window.__mtCard = (slug) => { const k = CARD(slug || cur); return k ? drawCard(k).toDataURL('image/png') : null; };
  const shareCard = async (slug) => { const k = CARD(slug); if (!k) return; const cv = drawCard(k);
    const text = `우리 시는 ${k.when} 계약에 돈을 얼마나 썼을까? ${k.name}는 ${krw(k.total)}, 전국 ${k.of}개 시 중 ${k.rank}번째로 많이 썼어요. 데이터상 이상 징후 ${k.n}건, 우리 시는 어떨까?`;
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png')); const file = blob && new File([blob], `money-tracker-${slug}.png`, {type: 'image/png'});
    if (file && navigator.canShare && navigator.canShare({files: [file]})) { try { await navigator.share({files: [file], text: text + ' ' + k.link, url: k.link}); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    const xu = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(k.link);
    const u = blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png'); const m = document.createElement('div'); m.className = 'dv-shm'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', '공유 이미지');
    m.innerHTML = `<div class="dv-shm-b"><img alt="${esc(k.name)} 공유 이미지" src="${u}"><div class="dv-shm-a"><a class="dv-shm-s" download="money-tracker-${slug}.png" href="${u}">이미지 저장</a><a class="dv-shm-xp" href="${xu}" target="_blank" rel="noopener">X에 올리기</a><button type="button" class="dv-shm-x">닫기</button></div></div>`;
    m.onclick = (e) => { if (e.target === m || e.target.closest('.dv-shm-x')) m.remove(); }; document.body.append(m); };
  body.addEventListener('click', (e) => { const b = e.target.closest('.dv-shc'); if (b && cur) { e.stopPropagation(); shareCard(cur); } });
  box.addEventListener('click', (e) => { const b = e.target.closest('.dv-sh'); if (b) { e.stopPropagation(); share(b.dataset.t, b.dataset.u); } });
  const ex = (on) => { sheet.dataset.ex = on ? '1' : '0'; if (!on) sheet.scrollTop = 0; window.__inv && __inv(); };
  root.querySelector('.dv-grab').onclick = () => ex(sheet.dataset.ex !== '1');
  let CAT = '전체'; const TOT = (slug) => { const c = BY[slug] || {}; return CAT === '전체' ? (c.total || 0) : ((c.by_cat || {})[CAT] || 0); };
  const homeLabels = () => { gL.clearLayers(); HL.clear(); const L_ = cities.map((c) => [c, TOT(c.slug)]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    L_.forEach(([c, v]) => homeLab(c, v)); };
  window.__dvCat = (k) => { CAT = k || '전체'; const mx = Math.max(1, ...cities.map((c) => TOT(c.slug)));
    dots.forEach((m, s) => { const v = TOT(s); m.setRadius(v ? 4 + 13 * Math.sqrt(v / mx) : 3); m.setStyle({fillOpacity: v ? 0.5 : 0.1, opacity: v ? 1 : 0.3}); });
    homeLabels(); if (!cur) L0(true); setTimeout(declutter, 60); };
  if (window.__mtCat && window.__mtCat !== '전체') setTimeout(() => window.__dvCat(window.__mtCat), 0);
  // 분야 TOP 5 시 카드 (공식 데이터: by_cat·n_cat, 행사대행은 시 계약 행에서 계산)
  // 개인 이름처럼 보이는 업체명(법인·상호 표지 없음, 흔한 성씨+1~3자)은 '개인사업자'로
  const pName = (n) => { const t = String(n).replace(/\s*\(.*?\)\s*$/, '').trim();
    return /^[김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용][가-힣]{1,3}$/.test(t) && !/주식회사|\(주\)|㈜|기획|엔터|프로젝트|커뮤니케이션|컴퍼니|미디어|산업|건설|공사|상사|협회|재단|조합|센터|디자인|이벤트|아트|음향|무대|공방|스튜디오|그룹|코리아|플러스|테크|시스템|네트웍스|레저|문화|홀딩스|에이전시/.test(t) ? '개인사업자' : n; };
  const top5 = () => { const L_ = C.map((c) => ({c, v: TOT(c.slug), n: (c.n_cat || {})[CAT] || 0})).filter((x) => x.v).sort((a, b) => b.v - a.v).slice(0, 5);
    if (!L_.length) return ''; const fest = CAT === '축제 공연·섭외';
    const k = CAT; setTimeout(() => L_.forEach(({c}) => get('data/city/' + c.slug + '.json').then((d) => { if (CAT !== k) return;
      const vm = {}; for (const r of d.rows) if (r.cat === k && r.vendor) { const id = r.bh || r.vendor; (vm[id] = vm[id] || {id: r.bh, n: r.vendor, a: 0}).a += r.amount; }
      const tv = Object.values(vm).sort((a, b) => b.a - a.a)[0], ve = body.querySelector(`.t5-v[data-s="${c.slug}"]`);
      if (tv && ve) { ve.textContent = `1위 업체: ${pName(tv.n)} ${krw(tv.a)}`; if (tv.id) { ve.dataset.v = tv.id; ve.classList.add('lnk'); ve.onclick = (e) => { e.stopPropagation(); location.href = 'vendor.html?v=' + tv.id; }; } }
      if (!fest) return;
      const ag = d.rows.filter((r) => r.cat === k && r.ftag === '행사대행').reduce((s, r) => s + r.amount, 0), tot = d.rows.filter((r) => r.cat === k).reduce((s, r) => s + r.amount, 0);
      const e = body.querySelector(`.t5-ag[data-s="${c.slug}"]`); if (e && ag) e.textContent = `행사대행 포함 ${krw(ag)}${tot ? ' (' + Math.round(ag / tot * 100) + '%)' : ''}`; }).catch(() => {})), 0);
    return `<div class="t5"><div class="t5-h"><b>${esc(CAT)} TOP 5 시</b>${shb(CAT + ' 계약 TOP 5 시 · 우리 시 돈 추적기', './?cat=' + encodeURIComponent(CAT))}</div><ol>${L_.map(({c, v, n}, i) =>
      `<li><button type="button" data-s="${c.slug}"><span class="t5-r">${i + 1}</span><span class="t5-m"><b>${esc(c.short || c.name)}</b><small>${n}건 · 건당 평균 ${krw(n ? v / n : v)}</small><small class="t5-v" data-s="${c.slug}"></small>${fest ? `<small class="t5-ag" data-s="${c.slug}"></small>` : ''}</span><em>${krw(v)}</em></button></li>`).join('')}</ol>
      ${fest ? '<p class="small t5-n">공연 용역 금액에는 무대·음향·연출이 포함되며 개인 출연료가 아님 · 행사대행은 축제 전체 운영 계약</p>' : ''}<p class="dv-src">출처 조달청 나라장터</p></div>`; };
  const L0 = (keep) => { cur = null; seq++; gF.clearLayers(); FX.set([]); gL.addTo(map); setTimeout(declutter, 900); setH(0); dim(null);
    if (box.clientWidth && keep !== true) map.flyToBounds(KR, {...krPad(), duration: RM ? 0 : 0.8});
    const tot = C.reduce((s, c) => s + TOT(c.slug), 0);
    body.innerHTML = `<p class="dv-v dv-v0">${krw(tot)} <small>${CAT === '전체' ? '전국 85개 시 · ' + PL() : '전국 · ' + esc(CAT) + ' (지도도 이 분야 기준)'}</small></p>${CAT === '전체' ? '' : top5()}<p class="dv-l">지역을 검색하거나 원을 누르세요 ${shb('우리 시 돈 추적기', './')}</p>`
      + (W.length ? `<p class="dv-k" style="margin-top:12px">이번 주 데이터상 이상 징후</p><div class="dv-car">${W.map((c) => `<button type="button" class="dv-card" data-s="${c.slug}"><b>${esc(c.short || c.name)} · ${esc((window.plainT || String)(c.top_alert.title.replace(/^데이터상 이상 징후:\s*/, '')))}</b><span>${esc((window.plainT || String)(c.top_alert.detail) || '')}</span><em>${krw(c.top_alert.amount)} ›</em></button>`).join('')}</div><p class="dv-cnt"></p>` : '');
    body.querySelectorAll('.t5 [data-s]').forEach((b) => (b.onclick = () => go({c: b.dataset.s}))); const cw = body.querySelector('.dv-car'); if (cw) { car(cw); cw.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => go({c: b.dataset.s}))); } ex(false); };
  const W = (() => { const wk = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10); return C.filter((c) => c.top_alert && (c.top_alert.detail || '').slice(0, 10) >= wk).sort((a, b) => (b.top_alert.amount || 0) - (a.top_alert.amount || 0)).slice(0, 9); })();
  const multi = (slugs) => { setH(1); body.innerHTML = '<p class="dv-k">여러 시가 겹쳐 있어요. 하나를 고르세요</p><div class="pickrow">' + slugs.map((s) => `<button type="button" class="chip" data-s="${s}">${esc((BY[s] || {}).name || s)}</button>`).join('') + '</div>';
    body.querySelectorAll('button[data-s]').forEach((b) => (b.onclick = () => go({c: b.dataset.s}))); };
  const sib = (slug, d) => { const me = BY[slug]; let g = C.filter((c) => c.province === me.province); if (g.length < 2) g = C; const i = g.findIndex((c) => c.slug === slug); return g[(i + d + g.length) % g.length].slug; };
  const top3 = (f) => { if (!f) return ''; const m = {}; for (const x of f.flows || []) for (const v of x.vendors || []) { const o = m[v.id] || (m[v.id] = {id: v.id, name: v.name, amount: 0, n: 0, to: x.local ? '지역 업체' : (x.to || '')}); o.amount += v.amount; o.n += v.count || 1; }
    const t = Object.values(m).sort((a, b) => b.amount - a.amount).slice(0, 3);
    return t.length ? `<p class="dv-k">많이 받은 업체 3곳</p><ol class="dv-top dv-top3">${t.map((v, i) => `<li><span class="dv-no">${i + 1}</span><a href="?c=${cur}&v=${v.id}#map" data-v="${v.id}"><span class="dv-tn">${esc(v.name)}</span><b>${krw(v.amount)}</b><span class="rc-chips"><i>${esc(v.to)}</i><i>${v.n}건</i></span></a></li>`).join('')}</ol>` : ''; };
  const PL = () => (window.__pdLabel && window.__pdLabel()) || `최근 ${idx.days || 90}일`;
  const PV = {'경상남도': '경남', '경상북도': '경북', '전라남도': '전남', '전라북도': '전북', '전북특별자치도': '전북', '충청남도': '충남', '충청북도': '충북', '강원도': '강원', '강원특별자치도': '강원', '제주특별자치도': '제주', '경기도': '경기', '세종특별자치시': '세종'};
  const nmR = (s) => { const a = String(s || '').trim().split(/\s+/); if (!a[0]) return ''; a[0] = PV[a[0]] || a[0].replace(/(특별시|광역시)$/, ''); return a.join(' '); };
  // 기간을 고르면 시 계약 원장(data/city/*.json rows)에서 흐름·외지·업체를 다시 계산
  const reFlow = (slug, rows) => { const c = BY[slug], o = fl.cities[slug] || {}; const P = {}; for (const k in fl.cities) for (const x of fl.cities[k].flows || []) if (x.p) P[x.to] = x.p;
    const ct = String(c && c.name || o.name || '').trim().split(/\s+/).pop(); const m = {}; let known = 0, local = 0, total = 0, count = 0;
    for (const r of rows || []) { const a = +r.amount || 0; total += a; count++; const to = nmR(r.vregion); if (!to) continue; known += a; const t2 = to.split(' ')[1] || ''; const lo = !!ct && (t2 === ct || t2.startsWith(ct)); if (lo) local += a;
      const g = m[to] || (m[to] = {to, p: P[to] || P[to.split(' ').slice(0, 2).join(' ')] || null, amount: 0, count: 0, local: lo, _v: {}}); g.amount += a; g.count++;
      const vid = r.bh || r.vendor; const v = g._v[vid] || (g._v[vid] = {id: r.bh || '', name: r.vendor || '', amount: 0, count: 0}); v.amount += a; v.count++; }
    const flows = Object.values(m).map((g) => { g.vendors = Object.values(g._v).sort((a, b) => b.amount - a.amount); delete g._v; return g; }).sort((a, b) => b.amount - a.amount);
    return Object.assign({}, o, {flows, known, local, total, count, by_cat: {}, __re: 1}); };
  const KN = {split: '같은 날 나눠진 계약', threshold: '기준 금액 바로 아래 계약', increase: '계약 금액이 늘어난 경우', repeat: '같은 업체와 여러 번 계약'};
  const wrapFill = (slug, A) => { const el = body.querySelector('.dv-wrap'); if (!el) return; const k = CARD(slug); if (!k) return; const c = BY[slug], f = fl.cities[slug];
    const outEl = body.querySelector('.dv-out'), out = outEl ? outEl.textContent.replace(/[^0-9]/g, '') : '';
    const fd = (x) => (x ? x.replace(/-/g, '.') : ''), rng = `${fd(k.fr)} ~ ${fd(k.to)}`, SR = '출처: 조달청 나라장터 공공데이터';
    const cats = Object.entries(c.by_cat || {}).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]); const top = cats[0];
    const kc = {}; for (const a of A) kc[a.kind] = (kc[a.kind] || 0) + 1; const tk = Object.entries(kc).sort((a, b) => b[1] - a[1])[0];
    const card = (t, big, sub, src) => `<div class="wr-c"><p class="wr-t">${t}</p><p class="wr-b">${big}</p><p class="wr-s">${sub}</p><p class="wr-src">${src}</p></div>`;
    const cs = [
      card(`${esc(k.name)}는 ${esc(k.when)}`, krw(k.total), `계약으로 쓴 돈이에요. (${rng}에 맺은 계약)`, SR),
      card('전국 85개 시 중에서', `${k.rank}번째`, `${k.when} 계약에 쓴 돈이 ${k.of}개 시 중 ${k.rank}번째로 많아요.`, SR),
      card('다른 지역 업체가 받은 돈', out ? out + '%' : '확인 중', out ? `주소가 확인된 계약 금액 중 ${out}%가 다른 지역 업체에 갔어요.` : '업체 주소를 아직 확인하고 있어요.', SR + ' · 업체 주소 기준'),
      card('가장 많이 쓴 계약 종류', top ? esc(top[0]) : '자료 없음', top ? `${krw(top[1])}, 전체의 ${Math.round(top[1] / (k.total || 1) * 100)}%예요.` : '', SR + ' · 제목으로 나눈 종류'),
      card('데이터상 이상 징후', `${k.n.toLocaleString('ko-KR')}건`, k.n ? `가장 많은 유형: ${esc(KN[tk[0]] || tk[0])} ${tk[1]}건. 위법을 뜻하지 않고, 정상적인 이유가 있을 수 있어요.` : '이 기간에는 자동으로 찾은 패턴이 없어요.', SR + ' · 자동 패턴 검사'),
      `<div class="wr-c wr-share"><p class="wr-t">친구에게 보여 주기</p><img alt="${esc(k.name)} 공유 이미지" src="${drawCard(k).toDataURL('image/png')}"><button type="button" class="wr-btn dv-shc">이 카드 공유</button><p class="wr-src">${SR}</p></div>`];
    el.innerHTML = `<p class="dv-k">우리 시 한눈에 보기 <span class="wr-n">1 / ${cs.length}</span></p><div class="wr-row">${cs.join('')}</div>`;
    const row = el.querySelector('.wr-row'), n = el.querySelector('.wr-n'); row.onscroll = () => { const w = row.firstElementChild.offsetWidth + 10; n.textContent = `${Math.min(cs.length, Math.round(row.scrollLeft / w) + 1)} / ${cs.length}`; };
    window.__wrLast = {slug, total: krw(k.total), rank: k.rank, out, n: k.n, top: top && top[0]}; };
  const L1 = async (slug, gu) => {
    const c = BY[slug], f = fl.cities[slug]; if (!c) return L0();
    if (cur !== slug) { cur = slug; fly(slug); window.regionRemember && regionRemember(slug); }
    cur = slug; setH(1); dim(slug);
    const out = f && f.known ? Math.round((1 - f.local / f.known) * 100) : null;
    body.innerHTML = `<div class="dv-head"><button type="button" class="dv-nav" data-d="-1" aria-label="이전 지역">‹</button><div><p class="dv-name">${esc(c.name)}${gu ? ' ' + esc(gu) : ''}</p><p class="dv-v">${krw(c.total)}</p></div><button type="button" class="dv-nav" data-d="1" aria-label="다음 지역">›</button></div>
      <p class="dv-l dv-l1"><span class="dv-meta">${PL()} · ${c.total ? (out != null ? `<b class="dv-out">다른 지역 업체 ${out}%</b>` : '다른 지역 업체 비율 확인 중') : '아직 수집된 계약 없음'}</span> <button type="button" class="dv-sh dv-shc" aria-label="이 지역 결과 공유">공유</button> <button type="button" class="dv-chip" hidden>이상 징후 <b class="dv-n">0</b>건</button></p>
      <div class="dv-more"><div class="dv-wrap" aria-label="우리 시 한눈에 보기"></div><div class="dv-t3">${top3(f)}</div><p class="dv-k">데이터상 이상 징후</p><div class="dv-cards dv-car"><div class="skel-box">찾는 중…</div><div class="skel-box"></div></div><p class="dv-cnt"></p>
      <a class="gobtn" href="city.html?c=${slug}${gu ? '&gu=' + encodeURIComponent(gu) : ''}">이 시 전체 보기</a>${src}</div>`;
    ex(false); body.querySelector('.dv-chip').onclick = () => ex(true);
    body.querySelectorAll('.dv-nav').forEach((b) => (b.onclick = () => go({c: sib(slug, +b.dataset.d)}, true)));
    const box2 = body.querySelector('.dv-cards');
    try { const d = await get('data/city/' + slug + '.json'); if (cur !== slug) return;
      if (window.__pdCW && window.__pdCW() && d.rows) { const f2 = reFlow(slug, d.rows); fl.cities[slug] = f2; const o2 = f2.known ? Math.round((1 - f2.local / f2.known) * 100) : null; const mt = body.querySelector('.dv-meta'); if (mt) mt.innerHTML = `${PL()} · ${c.total ? (o2 != null ? `<b class="dv-out">다른 지역 업체 ${o2}%</b>` : '다른 지역 업체 비율 확인 중') : '아직 수집된 계약 없음'}`; const t3 = body.querySelector('.dv-t3'); if (t3) t3.innerHTML = top3(f2); drawFlows(slug); }
      const A = (d.alerts || []).filter((a) => a.kind !== 'big' && (!gu || (a.detail || '').includes(gu)));
      body.querySelector('.dv-n').textContent = A.length; wrapFill(slug, A); A.splice(8); body.querySelector('.dv-chip').hidden = !A.length;
      box2.innerHTML = A.length ? A.map((a, i) => `<button type="button" class="dv-card" data-i="${i}"><b>${esc((window.plainT || String)(a.title))}</b><span>${esc((window.plainT || String)((window.maskT || ((x) => x))(a.detail)))}</span><em>${krw(a.amount)} ›</em></button>`).join('') : '<p class="small">최근 눈에 띄는 패턴이 없습니다.</p>';
      car(box2);
      box2.querySelectorAll('.dv-card').forEach((b) => (b.onclick = () => { const a = A[+b.dataset.i]; const r = d.rows.find((x) => (a.ids || []).includes(x.id)); if (r && r.bh) go({c: slug, v: r.bh, a: a.key}); else if (r) window.open(r.url, '_blank', 'noopener'); }));
    } catch (e) { box2.innerHTML = '<p class="small">불러오지 못했어요.</p>'; }
  };
  function car(el) { const n = el.children.length, c = el.nextElementSibling; if (!c || !c.classList.contains('dv-cnt')) return;
    const up = () => { const w = el.firstElementChild ? el.firstElementChild.offsetWidth + 10 : 1; c.textContent = n > 1 ? String(Math.min(n, Math.round(el.scrollLeft / w) + 1)).padStart(2, '0') + ' / ' + String(n).padStart(2, '0') : ''; };
    el.addEventListener('scroll', up, {passive: true}); up(); }
  const L2 = async (slug, vid, akey) => {
    if (cur !== slug) await L1(slug); setH(2);
    body.innerHTML = '<p class="small skel">업체 정보를 불러오는 중…</p>';
    try { const [v, d] = await Promise.all([get('data/vendor/' + vid + '.json'), get('data/city/' + slug + '.json')]);
      const a = (d.alerts || []).find((x) => x.key === akey);
      const rows = (v.rows || []).slice(0, 8);
      body.innerHTML = `<div class="dv-vh"><button type="button" class="dv-back" aria-label="${esc(BY[slug].name)}로 돌아가기">‹</button><p class="dv-name">${esc(v.name)}</p>${shb(v.name + ' 계약', 'vendor.html?v=' + vid)}</div><p class="dv-v" style="text-align:center">${krw(v.total)}</p>
        <p class="dv-l">${esc((v.region || '소재지 확인 중').split(' ').slice(-1)[0])} · <button type="button" class="dv-chip">계약 ${v.count}건</button></p>
        <div class="dv-more">${a ? `<div class="dv-card on"><b>${esc((window.plainT || String)(a.title))}</b><span>${esc((window.plainT || String)((window.maskT || ((x) => x))(a.detail)))}</span></div>` : ''}
        <div class="dv-rows">${rows.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener"><span>${esc(r.date)} · ${esc((window.maskT || ((x) => x))(r.title))}${r.jshare ? ` <i class="jvb">함께 맡음 ${r.jshare}%</i>` : ''}</span><b>${krw(r.amount)} 원문 ›</b></a>`).join('')}</div>
        <a class="gobtn" href="vendor.html?v=${vid}">업체 전체 보기</a>${src}</div>`;
      ex(false); body.querySelector('.dv-chip').onclick = () => ex(true);
      body.querySelector('.dv-back').onclick = () => history.back();
    } catch (e) { cur = null; await L1(slug); const n0 = document.createElement('p'); n0.className = 'sub small'; n0.textContent = '업체 정보를 불러오지 못해 지역 정보를 보여 드려요.'; body.prepend(n0); return; body.querySelector('.dv-back').onclick = () => history.back(); }
  };
  const render = () => { const q = new URLSearchParams(location.search); const c = q.get('c'), v = q.get('v');
    if (c && BY[c] && v && /^[0-9a-z]+$/.test(v) && !/^\d{8,}$/.test(v)) L2(c, v, q.get('a')); else if (c && BY[c]) L1(c, q.get('gu')); else L0(); };
  const go = (st, replace) => { const pk0 = root.querySelector('.dv-pick'); if (pk0 && !st._pick) pk0.remove(); const q = new URLSearchParams(); if (st.c) q.set('c', st.c); if (st.gu) q.set('gu', st.gu); if (st.v) q.set('v', st.v); if (st.a) q.set('a', st.a);
    { const q0 = new URLSearchParams(location.search); for (const k of ['d', 'from', 'to']) if (q0.has(k)) q.set(k, q0.get(k)); }  // 기간 유지
    const u = location.pathname + (q.toString() ? '?' + q : '') + '#map'; history[replace ? 'replaceState' : 'pushState']({dv: 1}, '', u); render();
    sheet.scrollTop = 0; body.classList.remove('dv-in'); void body.offsetWidth; body.classList.add('dv-in'); };
  addEventListener('popstate', render); window.__dvGo = go;
  // 기간 슬라이더: 새로고침 없이 그 자리에서 숫자·원·이름표·지역 카드를 바꾼다 (period.js가 호출)
  window.__dvPeriod = async () => { for (const k in J) delete J[k];
    const [f2, i2] = await Promise.all([get('data/flows.json'), get('data/index.json')]);
    fl.cities = f2.cities; for (const k in i2) if (k !== 'cities') idx[k] = i2[k];
    for (const c of i2.cities) if (BY[c.slug]) { const o = BY[c.slug]; for (const k of Object.keys(o)) if (!(k in c)) delete o[k]; Object.assign(o, c); }
    for (const c of cities) { const n = f2.cities[c.slug]; if (n) c.total = n.total; }
    cities.sort((a, b) => b.total - a.total);
    window.__mtPeriod && window.__mtPeriod(i2); window.__gmPeriod && window.__gmPeriod();
    const st = sheet.scrollTop; window.__dvCat(CAT); if (cur) { render(); sheet.scrollTop = st; } };
  // 시트: 아래로 끌면 한 층 위로, 좌우로 밀면 지역 이동
  let sy = null, sx = 0;
  sheet.addEventListener('touchstart', (e) => { if (sheet.scrollTop > 0) { sy = null; return; } sy = e.touches[0].clientY; sx = e.touches[0].clientX; }, {passive: true});
  sheet.addEventListener('touchend', (e) => { if (sy == null) return; const t = e.changedTouches[0], dy = t.clientY - sy, dx = t.clientX - sx; sy = null;
    if (dy < -40 && Math.abs(dy) > Math.abs(dx)) ex(true);
    else if (dy > 60 && Math.abs(dy) > Math.abs(dx) && sheet.dataset.ex === '1') ex(false);
    else if (dy > 70 && Math.abs(dy) > Math.abs(dx) && sheet.dataset.lv !== '0') history.state && history.state.dv ? history.back() : go({}, true);
    else if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5 && cur && sheet.dataset.lv === '1') go({c: sib(cur, dx < 0 ? 1 : -1)}, true); }, {passive: true});
  render();
  // 첫 방문(주소에 지역 없음): 이번 주 가장 눈에 띄는 데이터상 이상 징후 1건으로 날아간다
  try {
    const wk = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), RK = {split: 3, increase: 3, repeat: 2, big: 1, threshold: 0};
    const pk = !RM && !location.search && !sessionStorage.getItem('dvPick') && C.filter((c) => c.top_alert && (c.top_alert.detail || '').slice(0, 10) >= wk)
      .sort((a, b) => (RK[b.top_alert.kind] || 0) - (RK[a.top_alert.kind] || 0) || (b.top_alert.amount || 0) - (a.top_alert.amount || 0))[0];
    if (pk) { sessionStorage.setItem('dvPick', '1'); const A = pk.top_alert;
      setTimeout(() => {
        const d = document.createElement('div'); d.className = 'dv-pick';
        d.innerHTML = `<button type="button" class="dv-pk-line"><span>이번 주 데이터상 이상 징후</span> <b>${esc(pk.short || pk.name)} ${krw(A.amount)}</b> ›</button>
          <div class="dv-pk-x"><p class="dv-pk-r">${esc((window.plainT || String)(A.title))}</p><div class="dv-pk-b"><a href="https://www.g2b.go.kr" target="_blank" rel="noopener">나라장터 원문</a><button type="button" data-sh>공유</button><button type="button" data-x>닫기</button></div>
          <p class="dv-pk-s">출처: 조달청 나라장터(공공데이터포털) · 위법을 뜻하지 않아요</p></div>`;
        d.querySelector('.dv-pk-line').onclick = () => { if (d.classList.toggle('open')) go({c: pk.slug, _pick: 1}); };
        sheet.append(d);
        d.querySelector('[data-x]').onclick = () => { d.remove(); if (cur) go({}, true); };
        d.querySelector('[data-sh]').onclick = () => { const u = location.href.replace(/[^/]*([?#].*)?$/, '') + 'c/' + pk.slug + '.html#' + A.key;
          navigator.share ? navigator.share({title: '데이터상 이상 징후 · ' + pk.name, url: u}).catch(() => {}) : window.mtCopy && mtCopy(u); };
        addEventListener('popstate', () => d.remove(), {once: true});
        const rm = () => { const c = new URLSearchParams(location.search).get('c'); if (c && c !== pk.slug) d.remove(); };
        addEventListener('click', () => setTimeout(rm, 50)); }, 600); }
  } catch (e) {}
})();
