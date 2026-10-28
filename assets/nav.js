/* 폰은 아래 탭만: 우리 동네 세금 · 정부 지출 · 국민연금 주식 · 뉴스 · 더보기.
   넓은 화면은 위 탭만. 게임·퀴즈는 메뉴에 넣지 않는다.
   도시 페이지의 우리 동네 세금은 그 도시 지도로 남긴다. */
(() => {
  const pg = document.body.dataset.page || '';
  const q = new URLSearchParams(location.search);
  const addQ = (href) => {
    const keep = ['c', 'd', 'from', 'to', 'gu'].filter((k) => q.has(k));
    if (!keep.length) return href;
    const i = href.indexOf('#');
    const hash = i >= 0 ? href.slice(i) : '';
    const base = i >= 0 ? href.slice(0, i) : href;
    if (base.includes('?')) return href;
    const sp = new URLSearchParams();
    for (const k of keep) sp.set(k, q.get(k));
    return base + '?' + sp.toString() + hash;
  };
  const fixedMap = (pg === 'city' && q.get('c')) ? ('city.html' + location.search + '#map') : addQ('./#map');
  const tabs = [
    ['map', fixedMap, '우리 동네 세금'],
    ['nat', addQ('national.html'), '정부 지출'],
    ['nps', addQ('nps.html'), '국민연금 주식'],
    ['news', addQ('news.html'), '뉴스'],
  ];
  const act = (k) => {
    if (k === 'map') return pg === 'home' || pg === 'index' || pg === 'city';
    if (k === 'news') return pg === 'news' || pg === 'article';
    if (k === 'nat') return pg === 'national';
    if (k === 'us') return pg === 'us';
    if (k === 'nps') return pg === 'nps';
    if (k === 'more') return ['rank', 'spend', 'vendor', 'principles', 'bid', 'search'].includes(pg);
    return false;
  };
  const moreLinks = [
    ['search.html', '🔍 통합 검색 (업체·계약·의원·법안·종목)'],
    ['rank.html', '순위'],
    ['spend.html', '추적'],
    ['bid.html', '우리 동네 입찰'],
    ['principles.html', '중립성 원칙'],
  ];
  const barHtml = () => tabs.map(([k, href, label]) => `<a href="${href}" data-k="${k}" class="${act(k) ? 'on' : ''}"${act(k) ? ' aria-current="page"' : ''}><span class="tl">${label}</span><span class="ndot" hidden></span></a>`).join('')
    + `<button type="button" data-k="more" class="${act('more') ? 'on' : ''}" aria-expanded="false" aria-controls="more-sheet">더보기</button>`;
  const top = document.createElement('nav');
  top.className = 'tabbar tabbar-top';
  top.setAttribute('aria-label', '위 메뉴');
  top.innerHTML = barHtml();
  const bot = document.createElement('nav');
  bot.className = 'tabbar tabbar-bot';
  bot.setAttribute('aria-label', '아래 메뉴');
  bot.innerHTML = barHtml();
  document.body.prepend(top);
  document.body.append(bot);
  document.body.classList.add('has-tabbar');

  const sheet = document.createElement('div');
  sheet.className = 'more-sheet';
  sheet.id = 'more-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `<button type="button" class="more-bg" aria-label="닫기"></button>
    <div class="more-box" role="dialog" aria-label="더보기">
      <div class="more-top"><b>더보기</b><button type="button" class="more-x">닫기</button></div>
      <div class="more-links">${moreLinks.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</div>
    </div>`;
  document.body.append(sheet);
  const setOpen = (on) => {
    sheet.hidden = !on;
    document.querySelectorAll('[data-k="more"]').forEach((b) => b.setAttribute('aria-expanded', on ? 'true' : 'false'));
    if (on) { const x = sheet.querySelector('.more-x'); if (x) x.focus(); }
  };
  sheet.querySelector('.more-bg').addEventListener('click', () => setOpen(false));
  sheet.querySelector('.more-x').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  const sync = () => {
    document.querySelectorAll('.tabbar a, .tabbar button').forEach((el) => {
      const on = act(el.dataset.k);
      el.classList.toggle('on', on);
      if (el.tagName === 'A') {
        if (on) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
      }
    });
  };
  window.__tabSync = sync;
  addEventListener('hashchange', sync);
  addEventListener('popstate', sync);

  document.addEventListener('click', (e) => {
    const more = e.target.closest('[data-k="more"]');
    if (more) { e.preventDefault(); setOpen(sheet.hidden); return; }
    const a = e.target.closest('.tabbar a');
    if (!a) return;
    const hash = (a.getAttribute('href') || '').includes('#') ? a.getAttribute('href').slice(a.getAttribute('href').indexOf('#')) : '';
    if ((pg === 'home' || pg === 'index') && hash && a.dataset.k === 'map') {
      e.preventDefault();
      const u = location.pathname + location.search + hash;
      if (location.pathname + location.search + location.hash !== u) location.assign(u);
      else sync();
    }
  });

  const paintDot = (on) => {
    document.querySelectorAll('.tabbar a[data-k="news"] .ndot').forEach((d) => { d.hidden = !on; });
    document.querySelectorAll('.tabbar a[data-k="news"]').forEach((a) => a.classList.toggle('has-new', on));
  };
  fetch('data/news.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).then((data) => {
    const list = Array.isArray(data) ? data : [];
    let newest = '';
    for (const a of list) {
      if (!a || a.factchecked !== true) continue;
      const d = String(a.date || a['날짜'] || '');
      if (d > newest) newest = d;
    }
    let seen = '';
    try { seen = localStorage.getItem('mt-news-seen') || ''; } catch (e) {}
    const here = pg === 'news' || pg === 'article';
    if (here && newest) { try { localStorage.setItem('mt-news-seen', newest); } catch (e) {} }
    paintDot(!here && !!(newest && newest > seen));
  }).catch(() => {});

  const css = document.createElement('style');
  css.textContent = `.tabbar{position:fixed;left:0;right:0;z-index:1100;display:flex;background:#07090cf2;backdrop-filter:blur(16px);padding:4px 4px calc(4px + env(safe-area-inset-bottom));border-top:1px solid #24303a}
.tabbar-top{top:0;bottom:auto;border-top:0;border-bottom:1px solid #24303a;padding:4px 4px}
.tabbar-bot{bottom:0}
.tabbar a,.tabbar button{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;position:relative;min-height:44px;padding:4px 0;border:0;background:none;color:#9aa6b2;font:700 12px/1.15 var(--sans,Pretendard,system-ui,sans-serif);text-decoration:none;white-space:nowrap;letter-spacing:-.06em;cursor:pointer;overflow:hidden}
.tabbar .tl{display:block;max-width:100%;margin:0;padding:0;border:0;list-style:none;white-space:nowrap;overflow:hidden;text-overflow:clip}
.tabbar a.on,.tabbar button.on{color:#ffb020}
.tabbar-bot a.on::before,.tabbar-bot button.on::before{content:"";position:absolute;top:0;left:18%;right:18%;height:2px;background:#ffb020;border-radius:2px}
.tabbar-top a.on::after,.tabbar-top button.on::after{content:"";position:absolute;bottom:0;left:18%;right:18%;height:2px;background:#ffb020;border-radius:2px}
.ndot{display:none;width:8px;height:8px;border-radius:50%;background:#ff3b30;position:absolute;top:8px;right:10%}
.has-new .ndot{display:block}
body.has-tabbar{padding-top:56px;padding-bottom:calc(72px + env(safe-area-inset-bottom))}
@media (max-width:767px){
  .tabbar-top{display:none !important}
  body.has-tabbar{padding-top:0 !important}
  .tabbar a,.tabbar button{font-size:11px;letter-spacing:-.08em;padding:4px 1px}
}
@media (min-width:768px){
  .tabbar-bot{display:none !important}
  body.has-tabbar{padding-bottom:28px !important}
}
.nbar,.stickybar{position:relative !important;top:auto !important;margin:0 !important;z-index:20;background:#0d1117}
.nbar a,.stickybar .brand,.stickybar .back{flex:0 0 auto;white-space:nowrap}
.more-sheet{position:fixed;inset:0;z-index:1200}
.more-bg{position:absolute;inset:0;border:0;background:#000a}
.more-box{position:absolute;left:0;right:0;bottom:0;background:#10161c;border-top:1px solid #ffb020;border-radius:18px 18px 0 0;padding:12px 14px calc(16px + env(safe-area-inset-bottom))}
.more-top{display:flex;justify-content:space-between;align-items:center}
.more-top b{font-size:18px}
.more-x{min-height:44px;min-width:44px;border:0;background:none;color:#ffb020;font:700 15px var(--sans,system-ui)}
.more-links{display:grid;gap:8px;margin-top:8px}
.more-links a{display:flex;align-items:center;min-height:48px;padding:0 12px;border-radius:12px;border:1px solid #2a3544;background:#0c1218;color:#e8eef5;text-decoration:none;font-weight:700;font-size:16px}
@media(min-width:900px){.tabbar{padding-left:calc(50% - 340px);padding-right:calc(50% - 340px)}.more-box{left:50%;width:420px;transform:translateX(-50%);bottom:24px;border:1px solid #ffb020;border-radius:18px}}
.nbar,.stickybar{top:auto !important}`;
  document.head.appendChild(css);
})();
