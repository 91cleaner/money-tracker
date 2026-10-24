/* 지도 공통: 홈 지도와 같은 곡선·굵기·범례·휠·처음으로.
   금액은 호출하는 쪽이 이미 있는 자료로 넘긴다. 여기서 숫자를 만들지 않는다. */
(() => {
  const arc = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const o = d < 12 ? Math.max(d * 0.6, 2.5) : Math.min(d * 0.28, 60);
    const mx = (a[0] + b[0]) / 2 - (dy / d) * o, my = (a[1] + b[1]) / 2 + (dx / d) * o, pts = [];
    for (let t = 0; t <= 1.0001; t += 1 / 24) {
      const u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]]);
    }
    return pts;
  };
  const weight = (amount, max) => 1.5 + 7 * Math.sqrt((amount || 0) / (max || 1));
  const legend = (mapEl, parts) => {
    if (!mapEl) return null;
    let p = mapEl.nextElementSibling;
    if (!p || !p.classList.contains('maplg')) {
      p = document.createElement('p');
      p.className = 'maplg';
      p.setAttribute('aria-label', '지도 범례');
      mapEl.after(p);
    }
    const list = parts || [];
    if (!list.length) { p.hidden = true; p.innerHTML = ''; return p; }
    const html = list.map((x) => {
      if (x.t === 'dot') return '<i class="lg-dot" style="background:' + x.c + '"></i>' + x.l;
      if (x.t === 'ln') return '<i class="lg-ln" style="background:' + x.c + '"></i>' + x.l;
      if (x.t === 'w') return '<span class="lg-w"><i style="background:' + (x.c || '#ff9f0a') + '"></i><i style="background:' + (x.c || '#ff9f0a') + '"></i></span>' + x.l;
      if (x.t === 'ring') return '<span class="lg-s"><i class="lg-ring"></i>' + x.l + '</span>';
      return '';
    }).join('');
    p.hidden = false;
    if (p.innerHTML !== html) p.innerHTML = html;
    return p;
  };
  const wheel = (map, box) => {
    if (!map || !box || box.dataset.mtWheel) return;
    box.dataset.mtWheel = '1';
    box.style.touchAction = 'none';
    if (map.touchZoom) map.touchZoom.enable();
    if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
    box.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() + (e.deltaY < 0 ? 0.5 : -0.5));
    }, {passive: false});
    map.on('click', () => map.scrollWheelZoom.enable());
    box.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());
  };
  const home = (map, reset, position) => {
    const ctl = L.control({position: position || 'bottomleft'});
    let el = null;
    ctl.onAdd = () => {
      const w = L.DomUtil.create('div', 'leaflet-control map-home-ctl');
      const b = L.DomUtil.create('button', 'map-home is-home', w);
      b.type = 'button';
      b.innerHTML = '<span aria-hidden="true">⟲</span> 처음으로';
      b.setAttribute('aria-label', '지도를 처음 본 모습으로 되돌리기');
      L.DomEvent.disableClickPropagation(w);
      L.DomEvent.disableScrollPropagation(w);
      L.DomEvent.on(b, 'click', L.DomEvent.stop);
      L.DomEvent.on(b, 'click', () => reset());
      el = b;
      return w;
    };
    ctl.addTo(map);
    return {el: () => el, mark(at) { if (el) el.classList.toggle('is-home', !!at); }};
  };
  // 돈 흐름 빛(우리 동네 세금 지도와 같은 입자). arcs: [{pts: [[lat,lng],...], w, col, n, d}]
  // 선을 따라 출발점 → 도착점 방향으로 빛 알갱이가 흐른다. 지도를 움직이는 동안은 멈춘다.
  const css = () => {
    if (document.getElementById('mt-css')) return;
    const st = document.createElement('style'); st.id = 'mt-css';
    st.textContent = '.mt-fx{position:absolute;left:0;top:0;pointer-events:none}' +
      '.mt-rcv{animation:mtrcv 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}' +
      '@keyframes mtrcv{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.45);opacity:.55}}' +
      '.mt-draw{stroke-dasharray:1;stroke-dashoffset:1;animation:mtdraw 1.3s ease-out forwards}' +
      '@keyframes mtdraw{to{stroke-dashoffset:0}}' +
      '@media (prefers-reduced-motion:reduce){.mt-rcv{animation:none}.mt-draw{animation:none;stroke-dashoffset:0}.mt-fx{display:none}}';
    document.head.append(st);
  };
  const fx = (map, box) => {
    css();
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pane = map.createPane('mtfx'); pane.style.zIndex = 450; pane.style.pointerEvents = 'none';
    const cv = document.createElement('canvas'); cv.className = 'mt-fx'; cv.setAttribute('aria-hidden', 'true'); pane.append(cv);
    const g = cv.getContext('2d'), CAP = matchMedia('(pointer:coarse)').matches ? 40 : 120;
    let A = [], P = [], raf = 0, t0 = 0, moving = false;
    const size = () => { const r = devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight; cv.width = w * r; cv.height = h * r; cv.style.width = w + 'px'; cv.style.height = h + 'px'; g.setTransform(r, 0, 0, r, 0, 0); };
    const at = (pts, u) => { const k = u * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(k)), f = k - i, a = map.latLngToContainerPoint(pts[i]), b = map.latLngToContainerPoint(pts[i + 1]); return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f]; };
    const loop = (ts) => {
      raf = 0; if (!A.length || document.hidden || !map._mapPane) return;
      L.DomUtil.setPosition(cv, map.containerPointToLayerPoint([0, 0])); g.clearRect(0, 0, cv.width, cv.height);
      if (!moving) {
        const el = (ts - t0) / 1000; g.globalCompositeOperation = 'lighter';
        for (const p of P) {
          const a = A[p.a]; if (el < (a.d || 0) * 0.5 + 0.1) continue; p.u += p.s; if (p.u > 1) p.u -= 1;
          const [x, y] = at(a.pts, p.u), r = 1.2 + a.w / 4;
          g.fillStyle = a.col; g.globalAlpha = 0.25; g.beginPath(); g.arc(x, y, r * 2.4, 0, 7); g.fill();
          g.globalAlpha = 0.95; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
      raf = requestAnimationFrame(loop);
    };
    const go = () => { if (!raf && A.length) raf = requestAnimationFrame(loop); };
    map.on('movestart zoomstart', () => { moving = true; g.clearRect(0, 0, cv.width, cv.height); });
    map.on('moveend zoomend', () => { moving = false; });
    map.on('resize', size); document.addEventListener('visibilitychange', go);
    return {
      set(arcs) {
        A = RM ? [] : (arcs || []).filter((a) => a.pts && a.pts.length > 1); P = []; g.clearRect(0, 0, cv.width, cv.height);
        if (!A.length) return; size();
        const tot = A.reduce((s, a) => s + (a.n || 1), 0), k = Math.min(1, CAP / tot);
        A.forEach((a, i) => { const n = Math.max(1, Math.round((a.n || 1) * k)); for (let j = 0; j < n; j++) P.push({a: i, u: j / n + Math.random() * 0.1, s: 0.004 + Math.random() * 0.002}); });
        t0 = performance.now(); go();
      },
    };
  };
  // 알갱이 수: 금액이 클수록 많이 (홈 지도와 같은 식)
  const fxN = (amount, max) => Math.max(1, Math.round(1 + 5 * Math.sqrt((amount || 0) / (max || 1))));
  // 확대·축소·끌기: 홈 지도와 같게 (끌기 켬, 두 손가락 확대, 지도를 누른 뒤 휠, Ctrl+휠, PC 넓은 화면만 +/- 버튼 왼쪽 아래)
  const zoomLike = (map, box) => {
    if (map.dragging) map.dragging.enable();
    if (map.touchZoom) map.touchZoom.enable();
    if (map.doubleClickZoom) map.doubleClickZoom.enable();
    box.style.touchAction = '';
    const touch = matchMedia('(pointer: coarse)').matches;
    if (!touch && innerWidth >= 900) L.control.zoom({position: 'bottomleft'}).addTo(map);
    if (box.dataset.mtWheel) return;
    box.dataset.mtWheel = '1';
    if (map.scrollWheelZoom) map.scrollWheelZoom.disable();
    box.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() + (e.deltaY < 0 ? 0.5 : -0.5)); } }, {passive: false});
    map.on('click', () => map.scrollWheelZoom.enable());
    box.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());
  };
  // 지도 위 아래쪽 카드: 지역을 누르면 지도 위에 바로 결과가 뜬다(아래로 내려가 찾지 않아도 되게)
  const sheet = (box) => {
    css();
    if (!document.getElementById('mt-sheet-css')) {
      const st = document.createElement('style'); st.id = 'mt-sheet-css';
      st.textContent = '.mt-sheet{position:absolute;left:8px;right:8px;bottom:8px;z-index:1000;max-height:58%;overflow:auto;-webkit-overflow-scrolling:touch;' +
        'background:rgba(13,17,23,.96);color:#e8edf2;border:1px solid #2a3541;border-radius:14px;padding:12px 14px 10px;box-shadow:0 8px 24px rgba(0,0,0,.45);font:14px/1.45 Pretendard,system-ui,sans-serif}' +
        '.mt-sheet[hidden]{display:none}.mt-sheet .mt-x{position:sticky;top:0;float:right;margin:-4px -6px 0 8px;min-width:40px;min-height:40px;border:0;border-radius:10px;background:#1b232d;color:#e8edf2;font:700 18px/1 system-ui;cursor:pointer}' +
        '.mt-sheet h4{margin:0 0 2px;font-size:16px;line-height:1.3}.mt-sheet .mt-v{font-size:22px;font-weight:800;color:#ffb020;line-height:1.25}' +
        '.mt-sheet .mt-s{color:#9aa6b2;font-size:12.5px}.mt-sheet ol{margin:8px 0 4px;padding:0;list-style:none;display:grid;gap:4px}' +
        '.mt-sheet li{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.mt-sheet li span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.mt-sheet li b{white-space:nowrap;font-size:13px}.mt-sheet li button{all:unset;cursor:pointer;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e8edf2;text-decoration:underline;text-decoration-color:#4b5866;text-underline-offset:3px}' +
        '.mt-sheet .mt-tk{color:#8fa0b3;font-size:12px;margin-left:4px}.mt-sheet .mt-go{display:block;width:100%;min-height:44px;margin-top:8px;border-radius:10px;border:1px solid #ffb020;background:transparent;color:#ffb020;font:700 14px Pretendard,system-ui,sans-serif;cursor:pointer}';
      document.head.append(st);
    }
    const el = document.createElement('div'); el.className = 'mt-sheet'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite');
    box.append(el);
    if (window.L && L.DomEvent) { L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el); }
    ['touchstart', 'touchmove', 'pointerdown', 'wheel'].forEach((ev) => el.addEventListener(ev, (e) => e.stopPropagation(), {passive: true}));
    const api = {
      show(html) { el.innerHTML = '<button type="button" class="mt-x" aria-label="닫기">×</button>' + html; el.hidden = false; el.scrollTop = 0; el.querySelector('.mt-x').onclick = () => { api.hide(); if (api.onclose) api.onclose(); }; return el; },
      hide() { el.hidden = true; el.innerHTML = ''; },
      el, onclose: null,
    };
    return api;
  };
  window.mtSheet = sheet;
  window.mtFX = fx;
  window.mtFxN = fxN;
  window.mtZoom = zoomLike;
  window.mtCss = css;
  window.mtArc = arc;
  window.mtW = weight;
  window.mtOut = '#ff9f0a';
  window.mtIn = '#0a84ff';
  window.mtLegend = legend;
  window.mtWheel = wheel;
  window.mtHome = home;
})();
