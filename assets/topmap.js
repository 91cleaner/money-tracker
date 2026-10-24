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
      return { points, line: esc(`지역구 의원 ${people.toLocaleString('ko-KR')}명에게 1년 주도록 정한 돈을 지역별로 더했어요.`) };
    }
    return { points: [], line: '' };
  }

  function draw(points, line) {
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
      scrollWheelZoom: false, dragging: !coarse, tap: true,
      maxBounds: [[30.5, 121], [41, 134]],
    });
    map.attributionControl.setPrefix(false);
    if (!coarse) L.control.zoom({ position: 'topleft' }).addTo(map);
    else {
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      box.style.touchAction = 'pan-y';
    }
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
    ordered.forEach((it, i) => {
      const m = L.circleMarker([it.lat, it.lng], {
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
    map.on('zoomend moveend resize', () => requestAnimationFrame(declutter));
    let t = 0;
    const inv = () => { clearTimeout(t); t = setTimeout(() => { map.invalidateSize(); if (!fitted) fit(); declutter(); }, 80); };
    if (window.ResizeObserver) new ResizeObserver(inv).observe(box);
    addEventListener('resize', inv);
    setTimeout(() => { map.invalidateSize(); declutter(); }, 200);
  }

  load().then((pack) => draw(pack.points, pack.line)).catch(() => say('지도를 불러오지 못했어요.'));
})();
