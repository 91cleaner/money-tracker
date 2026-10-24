/* 국민연금 주식 지도 하나: 국민연금공단(전주)에서 회사 본사가 있는 곳으로 선을 긋는다.
   국내는 시도(확대하면 시·군·구), 해외는 미국 주와 나라. 금액은 모두 원으로 바꿔 같은 굵기 기준을 쓴다.
   선은 '그 지역에 본사를 둔 회사의 주식을 산 금액'이다. 돈이 그 지역에 실제로 간 것은 아니다. 설명 카드는 지도 밖에만 둔다. */
(() => {
  const box = document.getElementById('npsMapBox');
  if (!box) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ORIGIN = { name: '국민연금공단', sub: '전주 본부', lat: 35.84, lng: 127.06 };
  const OUT = window.mtOut || '#ff9f0a';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 원 → 읽기 쉬운 말 (조·억)
  const won = (n) => {
    n = Math.abs(Number(n) || 0);
    if (n >= 1e12) {
      const jo = Math.floor(n / 1e12), eok = Math.round((n % 1e12) / 1e8);
      return jo.toLocaleString('ko-KR') + '조' + (eok ? ' ' + eok.toLocaleString('ko-KR') + '억원' : '원');
    }
    if (n >= 1e8) return (n >= 1e10 ? Math.round(n / 1e8).toLocaleString('ko-KR') : (n / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원';
    return Math.round(n / 1e4).toLocaleString('ko-KR') + '만원';
  };
  const usd = (n) => {
    n = Math.abs(Number(n) || 0);
    const eok = n / 1e8;
    if (eok >= 1) return (eok >= 100 ? Math.round(eok).toLocaleString('ko-KR') : (Math.round(eok * 10) / 10).toLocaleString('ko-KR')) + '억 달러';
    return Math.round(n / 1e4).toLocaleString('ko-KR') + '만 달러';
  };
  const ymd = (s) => { const a = String(s || '').split('-'); return a.length === 3 ? `${+a[0]}년 ${+a[1]}월 ${+a[2]}일` : ''; };
  const load = (file) => fetch(file).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });

  Promise.allSettled([load('data/nps/kr_hq_region.json'), load('data/nps/us_hq_region.json')]).then(async (res) => {
    const kr = res[0].status === 'fulfilled' ? res[0].value : null;
    const us = res[1].status === 'fulfilled' ? res[1].value : null;
    let fx = null;
    if (us && us.holdings_file) { try { fx = (await load(us.holdings_file)).fx || null; } catch (e) { fx = null; } }
    if (!kr && !us) { box.innerHTML = '<p class="sub">지도 자료를 불러오지 못했어요.</p>'; return; }
    draw(kr, us, fx);
  });

  function draw(kr, us, fx) {
    const rate = fx && Number(fx.usd_krw) > 0 ? Number(fx.usd_krw) : null;
    // 목적지: 국내 시도·시군구, 해외 주·나라. 금액은 원.
    const dom = [], gu = [], abroad = [];
    if (kr) for (const r of kr.regions || []) {
      if (r.lat == null || r.lng == null) continue;
      dom.push({ key: 'kr|' + r.sido, where: 'kr', name: r.sido, full: r.sido, lat: r.lat, lng: r.lng, krw: (r.value_100m_krw || 0) * 1e8, n: r.company_count, top: (r.top || []).map((c) => ({ name: c.company, krw: (c.value_100m_krw || 0) * 1e8 })), parent: r });
      for (const g of r.sigungu || []) {
        if (g.lat == null || g.lng == null) continue;
        gu.push({ key: 'gu|' + r.sido + '|' + g.name, where: 'kr', name: String(g.name).split(' ').pop(), full: r.sido + ' ' + g.name, lat: g.lat, lng: g.lng, krw: (g.value_100m_krw || 0) * 1e8, n: g.company_count, top: (g.top || []).map((c) => ({ name: c.company, krw: (c.value_100m_krw || 0) * 1e8 })), parent: r });
      }
    }
    if (us && rate) for (const r of us.regions || []) {
      if (r.lat == null || r.lng == null || !(r.value_usd > 0)) continue;
      // 아메리카는 태평양을 건너가게 경도를 360 더한다(지도에서 끊기지 않게).
      const lng = r.lng < -20 ? r.lng + 360 : r.lng;
      abroad.push({ key: 'us|' + r.kind + '|' + r.code, where: r.kind === 'state' ? 'us' : 'world', name: r.name, full: r.kind === 'state' ? '미국 ' + r.name : r.name, lat: r.lat, lng, krw: r.value_usd * rate, usd: r.value_usd, n: r.company_count, pct: r.pct, top: (r.top || []).map((c) => ({ name: c.company, krw: (c.value_usd || 0) * rate, usd: c.value_usd })) });
    }
    const krTotal = kr ? (kr.total_value_100m_krw || 0) * 1e8 : 0;
    const usTotal = us && rate ? (us.total_value_usd || 0) * rate : 0;

    box.innerHTML = `<div class="nps-view" role="group" aria-label="지도 보기">
        <button type="button" data-cam="all" aria-pressed="true">전체</button>
        <button type="button" data-cam="kr" aria-pressed="false">한국</button>
        <button type="button" data-cam="us" aria-pressed="false">미국</button>
      </div>
      <div id="npsMap" class="nps-map" role="application" aria-label="국민연금 주식 지도. 선은 국민연금공단에서 회사 본사가 있는 곳으로 그었어요."></div>
      <p class="tm-line">국민연금이 산 주식의 회사 본사가 있는 곳으로 선을 그었어요. 선이 굵을수록 그곳 회사 주식에 들어간 돈이 많아요. 공장이나 일하는 사람은 다른 곳일 수 있어요.</p>
      <div class="nps-tot">
        ${kr ? `<div><span class="sub">국내 주식</span><b>${esc(won(krTotal))}</b><span class="sub">${esc(ymd(kr.holdings_as_of))} 기준</span></div>` : ''}
        ${us && rate ? `<div><span class="sub">미국 주식</span><b>약 ${esc(won(usTotal))}</b><span class="sub">${esc(ymd(us.holdings_as_of))} 기준 · ${esc(usd(us.total_value_usd))}</span></div>` : ''}
      </div>
      <div id="npsPick" class="card pick"></div>
      <h3>돈이 많이 간 곳</h3>
      <div id="npsRank"></div>
      <button type="button" class="nps-more" id="npsMore" hidden>전체 보기</button>
      <p class="note" id="npsMiss"></p>
      <p class="src" id="npsSrc"></p>`;

    const miss = [];
    if (kr) miss.push(`국내 ${Number(kr.unmatched_count || (kr.unmatched || []).length).toLocaleString('ko-KR')}곳 ${won((kr.unmatched_value_100m_krw || 0) * 1e8)}`);
    if (us && rate) miss.push(`해외 ${Number(us.unmatched_count || 0).toLocaleString('ko-KR')}곳 약 ${won((us.unmatched_value_usd || 0) * rate)}`);
    document.getElementById('npsMiss').textContent = miss.length ? '본사 위치를 못 찾아 지도에서 빠진 회사: ' + miss.join(' · ') : '';
    const srcs = [];
    for (const d of [kr, us]) if (d) for (const s of (d.sources || []).slice(0, 2)) if (s && s.url) srcs.push(`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name || '출처')}</a>`);
    document.getElementById('npsSrc').innerHTML = (rate ? `달러는 1달러 ${rate.toLocaleString('ko-KR')}원(${esc(ymd(fx.date))} 환율${fx.source ? `, <a href="${esc(fx.source)}" target="_blank" rel="noopener">연합뉴스</a>` : ''})으로 바꾼 대략의 금액이에요. ` : '해외 금액을 원으로 바꿀 환율을 못 불러와 해외는 지도에서 뺐어요. ') +
      '국내와 미국은 공개된 날짜가 달라요. 출처 ' + srcs.join(' · ');

    const all = dom.concat(abroad);
    let sel = null, showAll = false;
    const pickEl = document.getElementById('npsPick');
    const rankEl = document.getElementById('npsRank');
    const moreBtn = document.getElementById('npsMore');

    function showPick() {
      if (!sel) { pickEl.innerHTML = '<p class="sub">선이나 동그라미, 아래 순위를 누르면 그곳에 본사를 둔 회사가 나와요.</p>'; return; }
      const it = sel;
      const mx = it.top.length ? it.top[0].krw || 1 : 1;
      const tot = it.where === 'kr' ? krTotal : usTotal;
      const share = tot > 0 ? ` · ${it.where === 'kr' ? '국내' : '미국'} 주식의 ${(it.krw / tot * 100).toFixed(1)}%` : '';
      pickEl.innerHTML = `<div class="sub">${esc(ORIGIN.name)} → ${esc(it.full)}</div><div class="big" style="font-size:24px">${it.usd ? '약 ' : ''}${esc(won(it.krw))}</div>` +
        `<p class="sub">회사 ${Number(it.n || 0).toLocaleString('ko-KR')}곳${esc(share)}${it.usd ? ' · ' + esc(usd(it.usd)) : ''}</p><h3>가장 많이 들어간 회사 5곳</h3>` +
        (it.top.length ? it.top.slice(0, 5).map((c, i) => `<div class="row"><span>${i + 1}. ${esc(c.name)}<div class="bar" style="width:${Math.max(8, Math.sqrt((c.krw || 0) / mx) * 100)}%"></div></span><b>${c.usd ? '약 ' : ''}${esc(won(c.krw))}</b></div>`).join('') : '<p class="sub">표시할 회사가 없어요.</p>');
    }
    function paintRank() {
      const list = all.slice().sort((a, b) => b.krw - a.krw);
      const max = list.length ? list[0].krw : 1;
      const shown = showAll ? list : list.slice(0, 12);
      rankEl.innerHTML = shown.map((r) => `<button type="button" class="row${sel && sel.key === r.key ? ' on' : ''}" data-k="${esc(r.key)}"><span>${esc(r.full)} <span class="sub">${r.where === 'kr' ? '국내' : '해외'} · 회사 ${Number(r.n || 0).toLocaleString('ko-KR')}곳</span><div class="bar" style="width:${Math.max(8, Math.sqrt(r.krw / max) * 100)}%"></div></span><b>${r.usd ? '약 ' : ''}${esc(won(r.krw))}</b></button>`).join('');
      moreBtn.hidden = list.length <= 12;
      moreBtn.textContent = showAll ? '접기' : `전체 ${list.length}곳 보기`;
      rankEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { const it = all.find((x) => x.key === b.dataset.k); if (it) choose(it, true); }));
    }
    moreBtn.addEventListener('click', () => { showAll = !showAll; paintRank(); });

    if (!window.L) {
      document.getElementById('npsMap').insertAdjacentHTML('beforebegin', '<p class="sub">지도를 띄우지 못했어요. 아래 순위로 볼 수 있어요.</p>');
      showPick(); paintRank(); return;
    }
    const mapEl = document.getElementById('npsMap');
    const coarse = matchMedia('(pointer: coarse)').matches;
    const map = L.map(mapEl, { zoomControl: false, attributionControl: true, minZoom: 0, maxZoom: 11, zoomSnap: 0.25, scrollWheelZoom: false, tap: true, worldCopyJump: false });
    map.attributionControl.setPrefix(false);
    if (window.mtZoom) mtZoom(map, mapEl); // 확대·축소는 우리 동네 세금 지도와 똑같이
    else if (!coarse) L.control.zoom({ position: 'bottomleft' }).addTo(map);
    const FX = window.mtFX ? mtFX(map, mapEl) : null; // 돈이 흐르는 방향으로 움직이는 빛
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 11, attribution: '지도: Esri, HERE, Garmin, &copy; OpenStreetMap 기여자',
    }).addTo(map);

    const KR = L.latLngBounds([[33.1, 125.0], [38.65, 129.6]]);
    const US = L.latLngBounds(abroad.filter((a) => a.where === 'us').map((a) => [a.lat, a.lng]));
    const WORLD = L.latLngBounds([[ORIGIN.lat, ORIGIN.lng], ...all.map((a) => [a.lat, a.lng])]);
    const pad = { paddingTopRight: [12, 48], paddingBottomLeft: [12, 12] };
    const cams = {
      all: () => map.fitBounds(WORLD, { ...pad, animate: !RM }),
      kr: () => map.fitBounds(KR, { ...pad, animate: !RM }),
      us: () => (US.isValid() ? map.fitBounds(US, { ...pad, animate: !RM }) : cams.all()),
    };
    map.fitBounds(WORLD, { ...pad, animate: false });
    const krZoom = () => map.getBoundsZoom(KR, false);

    const gLine = L.layerGroup().addTo(map), gDot = L.layerGroup().addTo(map);
    // 위경도로 휘는 선. 가까운 곳도 휘어 보이게 거리에 비례해 띄운다.
    const arc = (a, b) => {
      const dx = b[1] - a[1], dy = b[0] - a[0], d = Math.hypot(dx, dy) || 1, o = d * (d < 8 ? 0.35 : 0.2);
      const c = [(a[0] + b[0]) / 2 + (dx / d) * o, (a[1] + b[1]) / 2 - (dy / d) * o], pts = [];
      for (let t = 0; t <= 1.0001; t += 1 / 32) { const u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
      return pts;
    };
    const weight = (v, mx) => (window.mtW ? mtW(v, mx) : 1.5 + 7 * Math.sqrt(v / (mx || 1)));

    function targets() {
      // 한국을 크게 볼 때는 국내를 시·군·구로, 아니면 시도로.
      const fine = map.getZoom() >= krZoom() + 1.1 && map.getBounds().intersects(KR);
      return { fine, list: (fine ? gu.slice().sort((a, b) => b.krw - a.krw).slice(0, 40) : dom).concat(abroad) };
    }
    function paint() {
      gLine.clearLayers(); gDot.clearLayers();
      mapEl.querySelectorAll('.leaflet-tooltip').forEach((el) => el.remove());
      const { list } = targets();
      const mx = Math.max(1, ...list.map((x) => x.krw));
      const o = [ORIGIN.lat, ORIGIN.lng];
      const view = map.getBounds().pad(0.1);
      const ordered = list.slice().sort((a, b) => b.krw - a.krw);
      const named = new Set(ordered.filter((x) => view.contains([x.lat, x.lng])).slice(0, 14).map((x) => x.key));
      if (sel) named.add(sel.key);
      const rankOf = new Map(ordered.map((x, i) => [x.key, i]));
      // 굵은 선을 먼저 그려 가는 선이 위에 보이게 한다. 이름표 순서는 따로 금액 순으로 정한다.
      const glow = [];
      ordered.forEach((it, i) => {
        const on = sel && sel.key === it.key, dim = sel && !on;
        const w = weight(it.krw, mx), pts = arc(o, [it.lat, it.lng]);
        const ln = L.polyline(pts, { color: OUT, weight: w, opacity: dim ? 0.18 : 0.8, lineCap: 'round', interactive: true, className: 'nps-fl' }).addTo(gLine);
        if (!dim) glow.push({ pts, w, col: OUT, n: (window.mtFxN ? mtFxN(it.krw, mx) : 2) + (on ? 4 : 0), d: i * 0.06 });
        ln.on('click', (e) => { L.DomEvent.stopPropagation(e); choose(it); });
        const dot = L.circleMarker([it.lat, it.lng], { radius: 3 + w / 2.5, weight: on ? 3 : 1.5, color: on ? '#ffd60a' : '#fff', fillColor: OUT, fillOpacity: dim ? 0.3 : 0.95, className: dim ? '' : 'mt-rcv' }).addTo(gDot);
        dot.on('click', (e) => { L.DomEvent.stopPropagation(e); choose(it); });
        if (named.has(it.key)) dot.bindTooltip(esc(it.name), { permanent: true, direction: 'right', className: 'klab', offset: [6, 0], interactive: false });
        const tip = dot.getTooltip && dot.getTooltip(); if (tip && tip.getElement && tip.getElement()) tip.getElement().dataset.rank = on ? -1 : rankOf.get(it.key);
      });
      L.circleMarker(o, { radius: 9, weight: 3, color: '#fff', fillColor: '#0a84ff', fillOpacity: 1, interactive: false }).addTo(gDot)
        .bindTooltip(esc(ORIGIN.name), { permanent: true, direction: 'left', className: 'klab nps-origin', offset: [-8, 0], interactive: false });
      if (window.mtLegend) mtLegend(mapEl, [
        { t: 'dot', c: '#0a84ff', l: ORIGIN.name + '(' + ORIGIN.sub + ')' },
        { t: 'ln', c: OUT, l: '회사 본사가 있는 곳' },
        { t: 'w', c: OUT, l: '선이 굵을수록 돈이 많아요' },
      ].concat(sel ? [{ t: 'ring', l: '지금 고른 곳' }] : []));
      if (FX) FX.set(glow);
      setTimeout(declutter, 40);
    }
    function declutter() {
      if (!map._mapPane) return;
      const root = mapEl.getBoundingClientRect();
      const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const seen = [];
      mapEl.querySelectorAll('.leaflet-control').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width > 4 && r.height > 4 && r.width < 280 && r.height < 160) seen.push({ left: r.left - 4, right: r.right + 4, top: r.top - 4, bottom: r.bottom + 4 }); });
      const tips = [...mapEl.querySelectorAll('.leaflet-tooltip')];
      const pr = (t) => (t.classList.contains('nps-origin') ? -2 : Number(t.dataset.rank ?? 999));
      tips.sort((a, b) => pr(a) - pr(b)); // 출발점, 고른 곳, 금액 큰 곳 순서로 자리를 먼저 잡는다
      tips.forEach((t) => {
        t.style.visibility = 'visible';
        const r = t.getBoundingClientRect();
        const inside = r.width > 2 && r.left >= root.left + 2 && r.right <= root.right - 2 && r.top >= root.top + 2 && r.bottom <= root.bottom - 2;
        if (!inside || seen.some((s) => hit(r, s))) t.style.visibility = 'hidden';
        else seen.push({ left: r.left - 2, right: r.right + 2, top: r.top - 2, bottom: r.bottom + 2 });
      });
    }
    function setCam(k) { mapEl.parentElement.querySelectorAll('.nps-view button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cam === k ? 'true' : 'false')); }
    function choose(it, move) {
      sel = it;
      if (move) {
        if (it.where === 'kr') map.fitBounds(KR, { ...pad, animate: !RM });
        else map.setView([it.lat, it.lng], Math.max(map.getZoom(), it.where === 'us' ? 3.5 : 3), { animate: !RM });
        setCam('');
        mapEl.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
      }
      showPick(); paintRank(); paint();
      if (home) home.mark(false);
    }
    const home = window.mtHome ? mtHome(map, () => { sel = null; setCam('all'); cams.all(); showPick(); paintRank(); paint(); home.mark(true); }, 'topright') : null;
    box.querySelectorAll('.nps-view button').forEach((b) => b.addEventListener('click', () => { setCam(b.dataset.cam); cams[b.dataset.cam](); if (home) home.mark(b.dataset.cam === 'all' && !sel); }));
    map.on('click', () => { if (!sel) return; sel = null; showPick(); paintRank(); paint(); });
    let lastFine = null;
    map.on('zoomend moveend', () => { const f = targets().fine; if (f !== lastFine) { lastFine = f; paint(); } else setTimeout(declutter, 40); });
    let t = 0;
    const inv = () => { clearTimeout(t); t = setTimeout(() => { map.invalidateSize({ pan: false }); declutter(); }, 80); };
    if (window.ResizeObserver) new ResizeObserver(inv).observe(mapEl);
    addEventListener('resize', inv);
    showPick(); paintRank(); paint();
    setTimeout(() => { map.invalidateSize(); declutter(); }, 200);
  }
})();
