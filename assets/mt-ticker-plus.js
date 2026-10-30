/* Ticker encyclopedia extras (TRACKING OPTIONS > ticker). Facts from collected public filings only.
   Data: world-intelligence/ticker-trades.json (PTR transaction date vs. report filed date).
   No causal wording, no advice, no return figures. */
(() => {
  const $ = i => document.getElementById(i), en = () => !!(window.MTI18N && window.MTI18N.isEn);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = s => { if (!en() || !s) return s || ''; const d = new Date(s + 'T00:00:00Z'); return isNaN(d) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
  let TT = null; const getTT = () => TT || (TT = fetch('./ticker-trades.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null));
  const cur = () => { const m = window.mtCur && window.mtCur(); return m && /^company:/.test(m.ticker || '') ? m.ticker.slice(8) : null; };
  const lc = n => n > 45 ? 'r' : n > 30 ? 'o' : '';
  const party = p => p === 'R' ? '#ff5c5c' : p === 'D' ? '#5ca8ff' : '#bbb';
  const css = document.createElement('style'); css.textContent = `
.mtTag{display:inline-block;margin:1px 3px 1px 0;padding:0 4px;border:1px solid #ffd60a;border-radius:3px;font:600 10px ui-monospace,monospace;color:#ffd60a}.mtFlag .d{box-shadow:0 0 0 3px #ffd60a!important}#mtPlus .row.flag{border-color:#ffd60a}.mtLate{display:inline-block;margin-left:4px;padding:0 4px;border-radius:3px;font:700 10px ui-monospace,monospace;background:#1d3a2c;color:#d8f5e3}.mtLate.o{background:#ff9f0a;color:#111}.mtLate.r{background:#ff453a;color:#fff}
#mtPlus{margin:6px 0 8px;font:13px/1.45 system-ui,sans-serif;color:#d8f5e3}#mtPlus h4{margin:8px 0 3px;font:700 11px ui-monospace,monospace;letter-spacing:.06em;color:#68c7d0;text-transform:uppercase}
#mtPlus .row{width:100%;text-align:left;color:inherit;font:inherit;display:flex;gap:6px;align-items:center;justify-content:space-between;padding:4px 6px;border:1px solid #24493b;border-radius:4px;margin:2px 0;background:#0b1d16;cursor:pointer}#mtPlus .row:hover{border-color:#5dff9e}
#mtPlus .pp{display:inline-block;width:16px;text-align:center;border-radius:3px;font:700 10px ui-monospace,monospace;color:#111;margin-right:4px}#mtPlus small{color:#8fa89a}.mtRich .leaflet-popup-content{max-height:52vh;overflow:auto}.mtMF .mtEnr{max-height:34vh;overflow:auto}.mtSave{margin:3px 0 0;padding:2px 8px;border:1px solid #5dff9e;border-radius:3px;background:#0b1d16;color:#5dff9e;font:600 11px ui-monospace,monospace;cursor:pointer}`;
  document.head.append(css);
  const S = { sym: null, rows: null }; window.mtTickerPlus = S;
  // Latest trade per member (rows are sorted by filed date, newest first).
  const perWho = rows => { const o = {}; rows.forEach(r => { if (!o[r.who]) o[r.who] = r; }); return o; };
  function lateTag(r) { const E = en(); return `<span class="mtLate ${lc(r.late)}" title="${E ? 'Days between the trade and the report. The law (STOCK Act) gives lawmakers 45 days.' : '거래한 날부터 신고한 날까지 걸린 날짜예요. 법(STOCK Act)은 45일 안에 신고하라고 해요.'}">+${r.late}${E ? 'd' : '일'}</span>`; }
  function decorateDots() {
    if (!S.rows) return; const W = perWho(S.rows);
    document.querySelectorAll('.leaflet-marker-pane .leaflet-marker-icon[title]').forEach(el => {
      const r = W[el.getAttribute('title')]; const n = el.querySelector('.n'); if (!r || !n || n.querySelector('.mtLate')) return; n.insertAdjacentHTML('beforeend', lateTag(r)); if (S.rows.some(x => x.who === r.who && x.tags)) { el.classList.add('mtFlag'); const t = (S.rows.find(x => x.who === r.who && x.tags).tags[0]); n.insertAdjacentHTML('beforeend', `<span class="mtTag">${esc(tagShort(t))}</span>`); }
    });
  }
  function decorateCard() {
    if (!S.rows) return; const c = document.querySelector('.leaflet-popup.mtMF .leaflet-popup-content'); if (!c || c.querySelector('.mtLateLine')) return;
    const k = c.querySelector('.k'), h = c.querySelector('.h'); if (!k || !h || !/PTR/.test(k.textContent)) return;
    const mine = S.rows.filter(r => r.who === h.textContent.trim()); if (!mine.length) return; const E = en();
    const d = document.createElement('div'); d.className = 'mtLateLine r'; d.style.cssText = 'margin-top:4px;font:12px ui-monospace,monospace';
    d.innerHTML = mine.slice(0, 3).map(r => `${E ? 'Traded' : '거래'} ${esc(md(r.d))} · ${E ? 'filed' : '신고'} ${esc(md(r.f))} ${lateTag(r)}` + (r.tags ? '<div style="font:11px/1.4 system-ui,sans-serif;color:#ffd60a">' + r.tags.map(g => esc(tagText(g))).join('<br>') + '</div>' : '')).join('<br>'); if (mine.some(r => r.tags)) c.parentNode.style.outline = '2px solid #ffd60a';
    d.append(document.createElement('br'), saveBtn(mine[0])); k.parentNode.insertBefore(d, k.nextSibling.nextSibling || null);
  }
  // Unusual-trade tags (computed in build_ticker_extra.py; dates only, no causal wording).
  function tagText(g) { const E = en(), rg = S.range ? md(S.range[0]) : '';
    if (g.t === 'first') return E ? `This lawmaker\'s first trade in this stock that we have on record (since ${rg})` : `우리 기록(${rg}부터)에서 이 의원이 이 종목을 처음 거래했어요`;
    if (g.t === 'bill') return E ? `Within 30 days of a related bill action (${g.no}, ${md(g.bd)}, ${Math.abs(g.n)} days ${g.n >= 0 ? 'after' : 'before'} the trade)` : `관련 법안 일정 30일 이내 (${g.no}, ${g.bd}, 거래 ${Math.abs(g.n)}일 ${g.n >= 0 ? '후' : '전'})`;
    if (g.t === 'late') return E ? 'Filed after 45 days' : '45일 지나 신고';
    if (g.t === '8k') return E ? `Within 30 days before an 8-K (filed ${md(g.kd)}, ${g.n} days later)` : `8-K(회사 중요 사건 공시) 제출 30일 이내 전 거래 (${g.kd}, ${g.n}일 뒤)`;
    return ''; }
  const tagShort = g => { const E = en(); return { first: E ? 'First trade' : '첫 거래', bill: E ? 'Bill near trade' : '법안과 가까움', late: E ? 'Reported late' : '늦게 신고', '8k': E ? 'Big news within 30 days' : '30일 안 큰 소식' }[g.t] || ''; };
  const tagChips = r => (r.tags || []).map(g => `<span class="mtTag" title="${esc(tagText(g))}">${esc(tagShort(g))}</span>`).join('');
  // Share card: PNG rendered in the browser with canvas. No server.
  function saveCard(r, sym) {
    const E = en(), W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#06130e'; x.fillRect(0, 0, W, H); x.strokeStyle = '#5dff9e'; x.lineWidth = 4; x.strokeRect(14, 14, W - 28, H - 28);
    x.fillStyle = '#5dff9e'; x.font = '700 92px ui-monospace,monospace'; x.fillText(sym, 60, 140);
    x.fillStyle = party(r.p); x.fillRect(60, 180, 44, 44); x.fillStyle = '#111'; x.font = '700 30px ui-monospace,monospace'; x.fillText(r.p || '?', 71, 213);
    x.fillStyle = '#ffffff'; x.font = '700 46px system-ui,sans-serif'; x.fillText(r.who, 124, 218);
    const ln = [[E ? 'Trade date' : '거래일', md(r.d)], [E ? 'Filing date' : '신고일', md(r.f)], [E ? 'Days apart' : '간격', r.late + (E ? ' days' : '일')], [E ? 'Type / amount' : '구분 / 금액', (r.ty === 'P' ? (E ? 'Buy' : '매수') : r.ty === 'S' ? (E ? 'Sell' : '매도') : r.ty) + ' · ' + (r.amt || '')], [E ? 'Source' : '출처', ((r.ch === 'S' ? 'Senate' : 'House') + ' PTR' + (r.doc ? ' · ' + String(r.doc).split('/').pop() : ''))]];
    x.font = '32px system-ui,sans-serif'; ln.forEach((l, i) => { x.fillStyle = '#8fa89a'; x.fillText(l[0], 60, 300 + i * 52); x.fillStyle = l[0] === ln[2][0] ? (r.late > 45 ? '#ff453a' : r.late > 30 ? '#ff9f0a' : '#d8f5e3') : '#d8f5e3'; x.fillText(String(l[1]).slice(0, 60), 360, 300 + i * 52); });
    x.fillStyle = '#68c7d0'; x.font = '24px ui-monospace,monospace'; x.fillText('https://91cleaner.github.io/money-tracker/world-intelligence/?lang=en&q=' + sym, 60, 590);
    c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${sym}-${r.who.replace(/\W+/g, '_')}-${r.d}.png`; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png');
    return c;
  }
  S.saveCard = saveCard;
  const saveBtn = r => { const b = document.createElement('button'); b.className = 'mtSave'; b.textContent = en() ? 'Save card' : '카드 저장'; b.onclick = e => { e.stopPropagation(); saveCard(r, S.sym); }; return b; };
  // Detail cards: every list item flies the map and opens a card. Facts from collected public records only.
  const J = {}; const getJ = u => J[u] || (J[u] = fetch(u).then(r => r.ok ? r.json() : null).catch(() => null));
  let TX = null; const getTX = () => TX || (TX = fetch('./ticker-extra.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null));
  const pct = (a, b) => ((b - a) / a * 100).toFixed(1);
  const lnk = (u, t) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)} ›</a>` : '';
  const side = ty => { const E = en(); return ty === 'P' ? (E ? 'Buy' : '매수') : ty === 'S' ? (E ? 'Sell' : '매도') : ty === 'E' ? (E ? 'Exchange' : '교환') : esc(ty); };
  function pcLine(r) { const E = en(); if (!r.pc) return ''; const [d0, c0, d1, c1] = r.pc, v = pct(c0, c1);
    return `<div class="s">${E ? 'Close' : '종가'} ${esc(md(d0))} $${c0} → ${esc(md(d1))} $${c1}: <b>${v > 0 ? '+' : ''}${v}%</b> <small>(${E ? 'window' : '기간'} ${esc(d0)}–${esc(d1)})</small></div>`; }
  async function memberHTML(id, who) {
    const E = en(), [mm, tt, bl] = await Promise.all([getJ('../data/us/members.json'), getTT(), id ? getJ(`../data/us/bills/${id}.json`) : null]);
    const m = ((mm && mm.members) || []).find(x => x.id === id) || {};
    const pn = m.party === 'R' ? (E ? 'Republican' : '공화당') : m.party === 'D' ? (E ? 'Democrat' : '민주당') : (m.party || '');
    const dist = m.chamber === 'sen' ? `${m.state || ''} ${E ? 'Senator' : '상원'}` : `${m.state || ''}${m.district != null ? '-' + m.district : ''} ${E ? 'Representative' : '하원'}`;
    const mine = []; Object.entries((tt && tt.tickers) || {}).forEach(([k, v]) => v.forEach(r => { if ((id && r.id === id) || (!id && r.who === who)) mine.push([k, r]); }));
    mine.sort((a, b) => b[1].d.localeCompare(a[1].d));
    const bills = (Array.isArray(bl) ? bl : []).slice().sort((a, b) => String(b.d).localeCompare(String(a.d))).slice(0, 5);
    return `<div class="k">${E ? 'Member' : '의원'} · ${esc(S.sym || '')}</div><div class="h">${esc(m.name || who)}</div><div>${esc(pn)} · ${esc(dist)}</div>` +
      `<div class="r" style="margin-top:4px"><b>${E ? 'Bills this lawmaker wrote and introduced (newest first, from Congress.gov)' : '이 의원이 직접 내놓은 법안 (최신순, Congress.gov 자료)'}</b></div>` +
      (bills.length ? bills.map(b => `<div class="s">${lnk(b.u, b.no)} ${esc(String(b.n).slice(0, 80))} · ${esc(md(b.d))}</div>`).join('') : `<div class="s">${E ? 'None collected.' : '수집된 법안 없음.'}</div>`) +
      `<div class="r" style="margin-top:4px"><b>${E ? 'Trades in the stocks we follow' : '우리가 보는 종목의 거래'}</b> (${mine.length})</div>` +
      mine.slice(0, 6).map(([k, r]) => `<div class="s" style="color:#d8f5e3"><b>${esc(k)}</b> ${side(r.ty)} · ${esc(r.amt)} · ${E ? 'traded' : '거래'} ${esc(md(r.d))} · ${E ? 'filed' : '신고'} ${esc(md(r.f))} ${lateTag(r)} ${lnk(r.doc, E ? 'PTR' : 'PTR(의원 주식 거래 신고)')}</div>${pcLine(r)}`).join('') +
      `<div class="s"><a href="${esc(deep(S.sym || '', id))}">${E ? 'Link to this member card' : '이 의원 카드 링크'} ›</a></div><div class="s">${E ? 'Lawmakers only report a money range. The price change compares the closing price on the first and last day shown. It does not tell you why.' : '의원은 금액 범위만 신고해요. 주가 변화는 표시된 첫날과 마지막 날의 마감 가격을 비교한 거예요. 이유를 알려 주지는 않아요.'}</div>`;
  }
  function popup(html, ll) { const map = window.moneyTrackerMap, L = window.L; if (!map || !L) return;
    const go = () => L.popup({ className: 'mtTour mtMF mtRich', closeButton: true, autoPan: true, autoPanPadding: [40, 90], maxWidth: 320, offset: [0, -6] }).setLatLng(ll || map.getCenter()).setContent(html).openOn(map);
    if (ll) { map.flyTo(ll, Math.max(map.getZoom(), 5), { duration: .9 }); setTimeout(go, 950); } else go(); }
  S.openMember = async (r) => { popup(await memberHTML(r.id, r.who), r.ll); };
  async function enrich(c) {
    const k = c.querySelector('.k'); if (!k || c.dataset.mtRich) return; c.dataset.mtRich = 1; const t = k.textContent, E = en(), add = h => c.insertAdjacentHTML('beforeend', `<div class="mtEnr" style="border-top:1px solid #24493b;margin-top:5px;padding-top:4px">${h}</div>`);
    if (/PTR/.test(t)) { const h = c.querySelector('.h'), r = S.rows && S.rows.find(x => x.who === (h && h.textContent.trim())); if (r) { const d = document.createElement('div'); d.innerHTML = await memberHTML(r.id, r.who); d.querySelector('.k').remove(); d.querySelector('.h').remove(); add(d.innerHTML); } return; }
    const x = await getTX(), e = x && x.tickers && S.sym && x.tickers[S.sym]; if (!e) return;
    if (/Form 4/.test(t) && e.f4 && e.f4.rows) add(`<div class="r"><b>${E ? 'Form 4 open-market rows' : 'Form 4 공개시장 거래'}</b></div>` + e.f4.rows.slice(0, 6).map(i => `<div class="s" style="color:#d8f5e3">${esc(i.who)} (${esc(i.role || '')}) · ${i.code === 'P' ? (E ? 'Buy' : '매수') : (E ? 'Sell' : '매도')} ${Number(i.shares).toLocaleString('en-US')} @ $${Number(i.price).toFixed(2)} · ${esc(md(i.date))}${i.plan ? (E ? ' · 10b5-1 (sale planned in advance)' : ' · 10b5-1 (미리 계획한 매도)') : ''} ${lnk(i.url, E ? 'Filing' : '원문')}</div>`).join(''));
    else if (/US bill/.test(t) || /미국 법안/.test(t)) { const no = (c.querySelector('.h') || {}).textContent || '', bno = no.split(' · ')[0], b = (e.bills || []).find(z => z.no === bno) || {};
      const linked = Object.entries(x.tickers).filter(([, v]) => (v.bills || []).some(z => z.no === bno)).map(([s2]) => s2);
      const seen = new Set(), who = (S.rows || []).filter(r => !seen.has(r.who) && seen.add(r.who));
      add(`<div class="s">${E ? 'Status' : '상태'}: ${esc(b.a ? (E ? b.a : (window.MTI18N && window.MTI18N.koAct ? window.MTI18N.koAct(b.a) : b.a)) : (E ? 'Introduced' : '발의'))}${b.ad ? ' · ' + esc(md(b.ad)) : ''} · ${E ? 'introduced' : '발의일'} ${esc(md(b.d))}</div><div class="s">${E ? 'Linked tickers' : '연결 종목'}: <b>${esc(linked.join(', '))}</b></div><div class="s">${E ? `Members who traded ${S.sym}` : `${S.sym} 거래 의원`}: ${who.slice(0, 8).map(r => `${esc(r.who)} (${esc(r.p)}, ${esc(md(r.d))})`).join(', ') || '-'}</div>`); }
    else if (/White House/.test(t) || /백악관/.test(t)) { const fr = await getJ('../data/fr/presidential.json'), it = ((fr && fr.items) || []).filter(z => (z.moves || []).some(m => m.sym === S.sym)), syms = [...new Set(it.flatMap(z => (z.moves || []).map(m => m.sym)))];
      add(`<div class="s">${E ? 'Stocks named in these records' : '이 기록에 나온 종목'}: <b>${esc(syms.join(', '))}</b></div>`); }
  }
  const SECTIONS = []; S.sections = SECTIONS;
  SECTIONS.push(rows => { // Latest filers top 5
    const E = en(), seen = new Set(), top = rows.filter(r => !seen.has(r.who) && seen.add(r.who)).slice(0, 5); if (!top.length) return null;
    const box = document.createElement('div'); box.innerHTML = `<h4>${E ? 'Latest filers' : '최근 신고 의원'}</h4>`;
    top.forEach(r => { const b = document.createElement('button'); b.type = 'button'; b.className = 'row' + (r.tags ? ' flag' : ''); b.innerHTML = `<span><span class="pp" style="background:${party(r.p)}">${esc(r.p || '?')}</span>${esc(r.who)}</span><small>${E ? 'traded' : '거래'} ${esc(md(r.d))} · ${E ? 'filed' : '신고'} ${esc(md(r.f))} ${lateTag(r)}<br>${tagChips(r)}</small>`;
      b.onclick = () => openM(r); b.querySelector('small').append(saveBtn(r)); box.append(b); });
    return box;
  });
  SECTIONS.push(rows => { // Flagged trades
    const E = en(), fl = rows.filter(r => r.tags).slice(0, 6); if (!fl.length) return null;
    const box = document.createElement('div'); box.innerHTML = `<h4>${E ? 'Flagged trades' : '표시된 거래'} <small>(${fl.length}/${rows.filter(r => r.tags).length})</small></h4>`;
    fl.forEach(r => { const b = document.createElement('button'); b.type = 'button'; b.className = 'row flag'; b.style.display = 'block'; b.innerHTML = `<div><span class="pp" style="background:${party(r.p)}">${esc(r.p || '?')}</span>${esc(r.who)} · ${r.ty === 'P' ? (E ? 'buy' : '매수') : r.ty === 'S' ? (E ? 'sell' : '매도') : esc(r.ty)} · ${esc(md(r.d))}</div><div style="font-size:11.5px;color:#ffd60a">${r.tags.map(g => esc(tagText(g))).join('<br>')}</div>`;
      b.onclick = () => openM(r); b.append(saveBtn(r)); box.append(b); });
    const n = document.createElement('small'); n.textContent = E ? 'These tags only compare dates in public reports. They do not tell you why.' : '이 표시는 공개 신고의 날짜만 비교한 거예요. 이유를 알려 주지는 않아요.'; box.append(n);
    return box;
  });
  SECTIONS.push(rows => { // Member ranking: most trades in this ticker
    const E = en(), g = {}; rows.forEach(r => { const k = r.id || r.who; (g[k] = g[k] || { r, n: 0, a: new Set() }).n++; if (r.amt) g[k].a.add(r.amt); });
    const top = Object.values(g).sort((a, b) => b.n - a.n || String(b.r.f).localeCompare(String(a.r.f))).slice(0, 8); if (!top.length) return null;
    const box = document.createElement('div'); box.innerHTML = `<h4>${E ? 'Which lawmakers traded this stock the most' : '이 종목을 가장 많이 거래한 의원'}</h4>`;
    top.forEach((o, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'row'; b.style.display = 'block';
      b.innerHTML = `<div style="display:flex;justify-content:space-between"><span>${i + 1}. <span class="pp" style="background:${party(o.r.p)}">${esc(o.r.p || '?')}</span>${esc(o.r.who)}</span><b>${o.n}</b></div><small>${[...o.a].map(esc).join(' · ')}</small>`;
      b.onclick = () => openM(o.r); box.append(b); });
    const n = document.createElement('small'); n.textContent = E ? 'Number of trades each lawmaker reported. Amounts are money ranges.' : '의원마다 신고한 거래 수예요. 금액은 범위로만 나와요.'; box.append(n); return box;
  });
  // Playback: lights up trades, Form 4s, bills, White House items and 8-Ks on the map in date order.
  const PB = { t: null, i: 0, ev: [], lay: null };
  // clicking a member while playback runs: pause playback, then open that member's card
  function openM(r) { if (PB.t) { pbStop(); const ov = $('mtPBov'); if (ov) ov.remove(); } return S.openMember(r); }
  async function events(sym) {
    const [x, ds, fr] = await Promise.all([getTX(), getJ('./dossier.json'), getJ('../data/fr/presidential.json')]), e = (x && x.tickers && x.tickers[sym]) || {}, hq = ds && ds.tickers && ds.tickers[sym] && ds.tickers[sym].ll, E = en(), ev = [];
    (S.rows || []).forEach(r => r.ll && ev.push({ d: r.d, k: E ? 'Trade' : '의원 거래', c: party(r.p), ll: r.ll, t: `${r.who} · ${side(r.ty)} ${r.amt || ''}`, r }));
    if (hq) ((e.f4 && e.f4.rows) || []).forEach(i => ev.push({ d: i.date, k: E ? 'Form 4' : 'Form 4(임원 주식 거래 신고)', c: '#c08cff', ll: hq, t: `${i.who} · ${i.code === 'P' ? (E ? 'Buy' : '매수') : (E ? 'Sell' : '매도')} ${Number(i.shares).toLocaleString('en-US')}${E ? ' shares' : '주'}` }));
    (e.bills || []).forEach(b => ev.push({ d: b.d, k: E ? 'Bill' : '법안', c: '#ffd60a', ll: [38.8899, -77.0091], t: `${b.no} · ${String(b.n).slice(0, 60)}` }));
    ((fr && fr.items) || []).filter(z => (z.moves || []).some(m => m.sym === sym)).forEach(z => ev.push({ d: String(z.date).slice(0, 10), k: E ? 'White House' : '백악관', c: '#e8e8e8', ll: [38.8977, -77.0365], t: E ? String(z.title || '').slice(0, 70) : ('미국 ' + (z.type || '대통령 문서') + (z.eo?' 제'+z.eo+'호':z.procl?' 제'+z.procl+'호':'')) }));
    if (hq) (e.k8 || []).forEach(f => ev.push({ d: f.d, k: E ? '8-K (big-news filing)' : '8-K(큰 소식 공시)', c: '#68c7d0', ll: hq, t: f.items && f.items.length ? (E ? 'Item ' : '항목 ') + f.items.join(', ') : '8-K' }));
    return ev.filter(v => v.d).sort((a, b) => a.d.localeCompare(b.d));
  }
  function pbShow(i) { const map = window.moneyTrackerMap, L = window.L; if (!map || !L || !PB.ev.length) return; PB.i = i;
    if (!PB.lay) PB.lay = L.layerGroup().addTo(map); PB.lay.clearLayers();
    PB.ev.slice(Math.max(0, i - 24), i + 1).forEach((v, j, a) => { const on = j === a.length - 1, z = on ? 40 : 16; L.marker(v.ll, { interactive: false, zIndexOffset: on ? 2000 : 1500, icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div style="width:${z}px;height:${z}px;margin:${-z / 2}px 0 0 ${-z / 2}px;border-radius:50%;background:${v.c};opacity:${on ? .85 : .45};border:${on ? 3 : 1}px solid #fff;box-shadow:0 0 ${on ? 18 : 4}px ${v.c}"></div>` }) }).addTo(PB.lay); });
    setTimeout(() => PB.lay && PB.lay.eachLayer(l => { const el = l.getElement && l.getElement(); if (el) el.style.display = ''; }), 40);
    const v = PB.ev[i], cap = $('mtPBcap'), sl = $('mtPBsl'); if (sl) sl.value = i;
    if (cap) cap.innerHTML = `<b>${esc(md(v.d))}</b> · <span style="color:${v.c}">${esc(v.k)}</span> · ${esc(v.t)} <small>(${i + 1}/${PB.ev.length})</small>`;
    let ov = $('mtPBov'); if (!ov) { ov = document.createElement('div'); ov.id = 'mtPBov'; ov.style.cssText = 'position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:1200;padding:8px 14px;background:rgba(6,19,14,.92);border:1px solid #5dff9e;border-radius:6px;font:600 16px ui-monospace,monospace;color:#d8f5e3;pointer-events:none;max-width:70vw'; document.body.append(ov); } ov.innerHTML = cap ? cap.innerHTML : '';
    if (!map.getBounds().pad(-.15).contains(v.ll)) map.panTo(v.ll, { animate: true, duration: .6 }); }
  function pbStop() { clearInterval(PB.t); PB.t = null; const ov = $('mtPBov'); if (ov && PB.i >= PB.ev.length - 1) setTimeout(() => ov.remove(), 3000); const b = $('mtPBbtn'); if (b) b.textContent = en() ? 'Play' : '재생'; }
  S.playback = PB;
  SECTIONS.unshift((rows, sym) => {
    const E = en(), box = document.createElement('div'); box.innerHTML = `<h4>${E ? 'Playback' : '재생'}</h4><div style="display:flex;gap:6px;align-items:center"><button id="mtPBbtn" class="mtSave" style="margin:0">${E ? 'Play' : '재생'}</button><input id="mtPBsl" type="range" min="0" max="0" value="0" style="flex:1"></div><div id="mtPBcap" style="font:12px ui-monospace,monospace;color:#d8f5e3;min-height:16px"></div><small>${E ? 'Lawmaker trades, insider trades (Form 4), bills, White House actions and big-news filings (8-K) lined up by date.' : '의원 거래, 임원 거래(Form 4), 법안, 백악관 발표, 큰 소식 공시(8-K)를 날짜 순서대로 보여줘요.'}</small>`;
    events(sym).then(ev => { if (S.sym !== sym) return; PB.ev = ev; const sl = box.querySelector('#mtPBsl'); sl.max = Math.max(0, ev.length - 1); sl.oninput = () => { pbStop(); pbShow(+sl.value); }; });
    box.querySelector('#mtPBbtn').onclick = e => { e.stopPropagation(); if (PB.t) return pbStop(); if (!PB.ev.length) return; if (PB.i >= PB.ev.length - 1) PB.i = -1; e.target.textContent = en() ? 'Pause' : '일시정지';
      const map = window.moneyTrackerMap; if (map && innerWidth > innerHeight && innerHeight < 500) map.closePopup(); if (map && PB.i < 0) map.setView([38, -96], 4); PB.t = setInterval(() => { if (PB.i >= PB.ev.length - 1 || S.sym !== sym) return pbStop(); pbShow(PB.i + 1); }, 700); };
    return box;
  });
  // Trade table: filter by party and buy/sell, sort by filing date, filing delay or amount.
  const amtLo = a => { const m = String(a || '').replace(/,/g, '').match(/\d+/); return m ? +m[0] : 0; };
  const deep = (sym, id) => `${location.origin}${location.pathname}?lang=${en() ? 'en' : 'ko'}&q=${encodeURIComponent(sym)}${id ? '&m=' + encodeURIComponent(id) : ''}`;
  S.deep = deep;
  SECTIONS.push((rows, sym) => {
    if (!rows.length) return null; const E = en(), box = document.createElement('div');
    const sel = (id, o) => `<select id="${id}" style="background:#0b1d16;color:#d8f5e3;border:1px solid #24493b;font:11px ui-monospace,monospace">${o.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`;
    box.innerHTML = `<h4>${E ? 'All trades' : '전체 거래'} <small>(${rows.length})</small></h4><div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:3px">${sel('mtTp', [['', E ? 'Any party' : '정당 전체'], ['D', 'D'], ['R', 'R']])}${sel('mtTs', [['', E ? 'Buy + sell' : '매수+매도'], ['P', E ? 'Buy' : '매수'], ['S', E ? 'Sell' : '매도']])}${sel('mtTo', [['f', E ? 'Sort: filed' : '정렬: 신고일'], ['late', E ? 'Sort: filing delay' : '정렬: 신고 지연'], ['amt', E ? 'Sort: amount' : '정렬: 금액']])}<button class="mtSave mtCopy" style="margin:0">${E ? 'Copy ticker link' : '종목 링크 복사'}</button></div><div class="mtTbl" style="max-height:30vh;overflow:auto"></div>`;
    const paint = () => { const p = box.querySelector('#mtTp').value, t = box.querySelector('#mtTs').value, o = box.querySelector('#mtTo').value;
      const r = rows.filter(x => (!p || x.p === p) && (!t || x.ty === t)).sort((a, b) => o === 'late' ? b.late - a.late : o === 'amt' ? amtLo(b.amt) - amtLo(a.amt) : String(b.f).localeCompare(String(a.f)));
      const tb = box.querySelector('.mtTbl'); tb.innerHTML = `<table style="width:100%;border-collapse:collapse;font:11px ui-monospace,monospace"><tr style="color:#68c7d0;text-align:left"><th>${E ? 'Member' : '의원'}</th><th>${E ? 'Side' : '구분'}</th><th>${E ? 'Amount' : '금액'}</th><th>${E ? 'Traded' : '거래'}</th><th>${E ? 'Gap' : '지연'}</th></tr>` + r.map((x, i) => `<tr data-i="${i}" style="cursor:pointer;border-top:1px solid #24493b${x.tags ? ';color:#ffd60a' : ''}"><td><span class="pp" style="background:${party(x.p)}">${esc(x.p || '?')}</span>${esc(x.who)}</td><td>${side(x.ty)}</td><td>${esc(String(x.amt || '').replace(/\$|,000/g, m => m === '$' ? '$' : 'k'))}</td><td>${esc(x.d)}</td><td>${lateTag(x)}</td></tr>`).join('') + '</table>';
      tb.querySelectorAll('tr[data-i]').forEach(tr => tr.onclick = () => openM(r[+tr.dataset.i])); };
    box.querySelectorAll('select').forEach(x => x.onchange = paint); paint();
    box.querySelector('.mtCopy').onclick = e => { e.stopPropagation(); navigator.clipboard && navigator.clipboard.writeText(deep(sym)); e.target.textContent = E ? 'Copied' : '복사됨'; };
    return box;
  });
  // Korean listings: stock close and National Pension Service (NPS) holding first.
  SECTIONS.unshift((rows, sym) => {
    if (!/\.(KS|KQ)$/.test(sym)) return null; const E = en(), box = document.createElement('div');
    box.innerHTML = `<h4>${E ? 'Stock and NPS holding' : '주가와 국민연금 보유'}</h4><div class="mtKR" style="font:12.5px/1.5 ui-monospace,monospace">...</div>`;
    Promise.all([getJ(`../data/markets/${sym.replace('.', '_')}.json`), getJ('../data/nps/kr_holdings.json')]).then(([m, n]) => {
      const el = box.querySelector('.mtKR'), out = [];
      if (m && m.c && m.c.length > 1) { const L = m.c.length, c = m.c[L - 1], p = m.c[L - 2], y = m.c.slice(-250), ch = ((c - p) / p * 100).toFixed(2);
        out.push(`<div><b style="font-size:16px">${esc(m.name || sym)}</b> ${E ? 'close' : '종가'} <b>${Math.round(c).toLocaleString('en-US')}${E ? ' KRW' : '원'}</b> (${ch > 0 ? '+' : ''}${ch}% ${E ? 'vs prior close' : '전일 대비'}) · ${esc(md(m.d[L - 1]))}</div><div style="color:#8fa89a">${E ? '1-year range' : '1년 범위'} ${Math.round(Math.min(...y)).toLocaleString('en-US')} – ${Math.round(Math.max(...y)).toLocaleString('en-US')}${E ? ' KRW' : '원'} · ${esc(E ? ({fsc:'Financial Services Commission (official)',yahoo:'Yahoo Finance (not official, temporary)',stooq:'Stooq (not official)'})[m.source] || m.source || '' : ({fsc:'금융위원회 공식 시세',yahoo:'야후 파이낸스(공식 아님, 임시)',stooq:'Stooq(공식 아님)'})[m.source] || m.source || '')}</div>`); }
      const h = n && (n.holdings || []).find(x => m && x.company === m.name);
      if (h) out.push(`<div style="margin-top:4px">${E ? 'NPS (National Pension Service)' : '국민연금'}: ${E ? 'stake' : '지분율'} <b>${h.stake_pct}%</b> · ${E ? 'value' : '평가액'} <b>${E ? (h.value_100m_krw / 1e4).toFixed(1) + 'T KRW' : Math.round(h.value_100m_krw).toLocaleString('en-US') + '억원'}</b> · ${E ? 'share of its Korean stock money' : '국민연금 국내 주식 돈 중 비중'} ${h.weight_pct}% · ${E ? 'rank' : '순위'} ${h.rank} · ${E ? 'as of' : '기준'} ${esc(h.as_of)} ${lnk(h.source_url || n.board_url, E ? 'NPS disclosure' : '국민연금 공시')}</div>`);
      else out.push(`<div style="color:#8fa89a">${E ? 'This stock is not on the National Pension Service\'s list of Korean stocks it owns.' : '국민연금이 가진 국내 주식 목록에 이 종목은 없어요.'}</div>`);
      el.innerHTML = out.join('');
    });
    return box;
  });
  // Ticker sub-tabs: the extras panel shows only on All / Lawmakers; Insiders and White House tabs get full lists.
  const KRR = { '회장': 'Chairman', '부회장': 'Vice Chairman', '사장': 'President', '부사장': 'Executive Vice President', '전무': 'Senior Vice President', '상무': 'Vice President', '상무보': 'Associate Vice President', '이사': 'Director', '사내이사': 'Inside director', '사외이사': 'Outside director', '독립이사': 'Independent director', '이사회의장': 'Board chair', '대표이사': 'CEO', '감사': 'Auditor', '고문': 'Adviser', '최대주주': 'Largest shareholder', '주요주주': 'Major shareholder', '미등기임원': 'Non-registered officer', '-': '' };
  const krRole = r => String(r || '').split(/\s*,\s*/).map(x => KRR[x] != null ? KRR[x] : x).filter(Boolean).join(', ');
  // Korean screen: Form 4 job titles in Korean; a title we can't map is kept as filed and marked as the original.
  const KOR = { 'director': '이사', '10% owner': '10% 이상 주주', 'ceo': '최고경영자(CEO)', 'chief executive officer': '최고경영자(CEO)', 'cfo': '최고재무책임자(CFO)', 'chief financial officer': '최고재무책임자(CFO)', 'coo': '최고운영책임자(COO)', 'chief operating officer': '최고운영책임자(COO)', 'cpo': '최고제품책임자(CPO)', 'chief product officer': '최고제품책임자(CPO)', 'cao': '최고회계책임자', 'chief accounting officer': '최고회계책임자', 'principal accounting officer': '최고회계책임자', 'chief legal officer': '최고법무책임자', 'chief human resources officer': '최고인사책임자', 'head of human resources': '인사 총괄', 'president': '사장', 'pres': '사장', 'pres.': '사장', 'chair': '회장', 'chairman': '회장', 'chairman of the board': '이사회 의장', 'cob': '이사회 의장', 'executive chair': '이사회 의장', 'vice chairman': '부회장', 'evp': '부사장', 'executive vice president': '부사장', 'sr. executive vice president': '선임 부사장', 'svp': '전무', 'senior vice president': '전무', 'vice president': '상무', 'general counsel': '법무 총괄', 'gc': '법무 총괄', 'secretary': '이사회 총무', 'secy': '이사회 총무', 'sec': '이사회 총무', 'see remarks': '공시 비고 참고' };
  const koRole = r => { const out = [], raw = []; String(r || '').split(/\s*,\s*/).filter(Boolean).forEach(p => { const parts = p.split(/\s*(?:&| and )\s*/i).filter(Boolean), m = parts.map(x => KOR[x.toLowerCase()]); if (m.every(Boolean)) out.push(m.join('·')); else raw.push(p); });
    return out.join(', ') + (raw.length ? (out.length ? ' · ' : '') + '공시 원문 직함: ' + raw.join(', ') : ''); };
  const tabNow = () => { const b = document.querySelector('#mtHub button.on'); return b ? b.dataset.k : 'all'; };
  const money2 = n => '$' + Math.round(n).toLocaleString('en-US');
  async function tabFill() {
    const k = tabNow(), box = $('mtPlus'), lst = $('mtHubList'); if (box) box.style.display = (k === 'all' || k === 'law') ? '' : 'none';
    if (!lst || !S.sym || (k !== 'ins' && k !== 'wh') || (lst.dataset.tp === k + S.sym && lst.querySelector('.mtTP'))) return; lst.dataset.tp = k + S.sym; const E = en();
    if (k === 'ins' && /\.KS$/.test(S.sym)) { const x = await getJ('./kr-insiders.json'), rows = (x && x.tickers && x.tickers[S.sym] && x.tickers[S.sym].rows) || [];
      lst.replaceChildren(); if (!rows.length) { const w = document.createElement('div'); w.className = 'why mtTP'; w.textContent = E ? 'No boss or big owner of this company reported a share change on DART in the last 180 days.' : '최근 180일 동안 이 회사 임원이나 큰 주주가 DART에 주식 변동을 알린 기록이 없어요.'; lst.append(w); return; }
      const t = document.createElement('div'); t.className = 'mtTP'; t.style.cssText = 'font:11.5px/1.4 ui-monospace,monospace;color:#d8f5e3';
      t.innerHTML = `<div style="color:#68c7d0;margin:2px 0">${rows.length} ${E ? 'DART reports, newest first (DART = Korea\'s official filing site; bosses and big owners must report when their share count changes)' : 'DART 보고, 최신순 (DART = 한국 공식 공시 사이트. 회사 임원과 큰 주주는 가진 주식 수가 바뀌면 여기에 꼭 알려야 해요)'}</div>` + rows.map(i => `<div style="border:1px solid #24493b;border-radius:4px;padding:3px 5px;margin:2px 0"><b>${esc(i.who)}</b> · ${esc(E ? krRole(i.role) : (i.role || ''))}<br>${esc(md(i.date))} · <b style="color:${i.chg > 0 ? '#5dff9e' : i.chg < 0 ? '#ff8a80' : '#d8f5e3'}">${i.chg > 0 ? (E ? 'Increase' : '증가') : i.chg < 0 ? (E ? 'Decrease' : '감소') : (E ? 'No change' : '변동 없음')}</b> ${(i.chg > 0 ? '+' : '') + Number(i.chg).toLocaleString('en-US')} ${E ? 'sh' : '주'}${i.held != null ? ' · ' + (E ? 'held ' : '보유 ') + Number(i.held).toLocaleString('en-US') : ''}${i.rate ? ' (' + esc(i.rate) + '%)' : ''} ${lnk(i.url, 'DART')}</div>`).join('');
      lst.append(t); return; }
    if (k === 'ins') { const x = await getTX(), e = x && x.tickers && x.tickers[S.sym], rows = (e && e.f4 && e.f4.rows) || [];
      lst.replaceChildren(); if (!rows.length) { const w = document.createElement('div'); w.className = 'why mtTP'; w.textContent = E ? 'No company insider bought or sold this stock on the market in the last 90 days. (Form 4 = the report insiders file. US companies only. Stock given as pay is not counted.)' : '최근 90일 동안 이 회사 임원이 시장에서 이 주식을 사거나 판 기록이 없어요. (Form 4 = 임원이 내는 신고서. 미국 회사만 해당. 월급처럼 받은 주식은 빼고 셌어요.)'; lst.append(w); return; }
      const t = document.createElement('div'); t.className = 'mtTP'; t.style.cssText = 'font:11.5px/1.4 ui-monospace,monospace;color:#d8f5e3';
      t.innerHTML = `<div style="color:#68c7d0;margin:2px 0">${rows.length} ${E ? 'Form 4 trades, newest first (Form 4 = a report company insiders file when they buy or sell their own company\'s stock)' : 'Form 4 거래, 최신순 (Form 4 = 회사 임원이 자기 회사 주식을 사고팔 때 내는 신고서)'}</div>` + rows.map(i => `<div style="border:1px solid #24493b;border-radius:4px;padding:3px 5px;margin:2px 0"><b>${esc(i.who)}</b> · ${esc(E ? (i.role || '') : koRole(i.role))}<br>${esc(md(i.date))} · <b style="color:${i.code === 'P' ? '#5dff9e' : '#ff8a80'}">${i.code === 'P' ? (E ? 'Buy' : '매수') : (E ? 'Sell' : '매도')}</b> ${Number(i.shares).toLocaleString('en-US')} @ $${Number(i.price).toFixed(2)} = ${money2(i.shares * i.price)}${i.plan ? (E ? ' · 10b5-1 (sale planned in advance)' : ' · 10b5-1 (미리 계획한 매도)') : ''} ${lnk(i.url, 'Form 4')}</div>`).join('');
      lst.append(t); }
    if (k === 'wh') { const fr = await getJ('../data/fr/presidential.json'), it = ((fr && fr.items) || []).filter(z => (z.moves || []).some(m => m.sym === S.sym) || (z.tickers || []).includes(S.sym)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      lst.replaceChildren(); if (!it.length) { const w = document.createElement('div'); w.className = 'why mtTP'; w.textContent = E ? 'We have no White House action that names this company yet. Actions about its industry are in "US president & government news" below.' : '아직 이 회사 이름이 나온 백악관 발표는 없어요. 업종 관련 발표는 아래 \'미국 대통령·정부 발표\'에 있어요.'; lst.append(w); return; }
      it.slice(0, 20).forEach(z => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mtTP'; const ll = [38.8977, -77.0365], syms = [...new Set((z.moves || []).map(m => m.sym).concat(z.tickers || []))];
        b.innerHTML = `${esc(md(String(z.date).slice(0, 10)))} · ${esc(E ? String(z.title || '').slice(0, 110) : '미국 ' + (z.type || '대통령 문서') + (z.eo?' 제'+z.eo+'호':z.procl?' 제'+z.procl+'호':''))}`;
        b.onclick = ev => { ev.stopPropagation(); popup(`<div class="k">${E ? 'White House / Federal Register' : '백악관 / 연방관보'}</div><div class="h">${esc(E ? z.title : '미국 ' + (z.type || '대통령 문서') + (z.eo?' 제'+z.eo+'호':z.procl?' 제'+z.procl+'호':''))}</div><div>${esc(md(String(z.date).slice(0, 10)))}${z.type_en ? ' · ' + esc(E ? z.type_en : z.type) : ''}</div><div class="s">${E ? 'Linked tickers' : '연결 종목'}: <b>${esc(syms.join(', '))}</b></div><div class="s">${lnk(z.url, E ? 'Read the official document' : '원래 제목 보기(공식 원문)')}</div>`, ll); };
        lst.append(b); }); }
  }
  // Opening screen: 3 large cards with the latest notable filings; other controls stay behind Menu.
  // Hidden by default; visitors turn it on from the menu (localStorage mt.recentCards = '1').
  const recentOn = () => { try { return localStorage.getItem('mt.recentCards') === '1'; } catch (e) { return false; } };
  window.mtOpenHide = () => { const o = $('mtOpen'); if (o) o.remove(); document.body.classList.remove('mtOpenOn'); };
  window.mtOpenShow = async (force) => {
    if (!recentOn() || $('mtOpen')) return;
    const qs = new URLSearchParams(location.search); if (!force && (qs.get('q') || qs.get('rec') || sessionStorage.getItem('mtOpenSeen'))) return;
    const d = await getTT(); if (!d || !d.tickers) return; const E = en(), all = [];
    Object.entries(d.tickers).forEach(([k, v]) => v.forEach(r => all.push([k, r])));
    all.sort((a, b) => String(b[1].f).localeCompare(String(a[1].f)) || ((b[1].tags || []).length - (a[1].tags || []).length));
    const pick = [], seen = new Set(), sw = new Set(); for (const [k, r] of all) { if (seen.has(k) || sw.has(r.who) || !r.tags) continue; seen.add(k); sw.add(r.who); pick.push([k, r]); if (pick.length === 3) break; }
    if (!pick.length) return;
    const st = document.createElement('style'); st.textContent = `body.mtOpenOn #controls,body.mtOpenOn #topics,body.mtOpenOn #mtTicker,body.mtOpenOn #brief,body.mtOpenOn #mtOneDock{visibility:hidden}#mtOpen{position:fixed;inset:auto 0 90px 0;z-index:1500;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none}#mtOpen .cs{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;pointer-events:auto}#mtOpen .oc{width:300px;text-align:left;padding:14px 16px;background:rgba(6,19,14,.94);border:1px solid #5dff9e;border-radius:8px;color:#d8f5e3;font:14px/1.45 system-ui,sans-serif;cursor:pointer}#mtOpen .oc:hover{border-color:#ffd60a}#mtOpen .oc b.s{display:block;font:700 34px ui-monospace,monospace;color:#5dff9e}#mtOpen .bar{pointer-events:auto;display:flex;gap:8px}#mtOpen h3{margin:0;font:700 12px ui-monospace,monospace;letter-spacing:.08em;color:#68c7d0;background:rgba(6,19,14,.9);padding:3px 8px;border-radius:4px}`;
    document.head.append(st);
    const o = document.createElement('div'); o.id = 'mtOpen'; o.innerHTML = `<h3>${E ? 'LATEST NOTABLE FILINGS' : '최근 눈에 띄는 신고'}</h3><div class="cs"></div><div class="bar"><button class="mtSave" id="mtOpenMenu" style="font-size:13px;padding:5px 14px">${E ? 'Menu' : '메뉴'}</button></div>`;
    pick.forEach(([k, r]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'oc';
      b.innerHTML = `<b class="s">${esc(k)}</b><span class="pp" style="display:inline-block;padding:0 4px;border-radius:3px;font:700 11px ui-monospace,monospace;color:#111;background:${party(r.p)}">${esc(r.p || '?')}</span> <b>${esc(r.who)}</b> · ${side(r.ty)}<br>${E ? 'Traded' : '거래'} ${esc(md(r.d))} · ${E ? 'filed' : '신고'} ${esc(md(r.f))} ${lateTag(r)}<br>${(r.tags || []).map(g => `<span class="mtTag">${esc(tagShort(g))}</span>`).join('')}`;
      b.onclick = () => { sessionStorage.setItem('mtOpenSeen', 1); location.search = `?lang=${E ? 'en' : 'ko'}&q=${encodeURIComponent(k)}${r.id ? '&m=' + encodeURIComponent(r.id) : ''}`; };
      b.onmouseenter = () => { const m = window.moneyTrackerMap; if (m && r.ll) m.flyTo(r.ll, 5, { duration: .8 }); };
      o.querySelector('.cs').append(b); });
    const close = () => { o.remove(); document.body.classList.remove('mtOpenOn'); sessionStorage.setItem('mtOpenSeen', 1); };
    o.querySelector('#mtOpenMenu').onclick = () => { close(); const mb = [...document.querySelectorAll('button')].find(x => /^\W*(Menu|메뉴)\s*$/.test(x.textContent.trim()) && x.id !== 'mtOpenMenu'); if (mb) mb.click(); };
    document.body.classList.add('mtOpenOn'); document.body.append(o);
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });
  };
  window.mtOpenShow();
  let busy = false;
  async function render() {
    const s = cur(), hub = $('mtHub'); if (!s || !hub) { if (PB.lay) { PB.lay.clearLayers(); } pbStop(); { const ov = $('mtPBov'); if (ov) ov.remove(); } S.sym = null; S.rows = null; const b = $('mtPlus'); if (b) b.remove(); return; }
    const d = await getTT(); const rows = (d && d.tickers && d.tickers[s]) || []; S.range = d && d.range;
    let box = $('mtPlus'); const anchor = $('mtHubList') || hub;
    if (box && S.sym === s && box.previousSibling === anchor) { decorateDots(); return; }
    S.sym = s; S.rows = rows; if (!box) { box = document.createElement('div'); box.id = 'mtPlus'; } anchor.after(box); box.replaceChildren();
    SECTIONS.forEach(f => { try { const el = f(rows, s); if (el) box.append(el); } catch (e) { } });
    decorateDots();
    const mid = new URLSearchParams(location.search).get('m'); if (mid && !S.mDone) { const r = rows.find(x => x.id === mid); if (r) { S.mDone = 1; setTimeout(() => S.openMember(r), 4500); } }
  }
  let lastK = 0; const kick = () => { if (busy) return; busy = true; const w = Math.max(0, 200 - (Date.now() - lastK)); setTimeout(() => requestAnimationFrame(() => { busy = false; lastK = Date.now(); tabFill(); render(); decorateCard(); const c = document.querySelector('.leaflet-popup.mtMF:not(.mtRich) .leaflet-popup-content'); if (c && S.sym) enrich(c); }), w); };
  S.refresh = () => { const b = $('mtPlus'); if (b) b.remove(); S.sym = null; kick(); };
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true });
})();
