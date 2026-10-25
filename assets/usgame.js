/* Congress Tracker (English): the U.S. version of the '국회 돈 추적실' game map.
   Public records only (STOCK Act trade disclosures, Congress.gov bills). Not an accusation of wrongdoing. */
(async () => {
  const root = document.getElementById('pg'); if (!root || !window.L) return;
  const D = 'data/us/';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const j = (f) => fetch(D + f, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CAP = [38.8899, -77.0091]; // U.S. Capitol
  const PC = { D: '#2f7bff', R: '#ff3b47', I: '#b9c4cf' }, PN = { D: 'Democrat', R: 'Republican', I: 'Independent' };
  const pc = (p) => PC[p] || '#b9c4cf';
  const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const PAY = 174000; // rank-and-file salary since 2009 (leaders earn more)
  const title = (m) => (m.chamber === 'sen' ? `Senator · ${m.state}` : `Rep. · ${m.state}${m.district ? '-' + m.district : m.district === 0 ? '-AL' : ''}`);
  const amtMid = (a) => { const n = String(a || '').replace(/,/g, '').match(/\d+/g); if (!n) return 0; return n.length > 1 ? (Number(n[0]) + Number(n[1])) / 2 : Number(n[0]); };
  const amtShort = (a) => String(a || '').replace(/\$([\d,]+)/g, (_, x) => { const v = Number(x.replace(/,/g, '')); return '$' + (v >= 1e6 ? (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : v); }).replace(/\s*-\s*/, '–');

  root.innerHTML = `<div class="pg-map" aria-label="Map of members of Congress"></div><div class="pg-scan"></div>
  <div class="pg-top"><div class="pg-box"><div class="live"><i></i>LIVE <span class="mono clk"></span></div><div class="ttl us">U.S. CONGRESS <button type="button" class="snd" aria-label="Sound on/off"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="w" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="m" d="m16 9.5 5 5m0-5-5 5" style="display:none"/></svg></button></div></div>
  <div class="pg-box ctr"><div class="n mono">$0</div><div class="l">Congress pay accrued today · <span class="nmem">535</span> members</div></div></div>
  <div class="pg-say mono"></div>
  <div class="pg-file" role="dialog" aria-label="Record file"></div>
  <nav class="pg-bar" aria-label="Tools">
    <button type="button" data-w="mp"><span class="k">1</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M3 21h18M5 21v-7h14v7M4 14h16M8 14v7M12 14v7M16 14v7"/><path d="M7 14a5 5 0 0 1 10 0"/><path d="M12 9V4.5M10.5 4.5h3"/></svg></span>Members</button>
    <button type="button" data-w="trades"><span class="k">2</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/><path d="M3 21h18" opacity=".5"/></svg></span>Trades</button>
    <button type="button" data-w="party"><span class="k">3</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M5 21V3.5"/><path d="M5 4.5c3-1.6 5.5 1.6 8.5 0s4.5-.6 5.5 0v8.5c-1-.6-2.5-1.6-5.5 0s-5.5-1.6-8.5 0" stroke-linejoin="round"/></svg></span>Party</button>
    <button type="button" data-w="radar"><span class="k">4</span><span class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5" opacity=".6"/><path d="M12 12 18.7 5.3"/><path d="M12 2.5A9.5 9.5 0 0 1 18.7 5.3L12 12z" class="fillp" stroke="none"/><circle cx="16" cy="14.5" r="1.1" class="dot" stroke="none"/></svg></span>Radar</button>
    <button type="button" data-w="rank"><span class="k">5</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M8.5 21v-8h7v8"/><path d="M3 21v-5h5.5M15.5 21v-11H21v11"/><path d="M2 21h20"/><path d="m12 3.2.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" stroke-width="1.3" stroke-linejoin="round"/></svg></span>Rank</button>
    <button type="button" data-w="find"><span class="k">6</span><span class="ic"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 5.6 5.6"/></svg></span>Find</button>
  </nav>
  <button type="button" class="pg-dice" aria-label="Track a random member"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="#5dff9e" stroke="none"/><circle cx="15.5" cy="15.5" r="1.2" fill="#5dff9e" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="#5dff9e" stroke="none"/><circle cx="15.5" cy="8.5" r="1.2" fill="#5dff9e" stroke="none"/><circle cx="8.5" cy="15.5" r="1.2" fill="#5dff9e" stroke="none"/></svg>Track anyone</button>`;
  const $ = (s) => root.querySelector(s);
  const say = $('.pg-say'), file = $('.pg-file');
  let typer = 0;
  const type = (t) => { clearInterval(typer); if (RM) { say.textContent = '> ' + t; return; } let i = 0; say.textContent = '> '; typer = setInterval(() => { say.textContent = '> ' + t.slice(0, ++i) + (i < t.length ? '▌' : ''); if (i >= t.length) clearInterval(typer); }, 18); };

  const SFX = (() => {
    let ac = null, muted = false;
    try { muted = localStorage.getItem('mt.us.mute') === '1'; } catch (e) { /* 무시 */ }
    // 소리는 모두 master(음량 줄이기 + 고음 깎기 + 압축기)를 거쳐 나간다: 여러 소리가 겹쳐도 찢어지지 않게.
    let master = null;
    const ctx = () => {
      if (muted) return null;
      if (!ac) {
        const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
        // 아이폰: 컨텍스트를 만들기 전에 audioSession 을 정해야 중간에 장치 샘플레이트가 바뀌며 지직거리지 않는다(iOS 17+).
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 무시 */ }
        ac = new A();
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; // 폰 스피커에서 날카로운 고음 깎기
        master = ac.createGain(); master.gain.value = 0.7; master.connect(lp); lp.connect(comp); comp.connect(ac.destination);
      }
      if (ac.state === 'suspended' || ac.state === 'interrupted') ac.resume();
      return ac;
    };
    // 첫 터치 때 빈 소리를 한 번 틀어 Web Audio 를 깨운다(<audio> 무음 파일은 아이폰에서 샘플레이트를 바꿔 지직거려서 뺐다).
    let unlocked = false;
    const unlock = () => {
      if (unlocked || muted) return; unlocked = true;
      const a = ctx(); if (!a) return;
      try { const b = a.createBuffer(1, 1, a.sampleRate), src = a.createBufferSource(); src.buffer = b; src.connect(a.destination); src.start(0); } catch (e) { /* 무시 */ }
    };
    ['pointerdown', 'touchend', 'click'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && !muted) ac.resume(); });
    let live = 0;
    const tone = (f, dur, { type = 'sine', vol = 0.18, at = 0, f2 = null, echo = false } = {}) => {
      const a = ctx(); if (!a || live > 8) return; const t = a.currentTime + at; live++;
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      let d = null, fb = null;
      if (echo) { d = a.createDelay(); d.delayTime.value = 0.18; fb = a.createGain(); fb.gain.value = 0.3; g.connect(d); d.connect(fb); fb.connect(d); d.connect(master); }
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { live--; try { o.disconnect(); g.disconnect(); } catch (e) { /* 무시 */ } if (d) setTimeout(() => { try { d.disconnect(); fb.disconnect(); } catch (e) { /* 무시 */ } }, 1500); };
    };
    return {
      get muted() { return muted; },
      toggle() { muted = !muted; if (!muted) { unlocked = false; unlock(); } try { localStorage.setItem('mt.us.mute', muted ? '1' : '0'); } catch (e) { /* 무시 */ } if (muted && ac) ac.suspend(); return muted; },
      ping() { tone(1100, 1.0, { vol: 0.14, echo: true }); },                       // 소나 '띵'
      blip() { tone(880, 0.09, { type: 'triangle', vol: 0.07 }); },                  // 레이더에 잡힌 점
      lock() { tone(660, 0.07, { type: 'triangle', vol: 0.09 }); tone(990, 0.09, { type: 'triangle', vol: 0.09, at: 0.09 }); tone(1320, 0.16, { type: 'triangle', vol: 0.08, at: 0.2 }); }, // 조준 완료 '삑삑삑'
      click() { tone(420, 0.05, { type: 'triangle', vol: 0.08 }); tone(840, 0.04, { type: 'triangle', vol: 0.05, at: 0.04 }); }, // 무기 바꾸기 '철컥'
      whoosh() { tone(260, 0.9, { type: 'sine', vol: 0.06, f2: 900 }); },     // 비행기 출발
    };
  })();

  const [mem, tr, bl] = await Promise.all([j('members.json'), j('trades.json'), j('bills.json')]);
  if (!mem) { type('Could not load data. Please try again shortly.'); return; }
  const people = mem.members || [];
  const trades = ((tr && tr.trades) || []).filter((t) => t.d);
  const byM = {}; for (const t of trades) if (t.id) (byM[t.id] = byM[t.id] || []).push(t);
  const BS = (bl && bl.stat) || {}, BR = (bl && bl.recent) || {};
  const now = Date.now(), day = 864e5;
  const recent = (t, n) => now - Date.parse(t.d) <= n * day;
  const edgeOf = (ts) => { const e = ts.filter((t) => t.ty === 'P' && t.r != null && t.rspy != null); return e.length >= 5 ? e.reduce((a, t) => a + t.r - t.rspy, 0) / e.length : null; };
  const numOf = (m) => { const ts = byM[m.id] || []; const b = BS[m.id] || [0, 0, 0]; return { trades: ts.length, buys: ts.filter((t) => t.ty === 'P').length, sells: ts.filter((t) => t.ty === 'S').length, vol: ts.reduce((a, t) => a + amtMid(t.amt), 0), edge: edgeOf(ts), bills: b[0], passed: b[1], laws: b[2] }; };
  root.querySelector('.nmem').textContent = people.length;

  const clk = $('.clk'), ctr = $('.ctr .n');
  const tick = () => { const n = new Date(); const et = new Date(n.toLocaleString('en-US', { timeZone: 'America/New_York' })); clk.textContent = et.toTimeString().slice(0, 8) + ' ET'; const sec = et.getHours() * 3600 + et.getMinutes() * 60 + et.getSeconds() + n.getMilliseconds() / 1000; ctr.textContent = usd(PAY * people.length / (365 * 86400) * sec); };
  tick(); setInterval(tick, RM ? 1000 : 100);

  // map
  const map = L.map($('.pg-map'), { zoomControl: false, scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.25, minZoom: 2, maxZoom: 12, tap: false });
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 12, attribution: 'Esri · Maxar · @unitedstates · House Clerk · Senate eFD · Congress.gov' }).addTo(map);
  map.createPane('sat'); map.getPane('sat').style.zIndex = 250; map.getPane('sat').style.filter = 'brightness(.72) contrast(1.12) saturate(.75)';
  map.createPane('satlab'); map.getPane('satlab').style.zIndex = 260; map.getPane('satlab').style.pointerEvents = 'none';
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { pane: 'sat', maxZoom: 12, minZoom: 5, opacity: 0 }).addTo(map);
  const satLab = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { pane: 'satlab', maxZoom: 12, minZoom: 6, opacity: 0 }).addTo(map);
  const satFade = () => { const o = Math.max(0, Math.min(1, (map.getZoom() - 5.5) / 1.5)); sat.setOpacity(o); satLab.setOpacity(o * 0.85); root.classList.toggle('sat', o > 0.6); };
  map.on('zoom zoomend', satFade);
  { const sb = document.createElement('div'); sb.className = 'satb'; sb.innerHTML = '<i></i>SAT · SATELLITE'; root.append(sb); }
  const US = L.latLngBounds([[24.5, -125], [49.5, -66.5]]);
  const fitUS = (anim) => map.fitBounds(US, { padding: [60, 16], paddingBottomRight: [16, 90], animate: !!anim && !RM });
  fitUS(false);
  const gDots = L.layerGroup().addTo(map), gFx = L.layerGroup().addTo(map), gTop = L.layerGroup().addTo(map);
  // spread members that share an office location
  const LL = {}, slot = {};
  for (const m of people) { let p = m.ll || CAP; const k = p.map((x) => x.toFixed(2)).join(','); const i = (slot[k] = (slot[k] || 0) + 1) - 1; if (i) { const a = i * 2.4, r = 0.05 * Math.sqrt(i); p = [p[0] + r * Math.sin(a), p[1] + r * 1.3 * Math.cos(a)]; } LL[m.id] = p; }
  const dotOf = {};
  const drawDots = (filter, hot) => {
    gDots.clearLayers();
    for (const m of people) {
      const on = !filter || filter(m), h = hot && hot(m);
      const mk = L.circleMarker(LL[m.id], { radius: on ? (h ? 7 : m.chamber === 'sen' ? 5.5 : 4.2) : 2.5, weight: on ? (h ? 2.5 : 1.2) : 0.4, color: on ? (h ? '#ffc94a' : '#e8fff1') : '#2a4a38', fillColor: pc(m.party), fillOpacity: on ? 0.95 : 0.25, opacity: on ? 0.9 : 0.4 }).addTo(gDots);
      mk.on('click', () => open(m)); mk.bindTooltip(`${esc(m.name)} · ${m.party}-${esc(m.state)}`, { direction: 'top', className: 'clab', offset: [0, -4] });
      dotOf[m.id] = mk;
    }
  };
  const reticle = (ll, keep) => { if (!keep) gTop.clearLayers(); L.marker(ll, { interactive: false, icon: L.divIcon({ className: 'reticle', iconSize: [70, 70], iconAnchor: [35, 35], html: '<svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="22" fill="none" stroke="#5dff9e" stroke-width="2"/><circle cx="35" cy="35" r="30" fill="none" stroke="#5dff9e" stroke-opacity=".35" stroke-width="1" stroke-dasharray="3 5"/><g stroke="#5dff9e" stroke-width="2"><line x1="35" y1="2" x2="35" y2="14"/><line x1="35" y1="56" x2="35" y2="68"/><line x1="2" y1="35" x2="14" y2="35"/><line x1="56" y1="35" x2="68" y2="35"/></g></svg>' }) }).addTo(gTop); };

  // record file
  const pic = (m) => `<img src="${esc(m.pic)}" alt="Official photo of ${esc(m.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ini',textContent:'${esc(m.name.slice(0, 1))}'}))">`;
  const closeFile = () => file.classList.remove('on');
  const padBR = () => (innerWidth >= 900 ? [40, 400] : [30, (file.classList.contains('on') ? file.offsetHeight : 0) + 100]);
  const fileHead = (t) => `<div class="fh"><span>▣ ${esc(t)}</span><span class="tools"><button type="button" class="mn" aria-label="Collapse">▾</button><button type="button" class="x" aria-label="Close">×</button></span></div>`;
  const bindX = () => { file.classList.remove('min'); const x = file.querySelector('.x'); if (x) x.onclick = () => { VSA = null; closeFile(); gTop.clearLayers(); }; const mn = file.querySelector('.mn'); if (mn) mn.onclick = (e) => { e.stopPropagation(); file.classList.toggle('min'); }; };
  const row = (m, right) => `<div class="li" data-id="${esc(m.id)}"><img src="${esc(m.pic)}" alt="" loading="lazy" referrerpolicy="no-referrer"><div class="t"><b>${esc(m.name)}</b> <span style="color:${pc(m.party)};font-size:11px;font-weight:800">${m.party}-${esc(m.state)}</span><div>${esc(title(m))}</div></div>${right ? `<span class="r">${right}</span>` : ''}</div>`;
  const byId = Object.fromEntries(people.map((m) => [m.id, m]));
  const bindRows = () => file.querySelectorAll('.li[data-id]').forEach((el) => (el.onclick = () => { const m = byId[el.dataset.id]; if (m) open(m); }));
  const tline = (t, showWho) => { const m = t.id && byId[t.id]; return `<div class="trd"${m ? ` data-id="${esc(m.id)}"` : ''}><span class="sym"><span class="bs ${t.ty}">${t.ty === 'P' ? 'BUY' : t.ty === 'S' ? 'SELL' : 'EXCH'}</span>${esc(t.tk || '—')}</span><span class="as">${esc(t.asset || '')}</span><span class="am">${esc(amtShort(t.amt))}</span><span class="wh">${esc(t.d)} ${t.ty === 'S' ? 'sold' : 'traded'}${t.r != null ? ` · <b style="color:${t.r >= 0 ? '#7dffb0' : '#ff9b9b'}">${t.r > 0 ? '+' : ''}${t.r}%</b> ${t.ty === 'S' ? 'after' : 'since'} <span style="opacity:.75">(S&amp;P ${t.rspy > 0 ? '+' : ''}${t.rspy}%)</span>` : ''} · ${esc(t.filed || t.fd || '')} filed${showWho ? ` · <b style="color:#fff">${esc(m ? m.name : t.who)}</b>${m ? ` <span style="color:${pc(m.party)}">${m.party}-${esc(m.state)}</span>` : ''}` : ''} · <a href="${esc(t.doc)}" target="_blank" rel="noopener">filing ↗</a></span></div>`; };
  const bindTrd = () => file.querySelectorAll('.trd[data-id]').forEach((el) => (el.onclick = (e) => { if (e.target.closest('a')) return; const m = byId[el.dataset.id]; if (m) open(m); }));
  const SRC = '<div class="fine">Public records as filed. A trade disclosure is not an accusation of wrongdoing. Amounts are the reported ranges.<br>Built by one person. If this is useful, <a href="https://x.com/KORROOFTOPARODY/creator-subscriptions/subscribe" target="_blank" rel="noopener" style="color:#ffd27a">support it for $1/month on X ›</a></div>';

  const tradeTimeline = (ts) => {
    const valid = ts.filter(t => t.tk && /^\d{4}-\d{2}-\d{2}$/.test(t.d) && (t.ty === 'P' || t.ty === 'S'));
    if (!valid.length) return '';
    const tickers = Object.entries(valid.reduce((a,t)=>((a[t.tk]=(a[t.tk]||0)+1),a),{})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]);
    const selected=valid.filter(t=>tickers.includes(t.tk)).sort((a,b)=>a.d.localeCompare(b.d));
    const dates=selected.map(t=>Date.parse(t.d)),lo=Math.min(...dates),hi=Math.max(...dates),span=Math.max(86400000,hi-lo);
    const W=640,left=82,right=20,top=28,row=34,H=top+tickers.length*row+35;
    const X=d=>left+(Date.parse(d)-lo)/span*(W-left-right);
    const grid=tickers.map((tk,i)=>{const y=top+i*row+12;return '<text x="4" y="'+(y+4)+'" fill="#cfe9d8" font-size="13">'+esc(tk)+'</text><line x1="'+left+'" y1="'+y+'" x2="'+(W-right)+'" y2="'+y+'" stroke="#20402c"/>';}).join('');
    const marks=selected.map(t=>{const y=top+tickers.indexOf(t.tk)*row+12;return '<circle cx="'+X(t.d).toFixed(1)+'" cy="'+y+'" r="5" fill="'+(t.ty==='P'?'#5dff9e':'#ff8a8a')+'"><title>'+esc(t.tk+' · '+(t.ty==='P'?'BUY':'SELL')+' · '+t.d+' · '+(t.amt||''))+'</title></circle>';}).join('');
    const start=selected[0].d,end=selected[selected.length-1].d;
    return '<section style="padding:12px 0"><div class="ph2">Stock trade timeline · '+esc(start)+' – '+esc(end)+'</div><div class="ds">Green: buy · Red: sell · Top 5 tickers. Reported trade dates, not stock prices.</div><svg role="img" aria-label="Stock trade timeline by ticker" viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block">'+grid+marks+'<text x="'+left+'" y="'+(H-7)+'" fill="#9fd3b4" font-size="12">'+esc(start)+'</text><text x="'+(W-right)+'" y="'+(H-7)+'" text-anchor="end" fill="#9fd3b4" font-size="12">'+esc(end)+'</text></svg></section>';
  };

  let VSA = null;
  function open(m) {
    if (VSA) { const a = VSA; VSA = null; if (a.id !== m.id) return vs(a, m); }
    SFX.lock(); reticle(LL[m.id]);
    if (!RM) map.flyTo(LL[m.id], Math.max(map.getZoom(), 7.5), { duration: 0.9 }); else map.setView(LL[m.id], 7.5);
    type(`File opened: ${m.name} · ${PN[m.party]} · ${title(m)}`);
    const n = numOf(m), ts = (byM[m.id] || []).slice().sort((a, b) => (b.d || '').localeCompare(a.d || ''));
    const tk = {}; for (const t of ts) if (t.tk) tk[t.tk] = (tk[t.tk] || 0) + 1;
    const top = Object.entries(tk).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const age = m.birth ? new Date().getFullYear() - Number(m.birth) : null;
    file.innerHTML = fileHead(`FILE · ${m.chamber === 'sen' ? 'U.S. SENATE' : 'U.S. HOUSE'} · ${m.id}`) + `
      <div class="who"><div class="ph"><span class="scanl"></span>${pic(m)}</div>
      <div><div class="nm">${esc(m.name)}</div><span class="pt" style="background:${pc(m.party)}">${PN[m.party]}</span>
      <div class="ds">${esc(title(m))} · in Congress since ${esc(m.since)}${age ? `<br>Age ${age}` : ''}</div></div></div>
      <div class="st st4"><div><b>${n.trades}</b><span>stock trades</span></div><div><b>${n.buys}</b><span>buys</span></div><div><b>${n.sells}</b><span>sells</span></div>${n.edge != null ? `<div><b style="color:${n.edge >= 0 ? '#7dffb0' : '#ff9b9b'}">${n.edge > 0 ? '+' : ''}${n.edge.toFixed(1)}%</b><span>vs S&amp;P 500</span></div>` : `<div><b>${bl ? n.bills : '—'}</b><span>bills sponsored</span></div>`}</div>
      <div class="tabs" role="tablist"><button type="button" class="on" data-t="trd">Trades<i>${n.trades}</i></button><button type="button" data-t="bill">Bills<i>${bl ? n.bills : ''}</i></button><button type="button" data-t="prof">Profile</button></div>
      <div class="tb" data-t="trd">${tradeTimeline(ts)}${ts.length ? (top.length ? `<div class="fl2">${top.map(([k, c]) => `<span class="tk">${esc(k)} <small>×${c}</small></span>`).join('')}</div>` : '') + ts.slice(0, 40).map((t) => tline(t)).join('') + (ts.length > 40 ? `<div class="ds">+${ts.length - 40} more in the filings.</div>` : '') : '<div class="ds" style="margin-top:8px">No stock trade disclosures (PTRs) parsed for the last 12 months.</div>'}${SRC}</div>
      <div class="tb" data-t="bill" hidden>${bl ? `<div class="vsum" style="grid-template-columns:repeat(3,1fr)"><div><b>${n.bills}</b>sponsored</div><div><b>${n.passed}</b>passed a chamber</div><div><b>${n.laws}</b>became law</div></div>` + (BR[m.id] || []).map((b) => `<div class="tr"><div class="d">${esc(b.d || '')} · ${esc(b.no)}</div><div class="p"><a href="${esc(b.u)}" target="_blank" rel="noopener">${esc(b.n)}</a></div><div><span class="tg ${b.law ? 'y' : ''}">${esc(b.law ? 'Became law' : (b.a || 'Introduced').slice(0, 70))}</span></div></div>`).join('') + `<div class="fine">${esc(bl.congress)}th Congress · Source: Congress.gov</div>` : '<div class="ds" style="margin-top:8px">Bill data is loading in the next update.</div>'}</div>
      <div class="tb" data-t="prof" hidden>${m.cmits && m.cmits.length ? `<div class="ph2">Committees</div>` + m.cmits.map((c) => `<div class="pl">${esc(c)}</div>`).join('') : ''}
        <div class="ph2">Check the source</div><div class="lk">
        <a href="https://bioguide.congress.gov/search/bio/${esc(m.id)}" target="_blank" rel="noopener">Official biography ↗<span>Bioguide</span></a>
        ${m.url ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">Official website ↗</a>` : ''}
        <a href="${m.chamber === 'sen' ? 'https://efdsearch.senate.gov/search/' : 'https://disclosures-clerk.house.gov/FinancialDisclosure'}" target="_blank" rel="noopener">Financial disclosures (net worth, trades) ↗<span>${m.chamber === 'sen' ? 'Senate eFD' : 'House Clerk'}</span></a>
        <a href="https://www.fec.gov/data/search/?search=${encodeURIComponent(m.name)}" target="_blank" rel="noopener">Campaign money ↗<span>FEC</span></a></div></div>
      <div class="act"><button type="button" class="p" data-a="vs">⇄ Compare</button><button type="button" data-a="share">Copy link</button></div>`;
    file.classList.add('on'); bindX(); bindTrd();
    const tabs = file.querySelectorAll('.tabs button');
    tabs.forEach((bt) => (bt.onclick = () => { SFX.click(); tabs.forEach((x) => x.classList.toggle('on', x === bt)); file.querySelectorAll('.tb').forEach((x) => (x.hidden = x.dataset.t !== bt.dataset.t)); }));
    file.querySelector('[data-a="vs"]').onclick = () => vsPick(m);
    file.querySelector('[data-a="share"]').onclick = async (e) => { const u = location.origin + location.pathname + '?m=' + m.id; try { await navigator.clipboard.writeText(u); e.target.textContent = 'Copied'; } catch (_) { prompt('Link', u); } };
    try { history.replaceState(null, '', '?m=' + m.id); } catch (e) { /* ignore */ }
  }

  function vsPick(a) {
    VSA = a; SFX.click(); type(`Pick someone to compare with ${a.name} — tap a dot or search`);
    file.innerHTML = fileHead('Compare · pick a rival') + `<input class="q" type="search" placeholder="Name or state (e.g. TX)" aria-label="Search member" autocomplete="off"><div class="res"></div><div class="ds">You can also tap a dot on the map.</div>`;
    file.classList.add('on'); bindX();
    const q = file.querySelector('.q'), res = file.querySelector('.res');
    const same = people.filter((m) => m.id !== a.id && m.state === a.state).slice(0, 6);
    const paint = () => { const n = q.value.trim().toLowerCase(); const L2 = n ? people.filter((m) => m.id !== a.id && (m.name.toLowerCase().includes(n) || m.state.toLowerCase() === n)).slice(0, 20) : same; res.innerHTML = (!n && same.length ? '<div class="ph2">Same state</div>' : '') + L2.map((m) => row(m)).join(''); bindRows(); };
    q.oninput = paint; paint(); if (innerWidth >= 900) setTimeout(() => q.focus(), 50);
  }
  function vs(a, b) {
    SFX.lock(); drawDots((m) => m.id === a.id || m.id === b.id); reticle(LL[a.id]); reticle(LL[b.id], true);
    map.flyToBounds(L.latLngBounds([LL[a.id], LL[b.id]]), { paddingTopLeft: [40, 120], paddingBottomRight: padBR(), duration: RM ? 0 : 1, maxZoom: 8 });
    const A = numOf(a), B = numOf(b);
    const rows = [['Stock trades', 'trades', (v) => v], ['Buys', 'buys', (v) => v], ['Sells', 'sells', (v) => v], ['vs S&P 500', 'edge', (v) => (v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%')], ['Est. volume', 'vol', (v) => (v ? '$' + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v / 1e3) + 'K') : '$0')], ['Bills', 'bills', (v) => v], ['Became law', 'laws', (v) => v]];
    const side = (m) => `<div class="vp">${pic(m)}<b>${esc(m.name)}</b><span style="color:${pc(m.party)}">${PN[m.party]}</span><small>${esc(title(m))}</small></div>`;
    file.innerHTML = fileHead('Head to head') + `<div class="vs">${side(a)}<div class="vx">VS</div>${side(b)}</div>` +
      rows.map(([lab, k, f]) => { const x = A[k] ?? null, y = B[k] ?? null, mx = Math.max(Math.abs(x), Math.abs(y)) || 1; return `<div class="vr"><div class="l"><b>${f(x)}</b><i style="width:${(Math.abs(x) / mx) * 100}%"></i></div><span>${lab}</span><div class="r"><i style="width:${(Math.abs(y) / mx) * 100}%"></i><b>${f(y)}</b></div></div>`; }).join('') +
      `<div class="act"><button type="button" class="p" data-a="again">New rival</button><button type="button" data-a="share">Copy link</button><button type="button" data-a="oa">${esc(a.name.split(' ').pop())}</button><button type="button" data-a="ob">${esc(b.name.split(' ').pop())}</button></div>
      <div class="fine">Side-by-side public records, not a scorecard. Est. volume = sum of the midpoints of reported ranges (12 months).</div>`;
    file.classList.add('on'); bindX();
    file.querySelector('[data-a="again"]').onclick = () => vsPick(a);
    file.querySelector('[data-a="oa"]').onclick = () => open(a);
    file.querySelector('[data-a="ob"]').onclick = () => open(b);
    file.querySelector('[data-a="share"]').onclick = async (e) => { const u = location.origin + location.pathname + '?vs=' + a.id + ',' + b.id; try { await navigator.clipboard.writeText(u); e.target.textContent = 'Copied'; } catch (_) { prompt('Link', u); } };
    type(`${a.name} vs ${b.name}`);
    try { history.replaceState(null, '', '?vs=' + a.id + ',' + b.id); } catch (e) { /* ignore */ }
  }

  // tools
  let radarRaf = 0;
  const stopRadar = () => { cancelAnimationFrame(radarRaf); radarRaf = 0; const c = root.querySelector('.pg-radar'); if (c) c.remove(); };
  let PSEL = null, TK = null, TV = 'latest', TP = null, RSEG = 'trades', RDESC = true;
  const RANKS = [
    { k: 'trades', label: 'Most trades', f: (v) => v, note: 'Stock trades disclosed in the last 12 months (parsed electronic filings).' },
    { k: 'vol', label: 'Est. volume', f: (v) => (v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v / 1e3) + 'K'), note: 'Sum of the midpoints of reported amount ranges. A rough estimate.' },
    { k: 'edge', label: 'Beat the market', f: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '%', note: 'Average move of the stocks they bought since each trade date, minus the S&P 500 over the same days (members with 5+ priced buys). Price moves, not actual profits.' },
    { k: 'buys', label: 'Buys', f: (v) => v, note: 'Purchases disclosed in the last 12 months.' },
    { k: 'sells', label: 'Sells', f: (v) => v, note: 'Sales disclosed in the last 12 months.' },
    ...(bl ? [{ k: 'bills', label: 'Bills', f: (v) => v, note: 'Bills and resolutions sponsored in the current Congress.' }, { k: 'laws', label: 'Became law', f: (v) => v, note: 'Sponsored bills that became law in the current Congress.' }] : []),
  ];
  const W = {
    mp() { stopRadar(); gFx.clearLayers(); gTop.clearLayers(); drawDots(); fitUS(true); closeFile(); type(`${people.length} members of Congress · tap a dot to open a file (bigger dots = senators)`); },
    trades() {
      stopRadar(); gTop.clearLayers();
      const win = trades.filter((t) => recent(t, 90));
      const cnt = {}; for (const t of win) if (t.tk) cnt[t.tk] = (cnt[t.tk] || 0) + 1;
      const tops = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const fmt$ = (v) => (v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v / 1e3) + 'K');
      // Congress portfolio: what members bought / sold most (12 months), optionally by party
      const board = (ty) => {
        const g = {};
        for (const t of trades) {
          if (!t.tk || t.ty !== ty) continue;
          const m = t.id && byId[t.id]; if (TP && (!m || m.party !== TP)) continue;
          const x = (g[t.tk] = g[t.tk] || { n: 0, v: 0, who: new Set(), name: t.asset });
          x.n++; x.v += amtMid(t.amt); if (t.id) x.who.add(t.id);
        }
        return Object.entries(g).sort((a, b) => b[1].who.size - a[1].who.size || b[1].n - a[1].n).slice(0, 15);
      };
      const nameOf = (a) => String(a || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*-?\s*Common Stock.*$/i, '').slice(0, 34);
      const avgLine = () => {
        const sel = trades.filter((t) => { const m = t.id && byId[t.id]; return !TP || (m && m.party === TP); });
        const who = new Set(sel.map((t) => t.id).filter(Boolean));
        const b = sel.filter((t) => t.ty === 'P').length, sl = sel.filter((t) => t.ty === 'S').length;
        const per = who.size ? (sel.length / who.size).toFixed(1) : 0;
        return `<div class="vsum" style="grid-template-columns:repeat(4,1fr)"><div><b>${who.size}</b>members trading</div><div><b>${per}</b>trades each (avg)</div><div><b>${b.toLocaleString('en-US')}</b>buys</div><div><b>${sl.toLocaleString('en-US')}</b>sells</div></div>`;
      };
      const paint = () => {
        const head = `<div class="seg"><button type="button" data-v="latest" class="${TV === 'latest' ? 'on' : ''}">Latest</button><button type="button" data-v="P" class="${TV === 'P' ? 'on' : ''}">Most bought</button><button type="button" data-v="S" class="${TV === 'S' ? 'on' : ''}">Most sold</button></div>`;
        if (TV === 'latest') {
          const L2 = (TK ? trades.filter((t) => t.tk === TK) : trades).slice().sort((a, b) => (b.fd || '').localeCompare(a.fd || '') || (b.d || '').localeCompare(a.d || ''));
          const ids = new Set(L2.slice(0, 200).map((t) => t.id).filter(Boolean));
          drawDots((m) => ids.has(m.id), (m) => ids.has(m.id) && (byM[m.id] || []).some((t) => recent(t, 30)));
          file.innerHTML = fileHead(TK ? `Trades · ${TK}` : 'Congress trades') + head + `<div class="ds">Most traded tickers · last 90 days</div><div class="fl2">${tops.map(([k, c]) => `<button type="button" class="tk${TK === k ? ' on' : ''}" data-k="${esc(k)}">${esc(k)} <small>×${c}</small></button>`).join('')}</div>` +
            L2.slice(0, 50).map((t) => tline(t, true)).join('') + (L2.length ? '' : '<div class="ds">No trades yet — data is still loading.</div>') + SRC;
        } else {
          const B = board(TV), mx = Math.max(1, ...B.map(([, x]) => x.who.size));
          const ids = new Set(B.flatMap(([, x]) => [...x.who]));
          drawDots((m) => ids.has(m.id) && (!TP || m.party === TP));
          file.innerHTML = fileHead(TV === 'P' ? 'What Congress is buying' : 'What Congress is selling') + head +
            `<div class="fl2"><button type="button" class="tk${!TP ? ' on' : ''}" data-p="">All</button><button type="button" class="tk${TP === 'D' ? ' on' : ''}" data-p="D" style="${TP === 'D' ? '' : 'color:#8fb4ff'}">Democrats</button><button type="button" class="tk${TP === 'R' ? ' on' : ''}" data-p="R" style="${TP === 'R' ? '' : 'color:#ff9b9b'}">Republicans</button></div>` + avgLine() +
            `<div class="ds">Ranked by how many members ${TV === 'P' ? 'bought' : 'sold'} it (last 12 months)</div>` +
            B.map(([k, x], i) => `<div class="trd" data-k2="${esc(k)}"><span class="sym"><span class="rk">${i + 1}</span>${esc(k)}</span><span class="as">${esc(nameOf(x.name))}</span><span class="am">${x.who.size} members</span><span class="wh"><span class="pbar"><i style="width:${(x.who.size / mx) * 100}%;background:${TV === 'P' ? '#5dff9e' : '#ff6b6b'}"></i></span>${x.n} ${TV === 'P' ? 'buys' : 'sells'} · est. ${fmt$(x.v)}</span></div>`).join('') +
            '<div class="fine">Est. = sum of the midpoints of reported amount ranges, a rough guide. Tap a ticker to see every trade.</div>' + SRC;
        }
        file.classList.add('on'); bindX(); bindTrd(); if (innerWidth < 900 && !TK && TV === 'latest') file.classList.add('min');
        file.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { TV = b.dataset.v; TK = null; SFX.click(); paint(); type(TV === 'P' ? 'What Congress is buying' : TV === 'S' ? 'What Congress is selling' : 'Latest disclosed trades'); }));
        file.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { TP = b.dataset.p || null; SFX.click(); paint(); }));
        file.querySelectorAll('[data-k2]').forEach((el) => (el.onclick = () => { TV = 'latest'; TK = el.dataset.k2; SFX.click(); paint(); type(`${TK}: ${trades.filter((t) => t.tk === TK).length} disclosed trades`); }));
        file.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { TK = TK === b.dataset.k ? null : b.dataset.k; SFX.click(); paint(); type(TK ? `${TK}: ${trades.filter((t) => t.tk === TK).length} disclosed trades` : 'All trades'); }));
      };
      paint(); fitUS(true);
      type(`${trades.length.toLocaleString('en-US')} disclosed trades · ${win.length} in the last 90 days`);
    },
    party() {
      stopRadar(); gFx.clearLayers(); gTop.clearLayers(); fitUS(true);
      const P = ['D', 'R', 'I'];
      const st = Object.fromEntries(P.map((p) => { const ms = people.filter((m) => m.party === p); const ts = trades.filter((t) => t.id && byId[t.id] && byId[t.id].party === p); return [p, { seats: ms.length, sen: ms.filter((m) => m.chamber === 'sen').length, who: new Set(ts.map((t) => t.id)).size, n: ts.length, b: ts.filter((t) => t.ty === 'P').length, s: ts.filter((t) => t.ty === 'S').length, v: ts.reduce((a, t) => a + amtMid(t.amt), 0), top: Object.entries(ts.filter((t) => t.ty === 'P' && t.tk).reduce((a, t) => ((a[t.tk] = (a[t.tk] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k) }]; }));
      const fmt = (v) => (v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v / 1e3) + 'K');
      const mx = Math.max(1, ...P.map((p) => st[p].n));
      const paint = () => {
        drawDots(PSEL ? (m) => m.party === PSEL : null);
        file.innerHTML = fileHead('Party') + `<div class="ds">Tap a party to show only its members on the map.</div>` + P.filter((p) => st[p].seats).map((p) => `<div class="pb li" data-p="${p}" style="display:block${PSEL && PSEL !== p ? ';opacity:.45' : ''}"><div class="h"><span><span style="color:${pc(p)}">●</span> ${PN[p]}s <span style="color:#8fc9a5;font-size:11.5px">${st[p].seats} seats · ${st[p].sen} senators</span></span><b>${st[p].n} trades</b></div><div class="tkb"><i style="width:${(st[p].n / mx) * 100}%;background:${pc(p)}"></i></div><div class="ds" style="margin-top:3px">${st[p].who} members traded · ${st[p].b} buys · ${st[p].s} sells · est. ${fmt(st[p].v)}${st[p].top.length ? ' · top buys ' + st[p].top.join(', ') : ''}</div></div>`).join('') +
          `<div class="act"><a href="#usdash" class="p" style="text-decoration:none">📊 Compare D vs R charts</a></div>` + SRC;
        file.classList.add('on'); bindX();
        file.querySelectorAll('[data-p]').forEach((el) => (el.onclick = () => { PSEL = PSEL === el.dataset.p ? null : el.dataset.p; SFX.click(); paint(); type(PSEL ? `${PN[PSEL]}s: ${st[PSEL].seats} members on the map` : 'All parties'); }));
      };
      paint(); type(`Democrats ${st.D.seats} · Republicans ${st.R.seats} · Independents ${st.I.seats}`);
    },
    radar() {
      gFx.clearLayers(); gTop.clearLayers(); closeFile();
      // Price movement is NOT realized member profit; filings do not provide exact execution prices.
      let radarMode = 'recent';
      let hot = [];
      const seen = new Set();
      const score = (m) => {
        const priced = (byM[m.id] || []).filter(t => t.ty === 'P' && Number.isFinite(Number(t.r)) && t.r != null);
        if (!priced.length) return null;
        return { n: priced.length, avg: priced.reduce((a,t)=>a+Number(t.r),0)/priced.length };
      };
      const radarList = () => people.filter(m => {
        const ts = byM[m.id] || [];
        if (radarMode === 'recent') return ts.some(t=>recent(t,30));
        const v=score(m);
        return v && (radarMode==='up' ? v.avg>0 : v.avg<0);
      });
      const paintRadar = () => {
        hot=radarList();
        const ids=new Set(hot.map(m=>m.id));
        drawDots(m=>false,()=>true);
        // Targets are revealed as the sweep reaches each map marker.
        seen.clear();
        const choices=[['recent','최근 30일 거래'],['up','매수 후 상승'],['down','매수 후 하락']];
        file.innerHTML=fileHead('Radar · stock activity')+
          '<div class="seg" role="group" aria-label="Radar filters">'+choices.map(([k,l])=>'<button type="button" data-radar="'+k+'" class="'+(radarMode===k?'on':'')+'">'+l+'</button>').join('')+'</div>'+
          '<div class="ds">'+(radarMode==='recent'?'최근 30일 신고 거래 기준':'기록된 매수 종목의 거래일 이후 주가 변동 평균 기준 · 실제 의원 손익 아님')+' · '+hot.length+' members</div>'+
          hot.sort((a,b)=>radarMode==='recent'?(byM[b.id]||[]).length-(byM[a.id]||[]).length:radarMode==='up'?score(b).avg-score(a).avg:score(a).avg-score(b).avg).slice(0,40).map(m=>{
            const v=score(m);
            return row(m,radarMode==='recent'?(byM[m.id]||[]).filter(t=>recent(t,30)).length+' trades':(v.avg>0?'+':'')+v.avg.toFixed(1)+'% · '+v.n+' buys');
          }).join('')+(hot.length?'':'<div class="ds">No matching records with priced purchases.</div>')+SRC;
        file.classList.add('on');file.classList.remove('min');bindX();bindRows();
        file.querySelectorAll('[data-radar]').forEach(b=>b.onclick=()=>{radarMode=b.dataset.radar;SFX.click();paintRadar();});
        type('Radar · '+hot.length+' members · '+(radarMode==='recent'?'recent trades':radarMode==='up'?'stocks rose after purchase':'stocks fell after purchase'));
      };
      paintRadar();fitUS(true);
      // Keep filter controls visible independently of the collapsible record drawer.
      const oldBar=root.querySelector('.radar-quick');if(oldBar)oldBar.remove();
      const quick=document.createElement('div');quick.className='radar-quick';
      quick.style.cssText='position:absolute;z-index:1200;top:72px;left:50%;transform:translateX(-50%);display:flex;gap:6px;flex-wrap:wrap;justify-content:center;padding:8px;background:#061a12ee;border:1px solid #357b54;border-radius:12px;max-width:calc(100% - 20px);box-shadow:0 5px 22px #0009';
      [['recent','최근 거래'],['up','매수 후 상승'],['down','매수 후 하락']].forEach(([key,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.mode=key;b.style.cssText='border:1px solid #417b57;border-radius:7px;padding:7px 9px;background:#143422;color:#eafff2;font-size:12px;cursor:pointer';b.onclick=()=>{radarMode=key;paintRadar();quick.querySelectorAll('button').forEach(x=>{x.style.background=x.dataset.mode===key?'#247748':'#143422';});};quick.appendChild(b);});
      root.appendChild(quick);quick.firstChild.style.background='#247748';
      stopRadar(); if (RM) return;
      const cv = document.createElement('canvas'); cv.className = 'pg-radar'; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:600;pointer-events:none'; root.querySelector('.pg-map').after(cv);
      const g = cv.getContext('2d'); const r0 = devicePixelRatio || 1; cv.width = root.clientWidth * r0; cv.height = root.clientHeight * r0; g.setTransform(r0, 0, 0, r0, 0, 0);
      const t0 = performance.now(); let rev = -1, lastBlip = 0;
      const loop = (now) => {
        const rv = Math.floor((now - t0) / 2600); if (rv !== rev) { rev = rv; seen.clear(); SFX.ping(); }
        const c = map.latLngToContainerPoint([38.5, -96]), R = Math.max(root.clientWidth, root.clientHeight) * 0.7, a = ((now - t0) / 2600) * Math.PI * 2;
        g.clearRect(0, 0, cv.width, cv.height);
        const gr = g.createConicGradient ? g.createConicGradient(a - 0.9, c.x, c.y) : null;
        if (gr) { gr.addColorStop(0, 'rgba(93,255,158,0)'); gr.addColorStop(0.14, 'rgba(93,255,158,.28)'); gr.addColorStop(0.145, 'rgba(93,255,158,0)'); g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, R, 0, 6.283); g.fill(); }
        g.strokeStyle = 'rgba(93,255,158,.18)'; for (const r of [R * 0.25, R * 0.5, R * 0.75]) { g.beginPath(); g.arc(c.x, c.y, r, 0, 6.283); g.stroke(); }
        g.strokeStyle = 'rgba(160,255,200,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x + R * Math.cos(a), c.y + R * Math.sin(a)); g.stroke(); g.lineWidth = 1;
        for (const m of hot) { const p = map.latLngToContainerPoint(LL[m.id]); let d = Math.atan2(p.y - c.y, p.x - c.x) - a; d = ((d % 6.283) + 6.283) % 6.283; const glow = Math.max(0, 1 - (6.283 - d) / 1.2); if (glow > 0) { g.fillStyle = `rgba(255,176,32,${0.9 * glow})`; g.beginPath(); g.arc(p.x, p.y, 7 + 10 * glow, 0, 6.283); g.fill(); if (glow > 0.9 && !seen.has(m.id) && now - lastBlip > 140) { seen.add(m.id); lastBlip = now; const marker=dotOf[m.id]; if(marker)marker.setStyle({radius:8,weight:2.5,color:'#ffc94a',fillOpacity:1,opacity:1}); SFX.blip(); } } }
        radarRaf = requestAnimationFrame(loop);
      };
      radarRaf = requestAnimationFrame(loop);
    },
    rank() {
      stopRadar(); gFx.clearLayers(); gTop.clearLayers();
      const K = RANKS.find((x) => x.k === RSEG) || RANKS[0];
      const L0 = people.map((m) => [m, numOf(m)[K.k]]).filter(([, v]) => v != null).sort((a, b) => (RDESC ? b[1] - a[1] : a[1] - b[1]) || a[0].name.localeCompare(b[0].name));
      const top = L0.slice(0, 20), ids = new Set(top.map(([m]) => m.id));
      drawDots((m) => ids.has(m.id)); fitUS(true);
      file.innerHTML = fileHead('Rank') + `<div class="seg">${RANKS.map((x) => `<button type="button" data-s="${x.k}" class="${RSEG === x.k ? 'on' : ''}">${x.label}</button>`).join('')}</div><div class="ord"><button type="button" data-o="1" class="${RDESC ? 'on' : ''}">Most</button><button type="button" data-o="0" class="${RDESC ? '' : 'on'}">Fewest</button></div>` +
        top.map(([m, v], i) => row(m, `<span class="rk">${i + 1}</span>${K.f(v)}`)).join('') + `<div class="fine">${K.note} Counts from public records — not a judgment.</div>`;
      file.classList.add('on'); bindX(); bindRows();
      file.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { RSEG = b.dataset.s; SFX.click(); W.rank(); }));
      file.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { RDESC = b.dataset.o === '1'; SFX.click(); W.rank(); }));
      type(`${K.label} · top 20 on the map`);
    },
    find() {
      stopRadar(); gFx.clearLayers();
      file.innerHTML = fileHead('Find') + `<input class="q" type="search" placeholder="Name, state, or ticker (e.g. Pelosi, TX, NVDA)" aria-label="Search" autocomplete="off"><button type="button" class="allb gps" style="margin:0 0 6px">📍 Find my representatives (near me)</button><div class="res"></div>`;
      file.classList.add('on'); bindX();
      const q = file.querySelector('.q'), res = file.querySelector('.res');
      const paint = () => {
        const n = q.value.trim(); if (!n) { res.innerHTML = ''; return; }
        const lo = n.toLowerCase(), up = n.toUpperCase();
        const ms = people.filter((m) => m.name.toLowerCase().includes(lo) || m.state === up).slice(0, 25);
        const tks = trades.filter((t) => t.tk === up);
        res.innerHTML = (tks.length ? `<div class="ph2">${esc(up)} · ${tks.length} disclosed trades</div>` + tks.slice(0, 15).map((t) => tline(t, true)).join('') : '') + ms.map((m) => row(m, (byM[m.id] || []).length ? (byM[m.id] || []).length + ' trades' : '')).join('') || '<div class="ds">No match.</div>';
        bindRows(); bindTrd();
      };
      q.addEventListener('input', paint); if (innerWidth >= 900) setTimeout(() => q.focus(), 50);
      file.querySelector('.gps').onclick = (e) => {
        const bt = e.currentTarget; if (!navigator.geolocation) { bt.textContent = 'Location is not available on this device'; return; }
        bt.textContent = 'Locating…';
        navigator.geolocation.getCurrentPosition((p) => {
          const me = [p.coords.latitude, p.coords.longitude]; const d2 = (a) => (a[0] - me[0]) ** 2 + ((a[1] - me[1]) * 0.8) ** 2;
          const reps = people.filter((m) => m.chamber === 'rep' && m.ll_office).sort((a, b) => d2(a.ll) - d2(b.ll)).slice(0, 3);
          const st = reps[0] ? reps[0].state : null; const sens = people.filter((m) => m.chamber === 'sen' && m.state === st);
          bt.textContent = '📍 Near you (approximate)';
          res.innerHTML = '<div class="ph2">Senators</div>' + sens.map((m) => row(m)).join('') + '<div class="ph2">Nearest House offices</div>' + reps.map((m) => row(m)).join('') + '<div class="fine">Your location stays on this device. House members are matched by nearest district office, so it is approximate.</div>';
          bindRows(); if (reps[0]) { reticle(LL[reps[0].id]); map.flyTo(LL[reps[0].id], 7, { duration: RM ? 0 : 0.9 }); }
          SFX.lock(); type(`Your delegation: ${sens.length} senators · nearest reps`);
        }, () => { bt.textContent = 'Location blocked — search by state instead'; }, { timeout: 9000, maximumAge: 600000 });
      };
      type('Search ready…');
    },
  };

  const snd = root.querySelector('.snd'); const paintSnd = () => snd.classList.toggle('off', SFX.muted); paintSnd(); snd.onclick = () => { SFX.toggle(); paintSnd(); if (!SFX.muted) SFX.click(); };
  new MutationObserver(() => { const on = file.classList.contains('on'); if (root.classList.contains('fileon') !== on) { root.classList.toggle('fileon', on); setTimeout(() => map.invalidateSize({ pan: false }), 30); } }).observe(file, { attributes: true, attributeFilter: ['class'] });
  // Mouse wheel zooms the map only over its surface; panels keep their own scrolling.
  file.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
  const mapEl = root.querySelector('.pg-map');
  // Explicit wheel routing: zoom over the map, scroll inside panels, page scroll elsewhere.
  let wheelAccum = 0;
  root.addEventListener('wheel', (e) => {
    if (e.target.closest('.pg-file, .pg-bar, .pg-top, .radar-quick, button, a, input, select')) return;
    e.preventDefault();
    e.stopPropagation();
    wheelAccum += e.deltaY;
    if (Math.abs(wheelAccum) < 35) return;
    const delta = wheelAccum < 0 ? 0.5 : -0.5;
    wheelAccum = 0;
    const rect = mapEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    map.setZoomAround([x,y], Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)), {animate:false});
  }, { passive:false });
  ['touchstart', 'wheel'].forEach((ev) => mapEl.addEventListener(ev, () => { if (innerWidth < 900 && file.classList.contains('on')) file.classList.add('min'); }, { passive: true }));
  file.addEventListener('click', (e) => { if (file.classList.contains('min') && !e.target.closest('.x')) file.classList.remove('min'); });
  const btns = [...root.querySelectorAll('.pg-bar button')];
  const pick = (w, quiet) => { if(w!=='radar'){const bar=root.querySelector('.radar-quick');if(bar)bar.remove();} if (!quiet) SFX.click(); btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.w === w))); W[w](); };
  btns.forEach((b) => (b.onclick = () => pick(b.dataset.w)));
  addEventListener('keydown', (e) => { if (/input|textarea/i.test((e.target && e.target.tagName) || '')) return; const i = Number(e.key) - 1; if (i >= 0 && i < btns.length) pick(btns[i].dataset.w); if (e.key === 'Escape') { VSA = null; closeFile(); } });
  setTimeout(() => map.invalidateSize(), 300); addEventListener('resize', () => map.invalidateSize());

  const dice = root.querySelector('.pg-dice'); let rolling = false;
  dice.onclick = () => {
    if (rolling) return; rolling = true; dice.classList.add('spin'); dice.style.animation = 'none'; closeFile(); pick('mp', true);
    const traders = people.filter((m) => (byM[m.id] || []).length), rnd = (L2) => L2[Math.floor(Math.random() * L2.length)];
    const target = traders.length && Math.random() < 0.8 ? rnd(traders) : rnd(people);
    let k = 0; const steps = RM ? 0 : 14;
    const hop = () => { if (k >= steps) { rolling = false; dice.classList.remove('spin'); open(target); return; } const m = rnd(people); reticle(LL[m.id]); SFX.blip(); type(`Scanning… ${m.name}`); k++; setTimeout(hop, 60 + k * k * 2.2); };
    setTimeout(hop, RM ? 0 : 300);
  };

  pick('mp', true);
  const qs = new URLSearchParams(location.search);
  const want = qs.get('m'), vq = (qs.get('vs') || '').split(',').map((x) => byId[x]);
  if (want && byId[want]) setTimeout(() => open(byId[want]), 600);
  else if (vq.length === 2 && vq[0] && vq[1]) setTimeout(() => vs(vq[0], vq[1]), 600);
  else if (qs.get('tool') && W[qs.get('tool')]) setTimeout(() => pick(qs.get('tool'), true), 400);
})();
