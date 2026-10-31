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
  }
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => { fixAll(document); now(); }, 300); };
  const boot = () => {
    const m = map(); if (!m) return setTimeout(boot, 300);
    m.on('popupopen popupclose', later);
    new MutationObserver(later).observe(document.querySelector('.leaflet-popup-pane') || document.body, { childList: true, subtree: true, characterData: true });
    const bt = $('briefTitle'); if (bt) new MutationObserver(later).observe(bt, { childList: true, characterData: true, subtree: true });
    layout(); later();
  };
  mq.addEventListener('change', layout); addEventListener('resize', () => setTimeout(resize, 100));
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot);
})();
