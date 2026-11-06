/* 세계 역사 사건: skysea.html 지도 위에서 단계별 재생 (자료: data/worldhist/*.json, 한국사는 넣지 않음) */
(() => {
  const box = document.getElementById('hisBox'); if (!box) return;
  const css = `
#hisBox{margin-top:8px}#hisBox .hint{font-size:12px;opacity:.7;margin-top:3px;text-align:center}
#hisList[hidden],#warList[hidden]{display:none}#warList .gr{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px}#warList .gw{grid-template-columns:1fr 1fr}#warList button{min-height:44px;border:1px solid #2e6b4a;border-radius:10px;background:#04140b;color:#e8fff0;font:600 14px system-ui,sans-serif;text-align:left;padding:6px 10px}#warList button.on{background:#5dff9e;color:#02110a}#warList button:disabled{opacity:.4}#warList small{display:block;opacity:.65;font-weight:400;font-size:11px}.his-tz{animation:hisTz 1.2s ease-out}@keyframes hisTz{from{fill-opacity:0}}#hisP .fs a{color:#9effc0;font-size:12px;word-break:break-all}#hisList .rg{font-size:12px;opacity:.7;margin:10px 0 4px}
#hisList .gr{display:grid;grid-template-columns:1fr 1fr;gap:6px}
#hisList button{min-height:44px;border:1px solid #2e6b4a;border-radius:10px;background:#04140b;color:#e8fff0;font:600 14px system-ui,sans-serif;text-align:left;padding:6px 10px}
#hisList small{display:block;opacity:.65;font-weight:400;font-size:11px}
#hisP{position:fixed;top:0;right:0;width:var(--sw);height:100dvh;z-index:3500;padding:8px;box-sizing:border-box}#hisP[hidden]{display:none}
#hisP .in{background:#04140b;border:1px solid #2e6b4a;border-radius:16px;padding:14px;height:100%;overflow:auto;position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;color:#e8fff0}
#hisP .x{position:absolute;z-index:2;top:10px;right:10px;min-width:72px;height:52px;border-radius:12px;border:1px solid #ff8a8a;background:#3a0d0d;color:#fff;font-size:18px;font-weight:800}
#hisP .tt{font-size:18px;font-weight:800;margin-right:86px;color:#9effc0}#hisP .pp{font-size:12px;opacity:.7}
#hisP .dt{font-size:32px;font-weight:800;line-height:1.05;color:#fff;font-variant-numeric:tabular-nums}#hisP .tm{font-size:15px;opacity:.8;font-weight:600}
#hisP .cap{font-size:17px;line-height:1.4;min-height:48px}
#hisP .ctl{display:flex;gap:8px;align-items:center}#hisP .ctl button{min-width:52px;height:48px;border-radius:12px;border:1px solid #2e6b4a;background:#0b2a19;color:#e8fff0;font-size:16px;font-weight:800}
#hisP .ctl .play{flex:1;background:#5dff9e;color:#02110a;border-color:#5dff9e}
#hisP input[type=range]{width:100%;height:32px;accent-color:#5dff9e}
#hisP .lg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:13px}#hisP .lg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-1px}
#hisP .nt{font-size:12px;opacity:.75}#hisP details{font-size:13px;opacity:.9}#hisP details p{margin:6px 0}#hisP details li{margin:3px 0}#hisP details a{color:#9effc0;word-break:break-all}
.his-on .leaflet-overlay-pane,.his-on .leaflet-marker-pane,.his-on .leaflet-shadow-pane,.his-on .leaflet-tooltip-pane,.his-on .leaflet-popup-pane{visibility:hidden}.his-on #card{display:none}
.his-arr{stroke-dasharray:14 10;animation:hisDash .8s linear infinite}@keyframes hisDash{to{stroke-dashoffset:-24}}
.his-cr{animation:hisPulse 2s ease-in-out infinite}@keyframes hisPulse{50%{fill-opacity:.15}}
.his-lab{background:#000c;border:1px solid #fff5;color:#fff;font:600 12px system-ui,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-150%)}
.his-head{width:0;height:0}
@media (max-width:760px) and (orientation:portrait){#hisP{top:auto;bottom:0;left:0;width:auto;height:46dvh;padding:0}#hisP .in{border-radius:16px 16px 0 0;gap:6px;padding:10px 12px}#hisP .dt{font-size:28px}#hisP .cap{font-size:15px;min-height:0}}
@media (orientation:landscape) and (max-height:500px){#hisP .in{gap:5px;padding:10px}#hisP .dt{font-size:24px}#hisP .cap{font-size:14px;min-height:0}#hisP .ctl button{height:40px}#hisP .x{height:44px}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  box.innerHTML = '<button type="button" class="btn prime" id="hisOpen" style="width:100%;min-height:44px">세계 역사 사건<span style="display:block;font-weight:400;font-size:11px;opacity:.75">눌러 보세요</span></button><div id="hisList" hidden></div>';
  const P = document.createElement('div'); P.id = 'hisP'; P.hidden = true;
  P.innerHTML = '<div class="in"><button type="button" class="x" id="hisX" aria-label="닫기">닫기</button><div><div class="tt" id="hisT"></div><div class="pp" id="hisPer"></div></div><div><div class="dt" id="hisD"></div><div class="tm" id="hisTm"></div></div><div class="cap" id="hisC"></div><div class="fs" id="hisFS"></div><div id="hisPh" hidden></div><div class="ctl"><button type="button" id="hisPrev">이전</button><button type="button" class="play" id="hisPlay">재생</button><button type="button" id="hisNext">다음</button></div><input type="range" id="hisR" min="0" max="0" step="1" aria-label="단계 이동"><div class="lg" id="hisL"></div><details><summary>자세히 보기</summary><p id="hisM"></p><p id="hisTo"></p><p><b>출처</b></p><ul id="hisS"></ul><p><b>사진</b></p><ul id="hisPS"></ul><p class="nt" id="hisN"></p><p class="nt">원, 화살표, 장소 표시는 이해를 돕기 위한 대략적인 그림이에요. 노란 점선 원은 넓이가 숫자에 비례해요(아주 큰 수는 크기를 줄였어요).</p></details></div>';
  document.body.append(P);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let W = null, lay = null, i = 0, timer = null, saved = null, raf = [];
  const D = (s) => { const [y, m, d] = s.split('-'); return `${y}년 ${+m}월 ${+d}일`; };
  const getMap = () => window.mtMap;
  const REG = ['미국', '중국', '일본', '아시아', '유럽', '중동·아프리카', '세계'];
  fetch('data/worldhist/index.json').then((r) => r.json()).then((j) => {
    $('hisList').innerHTML = REG.map((g) => { const e = j.filter((x) => x.reg === g); return e.length ? `<div class="rg">${g}</div><div class="gr">${e.map((w) => `<button type="button" data-id="${w.id}">${esc(w.title)}<small>${esc(w.period)}</small></button>`).join('')}</div>` : ''; }).join('');
    $('hisList').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => open(b.dataset.id)));
  }).catch(() => { $('hisList').textContent = '불러오지 못했어요'; });
  $('hisOpen').addEventListener('click', () => { $('hisList').hidden = !$('hisList').hidden; });
  function open(id) {
    const m = getMap(); if (!m) return;
    fetch('data/worldhist/' + id + '.json').then((r) => r.json()).then((w) => {
      if (W) clear(); W = w; if (!saved) saved = { c: m.getCenter(), z: m.getZoom() };
      ['hisF', 'hisM2', 'hisT2'].forEach((n, k) => { if (!m.getPane(n)) { const p = m.createPane(n); p.style.zIndex = [450, 620, 660][k]; p.style.pointerEvents = 'none'; } });
      document.body.classList.add('his-on'); P.hidden = false;
      $('hisT').textContent = w.title; $('hisPer').textContent = w.period + ' · ' + w.frames.length + '단계';
      $('hisL').innerHTML = Object.values(w.sides).map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('');
      $('hisN').textContent = w.note || ''; $('hisTo').textContent = w.toll ? '피해: ' + w.toll : '';
      $('hisS').innerHTML = w.sources.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join('');
      HFX.credits($('hisPS'), 'his:' + id); $('hisR').max = w.frames.length - 1; m.flyToBounds(w.view, { duration: 1.2, padding: [10, 10] });
      show(0); play(true);
    });
  }
  function viewAt(fi) { for (let k = fi; k >= 0; k--) if (W.frames[k].v) return W.frames[k].v; return W.view; }
  const anim = (fn) => { let on = true; const s = (t) => { if (!on) return; fn(t); requestAnimationFrame(s); }; requestAnimationFrame(s); raf.push(() => { on = false; }); };
  function arrow(a, b, col, g) {
    const n = 16, pts = [], dx = b[1] - a[1], dy = b[0] - a[0], bend = 0.15;
    for (let k = 0; k <= n; k++) { const t = k / n, o = Math.sin(Math.PI * t) * bend; pts.push([a[0] + dy * t + dx * o, a[1] + dx * t - dy * o]); }
    L.polyline(pts, { pane: 'hisM2', color: '#000', weight: 11, opacity: .45, interactive: false }).addTo(g);
    L.polyline(pts, { pane: 'hisM2', color: col, weight: 7, className: 'his-arr', interactive: false }).addTo(g);
    const m = getMap(), p1 = m.latLngToLayerPoint(pts[n - 2]), p2 = m.latLngToLayerPoint(pts[n]); const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
    L.marker(b, { pane: 'hisM2', interactive: false, icon: L.divIcon({ className: 'his-head', html: `<svg width="32" height="32" viewBox="-11 -11 22 22" style="transform:translate(-16px,-16px) rotate(${ang}deg);overflow:visible"><path d="M10 0 L-6 -7 L-3 0 L-6 7Z" fill="${col}" stroke="#000" stroke-width="1"/></svg>` }) }).addTo(g);
    const dot = L.circleMarker(pts[0], { pane: 'hisM2', radius: 7, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1, interactive: false }).addTo(g);
    const t0 = performance.now(); anim((t) => { const k = (Math.max(0, t - t0) % 1800) / 1800, j = Math.min(n - 1, Math.floor(k * n)), f = k * n - j; dot.setLatLng([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]); });
  }
  function crowd(la, lo, km, col, g) {
    const v = viewAt(i), cs = Math.cos(la * Math.PI / 180), vw = Math.max(Math.abs(v[1][1] - v[0][1]) * 111000 * cs, getMap().getSize().x * 152.9 * cs), R = Math.max(km * 1000, vw * .05), c = L.circle([la, lo], { pane: 'hisF', radius: R * .3, color: col, weight: 2, fillColor: col, fillOpacity: .4, className: 'his-cr', interactive: false }).addTo(g);
    const t0 = performance.now(); anim((t) => { const k = Math.min(1, (t - t0) / 1800); c.setRadius(R * (.3 + .7 * (1 - Math.pow(1 - k, 3)))); });
  }
  function clear() { raf.forEach((f) => f()); raf = []; const m = getMap(); if (lay && m) m.removeLayer(lay); lay = null; }
  function show(fi) {
    const m = getMap(); i = Math.max(0, Math.min(W.frames.length - 1, fi)); const f = W.frames[i], col = (s) => (W.sides[s] || ['', '#ccc'])[1];
    clear(); lay = L.layerGroup().addTo(m);
    (f.tz || []).forEach(([pts, s]) => L.polygon(pts, { pane: 'hisF', color: col(s), weight: 2, fillColor: col(s), fillOpacity: .32, className: 'his-tz', interactive: false }).addTo(lay));
    $('hisFS').innerHTML = (f.src || []).map(([n, u]) => `<span>출처</span> <a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join('<br>');
    (f.ln || []).forEach((ln) => { L.polyline(ln, { pane: 'hisF', color: '#000', weight: 7, opacity: .5, interactive: false }).addTo(lay); L.polyline(ln, { pane: 'hisF', color: '#fff', weight: 3, interactive: false }).addTo(lay); });
    (f.cr || []).forEach(([la, lo, km, s]) => crowd(la, lo, km, col(s), lay));
    (f.ar || []).forEach(([a, b, c, d, s]) => arrow([a, b], [c, d], col(s), lay));
    (f.bt || []).forEach(([la, lo, n]) => { L.circleMarker([la, lo], { pane: 'hisM2', radius: 8, color: '#fff', weight: 2, fillColor: '#ff9f1c', fillOpacity: .9, interactive: false }).addTo(lay);
      L.marker([la, lo], { pane: 'hisT2', interactive: false, icon: L.divIcon({ className: '', html: `<div class="his-lab">${esc(n)}</div>` }) }).addTo(lay); });
    (f.fx || []).forEach(([la, lo]) => HFX.fire(la, lo, lay, 'hisT2')); (f.nc || []).forEach(([la, lo, n, l]) => HFX.num(la, lo, n, l, lay, 'hisF', 'hisT2'));
    HFX.thumb($('hisPh'), 'his:' + W.id + ':' + i); HFX.tl(W.frames.map((x) => x.d), i, (k) => { stop(); show(k); });
    $('hisD').textContent = D(f.d); $('hisTm').textContent = f.tm || ''; $('hisC').textContent = f.t; $('hisM').textContent = f.more || ''; $('hisR').value = i;
    const v = viewAt(i); if (f.v || (i > 0 && viewAt(i - 1) !== v)) m.flyToBounds(v, { duration: 1.2, padding: [10, 10] });
  }
  function stop() { clearInterval(timer); timer = null; $('hisPlay').textContent = '재생'; }
  function play(on) { if (!on || timer) { stop(); return; } $('hisPlay').textContent = '멈춤'; if (i >= W.frames.length - 1) show(0); timer = setInterval(() => { if (i >= W.frames.length - 1) stop(); else show(i + 1); }, 3600); }
  function close() { stop(); clear(); HFX.end(); W = null; P.hidden = true; document.body.classList.remove('his-on'); const m = getMap(); if (saved && m) { m.flyTo(saved.c, saved.z, { duration: .8 }); saved = null; } }
  $('hisPlay').addEventListener('click', () => play(!timer)); $('hisX').addEventListener('click', close);
  $('hisPrev').addEventListener('click', () => { stop(); show(i - 1); }); $('hisNext').addEventListener('click', () => { stop(); show(i + 1); });
  $('hisR').addEventListener('input', (e) => { stop(); show(+e.target.value); });
  document.addEventListener('keydown', (e) => { if (W && e.key === 'Escape') close(); });
})();
