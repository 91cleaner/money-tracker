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
#mtTL{margin:2px 0 6px;font:12.5px/1.5 ui-monospace,monospace;color:#fff3b0}#mtTL a{color:#9effc0}#mtHubList{display:flex;flex-direction:column;gap:3px;margin:0 0 8px;max-height:38vh;overflow:auto}#mtHubList button{text-align:left;font:13px/1.4 system-ui,sans-serif;padding:5px 8px;border:1px solid #24493b;border-radius:4px;background:#0b1d16;color:#d8f5e3;cursor:pointer}#mtHubList button:hover{border-color:#5dff9e}#mtHubList .why{font:13px/1.4 system-ui,sans-serif;color:#8fa89a;padding:4px 2px}#mtHub button.empty{opacity:.55}#mtHub{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 8px}#mtHub button{font:600 11px ui-monospace,monospace;padding:3px 7px;border:1px solid #2f6b55;border-radius:4px;background:#0b1d16;color:#bfeccf;cursor:pointer}#mtHub button.on{background:#1f5a3f;color:#fff;border-color:#5bda91}#mtHub button:disabled{opacity:.35;cursor:default}
body.mt-solo #mtLegend{display:none!important}
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
.leaflet-popup.mtMF .leaflet-popup-content{width:min(280px,76vw)!important;margin:10px 12px;font:14px/1.5 system-ui,-apple-system,sans-serif}
.mtMF .k{font:600 10px/1.4 ui-monospace,monospace;letter-spacing:1px;color:#68c7d0;text-transform:uppercase}.mtMF .h{font-weight:700;color:#ffd60a;margin:2px 0}
.mtMF .r{font:13px ui-monospace,monospace;color:#d8f5e3}.mtMF .r b{color:${OR}}.mtMF .s{font-size:12px;color:#8fa89a;margin-top:4px}.mtMF a{color:#9effc0}
#mtToday{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:1200;max-width:min(860px,94vw);background:rgba(8,14,11,.92);border:1px solid rgba(255,159,10,.55);border-radius:6px;padding:8px 14px;font:600 13px/1.45 system-ui,-apple-system,sans-serif;color:#f2efe9;box-shadow:0 6px 24px rgba(0,0,0,.5);animation:mtMFfade .5s ease-out both;pointer-events:auto}
#mtToday .t{font:700 15px ui-monospace,monospace;color:#ffd60a;margin-right:8px}#mtToday .dn{color:#ff6b5e}#mtToday .up{color:#5fd38a}#mtToday .m{color:#8fa89a;font-weight:500;font-size:11.5px}#mtToday a{color:#9effc0}
.mtMFdot.dim{opacity:.35}
@media (prefers-reduced-motion:reduce){.mtMFdot .d,.mtMFdot .n,.mtMFstop{animation:none}}`;
  document.head.append(css);

  function card(html, ll) {
    const map = window.moneyTrackerMap; if (popup) map.removeLayer(popup);
    popup = L.popup({ className: 'mtTour mtMF', closeButton: true, autoPan: true, autoPanPadding: [40, 90], maxWidth: 290, offset: [0, -6] }).setLatLng(ll).setContent(html).openOn(map);
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
  function clear() { unisolate(); SUM = null; G = {}; ['mtHub', 'mtTL', 'mtHubList'].forEach(i => { const h = $(i); if (h) h.remove() }); TL = null; const st = $('mtToday'); if (st) st.remove(); const map = window.moneyTrackerMap; if (layer) map.removeLayer(layer); layer = null; cur = null; if (popup) { map.removeLayer(popup); popup = null } document.body.classList.remove('mt-mapfirst'); }

  // Ticker hub: sub-tabs inside one ticker view; each tab shows only that kind of linked record on the map.
  let G = {}, FR = null;
  const getFR = () => FR || (FR = fetch('../data/fr/presidential.json').then(r => r.ok ? r.json() : null).catch(() => null));
  const inUS = ll => ll[0] > 18 && ll[0] < 72 && ll[1] > -170 && ll[1] < -60;
  function grpOf(t) { const rf = String(t.ref || '').split(':')[0]; if (rf === 'uswh') return 'wh'; if (/^(cnpol|jppol|twpol|eupol)$/.test(rf)) return 'cty'; if (rf === 'krbill') return 'bill'; const k = kindOf(t); if (k === 'insider') return 'ins'; if (k === 'bill') return 'bill'; if (k === 'trade' || k === 'cmte') return 'law'; if (k === 'supply') return 'hq'; if (!inUS([t.lat, t.lon])) return 'cty'; return 'fil'; }
  function reg(g, mk, html, ll, lab) { (G[g] = G[g] || []).push({ mk, html, ll, lab }); }
  const TABS = [['all', 'All', '전체'], ['hq', 'Company', '회사'], ['law', 'Lawmakers', '의원'], ['ins', 'Insiders', '임원'], ['bill', 'Bills', '법안'], ['cty', 'Countries', '나라'], ['wh', 'White House', '백악관'], ['fil', 'Filings', '공시·기록']];
  function whCard(sym, list) {
    const E = en();
    return `<div class="k">${esc(sym)} · ${E ? 'White House / Federal Register' : '백악관 / 연방관보'}</div>` + list.slice(0, 3).map(x => {
      const mv = (x.moves || []).find(m => m.sym === sym);
      return `<div class="h" style="font-size:12px">${esc(E ? x.type_en : x.type)} · ${esc(x.date)}</div><div class="s" style="color:#bfffd6">${esc(String(E ? (x.easy_en || x.title) : (x.easy_ko || x.title)).slice(0, 130))}</div>` +
        (mv ? `<div class="r">${esc(sym)} ${esc(mv.from)} → ${esc(mv.to)}: <b>${mv.pct > 0 ? '+' : ''}${mv.pct}%</b></div>` : '') + (x.url ? `<div class="s"><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${E ? 'Official record' : '원문 기록'} ›</a></div>` : '');
    }).join('') + `<div class="s">${E ? 'Same-period price change only; it does not show a reason.' : '같은 기간 가격 변화일 뿐 이유를 뜻하지 않아요.'}</div>`;
  }
  let DS = null; const getDS = () => DS || (DS = fetch('./dossier.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null));
  function dossierCard(sym, o) {
    const E = en(), im = (x, alt, w, h) => x ? `<figure style="margin:0;flex:0 0 ${w}px"><img src="${esc(x.src)}" alt="${esc(alt)}" style="width:${w}px;height:${h}px;object-fit:cover;border:1px solid #2f6b55;border-radius:3px;display:block"><figcaption style="font-size:8.5px;line-height:1.25;color:#7f978a;margin-top:2px">${esc(x.credit)}, <a href="${esc(x.page)}" target="_blank" rel="noopener noreferrer">${esc(x.license)}</a></figcaption></figure>` : '';
    return `<div class="k">${esc(sym)} · ${E ? 'Dossier' : '기업 요약'}</div><div style="display:flex;gap:8px;margin:4px 0">${im(o.ceoImg, o.ceo, 96, 120)}${im(o.hqImg, 'HQ', 150, 120)}</div>` +
      `<div class="r">${E ? 'HQ' : '본사'}: <b>${esc(o.hq)}</b></div><div class="r">${esc(o.ceoTitle)}: <b>${esc(o.ceo)}</b></div><div class="s">${E ? 'Images: Wikimedia Commons. Leadership as of Oct 30, 2026.' : '사진: 위키미디어 공용. 경영진은 2026-10-30 기준.'}</div>`;
  }
  async function hub(sym) {
    { const my0 = cur, dd = await getDS(); const o = dd && dd.tickers && dd.tickers[sym];
      if (o && cur === my0 && layer && !G.ds) { G.ds = 1; const mk = L.marker(o.ll, { icon: L.divIcon({ className: '', html: '<div class="mtMFstop" style="width:18px;height:18px;margin:-9px 0 0 -9px;background:#ffd60a"></div>', iconSize: [0, 0] }), title: o.hq, zIndexOffset: 700 });
        mk.on('click', e => { L.DomEvent.stop(e); card(dossierCard(sym, o), o.ll) }); mk.addTo(layer); reg('hq', mk, () => dossierCard(sym, o), o.ll);
        const map = window.moneyTrackerMap; setTimeout(() => { if (cur !== my0) return; map.flyTo(o.ll, 6, { duration: 1.2 }); setTimeout(() => { if (cur === my0) card(dossierCard(sym, o), o.ll) }, 1300) }, 2800); } }
    { const my1 = cur, x = await getTX(), dd = await getDS(); const e = x && x.tickers && x.tickers[sym], o = dd && dd.tickers && dd.tickers[sym]; if (cur !== my1 || !layer) return;
      if (e && e.k8 && o && !G.k8) { G.k8 = 1; e.k8.forEach(f => reg('fil', null, () => k8Card(sym, f), o.ll, '8-K · ' + f.d + (f.items.length ? ' · Item ' + f.items.join(', ') : ''))); }
      if (e && e.bills && !G.bl) { G.bl = 1; const cap = [38.8899, -77.0091]; e.bills.forEach(b => reg('bill', null, () => billCard(sym, b), cap, b.no + ' · ' + b.n.slice(0, 70) + ' · ' + b.d)); }
      TL = e && e.tl ? e : null; }
    const my = cur, d = await getFR(); if (cur !== my || !layer) return;
    const wl = d && d.items ? d.items.filter(x => (x.moves || []).some(m => m.sym === sym)).sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
    if (wl.length && !G.wh) { const ll = [38.8977, -77.0365]; const mk = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="mtMFstop" style="background:#e8e8e8"></div>', iconSize: [0, 0] }), title: 'White House', zIndexOffset: 550 });
      mk.on('click', e => { L.DomEvent.stop(e); card(whCard(sym, wl), ll) }); mk.addTo(layer); reg('wh', mk, () => whCard(sym, wl), ll); }
    let bar = $('mtHub'); if (!bar) { bar = document.createElement('div'); bar.id = 'mtHub'; }
    let lst = $('mtHubList'); if (!lst) { lst = document.createElement('div'); lst.id = 'mtHubList'; }
    let tl = $('mtTL'); if (!tl) { tl = document.createElement('div'); tl.id = 'mtTL'; }
    const ti = $('briefTitle'); if (ti && ti.parentNode && bar.parentNode !== ti.parentNode) ti.after(bar); bar.after(tl); tl.after(lst);
    tl.replaceChildren(); if (TL) { const t = TL.tl, E2 = en(), a = (h, x) => { const z = document.createElement('a'); z.href = h; z.target = '_blank'; z.rel = 'noopener noreferrer'; z.textContent = x; return z };
      tl.append((E2 ? 'Timeline: ' : '타임라인: ') + (E2 ? 'trade ' : '거래 '), a(t.trade_url, t.trade_date), ` (${t.src}, ${t.who}, ${t.side})` + ' · ' + (E2 ? (t.event_kind === '8-K' ? '8-K filed ' : 'policy dated ') : (t.event_kind === '8-K' ? '8-K 제출 ' : '정책 일자 ')), a(t.event_url, t.event_date), ' · ' + (E2 ? `${t.days_before} days apart` : `${t.days_before}일 차이`)); }
    const E = en(), same = bar.dataset.sym === sym && bar.children.length === TABS.length; bar.dataset.sym = sym;
    // Update labels in place when the same ticker re-renders, so a click in progress is not lost to a rebuilt button.
    TABS.forEach(([k, e, ko], i) => { const n = k === 'all' ? null : (G[k] || []).length; let b = same ? bar.children[i] : null;
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.onclick = ev => { ev.stopPropagation(); pick(k) }; if (i === 0) bar.replaceChildren(); bar.append(b); }
      const tx = (E ? e : ko) + (n == null ? '' : ' ' + n); if (b.textContent !== tx) b.textContent = tx; b.classList.toggle('empty', n === 0) });
    const on = same && bar.querySelector('button.on'); pick(on ? on.dataset.k : 'all', true);
  }
  let TX = null, TL = null; const getTX = () => TX || (TX = fetch('./ticker-extra.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null));
  const k8Card = (sym, f) => `<div class="k">${esc(sym)} · SEC 8-K</div><div class="h">${en() ? 'Filed' : '제출'} ${esc(f.d)}</div>${f.items.length ? `<div class="r">Item ${esc(f.items.join(', '))}</div>` : ''}<div class="s"><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${en() ? 'Official record' : '원문 기록'} ›</a></div>`;
  const billCard = (sym, b) => `<div class="k">${esc(sym)} · ${en() ? 'US bill (title keyword match)' : '미국 법안(제목 키워드 일치)'}</div><div class="h">${esc(b.no)} · ${esc(b.n)}</div><div class="r">${en() ? 'Sponsor' : '발의'}: <b>${esc(b.sp)}</b>${b.tr ? (en() ? ' (also traded this stock)' : ' (이 종목 거래 신고 의원)') : ''} · ${esc(b.d)}</div>${b.a ? `<div class="s">${esc(b.a)}</div>` : ''}<div class="s"><a href="${esc(b.u)}" target="_blank" rel="noopener noreferrer">Congress.gov ›</a> · ${en() ? 'Keyword match only; it does not show an effect.' : '키워드 일치일 뿐 영향을 뜻하지 않아요.'}</div>`;
  const labOf = h => { const d = document.createElement('div'); d.innerHTML = h; const a = d.querySelector('.h') || d.querySelector('.k'); return (a ? a.textContent : d.textContent).slice(0, 90); };
  const EMPTY = { hq: ['No company profile collected for this ticker yet.', '이 종목의 회사 정보는 아직 수집되지 않았어요.'], law: ['No congressional trades or committee links found in the collected filings.', '수집된 신고서에서 의원 거래나 위원회 연결이 없어요.'], ins: ['No Form 4 insider trades in the collected window (US-listed only).', '수집 기간에 Form 4 임원 거래가 없어요(미국 상장사만 해당).'], bill: ['No bills matched this company in the collected period.', '수집 기간에 이 회사와 맞는 법안이 없어요.'], cty: ['No foreign policy records matched this company.', '이 회사와 맞는 해외 정책 기록이 없어요.'], wh: ['No White House or Federal Register item with a price move for this ticker.', '이 종목의 가격 변화와 함께 기록된 백악관·연방관보 항목이 없어요.'], fil: ['No SEC filings or other public records collected for this ticker.', '이 종목의 SEC 공시나 공개 기록이 아직 없어요.'] };
  function pick(k, quiet) {
    const map = window.moneyTrackerMap, bar = $('mtHub'); if (bar) [...bar.children].forEach(b => b.classList.toggle('on', b.dataset.k === k));
    const lines = layer ? layer.getLayers().filter(l => l instanceof L.Polyline) : [];
    Object.entries(G).forEach(([g, arr]) => Array.isArray(arr) && arr.forEach(o => { if (!o.mk) return; const vis = k === 'all' || g === k; if (vis && !layer.hasLayer(o.mk)) o.mk.addTo(layer); if (!vis && layer.hasLayer(o.mk)) layer.removeLayer(o.mk); }));
    lines.forEach(l => { const el = l.getElement && l.getElement(); if (el) el.style.display = (k === 'all' || k === 'law') ? '' : 'none' });
    const lst = $('mtHubList'); if (!lst) return; if (quiet && k !== 'all' && lst.childElementCount) return; lst.replaceChildren(); if (k === 'all') return; const arr = G[k] || [], E = en();
    if (!arr.length) { const r = document.createElement('div'); r.className = 'why'; r.textContent = (EMPTY[k] || EMPTY.fil)[E ? 0 : 1]; lst.append(r); return; }
    arr.forEach(o => { const b = document.createElement('button'); b.type = 'button'; b.textContent = o.lab || labOf(o.html()); b.onclick = ev => { ev.stopPropagation(); map.flyTo(o.ll, Math.max(map.getZoom(), 5), { duration: .9 }); setTimeout(() => card(o.html(), o.ll), 950); setTimeout(declutter, 1100); }; lst.append(b); });
  }
  // Clean ticker view: hide other layers' lines, dots and labels while a ticker is open (restored on clear).
  let hid = [], onAdd = null;
  const ours = l => (layer && layer.hasLayer(l)) || (tlayer && tlayer.hasLayer(l)) || l === layer || l === tlayer || l === popup;
  const skip = l => l instanceof L.TileLayer || l instanceof L.Popup || l instanceof L.Tooltip || l instanceof L.LayerGroup;
  function hideOne(l) { if (ours(l) || skip(l)) return; const el = l.getElement && l.getElement(); if (el && el.style.display !== 'none') { el.style.display = 'none'; hid.push(el); } }
  function isolate() { const map = window.moneyTrackerMap; if (window.mtUsLayer) window.mtUsLayer.hide(); map.eachLayer(hideOne); if (!onAdd) { onAdd = e => setTimeout(() => { if (onAdd) hideOne(e.layer) }, 0); map.on('layeradd', onAdd); } document.body.classList.add('mt-solo'); }
  function unisolate() { const map = window.moneyTrackerMap; if (onAdd && map) map.off('layeradd', onAdd); onAdd = null; hid.forEach(el => el.style.display = ''); hid = []; document.body.classList.remove('mt-solo'); }
  async function setup(m) {
    const map = window.moneyTrackerMap, E = en(); clear(); cur = m; document.body.classList.add('mt-mapfirst');
    map.fire('click'); // pause the auto tour; cards open on click instead
    layer = L.layerGroup().addTo(map); isolate();
    const pts = [];
    m.meta.forEach((t, i) => {
      if (t.lat == null) return; pts.push([t.lat, t.lon]);
      const mk = L.marker([t.lat, t.lon], { icon: L.divIcon({ className: '', html: `<div class="mtMFstop" style="animation-delay:${Math.min(i, 12) * 90}ms"></div>`, iconSize: [0, 0] }), keyboard: true, title: t.title || t.region });
      mk.on('click', e => { L.DomEvent.stop(e); card(stopCard(t), [t.lat, t.lon]) }); mk.addTo(layer); reg(grpOf(t), mk, () => stopCard(t), [t.lat, t.lon]);
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
      hm.on('click', e => { L.DomEvent.stop(e); card(todayCard(k, t), t.hq) }); hm.addTo(layer); reg('hq', hm, () => todayCard(k, t), t.hq); pts.push(t.hq);
      Object.values(by).forEach((x, j) => {
        const c = x.p === 'R' ? RED : BLU, delay = 300 + j * 260, sides = [...new Set(x.rows.map(r => r.side))].join('/');
        L.polyline([x.ll, t.hq], { color: OR, weight: 2, opacity: .85, dashArray: '6 5', interactive: false }).addTo(layer);
        const html = `<div class="mtMFdot"><div class="d" style="background:${c};animation-delay:${delay}ms"></div><div class="n" style="animation-delay:${delay + 120}ms"><span class="b" style="background:${c}">${x.p}</span><span class="b" style="background:${OR};color:#111">${sides}</span>${esc(x.who.split(' ').slice(-1)[0])} · ${x.rows.length} ${x.rows.length === 1 ? 'trade' : 'trades'}</div></div>`;
        const mk = L.marker(x.ll, { icon: L.divIcon({ className: 'mtMFdot', html, iconSize: [0, 0] }), title: x.who, zIndexOffset: 500 });
        mk.on('click', e => { L.DomEvent.stop(e); card(todayMemberCard(x, k, t), x.ll) }); mk.addTo(layer); pts.push(x.ll); reg('law', mk, () => todayMemberCard(x, k, t), x.ll);
      });
      strip(k, t); hub(sym);
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
      mk.on('click', e => { L.DomEvent.stop(e); card(memberCard(x, sym), x.ll) }); mk.addTo(layer); pts.push(x.ll); reg('law', mk, () => memberCard(x, sym), x.ll);
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
    SUM = ['◉ ' + name, lines.join('\n')]; paint(); if (sym) hub(sym);
    if (pts.length) map.flyToBounds(L.latLngBounds(pts).pad(.2), { duration: 1.2, maxZoom: 5, paddingTopLeft: [40, 80], paddingBottomRight: [innerWidth > 900 ? 420 : 20, 120] });
  }
  function hook() {
    const prev = window.mtAfterShow;
    window.mtAfterShow = function () {
      const r = prev && prev.apply(this, arguments);
      const m = window.mtCur && window.mtCur();
      if (!m || !/^company:/.test(m.ticker || '')) { if (cur) clear(); return r; }
      if (m !== cur) { tclear(); setup(m); }
      else { const ti = $('briefTitle'), mm = ti && ti.textContent.match(/ · (\d+)\//), t = mm && m.meta[+mm[1] - 1]; if (t && t.lat != null) card(stopCard(t), [t.lat, t.lon]); paint(); }
      return r;
    };
    $('closeBrief') && $('closeBrief').addEventListener('click', clear);
    $('world') && $('world').addEventListener('click', clear);
  }
  // Topic buttons (TRACKING OPTIONS): show lawmakers who traded the topic's tickers as party dots with short cards.
  const TOPICS = [
    ['Semiconductor supply chain', '반도체 공급망', 'NVDA TSM INTC AMD MU AVGO QCOM ASML AMAT'],
    ['US interest rates and the stock market', '미국 금리와 주식시장', 'JPM BAC GS WFC MS SCHW'],
    ['Energy and geopolitics', '에너지와 지정학', 'XOM CVX COP OXY SLB'],
    ['Trade and tariffs', '무역과 관세', 'AAPL CAT DE F GM NKE WMT'],
    ['US defense', '미국 국방·방산', 'LMT RTX NOC GD BA LHX']];
  let tlayer = null;
  function tclear() { const map = window.moneyTrackerMap; if (tlayer && map) map.removeLayer(tlayer); tlayer = null; const st = $('mtTopic'); if (st) st.remove(); }
  function topicCard(x) {
    const E = en(), pn = x.p === 'R' ? (E ? 'Republican' : '공화당') : (E ? 'Democrat' : '민주당');
    const rows = x.rows.slice(0, 5).map(r => `<div class="r"><b>${esc(r.sym)}</b> ${esc(r.l.s)} ${esc(r.l.amt)} · ${esc(r.l.d)}</div>`).join('');
    const more = x.rows.length > 5 ? `<div class="s">${E ? `${x.rows.length - 5} more tickers` : `외 ${x.rows.length - 5}개 종목`}</div>` : '';
    return `<div class="k">${E ? 'Topic' : '주제'} · House PTR</div><div class="h">${esc(x.name)}</div><div>${pn} · ${esc(x.dist)}</div>${rows}${more}` +
      `<div class="s"><a href="${esc(x.rows[0].l.doc)}" target="_blank" rel="noopener noreferrer">PTR filing ›</a> · ${E ? 'Latest reported trade per ticker. Amounts are reported ranges. Dot is an approximate district location.' : '종목별 최근 신고 거래. 금액은 신고 구간. 점은 지역구 대략 위치.'}</div>`;
  }
  async function topic(i) {
    const T = TOPICS[i]; if (!T) return; const map = window.moneyTrackerMap, E = en();
    clear(); tclear(); if (window.mtUsLayer) window.mtUsLayer.hide(); const my = tlayer = L.layerGroup().addTo(map);
    const d = await getTM(); if (tlayer !== my) return;
    const syms = T[2].split(' '), by = {}, seen = [];
    syms.forEach(sym => { const t = d && d.tickers && d.tickers[sym]; if (!t) return; seen.push(sym); t.members.forEach(m => {
      const x = by[m.name] = by[m.name] || { name: m.name, p: m.p, dist: m.dist, ll: m.ll, rows: [] };
      x.rows.push({ sym, l: m.last[0] }); }) });
    const list = Object.values(by); list.forEach(x => x.rows.sort((a, b) => String(b.l.d).localeCompare(String(a.l.d))));
    const pts = [];
    list.forEach((x, j) => {
      if (!x.ll) return; const c = x.p === 'R' ? RED : BLU, delay = 200 + Math.min(j, 20) * 90;
      const html = `<div class="mtMFdot"><div class="d" style="background:${c};animation-delay:${delay}ms"></div><div class="n" style="animation-delay:${delay + 120}ms"><span class="b" style="background:${c}">${x.p}</span>${esc(x.name.split(' ').slice(-1)[0])} · ${esc(x.rows.slice(0, 3).map(r => r.sym).join(' '))}</div></div>`;
      const mk = L.marker(x.ll, { icon: L.divIcon({ className: 'mtMFdot', html, iconSize: [0, 0] }), title: x.name, zIndexOffset: 500 });
      mk.on('click', e => { L.DomEvent.stop(e); card(topicCard(x), x.ll) }); mk.addTo(my); pts.push(x.ll);
    });
    const fix = () => declutter(); setTimeout(fix, 80); map.on('zoomend moveend', fix); my.on('remove', () => map.off('zoomend moveend', fix));
    let el = document.createElement('div'); el.id = 'mtTopic'; el.setAttribute('style', 'position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:1200;max-width:min(760px,90vw);background:rgba(8,14,11,.92);border:1px solid rgba(104,199,208,.5);border-radius:6px;padding:7px 12px;font:600 12.5px/1.45 system-ui,-apple-system,sans-serif;color:#f2efe9');
    el.textContent = (E ? T[0] : T[1]) + ' · ' + seen.join(' ') + ' — ' + (E ? `${list.length} House member${list.length === 1 ? '' : 's'} reported trades in these tickers in the last 12 months. Click a dot for a short card.` : `최근 12개월 이 종목들을 거래 신고한 하원의원 ${list.length}명. 점을 누르면 짧은 카드가 열려요.`);
    document.body.append(el);
    setTimeout(() => map.fire('click'), 350);
    if (pts.length) setTimeout(() => map.flyToBounds(L.latLngBounds(pts).pad(.15), { duration: 1.2, maxZoom: 5, paddingTopLeft: [40, 120], paddingBottomRight: [innerWidth > 900 ? 420 : 20, 120] }), 400);
  }
  window.mtTopicLayer = { show: topic, clear: tclear, topics: TOPICS };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#topics button');
    if (b) { const i = [...b.parentNode.querySelectorAll('button')].indexOf(b); setTimeout(() => topic(i), 300); return; }
    if (e.target.closest && e.target.closest('#world,#closeBrief,#ask button')) tclear();
  }, true);
  document.addEventListener('submit', e => { if (e.target && e.target.id === 'ask') tclear(); }, true);
  // Deep link: ?ticker=AMZN opens straight to that ticker's map view.
  const tk = new URLSearchParams(location.search).get('ticker');
  if (tk && /^[A-Za-z0-9.]{1,12}$/.test(tk) && !new URLSearchParams(location.search).get('q')) {
    let n = 0; const go = () => { const i = $('question'), f = $('ask'); if (!window.mtApi || !i || !f || !window.moneyTrackerMap) { if (++n < 60) setTimeout(go, 200); return } i.value = tk.toUpperCase(); f.requestSubmit() };
    addEventListener('load', () => setTimeout(go, 600));
  }
  const wait = () => (window.moneyTrackerMap && window.L && $('brief')) ? hook() : setTimeout(wait, 150);
  if (document.readyState === 'complete') wait(); else addEventListener('load', wait);
})();
