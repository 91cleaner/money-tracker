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
  window.mtArc = arc;
  window.mtW = weight;
  window.mtOut = '#ff9f0a';
  window.mtIn = '#0a84ff';
  window.mtLegend = legend;
  window.mtWheel = wheel;
  window.mtHome = home;
})();
