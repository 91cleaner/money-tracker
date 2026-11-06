/* US room tab bar, in the spirit of the Korean room: one big number, a live clock,
   one row of tabs, and every tap shows concrete records (who, when, how much, link). Korean only. */
(() => {
  if (window.MTI18N && window.MTI18N.isEn) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tk = new URLSearchParams(location.search).get('ticker');
  const wide = () => matchMedia('(min-width:900px), (orientation:landscape) and (min-width:640px)').matches;
  if (tk) return; // ticker pages keep their own stop panel
  const money = (v) => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString('en-US')}`;
  const SIDE = { P: '매수', S: '매도', 'S (partial)': '일부 매도', E: '교환' };
  const go = (t) => `?lang=ko&ticker=${encodeURIComponent(t)}`;
  const css = document.createElement('style');
  css.textContent = `
#mtTabs{font-family:Pretendard,-apple-system,"Segoe UI",sans-serif;color:#f2fff6;display:flex;flex-direction:column;min-height:0}
#mtTabs .tbHero{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;padding:12px 14px;border-radius:18px;background:#07110b;border:1px solid #1e3a2a;margin-bottom:8px}
#mtTabs .tbHero small{display:block;font-size:12px;color:#8fb59d}#mtTabs .tbHero b{display:block;font-size:34px;letter-spacing:-.04em;line-height:1.05;color:#5dff9e}
#mtTabs .tbClock{font:700 12px ui-monospace,Menlo,monospace;color:#bfe9cf;text-align:right}#mtTabs .tbClock i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff5a5a;margin-right:5px;animation:tbB 1.2s infinite}
@keyframes tbB{50%{opacity:.25}}
#mtTabs .tbPanel{flex:1 1 auto;min-height:0;overflow:auto}
#mtTabs .tbRow{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 12px;margin:0 0 6px;border-radius:14px;background:#0b1510;border:1px solid #1e3a2a;color:#eafff2;font:500 14px/1.45 Pretendard,system-ui,sans-serif;text-decoration:none;cursor:pointer}
#mtTabs .tbRow:hover{border-color:#5dff9e}
#mtTabs .tbRow .l{flex:1 1 auto;min-width:0}#mtTabs .tbRow .l small{display:block;color:#8fb59d;font-size:12px}
#mtTabs .tbRow .r{flex:none;text-align:right;font-weight:800;font-size:17px;letter-spacing:-.02em}
#mtTabs .tbRow .r.up{color:#5dff9e}#mtTabs .tbRow .r.dn{color:#ff7a7a}
#mtTabs .tbH{font-size:13px;font-weight:700;color:#8fb59d;margin:4px 2px 8px}
#mtTabs .tbFind{display:flex;gap:6px;margin:4px 0 10px}#mtTabs .tbFind input{flex:1;min-width:0;font:600 16px Pretendard,system-ui,sans-serif;color:#eafff2;background:#06150c;border:1px solid #2f7a4c;border-radius:12px;padding:12px}
#mtTabs .tbFind button{border:0;border-radius:12px;padding:0 16px;background:#5dff9e;color:#02110a;font:800 15px Pretendard,system-ui,sans-serif}
#mtTabs .tbRetry{margin:6px 2px;padding:10px 14px;border:1px solid #5dff9e;border-radius:10px;background:#123923;color:#eafff2;font:700 14px Pretendard,system-ui,sans-serif;cursor:pointer}
#mtTabBar{display:flex;gap:4px;padding:6px;border-radius:18px;background:#07110b;border:1px solid #1e3a2a;margin-top:8px}
#mtTabBar button{flex:1;min-width:0;padding:9px 2px;border:0;border-radius:12px;background:none;color:#9fc7ad;font:700 13px Pretendard,system-ui,sans-serif;cursor:pointer}
#mtTabBar button[aria-selected=true]{background:#5dff9e;color:#02110a}
@media(max-width:899px) and (orientation:portrait), (max-width:639px){
 #mtTabs{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:1500;max-height:50dvh;padding:10px;border-radius:22px;background:#030906f2;border:1px solid #1e3a2a;box-shadow:0 -8px 30px #000a}
 #mtTabs .tbHero b{font-size:28px}
 #controls{bottom:calc(50dvh + 18px)!important}
}
#tbPanel #mtToday.home{position:static!important;inset:auto!important;max-height:none!important;border:0!important;background:none!important;padding:0!important;box-shadow:none!important}
#tbPanel #mtToday .tdHd{display:none}
@media(min-width:900px), (orientation:landscape) and (min-width:640px){#mtSide>#mtTabs{flex:1 1 auto;min-height:0}}`;
  document.head.append(css);
  const J = async (u) => {
    const response = await fetch(u, { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  };
  const loadFailure = (label) => `<div class="tbH" role="alert">${label} 자료를 불러오지 못했습니다. 0건으로 집계하지 않습니다.</div><button class="tbRetry" id="tbRetry" type="button">다시 시도</button>`;
  const root = document.createElement('section'); root.id = 'mtTabs'; root.setAttribute('aria-label', '미국 기록 보기');
  root.innerHTML = `<div class="tbHero"><div><small id="tbHeroL">기록 불러오는 중</small><b id="tbHeroN">-</b></div><div class="tbClock"><i></i><span id="tbClk"></span><br>워싱턴 시간</div></div><div class="tbPanel" id="tbPanel"></div><nav id="mtTabBar" role="tablist"></nav>`;
  const TABS = [['today', '오늘'], ['mem', '의원'], ['wh', '백악관'], ['rank', '순위'], ['find', '찾기']];
  const bar = root.querySelector('#mtTabBar');
  TABS.forEach(([id, l]) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.t = id; b.textContent = l; b.onclick = () => show(id); bar.append(b); });
  const clk = () => { const e = root.querySelector('#tbClk'); if (e) e.textContent = new Date().toLocaleTimeString('ko-KR', { timeZone: 'America/New_York', hour12: false }); };
  setInterval(clk, 1000); clk();
  let D = null, TR = null, WH = null, showSeq = 0, activeTab = 'today', dailyStatus = 'loading', todayNode = null;
  // Untrusted filing/White House URLs must never become executable links.
  // Only verified official disclosure origins may be clickable external sources.
  // Exact host matches prevent lookalikes (official.gov.evil.example); HTTPS only.
  const SOURCE_HOSTS = new Set(['disclosures-clerk.house.gov', 'www.federalregister.gov', 'www.whitehouse.gov']);
  const safeHref = (href) => {
    if (typeof href !== 'string') return null;
    if (/^\?lang=ko&ticker=[A-Za-z0-9._%~-]+$/.test(href)) return href;
    try {
      const u = new URL(href);
      return u.protocol === 'https:' && SOURCE_HOSTS.has(u.hostname) &&
        !u.username && !u.password && !u.port ? u.href : null;
    } catch (_) { return null; }
  };
  const row = (href, l, s, r, cls) => {
    const url = safeHref(href);
    const tag = url ? 'a' : 'div';
    const attrs = url ? ` href="${esc(url)}"${/^https?:/i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : ''}` : '';
    return `<${tag} class="tbRow"${attrs}><span class="l">${esc(l)}<small>${esc(s)}</small></span>${r ? `<span class="r ${cls || ''}">${esc(r)}</span>` : ''}</${tag}>`;
  };
  async function show(id) {
    bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b.dataset.t === id));
    const P = root.querySelector('#tbPanel'); const ticket = ++showSeq; activeTab = id; let h = '';
    if ((id === 'mem' && !TR) || (id === 'wh' && !WH)) {
      P.innerHTML = '<div class="tbH" role="status">공개 자료를 불러오는 중입니다…</div>';
    }
    if (id === 'today') {
      const box = todayNode || $('mtToday'); if (box) { todayNode = box; box.className = 'home'; P.replaceChildren(box); return; }
      h = '<div class="tbH">오늘의 기록을 불러오는 중이에요.</div>';
    } else if (id === 'mem') {
      try {
        if (!TR) {
          const loaded = await J('../data/us/trades-recent.json');
          if (!loaded || !Array.isArray(loaded.trades)) throw new Error('Invalid PTR schema');
          TR = loaded;
        }
        const t = TR.trades;
        h = `<div class="tbH">최근 의원 주식 신고 ${t.length}건 · 누르면 그 종목으로 가요</div>` + t.map((x) => row(x.tk ? go(x.tk) : x.doc, `${x.who} · ${x.tk || '종목'}`, `거래 ${x.d} · 신고 ${x.fd} · ${x.amt}`, SIDE[x.ty] || x.ty, x.ty === 'P' ? 'up' : 'dn')).join('');
      } catch (_) { TR = null; h = loadFailure('의원 신고'); }
    } else if (id === 'wh') {
      try {
        if (!WH) {
          const loaded = await J('../data/us/whitehouse.json');
          if (!loaded || !Array.isArray(loaded.items)) throw new Error('Invalid White House schema');
          WH = loaded;
        }
        const w = WH.items.filter((x) => x.kind === 'presdoc').sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 12);
        h = `<div class="tbH">최근 대통령 문서 ${w.length}건 · 누르면 관보 원문이 열려요</div>` + w.map((x) => row(x.u, `${x.type || '대통령 문서'}${x.procl ? ' 제' + x.procl + '호' : ''}${x.eo ? ' 제' + x.eo + '호' : ''}`, `${x.date} · ${x.ko || ''}`, '', '')).join('');
      } catch (_) { WH = null; h = loadFailure('대통령 문서'); }
    } else if (id === 'rank') {
      const s = (D && D.snap) || {};
      const blk = (f, lab) => { const e = Object.entries(s[f] || {}).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 5); return e.length ? `<div class="tbH">${lab} 큰 순서 5곳</div>` + e.map(([t, v], i) => row(go(t), `${i + 1}. ${t}`, lab, money(v), 'up')).join('') : ''; };
      h = dailyStatus === 'loading' ? '<div class="tbH" role="status">순위 자료를 불러오는 중입니다…</div>'
        : dailyStatus === 'error' ? '<div class="tbH" role="alert">순위 자료를 불러오지 못했습니다.</div>'
        : blk('federal-awards.json', '정부 계약 금액') + blk('lobbying.json', '로비 신고 금액') + blk('pac-contributions.json', '후보 후원금(PAC)');
      if (!h) h = '<div class="tbH">표시할 순위 자료가 없습니다.</div>';
    } else if (id === 'find') {
      h = `<form class="tbFind" id="tbFind"><input id="tbQ" placeholder="종목 기호 (예: NVDA)" autocomplete="off" aria-label="종목 기호"><button>보기</button></form><div class="tbH">많이 찾는 종목</div>` + ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN'].map((t) => row(go(t), t, '이 종목 기록 지도', '', '')).join('');
    }
    if (ticket !== showSeq) return; // ignore a previous tab's late response
    P.innerHTML = h;
    const retry = P.querySelector('#tbRetry'); if (retry) retry.onclick = () => show(id);
    const f = P.querySelector('#tbFind'); if (f) f.onsubmit = (e) => { e.preventDefault(); const q = P.querySelector('#tbQ').value.trim().toUpperCase(); if (q) location.search = go(q); };
  }
  function place() {
    const side = $('mtSide');
    if (wide()) { if (!side) return setTimeout(place, 300); if (root.parentNode !== side) side.prepend(root); }
    else if (root.parentNode !== document.body) document.body.append(root);
  }
  addEventListener('resize', place);
  J('../data/us/daily/index.json').then((ix) => {
    if (!ix || typeof ix.latest !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ix.latest)) throw new Error('Invalid daily index');
    return J(`../data/us/daily/${ix.latest}.json`);
  }).then((d) => {
    if (!d || !d.snap || typeof d.snap !== 'object' || Array.isArray(d.snap)) throw new Error('Invalid daily summary');
    D = d; dailyStatus = 'ready'; const c = d && d.cards && d.cards.find((x) => x.id === 'ptr');
    if (c && c.n && c.n[0]) { root.querySelector('#tbHeroN').textContent = c.n[0].v; root.querySelector('#tbHeroL').textContent = c.h.split(' 하원')[0] + ' 의원 주식 신고'; }
    if (activeTab === 'rank') show('rank');
  }).catch(() => {
    dailyStatus = 'error';
    root.querySelector('#tbHeroL').textContent = '일일 요약 자료를 불러오지 못했습니다';
    if (activeTab === 'rank') show('rank');
  });
  const boot = () => { place(); show(tk ? 'mem' : 'today'); setTimeout(() => { if (!tk && activeTab === 'today' && $('mtToday') && !root.contains($('mtToday'))) show('today'); }, 2500); };
  if (document.readyState === 'complete') setTimeout(boot, 400); else addEventListener('load', () => setTimeout(boot, 400));
})();
