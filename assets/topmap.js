/* 탭 맨 위 큰 한국 지도. 시 위치는 flows.json, 금액은 그 페이지 자료만. */
(() => {
  const root = document.getElementById('topmap');
  if (!root) return;
  const kind = root.dataset.kind || 'tax';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const won = (n) => {
    n = Math.round(Number(n) || 0);
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e12) {
      const j = Math.floor(a / 1e12), e = Math.round((a % 1e12) / 1e8);
      return s + j.toLocaleString('ko-KR') + '조' + (e ? ' ' + e.toLocaleString('ko-KR') + '억' : '') + '원';
    }
    if (a >= 1e8) return s + (a >= 1e10 ? Math.round(a / 1e8).toLocaleString('ko-KR') : (a / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원';
    if (a >= 1e4) return s + Math.round(a / 1e4).toLocaleString('ko-KR') + '만원';
    return s + a.toLocaleString('ko-KR') + '원';
  };
  const GK = Math.cos(36 * Math.PI / 180), GSX = 600 / (6.5 * GK);
  const toLL = (p) => [38.7 - p[1] / GSX, 124.5 + p[0] / (GK * GSX)];
  const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  const SHORT = {
    '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
    '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산', '세종특별자치시': '세종',
    '경기도': '경기', '강원특별자치도': '강원', '강원도': '강원', '충청북도': '충북', '충청남도': '충남',
    '전북특별자치도': '전북', '전라북도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
    '제주특별자치도': '제주',
  };
  const say = (html) => {
    let p = root.querySelector('.tm-line');
    if (!p) { p = document.createElement('p'); p.className = 'tm-line'; root.append(p); }
    p.innerHTML = html;
    return p;
  };

  function placed(idx, fl) {
    return (idx.cities || []).map((c) => {
      const f = fl.cities && fl.cities[c.slug];
      if (!f || !f.p) return null;
      const ll = toLL(f.p);
      return { slug: c.slug, name: c.short || c.name, token: c.name, province: c.province, lat: ll[0], lng: ll[1] };
    }).filter(Boolean);
  }
  function matchCity(region, cities) {
    const parts = String(region || '').trim().split(/\s+/);
    if (!parts[0]) return null;
    const metro = cities.find((c) => /특별|광역/.test(c.province || '') && (parts[0] === c.province || String(region).startsWith(c.province)));
    if (metro) return metro;
    const token = parts[1] || '';
    if (!token) return null;
    return cities.find((c) => c.province === parts[0] && c.token === token) || null;
  }

  async function load() {
    if (kind === 'tax') {
      const [idx, fl] = await Promise.all([get('data/index.json'), get('data/flows.json')]);
      const points = placed(idx, fl).map((c) => ({ ...c, value: (fl.cities[c.slug] && fl.cities[c.slug].total) || 0 })).filter((c) => c.value > 0);
      return { points, line: '<a href="./#map">우리 동네 세금 지도 더 보기</a>' };
    }
    if (kind === 'sole') {
      const [idx, fl, sole] = await Promise.all([get('data/index.json'), get('data/flows.json'), get('data/sec_sole.json')]);
      const by = Object.fromEntries((sole.share || []).map((s) => [s.slug, s.sole || 0]));
      const points = placed(idx, fl).map((c) => ({ ...c, value: by[c.slug] || 0 })).filter((c) => c.value > 0);
      const p = sole.period || [];
      const md = (s) => (s ? `${+String(s).slice(5, 7)}월 ${+String(s).slice(8, 10)}일` : '');
      const when = p[0] && p[1] ? `${md(p[0])}~${md(p[1])} ` : '';
      return { points, line: esc(when + '공고 없이 맺은 계약이에요.') };
    }
    if (kind === 'rank') {
      const [idx, fl, rank] = await Promise.all([get('data/index.json'), get('data/flows.json'), get('data/rank.json')]);
      const cities = placed(idx, fl);
      const by = {};
      let miss = 0;
      for (const v of rank.vendors || []) {
        const c = matchCity(v.region, cities);
        if (!c) { miss += Number(v.total) || 0; continue; }
        by[c.slug] = (by[c.slug] || 0) + (Number(v.total) || 0);
      }
      const points = cities.map((c) => ({ ...c, value: by[c.slug] || 0 })).filter((c) => c.value > 0);
      const line = '업체 본사가 있는 시예요.' + (miss > 0 ? ' 군 지역은 이 지도에 없어요.' : '');
      return { points, line: esc(line) };
    }
    if (kind === 'mps') {
      const [idx, fl, mem, sup] = await Promise.all([
        get('data/index.json'), get('data/flows.json'), get('data/national/members.json'), get('data/national/support.json'),
      ]);
      const allowance = (sup.allowance || []).find((x) => x.amount);
      const per = allowance ? Number(allowance.amount) || 0 : 0;
      const counts = {};
      for (const m of mem.members || []) {
        if (m.elect !== '지역구' || !m.region) continue;
        counts[m.region] = (counts[m.region] || 0) + 1;
      }
      const acc = {};
      for (const c of placed(idx, fl)) {
        const key = SHORT[c.province];
        if (!key) continue;
        const g = acc[key] || (acc[key] = { name: key, lat: 0, lng: 0, n: 0 });
        g.lat += c.lat; g.lng += c.lng; g.n += 1;
      }
      const points = Object.entries(counts).map(([name, n]) => {
        const g = acc[name];
        if (!g || !g.n || !per) return null;
        return { name, lat: g.lat / g.n, lng: g.lng / g.n, value: n * per };
      }).filter(Boolean);
      const people = Object.values(counts).reduce((a, n) => a + n, 0);
      // 정부 돈은 국회(여의도)에서 지역으로 나가는 선으로 그린다. 우리 동네 세금 지도와 같은 모양.
      const origin = { name: '국회', lat: 37.5319, lng: 126.914, legend: '국회(여의도)', to: '지역구로 간 돈' };
      return { points, origin, line: esc(`지역구 의원 ${people.toLocaleString('ko-KR')}명에게 1년 주도록 정한 돈을 지역별로 더했어요. 선이 굵을수록 돈이 많아요.`) };
    }
    return { points: [], line: '' };
  }

  function draw(points, line, origin) {
    const note = line || '';
    const box = document.createElement('div');
    box.className = 'tm-map';
    box.setAttribute('role', 'application');
    box.setAttribute('aria-label', '한국 지도. 동그라미가 클수록 돈이 많아요.');
    const head = root.querySelector('.topmap-h');
    if (head) head.after(box); else root.prepend(box);
    const lg = document.createElement('p');
    lg.className = 'maplg';
    lg.setAttribute('aria-label', '지도 범례');
    lg.innerHTML = '<i class="lg-dot"></i>클수록 돈이 많아요';
    box.after(lg);
    const lineEl = say(note);
    if (!window.L || !points.length) {
      if (!window.L) say('지도를 띄우지 못했어요. ' + note);
      return;
    }
    const coarse = matchMedia('(pointer: coarse)').matches;
    const map = L.map(box, {
      zoomControl: false, attributionControl: true, minZoom: 5, maxZoom: 12, zoomSnap: 0.25,
      scrollWheelZoom: false, dragging: true, tap: false,
      maxBounds: [[30.5, 121], [41, 134]],
    });
    map.attributionControl.setPrefix(false);
    if (window.mtZoom) mtZoom(map, box); // 확대·축소는 우리 동네 세금 지도와 똑같이
    else if (!coarse) L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12, attribution: '지도: Esri, HERE, Garmin, © OpenStreetMap 기여자',
    }).addTo(map);
    const korea = L.latLngBounds([[33.05, 125.0], [38.7, 129.65]]);
    let fitted = false;
    const fit = () => {
      if (box.clientWidth < 40 || box.clientHeight < 40) return;
      map.fitBounds(korea, { animate: false, padding: [18, 22] });
      fitted = true;
    };
    fit();
    const max = Math.max(1, ...points.map((p) => p.value));
    const layer = L.layerGroup().addTo(map);
    const markers = [];
    const ordered = points.slice().sort((a, b) => b.value - a.value);
    const OUT = window.mtOut || '#ff9f0a';
    const bend = (a, b) => { // 위경도로 휘는 선 (가까운 곳도 휘어 보이게)
      const dx = b[1] - a[1], dy = b[0] - a[0], d = Math.hypot(dx, dy) || 1, o = d * 0.3, pts = [];
      const c = [(a[0] + b[0]) / 2 + (dx / d) * o, (a[1] + b[1]) / 2 - (dy / d) * o];
      for (let t = 0; t <= 1.0001; t += 1 / 24) { const u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
      return pts;
    };
    const FX = origin && window.mtFX ? mtFX(map, box) : null; // 돈이 흐르는 방향으로 움직이는 빛
    const glow = [];
    ordered.forEach((it, i) => {
      const w = origin ? (window.mtW ? mtW(it.value, max) : 1.5 + 7 * Math.sqrt(it.value / max)) : 0;
      if (origin) {
        const pts = bend([origin.lat, origin.lng], [it.lat, it.lng]);
        L.polyline(pts, { color: OUT, weight: w, opacity: 0.8, lineCap: 'round', interactive: false }).addTo(layer);
        glow.push({ pts, w, col: OUT, n: window.mtFxN ? mtFxN(it.value, max) : 2, d: i * 0.08 });
      }
      const m = L.circleMarker([it.lat, it.lng], origin ? {
        radius: 3 + w / 2.5, weight: 1.5, color: '#fff', fillColor: OUT, fillOpacity: 0.95, className: 'mt-rcv',
      } : {
        radius: 4 + 16 * Math.sqrt(it.value / max),
        weight: 1.5, color: '#fff', fillColor: '#0a84ff', fillOpacity: 0.72,
      });
      m.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        markers.forEach((x) => x.setStyle({ weight: 1.5, color: '#fff' }));
        m.setStyle({ weight: 3, color: '#fff' });
        if (kind === 'tax' && it.slug) location.href = './?c=' + encodeURIComponent(it.slug) + '#map';
        else lineEl.textContent = it.name + ' · ' + won(it.value);
      });
      m.addTo(layer);
      markers.push(m);
      if (i < 8) {
        L.tooltip({ permanent: true, direction: 'right', className: 'klab', offset: [8, 0], interactive: false })
          .setLatLng([it.lat, it.lng]).setContent(esc(it.name)).addTo(layer);
      }
    });
    if (origin) {
      L.circleMarker([origin.lat, origin.lng], { radius: 8, weight: 3, color: '#fff', fillColor: '#0a84ff', fillOpacity: 1, interactive: false }).addTo(layer);
      L.tooltip({ permanent: true, direction: 'left', className: 'klab', offset: [-8, 0], interactive: false })
        .setLatLng([origin.lat, origin.lng]).setContent(esc(origin.name)).addTo(layer);
      if (window.mtLegend) mtLegend(box, [
        { t: 'dot', c: '#0a84ff', l: origin.legend },
        { t: 'ln', c: OUT, l: origin.to },
        { t: 'w', c: OUT, l: '선이 굵을수록 돈이 많아요' },
      ]);
      box.setAttribute('aria-label', '한국 지도. ' + origin.legend + '에서 지역으로 선을 그었어요. 굵을수록 돈이 많아요.');
      if (FX) FX.set(glow);
    }
    map.on('click', () => {
      markers.forEach((x) => x.setStyle({ weight: 1.5, color: '#fff' }));
      lineEl.innerHTML = note;
    });
    const declutter = () => {
      const bounds = map.getContainer().getBoundingClientRect();
      const seen = [];
      map.getContainer().querySelectorAll('.leaflet-control').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 4) seen.push(r);
      });
      const hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      const tips = [...map.getContainer().querySelectorAll('.leaflet-tooltip')];
      tips.forEach((t) => { t.style.visibility = 'visible'; t.style.marginLeft = '0px'; t.style.marginTop = '0px'; });
      tips.forEach((t) => {
        let r = t.getBoundingClientRect();
        const outside = (q) => q.width < 2 || q.left < bounds.left + 2 || q.right > bounds.right - 2 || q.top < bounds.top + 2 || q.bottom > bounds.bottom - 2;
        const clear = (q) => !outside(q) && !seen.some((s) => hit(q, s));
        if (!clear(r)) {
          let ok = false;
          for (const [dx, dy] of [[0, -18], [0, 18], [-36, 0], [8, -28], [8, 28]]) {
            t.style.marginLeft = dx + 'px'; t.style.marginTop = dy + 'px';
            r = t.getBoundingClientRect();
            if (clear(r)) { ok = true; break; }
          }
          if (!ok) { t.style.visibility = 'hidden'; return; }
        }
        seen.push(t.getBoundingClientRect());
      });
    };
    let mode = 'korea';
    const routeLayer = L.layerGroup().addTo(map);
    let flyToken = 0;
    let routeFit = null;
    let routeZoom = 2;
    const se = [37.5319, 126.914];
    const baseHTML = lineEl.innerHTML;
    const headEl = root.querySelector('.topmap-h');
    const baseHead = headEl ? headEl.textContent : '';
    const baseLegend = lg.innerHTML;
    const baseLabel = box.getAttribute('aria-label');
    const arc = (a, b) => {
      const P = [];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[1] - a[1], dy = b[0] - a[0], k = 0.18;
      const c = [mx + dx * k, my - dy * k];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, u = 1 - t;
        P.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
      }
      return P;
    };
    const fitRoutes = (animate) => {
      if (!routeFit) return;
      map.invalidateSize(false);
      map.fitBounds(routeFit, { animate: !!animate, padding: [22, 22], maxZoom: routeZoom });
    };
    const fly = (paths) => {
      const token = ++flyToken;
      if (!paths.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const dot = L.circleMarker(paths[0][0], { radius: 6, weight: 2, color: '#fff', fillColor: '#ffb020', fillOpacity: 1, interactive: false }).addTo(routeLayer);
      let leg = 0;
      const run = () => {
        if (token !== flyToken) return;
        const path = paths[leg];
        const t0 = performance.now();
        const frame = (now) => {
          if (token !== flyToken) return;
          // rAF 시각은 performance.now()보다 조금 앞설 수 있어 0 아래로 내려가지 않게 막는다.
          const u = Math.max(0, Math.min(1, (now - t0) / 1100));
          const f = u * (path.length - 1);
          const i = Math.floor(f);
          const a = path[Math.min(path.length - 1, i)];
          const b = path[Math.min(path.length - 1, i + 1)];
          const k = f - i;
          dot.setLatLng([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
          if (u < 1) requestAnimationFrame(frame);
          else if (leg < paths.length - 1) { leg += 1; run(); }
        };
        requestAnimationFrame(frame);
      };
      run();
    };
    const showRoutes = (pack) => {
      const legs = ((pack && pack.legs) || []).filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lng));
      mode = 'world';
      box.classList.add('tm-person');
      flyToken += 1;
      if (map.hasLayer(layer)) map.removeLayer(layer);
      // setMinZoom/setMaxZoom는 지금 확대 단계를 애니메이션으로 고치는데, 그게 fitBounds 뒤에 끝나면서
      // 지도를 다시 한국으로 되돌렸다. 범위만 바꾸고 화면 이동은 fitBounds 한 번으로 한다.
      map.stop();
      map.options.minZoom = 0;
      map.options.maxZoom = 6;
      map.fire('zoomlevelschange');
      map.setMaxBounds([[-85, -180], [85, 180]]);
      routeLayer.clearLayers();
      lineEl.textContent = (pack && pack.title) || '';
      if (headEl) headEl.textContent = '해외출장 지도';
      if (window.mtLegend) mtLegend(box, [{ t: 'dot', c: '#4da3ff', l: '한국(여의도)' }, { t: 'ln', c: '#ffb020', l: '다녀온 곳' }]);
      else lg.innerHTML = '<i class="lg-ln" style="background:#ffb020"></i>선 = 한국에서 다녀온 곳';
      box.setAttribute('aria-label', '세계 지도. 선은 한국에서 다녀온 곳이에요.');
      L.circleMarker(se, { radius: 7, weight: 2, color: '#fff', fillColor: '#4da3ff', fillOpacity: 1, interactive: false }).addTo(routeLayer)
        .bindTooltip('한국', { permanent: false, direction: 'top', className: 'klab', opacity: 1 });
      const paths = [];
      legs.forEach((leg, i) => {
        const line = arc(se, [leg.lat, leg.lng]);
        L.polyline(line, { color: '#ffb020', weight: 5, opacity: 0.4, interactive: false, lineCap: 'round' }).addTo(routeLayer);
        const flow = L.polyline(line, { color: '#ffe7b8', weight: 3, opacity: 1, dashArray: '8 12', className: 'nmove', interactive: false, lineCap: 'round' }).addTo(routeLayer);
        const el = flow.getElement();
        if (el) el.style.animationDelay = (i * 0.4) + 's';
        L.circleMarker([leg.lat, leg.lng], { radius: 6, weight: 1.5, color: '#1a1408', fillColor: '#ffb020', fillOpacity: 1, interactive: false }).addTo(routeLayer)
          .bindTooltip(esc(leg.name || ''), { permanent: true, direction: 'top', className: 'klab', offset: [0, -4], opacity: 1 });
        paths.push(line);
      });
      routeZoom = paths.length ? 3 : 2;
      routeFit = paths.length ? L.latLngBounds([se, ...legs.map((g) => [g.lat, g.lng])]) : L.latLngBounds([[-55, -170], [72, 180]]);
      fitRoutes(!matchMedia('(prefers-reduced-motion: reduce)').matches);
      fly(paths);
      if (FX) FX.set(paths.map((pts, i) => ({ pts, w: 4, col: '#ffb020', n: 3, d: i * 0.1 })));
      requestAnimationFrame(() => window.dispatchEvent(new Event('mproutes')));
    };
    const resetRoutes = () => {
      flyToken += 1;
      mode = 'korea';
      box.classList.remove('tm-person');
      routeFit = null;
      routeLayer.clearLayers();
      if (!map.hasLayer(layer)) layer.addTo(map);
      lineEl.innerHTML = baseHTML;
      if (FX) FX.set(glow);
      if (headEl) headEl.textContent = baseHead;
      lg.innerHTML = baseLegend;
      box.setAttribute('aria-label', baseLabel);
      map.stop();
      map.options.minZoom = 5;
      map.options.maxZoom = 12;
      map.fire('zoomlevelschange');
      map.setMaxBounds(null);
      map.invalidateSize(false);
      map.fitBounds(korea, { animate: false, padding: [18, 22] });
      map.setMaxBounds([[30.5, 121], [41, 134]]);
    };
    window.__mpRoutes = { show: showRoutes, reset: resetRoutes };
    // 처음으로: 지금 보는 지도(한국 또는 출장 세계 지도)를 처음 모습으로
    if (window.mtHome) {
      const hm = mtHome(map, () => { if (mode === 'world') fitRoutes(!matchMedia('(prefers-reduced-motion: reduce)').matches); else map.fitBounds(korea, { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches, padding: [18, 22] }); }, 'topright');
      map.on('movestart zoomstart', () => hm.mark(false));
      map.on('moveend', () => setTimeout(() => { const b = mode === 'world' ? routeFit : korea; if (b) hm.mark(map.getBounds().pad(0.05).contains(b) && map.getZoom() <= map.getBoundsZoom(b) + 0.3); }, 0));
    }
    if (window.__mpRouteQueue) { const q = window.__mpRouteQueue; window.__mpRouteQueue = null; showRoutes(q); }

    map.on('zoomend moveend resize', () => requestAnimationFrame(declutter));
    let t = 0;
    const inv = () => { clearTimeout(t); t = setTimeout(() => { map.invalidateSize(); if (mode === 'world') fitRoutes(false); else if (!fitted) fit(); declutter(); }, 80); };
    if (window.ResizeObserver) new ResizeObserver(inv).observe(box);
    addEventListener('resize', inv);
    setTimeout(() => { map.invalidateSize(); declutter(); }, 200);
  }

  load().then((pack) => draw(pack.points, pack.line, pack.origin)).catch(() => say('지도를 불러오지 못했어요.'));
})();
