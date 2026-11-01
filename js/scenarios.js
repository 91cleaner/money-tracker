/* 전쟁 시나리오: skysea.html 지도 위에서 날짜별로 재생 (자료: data/scenarios/*.json) */
(() => {
  const box = document.getElementById('scnBox'); if (!box) return;
  const css = `
#scnBox .scn-list{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}#scnBox .scn-list[hidden]{display:none}
#scnBox .scn-list button{min-height:44px;border:1px solid #2e6b4a;border-radius:10px;background:#04140b;color:#e8fff0;font:600 14px system-ui,sans-serif;text-align:left;padding:6px 10px}
#scnBox .scn-list small{display:block;opacity:.65;font-weight:400;font-size:11px}
#scnP{position:fixed;top:0;right:0;width:var(--sw);height:100dvh;z-index:3500;padding:8px;box-sizing:border-box}#scnP[hidden]{display:none}
#scnP .in{background:#04140b;border:1px solid #2e6b4a;border-radius:16px;padding:14px;height:100%;overflow:auto;position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:10px}
#scnP .x{position:absolute;z-index:2;top:10px;right:10px;min-width:72px;height:52px;border-radius:12px;border:1px solid #ff8a8a;background:#3a0d0d;color:#fff;font-size:18px;font-weight:800}
#scnP .tt{font-size:18px;font-weight:800;margin-right:86px;color:#9effc0}#scnP .pp{font-size:12px;opacity:.7}
#scnP .dt{font-size:34px;white-space:nowrap;font-weight:800;line-height:1.05;color:#fff;font-variant-numeric:tabular-nums}
#scnP .cap{font-size:17px;line-height:1.4;min-height:48px}
#scnP .ctl{display:flex;gap:8px;align-items:center}#scnP .ctl button{min-width:52px;height:48px;border-radius:12px;border:1px solid #2e6b4a;background:#0b2a19;color:#e8fff0;font-size:16px;font-weight:800}
#scnP .ctl .play{flex:1;background:#5dff9e;color:#02110a;border-color:#5dff9e}
#scnP input[type=range]{width:100%;height:32px;accent-color:#5dff9e}
#scnP .lg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:13px}#scnP .lg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}
#scnP .nt{font-size:12px;opacity:.75}#scnP details{font-size:13px;opacity:.9}#scnP details p{margin:6px 0}#scnP details li{margin:2px 0}
.scn-on .leaflet-overlay-pane,.scn-on .leaflet-marker-pane,.scn-on .leaflet-shadow-pane,.scn-on .leaflet-tooltip-pane,.scn-on .leaflet-popup-pane{visibility:hidden}.scn-on #card{display:none}
.scn-arr{stroke-dasharray:10 8;animation:scnDash 1s linear infinite}@keyframes scnDash{to{stroke-dashoffset:-18}}
.scn-bt{animation:scnPop .6s ease-out}@keyframes scnPop{from{opacity:0}to{opacity:1}}
.scn-lab{background:#000c;border:1px solid #fff5;color:#fff;font:600 12px system-ui,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-150%)}
.scn-head{width:0;height:0}
@media (max-width:760px) and (orientation:portrait){#scnP{top:auto;bottom:0;left:0;width:auto;height:46dvh;padding:0}#scnP .in{border-radius:16px 16px 0 0;gap:6px;padding:10px 12px}#scnP .dt{font-size:30px}#scnP .cap{font-size:15px;min-height:0}}
@media (orientation:landscape) and (max-height:500px){#scnP .in{gap:5px;padding:10px}#scnP .dt{font-size:26px}#scnP .cap{font-size:14px;min-height:0}#scnP .ctl button{height:40px}#scnP .x{height:44px}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  box.innerHTML = '<button type="button" class="btn prime" id="scnOpen" style="width:100%;min-height:44px">전쟁 시나리오<span style="display:block;font-weight:400;font-size:11px;opacity:.75">눌러 보세요</span></button><div class="scn-list" id="scnList" hidden></div>';
  const P = document.createElement('div'); P.id = 'scnP'; P.hidden = true;
  P.innerHTML = '<div class="in"><button type="button" class="x" id="scnX" aria-label="시나리오 닫기">닫기</button><div><div class="tt" id="scnT"></div><div class="pp" id="scnPer"></div></div><div class="dt" id="scnD"></div><div class="cap" id="scnC"></div><div class="ctl"><button type="button" id="scnPrev" aria-label="이전">이전</button><button type="button" class="play" id="scnPlay">재생</button><button type="button" id="scnNext" aria-label="다음">다음</button></div><input type="range" id="scnR" min="0" max="0" step="1" aria-label="날짜 이동"><div class="lg" id="scnL"></div><div class="nt" id="scnN"></div><details><summary>자세히 보기</summary><p id="scnM"></p><p><b>출처</b></p><ul id="scnS"></ul><p class="nt">화살표와 전선은 이해를 돕기 위한 대략적인 그림이에요. 지도: Esri, Maxar 위성 사진, 나라 경계 Natural Earth.</p></details></div>';
  document.body.append(P);
  const $ = (id) => document.getElementById(id);
  let idx = [], W = null, geo = null, map = null, lay = null, i = 0, timer = null, saved = null;
  const D = (s) => { const [y, m, d] = s.split('-'); return `${y}년 ${+m}월 ${+d}일`; };
  const getMap = () => map || (map = window.mtMap) ;
  fetch('data/scenarios/index.json').then((r) => r.json()).then((j) => { idx = j;
    $('scnList').innerHTML = j.map((w) => `<button type="button" data-id="${w.id}">${w.title}<small>${w.period}</small></button>`).join('');
    $('scnList').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => open(b.dataset.id))); }).catch(() => { $('scnList').textContent = '시나리오를 불러오지 못했어요'; });
  $('scnOpen').addEventListener('click', () => { $('scnList').hidden = !$('scnList').hidden; });
  const loadGeo = () => geo ? Promise.resolve(geo) : fetch('data/national/countries-110m.geojson', { cache: 'force-cache' }).then((r) => r.json()).then((g) => { g.features.forEach((f) => { const p = f.properties; const c = p.ISO_A2 !== '-99' ? p.ISO_A2 : p.ISO_A2_EH; f.cc = c === 'CN-TW' ? 'TW' : c; }); return (geo = g); });
  function open(id) {
    const m = getMap(); if (!m) return;
    Promise.all([fetch('data/scenarios/' + id + '.json').then((r) => r.json()), loadGeo().catch(() => null)]).then(([w]) => {
      W = w; if (!saved) saved = { c: m.getCenter(), z: m.getZoom() };
      ['scnA', 'scnF', 'scnM2', 'scnT2'].forEach((n, k) => { if (!m.getPane(n)) { const p = m.createPane(n); p.style.zIndex = [350, 450, 620, 660][k]; if (k === 3) p.style.pointerEvents = 'none'; } });
      document.body.classList.add('scn-on'); P.hidden = false;
      $('scnT').textContent = w.title; $('scnPer').textContent = w.period + ' · ' + w.frames.length + '개 장면';
      $('scnL').innerHTML = Object.values(w.sides).map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('');
      $('scnN').textContent = w.note || ''; $('scnS').innerHTML = w.sources.map((s) => `<li>${s}</li>`).join('');
      $('scnR').max = w.frames.length - 1; m.flyToBounds(w.view, { duration: 1.2, padding: [10, 10] });
      show(0); play(true);
    });
  }
  function ccAt(fi) { const o = {}; for (let k = 0; k <= fi; k++) Object.entries(W.frames[k].cc || {}).forEach(([c, s]) => { if (s) o[c] = s; else delete o[c]; }); return o; }
  function viewAt(fi) { for (let k = fi; k >= 0; k--) if (W.frames[k].v) return W.frames[k].v; return W.view; }
  function arrow(a, b, col, g) {
    const n = 16, pts = [], dx = b[1] - a[1], dy = b[0] - a[0], bend = 0.18;
    for (let k = 0; k <= n; k++) { const t = k / n, o = Math.sin(Math.PI * t) * bend; pts.push([a[0] + dy * t + dx * o, a[1] + dx * t - dy * o]); }
    L.polyline(pts, { pane: 'scnM2', color: '#000', weight: 7, opacity: .45, interactive: false }).addTo(g);
    L.polyline(pts, { pane: 'scnM2', color: col, weight: 4, className: 'scn-arr', interactive: false }).addTo(g);
    const m = getMap(), p1 = m.latLngToLayerPoint(pts[n - 2]), p2 = m.latLngToLayerPoint(pts[n]); const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
    L.marker(b, { pane: 'scnM2', interactive: false, icon: L.divIcon({ className: 'scn-head', html: `<svg width="22" height="22" viewBox="-11 -11 22 22" style="transform:translate(-11px,-11px) rotate(${ang}deg);overflow:visible"><path d="M10 0 L-6 -7 L-3 0 L-6 7Z" fill="${col}" stroke="#000" stroke-width="1"/></svg>` }) }).addTo(g);
    const dot = L.circleMarker(pts[0], { pane: 'scnM2', radius: 5, color: '#fff', weight: 1.5, fillColor: col, fillOpacity: 1, interactive: false }).addTo(g);
    let t0 = performance.now(); const step = (t) => { if (!g._map) return; const k = (Math.max(0, t - t0) % 1800) / 1800, j = Math.min(n - 1, Math.floor(k * n)), f = k * n - j; dot.setLatLng([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]); requestAnimationFrame(step); }; requestAnimationFrame(step);
  }
  function show(fi) {
    const m = getMap(); i = Math.max(0, Math.min(W.frames.length - 1, fi)); const f = W.frames[i], col = (s) => (W.sides[s] || ['', '#ccc'])[1];
    if (lay) m.removeLayer(lay); lay = L.layerGroup().addTo(m);
    if (geo) { const cc = ccAt(i); L.geoJSON({ type: 'FeatureCollection', features: geo.features.filter((g) => cc[g.cc]) }, { pane: 'scnA', interactive: false, style: (g) => ({ color: col(cc[g.cc]), weight: 1, fillColor: col(cc[g.cc]), fillOpacity: .28 }) }).addTo(lay); }
    (f.area || []).forEach(([s, pts]) => L.polygon(pts, { pane: 'scnF', color: col(s), weight: 2, dashArray: '4 4', fillColor: col(s), fillOpacity: .35, interactive: false }).addTo(lay));
    (f.front || []).forEach((ln) => { L.polyline(ln, { pane: 'scnF', color: '#000', weight: 7, opacity: .5, interactive: false }).addTo(lay); L.polyline(ln, { pane: 'scnF', color: '#fff', weight: 3, dashArray: '2 6', lineCap: 'round', interactive: false }).addTo(lay);
      const mid = ln[Math.floor(ln.length / 2)]; L.marker(mid, { pane: 'scnT2', interactive: false, icon: L.divIcon({ className: '', html: '<div class="scn-lab" style="opacity:.8">전선 (대략)</div>' }) }).addTo(lay); });
    (f.ar || []).forEach(([a, b, c, d, s]) => arrow([a, b], [c, d], col(s), lay));
    (f.bt || []).forEach(([la, lo, n]) => { L.circleMarker([la, lo], { pane: 'scnM2', radius: 9, color: '#fff', weight: 2, fillColor: '#ff9f1c', fillOpacity: .9, className: 'scn-bt', interactive: false }).addTo(lay);
      L.marker([la, lo], { pane: 'scnT2', interactive: false, icon: L.divIcon({ className: '', html: `<div class="scn-lab">${n}</div>` }) }).addTo(lay); });
    $('scnD').textContent = D(f.d); $('scnC').textContent = f.t; $('scnM').textContent = f.more || '이 장면의 추가 설명은 없어요.'; $('scnR').value = i;
    const v = viewAt(i); if (f.v || (i > 0 && viewAt(i - 1) !== v)) m.flyToBounds(v, { duration: 1.2, padding: [10, 10] });
  }
  function stop() { clearInterval(timer); timer = null; $('scnPlay').textContent = '재생'; }
  function play(on) { if (!on || timer) { stop(); return; } $('scnPlay').textContent = '멈춤'; if (i >= W.frames.length - 1) show(0); timer = setInterval(() => { if (i >= W.frames.length - 1) stop(); else show(i + 1); }, 3200); }
  function close() { stop(); const m = getMap(); if (lay) m.removeLayer(lay); lay = null; W = null; P.hidden = true; document.body.classList.remove('scn-on'); if (saved) { m.flyTo(saved.c, saved.z, { duration: .8 }); saved = null; } }
  $('scnPlay').addEventListener('click', () => play(!timer)); $('scnX').addEventListener('click', close);
  $('scnPrev').addEventListener('click', () => { stop(); show(i - 1); }); $('scnNext').addEventListener('click', () => { stop(); show(i + 1); });
  $('scnR').addEventListener('input', (e) => { stop(); show(+e.target.value); });
  document.addEventListener('keydown', (e) => { if (W && e.key === 'Escape') close(); });
})();
