/* 기간 슬라이더: 7일·14일·30일(기본)·60일·90일·전체. 일별 집계(data/daily.json)를 더해 합계를 다시 만든다.
   URL: ?d=30 (최근 30일, 매일 움직임) · ?d=30&to=2026-10-23 (고정: 공유 링크용) · ?from=2026-10-01&to=2026-10-23 (임의 기간).
   data/index.json, data/city/*.json 요청을 가로채 고른 기간만 남긴다(다른 스크립트는 그대로). */
window.plainT = (t) => String(t == null ? '' : t)
  .replace(/견적\s*1곳만 받아도 되는 금액선\(추정가\s*2천만원\)\s*근처/g, '2천만원 한도 바로 밑 계약(이 금액 아래면 업체 한 곳 견적만으로 계약할 수 있어요)');
// 공식 계약 제목은 그대로 두고, 어려운 말 풀이는 따로 작은 태그로 붙인다
window.plainTag = (t) => { t = String(t || ''); const E = [['단가계약', '필요할 때마다 사는 계약'], ['(단가)', '필요할 때마다 사는 계약', '단가계약'], ['수의계약', '기관이 업체를 골라 맺는 계약'], ['추정가', '기관이 미리 어림한 금액']].filter(([k]) => t.includes(k)).filter(([k], i, a) => !(k === '(단가)' && a.some(([x]) => x === '단가계약')));
  return E.length ? ' ' + E.map(([k, v, s]) => `<small class="dv-ez dv-tag">${s || k} = ${v}</small>`).join(' ') : ''; };
