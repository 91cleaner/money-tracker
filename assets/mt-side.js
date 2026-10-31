/* Desktop: one fixed side column (current stop on top, then all buttons); map fills the rest.
   All sizes: #mtNow mirrors the open map card so '다음' always updates the side text.
   Source links: SEC JSON API links open the readable EDGAR company page instead. */
(() => {
  const $ = (id) => document.getElementById(id);
  const EN = !!(window.MTI18N && window.MTI18N.isEn);
  const fixHref = (a) => {
    const h = a.getAttribute('href') || '';
    const m = h.match(/^https?:\/\/data\.sec\.gov\/submissions\/CIK0*(\d+)\.json/i);
    if (m) a.setAttribute('href', 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + m[1]);
    else if (/^http:\/\/likms\.assembly\.go\.kr\//.test(h)) a.setAttribute('href', h.replace(/^http:/, 'https:'));
    if (/^https?:/.test(a.getAttribute('href') || '')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  };
  const fixAll = (root) => root && root.querySelectorAll('a[href]').forEach(fixHref);
  // Make sure a tap on a link inside a map card is never eaten by map/drag handlers.
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('.leaflet-popup a[href], #mtNow a[href]'); if (a) { fixHref(a); e.stopPropagation(); } }, true);

  const css = document.createElement('style');
  css.textContent = `
#mtBar button.mtPrime{background:#5dff9e!important;color:#02110a!important;border-color:#5dff9e!important;font-weight:800!important;opacity:1!important;padding-left:16px!important;padding-right:16px!important;border-radius:999px!important}
#mtNow{margin:0 0 10px;padding:10px 12px;border:1px solid #2f7a4c;border-left:3px solid #5dff9e;border-radius:10px;background:#04140b;color:#e8fff0;font-size:14px;line-height:1.5}
#mtNow .k{font-size:11px;letter-spacing:.08em;color:#7ee9a6}#mtNow .h{font-weight:800;font-size:15px;margin:2px 0}
#mtNow a{color:#7dffb0;font-weight:700;display:inline-block;padding:6px 0;min-height:32px}
#mtNow img{max-width:46%;height:auto;border-radius:6px}#mtNow figure{margin:0}
#mtNow .mtNum{display:inline-block}
@media(min-width:900px){
 #mtSide{position:fixed;right:0;top:var(--mtSideTop,106px);bottom:0;width:400px;z-index:1450;display:flex;flex-direction:column;gap:8px;padding:10px;background:#020a06;border-left:1px solid #2bff8855;overflow:hidden}
 #mapFrame{right:400px!important;width:auto!important}
 #mtTicker{right:400px!important;width:auto!important}
 #mtSide>#brief{position:static!important;inset:auto!important;width:auto!important;max-height:none!important;flex:1 1 auto;min-height:0;overflow:auto!important;margin:0!important;transform:none!important}
 #mtSide>#mtBar,#mtSide>#controls,#mtSide>#mtOneDock{position:static!important;inset:auto!important;transform:none!important;translate:none!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:auto!important;max-width:none!important;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-start;margin:0!important}
 #mtSide>#mtOneDock{display:flex!important}
}`;
  document.head.append(css);

  const mq = matchMedia('(min-width:900px)');
  let side = null, ph = {};
  const IDS = ['brief', 'mtBar', 'controls', 'mtOneDock'];
  const map = () => window.moneyTrackerMap;
  const resize = () => { const m = map(); if (m) { m.invalidateSize({ pan: false }); const h = m.getSize().y; m.setMinZoom(Math.max(1, Math.ceil(Math.log2(Math.max(h, 256) / 256)))); } };
  function layout() {
    if (mq.matches) {
      if (!side) { side = document.createElement('aside'); side.id = 'mtSide'; side.setAttribute('aria-label', EN ? 'Info and buttons' : '설명과 버튼'); document.body.append(side); }
      const mf = $('mapFrame'); if (mf) side.style.setProperty('--mtSideTop', Math.round(mf.getBoundingClientRect().top) + 'px');
      IDS.forEach((id) => { const e = $(id); if (e && e.parentNode !== side) { if (!ph[id]) { ph[id] = document.createComment(id); e.before(ph[id]); } side.append(e); } });
    } else if (side) {
      IDS.forEach((id) => { const e = $(id); if (e && ph[id] && e.parentNode === side) ph[id].after(e); });
    }
    setTimeout(resize, 50);
    const bar = $('mtBar'); if (bar) [...bar.querySelectorAll('button')].forEach((b) => b.classList.toggle('mtPrime', /^(다음|Next)/.test(b.textContent.trim())));
  }
  function now() {
    const br = $('brief'); if (!br) return;
    const pops = [...document.querySelectorAll('.leaflet-popup')].filter((p) => p.querySelector('.leaflet-popup-content') && p.querySelector('.leaflet-popup-content').textContent.trim());
    const pop = pops.filter((p) => p.classList.contains('mtMF') || !p.classList.contains('mtTour')).pop();
    let box = $('mtNow');
    if (!pop) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.id = 'mtNow'; box.setAttribute('aria-live', 'polite'); }
    if (br.firstChild !== box) br.prepend(box);
    const src = pop.querySelector('.leaflet-popup-content');
    const c = src.cloneNode(true); c.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id')); c.querySelectorAll('button, .leaflet-popup-close-button').forEach((e) => e.remove());
    fixAll(c); box.replaceChildren(...c.childNodes);
    if (window.__tdWho) { const h = window.__tdWho(box.textContent); if (h) box.insertAdjacentHTML('beforeend', h); }
  }
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => { fixAll(document); now(); }, 300); };
  const boot = () => {
    const m = map(); if (!m) return setTimeout(boot, 300);
    m.on('popupopen popupclose', later);
    new MutationObserver(later).observe(document.querySelector('.leaflet-popup-pane') || document.body, { childList: true, subtree: true, characterData: true });
    const bt = $('briefTitle'); if (bt) new MutationObserver(later).observe(bt, { childList: true, characterData: true, subtree: true });
    layout(); later(); setTimeout(layout, 3000);
  };
  mq.addEventListener('change', layout); addEventListener('resize', () => setTimeout(resize, 100));
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot);
})();
/* Daily fact cards ("오늘의 기록") from data/us/daily, built every day by build-us-daily.yml. */
(() => {
  const $ = (id) => document.getElementById(id);
  const EN = !!(window.MTI18N && window.MTI18N.isEn); if (EN) return; // cards are written in Korean only
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sym = () => (new URLSearchParams(location.search).get('ticker') || '').toUpperCase();
  const css = document.createElement('style');
  css.textContent = `
#mtToday{font-family:Pretendard,-apple-system,"Segoe UI",sans-serif;color:#f2fff6}
:is(#mtToday,#mtTodayWho) .tdHd{display:flex;justify-content:space-between;align-items:baseline;margin:2px 2px 10px}
:is(#mtToday,#mtTodayWho) .tdHd b{font-size:20px;letter-spacing:-.03em}:is(#mtToday,#mtTodayWho) .tdHd span{font-size:12px;color:#8fb59d}
:is(#mtToday,#mtTodayWho) .tdGo{display:block;width:100%;margin:0 0 12px;padding:14px;border:0;border-radius:999px;background:#5dff9e;color:#02110a;font:800 16px Pretendard,system-ui,sans-serif;cursor:pointer;text-align:center;text-decoration:none}
:is(#mtToday,#mtTodayWho) .tdGo:hover{filter:brightness(1.08)}
:is(#mtToday,#mtTodayWho) .tdCd{padding:12px 14px;margin:0 0 10px;border-radius:16px;background:#0b1510;border:1px solid #1e3a2a}
:is(#mtToday,#mtTodayWho) .tdCd .tdK{font-size:12px;font-weight:700;color:#5dff9e}:is(#mtToday,#mtTodayWho) .tdCd .tdT{font-size:15px;font-weight:800;margin:3px 0 8px;line-height:1.4}
:is(#mtToday,#mtTodayWho) .tdN{display:flex;gap:16px;margin:0 0 8px}:is(#mtToday,#mtTodayWho) .tdN div{display:flex;flex-direction:column}:is(#mtToday,#mtTodayWho) .tdN small{font-size:11px;color:#8fb59d}:is(#mtToday,#mtTodayWho) .tdN b{font-size:22px;letter-spacing:-.03em}
:is(#mtToday,#mtTodayWho) .tdI{white-space:normal!important;overflow-wrap:anywhere;font-size:13.5px;line-height:1.55;color:#d8ecdf;padding:6px 0;border-top:1px solid #16291e}
:is(#mtToday,#mtTodayWho) .tdI a{color:#7dffb0;font-weight:700;margin-left:4px;white-space:nowrap}
:is(#mtToday,#mtTodayWho) .tdI button{margin-left:4px;padding:2px 8px;border-radius:999px;border:1px solid #2f7a4c;background:#0f2418;color:#bfffd6;font:700 12px Pretendard,system-ui,sans-serif;cursor:pointer}
#mtToday details summary{cursor:pointer;color:#9fd8b4;font-size:13px;padding:6px 0}
#mtToday.home{display:block!important;height:auto!important;min-height:0!important;max-height:52dvh!important;overflow:auto!important;position:fixed!important;left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;width:auto!important;transform:none!important;z-index:1500;max-height:52dvh;overflow:auto;padding:12px;border-radius:20px;background:#050c08f2;border:1px solid #1e3a2a;box-shadow:0 -8px 30px #000a}
@media(min-width:900px){#mtToday.home{position:static!important;flex:1 1 auto;max-height:none!important;max-height:none;box-shadow:none;border:0;background:none;padding:0}
 #mtSide{background:#000!important}
 #mtSide>#controls button,#mtSide>#mtOneDock *,#mtSide>#mtBar button{opacity:.78}
}
#mtToday.tk .tdHd b{font-size:16px}#mtToday.tk,#mtTodayWho{position:static!important;inset:auto!important;transform:none!important;max-height:none!important;height:auto!important;overflow:visible!important;width:auto!important;margin:10px 0!important;z-index:auto!important}
#briefCaveat,#mtSrcLine{display:none!important}`;
  document.head.append(css);
  let data = null;
  const card = (c, items) => {
    const vis = items.slice(0, 2), more = items.slice(2);
    const row = (i) => `<div class="tdI">${esc(i.t)}${i.u ? `<a href="${esc(i.u)}" target="_blank" rel="noopener noreferrer">원문 ›</a>` : ''}${i.tk && !sym() && !/,/.test(i.tk) ? `<button type="button" data-tk="${esc(i.tk)}">${esc(i.tk)} 보기</button>` : ''}</div>`;
    return `<div class="tdCd"><div class="tdK">${esc(c.k)}</div><div class="tdT">${esc(c.h)}</div>` +
      (c.n && c.n.length ? `<div class="tdN">${c.n.map((n) => `<div><small>${esc(n.l)}</small><b>${esc(n.v)}</b></div>`).join('')}</div>` : '') +
      vis.map(row).join('') + (more.length ? `<details><summary>자세히 보기 (${more.length})</summary>${more.map(row).join('')}</details>` : '') + '</div>';
  };
  function render() {
    if (!data) return; window.__tdN=(window.__tdN||0)+1;
    const s = sym();
    let box = $('mtToday'); if (!box) { box = document.createElement('section'); box.id = 'mtToday'; box.setAttribute('aria-label', '오늘의 기록'); }
    if (!s) {
      const side = $('mtSide'); box.className = 'home';
      if (side && getComputedStyle(side).display !== 'none' && matchMedia('(min-width:900px)').matches) { if (box.parentNode !== side) side.prepend(box); } else if (box.parentNode !== document.body) document.body.append(box);
      const first = data.cards.flatMap((c) => c.items).find((i) => i.tk && !/,/.test(i.tk));
      box.innerHTML = `<div class="tdHd"><b>오늘의 기록</b><span>${esc(data.date)}</span></div>` +
        (first ? `<a class="tdGo" href="?lang=ko&ticker=${encodeURIComponent(first.tk)}">${esc(first.tk)} 기록부터 보기</a>` : '') +
        data.cards.map((c) => card(c, c.items)).join('');
    } else {
      const hit = data.cards.map((c) => [c, c.items.filter((i) => (i.tk || '').split(',').includes(s))]).filter((x) => x[1].length);
      const br = $('brief'); if (!br) return;
      if (!hit.length) { box.remove(); return; }
      box.className = 'tk';
      const nowBox = $('mtNow'); if (!matchMedia('(min-width:900px)').matches) { if (br.lastChild !== box) br.append(box); } else if (nowBox) { if (nowBox.nextSibling !== box) nowBox.after(box); } else if (br.firstChild !== box) br.prepend(box);
      box.innerHTML = `<div class="tdHd"><b>오늘 이 종목 기록</b><span>${esc(data.date)}</span></div>` + hit.map(([c, it]) => card(c, it)).join('');
    }
  }
  window.__tdR=()=>render();window.__tdWho=(txt)=>{if(!data)return '';const hit=data.cards.map((c)=>[c,c.items.filter((i)=>{if(!i.who)return false;const w=i.who.replace(/[.,]/g,'').split(/\s+/);return txt.includes(w[0])&&txt.includes(w[w.length-1])})]).filter((x)=>x[1].length);return hit.length?`<div id="mtToday" class="tk" style="margin-top:8px"><div class="tdHd"><b>오늘 이 의원 기록</b><span>${esc(data.date)}</span></div>${hit.map(([c,it])=>card(c,it)).join('')}</div>`:''};document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('#mtToday button[data-tk]'); if (b) location.search = '?lang=ko&ticker=' + encodeURIComponent(b.dataset.tk); });
  fetch('../data/us/daily/index.json', { cache: 'no-cache' }).then((r) => r.json()).then((ix) => fetch(`../data/us/daily/${ix.latest}.json`, { cache: 'no-cache' })).then((r) => r.json()).then((d) => { data = d; render(); setInterval(() => { const b = $('mtToday'); if (sym() && (!b || !b.isConnected || (!matchMedia('(min-width:900px)').matches && b.parentNode && b.parentNode.lastChild !== b))) render(); }, 1500); setTimeout(render, 2500); }).catch(() => {});
})();
