/* Congress Tracker dashboard (below the map): what Congress buys and sells, by party, with a D vs R mode.
   Plain HTML/SVG, no chart library. Public records only. */
(async () => {
  const box = document.getElementById('usdash'); if (!box) return;
  const j = (f) => fetch('data/us/' + f, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const [mem, tr, bl] = await Promise.all([j('members.json'), j('trades.json'), j('bills.json')]);
  if (!mem || !tr) { box.innerHTML = '<p class="dn">Charts are loading in the next update.</p>'; return; }
  const people = mem.members, byId = Object.fromEntries(people.map((m) => [m.id, m]));
  const trades = (tr.trades || []).filter((t) => t.d);
  const BS = (bl && bl.stat) || {};
  const PC = { D: '#4c8dff', R: '#ff5964', I: '#b9c4cf' }, PN = { D: 'Democrats', R: 'Republicans', I: 'Independents' };
  const mid = (a) => { const n = String(a || '').replace(/,/g, '').match(/\d+/g); if (!n) return 0; return n.length > 1 ? (Number(n[0]) + Number(n[1])) / 2 : Number(n[0]); };
  const f$ = (v) => (v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'K' : '$' + Math.round(v));
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const late = (t) => t.filed && t.d && days(t.d, t.filed) > 45;
  const party = (t) => (t.id && byId[t.id] ? byId[t.id].party : null);
  const shortName = (a) => String(a || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*-?\s*(Class [A-Z]|Common Stock).*$/i, '').slice(0, 30);
  let MODE = 'all', SORT = 'trades', OPEN = false;
  const PX = tr.prices || null;
  const pct = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%');
  const edge = (t) => (t.r != null && t.rspy != null ? t.r - t.rspy : null);
  // members' buys vs the S&P 500 over the same days (only members with 5+ priced buys)
  const beat = (L) => {
    const g = {};
    for (const t of L) { if (t.ty !== 'P' || edge(t) == null || !t.id) continue; (g[t.id] = g[t.id] || []).push(t); }
    return Object.entries(g).filter(([, ts]) => ts.length >= 5).map(([id, ts]) => ({ m: byId[id], n: ts.length, r: ts.reduce((a, t) => a + t.r, 0) / ts.length, e: ts.reduce((a, t) => a + edge(t), 0) / ts.length, best: ts.slice().sort((a, b) => edge(b) - edge(a))[0] })).filter((x) => x.m).sort((a, b) => b.e - a.e);
  };
  const divBars = (rows) => { const mx = Math.max(1, ...rows.map((x) => Math.abs(x.e))); return `<div class="db">${rows.map((x) => `<div class="dr" data-t="${esc(`<b>${x.m.name}</b><br>${x.n} buys · stocks moved ${pct(x.r)} on average<br>S&amp;P 500 over the same days: ${pct(x.r - x.e)}<br>Best: ${x.best.tk} ${pct(x.best.r)} since ${x.best.d}`)}"><a href="?m=${x.m.id}#top" class="dnm">${esc(x.m.name)} <span style="color:${PC[x.m.party]}">${x.m.party}-${esc(x.m.state)}</span></a><span class="dz"><i class="${x.e >= 0 ? 'p' : 'n'}" style="width:${(Math.abs(x.e) / mx) * 50}%"></i></span><span class="dv">${pct(x.e)}</span></div>`).join('')}</div>`; };
  const tradeRow = (t, txt) => { const m = byId[t.id]; return `<tr><td>${m ? `<a href="?m=${m.id}#top">${esc(m.name)}</a> <span style="color:${PC[m.party]}">${m.party}-${esc(m.state)}</span>` : esc(t.who)}</td><td><b>${esc(t.tk)}</b></td><td>${esc(t.d)}</td><td class="hot">${txt}</td><td>${pct(t.rspy)}</td></tr>`; };

  const tip = document.createElement('div'); tip.className = 'dtip'; document.body.append(tip);
  const showTip = (e, html) => { tip.innerHTML = html; tip.style.display = 'block'; const x = Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 12), y = e.clientY - tip.offsetHeight - 10; tip.style.left = x + 'px'; tip.style.top = Math.max(8, y) + 'px'; };
  const hideTip = () => (tip.style.display = 'none');

  const sel = (p) => trades.filter((t) => !p || party(t) === p);
  const board = (L, ty) => {
    const g = {};
    for (const t of L) { if (!t.tk || t.ty !== ty) continue; const x = (g[t.tk] = g[t.tk] || { n: 0, v: 0, who: new Set(), name: t.asset }); x.n++; x.v += mid(t.amt); if (t.id) x.who.add(t.id); }
    return Object.entries(g).sort((a, b) => b[1].who.size - a[1].who.size || b[1].n - a[1].n).slice(0, 10);
  };
  // horizontal bars, one hue per chart; value labels in text ink
  const bars = (B, col, unit) => { const mx = Math.max(1, ...B.map(([, x]) => x.who.size)); return B.length ? `<div class="hb">${B.map(([k, x]) => `<div class="hr" data-t="${esc(`<b>${k}</b> · ${shortName(x.name)}<br>${x.who.size} members · ${x.n} ${unit} · est. ${f$(x.v)}`)}"><span class="hk">${esc(k)}</span><span class="ht"><i style="width:${(x.who.size / mx) * 100}%;background:${col}"></i></span><span class="hv">${x.who.size}</span></div>`).join('')}</div>` : '<p class="dn">No trades.</p>'; };
  // monthly line chart (one axis), 2 series, legend + direct end labels
  const monthly = (series) => {
    const months = []; const now = new Date(); for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.toISOString().slice(0, 7)); }
    const vals = series.map((s) => months.map((mo) => s.L.filter((t) => t.d.slice(0, 7) === mo).length));
    const mx = Math.max(1, ...vals.flat()), W = 640, H = 200, P = { l: 34, r: 70, t: 12, b: 26 };
    const X = (i) => P.l + (i / (months.length - 1)) * (W - P.l - P.r), Y = (v) => H - P.b - (v / mx) * (H - P.t - P.b);
    const ticks = [0, Math.round(mx / 2), mx];
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="ln" role="img" aria-label="Trades per month">`;
    svg += ticks.map((v) => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end" class="ax">${v}</text>`).join('');
    svg += months.map((mo, i) => (i % 2 === 0 ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="ax">${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo.slice(5) - 1]}</text>` : '')).join('');
    series.forEach((s, k) => { svg += `<polyline fill="none" stroke="${s.col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${vals[k].map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`; const last = vals[k][vals[k].length - 1]; svg += `<circle cx="${X(months.length - 1)}" cy="${Y(last)}" r="4" fill="${s.col}" stroke="#04110a" stroke-width="2"/><text x="${X(months.length - 1) + 8}" y="${Y(last) + 4}" class="lb">${esc(s.name)}</text>`; });
    svg += months.map((mo, i) => `<rect x="${X(i) - (W - P.l - P.r) / 22}" y="${P.t}" width="${(W - P.l - P.r) / 11}" height="${H - P.t - P.b}" fill="transparent" data-t="${esc(`<b>${mo}</b><br>` + series.map((s, k) => `<span style="color:${s.col}">●</span> ${s.name}: ${vals[k][i]}`).join('<br>'))}"/>`).join('');
    return svg + '</svg>' + `<div class="lg">${series.map((s) => `<span><i style="background:${s.col}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  };
  const kpis = (L, p) => {
    const who = new Set(L.map((t) => t.id).filter(Boolean)), seats = people.filter((m) => !p || m.party === p).length;
    const b = L.filter((t) => t.ty === 'P'), s = L.filter((t) => t.ty === 'S');
    return `<div class="kp"><div><b>${who.size}<small>/${seats}</small></b>members traded</div><div><b>${L.length.toLocaleString('en-US')}</b>trades</div><div><b>${b.length.toLocaleString('en-US')}</b>buys · est. ${f$(b.reduce((a, t) => a + mid(t.amt), 0))}</div><div><b>${s.length.toLocaleString('en-US')}</b>sells · est. ${f$(s.reduce((a, t) => a + mid(t.amt), 0))}</div><div><b>${L.filter(late).length}</b>filed after 45 days</div></div>`;
  };

  const render = () => {
    const ctrl = `<div class="seg2">${[['all', 'All'], ['D', 'Democrats'], ['R', 'Republicans'], ['vs', 'D vs R']].map(([k, l]) => `<button type="button" data-m="${k}" class="${MODE === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    let hx = '', MONTH = '';
    let h = `<div class="dh"><h2>Congress Trading Dashboard</h2><p class="dn">When they bought, when they sold, what they traded — and who beat the market. Disclosed trades of House members, last 12 months. Senate filings coming soon.</p>${ctrl}</div><!--HEAD-->`;
    if (MODE === 'vs') {
      const D = sel('D'), R = sel('R');
      h += `<div class="cols"><div class="card"><h3 style="color:${PC.D}">Democrats</h3>${kpis(D, 'D')}</div><div class="card"><h3 style="color:${PC.R}">Republicans</h3>${kpis(R, 'R')}</div></div><!--FAV-->`;
      h += `<div class="cols"><div class="card"><h3>Most bought · <span style="color:${PC.D}">Democrats</span></h3>${bars(board(D, 'P'), PC.D, 'buys')}</div><div class="card"><h3>Most bought · <span style="color:${PC.R}">Republicans</span></h3>${bars(board(R, 'P'), PC.R, 'buys')}</div></div>`;
      h += `<div class="cols"><div class="card"><h3>Most sold · <span style="color:${PC.D}">Democrats</span></h3>${bars(board(D, 'S'), PC.D, 'sells')}</div><div class="card"><h3>Most sold · <span style="color:${PC.R}">Republicans</span></h3>${bars(board(R, 'S'), PC.R, 'sells')}</div></div>`;
      MONTH = `<div class="card"><h3>Trades per month</h3>${monthly([{ name: 'Democrats', col: PC.D, L: D }, { name: 'Republicans', col: PC.R, L: R }])}</div>`;
    } else {
      const p = MODE === 'all' ? null : MODE, L = sel(p);
      h += `<div class="card">${kpis(L, p)}</div><!--FAV-->`;
      h += `<div class="cols"><div class="card"><h3>Most bought <span class="dn">· by number of members</span></h3>${bars(board(L, 'P'), '#5dff9e', 'buys')}</div><div class="card"><h3>Most sold <span class="dn">· by number of members</span></h3>${bars(board(L, 'S'), '#ff8a8a', 'sells')}</div></div>`;
      MONTH = `<div class="card"><h3>Trades per month</h3>${monthly([{ name: 'Buys', col: '#5dff9e', L: L.filter((t) => t.ty === 'P') }, { name: 'Sells', col: '#ff8a8a', L: L.filter((t) => t.ty === 'S') }])}</div>`;
    }
    // crowd favourites: who beat the market, best-timed buys, sold before a drop
    if (PX) {
      const P3 = MODE === 'D' || MODE === 'R' ? MODE : null;
      if (MODE === 'vs') {
        const avg = (L) => { const e = L.filter((t) => t.ty === 'P' && edge(t) != null); return e.length ? { r: e.reduce((a, t) => a + t.r, 0) / e.length, e: e.reduce((a, t) => a + edge(t), 0) / e.length, n: e.length } : null; };
        const aD = avg(sel('D')), aR = avg(sel('R'));
        hx += `<div class="card"><h3>Who picks better stocks? Democrats vs Republicans</h3><p class="dn">Average move of the stocks each party bought, from the trade date to ${esc(PX.as_of)}, compared with the S&amp;P 500 over the same days.</p><div class="cols">${[['D', aD], ['R', aR]].map(([p, a]) => `<div class="kp"><div><b style="color:${PC[p]}">${a ? pct(a.e) : '—'}</b>vs the S&amp;P 500 · ${PN[p]}</div><div><b>${a ? pct(a.r) : '—'}</b>average stock move · ${a ? a.n : 0} buys</div></div>`).join('')}</div></div>`;
        hx += `<div class="cols"><div class="card"><h3>Beat the market · <span style="color:${PC.D}">Democrats</span></h3>${divBars(beat(sel('D')).slice(0, 8))}</div><div class="card"><h3>Beat the market · <span style="color:${PC.R}">Republicans</span></h3>${divBars(beat(sel('R')).slice(0, 8))}</div></div>`;
      } else {
        const L = sel(P3), B = beat(L);
        hx += `<div class="card hero"><h3>🏆 Who beat the market?</h3><p class="dn">For members with 5+ disclosed buys: how much the stocks they bought moved after the trade date, minus the S&amp;P 500 over the same days. As of ${esc(PX.as_of)}.</p>${divBars(B.slice(0, 10))}${B.length > 10 ? `<details><summary>Show the bottom 10</summary>${divBars(B.slice(-10).reverse())}</details>` : ''}</div>`;
        const best = L.filter((t) => t.ty === 'P' && edge(t) != null).sort((a, b) => edge(b) - edge(a)).slice(0, 10);
        const drop = L.filter((t) => t.ty === 'S' && t.r != null).sort((a, b) => a.r - b.r).slice(0, 10);
        hx += `<div class="cols"><div class="card"><h3>🎯 Best-timed buys</h3><p class="dn">Biggest moves since the purchase date.</p><div class="tw"><table><thead><tr><th>Member</th><th>Ticker</th><th>Bought</th><th>Since</th><th>S&amp;P</th></tr></thead><tbody>${best.map((t) => tradeRow(t, pct(t.r))).join('')}</tbody></table></div></div>
          <div class="card"><h3>📉 Sold right before a drop</h3><p class="dn">The stock fell the most after they sold.</p><div class="tw"><table><thead><tr><th>Member</th><th>Ticker</th><th>Sold</th><th>After</th><th>S&amp;P</th></tr></thead><tbody>${drop.map((t) => tradeRow(t, pct(t.r))).join('')}</tbody></table></div></div></div>`;
      }
      hx += `<p class="dn">These are stock price moves, not actual profits — filings show amount ranges, not share counts or prices. Members with few trades can look lucky.</p>`;
    }
    {
      const P4 = MODE === 'D' || MODE === 'R' ? MODE : null, L = sel(P4);
      const who = new Set(L.map((t) => t.id).filter(Boolean)).size;
      const bb = board(L, 'P')[0], top = PX ? beat(L)[0] : null;
      const buy$ = L.filter((t) => t.ty === 'P').reduce((a, t) => a + mid(t.amt), 0);
      const head = MODE === 'vs' ? '' : `<div class="big"><span>${P4 ? PN[P4] + ': ' : ''}<b>${who}</b> members traded stocks <b>${L.length.toLocaleString('en-US')}</b> times.</span><span>They bought about <b>${f$(buy$)}</b>.${bb ? ` Favorite: <b>${esc(bb[0])}</b>.` : ''}</span>${top ? `<span>Best stock picker: <a href="?m=${top.m.id}#top">${esc(top.m.name)}</a> <b class="up">${pct(top.e)}</b> vs the market.</span>` : ''}</div>`;
      h = h.replace('<!--HEAD-->', head);
    }
    h = h.replace('<!--FAV-->', hx);
    // late filings
    const P2 = MODE === 'D' || MODE === 'R' ? MODE : null;
    const LT = sel(P2).filter(late).sort((a, b) => days(b.d, b.filed) - days(a.d, a.filed)).slice(0, 8);
    h += `<div class="card"><h3>Filed after the 45-day deadline</h3><p class="dn">The STOCK Act asks members to report a trade within 45 days. These were filed later (trade date → filing date).</p>` +
      (LT.length ? `<div class="tw"><table><thead><tr><th>Member</th><th>Ticker</th><th>Type</th><th>Traded</th><th>Filed</th><th>Days</th></tr></thead><tbody>${LT.map((t) => { const m = byId[t.id]; return `<tr><td>${m ? `<a href="?m=${m.id}#top">${esc(m.name)}</a> <span style="color:${PC[m.party]}">${m.party}-${esc(m.state)}</span>` : esc(t.who)}</td><td><b>${esc(t.tk || '—')}</b></td><td>${t.ty === 'P' ? 'Buy' : t.ty === 'S' ? 'Sell' : 'Exch.'}</td><td>${esc(t.d)}</td><td>${esc(t.filed)}</td><td class="hot">${days(t.d, t.filed)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="dn">None found yet — filing dates fill in with the next update.</p>') + `</div>`;
    // members table
    const rows = people.filter((m) => !P2 || m.party === P2).map((m) => { const ts = byM[m.id] || []; const b = BS[m.id] || [0, 0, 0]; return { m, trades: ts.length, buys: ts.filter((t) => t.ty === 'P').length, sells: ts.filter((t) => t.ty === 'S').length, vol: ts.reduce((a, t) => a + mid(t.amt), 0), late: ts.filter(late).length, bills: b[0], laws: b[2] }; });
    rows.sort((a, b) => b[SORT] - a[SORT] || a.m.name.localeCompare(b.m.name));
    const cols = [['trades', 'Trades'], ['buys', 'Buys'], ['sells', 'Sells'], ['vol', 'Est. volume'], ['late', 'Late'], ...(bl ? [['bills', 'Bills'], ['laws', 'Laws']] : [])];
    h += `<details class="more"${OPEN ? ' open' : ''}><summary>More: monthly trend and every member's numbers</summary>` + MONTH + `<div class="card"><h3>Every member</h3><p class="dn">Tap a column to sort. Tap a name to open their file on the map.</p><div class="tw"><table class="mt"><thead><tr><th>Member</th>${cols.map(([k, l]) => `<th><button type="button" data-s="${k}" class="${SORT === k ? 'on' : ''}">${l}${SORT === k ? ' ↓' : ''}</button></th>`).join('')}</tr></thead><tbody>${rows.slice(0, 120).map((r) => `<tr><td><a href="?m=${r.m.id}#top">${esc(r.m.name)}</a> <span style="color:${PC[r.m.party]}">${r.m.party}-${esc(r.m.state)}</span></td>${cols.map(([k]) => `<td>${k === 'vol' ? (r.vol ? f$(r.vol) : '—') : r[k] || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length > 120 ? `<p class="dn">Top 120 of ${rows.length} shown.</p>` : ''}</div></details>`;
    h += `<p class="dn src">Sources: U.S. House Clerk financial disclosures (STOCK Act periodic transaction reports), Congress.gov, @unitedstates/congress-legislators. Amounts are reported ranges; "est." uses range midpoints. Public records — not an accusation of wrongdoing. Built by one person · <a href="https://x.com/KORROOFTOPARODY/creator-subscriptions/subscribe" target="_blank" rel="noopener">support for $1/month on X</a></p>`;
    box.innerHTML = h;
    window.dispatchEvent(new CustomEvent('mt:us-content-updated', { detail: { root: box } }));
    box.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { MODE = b.dataset.m; render(); }));
    box.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { SORT = b.dataset.s; OPEN = true; render(); }));
    const dm = box.querySelector('details.more'); if (dm) dm.ontoggle = () => (OPEN = dm.open);
    box.querySelectorAll('[data-t]').forEach((el) => { el.addEventListener('pointermove', (e) => showTip(e, el.dataset.t)); el.addEventListener('pointerleave', hideTip); });
  };
  const byM = {}; for (const t of trades) if (t.id) (byM[t.id] = byM[t.id] || []).push(t);
  render();
})();
