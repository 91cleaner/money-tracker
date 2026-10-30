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
.mtLate{display:inline-block;margin-left:4px;padding:0 4px;border-radius:3px;font:700 10px ui-monospace,monospace;background:#1d3a2c;color:#d8f5e3}.mtLate.o{background:#ff9f0a;color:#111}.mtLate.r{background:#ff453a;color:#fff}
#mtPlus{margin:6px 0 8px;font:13px/1.45 system-ui,sans-serif;color:#d8f5e3}#mtPlus h4{margin:8px 0 3px;font:700 11px ui-monospace,monospace;letter-spacing:.06em;color:#68c7d0;text-transform:uppercase}
#mtPlus .row{display:flex;gap:6px;align-items:center;justify-content:space-between;padding:4px 6px;border:1px solid #24493b;border-radius:4px;margin:2px 0;background:#0b1d16;cursor:pointer}#mtPlus .row:hover{border-color:#5dff9e}
#mtPlus .pp{display:inline-block;width:16px;text-align:center;border-radius:3px;font:700 10px ui-monospace,monospace;color:#111;margin-right:4px}#mtPlus small{color:#8fa89a}`;
  document.head.append(css);
  const S = { sym: null, rows: null }; window.mtTickerPlus = S;
  // Latest trade per member (rows are sorted by filed date, newest first).
  const perWho = rows => { const o = {}; rows.forEach(r => { if (!o[r.who]) o[r.who] = r; }); return o; };
  function lateTag(r) { const E = en(); return `<span class="mtLate ${lc(r.late)}" title="${E ? 'Days from trade to disclosure; STOCK Act deadline 45 days' : '거래일부터 신고일까지 일수, STOCK Act 기한 45일'}">+${r.late}${E ? 'd' : '일'}</span>`; }
  function decorateDots() {
    if (!S.rows) return; const W = perWho(S.rows);
    document.querySelectorAll('.leaflet-marker-pane .leaflet-marker-icon[title]').forEach(el => {
      const r = W[el.getAttribute('title')]; const n = el.querySelector('.n'); if (!r || !n || n.querySelector('.mtLate')) return; n.insertAdjacentHTML('beforeend', lateTag(r));
    });
  }
  function decorateCard() {
    if (!S.rows) return; const c = document.querySelector('.leaflet-popup.mtMF .leaflet-popup-content'); if (!c || c.querySelector('.mtLateLine')) return;
    const k = c.querySelector('.k'), h = c.querySelector('.h'); if (!k || !h || !/PTR/.test(k.textContent)) return;
    const mine = S.rows.filter(r => r.who === h.textContent.trim()); if (!mine.length) return; const E = en();
    const d = document.createElement('div'); d.className = 'mtLateLine r'; d.style.cssText = 'margin-top:4px;font:12px ui-monospace,monospace';
    d.innerHTML = mine.slice(0, 3).map(r => `${E ? 'Traded' : '거래'} ${esc(md(r.d))} · ${E ? 'filed' : '신고'} ${esc(md(r.f))} ${lateTag(r)}`).join('<br>');
    k.parentNode.insertBefore(d, k.nextSibling.nextSibling || null);
  }
  const SECTIONS = []; S.sections = SECTIONS;
  SECTIONS.push(rows => { // Latest filers top 5
    const E = en(), seen = new Set(), top = rows.filter(r => !seen.has(r.who) && seen.add(r.who)).slice(0, 5); if (!top.length) return null;
    const box = document.createElement('div'); box.innerHTML = `<h4>${E ? 'Latest filers' : '최근 신고 의원'}</h4>`;
    top.forEach(r => { const b = document.createElement('div'); b.className = 'row'; b.innerHTML = `<span><span class="pp" style="background:${party(r.p)}">${esc(r.p || '?')}</span>${esc(r.who)}</span><small>${E ? 'traded' : '거래'} ${esc(md(r.d))} · ${E ? 'filed' : '신고'} ${esc(md(r.f))} ${lateTag(r)}</small>`;
      b.onclick = () => { const m = window.moneyTrackerMap; if (m && r.ll) m.flyTo(r.ll, Math.max(m.getZoom(), 5), { duration: .9 }); }; box.append(b); });
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
