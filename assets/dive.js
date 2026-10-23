// 홈 '세금 길' 다이브: 지도 → 지역 검색 시 비행 → 돈 흐름 선 → 바텀시트(총액 → 데이터상 이상 징후 → 업체)
(async () => {
  const root = document.getElementById('dive'); if (!root || !window.L) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GK = Math.cos(36 * Math.PI / 180), GSX = 600 / (6.5 * GK);
  const toLL = (p) => [38.7 - p[1] / GSX, 124.5 + p[0] / (GK * GSX)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const krw = (n) => { if (n == null || isNaN(n)) return '—'; const a = Math.abs(n);
    if (a >= 1e12) return (a / 1e12).toFixed(1).replace(/\.0$/, '') + '조원';
    if (a >= 1e8) return (a / 1e8 >= 100 ? Math.round(a / 1e8).toLocaleString('ko-KR') : (a / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원';
    if (a >= 1e4) return Math.round(a / 1e4).toLocaleString('ko-KR') + '만원'; return a.toLocaleString('ko-KR') + '원'; };
  const J = {}; const get = (u) => (J[u] ||= fetch(u).then((r) => { if (!r.ok) throw r.status; return r.json(); }));
  root.innerHTML = `<div class="dv-map map loading"></div>
    <form class="dv-q" role="search" autocomplete="off"><span aria-hidden="true">⌕</span><input type="search" placeholder="지역 검색 (예: 대구 수성구)" aria-label="지역 검색" enterkeyhint="search"><button type="button" class="dv-all" aria-label="전체 지역 목록">목록</button></form>
    <div class="dv-sheet" role="region" aria-label="지역 정보"><div class="dv-grab" aria-hidden="true"></div><div class="dv-body"></div></div>`;
  const box = root.querySelector('.dv-map'), sheet = root.querySelector('.dv-sheet'), body = root.querySelector('.dv-body'), form = root.querySelector('.dv-q'), inp = form.querySelector('input');
  const touch = matchMedia('(pointer: coarse)').matches;
  const map = L.map(box, {zoomControl: false, attributionControl: false, dragging: !touch, tap: false, minZoom: 5, maxZoom: 12, zoomSnap: 0.25});
  L.control.attribution({position: 'topright', prefix: false}).addTo(map); if (!touch) L.control.zoom({position: 'bottomleft'}).addTo(map);
  const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {maxZoom: 12, attribution: '지도: Esri, HERE, Garmin, &copy; OpenStreetMap 기여자'}).addTo(map);
  tiles.once('tileload', () => box.classList.remove('loading'));
  const KR = L.latLngBounds([[33.1, 125.0], [38.65, 129.6]]); const krPad = () => (innerWidth >= 900 ? {paddingTopLeft: [10, 60], paddingBottomRight: [400, 10]} : {paddingTopLeft: [10, 64], paddingBottomRight: [10, Math.round(root.clientHeight * 0.38) + 6]}); map.fitBounds(KR, {...krPad(), animate: false});
  window.__dvMap = map;
  let fl, idx; try { [fl, idx] = await Promise.all([get('data/flows.json'), get('data/index.json')]); } catch (e) { body.innerHTML = '<p class="sub">지도 자료를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>'; return; }
  const C = idx.cities, BY = Object.fromEntries(C.map((c) => [c.slug, c]));
  const cities = Object.entries(fl.cities).map(([slug, c]) => ({slug, ...c})).filter((c) => c.p).sort((a, b) => b.total - a.total);
  const maxT = cities[0].total || 1, dots = new Map();
  const gC = L.layerGroup().addTo(map), gF = L.layerGroup().addTo(map);
  for (const c of cities) {
    const m = L.circleMarker(toLL(c.p), {radius: c.total ? 4 + 13 * Math.sqrt(c.total / maxT) : 4, weight: 1.5, color: c.total ? '#fff' : '#8b97a5', fillColor: c.total ? '#0a84ff' : '#3a4450', fillOpacity: c.total ? 0.5 : 0.3, interactive: false}).addTo(gC);
    dots.set(c.slug, m); const e = m.getElement(); if (e) e.setAttribute('data-s', c.slug);
  }
  map.on('click', (e) => { const hits = [];
    dots.forEach((m, s) => { const d = e.containerPoint.distanceTo(map.latLngToContainerPoint(m.getLatLng())); const r = m.getRadius(); if (d <= Math.max(r, 10) + 8) hits.push([d - r, s]); });
    if (!hits.length) return; hits.sort((a, b) => a[0] - b[0]);
    const inside = hits.filter((h) => h[0] <= 4);
    if (inside.length > 1) multi(inside.map((h) => h[1])); else go({c: hits[0][1]}); });
  if (touch) { const h = document.createElement('p'); h.className = 'mhint'; h.textContent = '두 손가락으로 지도 이동·확대'; box.append(h); setTimeout(() => h.remove(), 4000); }

  const declutter = () => { const seen = []; box.querySelectorAll('.dv-amt').forEach((t) => { t.style.visibility = ''; const r = t.getBoundingClientRect(); if (seen.some((q) => !(r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom))) t.style.visibility = 'hidden'; else seen.push(r); }); };
  map.on('zoomend moveend', () => setTimeout(declutter, 30));
  const dim = (slug) => dots.forEach((m, s) => m.setStyle({opacity: !slug || s === slug ? 1 : 0.3, fillOpacity: !slug || s === slug ? 0.5 : 0.12}));
  // 세금 길: 도시 → 업체 소재지 선 그리기
  const drawFlows = (slug) => {
    gF.clearLayers(); const c = fl.cities[slug]; if (!c || !c.flows.length) return;
    const a = c.p, top = c.flows.filter((f) => f.p).slice(0, 10), mx = top[0] ? top[0].amount : 1;
    top.forEach((f, i) => {
      const b = f.p, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = Math.min(d * 0.28, 60);
      const mxp = (a[0] + b[0]) / 2 - (dy / d) * o, myp = (a[1] + b[1]) / 2 + (dx / d) * o, pts = [];
      for (let t = 0; t <= 1.0001; t += 1 / 24) pts.push(toLL([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mxp + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * myp + t * t * b[1]]));
      const w = 1.5 + 7 * Math.sqrt(f.amount / mx), col = f.local ? '#0a84ff' : '#ff9f0a';
      const ln = L.polyline(pts, {color: col, weight: w, opacity: 0.85, interactive: false, className: 'dv-line'}).addTo(gF);
      const p = ln.getElement();
      if (p && !RM) { const len = p.getTotalLength ? p.getTotalLength() : 1000; p.style.strokeDasharray = len; p.style.strokeDashoffset = len; p.style.transition = `stroke-dashoffset .9s ease-out ${i * 0.12}s`; requestAnimationFrame(() => requestAnimationFrame(() => (p.style.strokeDashoffset = 0))); }
      L.circleMarker(toLL(b), {radius: 3, color: col, weight: 1, fillOpacity: 1, interactive: false}).addTo(gF);
      if (i < 6) L.tooltip({permanent: true, direction: 'right', className: 'klab dv-amt', offset: [4, 0], interactive: false}).setLatLng(toLL(b)).setContent(esc((f.local ? '' : f.to.split(' ').slice(-1)[0] + ' ') + krw(f.amount))).addTo(gF);
    });
    setTimeout(declutter, 50);
  };
  const fly = (slug) => { const c = fl.cities[slug]; if (!c) return; const ll = toLL(c.p);
    const pts = [ll, ...c.flows.filter((f) => f.p).slice(0, 10).map((f) => toLL(f.p))], bd = L.latLngBounds(pts);
    const wide = innerWidth >= 900, sh = wide ? 0 : Math.round(root.clientHeight * 0.52);
    const o = {paddingTopLeft: [24, 76], paddingBottomRight: [wide ? 420 : 24, sh + 16], maxZoom: 9.5};
    const near = L.latLngBounds([[ll[0] - 0.12, ll[1] - 0.12], [ll[0] + 0.12, ll[1] + 0.12]]), oz = {...o, maxZoom: 9.5};
    if (RM || !box.clientWidth) { map.fitBounds(bd, {...o, animate: false}); drawFlows(slug); return; }
    map.flyToBounds(near, {...oz, duration: 1});
    map.once('moveend', () => { if (cur !== slug) return; drawFlows(slug);
      setTimeout(() => { if (cur === slug && !map.getBounds().contains(bd)) map.flyToBounds(bd, {...o, duration: 1.1}); }, 1300); }); };

  // 검색: 시 이름·주소(시+구)
  const norm = (s) => s.replace(/\s/g, '').replace(/(특별시|광역시|특별자치시|특별자치도)/g, '');
  const find = (q) => { const t = norm(q); if (!t) return null; const toks = q.trim().split(/\s+/);
    let best = C.find((c) => norm(c.name) === t || norm(c.short) === t) || C.find((c) => t.startsWith(norm(c.name).replace(/시$/, ''))) || C.find((c) => norm(c.short).includes(t) || norm(c.name).includes(t));
    if (!best && toks.length > 1) best = C.find((c) => norm(c.name).replace(/시$/, '') === norm(toks[0]).replace(/시$/, ''));
    return best ? {c: best.slug, gu: toks.length > 1 && /구$/.test(toks[toks.length - 1]) ? toks[toks.length - 1] : null} : null; };
  form.addEventListener('submit', (e) => { e.preventDefault(); const r = find(inp.value); if (!r) { inp.setCustomValidity('찾는 지역이 없어요. 85개 시만 추적해요'); inp.reportValidity(); return; } inp.setCustomValidity(''); inp.blur(); go(r); });
  inp.addEventListener('input', () => inp.setCustomValidity(''));
  form.querySelector('.dv-all').onclick = () => window.regionPicker && regionPicker(cur, (s) => go({c: s}));

  // 시트 레이어
  let cur = null;
  const setH = (lv) => sheet.dataset.lv = lv;
  const src = '<p class="small dv-src">출처: 조달청 나라장터 공개 계약정보 · 위법을 뜻하지 않으며 정상적인 이유가 있을 수 있습니다</p>';
  const L0 = () => { cur = null; gF.clearLayers(); setH(0); dim(null);
    if (box.clientWidth) map.flyToBounds(KR, {...krPad(), duration: RM ? 0 : 0.8});
    const tot = C.reduce((s, c) => s + (c.total || 0), 0);
    body.innerHTML = `<p class="dv-k">전국 85개 시 · 최근 계약으로 쓴 돈</p><p class="dv-v">${krw(tot)}</p><p class="sub">지역을 검색하거나 지도의 원을 누르면 그 시의 돈이 어디로 갔는지 따라갑니다.</p>`; };
  const multi = (slugs) => { setH(1); body.innerHTML = '<p class="dv-k">여러 시가 겹쳐 있어요. 하나를 고르세요</p><div class="pickrow">' + slugs.map((s) => `<button type="button" class="chip" data-s="${s}">${esc((BY[s] || {}).name || s)}</button>`).join('') + '</div>';
    body.querySelectorAll('button[data-s]').forEach((b) => (b.onclick = () => go({c: b.dataset.s}))); };
  const sib = (slug, d) => { const me = BY[slug]; let g = C.filter((c) => c.province === me.province); if (g.length < 2) g = C; const i = g.findIndex((c) => c.slug === slug); return g[(i + d + g.length) % g.length].slug; };
  const L1 = async (slug, gu) => {
    const c = BY[slug], f = fl.cities[slug]; if (!c) return L0();
    if (cur !== slug) { fly(slug); window.regionRemember && regionRemember(slug); }
    cur = slug; setH(1); dim(slug);
    const out = f && f.known ? Math.round((1 - f.local / f.known) * 100) : null;
    body.innerHTML = `<div class="dv-head"><button type="button" class="dv-nav" data-d="-1" aria-label="이전 지역">‹</button><div><p class="dv-k">${esc(c.name)}${gu ? ' · ' + esc(gu) : ''} · 최근 ${idx.days || 30}일</p><p class="dv-v">${krw(c.total)}</p></div><button type="button" class="dv-nav" data-d="1" aria-label="다음 지역">›</button></div>
      ${c.total ? `<p class="sub">${c.count.toLocaleString('ko-KR')}건${out != null ? ` · <b style="color:#ff9f0a">다른 지역 업체 ${out}%</b>` : ''} · 선이 굵을수록 큰 돈</p>` : '<p class="sub">아직 수집된 계약이 없습니다. 공식 자료가 올라오면 자동으로 반영됩니다.</p>'}
      <p class="dv-k" style="margin-top:14px">데이터상 이상 징후 <span class="dv-n"></span></p><div class="dv-cards"><p class="small skel">불러오는 중…</p></div>
      <a class="gobtn" href="city.html?c=${slug}${gu ? '&gu=' + encodeURIComponent(gu) : ''}">이 시 전체 보기</a>${src}`;
    body.querySelectorAll('.dv-nav').forEach((b) => (b.onclick = () => go({c: sib(slug, +b.dataset.d)}, true)));
    const box2 = body.querySelector('.dv-cards');
    try { const d = await get('data/city/' + slug + '.json'); if (cur !== slug) return;
      const A = (d.alerts || []).filter((a) => a.kind !== 'big' && (!gu || (a.detail || '').includes(gu))).slice(0, 8);
      body.querySelector('.dv-n').textContent = A.length ? A.length + '건' : '';
      box2.innerHTML = A.length ? A.map((a, i) => `<button type="button" class="dv-card" data-i="${i}"><b>${esc(a.title)}</b><span>${esc((window.maskT || ((x) => x))(a.detail))}</span><em>${krw(a.amount)} ›</em></button>`).join('') : '<p class="small">최근 눈에 띄는 패턴이 없습니다.</p>';
      box2.querySelectorAll('.dv-card').forEach((b) => (b.onclick = () => { const a = A[+b.dataset.i]; const r = d.rows.find((x) => (a.ids || []).includes(x.id)); if (r && r.bh) go({c: slug, v: r.bh, a: a.key}); else if (r) window.open(r.url, '_blank', 'noopener'); }));
    } catch (e) { box2.innerHTML = '<p class="small">불러오지 못했어요.</p>'; }
  };
  const L2 = async (slug, vid, akey) => {
    if (cur !== slug) await L1(slug); setH(2);
    body.innerHTML = '<p class="small skel">업체 정보를 불러오는 중…</p>';
    try { const [v, d] = await Promise.all([get('data/vendor/' + vid + '.json'), get('data/city/' + slug + '.json')]);
      const a = (d.alerts || []).find((x) => x.key === akey);
      const rows = (v.rows || []).slice(0, 8);
      body.innerHTML = `<button type="button" class="dv-back">‹ ${esc(BY[slug].name)}</button>
        ${a ? `<div class="dv-card on"><b>${esc(a.title)}</b><span>${esc((window.maskT || ((x) => x))(a.detail))}</span></div>` : ''}
        <p class="dv-k">${esc(v.name)} · ${esc(v.region || '주소 확인 중')}</p><p class="dv-v">${krw(v.total)}</p><p class="sub">${v.count}건 · ${(v.cities || []).length}개 시와 계약</p>
        <div class="dv-rows">${rows.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener"><span>${esc(r.date)} · ${esc((window.maskT || ((x) => x))(r.title))}</span><b>${krw(r.amount)} 원문 ›</b></a>`).join('')}</div>
        <a class="gobtn" href="vendor.html?v=${vid}">업체 전체 보기</a>${src}`;
      body.querySelector('.dv-back').onclick = () => history.back();
    } catch (e) { body.innerHTML = '<button type="button" class="dv-back">‹ 뒤로</button><p class="sub">업체 정보를 불러오지 못했어요.</p>'; body.querySelector('.dv-back').onclick = () => history.back(); }
  };
  const render = () => { const q = new URLSearchParams(location.search); const c = q.get('c'), v = q.get('v');
    if (c && BY[c] && v && /^[0-9a-z]+$/.test(v)) L2(c, v, q.get('a')); else if (c && BY[c]) L1(c, q.get('gu')); else L0(); };
  const go = (st, replace) => { const q = new URLSearchParams(); if (st.c) q.set('c', st.c); if (st.gu) q.set('gu', st.gu); if (st.v) q.set('v', st.v); if (st.a) q.set('a', st.a);
    const u = location.pathname + (q.toString() ? '?' + q : '') + '#map'; history[replace ? 'replaceState' : 'pushState']({dv: 1}, '', u); render();
    sheet.scrollTop = 0; body.classList.remove('dv-in'); void body.offsetWidth; body.classList.add('dv-in'); };
  addEventListener('popstate', render);
  // 시트: 아래로 끌면 한 층 위로, 좌우로 밀면 지역 이동
  let sy = null, sx = 0;
  sheet.addEventListener('touchstart', (e) => { if (sheet.scrollTop > 0) { sy = null; return; } sy = e.touches[0].clientY; sx = e.touches[0].clientX; }, {passive: true});
  sheet.addEventListener('touchend', (e) => { if (sy == null) return; const t = e.changedTouches[0], dy = t.clientY - sy, dx = t.clientX - sx; sy = null;
    if (dy > 70 && Math.abs(dy) > Math.abs(dx) && sheet.dataset.lv !== '0') history.state && history.state.dv ? history.back() : go({}, true);
    else if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5 && cur && sheet.dataset.lv === '1') go({c: sib(cur, dx < 0 ? 1 : -1)}, true); }, {passive: true});
  render();
})();