(() => {
  const Q = new URLSearchParams(location.search), STOPS = [7, 14, 30, 60, 90, 0];  // 0 = 전체
  const rf = window.fetch.bind(window);
  // daily.json은 index.json에 daily 표시가 있을 때만 요청(파일이 없을 때 404·콘솔 오류 없이 슬라이더를 숨김)
  const DL = rf('data/index.json').then(r => r.ok ? r.json() : null).then(x => x && x.daily ? rf('data/daily.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null) : null).catch(() => null);
  const day = (s, k) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
  const span = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
  const WIN = DL.then(dl => {
    if (!dl || !dl.last) return null;
    const lo = dl.cover_from || dl.first, to0 = /^\d{4}-\d\d-\d\d$/.test(Q.get('to') || '') ? Q.get('to') : dl.last;
    const to = to0 > dl.last ? dl.last : to0;
    let from, d;
    if (/^\d{4}-\d\d-\d\d$/.test(Q.get('from') || '')) { from = Q.get('from'); d = span(from, to); }
    else { d = Q.has('d') ? +Q.get('d') || 0 : 30; from = d ? day(to, 1 - d) : lo; }
    if (from < lo) from = lo;
    return {dl, lo, from, to, d, fixed: Q.has('to') || Q.has('from'), explicit: Q.has('d') || Q.has('to') || Q.has('from')};
  });
  let CW = null; WIN.then(w => { CW = w; });
  window.__pdCW = () => CW;
  window.__pdLabel = () => { const w = CW; if (!w || !w.from) return null; if (w.fixed && Q.has('from')) return `${span(w.from, w.to)}일 (${+w.from.slice(5, 7)}.${+w.from.slice(8)}~)`; return w.d ? `최근 ${w.d}일` : `${+w.lo.slice(5, 7)}월 ${+w.lo.slice(8)}일부터 지금까지`; };
  window.__pdWhen = () => { const l = window.__pdLabel && window.__pdLabel(); return !l ? '최근 30일 동안' : /^최근/.test(l) ? l + ' 동안' : l; };
  window.PERIOD = WIN;
  const sumCity = (m, w) => { const o = {n: 0, t: 0, cat: {}}; for (const k in m) if (k >= w.from && k <= w.to) { const v = m[k]; o.n += v[0]; o.t += v[1]; for (const c in v[2]) { const x = o.cat[c] || (o.cat[c] = [0, 0]); x[0] += v[2][c][0]; x[1] += v[2][c][1]; } } return o; };
  const fixIndex = (x, w) => { for (const c of x.cities || []) { const s = sumCity(w.dl.c[c.slug] || {}, w); c.count = s.n; c.total = s.t; c.by_cat = {}; c.n_cat = {}; for (const k in s.cat) { c.n_cat[k] = s.cat[k][0]; c.by_cat[k] = s.cat[k][1]; } } x.period = {from: w.from, to: w.to, d: w.d}; x.days = span(w.from, w.to); return x; };
  const fixFlows = (x, w) => { for (const k in x.cities || {}) x.cities[k].total = sumCity(w.dl.c[k] || {}, w).t; return x; };  // 지도 원 크기·이름표: 고른 기간 합계
  const fixCity = (x, w) => {
    const inw = r => { const k = r.odate || r.date; return k >= w.from && k <= w.to; };
    x.rows = (x.rows || []).filter(inw); x.changes = (x.changes || []).filter(r => r.date >= w.from && r.date <= w.to);
    const ids = new Set(x.rows.map(r => r.id).concat(x.changes.map(r => r.id)));
    x.alerts = (x.alerts || []).filter(a => (a.ids || []).every(i => ids.has(i)));
    const s = x.summary || (x.summary = {}), inst = {}, ven = {};
    for (const r of x.rows) {
      (inst[r.inst] = inst[r.inst] || [0, 0]); inst[r.inst][0] += r.amount; inst[r.inst][1]++;
      const ms = r.jvm && r.jvm.length > 1 && r.jvm.every(m => m.share != null) ? r.jvm.map(m => [m.name, m.id, r.amount * m.share / 100, m.region]) : [[r.vendor, r.bh, r.amount, r.vregion]];
      for (const [nm, id, a, rg] of ms) { if (!nm) continue; const k = nm + '|' + id, v = ven[k] || (ven[k] = {name: nm, id, amount: 0, count: 0, region: rg}); v.amount += a; v.count++; }
    }
    const ds = x.rows.map(r => r.odate || r.date).sort();
    Object.assign(s, {count: x.rows.length, total: x.rows.reduce((a, r) => a + r.amount, 0), first: ds[0] || null, last: ds[ds.length - 1] || null,
      top_inst: Object.entries(inst).sort((a, b) => b[1][0] - a[1][0]).slice(0, 10).map(([name, [amount, count]]) => ({name, amount, count})),
      top_vendors: Object.values(ven).sort((a, b) => b.amount - a.amount).slice(0, 10)});
    x.period = {from: w.from, to: w.to, d: w.d}; return x;
  };
  window.fetch = (u, o) => {
    const s = typeof u === 'string' ? u : (u && u.url) || '';
    const isI = /(^|\/)data\/index\.json/.test(s), isC = /(^|\/)data\/city\/[^/]+\.json/.test(s), isF = /(^|\/)data\/flows\.json/.test(s);
    if (!isI && !isC && !isF) return rf(u, o);
    return Promise.all([rf(u, o), WIN]).then(([res, w]) => {
      w = CW || w; if (!w || !res.ok) return res;
      return res.json().then(x => new Response(JSON.stringify(isF ? fixFlows(x, w) : isI ? fixIndex(x, w) : fixCity(x, w)), {status: 200, headers: {'Content-Type': 'application/json'}}));
    });
  };
  // 링크에 기간 유지 (주소에 기간을 직접 넣은 경우)
  const keep = () => ['d', 'from', 'to'].filter(k => Q.has(k)).map(k => [k, Q.get(k)]);
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a || !keep().length) return;
    const h = a.getAttribute('href'); if (!h || h[0] === '#' || /^(https?:|mailto:|javascript:)/.test(h) && !h.startsWith(location.origin)) return;
    const url = new URL(h, location.href); if (url.origin !== location.origin) return;
    for (const [k, v] of keep()) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
    a.href = url.pathname + url.search + url.hash;
  }, true);
  const sy = sessionStorage.getItem('pd-y'); if (sy) { sessionStorage.removeItem('pd-y'); addEventListener('load', () => setTimeout(() => scrollTo(0, +sy), 60)); }
  // 슬라이더 UI
  const fmt = s => s.replace(/-/g, '.'), W = n=>{n=Math.round(n||0);const a=Math.abs(n),s=n<0?'-':'';if(a>=1e12){const j=Math.floor(a/1e12),e=Math.round((a%1e12)/1e8);return s+j+'조'+(e?' '+e.toLocaleString('ko-KR')+'억':'')+'원'}if(a>=1e8)return s+(a>=1e10?Math.round(a/1e8).toLocaleString('ko-KR'):(a/1e8).toFixed(1).replace(/\.0$/,''))+'억원';if(a>=1e4)return s+Math.round(a/1e4).toLocaleString('ko-KR')+'만원';return s+a.toLocaleString('ko-KR')+'원'};
  const css = `.pd{margin:8px 6px 4px;padding:8px 12px 10px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(10,16,24,.6);font:600 12px/1.4 var(--sans,system-ui);color:#cfd8e3}
.pd-top{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.pd-top b{color:#ffb020;font-size:14px}.pd-r{color:#8fa0b3;font-weight:500}
.pd input{width:100%;margin:8px 0 2px;accent-color:#ffb020;height:28px;touch-action:pan-y}.pd-t{display:flex;justify-content:space-between;color:#6b7785;font-size:10.5px}
.pd-sum{color:#e8eef5;font-weight:500;margin-top:2px}#dive .pd{order:3}
.pd{padding:6px 10px 7px!important;margin:6px 6px 4px!important}.pd input{margin:2px 0 0!important;height:24px!important}.pd-sum{margin-top:0!important}
@media (min-width:900px){#dive .pd{grid-column:1;grid-row:3!important;margin:0 0 8px}#dive .dv-map{grid-row:4!important;height:calc(100dvh - 400px)!important;min-height:340px!important}#dive .maplg{grid-column:1;grid-row:5}#dive .dv-sheet{grid-row:2/6!important}}
.pd input{-webkit-appearance:none;appearance:none;background:transparent;display:block;width:100%}
.pd input::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,#ffb020 var(--p,50%),rgba(255,255,255,.18) var(--p,50%))}
.pd input::-moz-range-track{height:6px;border-radius:3px;background:linear-gradient(90deg,#ffb020 var(--p,50%),rgba(255,255,255,.18) var(--p,50%))}
.pd input::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;margin-top:-7px;border-radius:50%;background:#ffb020;border:2px solid #0a1018;box-shadow:0 0 0 1px #ffb020}
.pd input::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#ffb020;border:2px solid #0a1018}
.pd-t{position:relative;height:16px;display:block!important}.pd-t span{position:absolute;top:0;left:calc(10px + (100% - 20px) * var(--k));transform:translateX(-50%);white-space:nowrap;line-height:16px}
@media (max-width:899px){.pd{display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center;padding:6px 12px 4px!important;margin:4px 6px 4px!important}.pd-top{grid-column:1;grid-row:1/3;display:block}.pd-top b{white-space:nowrap}.pd-r,.pd-sum{display:none}.pd input{grid-column:2;grid-row:1;height:22px!important}.pd-t{grid-column:2;grid-row:2}}`;
  const mount = w => {
    if (!w || document.querySelector('.pd')) return;
    const cov = span(w.lo, w.dl.last), stops = STOPS.filter(s => s === 0 || s <= cov), L0 = `전체 (${+w.lo.slice(5, 7)}.${+w.lo.slice(8)}~)`;
    let i = stops.indexOf(w.fixed && Q.has('from') ? -1 : w.d); if (i < 0) i = stops.indexOf(30) >= 0 ? stops.indexOf(30) : stops.length - 1;
    const st = document.createElement('style'); st.textContent = css; document.head.append(st);
    const el = document.createElement('div'); el.className = 'pd';
    el.innerHTML = `<div class="pd-top"><b class="pd-l"></b><span class="pd-r"></span></div><input type="range" min="0" max="${stops.length - 1}" step="1" value="${i}" id="pd-range" name="period" aria-label="기간"><div class="pd-t">${stops.map((s, k) => `<span style="--k:${stops.length > 1 ? k / (stops.length - 1) : 0}">${s ? s + '일' : '전체'}</span>`).join('')}</div><div class="pd-sum"></div>`;
    const inp = el.querySelector('input');
    const show = (k, fr, to) => { inp.style.setProperty('--p', `calc(10px + (100% - 20px) * ${stops.length > 1 ? k / (stops.length - 1) : 0})`);
      const s = stops[k]; fr = fr || (s ? day(w.dl.last, 1 - s) : w.lo); to = to || w.dl.last; if (fr < w.lo) fr = w.lo;
      el.querySelector('.pd-l').textContent = Q.has('from') && fr === w.from ? `${span(fr, to)}일` : (s ? `최근 ${s}일` : L0);
      el.querySelector('.pd-r').textContent = `${fmt(fr)}~${fmt(to).slice(5)} 맺은 계약${to === w.dl.last && !w.fixed ? ' (늘어날 수 있음)' : ''}`;
      let n = 0, t = 0; for (const c in w.dl.c) { const x = sumCity(w.dl.c[c], {from: fr, to}); n += x.n; t += x.t; }
      el.querySelector('.pd-sum').textContent = `전국 85개 시 · ${n.toLocaleString()}건 · ${W(t)}${fr > (s ? day(to, 1 - s) : fr) ? ' · 자료가 있는 날부터' : ''}`;
    };
    show(i, w.from, w.to);
    let tl, busy = Promise.resolve();
    const apply = () => { const k = +inp.value, s = stops[k], to = w.dl.last, fr = s ? day(to, 1 - s) : w.lo;
      show(k);
      CW = {...(CW || w), from: fr < w.lo ? w.lo : fr, to, d: s, fixed: false, explicit: s !== 30};
      const u = new URL(location.href); ['d', 'from', 'to'].forEach(x => u.searchParams.delete(x)); Q.delete('d'); Q.delete('from'); Q.delete('to');
      if (s !== 30) { u.searchParams.set('d', String(s)); u.searchParams.set('to', to); Q.set('d', String(s)); Q.set('to', to); }
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
      if (window.__dvPeriod) busy = busy.then(() => window.__dvPeriod()).catch(() => {});
      else { sessionStorage.setItem('pd-y', String(scrollY)); location.replace(u.toString()); } };
    inp.addEventListener('input', () => { show(+inp.value); clearTimeout(tl); tl = setTimeout(apply, window.__dvPeriod ? 120 : 400); });
    inp.addEventListener('change', () => { clearTimeout(tl); apply(); });
    const map = document.querySelector('#dive .dv-map');
    if (map) map.parentNode.insertBefore(el, map);
    else { const h = document.querySelector('main h1, header + * h1, h1'); (h && h.parentNode ? h.parentNode.insertBefore(el, h.nextSibling) : document.body.prepend(el)); }
  };
  const go = () => (document.getElementById('dive') || /city\.html$/.test(location.pathname)) && WIN.then(mount);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => setTimeout(go, 0)) : go();
})();
