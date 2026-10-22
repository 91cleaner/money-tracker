// 돈의 흐름 지도 — 시를 누르면 그 시의 계약금이 어느 시·군·구 업체로 갔는지 선으로 보여준다. 외부 라이브러리 없음.
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

async function moneyMap(root, opts = {}) {
  const [geo, fl] = await Promise.all([getJSON('assets/geo.json'), getJSON('data/flows.json')]);
  const box = $('.map', root), panel = $('.flowpanel', root);
  const full = [0, 0, geo.w, geo.h];
  const svg = sv('svg', {viewBox: full.join(' '), role: 'img', 'aria-label': '대한민국 지도 위 돈의 흐름'});
  const gP = sv('g', {class: 'provs'}), gF = sv('g', {class: 'flows'}), gD = sv('g', {class: 'dests'}), gL = sv('g', {class: 'labels'}), gC = sv('g', {class: 'cits'});
  for (const p of geo.provinces) gP.append(sv('path', {d: p.d}));
  svg.append(gP, gF, gD, gC, gL); box.replaceChildren(svg);

  const cities = Object.entries(fl.cities).map(([slug, c]) => ({slug, ...c})).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const maxT = cities[0] ? cities[0].total : 1;
  const dots = new Map();
  for (const c of cities) {
    const e = sv('circle', {cx: c.p[0], cy: c.p[1], class: 'cdot'}); e.dataset.r = 2.5 + 16 * Math.sqrt(c.total / maxT);
    gC.append(e); dots.set(c.slug, e);
  }
  let vb = full.slice(), cur = null;
  const sizes = () => {
    const k = vb[2] / geo.w;
    dots.forEach((e) => e.setAttribute('r', (+e.dataset.r) * Math.max(k, 0.35)));
    gD.querySelectorAll('circle').forEach((e) => e.setAttribute('r', (+e.dataset.r) * Math.max(k, 0.35)));
    gL.querySelectorAll('text').forEach((t) => { t.setAttribute('font-size', 12 * k); t.setAttribute('dy', -7 * k); });
  };
  let anim = 0;
  const zoomTo = (t) => {
    cancelAnimationFrame(anim);
    const from = vb.slice(), t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 650;
    const step = (now) => {
      const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      vb = from.map((v, i) => v + (t[i] - v) * e); svg.setAttribute('viewBox', vb.join(' ')); sizes();
      if (u < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };
  const fit = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const ar = box.clientHeight / box.clientWidth || geo.h / geo.w;
    let w = Math.max(x1 - x0, 90) * 1.35, h = Math.max(y1 - y0, 90) * 1.35;
    if (h / w > ar) w = h / ar; else h = w * ar;
    w = Math.min(w, geo.w); h = Math.min(h, geo.h);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [Math.max(0, Math.min(geo.w - w, cx - w / 2)), Math.max(0, Math.min(geo.h - h, cy - h / 2)), w, h];
  };
  const curve = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, o = Math.min(d * 0.28, 60);
    const mx = (a[0] + b[0]) / 2 - (dy / d) * o, my = (a[1] + b[1]) / 2 + (dx / d) * o;
    return `M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`;
  };
  const label = (p, text, cls) => { const t = sv('text', {x: p[0], y: p[1], class: 'lb ' + (cls || '')}); t.textContent = text; gL.append(t); };
  const lines = (list, maxA) => {
    gF.replaceChildren(); gD.replaceChildren(); gL.replaceChildren();
    list.forEach((f, i) => {
      const w = 1.5 + 9 * Math.sqrt(f.amount / maxA);
      const same = Math.hypot(f.a[0] - f.p[0], f.a[1] - f.p[1]) < 2;
      if (!same) {
        const p = sv('path', {d: curve(f.a, f.p), class: 'fl ' + (f.local ? 'in' : 'out'), 'stroke-width': w.toFixed(1)});
        p.style.animationDelay = (i * 60) + 'ms'; gF.append(p);
      }
      const d = sv('circle', {cx: f.p[0], cy: f.p[1], class: 'dd ' + (f.local ? 'in' : 'out')}); d.dataset.r = 2 + w / 3; gD.append(d);
    });
  };
  const share = (x, t) => (t ? Math.round((x / t) * 100) + '%' : '—');
  const row = (name, sub, amt, frac, cls) => {
    const r = el('div', 'frow ' + (cls || '')); const l = el('div', 'fl-l');
    l.append(el('span', 'fn', name), el('span', 'fs', sub)); r.append(l, el('span', 'fa', amt));
    const b = el('i', 'fb'); b.style.width = Math.max(2, frac * 100) + '%'; r.append(b); return r;
  };

  const showCity = (slug, zoom = true) => {
    const c = fl.cities[slug]; if (!c) return;
    cur = slug; dots.forEach((e, s) => e.classList.toggle('on', s === slug)); svg.classList.add('picked');
    const list = c.flows.map((f) => ({...f, a: c.p}));
    lines(list, Math.max(...list.map((f) => f.amount), 1));
    list.filter((f) => !f.local).slice(0, 3).forEach((f) => label(f.p, f.to.split(' ').slice(1).join(' ') || f.to));
    label(c.p, c.name.split(' ').pop(), 'me'); sizes();
    if (zoom) zoomTo(fit([c.p, ...list.slice(0, 8).map((f) => f.p)]));
    panel.replaceChildren();
    const h = el('div', 'fh'); h.append(el('span', 'fh-n', c.name), el('span', 'fh-v', krw(c.total)));
    panel.append(h, el('p', 'fq', '이 돈은 어디로 갔나'));
    if (!c.known) { panel.append(el('p', 'sub', '업체 주소를 확인하는 중입니다.')); return; }
    const out = c.known - c.local;
    const sp = el('div', 'fsplit'); const bar = el('div', 'splitbar'); const i = el('i'); i.style.width = share(c.local, c.known); bar.append(i);
    const lg = el('div', 'legend'); lg.innerHTML = `<span><b class="dot in"></b>우리 시 업체 <b>${share(c.local, c.known)}</b></span><span><b class="dot out2"></b>다른 지역 업체 <b>${share(out, c.known)}</b></span>`;
    sp.append(bar, lg); panel.append(sp);
    const top = list.slice(0, opts.rows || 6);
    for (const f of top) panel.append(row(f.to, `${f.count.toLocaleString('ko-KR')}건 · ${f.local ? '우리 시' : '다른 지역'}`, `${share(f.amount, c.known)} · ${krw(f.amount)}`, f.amount / c.known, f.local ? 'in' : 'out'));
    const restN = list.length - top.length + (c.other ? c.other.n : 0);
    if (restN > 0) panel.append(el('p', 'sub small', `그 밖의 ${restN}곳`));
    if (c.known < c.total) panel.append(el('p', 'sub small', `주소가 확인된 계약 ${share(c.known, c.total)} 기준`));
    if (!opts.fixed) { const g = el('a', 'gobtn', c.name + ' 자세히 보기'); g.href = 'city.html?c=' + slug; panel.append(g); }
  };
  const showNation = () => {
    cur = null; dots.forEach((e) => e.classList.remove('on')); svg.classList.remove('picked');
    const list = fl.nation.slice(0, 25).map((f) => ({...f, a: fl.cities[f.from].p, local: false}));
    lines(list, Math.max(...list.map((f) => f.amount), 1));
    sizes(); zoomTo(full);
    panel.replaceChildren();
    panel.append(el('p', 'fq', '시 밖으로 나간 가장 큰 돈'));
    const maxA = list[0] ? list[0].amount : 1;
    for (const f of list.slice(0, 6)) panel.append(row(`${fl.cities[f.from].name} → ${f.to}`, f.count.toLocaleString('ko-KR') + '건', krw(f.amount), f.amount / maxA, 'out'));
    panel.append(el('p', 'sub small', '지도의 원을 누르면 그 시의 돈이 어디로 갔는지 보여줍니다.'));
  };

  // 터치: 가장 가까운 원을 고른다 (작은 원도 손가락으로 쉽게)
  const pick = (ev) => {
    if (opts.fixed) return;
    const m = svg.getScreenCTM(); if (!m) return;
    const scale = m.a; let best = null, bd = 30;
    for (const c of cities) {
      const r = (+dots.get(c.slug).getAttribute('r') || 0) * scale;
      const x = c.p[0] * m.a + m.e, y = c.p[1] * m.d + m.f;
      const d = Math.hypot(ev.clientX - x, ev.clientY - y) - r;
      if (d < bd) { bd = d; best = c; }
    }
    if (best) { showCity(best.slug); setSeg('city'); }
  };
  svg.addEventListener('click', pick);

  const seg = $('.seg', root);
  const setSeg = (v) => seg && seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === v));
  if (seg) seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    setSeg(b.dataset.v);
    if (b.dataset.v === 'nation') showNation(); else showCity(cur || opts.start || cities[0].slug);
  });
  const pickSel = $('select', root);
  if (pickSel) {
    for (const c of cities.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'))) { const o = el('option', '', c.name); o.value = c.slug; pickSel.append(o); }
    pickSel.addEventListener('change', () => { if (pickSel.value) { showCity(pickSel.value); setSeg('city'); } });
  }
  sizes();
  if (opts.fixed) showCity(opts.fixed);
  else { setSeg('city'); showCity(opts.start || cities[0].slug); }
  const src = el('p', 'sub small', `업체 위치: ${fl.basis}. 지도 경계: ${geo.source}. 갱신 ${when(fl.updated)}`); root.append(src);
}
