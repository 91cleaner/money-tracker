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
  root.innerHTML = `<div class="dv-map map loading"></div><h1 class="dv-h1">우리 시는 얼마 썼을까?</h1>
    <form class="dv-q" role="search" autocomplete="off"><span aria-hidden="true">⌕</span><input type="search" placeholder="지역·업체 검색 (예: 수성구)" aria-label="지역 검색" enterkeyhint="search"><button type="button" class="dv-all" aria-label="전체 지역 목록">목록</button></form>
    <div class="dv-sheet" role="region" aria-label="지역 정보"><div class="dv-grab" aria-hidden="true"></div><div class="dv-body"></div></div>`;
  const box = root.querySelector('.dv-map'), sheet = root.querySelector('.dv-sheet'), body = root.querySelector('.dv-body'), form = root.querySelector('.dv-q'), inp = form.querySelector('input');
  const touch = matchMedia('(pointer: coarse)').matches;
  const map = L.map(box, {zoomControl: false, attributionControl: false, dragging: true, tap: false, minZoom: 5, maxZoom: 12, zoomSnap: 0.25});
  L.control.attribution({position: 'bottomright', prefix: false}).addTo(map); if (!touch && innerWidth >= 900) L.control.zoom({position: 'bottomleft'}).addTo(map);
  const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {maxZoom: 12, attribution: '지도: Esri, HERE, Garmin, &copy; OpenStreetMap 기여자'}).addTo(map);
  tiles.once('tileload', () => box.classList.remove('loading'));
  const KR = L.latLngBounds([[33.1, 125.0], [38.65, 129.6]]); const krPad = () => (innerWidth >= 900 ? {paddingTopLeft: [10, 60], paddingBottomRight: [400, 10]} : {paddingTopLeft: [10, 64], paddingBottomRight: [10, 10]}); map.fitBounds(KR, {...krPad(), animate: false});
  window.__dvMap = map;
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
  map.on('click', (e) => { const hits = [];
    dots.forEach((m, s) => { const d = e.containerPoint.distanceTo(map.latLngToContainerPoint(m.getLatLng())); const r = m.getRadius(); if (d <= Math.max(r + 6, 22)) hits.push([d - r, s]); });
    if (!hits.length) return; hits.sort((a, b) => a[0] - b[0]);
    const inside = hits.filter((h) => h[0] <= 4);
    if (inside.length > 1) multi(inside.map((h) => h[1])); else go({c: hits[0][1]}); });

  const declutter = () => { const seen = []; box.querySelectorAll('.dv-amt').forEach((t) => { t.style.visibility = ''; const r = t.getBoundingClientRect(); if (seen.some((q) => !(r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom))) t.style.visibility = 'hidden'; else seen.push(r); }); };
  map.on('zoomend moveend', () => setTimeout(declutter, 30));
  const dim = (slug) => dots.forEach((m, s) => m.setStyle({opacity: !slug || s === slug ? 1 : 0.3, fillOpacity: !slug || s === slug ? 0.5 : 0.12}));
  // 세금 길: 도시 → 업체 소재지 선 그리기
  const drawFlows = (slug) => {
    gF.clearLayers(); FX.set([]); const c = fl.cities[slug]; if (!c || !c.flows.length) return; const arcs = [];
    const a = c.p, top = c.flows.filter((f) => f.p).slice(0, 10), mx = top[0] ? top[0].amount : 1;
    top.forEach((f, i) => {
      const b = f.p, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = Math.min(d * 0.28, 60);
      const mxp = (a[0] + b[0]) / 2 - (dy / d) * o, myp = (a[1] + b[1]) / 2 + (dx / d) * o, pts = [];
      for (let t = 0; t <= 1.0001; t += 1 / 24) pts.push(toLL([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mxp + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * myp + t * t * b[1]]));
      const w = 1.5 + 7 * Math.sqrt(f.amount / mx), col = f.local ? '#0a84ff' : '#ff9f0a';
      const ln = L.polyline(pts, {color: col, weight: w, opacity: 0.85, interactive: false, className: 'dv-line'}).addTo(gF);
      const p = ln.getElement();
      if (p && !RM) { const len = p.getTotalLength ? p.getTotalLength() : 1000; p.style.strokeDasharray = len; p.style.strokeDashoffset = len; p.style.transition = `stroke-dashoffset .9s ease-out ${i * 0.12}s`; requestAnimationFrame(() => requestAnimationFrame(() => (p.style.strokeDashoffset = 0))); }
      arcs.push({pts, w, col, n: Math.max(1, Math.round(1 + 5 * Math.sqrt(f.amount / mx))), d: i * 0.12});
      L.circleMarker(toLL(b), {radius: 3 + w / 3, color: col, weight: 1, fillOpacity: 0.9, interactive: false, className: RM ? '' : 'dv-rcv'}).addTo(gF);
      if (i < 6) L.tooltip({permanent: true, direction: 'right', className: 'klab dv-amt', offset: [4, 0], interactive: false}).setLatLng(toLL(b)).setContent(esc((f.local ? '' : f.to.split(' ').slice(-1)[0] + ' ') + krw(f.amount))).addTo(gF);
    });
    setTimeout(declutter, 50); if (cur === slug || !cur) FX.set(arcs);
  };
  // 돈 흐름 입자 (canvas · 도시 화면에서만)
  const FX = (() => { const cv = document.createElement('canvas'); cv.className = 'dv-fx'; cv.setAttribute('aria-hidden', 'true'); box.append(cv);
    const g = cv.getContext('2d'), ph = matchMedia('(pointer:coarse)').matches, CAP = ph ? 40 : 120; let A = [], P = [], raf = 0, t0 = 0, moving = false;
    const size = () => { const r = devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight; cv.width = w * r; cv.height = h * r; cv.style.width = w + 'px'; cv.style.height = h + 'px'; g.setTransform(r, 0, 0, r, 0, 0); };
    const at = (pts, u) => { const k = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(k)), f = k - i, a = map.latLngToContainerPoint(pts[i]), b = map.latLngToContainerPoint(pts[i + 1]); return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f]; };
    const loop = (ts) => { raf = 0; if (!A.length || document.hidden) return; g.clearRect(0, 0, cv.width, cv.height);
      if (!moving) { const el = (ts - t0) / 1000; g.globalCompositeOperation = 'lighter';
        for (const p of P) { const a = A[p.a]; if (el < a.d + 0.9) continue; p.u += p.s; if (p.u > 1) p.u -= 1;
          const [x, y] = at(a.pts, p.u), r = 1.2 + a.w / 4; g.fillStyle = a.col; g.globalAlpha = 0.25; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill(); g.globalAlpha = 0.95; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      raf = requestAnimationFrame(loop); };
    const go = () => { if (!raf && A.length) raf = requestAnimationFrame(loop); };
    map.on('movestart zoomstart', () => { moving = true; g.clearRect(0, 0, cv.width, cv.height); }); map.on('moveend zoomend', () => { moving = false; });
    map.on('resize', size); document.addEventListener('visibilitychange', go);
    return {set(arcs) { A = RM ? [] : arcs; P = []; g.clearRect(0, 0, cv.width, cv.height); if (!A.length) return; size();
      const tot = A.reduce((s, a) => s + a.n, 0), k = Math.min(1, CAP / tot);
      A.forEach((a, i) => { const n = Math.max(1, Math.round(a.n * k)); for (let j = 0; j < n; j++) P.push({a: i, u: j / n + Math.random() * 0.1, s: 0.004 + Math.random() * 0.002}); });
      t0 = performance.now(); go(); }}; })();
  let seq = 0;
  const fly = (slug) => { const c = fl.cities[slug]; if (!c) return; const ll = toLL(c.p); const my = ++seq; gF.clearLayers(); map.stop();
    const pts = [ll, ...c.flows.filter((f) => f.p).slice(0, 10).map((f) => toLL(f.p))], bd = L.latLngBounds(pts);
    const wide = innerWidth >= 900, sh = wide ? 0 : sheet.offsetHeight || Math.round(root.clientHeight * 0.25);
    const o = {paddingTopLeft: [24, 76], paddingBottomRight: [wide ? 420 : 24, sh + 16], maxZoom: 9.5};
    const near = L.latLngBounds([[ll[0] - 0.12, ll[1] - 0.12], [ll[0] + 0.12, ll[1] + 0.12]]), oz = {...o, maxZoom: 9.5};
    if (RM || !box.clientWidth) { map.fitBounds(bd, {...o, animate: false}); drawFlows(slug); return; }
    map.flyToBounds(near, {...oz, duration: 1});
    map.once('moveend', () => { if (my !== seq) return; drawFlows(slug);
      setTimeout(() => { if (my === seq && !map.getBounds().contains(bd)) map.flyToBounds(bd, {...o, duration: 1.1}); }, 1300); }); };

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
    sug.hidden = false; const f0 = sug.querySelector('button'); f0 && f0.classList.add('on');
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
  const src = '<p class="dv-src"><abbr title="데이터상 이상 징후는 위법을 뜻하지 않으며 정상적인 이유가 있을 수 있습니다. 공동도급은 지분이 확인된 계약만 지분대로 나눕니다.">ⓘ</abbr> 출처 조달청 나라장터</p>';
  const share = (title, u) => { u = new URL(u, location.href).href;
    if (navigator.share) return navigator.share({title, url: u}).catch(() => {});
    window.mtCopy ? mtCopy(u) : toast('링크: ' + u); };
  const toast = (m) => { const d = document.createElement('div'); d.className = 'dv-toast'; d.textContent = m; box.append(d); setTimeout(() => d.remove(), 1800); };
  const shb = (t, u) => `<button type="button" class="dv-sh" data-t="${esc(t)}" data-u="${esc(u)}" aria-label="공유">공유</button>`;
  box.addEventListener('click', (e) => { const b = e.target.closest('.dv-sh'); if (b) { e.stopPropagation(); share(b.dataset.t, b.dataset.u); } });
  const ex = (on) => { sheet.dataset.ex = on ? '1' : '0'; if (!on) sheet.scrollTop = 0; window.__inv && __inv(); };
  root.querySelector('.dv-grab').onclick = () => ex(sheet.dataset.ex !== '1');
  const L0 = () => { cur = null; seq++; gF.clearLayers(); FX.set([]); setH(0); dim(null);
    if (box.clientWidth) map.flyToBounds(KR, {...krPad(), duration: RM ? 0 : 0.8});
    const tot = C.reduce((s, c) => s + (c.total || 0), 0);
    body.innerHTML = `<p class="dv-k">전국 85개 시 · 최근 계약으로 쓴 돈</p><p class="dv-v">${krw(tot)}</p><p class="dv-l">지역을 검색하거나 원을 누르세요 ${shb('우리 시 돈 추적기', './')}</p>`
      + (W.length ? `<p class="dv-k" style="margin-top:12px">이번 주 데이터상 이상 징후</p><div class="dv-car">${W.map((c) => `<button type="button" class="dv-card" data-s="${c.slug}"><b>${esc(c.short || c.name)} · ${esc(c.top_alert.title.replace(/^데이터상 이상 징후:\s*/, ''))}</b><span>${esc(c.top_alert.detail || '')}</span><em>${krw(c.top_alert.amount)} ›</em></button>`).join('')}</div><p class="dv-cnt"></p>` : '');
    const cw = body.querySelector('.dv-car'); if (cw) { car(cw); cw.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => go({c: b.dataset.s}))); } ex(false); };
  const W = (() => { const wk = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10); return C.filter((c) => c.top_alert && (c.top_alert.detail || '').slice(0, 10) >= wk).sort((a, b) => (b.top_alert.amount || 0) - (a.top_alert.amount || 0)).slice(0, 9); })();
  const multi = (slugs) => { setH(1); body.innerHTML = '<p class="dv-k">여러 시가 겹쳐 있어요. 하나를 고르세요</p><div class="pickrow">' + slugs.map((s) => `<button type="button" class="chip" data-s="${s}">${esc((BY[s] || {}).name || s)}</button>`).join('') + '</div>';
    body.querySelectorAll('button[data-s]').forEach((b) => (b.onclick = () => go({c: b.dataset.s}))); };
  const sib = (slug, d) => { const me = BY[slug]; let g = C.filter((c) => c.province === me.province); if (g.length < 2) g = C; const i = g.findIndex((c) => c.slug === slug); return g[(i + d + g.length) % g.length].slug; };
  const top3 = (f) => { if (!f) return ''; const m = {}; for (const x of f.flows || []) for (const v of x.vendors || []) { const o = m[v.id] || (m[v.id] = {id: v.id, name: v.name, amount: 0}); o.amount += v.amount; }
    const t = Object.values(m).sort((a, b) => b.amount - a.amount).slice(0, 3);
    return t.length ? `<p class="dv-k">많이 받은 업체 3곳</p><ol class="dv-top">${t.map((v) => `<li><a href="?c=${cur}&v=${v.id}#map" data-v="${v.id}">${esc(v.name)}</a><b>${krw(v.amount)}</b></li>`).join('')}</ol>` : ''; };
  const L1 = async (slug, gu) => {
    const c = BY[slug], f = fl.cities[slug]; if (!c) return L0();
    if (cur !== slug) { cur = slug; fly(slug); window.regionRemember && regionRemember(slug); }
    cur = slug; setH(1); dim(slug);
    const out = f && f.known ? Math.round((1 - f.local / f.known) * 100) : null;
    body.innerHTML = `<div class="dv-head"><button type="button" class="dv-nav" data-d="-1" aria-label="이전 지역">‹</button><div><p class="dv-name">${esc(c.name)}${gu ? ' ' + esc(gu) : ''}</p><p class="dv-v">${krw(c.total)}</p></div><button type="button" class="dv-nav" data-d="1" aria-label="다음 지역">›</button></div>
      <p class="dv-l">최근 ${idx.days || 90}일 · ${c.total ? (out != null ? `<b class="dv-out">외지 ${out}%</b>` : '외지 비율 확인 중') : '아직 수집된 계약 없음'} ${shb(c.name + ' 계약 돈', 'c/' + slug + '.html')} <button type="button" class="dv-chip" hidden>이상 징후 <b class="dv-n">0</b>건</button></p>
      <div class="dv-more">${top3(f)}<p class="dv-k">데이터상 이상 징후</p><div class="dv-cards dv-car"><div class="skel-box"></div><div class="skel-box"></div></div><p class="dv-cnt"></p>
      <a class="gobtn" href="city.html?c=${slug}${gu ? '&gu=' + encodeURIComponent(gu) : ''}">이 시 전체 보기</a>${src}</div>`;
    ex(false); body.querySelector('.dv-chip').onclick = () => ex(true);
    body.querySelectorAll('.dv-nav').forEach((b) => (b.onclick = () => go({c: sib(slug, +b.dataset.d)}, true)));
    const box2 = body.querySelector('.dv-cards');
    try { const d = await get('data/city/' + slug + '.json'); if (cur !== slug) return;
      const A = (d.alerts || []).filter((a) => a.kind !== 'big' && (!gu || (a.detail || '').includes(gu))).slice(0, 8);
      body.querySelector('.dv-n').textContent = A.length; body.querySelector('.dv-chip').hidden = !A.length;
      box2.innerHTML = A.length ? A.map((a, i) => `<button type="button" class="dv-card" data-i="${i}"><b>${esc(a.title)}</b><span>${esc((window.maskT || ((x) => x))(a.detail))}</span><em>${krw(a.amount)} ›</em></button>`).join('') : '<p class="small">최근 눈에 띄는 패턴이 없습니다.</p>';
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
        <div class="dv-more">${a ? `<div class="dv-card on"><b>${esc(a.title)}</b><span>${esc((window.maskT || ((x) => x))(a.detail))}</span></div>` : ''}
        <div class="dv-rows">${rows.map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener"><span>${esc(r.date)} · ${esc((window.maskT || ((x) => x))(r.title))}${r.jshare ? ` <i class="jvb">공동도급 ${r.jshare}%</i>` : ''}</span><b>${krw(r.amount)} 원문 ›</b></a>`).join('')}</div>
        <a class="gobtn" href="vendor.html?v=${vid}">업체 전체 보기</a>${src}</div>`;
      ex(false); body.querySelector('.dv-chip').onclick = () => ex(true);
      body.querySelector('.dv-back').onclick = () => history.back();
    } catch (e) { body.innerHTML = '<button type="button" class="dv-back">‹ 뒤로</button><p class="sub">업체 정보를 불러오지 못했어요.</p>'; body.querySelector('.dv-back').onclick = () => history.back(); }
  };
  const render = () => { const q = new URLSearchParams(location.search); const c = q.get('c'), v = q.get('v');
    if (c && BY[c] && v && /^[0-9a-z]+$/.test(v)) L2(c, v, q.get('a')); else if (c && BY[c]) L1(c, q.get('gu')); else L0(); };
  const go = (st, replace) => { const pk0 = root.querySelector('.dv-pick'); if (pk0 && !st._pick) pk0.remove(); const q = new URLSearchParams(); if (st.c) q.set('c', st.c); if (st.gu) q.set('gu', st.gu); if (st.v) q.set('v', st.v); if (st.a) q.set('a', st.a);
    const u = location.pathname + (q.toString() ? '?' + q : '') + '#map'; history[replace ? 'replaceState' : 'pushState']({dv: 1}, '', u); render();
    sheet.scrollTop = 0; body.classList.remove('dv-in'); void body.offsetWidth; body.classList.add('dv-in'); };
  addEventListener('popstate', render); window.__dvGo = go;
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
          <div class="dv-pk-x"><p class="dv-pk-r">${esc(A.title)}</p><div class="dv-pk-b"><a href="https://www.g2b.go.kr" target="_blank" rel="noopener">나라장터 원문</a><button type="button" data-sh>공유</button><button type="button" data-x>닫기</button></div>
          <p class="dv-pk-s">출처: 조달청 나라장터(공공데이터포털) · 위법을 뜻하지 않아요</p></div>`;
        d.querySelector('.dv-pk-line').onclick = () => { if (d.classList.toggle('open')) go({c: pk.slug, _pick: 1}); };
        sheet.prepend(d);
        d.querySelector('[data-x]').onclick = () => { d.remove(); if (cur) go({}, true); };
        d.querySelector('[data-sh]').onclick = () => { const u = location.href.replace(/[^/]*([?#].*)?$/, '') + 'c/' + pk.slug + '.html#' + A.key;
          navigator.share ? navigator.share({title: '데이터상 이상 징후 · ' + pk.name, url: u}).catch(() => {}) : window.mtCopy && mtCopy(u); };
        addEventListener('popstate', () => d.remove(), {once: true});
        const rm = () => { const c = new URLSearchParams(location.search).get('c'); if (c && c !== pk.slug) d.remove(); };
        addEventListener('click', () => setTimeout(rm, 50)); }, 600); }
  } catch (e) {}
})();
