/* 국민연금 국내주식 본사 지도. 시도 원 → 확대하면 시군구 원. 설명 카드는 지도 밖에만 둔다. */
(() => {
  const box = document.getElementById('npsMapBox');
  if (!box) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const won = (eok) => {
    const neg = Number(eok) < 0;
    eok = Math.abs(Number(eok) || 0);
    const jo = Math.floor((eok + 1e-9) / 10000);
    const rest = Math.round((eok - jo * 10000) * 10) / 10;
    const rs = rest.toLocaleString('ko-KR', { minimumFractionDigits: Number.isInteger(rest) ? 0 : 1, maximumFractionDigits: 1 });
    const s = jo ? jo.toLocaleString('ko-KR') + '조' + (rest ? ' ' + rs + '억원' : '원') : rs + '억원';
    return (neg ? '-' : '') + s;
  };
  const radius = (v, max) => (v > 0 ? 6 + 22 * Math.sqrt(v / max) : 5);

  fetch('data/nps/kr_hq_region.json')
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then((data) => draw(data))
    .catch(() => { box.innerHTML = '<p class="sub">지역 자료를 불러오지 못했어요.</p>'; });

  function draw(data) {
    const regions = (data.regions || []).filter((r) => r.lat != null && r.lng != null);
    const rank = data.regions || [];
    const sigs = [];
    for (const r of data.regions || []) {
      for (const g of r.sigungu || []) {
        if (g.lat == null || g.lng == null) continue;
        sigs.push({ sido: r.sido, name: g.name, value: g.value_100m_krw, count: g.company_count, top: g.top || [], lat: g.lat, lng: g.lng });
      }
    }
    const asof = String(data.holdings_as_of || '').split('-');
    const when = asof.length === 3 ? `${+asof[0]}년 ${+asof[1]}월 ${+asof[2]}일` : '';
    box.innerHTML = `<div id="npsMap" class="nps-map" role="application" aria-label="국민연금 국내 주식 본사 지도"></div>
      <p class="sub">동그라미가 클수록 들어간 돈이 많아요. 지도를 키우면 시·군·구가 보여요.</p>
      <div id="npsPick" class="card pick"></div>
      <h3>지역 순위</h3>
      <div id="npsRank"></div>
      <div id="npsGu"></div>
      <p class="note" id="npsMiss"></p>
      <p class="src" id="npsSrc"></p>`;
    const missN = data.unmatched_count || (data.unmatched || []).length;
    const missV = data.unmatched_value_100m_krw || 0;
    document.getElementById('npsMiss').textContent = `지역을 못 찾은 회사 ${Number(missN).toLocaleString('ko-KR')}곳, ${won(missV)}`;
    const src = (data.sources && data.sources[0]) || { url: data.source_url, name: 'DART 기업개황' };
    const src2 = (data.sources && data.sources[1]) || null;
    document.getElementById('npsSrc').innerHTML = `${when ? esc(when) + ' 기준. ' : ''}출처 <a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(src.name)}</a>${src2 ? ` · <a href="${esc(src2.url)}" target="_blank" rel="noopener">${esc(src2.name)}</a>` : ''}${data.fetched ? ' · ' + esc(data.fetched) + '에 받음' : ''}`;

    if (!window.L) { box.querySelector('.nps-map').insertAdjacentHTML('beforebegin', '<p class="sub">지도를 띄우지 못했어요. 아래 순위로 볼 수 있어요.</p>'); paintLists(null); return; }

    const mapEl = document.getElementById('npsMap');
    const coarse = matchMedia('(pointer: coarse)').matches;
    const map = L.map(mapEl, {
      zoomControl: false, attributionControl: true, minZoom: 6, maxZoom: 12, zoomSnap: 0.25,
      scrollWheelZoom: false, tap: true,
      maxBounds: [[30.5, 121], [41, 134]],
    });
    map.attributionControl.setPrefix(false);
    if (!coarse) L.control.zoom({ position: 'topleft' }).addTo(map);
    else map.dragging.disable();
    const homeBtn = document.createElement('button');
    homeBtn.type = 'button';
    homeBtn.className = 'map-home is-home';
    homeBtn.innerHTML = '<span aria-hidden="true">⟲</span> 처음으로';
    homeBtn.setAttribute('aria-label', '지도를 처음 본 모습으로 되돌리기');
    const homeCtl = L.control({ position: 'topright' });
    homeCtl.onAdd = () => {
      const w = L.DomUtil.create('div', 'leaflet-control map-home-ctl');
      w.append(homeBtn);
      L.DomEvent.disableClickPropagation(w);
      L.DomEvent.disableScrollPropagation(w);
      return w;
    };
    homeCtl.addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12, attribution: '지도: Esri, HERE, Garmin, &copy; OpenStreetMap 기여자',
    }).addTo(map);

    const korea = L.latLngBounds([[33.1, 125.0], [38.65, 129.6]]);
    map.fitBounds(korea, { animate: false, paddingTopRight: [8, 36], paddingBottomLeft: [8, 8] });
    const cut = map.getBoundsZoom(korea, false) + 1.15;
    const layer = L.layerGroup().addTo(map);
    let sel = null;

    function keyOf(it, mode) { return mode === 'gu' ? it.sido + '|' + it.name : it.sido; }
    function paint(mode) {
      layer.clearLayers();
      const items = mode === 'gu' ? sigs : regions;
      const max = Math.max(1, ...items.map((it) => it.value_100m_krw || it.value || 0));
      const ordered = items.slice().sort((a, b) => (b.value_100m_krw || b.value || 0) - (a.value_100m_krw || a.value || 0));
      ordered.forEach((it, i) => {
        const v = it.value_100m_krw || it.value || 0;
        const lat = it.lat, lng = it.lng;
        const on = sel && sel.k === keyOf(it, mode);
        const m = L.circleMarker([lat, lng], {
          radius: radius(v, max), weight: on ? 3 : 1.5, color: on ? '#ffd60a' : '#fff',
          fillColor: '#0a84ff', fillOpacity: v > 0 ? 0.55 : 0.3,
        });
        m.on('click', (e) => { L.DomEvent.stopPropagation(e); choose(it, mode); });
        m.addTo(layer);
        const showName = mode === 'sido' ? i < 17 : i < 18;
        if (showName) {
          const tip = L.tooltip({ permanent: true, direction: 'right', className: 'klab', offset: [8, 0], interactive: false })
            .setLatLng([lat, lng]).setContent(mode === 'gu' ? it.name : it.sido);
          tip.addTo(layer);
        }
      });
      requestAnimationFrame(declutter);
    }
    function declutter() {
      const root = map.getContainer().getBoundingClientRect();
      const seen = [];
      map.getContainer().querySelectorAll('.leaflet-control').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 4) seen.push(r);
      });
      const tips = [...map.getContainer().querySelectorAll('.leaflet-tooltip')];
      tips.forEach((t) => { t.style.visibility = 'visible'; });
      tips.forEach((t) => {
        const r = t.getBoundingClientRect();
        const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const outside = r.left < root.left + 2 || r.right > root.right - 2 || r.top < root.top + 2 || r.bottom > root.bottom - 2;
        if (outside || r.width < 2 || seen.some((s) => hit(r, s))) t.style.visibility = 'hidden';
        else seen.push(r);
      });
    }
    function modeNow() { return map.getZoom() >= cut ? 'gu' : 'sido'; }
    function choose(it, mode) {
      sel = { k: keyOf(it, mode), it, mode };
      if (mode === 'sido') {
        const pts = sigs.filter((g) => g.sido === it.sido);
        if (pts.length) {
          const b = L.latLngBounds(pts.map((p) => [p.lat, p.lng]));
          map.fitBounds(b.pad(0.35), { maxZoom: 11, paddingTopRight: [8, 36] });
        } else map.setView([it.lat, it.lng], Math.max(map.getZoom(), cut));
      }
      homeBtn.classList.toggle('is-home', false);
      showPick();
      paint(modeNow());
    }
    function showPick() {
      const pick = document.getElementById('npsPick');
      const guBox = document.getElementById('npsGu');
      if (!sel) {
        pick.innerHTML = '<p class="sub">지역이나 동그라미를 누르면, 그곳에 본사를 둔 회사가 나와요.</p>';
        guBox.innerHTML = '';
        paintLists();
        return;
      }
      const it = sel.it;
      const name = sel.mode === 'gu' ? `${it.sido} ${it.name}` : it.sido;
      const v = it.value_100m_krw || it.value || 0;
      const n = it.company_count != null ? it.company_count : it.count;
      const top = it.top || [];
      const mx = top.length ? top[0].value_100m_krw : 1;
      pick.innerHTML = `<div class="sub">${esc(name)}</div><div class="big" style="font-size:24px">${esc(won(v))}</div><p class="sub">회사 ${Number(n).toLocaleString('ko-KR')}곳</p><h3>가장 많이 들어간 회사 5곳</h3>` +
        (top.length ? top.map((c, i) => `<div class="row"><span>${i + 1}. ${esc(c.company)}<div class="bar" style="width:${Math.max(8, Math.sqrt(c.value_100m_krw / mx) * 100)}%"></div></span><b>${esc(won(c.value_100m_krw))}</b></div>`).join('') : '<p class="sub">표시할 회사가 없어요.</p>');
      const parent = (data.regions || []).find((r) => r.sido === (sel.mode === 'gu' ? it.sido : it.sido));
      const gus = parent && parent.sigungu || [];
      const gmax = gus.length ? gus[0].value_100m_krw : 1;
      guBox.innerHTML = gus.length ? `<h3>${esc(parent.sido)} 안의 시·군·구</h3>` + gus.map((g) => {
        const on = sel.mode === 'gu' && sel.it.name === g.name;
        return `<button type="button" class="row${on ? ' on' : ''}" data-gu="${esc(g.name)}"><span>${esc(g.name)} <span class="sub">${Number(g.company_count).toLocaleString('ko-KR')}곳</span><div class="bar" style="width:${Math.max(8, Math.sqrt(g.value_100m_krw / gmax) * 100)}%"></div></span><b>${esc(won(g.value_100m_krw))}</b></button>`;
      }).join('') : '';
      guBox.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => {
        const g = gus.find((x) => x.name === btn.getAttribute('data-gu'));
        const placed = sigs.find((x) => x.sido === parent.sido && x.name === g.name);
        if (placed) choose(placed, 'gu');
        else choose({ sido: parent.sido, name: g.name, value: g.value_100m_krw, count: g.company_count, top: g.top || [], lat: parent.lat, lng: parent.lng }, 'gu');
      }));
      paintLists();
    }
    function paintLists() {
      const el = document.getElementById('npsRank');
      const max = rank.length ? rank[0].value_100m_krw : 1;
      el.innerHTML = rank.map((r) => {
        const on = sel && (sel.mode === 'sido' ? sel.it.sido === r.sido : sel.it.sido === r.sido);
        return `<button type="button" class="row${on ? ' on' : ''}" data-sido="${esc(r.sido)}"><span>${esc(r.sido)} <span class="sub">회사 ${Number(r.company_count).toLocaleString('ko-KR')}곳</span><div class="bar" style="width:${Math.max(8, Math.sqrt((r.value_100m_krw || 0) / max) * 100)}%"></div></span><b>${esc(won(r.value_100m_krw))}</b></button>`;
      }).join('');
      el.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => {
        const r = regions.find((x) => x.sido === btn.getAttribute('data-sido')) || rank.find((x) => x.sido === btn.getAttribute('data-sido'));
        if (r && r.lat != null) choose(r, 'sido');
      }));
    }
    function goHome() {
      sel = null;
      map.fitBounds(korea, { paddingTopRight: [8, 36], paddingBottomLeft: [8, 8] });
      homeBtn.classList.add('is-home');
      showPick();
      paint('sido');
    }
    homeBtn.addEventListener('click', goHome);
    map.on('zoomend moveend', () => {
      const m = modeNow();
      paint(m);
      homeBtn.classList.toggle('is-home', m === 'sido' && !sel);
    });
    map.on('click', () => { /* 빈 곳. 카드는 지도 밖에 그대로 둔다. */ });
    let t = 0;
    const inv = () => { clearTimeout(t); t = setTimeout(() => { map.invalidateSize({ pan: false }); declutter(); }, 80); };
    if (window.ResizeObserver) new ResizeObserver(inv).observe(mapEl);
    addEventListener('resize', inv);
    showPick();
    paint('sido');
    setTimeout(() => { map.invalidateSize(); declutter(); }, 200);
  }
})();
