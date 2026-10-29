/* 강서구청에서 계약 상대의 시·군·구 중심까지. 업체 이름·번지·사람 이름은 그리지 않는다. */
(() => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const krw = (n) => {
    if (n == null || isNaN(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e8) return (a / 1e8 >= 100 ? Math.round(a / 1e8).toLocaleString('ko-KR') : (a / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원';
    if (a >= 1e4) return Math.round(a / 1e4).toLocaleString('ko-KR') + '만원';
    return a.toLocaleString('ko-KR') + '원';
  };
  const $ = (id) => document.getElementById(id);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arc = (a, b, sign) => {
    const dx = b[1] - a[1], dy = b[0] - a[0], d = Math.hypot(dx, dy) || 1e-9;
    const o = (d < 0.18 ? Math.max(d * 0.55, 0.02) : Math.min(d * 0.2, 0.5)) * sign;
    const mx = (a[1] + b[1]) / 2 - (dy / d) * o, my = (a[0] + b[0]) / 2 + (dx / d) * o, pts = [];
    for (let t = 0; t <= 1.0001; t += 1 / 28) {
      const u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * my + t * t * b[0], u * u * a[1] + 2 * u * t * mx + t * t * b[1]]);
    }
    return pts;
  };
  const weight = (amount, max) => (window.mtW ? mtW(amount, max) : 1.5 + 7 * Math.sqrt((amount || 0) / (max || 1)));

  const say = (title, sub) => {
    $('title').textContent = title;
    $('total').textContent = '';
    $('sub').textContent = sub || '';
    const note = $('note'); if (note) note.textContent = '';
  };

  const draw = (data) => {
    const box = $('map');
    const origin = data.origin;
    const flows = (data.flows || []).filter((f) => f && f.region && f.amount > 0 && f.lat != null && f.lng != null);
    $('title').textContent = data.title;
    $('total').textContent = krw(data.total);
    $('sub').textContent = '계약 ' + Number(data.contracts || 0).toLocaleString('ko-KR') + '건 · ' + origin.name + '에서 소재 시·군·구로';
    const note = $('note');
    if (note) note.textContent = data.unmapped > 0 ? '소재 시·군·구가 자료에 없는 ' + krw(data.unmapped) + '은 선으로 그리지 않았습니다.' : '';
    $('src').textContent = '출처: 조달청 나라장터 공개 계약. 공동도급은 지분이 확인된 것만 지분대로 시·군·구에 합산했습니다.';
    box.setAttribute('aria-label', data.title + ', 합계 ' + krw(data.total) + '. 주황 선은 ' + origin.name + '에서 소재 시·군·구까지입니다.');

    const map = L.map(box, {
      zoomControl: false, attributionControl: true, minZoom: 6, maxZoom: 14, zoomSnap: 0.25,
      scrollWheelZoom: false, tap: true, touchZoom: true, dragging: true,
      maxBounds: [[31.2, 123.2], [39.6, 131.6]],
    });
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 14, attribution: '지도: Esri, HERE, Garmin, © OpenStreetMap 기여자',
    }).addTo(map);
    L.control.zoom({position: 'bottomleft'}).addTo(map);
    if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
    box.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() + (e.deltaY < 0 ? 0.5 : -0.5));
    }, {passive: false});
    map.on('click', () => map.scrollWheelZoom.enable());
    box.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

    const max = Math.max(1, ...flows.map((f) => f.amount));
    const lines = L.layerGroup().addTo(map);
    const dots = L.layerGroup().addTo(map);
    const from = [origin.lat, origin.lng];
    const tips = [];
    flows.slice().sort((a, b) => a.amount - b.amount).forEach((f, i) => {
      const sign = i % 2 ? 1 : -1;
      const pts = arc(from, [f.lat, f.lng], sign);
      f.pts = pts;
      L.polyline(pts, {
        color: '#ff9f0a', weight: weight(f.amount, max), opacity: 0.92,
        lineCap: 'round', lineJoin: 'round', interactive: false,
      }).addTo(lines);
      const mk = L.circleMarker([f.lat, f.lng], {
        radius: 4.5, color: '#fff', weight: 1.25, fillColor: '#ff9f0a', fillOpacity: 0.95, interactive: false,
      }).addTo(dots);
      mk.bindTooltip('<span class="nm">' + esc(f.region) + '</span><span class="am">' + esc(krw(f.amount)) + '</span>', {
        permanent: true, direction: f.lat < 36.5 ? 'top' : 'right', offset: [8, 0],
        className: 'if-lab', opacity: 1, interactive: false,
      });
      tips.push({el: () => mk.getTooltip() && mk.getTooltip().getElement(), amount: f.amount, marker: mk});
    });
    const org = L.circleMarker(from, {
      radius: 7, color: '#fff', weight: 2, fillColor: '#ffd60a', fillOpacity: 1, interactive: false,
    }).addTo(dots);
    org.bindTooltip('<span class="nm">' + esc(origin.name) + '</span>', {
      permanent: true, direction: 'left', offset: [-8, 0], className: 'if-lab org', opacity: 1, interactive: false,
    });
    tips.push({el: () => org.getTooltip() && org.getTooltip().getElement(), amount: Infinity, marker: org, pin: true});

    if (window.mtLegend) {
      mtLegend(box, [
        {t: 'dot', c: '#ffd60a', l: origin.name},
        {t: 'ln', c: '#ff9f0a', l: '시·군·구로 간 계약금액'},
        {t: 'w', c: '#ff9f0a', l: '선이 굵을수록 금액이 큼'},
      ]);
    }
    const regs = $('regs');
    flows.slice().sort((a, b) => b.amount - a.amount).forEach((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      const name = document.createElement('span');
      name.textContent = f.region;
      const sum = document.createElement('b');
      sum.textContent = krw(f.amount);
      b.append(name, sum);
      b.addEventListener('click', () => {
        map.flyTo([f.lat, f.lng], Math.max(map.getZoom(), 11), {duration: RM ? 0 : 0.55});
      });
      regs.append(b);
    });

    const bounds = L.latLngBounds(flows.map((f) => [f.lat, f.lng]).concat([from]));
    const pad = () => innerWidth < 500 ? [30, 26] : [42, 40];
    let homeCenter = null, homeZoom = null;
    const fit = (animate) => {
      map.invalidateSize(false);
      map.fitBounds(bounds, {padding: pad(), animate: !!animate && !RM, maxZoom: 8});
    };
    const atHome = () => homeZoom != null && Math.abs(map.getZoom() - homeZoom) < 0.2 && map.getCenter().distanceTo(homeCenter) < 1200;
    const home = window.mtHome ? mtHome(map, () => { fit(true); home.mark(true); }, 'bottomleft') : null;

    const hit = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const declutter = () => {
      if (!map._loaded) return;
      const boxR = box.getBoundingClientRect();
      const seen = [];
      box.querySelectorAll('.leaflet-control, .map-home').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 2) seen.push({left: r.left - 4, right: r.right + 4, top: r.top - 4, bottom: r.bottom + 4});
      });
      const zoomed = homeZoom != null && map.getZoom() >= homeZoom + 1.15;
      const ranked = tips.slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.amount - a.amount);
      ranked.forEach((t, rank) => {
        const el = t.el();
        if (!el) return;
        const keep = t.pin || rank < (zoomed ? 12 : 5);
        const tries = [[0, 0], [0, -28], [0, 26], [18, -8], [-16, 10], [0, -52], [0, 48], [36, -30], [-36, 24], [0, -76], [64, -8], [-72, 6]];
        if (keep) tries.push([0, -100], [88, -16], [-96, 12], [24, -64], [-20, 70]);
        el.style.visibility = 'visible';
        let placed = null;
        for (const [dx, dy] of tries) {
          el.style.marginLeft = dx + 'px';
          el.style.marginTop = dy + 'px';
          const r = el.getBoundingClientRect();
          const inside = r.width > 2 && r.left >= boxR.left + 2 && r.right <= boxR.right - 2 && r.top >= boxR.top + 2 && r.bottom <= boxR.bottom - 2;
          if (inside && !seen.some((s) => hit(r, s))) { placed = r; break; }
        }
        if (!placed && !keep) { el.style.visibility = 'hidden'; return; }
        if (!placed) {
          el.style.marginLeft = '0px';
          el.style.marginTop = '0px';
          placed = el.getBoundingClientRect();
        }
        seen.push({left: placed.left - 3, right: placed.right + 3, top: placed.top - 3, bottom: placed.bottom + 3});
      });
    };

    fit(false);
    homeCenter = map.getCenter();
    homeZoom = map.getZoom();
    if (home) home.mark(true);
    map.on('zoomstart dragstart', () => { if (home) home.mark(false); });
    map.on('moveend zoomend resize', () => { if (home) home.mark(atHome()); declutter(); });
    if (window.mtFX && window.mtFxN) {
      const fx = mtFX(map, box);
      fx.set(flows.map((f, i) => ({pts: f.pts, w: weight(f.amount, max), col: '#ff9f0a', n: mtFxN(f.amount, max), d: (i % 5) * 0.15})));
    }
    const kick = () => { map.invalidateSize(false); declutter(); };
    requestAnimationFrame(kick);
    setTimeout(kick, 60);
    setTimeout(kick, 400);
    if (window.ResizeObserver) new ResizeObserver(() => { map.invalidateSize(false); declutter(); }).observe(box);
    addEventListener('resize', kick);
  };

  const params = new URLSearchParams(location.search);
  fetch('data/focus/gangseo-sincheongsa.json?v=202610291800').then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }).then((data) => {
    const inst = params.get('inst'), q = params.get('q');
    if ((inst && inst !== data.inst) || (q && q !== data.q)) {
      say('이 주소의 자료가 없습니다', '서울특별시 강서구, 제목에 신청사가 있는 계약만 그려 두었습니다.');
      return;
    }
    if (!window.L) { say(data.title, '지도를 불러오지 못했습니다.'); return; }
    draw(data);
  }).catch(() => say('자료를 불러오지 못했습니다', '잠시 후 다시 열어 주세요.'));
})();
