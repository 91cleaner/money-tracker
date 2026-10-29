/* 홈 지도 '돈 흐름 재생': 지난 7일을 하루 2초씩 돌려, 85개 시청에서 계약 업체 소재지로 돈이 날아가는 모습을 보여 준다.
   자료: data/flow_daily.json(날짜·시·도착 지역별 금액) + data/flows.json(시청 위치). 파랑 = 같은 지역 업체, 주황 = 다른 지역 업체. */
(() => {
  if ((document.body.dataset.page || '') !== 'home') return;
  const GK = Math.cos(36 * Math.PI / 180), GSX = 600 / (6.5 * GK);
  const toLL = (p) => [38.7 - p[1] / GSX, 124.5 + p[0] / (GK * GSX)];
  const DAY_MS = 2200, FLY_MS = 1100, DAYS = 7, PER_CITY = 6;
  const BLUE = [90, 180, 255], AMBER = [255, 176, 32];
  const WD = '일월화수목금토';
  const won = (n) => { n = Math.round(n || 0); if (n >= 1e12) { const j = Math.floor(n / 1e12), e = Math.round((n % 1e12) / 1e8); return j.toLocaleString('ko-KR') + '조' + (e ? ' ' + e.toLocaleString('ko-KR') + '억' : '') + '원'; } if (n >= 1e8) return Math.round(n / 1e8).toLocaleString('ko-KR') + '억원'; return Math.round(n / 1e4).toLocaleString('ko-KR') + '만원'; };
  const md = (d) => { const x = new Date(d + 'T00:00:00Z'); return `${x.getUTCMonth() + 1}월 ${x.getUTCDate()}일 (${WD[x.getUTCDay()]})`; };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = document.createElement('style');
  css.textContent = `.rp-btn{position:absolute;z-index:820;right:10px;top:64px;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid #ffb02088;background:#14110acc;color:#ffd27a;font:800 14px Pretendard,system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 0 0 0 #ffb02066;animation:rpPulse 2.4s ease-out 3}
@keyframes rpPulse{0%{box-shadow:0 0 0 0 #ffb02066}100%{box-shadow:0 0 0 14px #ffb02000}}
.rp-hud{position:absolute;z-index:820;left:10px;right:10px;top:64px;pointer-events:none;display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.rp-card{pointer-events:auto;background:#0b0f13e6;border:1px solid #2a3541;border-radius:14px;padding:10px 12px;color:#e8edf2;font:500 13px/1.45 Pretendard,system-ui,sans-serif;max-width:min(320px,70vw);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.rp-card .d{font-weight:800;color:#fff;font-size:15px}.rp-card .a{font:900 24px/1.15 Pretendard,system-ui,sans-serif;color:#ffb020;font-variant-numeric:tabular-nums;margin:2px 0}
.rp-card .s{color:#9aa6b2;font-size:12px}.rp-card .lg{display:flex;gap:10px;margin-top:4px;font-size:12px;color:#c9d3dd}.rp-card .lg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:0}
.rp-bar{height:4px;border-radius:2px;background:#222b36;margin-top:6px;overflow:hidden}.rp-bar i{display:block;height:100%;background:#ffb020;width:0}
.rp-x{pointer-events:auto;min-width:40px;min-height:40px;border-radius:50%;border:1px solid #2a3541;background:#0b0f13e6;color:#e8edf2;font:700 18px/1 system-ui;cursor:pointer}
.rp-end .row{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.rp-end button{font:700 13px Pretendard,system-ui,sans-serif;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid #2a3541;background:#151b23;color:#e8edf2;cursor:pointer}.rp-end button.p{background:#ffb020;border-color:#ffb020;color:#14110a}
.rp-cv{position:absolute;left:0;top:0;width:100%;height:100%;z-index:810;pointer-events:none}
.rp-on .leaflet-tooltip-pane,.rp-on .dv-down{opacity:0;transition:opacity .3s}.rp-on .leaflet-overlay-pane,.rp-on .leaflet-marker-pane{opacity:.28;transition:opacity .3s}
@media(max-width:599px){.rp-btn{top:10px}.rp-hud{top:8px;left:8px;right:8px}.rp-card{padding:6px 10px;font-size:12px;max-width:calc(100% - 48px)}.rp-card:not(.rp-end){display:grid;grid-template-columns:auto auto;column-gap:8px;align-items:baseline}.rp-card:not(.rp-end) .lg{display:none}.rp-card:not(.rp-end) .rp-bar{grid-column:1/-1;margin-top:4px}.rp-card .d{font-size:13px}.rp-card .a{font-size:18px;margin:0}.rp-card:not(.rp-end) .s{grid-column:1/-1}.rp-x{min-width:36px;min-height:36px}}`;
  document.head.append(css);

  let data = null;
  const load = () => data || (data = Promise.all([
    fetch('data/flow_daily.json').then((r) => (r.ok ? r.json() : null)),
    fetch('data/flows.json').then((r) => (r.ok ? r.json() : null)),
  ]).then(([fd, fl]) => {
    if (!fd || !fl) return null;
    const days = new Set();
    for (const s in fd.c) for (const d in (fd.c[s].d || {})) days.add(d);
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const list = [...days].filter((d) => d < today).sort().slice(-DAYS - 6); // 오늘은 아직 안 끝나서 뺌
    const plan = list.map((day) => {
      const shots = []; let total = 0, out = 0;
      for (const s in fd.c) {
        const src = fd.c[s], c = fl.cities[s], v = src.d && src.d[day]; if (!c || !c.p || !v) continue;
        const L = new Set(src.L || []);
        const rows = (v[2] || []).slice().sort((a, b) => b[1] - a[1]);
        for (const r of rows) { total += r[1]; if (!L.has(r[0])) out += r[1]; }
        rows.slice(0, PER_CITY).forEach((r) => { const p = fd.p[r[0]]; if (p) shots.push({ a: toLL(c.p), b: toLL(p), amt: r[1], local: L.has(r[0]), t: Math.random() * (DAY_MS - FLY_MS * 0.7) }); });
      }
      return { day, shots, total, out };
    }).filter((d) => d.shots.length);
    const mx = Math.max(0, ...plan.map((d) => d.total));
    const busy = plan.filter((d) => d.total >= mx * 0.15).slice(-DAYS); // 주말·공휴일처럼 계약이 거의 없는 날은 건너뜀
    return busy.length ? busy : null;
  }).catch(() => null));

  const start = () => {
    const map = window.__dvMap, box = document.querySelector('#dive .dv-map'); if (!map || !box) return;
    let btn = null;
    const mkBtn = () => { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'rp-btn'; btn.innerHTML = '▶ 최근 7일 돈 흐름'; btn.setAttribute('aria-label', '최근 7일 돈 흐름 재생'); btn.onclick = play; box.append(btn); };
    mkBtn();
    let raf = 0, cv = null, hud = null, stop = null;
    function close() { box.classList.remove('rp-on'); cancelAnimationFrame(raf); raf = 0; if (cv) cv.remove(); if (hud) hud.remove(); cv = hud = null; if (btn) btn.hidden = false; if (stop) { map.off('movestart zoomstart', stop.s); map.off('moveend zoomend', stop.e); } }
    async function play() {
      btn.hidden = true;
      const plan = await load();
      if (!plan) { btn.hidden = false; btn.textContent = '자료를 못 불러왔어요'; return; }
      close(); btn.hidden = true;
      map.stop(); map.fitBounds([[33.1, 125.0], [38.65, 129.6]], { animate: !RM });
      box.classList.add('rp-on');
      cv = document.createElement('canvas'); cv.className = 'rp-cv'; box.append(cv);
      hud = document.createElement('div'); hud.className = 'rp-hud';
      hud.innerHTML = `<div class="rp-card"><div class="d"></div><div class="a">0원</div><div class="s">7일 합계 <b class="sum">0원</b></div><div class="lg"><span><i style="background:rgb(${BLUE})"></i>같은 지역 업체</span><span><i style="background:rgb(${AMBER})"></i>다른 지역 업체</span></div><div class="rp-bar"><i></i></div></div><button type="button" class="rp-x" aria-label="재생 닫기">×</button>`;
      box.append(hud); hud.querySelector('.rp-x').onclick = close;
      const g = cv.getContext('2d');
      const size = () => { const r = devicePixelRatio || 1; cv.width = box.clientWidth * r; cv.height = box.clientHeight * r; g.setTransform(r, 0, 0, r, 0, 0); };
      size();
      let moving = false; stop = { s: () => { moving = true; }, e: () => { moving = false; } };
      map.on('movestart zoomstart', stop.s); map.on('moveend zoomend', stop.e);
      const maxAmt = Math.max(...plan.flatMap((d) => d.shots.map((s) => s.amt)));
      const W = (a) => 1.2 + 5 * Math.sqrt(a / maxAmt);
      const sumAll = plan.reduce((t, d) => t + d.total, 0), outAll = plan.reduce((t, d) => t + d.out, 0);
      const T = plan.length * DAY_MS + FLY_MS + 400;
      const dEl = hud.querySelector('.d'), aEl = hud.querySelector('.a'), sEl = hud.querySelector('.sum'), bar = hud.querySelector('.rp-bar i');
      const curve = (a, b, u) => { // 살짝 휜 길
        const pa = map.latLngToContainerPoint(a), pb = map.latLngToContainerPoint(b);
        const dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 1, o = Math.min(60, d * 0.22);
        const cx = (pa.x + pb.x) / 2 - (dy / d) * o, cy = (pa.y + pb.y) / 2 + (dx / d) * o;
        const v = 1 - u; return [v * v * pa.x + 2 * v * u * cx + u * u * pb.x, v * v * pa.y + 2 * v * u * cy + u * u * pb.y];
      };
      const t0 = performance.now(); let lastDay = -1, shown = 0;
      const frame = (now) => {
        raf = 0; if (!cv) return;
        const t = RM ? T : Math.max(0, now - t0);
        const di = Math.min(plan.length - 1, Math.floor(t / DAY_MS));
        if (di !== lastDay) { lastDay = di; dEl.textContent = md(plan[di].day); }
        // 숫자: 그날 금액이 차오르고, 7일 합계가 쌓인다
        const inDay = Math.min(1, (t - di * DAY_MS) / (DAY_MS * 0.9));
        const before = plan.slice(0, di).reduce((s, d) => s + d.total, 0);
        aEl.textContent = won(plan[di].total * inDay); shown = before + plan[di].total * inDay; sEl.textContent = won(shown);
        bar.style.width = Math.min(100, (t / (plan.length * DAY_MS)) * 100) + '%';
        g.clearRect(0, 0, cv.width, cv.height);
        if (!moving) {
          g.globalCompositeOperation = 'lighter';
          plan.forEach((d, i) => {
            const base = i * DAY_MS;
            if (t < base - 50 || t > base + DAY_MS + FLY_MS + 600) return;
            for (const s of d.shots) {
              const u0 = (t - base - s.t) / FLY_MS; if (u0 < 0 || u0 > 1.5) continue;
              const col = s.local ? BLUE : AMBER, w = W(s.amt);
              if (u0 <= 1) {
                const u = 1 - Math.pow(1 - u0, 2); // 처음엔 빠르게, 도착할 땐 천천히
                for (let k = 0; k < 6; k++) { // 꼬리
                  const uu = Math.max(0, u - k * 0.035); const [x, y] = curve(s.a, s.b, uu);
                  g.fillStyle = `rgba(${col},${0.55 * (1 - k / 6)})`; g.beginPath(); g.arc(x, y, w * (1 - k / 8), 0, 6.283); g.fill();
                }
                const [x, y] = curve(s.a, s.b, u); const gr = g.createRadialGradient(x, y, 0, x, y, w * 4);
                gr.addColorStop(0, `rgba(${col},0.9)`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, w * 4, 0, 6.283); g.fill();
              } else { // 도착: 퍼지는 고리
                const k = (u0 - 1) / 0.5, p = map.latLngToContainerPoint(s.b);
                g.strokeStyle = `rgba(${col},${0.7 * (1 - k)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, w * 2 + k * w * 6, 0, 6.283); g.stroke();
              }
            }
          });
          g.globalCompositeOperation = 'source-over';
        }
        if (t < T) { raf = requestAnimationFrame(frame); return; }
        // 끝: 요약
        g.clearRect(0, 0, cv.width, cv.height);
        box.classList.remove('rp-on');
        const card = hud.querySelector('.rp-card'); card.classList.add('rp-end');
        const pct = sumAll ? Math.round((outAll / sumAll) * 100) : 0;
        card.innerHTML = `<div class="d">${md(plan[0].day).replace(/ \(.\)/, '')} ~ ${md(plan[plan.length - 1].day).replace(/ \(.\)/, '')}</div><div class="a">${won(sumAll)}</div>
          <div>85개 시가 계약으로 보낸 돈이에요. 그중 <b style="color:#ffb020">${pct}%</b>는 다른 지역 업체로 갔어요.</div>
          <div class="s">계약한 날 기준 · 시청 → 업체 소재지 · 출처 조달청 나라장터</div>
          <div class="row"><button type="button" class="p" data-a="again">다시 보기</button><button type="button" data-a="mine">우리 시 찾기</button></div>`;
        card.querySelector('[data-a="again"]').onclick = play;
        card.querySelector('[data-a="mine"]').onclick = () => { close(); const i = document.querySelector('#dive .dv-q input'); if (i) i.focus(); };
      };
      raf = requestAnimationFrame(frame);
    }
  };
  let n = 0; const wait = setInterval(() => { if (window.__dvMap && document.querySelector('#dive .dv-map')) { clearInterval(wait); start(); } else if (++n > 80) clearInterval(wait); }, 150);
})();
