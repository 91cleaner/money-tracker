/* Map-first ticker view: every data layer is dots/lines on the map; click or tap opens a short card there.
   The briefing panel keeps only a short summary. Lawmaker trades (House PTR, last 12 months) are shown as
   muted red/blue party dots at approximate district centers. Public records only; no reasons, no advice. */
(() => {
  const OR = '#ff9f0a', RED = '#b45a50', BLU = '#5577a8';
  const en = () => !!(window.MTI18N && window.MTI18N.isEn);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KIND = { supply: ['Plant or HQ', '공장·본사', 'Plants or HQs'], lobby: ['Lobbying filing', '로비 공시'], award: ['Federal contract', '연방 계약'], insider: ['Insider trades (Form 4)', '임원 거래(Form 4)'], recall: ['Recall record', '리콜 기록'], assist: ['Grant or loan', '보조금·대출'], bill: ['Bill', '법안'], cmte: ['Committee', '위원회'], trade: ['Lawmaker trades', '의원 거래'], pac: ['Political donations', '정치 후원'], reg: ['Trade rule', '무역 규제'], prior: ['Trades before a filing', '발표 전 거래'], wh: ['White House', '백악관'], other: ['Public record', '공개 기록'] };
  const kindOf = t => { const r = String(t.ref || ''); if (t.kind && KIND[t.kind]) return t.kind; if (r.startsWith('facility:')) return 'supply'; if (r.startsWith('awards:')) return 'award'; if (r.startsWith('lobbying:')) return 'lobby'; if (r.startsWith('pac:')) return 'pac'; if (r.startsWith('committee:')) return 'cmte'; if (r.startsWith('trade')) return 'trade'; return 'other'; };
  let TM = null, TD = null, layer = null, cur = null, popup = null, SUM = null;
  const getTD = () => TD || (TD = fetch('./today-moves.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null));
  const tdFor = (d, sym) => { if (!d || !d.tickers || !sym) return null; if (d.tickers[sym]) return [sym, d.tickers[sym]]; for (const [k, v] of Object.entries(d.tickers)) if ((v.also || []).includes(sym)) return [k, v]; return null; };
  const money = n => '$' + Number(n).toFixed(2);
  const md = d => { const [y, m, dd] = String(d).split('-'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1] + ' ' + (+dd); };
  const getTM = () => TM || (TM = fetch('../data/us/ticker-members.json').then(r => r.ok ? r.json() : null).catch(() => null));
  const css = document.createElement('style');
  css.textContent = `
body.mt-mapfirst #briefStocks,body.mt-mapfirst #briefLinks,body.mt-mapfirst #mtTrades,body.mt-mapfirst #mtPrice,body.mt-mapfirst #mtRecent,body.mt-mapfirst #mtTourCard,body.mt-mapfirst #mtStop{display:none!important}
body.mt-mapfirst .leaflet-popup.mtTour:not(.mtMF){display:none!important}
html body .leaflet-popup.mtTour.mtMF{display:block!important}
.mtMFdot{background:none;border:0}
.mtMFdot .d{position:absolute;left:-8px;top:-8px;width:16px;height:16px;border-radius:50%;border:2px solid #0b120d;box-shadow:0 0 0 3px rgba(255,159,10,.25);animation:mtMFpop .45s cubic-bezier(.2,1.6,.4,1) both}
.mtMFdot .n{position:absolute;left:12px;top:-9px;white-space:nowrap;font:600 11px/1.4 system-ui,-apple-system,sans-serif;color:#f2efe9;text-shadow:0 1px 2px #000,0 0 6px #000;animation:mtMFfade .4s ease-out both}
.mtMFdot .b{display:inline-block;font:700 9px/1 ui-monospace,monospace;padding:2px 3px;border-radius:2px;margin-right:4px;color:#fff;vertical-align:1px}
.mtMFstop{width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:${OR};border:2px solid #0b120d;box-shadow:0 0 0 3px rgba(255,159,10,.25);cursor:pointer;animation:mtMFpop .45s cubic-bezier(.2,1.6,.4,1) both}
@keyframes mtMFpop{0%{transform:scale(0);opacity:0}70%{transform:scale(1.25);opacity:1;filter:brightness(1.8)}100%{transform:scale(1);filter:none}}
@keyframes mtMFfade{from{opacity:0}to{opacity:1}}
.leaflet-popup.mtMF .leaflet-popup-content{width:min(240px,70vw)!important;margin:9px 11px;font:12.5px/1.5 system-ui,-apple-system,sans-serif}
.mtMF .k{font:600 10px/1.4 ui-monospace,monospace;letter-spacing:1px;color:#68c7d0;text-transform:uppercase}.mtMF .h{font-weight:700;color:#ffd60a;margin:2px 0}
.mtMF .r{font:12px ui-monospace,monospace;color:#d8f5e3}.mtMF .r b{color:${OR}}.mtMF .s{font-size:10.5px;color:#8fa89a;margin-top:4px}.mtMF a{color:#9effc0}
#mtToday{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:1200;max-width:min(860px,94vw);background:rgba(8,14,11,.92);border:1px solid rgba(255,159,10,.55);border-radius:6px;padding:8px 14px;font:600 13px/1.45 system-ui,-apple-system,sans-serif;color:#f2efe9;box-shadow:0 6px 24px rgba(0,0,0,.5);animation:mtMFfade .5s ease-out both;pointer-events:auto}
#mtToday .t{font:700 15px ui-monospace,monospace;color:#ffd60a;margin-right:8px}#mtToday .dn{color:#ff6b5e}#mtToday .up{color:#5fd38a}#mtToday .m{color:#8fa89a;font-weight:500;font-size:11.5px}#mtToday a{color:#9effc0}
.mtMFdot.dim{opacity:.35}
@media (prefers-reduced-motion:reduce){.mtMFdot .d,.mtMFdot .n,.mtMFstop{animation:none}}`;
  document.head.append(css);

  function card(html, ll) {
    const map = window.moneyTrackerMap; if (popup) map.removeLayer(popup);
    popup = L.popup({ className: 'mtTour mtMF', closeButton: true, autoPan: true, autoPanPadding: [40, 90], maxWidth: 250, offset: [0, -6] }).setLatLng(ll).setContent(html).openOn(map);
  }
  function stopCard(t) {
    const E = en(), k = kindOf(t), T = s => (E && window.MTI18N && window.MTI18N.tr ? window.MTI18N.tr(String(s || '')) : String(s || '')), f = T(t.fact), short = f.length > 150 ? f.slice(0, f.lastIndexOf(' ', 147) > 60 ? f.lastIndexOf(' ', 147) : 147) + '...' : f;
    return `<div class="k">${esc(KIND[k][E ? 0 : 1])}</div><div class="h">${esc(T(t.title || t.region))}</div><div>${esc(T(t.region))}${t.date ? ' · ' + esc(String(t.date).slice(0, 10)) : ''}</div>` +
      (short ? `<div class="s" style="color:#bfffd6;font-size:11.5px">${esc(short)}</div>` : '') +
      (t.source_url ? `<div class="s"><a href="${esc(t.source_url)}" target="_blank" rel="noopener noreferrer">${E ? 'Official record' : '원문 기록'} ›</a></div>` : '');
  }
  function memberCard(m, sym) {
    const E = en(), pn = m.p === 'R' ? (E ? 'Republican' : '공화당') : (E ? 'Democrat' : '민주당');
    const rows = m.n > 2
      ? `<div class="r">${m.n} ${E ? 'trades' : '건'} · <b>${m.b} ${m.b === 1 ? 'buy' : 'buys'}</b> / <b>${m.s} ${m.s === 1 ? 'sell' : 'sells'}</b></div><div class="r">${E ? 'Latest' : '최근'}: <b>${m.last[0].s}</b> ${esc(m.last[0].amt)} · ${esc(m.last[0].d)}</div>`
      : m.last.map(l => `<div class="r"><b>${l.s}</b> ${esc(l.amt)} · ${esc(l.d)}</div>`).join('');
    return `<div class="k">${esc(sym)} · House PTR</div><div class="h">${esc(m.name)}</div><div>${pn} · ${esc(m.dist)}</div>${rows}` +
      `<div class="s"><a href="${esc(m.last[0].doc)}" target="_blank" rel="noopener noreferrer">PTR filing ›</a> · ${E ? 'Amounts are reported ranges. Dot is an approximate district location.' : '금액은 신고 구간. 점은 지역구 대략 위치.'}</div>`;
  }
  function todayCard(k, t) {
    const mv = t.move, f = t.filing;
    const ins = (t.insiders || []).map(i => `<div class="r"><b>${i.side}</b> ${esc(i.who)} (${esc(i.role)}) ${i.shares.toLocaleString('en-US')} ${esc(i.sym)} @ ${money(i.price)} · ${esc(i.d)} <a href="${esc(i.doc)}" target="_blank" rel="noopener noreferrer">Form 4 ›</a></div>`).join('');
    return `<div class="k">${esc(k)} · ${esc(t.hqName)}</div><div class="h">${esc(t.name)} ${esc(f.form)}</div><div>${esc(f.item)}, filed ${esc(f.filed)}</div>` +
      `<div class="r">${md(mv.date)} close <b>${money(mv.close)}</b> (${mv.pct > 0 ? '+' : ''}${mv.pct.toFixed(2)}% vs ${money(mv.prev)})</div>` +
      (mv.extra ? `<div class="s">${esc(mv.extra)}</div>` : '') +
      `<div class="s">Form 4 open-market trades, ${md(t.window[0])} to ${md(t.window[1])}:</div>${ins || '<div class="r">None found</div>'}` +
      `<div class="s"><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">8-K filing ›</a></div>`;
  }
  function todayMemberCard(x, k, t) {
    const pn = x.p === 'R' ? 'Republican' : 'Democrat';
    return `<div class="k">${esc(k)} · House PTR</div><div class="h">${esc(x.who)}</div><div>${pn} · ${esc(x.dist)}</div>` +
      x.rows.map(r => `<div class="r"><b>${r.side}</b> ${esc(r.sym)} ${esc(r.amt)} · ${esc(r.d)}</div><div class="s">${esc(r.owner)} · ${r.days} days before the ${esc(t.filing.form)}</div>`).join('') +
      `<div class="s"><a href="${esc(x.rows[0].doc)}" target="_blank" rel="noopener noreferrer">PTR filing ›</a> · Amounts are reported ranges. Dot is an approximate district location.</div>`;
  }
  function strip(k, t) {
    let el = $('mtToday'); if (!el) { el = document.createElement('div'); el.id = 'mtToday'; document.body.append(el); }
    const mv = t.move, n = t.trades.length, ni = (t.insiders || []).length;
    el.innerHTML = `<span class="t">${esc(k)}</span>${md(mv.date)} close ${money(mv.close)} <span class="${mv.pct < 0 ? 'dn' : 'up'}">${mv.pct > 0 ? '+' : ''}${mv.pct.toFixed(2)}%</span> · ${esc(t.filing.form)} ${esc(t.filing.item.split(' (')[0])} filed ${md(t.filing.filed.slice(0, 10))}` +
      `<br><span class="m">30 days before the ${esc(t.filing.form)}: ${n} House PTR trade${n === 1 ? '' : 's'}, ${ni} Form 4 open-market trade${ni === 1 ? '' : 's'}. Public records. <a href="${esc(t.filing.url)}" target="_blank" rel="noopener noreferrer">8-K ›</a></span>`;
  }
  function lab(k, n) { const K = KIND[k]; if (!en()) return K[1]; let w = n > 1 ? (K[2] || (/s$|\)$/.test(K[0]) ? K[0] : K[0] + 's')) : K[0]; return w.charAt(0).toLowerCase() + w.slice(1); }
  function declutter() {
    const ls = [...document.querySelectorAll('.leaflet-marker-icon.mtMFdot .n')]; if (!ls.length) return;
    ls.forEach(n => { n.style.transform = '' });
    const hit = (a, b) => a.left < b.right + 2 && b.left < a.right + 2 && a.top < b.bottom + 1 && b.top < a.bottom + 1;
    const placed = [...document.querySelectorAll('.leaflet-marker-icon.mtMFdot .d')].map(d => d.getBoundingClientRect());
    ls.forEach(n => {
      const r = n.getBoundingClientRect(), h = r.height || 15;
      for (const dy of [0, h, -h, 2 * h, -2 * h, 3 * h, -3 * h]) {
        const q = { left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy };
        if (!placed.some(b => hit(q, b)) || dy === -3 * h) { n.style.transform = dy ? `translateY(${dy}px)` : ''; placed.push(q); break; }
      }
    });
  }
  function paint(again) { if (!SUM) return; if (!again) [60, 700].forEach(ms => setTimeout(() => paint(1), ms)); const bt = $('briefText'), ti = $('briefTitle'); if (ti) ti.textContent = SUM[0]; if (bt) { bt._tok = {}; bt._mt = {}; bt._mtDone = null; bt._dc = null; bt.textContent = SUM[1]; bt.style.whiteSpace = 'pre-line' } }
  function clear() { SUM = null; const st = $('mtToday'); if (st) st.remove(); const map = window.moneyTrackerMap; if (layer) map.removeLayer(layer); layer = null; cur = null; if (popup) { map.removeLayer(popup); popup = null } document.body.classList.remove('mt-mapfirst'); }

  async function setup(m) {
    const map = window.moneyTrackerMap, E = en(); clear(); cur = m; document.body.classList.add('mt-mapfirst');
    map.fire('click'); // pause the auto tour; cards open on click instead
    layer = L.layerGroup().addTo(map);
    const pts = [];
    m.meta.forEach((t, i) => {
      if (t.lat == null) return; pts.push([t.lat, t.lon]);
      const mk = L.marker([t.lat, t.lon], { icon: L.divIcon({ className: '', html: `<div class="mtMFstop" style="animation-delay:${Math.min(i, 12) * 90}ms"></div>`, iconSize: [0, 0] }), keyboard: true, title: t.title || t.region });
      mk.on('click', e => { L.DomEvent.stop(e); card(stopCard(t), [t.lat, t.lon]) }); mk.addTo(layer);
    });
    const sym = /^company:/.test(m.ticker) ? m.ticker.slice(8).toUpperCase() : '';
    let tm = null;
    if (sym) { const d = await getTM(); if (cur !== m) return; tm = d && d.tickers && d.tickers[sym]; }
    let shown = tm ? tm.members : [];
    const tdd = sym && en() ? tdFor(await getTD(), sym) : null; if (cur !== m) return;
    if (tdd) {
      const [k, t] = tdd, by = {};
      t.trades.forEach(r => { (by[r.who] = by[r.who] || { who: r.who, p: r.p, dist: r.dist, ll: r.ll, rows: [] }).rows.push(r) });
      const hm = L.marker(t.hq, { icon: L.divIcon({ className: '', html: '<div class="mtMFstop" style="width:18px;height:18px;margin:-9px 0 0 -9px"></div>', iconSize: [0, 0] }), title: t.name + ' 8-K', zIndexOffset: 600 });
      hm.on('click', e => { L.DomEvent.stop(e); card(todayCard(k, t), t.hq) }); hm.addTo(layer); pts.push(t.hq);
      Object.values(by).forEach((x, j) => {
        const c = x.p === 'R' ? RED : BLU, delay = 300 + j * 260, sides = [...new Set(x.rows.map(r => r.side))].join('/');
        L.polyline([x.ll, t.hq], { color: OR, weight: 2, opacity: .85, dashArray: '6 5', interactive: false }).addTo(layer);
        const html = `<div class="mtMFdot"><div class="d" style="background:${c};animation-delay:${delay}ms"></div><div class="n" style="animation-delay:${delay + 120}ms"><span class="b" style="background:${c}">${x.p}</span><span class="b" style="background:${OR};color:#111">${sides}</span>${esc(x.who.split(' ').slice(-1)[0])} · ${x.rows.length} ${x.rows.length === 1 ? 'trade' : 'trades'}</div></div>`;
        const mk = L.marker(x.ll, { icon: L.divIcon({ className: 'mtMFdot', html, iconSize: [0, 0] }), title: x.who, zIndexOffset: 500 });
        mk.on('click', e => { L.DomEvent.stop(e); card(todayMemberCard(x, k, t), x.ll) }); mk.addTo(layer); pts.push(x.ll);
      });
      strip(k, t);
      const n = t.trades.length;
      SUM = ['◉ ' + t.name + ' (' + k + ')', [`${md(t.move.date)} close ${money(t.move.close)}, ${t.move.pct.toFixed(2)}% vs ${md(t.move.prevDate)}.`, `${t.filing.form} ${t.filing.item}, filed ${t.filing.filed}.`, n ? `${n} House PTR trade${n === 1 ? '' : 's'} in the 30 days before the ${t.filing.form}. Orange lines join each lawmaker to the company HQ.` : `No House PTR trades found in the 30 days before the ${t.filing.form}.`, 'Click or tap a dot for a short card.'].join('\n')]; paint();
      if (!n) setTimeout(() => card(todayCard(k, t), t.hq), 1500);
      const b = L.latLngBounds(pts.length > 1 ? pts : [t.hq, [t.hq[0] + 4, t.hq[1] + 6], [t.hq[0] - 4, t.hq[1] - 2]]).pad(.25);
      map.flyToBounds(b, { duration: 1.2, maxZoom: 5, paddingTopLeft: [40, 140], paddingBottomRight: [innerWidth > 900 ? 420 : 20, 120] });
      return;
    }
    shown.forEach((x, j) => {
      const c = x.p === 'R' ? RED : BLU, delay = 300 + j * 260;
      const html = `<div class="mtMFdot"><div class="d" style="background:${c};animation-delay:${delay}ms"></div><div class="n" style="animation-delay:${delay + 120}ms"><span class="b" style="background:${c}">${x.p}</span>${esc(x.name.split(' ').slice(-1)[0])}</div></div>`;
      const mk = L.marker(x.ll, { icon: L.divIcon({ className: 'mtMFdot', html, iconSize: [0, 0] }), title: x.name, zIndexOffset: 500 });
      mk.on('click', e => { L.DomEvent.stop(e); card(memberCard(x, sym), x.ll) }); mk.addTo(layer); pts.push(x.ll);
    });
    const fix = () => declutter(); setTimeout(fix, 50); map.on('zoomend moveend', fix); layer.on('remove', () => map.off('zoomend moveend', fix));
    // short summary in the side panel
    const cnt = {}; m.meta.forEach(t => { if (t.lat == null) return; const k = kindOf(t); cnt[k] = (cnt[k] || 0) + 1 });
    const parts = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${n} ${lab(k, n)}`);
    const name = m.title.replace(/\s*(경로|route)\s*$/i, '');
    const lines = [];
    lines.push(E ? `${name}: ${pts.length - shown.length} records on the map${parts.length ? ' (' + parts.join(', ') + ')' : ''}.` : `${name}: 지도 위 기록 ${pts.length - shown.length}곳${parts.length ? ' (' + parts.join(', ') + ')' : ''}.`);
    if (tm) {
      const more = tm.total - shown.length;
      lines.push(E ? `${tm.total} House member${tm.total === 1 ? '' : 's'} reported trades in ${sym} in the last 12 months. The ${shown.length} most recent are on the map${more > 0 ? `; ${more} more not shown` : ''}.`
        : `최근 12개월 ${sym} 거래를 신고한 하원의원 ${tm.total}명. 가장 최근 ${shown.length}명을 지도에 표시${more > 0 ? `, ${more}명은 생략` : ''}.`);
    }
    lines.push(E ? 'Click or tap a dot for a short card.' : '지도 위 점을 누르면 짧은 카드가 열려요.');
    SUM = ['◉ ' + name, lines.join('\n')]; paint();
    if (pts.length) map.flyToBounds(L.latLngBounds(pts).pad(.2), { duration: 1.2, maxZoom: 5, paddingTopLeft: [40, 80], paddingBottomRight: [innerWidth > 900 ? 420 : 20, 120] });
  }
  function hook() {
    const prev = window.mtAfterShow;
    window.mtAfterShow = function () {
      const r = prev && prev.apply(this, arguments);
      const m = window.mtCur && window.mtCur();
      if (!m || !/^company:/.test(m.ticker || '')) { if (cur) clear(); return r; }
      if (m !== cur) setup(m);
      else { const ti = $('briefTitle'), mm = ti && ti.textContent.match(/ · (\d+)\//), t = mm && m.meta[+mm[1] - 1]; if (t && t.lat != null) card(stopCard(t), [t.lat, t.lon]); paint(); }
      return r;
    };
    $('closeBrief') && $('closeBrief').addEventListener('click', clear);
    $('world') && $('world').addEventListener('click', clear);
  }
  // Deep link: ?ticker=AMZN opens straight to that ticker's map view.
  const tk = new URLSearchParams(location.search).get('ticker');
  if (tk && /^[A-Za-z.]{1,6}$/.test(tk) && !new URLSearchParams(location.search).get('q')) {
    let n = 0; const go = () => { const i = $('question'), f = $('ask'); if (!window.mtApi || !i || !f || !window.moneyTrackerMap) { if (++n < 60) setTimeout(go, 200); return } i.value = tk.toUpperCase(); f.requestSubmit() };
    addEventListener('load', () => setTimeout(go, 600));
  }
  const wait = () => (window.moneyTrackerMap && window.L && $('brief')) ? hook() : setTimeout(wait, 150);
  if (document.readyState === 'complete') wait(); else addEventListener('load', wait);
})();
