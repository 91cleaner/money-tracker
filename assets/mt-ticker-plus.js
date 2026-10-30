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
#mtPlus .row{display:flex;gap:6px;align-items:center;justify-content:space-between;padding:4px 6px;border:1px solid #24493b;border-radius:4px;margin:2px 0;background:#0b1d16;cursor:pointer}#mtPlus .row:hover{border-color:#5dff9e}
#mtPlus .pp{display:inline-block;width:16px;text-align:center;border-radius:3px;font:700 10px ui-monospace,monospace;color:#111;margin-right:4px}#mtPlus small{color:#8fa89a}.mtSave{margin:3px 0 0;padding:2px 8px;border:1px solid #5dff9e;border-radius:3px;background:#0b1d16;color:#5dff9e;font:600 11px ui-monospace,monospace;cursor:pointer}`;
  document.head.append(css);
  const S = { sym: null, rows: null }; window.mtTickerPlus = S;
  // Latest trade per member (rows are sorted by filed date, newest first).
  const perWho = rows => { const o = {}; rows.forEach(r => { if (!o[r.who]) o[r.who] = r; }); return o; };
  function lateTag(r) { const E = en(); return `<span class="mtLate ${lc(r.late)}" title="${E ? 'Days from trade to disclosure; STOCK Act deadline 45 days' : '거래일부터 신고일까지 일수, STOCK Act 기한 45일'}">+${r.late}${E ? 'd' : '일'}</span>`; }
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
    if (g.t === 'first') return E ? `First trade in this ticker by this member in our data (since ${rg})` : `우리 자료(${rg}~)에서 이 의원의 이 종목 첫 거래`;
    if (g.t === 'bill') return E ? `Within 30 days of a related bill action (${g.no}, ${md(g.bd)}, ${Math.abs(g.n)} days ${g.n >= 0 ? 'after' : 'before'} the trade)` : `관련 법안 일정 30일 이내 (${g.no}, ${g.bd}, 거래 ${Math.abs(g.n)}일 ${g.n >= 0 ? '후' : '전'})`;
    if (g.t === 'late') return E ? 'Filed after 45 days' : '45일 지나 신고';
    if (g.t === '8k') return E ? `Within 30 days before an 8-K (filed ${md(g.kd)}, ${g.n} days later)` : `8-K 제출 30일 이내 전 거래 (${g.kd}, ${g.n}일 뒤)`;
    return ''; }
  const tagShort = g => { const E = en(); return { first: E ? 'First in data' : '첫 거래', bill: E ? 'Bill within 30d' : '법안 30일', late: E ? 'Filed >45d' : '45일 초과', '8k': E ? '8-K within 30d' : '8-K 30일' }[g.t] || ''; };
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
  const SECTIONS = []; S.sections = SECTIONS;
  SECTIONS.push(rows => { // Latest filers top 5
    const E = en(), seen = new Set(), top = rows.filter(r => !seen.has(r.who) && seen.add(r.who)).slice(0, 5); if (!top.length) return null;
    const box = document.createElement('div'); box.innerHTML = `<h4>${E ? 'Latest filers' : '최근 신고 의원'}</h4>`;
    top.forEach(r => { const b = document.createElement('div'); b.className = 'row' + (r.tags ? ' flag' : ''); b.innerHTML = `<span><span class="pp" style="background:${party(r.p)}">${esc(r.p || '?')}</span>${esc(r.who)}</span><small>${E ? 'traded' : '거래'} ${esc(md(r.d))} · ${E ? 'filed' : '신고'} ${esc(md(r.f))} ${lateTag(r)}<br>${tagChips(r)}</small>`;
      b.onclick = () => { const m = window.moneyTrackerMap; if (m && r.ll) m.flyTo(r.ll, Math.max(m.getZoom(), 5), { duration: .9 }); }; b.querySelector('small').append(saveBtn(r)); box.append(b); });
    return box;
  });
  SECTIONS.push(rows => { // Flagged trades
    const E = en(), fl = rows.filter(r => r.tags).slice(0, 6); if (!fl.length) return null;
    const box = document.createElement('div'); box.innerHTML = `<h4>${E ? 'Flagged trades' : '표시된 거래'} <small>(${fl.length}/${rows.filter(r => r.tags).length})</small></h4>`;
    fl.forEach(r => { const b = document.createElement('div'); b.className = 'row flag'; b.style.display = 'block'; b.innerHTML = `<div><span class="pp" style="background:${party(r.p)}">${esc(r.p || '?')}</span>${esc(r.who)} · ${r.ty === 'P' ? (E ? 'buy' : '매수') : r.ty === 'S' ? (E ? 'sell' : '매도') : esc(r.ty)} · ${esc(md(r.d))}</div><div style="font-size:11.5px;color:#ffd60a">${r.tags.map(g => esc(tagText(g))).join('<br>')}</div>`;
      b.onclick = () => { const m = window.moneyTrackerMap; if (m && r.ll) m.flyTo(r.ll, Math.max(m.getZoom(), 5), { duration: .9 }); }; b.append(saveBtn(r)); box.append(b); });
    const n = document.createElement('small'); n.textContent = E ? 'Tags are date checks on public filings; they do not show a reason.' : '표시는 공개 신고 날짜 비교일 뿐 이유를 뜻하지 않아요.'; box.append(n);
    return box;
  });
  let busy = false;
  async function render() {
    const s = cur(), hub = $('mtHub'); if (!s || !hub) { S.sym = null; S.rows = null; const b = $('mtPlus'); if (b) b.remove(); return; }
    const d = await getTT(); const rows = (d && d.tickers && d.tickers[s]) || []; S.range = d && d.range;
    let box = $('mtPlus'); const anchor = $('mtHubList') || hub;
    if (box && S.sym === s && box.previousSibling === anchor) { decorateDots(); return; }
    S.sym = s; S.rows = rows; if (!box) { box = document.createElement('div'); box.id = 'mtPlus'; } anchor.after(box); box.replaceChildren();
    SECTIONS.forEach(f => { try { const el = f(rows, s); if (el) box.append(el); } catch (e) { } });
    decorateDots();
  }
  const kick = () => { if (busy) return; busy = true; requestAnimationFrame(() => { busy = false; render(); decorateCard(); }); };
  S.refresh = () => { const b = $('mtPlus'); if (b) b.remove(); S.sym = null; kick(); };
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true });
})();
