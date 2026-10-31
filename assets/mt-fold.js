/* 관제실 종목 칸·팝업 글 줄이기: 긴 설명은 '자세히 보기' 안에 접어 둬요(처음엔 닫힘). 숫자·자료는 바꾸지 않아요.
   아래 조작 막대(이전/재생/다음)가 팝업을 가리면 지도를 옮기고, 그래도 가리면 막대를 잠시 숨겨요. */
(() => {
  const en = () => !!(window.MTI18N && window.MTI18N.isEn);
  const $ = (i) => document.getElementById(i);
  window.mtBillKo = (no) => { const n = String(no || '').toUpperCase().replace(/\s+/g, ' ');
    return /^(S|S\.?\s?RES|S\.?\s?J\.?\s?RES|S\.?\s?CON\.?\s?RES)\b/.test(n) ? '미국 상원 법안' : /^H/.test(n) ? '미국 하원 법안' : '미국 법안'; };
  const st = document.createElement('style');
  st.textContent = 'details.mtMore{margin:4px 0}details.mtMore>summary{cursor:pointer;color:#5dff9e;font-size:12px;min-height:32px;display:flex;align-items:center;list-style:none}details.mtMore>summary::-webkit-details-marker{display:none}details.mtMore>summary::before{content:"▸ ";white-space:pre}details.mtMore[open]>summary::before{content:"▾ "}';
  document.head.append(st);
  const sum = () => en() ? 'More' : '자세히 보기';
  const wrap = (nodes, at) => { if (!nodes.length) return; const d = document.createElement('details'); d.className = 'mtMore'; const s = document.createElement('summary'); s.textContent = sum(); d.append(s); at.before(d); nodes.forEach((n) => d.append(n)); };
  function foldTL() { const tl = $('mtTL'); if (!tl || !tl.childNodes.length) return; if (tl.firstElementChild && tl.firstElementChild.matches('details.mtMore') && tl.childNodes.length === 1) return;
    const kids = [...tl.childNodes].filter((n) => !(n.nodeType === 1 && n.matches('details.mtMore'))); const hold = document.createElement('div'); tl.prepend(hold);
    const d = document.createElement('details'); d.className = 'mtMore'; const s = document.createElement('summary'); s.textContent = en() ? 'Timeline' : '타임라인 자세히 보기'; d.append(s); const body = document.createElement('div'); kids.forEach((n) => body.append(n)); d.append(body); hold.replaceWith(d); }
  function foldPopup(root) { if (!root) return;
    const long = [...root.querySelectorAll('.s, small')].filter((e) => !e.closest('details, figure, .mtSave') && !e.querySelector('a, b, details') && !(e.parentNode && e.parentNode.closest('.s, small')) && e.textContent.trim().length > 50);
    if (long.length) { const end = document.createElement('span'); root.append(end); wrap(long, end); end.remove(); } }
  function foldBrief() { const c = $('briefCaveat'); if (c && c.textContent.trim().length > 50 && !(c.parentNode && c.parentNode.matches('details.mtMore'))) wrap([c], c); }
  let q = 0; const run = () => { q = 0; foldTL(); foldBrief(); document.querySelectorAll('.leaflet-popup-content').forEach(foldPopup); };
  new MutationObserver(() => { if (!q) { q = 1; requestAnimationFrame(run); } }).observe(document.body, { childList: true, subtree: true });
  // 조작 막대가 팝업을 가리지 않게
  const bar = () => $('mtBar');
  const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  function unblock(pop) { const b = bar(), map = window.moneyTrackerMap; if (!b || b.hidden || !pop || !map) return;
    const el = pop.getElement && pop.getElement(); if (!el) return; const r = el.getBoundingClientRect(), br = b.getBoundingClientRect(); if (!hit(r, br)) return;
    const room = br.top - 8 - r.height, top = r.top; if (room > 60) { map.panBy([0, r.bottom - br.top + 12], { animate: false }); setTimeout(() => { const r2 = el.getBoundingClientRect(); if (hit(r2, b.getBoundingClientRect())) b.style.visibility = 'hidden'; }, 60); } else b.style.visibility = 'hidden'; }
  const hook = () => { const map = window.moneyTrackerMap; if (!map) return setTimeout(hook, 300);
    map.on('popupopen', (e) => [80, 400, 1000].forEach((t) => setTimeout(() => unblock(e.popup), t)));
    map.on('popupclose', () => { const b = bar(); if (b) b.style.visibility = ''; }); };
  hook();

  // 첫 화면은 '이름 · 탭 · 큰 숫자 · 최근 신고 의원 3명'만. 나머지는 '자세히 보기' 하나에 모아요(숫자는 그대로 옮기기만 해요).
  const st2 = document.createElement('style');
  st2.textContent = '#mtBig{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}#mtBig .b{flex:1 1 90px;min-width:0;background:#06180d;border:1px solid #24563a;border-radius:8px;padding:6px 8px}#mtBig .b small{display:block;font-size:11px;color:#8fc9a5}#mtBig .b b{display:block;font-size:20px;line-height:1.2;color:#e8fff0}#mtBig .b b.dn{color:#ff7a7a}#mtBig .b b.up{color:#5dff9e}' +
    '#mtHub{display:flex;flex-wrap:wrap;gap:6px}#mtHub button{margin:0!important}' +
    '#mtPlus button.row.mtS{display:flex!important;flex-wrap:wrap;align-items:center;gap:6px;width:100%;min-height:44px;box-sizing:border-box}#mtPlus button.row.mtS>span{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 auto}#mtPlus button.row.mtS>small{display:flex;flex-wrap:wrap;align-items:center;gap:6px;flex:0 0 auto}' +
    '#mtPlus button.row.mtS .mtTag,#mtPlus button.row.mtS .mtSave,#mtPlus button.row.mtS br{display:none!important}.mtCnt{font-size:11px;border:1px solid #6b5a20;color:#ffd166;border-radius:999px;padding:1px 7px;white-space:nowrap}' +
    'details#mtSFold{margin:10px 0;border-top:1px solid #1d4430;padding-top:4px}details#mtSFold>summary{min-height:44px;font-size:14px}' +
    '.mtNum{display:flex;gap:6px;margin:6px 0}.mtNum span{flex:1;background:#06180d;border:1px solid #24563a;border-radius:8px;padding:4px 8px;font-size:11px;color:#8fc9a5}.mtNum b{display:block;font-size:18px;color:#e8fff0}';
  document.head.append(st2);
  const FOLD_IDS = ['mtTL', 'briefText', 'mtKey', 'mtTrades', 'mtPrice', 'mtRecent', 'mtKrPol', 'mtWH', 'mtCPol', 'mtFirst', 'briefLinks', 'moodCard', 'briefStocks', 'briefCaveat'];
  function pctOf(t, re) { const m = t.match(re); return m ? m[1] : null; }
  function big() { const br = $('brief'), hub = $('mtHub'); if (!br || br.hidden || !hub) return;
    const kt = ($('mtKey') || {}).textContent || '', bt = ($('briefText') || {}).textContent || '', E = en();
    const items = [], m1 = pctOf(kt, /1개월 ([+-]?[\d.]+%)/) || pctOf(kt, /1 ?month ([+-]?[\d.]+%)/i), ytd = pctOf(kt, /연초 대비 ([+-]?[\d.]+%)/) || pctOf(kt, /YTD ([+-]?[\d.]+%)/i), mem = pctOf(bt, /하원의원 (\d+)명/) || pctOf(bt, /(\d+) House members?/);
    if (m1) items.push([E ? '1 month' : '1개월 주가', m1]); if (ytd) items.push([E ? 'Since Jan 1' : '올해 들어', ytd]); if (mem) items.push([E ? 'Members filed (12 mo)' : '신고한 의원(1년)', mem + (E ? '' : '명')]);
    const html = items.map(([k, v]) => `<div class="b"><small>${k}</small><b class="${/^-/.test(v) ? 'dn' : /%$/.test(v) ? 'up' : ''}">${v}</b></div>`).join('');
    let b = $('mtBig'); if (!items.length) { if (b) b.remove(); return; } if (!b) { b = document.createElement('div'); b.id = 'mtBig'; } if (b.innerHTML !== html) b.innerHTML = html; if (b.previousElementSibling !== hub) hub.after(b); }
  function fold() { const br = $('brief'); if (!br || br.hidden || !$('mtHub')) return; const E = en();
    let d = $('mtSFold'); if (!d) { d = document.createElement('details'); d.id = 'mtSFold'; d.className = 'mtMore'; const s = document.createElement('summary'); d.append(s); }
    d.firstChild.textContent = E ? 'More details' : '자세히 보기'; const sh = $('mtShareP'); if (d.parentNode !== br) { if (sh && sh.parentNode === br) sh.before(d); else br.append(d); }
    FOLD_IDS.forEach((i) => { const e = $(i); if (e && e.parentNode !== d && br.contains(e)) d.append(e); });
    br.querySelectorAll(':scope > details.mtMore:not(#mtSFold)').forEach((x) => d.append(x));
    const pl = $('mtPlus'); if (pl) { const kids = [...pl.children]; const first = kids.find((k) => k.querySelector && k.querySelector('button.row')); 
      let inner = pl.querySelector(':scope > details.mtPF'); if (!inner) { inner = document.createElement('details'); inner.className = 'mtMore mtPF'; const s = document.createElement('summary'); s.textContent = E ? 'Playback, rankings and more' : '재생 · 순위 · 더 보기'; inner.append(s); pl.append(inner); }
      kids.forEach((k) => { if (k !== first && k !== inner) inner.append(k); });
      if (first) { const rows = [...first.querySelectorAll('button.row')]; rows.forEach((r, i) => { if (i > 2) { inner.prepend(r); } if (r.classList.contains('mtS')) return; r.classList.add('mtS'); const sm = r.querySelector('small');
        if (sm) { const tags = sm.querySelectorAll('.mtTag'), late = sm.querySelector('.mtLate'); r.title = sm.textContent.replace(/\s+/g, ' ').trim(); [...sm.childNodes].forEach((n) => { if (n.nodeType === 3) n.remove(); }); if (tags.length) { const c = document.createElement('span'); c.className = 'mtCnt'; c.textContent = (E ? 'flags ' : '표시 ') + tags.length; sm.prepend(c); } if (late) sm.prepend(late); } }); } } }
  function memberSum(root) { root.querySelectorAll('.r').forEach((r) => { if (r.dataset.mtN || !/낸 법안|Bills/.test(r.textContent) || r.querySelectorAll('b').length !== 2) return; const [a, b] = r.querySelectorAll('b'), E = en();
    const n = document.createElement('div'); n.className = 'mtNum'; n.dataset.mtN = 1; n.innerHTML = `<span>${E ? 'Bills' : '낸 법안'}<b>${a.textContent}${E ? '' : '건'}</b></span><span>${E ? 'Trades we follow' : '우리 종목 거래'}<b>${b.textContent}${E ? '' : '건'}</b></span>`; r.replaceWith(n); });
    if (!en()) root.querySelectorAll('small').forEach((s) => { if (s.dataset.mtO || !/^원래 제목:/.test(s.textContent)) return; s.dataset.mtO = 1; const d = document.createElement('details'); d.className = 'mtMore'; const su = document.createElement('summary'); su.textContent = '원래 제목'; d.append(su); const prev = s.previousSibling; if (prev && prev.nodeName === 'BR') prev.remove(); s.replaceWith(d); s.textContent = s.textContent.replace(/^원래 제목:\s*/, ''); s.lang = 'en'; d.append(s); }); }
  function barAway() { const b = $('mtBar'), br = $('brief'); if (!b || b.hidden || !br || br.hidden) return; const r = b.getBoundingClientRect(), q = br.getBoundingClientRect(); if (!hit(r, q)) return;
    if (innerWidth <= 900) { const nb = innerHeight - q.top + 8; b.style.bottom = nb + 'px'; } else b.style.visibility = 'hidden'; }
  let q2 = 0; const run2 = () => { q2 = 0; try { big(); fold(); document.querySelectorAll('.leaflet-popup-content').forEach(memberSum); barAway(); } catch (e) { console.warn(e); } };
  new MutationObserver(() => { if (!q2) { q2 = 1; requestAnimationFrame(run2); } }).observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', run2); setInterval(barAway, 700);
})();
