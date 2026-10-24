// 홈 지도 바로 아래 [지도 · 퀴즈 · 게임] 전환 + 게임 1: 우리 시 행사·축제 예산 써보기 (neal.fun/spend 패러디)
// 숫자는 data/sec_fest.json ratio(2026 당초예산 행사·축제경비)만 사용. 물건 가격은 출처 있는 것만, 없으면 '예시 가격'.
(() => {
  const dive = document.getElementById('dive'); if (!dive) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const krw = (n) => { const a = Math.abs(n || 0), s = n < 0 ? '-' : ''; if (a >= 1e12) { const j = Math.floor(a / 1e12), e = Math.round((a % 1e12) / 1e8); return s + j + '조' + (e ? ' ' + e.toLocaleString('ko-KR') + '억' : '') + '원'; }
    if (a >= 1e8) { const e = a / 1e8; return s + (e >= 100 ? Math.round(e).toLocaleString('ko-KR') : (Math.floor(e * 10) / 10).toLocaleString('ko-KR')) + '억원'; }
    if (a >= 1e4) return s + Math.floor(a / 1e4).toLocaleString('ko-KR') + '만원'; return s + Math.round(a).toLocaleString('ko-KR') + '원'; };
  const pr = (n) => { if (n >= 1e8) return krw(n); const m = Math.floor(n / 1e4), w = Math.round(n % 1e4); return (m ? m.toLocaleString('ko-KR') + '만' + (w ? ' ' : '') : '') + (w ? w.toLocaleString('ko-KR') : '') + '원'; };
  const NOTE = '2026년에 쓰겠다고 잡아둔 돈이에요(실제로 쓴 돈 아님)', SRC = '출처 행정안전부 지방재정365 · 2026년 처음 정한 예산(실제로 쓴 돈은 아님)';
  // ---- 모드 전환 바 ----
  const here = (hash) => location.pathname + location.search + (hash || '');
  const bar = document.createElement('nav'); bar.className = 'modebar'; bar.setAttribute('aria-label', '지도 · 퀴즈 · 게임');
  bar.innerHTML = `<a href="${here('')}" data-m="map">지도 보기</a><a href="${here('#quiz')}" data-m="quiz">퀴즈 풀기</a><a href="${here('#play')}" data-m="play">게임 하기</a>`;
  const mode = () => (['#quiz', '#daily', '#game'].includes(location.hash) ? 'quiz' : location.hash === '#play' ? 'play' : 'map');
  const place = () => { const lg = dive.querySelector('.maplg'); if (!lg) return false; if (bar.previousElementSibling !== lg) { lg.after(bar); bar.style.order = getComputedStyle(lg).order; } return true; };
  const t0 = setInterval(() => { if (place()) clearInterval(t0); }, 200); setTimeout(() => clearInterval(t0), 15000);
  new MutationObserver(() => { if (!bar.isConnected) place(); }).observe(dive, {childList: true, subtree: true});
  bar.addEventListener('click', (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); const m = a.dataset.m;
    history.pushState(null, '', here(m === 'map' ? '' : '#' + m)); apply(true); });
  const apply = (scroll) => { const m = mode(); document.body.dataset.mode = m; bar.querySelectorAll('a').forEach((a) => { a.classList.toggle('on', a.dataset.m === m); a.setAttribute('aria-current', a.dataset.m === m ? 'page' : 'false'); });
    if (m === 'play') build(); dispatchEvent(new Event('resize'));
    if (scroll) { const t = m === 'map' ? dive.querySelector('.dv-map') || dive : document.getElementById(m === 'quiz' ? 'daily' : 'fgame'); if (t) setTimeout(() => { const y = t.getBoundingClientRect().top + scrollY - 56; scrollTo({top: Math.max(0, y), behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'}); }, 160); }
    document.querySelectorAll('.tabbar a').forEach((a) => { const k = a.dataset.k; if (k === 'quiz' || k === 'play' || k === 'home' || k === 'map') a.classList.toggle('on', k === m || (k === 'home' && m === 'map' && location.hash !== '#map') || (k === 'map' && location.hash === '#map')); }); };
  addEventListener('hashchange', () => apply(true)); addEventListener('popstate', () => apply(false));
  // ---- 게임 섹션 ----
  const fg = document.createElement('section'); fg.className = 'sec gm fg'; fg.id = 'fgame'; fg.setAttribute('aria-label', '우리 시 행사·축제 예산 써보기');
  const g0 = document.getElementById('game'); (g0 || dive).after(fg);
  const ITEMS = [
    {k: 'fest', n: '보통 크기 축제 하나 비용', p: 0, src: '2024년 축제 622개의 보통 비용(지방재정365 자료를 우리 시 돈 추적기가 계산)'},
    {k: 'wage', n: '최저시급 한 달 월급', p: 2156880, src: '2026년 최저시급으로 하루 8시간, 한 달 일한 돈 · 고용노동부'},
    {k: 'hour', n: '알바 1시간', p: 10320, src: '2026년 최저임금 · 고용노동부'},
    {k: 'bus', n: '시내버스 한 번', p: 1500, src: '서울 시내버스(간선·지선) 카드 요금 · 서울시'},
    {k: 'mail', n: '편지 한 통 보내기', p: 500, src: '규격 보통우편(25g) · 우정사업본부, 2026.7.1~'},
    {k: 'ebus', n: '전기 시내버스 한 대', p: 3e8, ex: 1},
    {k: 'car', n: '경차 한 대', p: 1.5e7, ex: 1},
    {k: 'lap', n: '노트북 한 대', p: 1.5e6, ex: 1},
    {k: 'chk', n: '치킨 한 마리', p: 2e4, ex: 1},
    {k: 'tteok', n: '떡볶이 1인분', p: 5e3, ex: 1},
  ];
  let D = null, IX = null, built = false, C = null, cnt = {};
  const spent = () => ITEMS.reduce((t, it) => t + (cnt[it.k] || 0) * it.p, 0);
  const pickCity = (rows) => {
    const q = new URLSearchParams(location.search).get('c');
    const city = q && IX && (IX.cities || []).find((c) => c.slug === q);
    if (city) {
      const exact = rows.find((r) => r.cname === city.short || r.cname === city.name);
      if (exact) return exact;
      const last = String(city.short || city.name || '').split(/\s+/).pop();
      const byLast = rows.find((r) => r.cname === last || r.cname.split(' ').pop() === last);
      if (byLast) return byLast;
    }
    const nm = ((document.querySelector('.dv-name') || {}).textContent || (document.querySelector('.dv-org') || {}).textContent || '').trim();
    return rows.find((r) => q && nm && nm.startsWith(r.cname.split(' ').pop())) || rows.find((r) => r.cname === '경남 진주시') || rows[0];
  };
  const build = () => { if (built) return; built = true;
    fg.innerHTML = '<p class="fg-load">불러오는 중…</p>';
    Promise.all([
      fetch('data/sec_fest.json', {cache: 'no-cache'}).then((r) => r.json()),
      fetch('data/index.json', {cache: 'no-cache'}).then((r) => r.json()).catch(() => null),
    ]).then(([d, ix]) => { D = d; IX = ix; const fest = ITEMS.find((x) => x.k === 'fest'); if (fest) { fest.p = Math.round(d.med || 0); if (d.n_all) fest.src = `${d.cost_year || d.year || 2024}년 축제 ${Number(d.n_all).toLocaleString('ko-KR')}개의 보통 비용(지방재정365 자료를 우리 시 돈 추적기가 계산)`; if (!fest.p) ITEMS.shift(); } render(); }).catch(() => { fg.innerHTML = '<p class="fg-load">자료를 못 불러왔어요. 잠시 뒤 다시 해 봐요.</p>'; built = false; }); };
  const render = () => {
    const seenCity = new Set();
    const rows = (D.ratio || []).filter((r) => r.fest > 0).filter((r) => {
      const id = r.slug || r.id || r.gov || '';
      const name = r.cname || '';
      if ((id && seenCity.has('id:' + id)) || (name && seenCity.has('nm:' + name))) return false;
      if (id) seenCity.add('id:' + id);
      if (name) seenCity.add('nm:' + name);
      return true;
    }).sort((a, b) => a.cname.localeCompare(b.cname, 'ko'));
    C = pickCity(rows);
    fg.innerHTML = `<h2 class="fg-h">우리 시 행사·축제 예산 써보기</h2>
      <p class="fg-par">neal.fun의 'Spend Bill Gates' Money'를 따라 만든 <b>장난 게임</b>이에요. 진짜 돈을 쓰는 곳이 아니고, 행사·축제 예산이 얼마나 큰지 감을 잡아 보는 용도예요.</p>
      <label class="fg-sel">시 고르기 <select>${rows.map((r, i) => `<option value="${i}"${r === C ? ' selected' : ''}>${esc(r.cname)}</option>`).join('')}</select></label>
      <div class="fg-top" aria-live="polite"><p class="fg-k"></p><p class="fg-v"></p><p class="fg-bar"><i></i></p></div><p class="fg-note">${NOTE}<small>${SRC}</small></p>
      <ul class="fg-list">${ITEMS.map((it) => `<li data-k="${it.k}"><div class="fg-i"><b>${esc(it.n)}</b><span class="fg-p">${pr(it.p)}</span><small>${it.ex ? '예시 가격(공식 가격 아님)' : '출처: ' + esc(it.src)}</small></div>
        <div class="fg-ctl"><button type="button" class="fg-m" aria-label="${esc(it.n)} 빼기">-</button><span class="fg-n">0</span><button type="button" class="fg-pl" aria-label="${esc(it.n)} 더하기">+</button></div><div class="fg-more"><button type="button" class="fg-10">10개 더</button><button type="button" class="fg-all">남은 돈 다 쓰기</button></div></li>`).join('')}</ul>
      <div class="fg-end"><p class="fg-res"></p><div class="fg-btns"><button type="button" class="fg-show">결과 그림 만들기</button><button type="button" class="fg-reset">처음부터</button></div><canvas class="fg-cv" width="1200" height="630" hidden></canvas><p class="fg-sh" hidden><a class="fg-dl" download="festival-budget.png">그림 저장</a> <button type="button" class="fg-share">공유하기</button></p></div>`;
    const sel = fg.querySelector('select'); sel.onchange = () => { C = rows[+sel.value]; cnt = {}; upd(); };
    fg.querySelector('.fg-list').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const k = b.closest('li').dataset.k, it = ITEMS.find((x) => x.k === k);
      const room = Math.floor((C.fest - spent()) / it.p); if (b.classList.contains('fg-pl')) { if (room >= 1) cnt[k] = (cnt[k] || 0) + 1; } else if (b.classList.contains('fg-10')) { cnt[k] = (cnt[k] || 0) + Math.min(10, room); } else if (b.classList.contains('fg-all')) { cnt[k] = (cnt[k] || 0) + room; } else cnt[k] = Math.max(0, (cnt[k] || 0) - 1); upd(); });
    // 길게 누르면 계속 (폰에서 큰 금액 빨리 쓰기)
    let hold = null; const stop = () => { clearInterval(hold); hold = null; };
    fg.querySelector('.fg-list').addEventListener('pointerdown', (e) => { const b = e.target.closest('.fg-pl,.fg-m'); if (!b) return; stop(); let n = 0; hold = setInterval(() => { if (++n > 3) b.click(); }, 120); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => fg.addEventListener(ev, stop));
    fg.querySelector('.fg-reset').onclick = () => { cnt = {}; upd(); };
    fg.querySelector('.fg-show').onclick = draw;
    upd();
  };
  const upd = () => { const s = spent(), left = C.fest - s;
    fg.querySelector('.fg-k').textContent = `${C.cname} 2026년 행사·축제 예산 중 남은 돈`;
    fg.querySelector('.fg-v').textContent = krw(left);
    fg.querySelector('.fg-bar i').style.width = Math.max(0, Math.min(100, (left / C.fest) * 100)) + '%';
    fg.querySelectorAll('.fg-list li').forEach((li) => { const it = ITEMS.find((x) => x.k === li.dataset.k); li.querySelector('.fg-n').textContent = (cnt[it.k] || 0).toLocaleString('ko-KR');
      li.querySelector('.fg-pl').disabled = left < it.p; li.querySelector('.fg-m').disabled = !cnt[it.k]; li.querySelector('.fg-10').disabled = li.querySelector('.fg-all').disabled = left < it.p; });
    const min = Math.min(...ITEMS.map((x) => x.p)), done = left < min;
    fg.querySelector('.fg-res').textContent = done ? `다 썼어요! ${C.cname} 행사·축제 예산 ${krw(C.fest)}을 남김없이 썼어요.` : s ? `지금까지 ${krw(s)} 썼어요. 예산의 ${Math.floor((s / C.fest) * 1000) / 10}%를 썼어요.` : '물건 옆 + 를 눌러 써 봐요. 길게 누르면 계속 담겨요.';
    fg.classList.toggle('done', done); fg.querySelector('.fg-cv').hidden = true; fg.querySelector('.fg-sh').hidden = true; if (done) draw(); };
  const draw = () => { const cv = fg.querySelector('.fg-cv'), g = cv.getContext('2d'), F = (w, s) => `${w} ${s}px system-ui,-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif`;
    g.fillStyle = '#0b0f13'; g.fillRect(0, 0, 1200, 630); g.fillStyle = '#ffb020'; g.fillRect(64, 64, 8, 52);
    const T = (t, x, y, s, c, w, al) => { g.font = F(w || 600, s); g.fillStyle = c; g.textAlign = al || 'left'; g.fillText(t, x, y); };
    T('우리 시 행사·축제 예산 써보기 · 우리 시 돈 추적기', 92, 102, 30, '#8fa0b3'); T(C.cname, 64, 190, 56, '#e6edf3', 800);
    T(`2026년 행사·축제 예산 ${krw(C.fest)}`, 64, 260, 40, '#ffb020', 700);
    const L_ = ITEMS.filter((it) => cnt[it.k]).sort((a, b) => cnt[b.k] * b.p - cnt[a.k] * a.p).slice(0, 4);
    L_.forEach((it, i) => T(`${it.n} ${cnt[it.k].toLocaleString('ko-KR')}개${it.ex ? ' (예시 가격)' : ''}`, 64, 330 + i * 50, 32, '#c9d4df', 500));
    if (!L_.length) T('아직 아무것도 안 샀어요', 64, 330, 32, '#c9d4df', 500);
    T(`남은 돈 ${krw(C.fest - spent())}`, 64, 548, 30, '#e6edf3', 700); T('쓰겠다고 잡아둔 돈(실제로 쓴 돈 아님) · 출처 행정안전부 지방재정365', 64, 590, 22, '#8fa0b3', 500); T('패러디 게임(neal.fun/spend)', 1136, 590, 22, '#8fa0b3', 500, 'right');
    cv.hidden = false; const sh = fg.querySelector('.fg-sh'); sh.hidden = false; const url = cv.toDataURL('image/png'); fg.querySelector('.fg-dl').href = url;
    fg.querySelector('.fg-share').onclick = () => cv.toBlob(async (b) => { const f = new File([b], 'festival-budget.png', {type: 'image/png'}), t = `${C.cname} 행사·축제 예산 ${krw(C.fest)}, 나는 이렇게 써 봤어요 · 우리 시 돈 추적기`, u = location.origin + location.pathname + location.search + '#play';
      try { if (navigator.canShare && navigator.canShare({files: [f]})) await navigator.share({files: [f], title: t, text: t + ' ' + u}); else if (navigator.share) await navigator.share({title: t, text: t, url: u}); else { await navigator.clipboard.writeText(t + ' ' + u); fg.querySelector('.fg-share').textContent = '링크 복사됨'; } } catch (e) {} }); };
  // 폰에서 시를 고르면 지도 아래 시 카드 머리('대구광역시 112억원')가 하단 탭바에 가리지 않게 살짝 올려 줌
  const peek = () => { if (innerWidth >= 900 || mode() !== 'map') return; const sh = dive.querySelector('.dv-sheet'), tb = document.querySelector('.tabbar'); if (!sh || !tb || !new URLSearchParams(location.search).get('c')) return;
    const need = sh.getBoundingClientRect().top + 72 - tb.getBoundingClientRect().top; if (need > 0) scrollBy({top: Math.min(need, 260), behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'}); };
  addEventListener('dv:go', () => setTimeout(peek, 700)); setTimeout(peek, 2500);
  apply(false); if (mode() === 'play') build();
})();
