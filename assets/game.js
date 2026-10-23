/* 어디가 더 많게? — 고른 기간의 도시별 계약 총액(data/index.json, 기간 슬라이더가 거른 값)만 쓴다 */
(() => {
  const root = document.getElementById('game'); if (!root) return;
  const K = 'mt-game-best', SRC = '출처: 조달청 나라장터 공공데이터';
  const krw = (n) => { const a = Math.abs(n || 0); if (a >= 1e12) return (a / 1e12).toFixed(1).replace(/\.0$/, '') + '조원'; if (a >= 1e8) return (a / 1e8 >= 100 ? Math.round(a / 1e8).toLocaleString('ko-KR') : (a / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원'; return Math.round(a / 1e4).toLocaleString('ko-KR') + '만원'; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const label = () => (window.__pdLabel && window.__pdLabel()) || '최근 30일', when = () => (window.__pdWhen && window.__pdWhen()) || '최근 30일 동안';
  let C = [], pair = null, streak = 0, best = +(localStorage.getItem(K) || 0), done = false, last = '';
  const load = async () => { try { const x = await (await fetch('data/index.json')).json(); C = (x.cities || []).filter((c) => c.total > 0).map((c) => ({slug: c.slug, name: c.name, total: c.total})); } catch (e) { C = []; } };
  const pick = () => { if (C.length < 2) return null;
    for (let t = 0; t < 200; t++) { const a = C[Math.floor(Math.random() * C.length)], b = C[Math.floor(Math.random() * C.length)];
      if (a === b) continue; const r = Math.max(a.total, b.total) / Math.min(a.total, b.total); const key = [a.slug, b.slug].sort().join();
      if (r < 1.2 || key === last) continue; last = key; return [a, b]; } return null; };  // 20% 안쪽으로 비슷한 쌍은 뺀다
  // 폰: 카드 안 작은 위치 지도(정적 SVG, 제스처 없음). 윤곽선=assets/geo.json, 도시 위치=data/flows.json
  let GEO = null, PT = {};
  const geoLoad = async () => { if (GEO) return; try { const [g, f] = await Promise.all([fetch('assets/geo.json').then((r) => r.json()), fetch('data/flows.json').then((r) => r.json())]);
    for (const k in f.cities) if (f.cities[k].p) PT[k] = f.cities[k].p; GEO = g; } catch (e) { GEO = {provinces: []}; } };
  const mini = (a, b) => { if (!GEO || !GEO.provinces.length) return ''; const pa = PT[a.slug], pb = PT[b.slug]; if (!pa || !pb) return '';
    const wi = done ? (a.total >= b.total ? 0 : 1) : -1, P = [pa, pb], col = ['#7fe8ff', '#ffb020'];
    const left = pa[0] <= pb[0] ? 0 : 1;
    const dot = (k) => { const [x, y] = P[k], nm = esc([a, b][k].name.replace(/(특별자치시|특별자치도|특별시|광역시)$/, '')), win = wi === k, lose = wi >= 0 && !win, L_ = k === left;
      const dy = Math.abs(pa[1] - pb[1]) < 26 ? (k ? 16 : -10) : 5;
      return `<g opacity="${lose ? 0.45 : 1}">${win ? `<circle cx="${x}" cy="${y}" r="36" fill="none" stroke="${col[k]}" stroke-width="7"/>` : ''}<circle cx="${x}" cy="${y}" r="${win ? 20 : 15}" fill="${col[k]}" stroke="#03070b" stroke-width="4"/>`
        + `<text x="${x + (L_ ? -20 : 20)}" y="${y + dy}" text-anchor="${L_ ? 'end' : 'start'}" fill="${col[k]}" stroke="#03070b" stroke-width="8" paint-order="stroke" font-size="40" font-weight="800">${nm}${win ? ' 정답' : ''}</text></g>`; };
    return `<figure class="gm-mini" aria-hidden="true"><svg viewBox="110 10 440 640" style="overflow:visible" preserveAspectRatio="xMidYMid meet">${GEO.provinces.map((v) => `<path d="${v.d}"/>`).join('')}${dot(0)}${dot(1)}</svg></figure>`; };
  const draw = () => {
    if (!pair) { root.innerHTML = '<h2>어디가 더 많게?</h2><p class="sub">문제를 만들 자료가 아직 없어요.</p>'; return; }
    const [a, b] = pair;
    root.innerHTML = `<h2>어디가 더 많게?</h2>
      <p class="sub">${esc(when())} 계약에 돈을 더 많이 쓴 도시는 어디일까요? <span class="gm-note">(한 업체랑만 맺은 계약(경쟁 없이)까지 모두 더한 돈)</span></p>
      <div class="gm-pick">${[a, b].map((c, i) => `<button type="button" class="gm-c gm-c${i}" data-i="${i}"><b>${esc(c.name)}</b><span class="gm-amt">${done ? krw(c.total) : '?'}</span></button>`).join('<span class="gm-vs">또는</span>')}</div>
      <p class="gm-res" aria-live="polite"></p>
      <div class="gm-bar"><span class="gm-st">${streak ? `연속 <b>${streak}</b>개 맞힘 · ` : ''}${best ? `최고 기록 <b>${best}</b>개` : ''}</span><span class="gm-act"></span></div>
      ${NAR.matches ? mini(a, b) : ''}${done ? '' : '<p class="gm-mapp"><button type="button" class="gm-btn gm-map">지도에서 보기 ↑</button></p>'}<p class="src">지도에서 파란 원과 주황 원이 두 도시예요 · ${esc(label())} 맺은 계약 · ${SRC}</p>`;
    root.querySelectorAll('.gm-c').forEach((btn) => (btn.onclick = () => answer(+btn.dataset.i)));
    const mb = root.querySelector('.gm-map'); if (mb) mb.onclick = () => { seen = true; btnOn = true; ring(); const d = document.querySelector('#dive .dv-map') || document.querySelector('#dive'); if (d) d.scrollIntoView({block: 'start', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'}); };
    ring(); };
  // 지도 링은 게임 카드가 화면에 보이거나 #game일 때만
  // 폰: 지도와 게임 카드가 한 화면에 안 보이므로, 카드를 한 번 보면 답하거나 다른 도시를 고를 때까지 링 유지
  // 첫 화면에서 카드가 잠깐 보이는 순간(레이아웃 전)은 무시: 손님이 스크롤한 뒤에만
  let moved = false; ['wheel', 'touchmove', 'keydown'].forEach((t) => addEventListener(t, () => { moved = true; upd(); }, {capture: true, passive: true, once: true}));
  const MOB = matchMedia('(max-width:899px)'), NAR = matchMedia('(max-width:699px)'); let btnOn = false;
  let seen = location.hash === '#game'; const ring = () => window.__dvBlink && window.__dvBlink(seen && pair && !done && (!NAR.matches || btnOn) ? [pair[0].slug, pair[1].slug] : []);
  let vis = false; function upd() { const v = (vis && moved) || location.hash === '#game'; if (MOB.matches && !v) return; if (v !== seen) { seen = v; ring(); } }
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { vis = es[es.length - 1].isIntersecting; upd(); }, {threshold: 0.15}).observe(root);
  addEventListener('hashchange', () => { if (location.hash === '#game') { seen = true; ring(); } });
  const next = () => { done = false; btnOn = false; pair = pick(); draw(); };
  const answer = (i) => { if (done || !pair) return; done = true; const [a, b] = pair, win = (pair[i].total >= pair[1 - i].total);
    if (win) { streak++; if (streak > best) { best = streak; try { localStorage.setItem(K, String(best)); } catch (e) {} } }
    const lost = streak; seen = false; draw();
    { const wi = pair[0].total >= pair[1].total ? 0 : 1, sl = pair[wi].slug; if (window.__dvBlink && !NAR.matches) { window.__dvBlink(wi ? [null, sl] : [sl]); clearTimeout(window.__gmHL); window.__gmHL = setTimeout(() => { if (done) window.__dvBlink([]); }, 1500); } }
    root.querySelectorAll('.gm-c').forEach((x, k) => { x.disabled = true; x.classList.add(pair[k].total >= pair[1 - k].total ? 'gm-win' : 'gm-lose'); if (k === i) x.classList.add('gm-me'); });
    const big = a.total >= b.total ? a : b, sm = big === a ? b : a;
    root.querySelector('.gm-res').textContent = (win ? '맞았어요! ' : '아쉬워요. ') + `${big.name}가 ${krw(big.total)}으로 ${sm.name}(${krw(sm.total)})보다 많이 썼어요. 기간: ${label()}.`;
    const act = root.querySelector('.gm-act');
    if (win) { act.innerHTML = '<button type="button" class="gm-btn gm-next">다음 문제</button>'; act.querySelector('.gm-next').onclick = next; }
    else { streak = 0; root.querySelector('.gm-st').innerHTML = `이번 기록 <b>${lost}</b>개${best ? ` · 최고 기록 <b>${best}</b>개` : ''}`;
      act.innerHTML = '<button type="button" class="gm-btn gm-sh">기록 공유</button><button type="button" class="gm-btn gm-next">다시 하기</button>';
      act.querySelector('.gm-next').onclick = next; act.querySelector('.gm-sh').onclick = () => share(lost); } };
  const link = () => { const w = (window.__pdCW && window.__pdCW()) || {}; const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    return `${base}?${w.d != null && w.d !== 30 ? `d=${w.d}${w.to ? '&to=' + w.to : ''}` : ''}#game`.replace('?#', '#'); };
  const card = (n) => { const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 675; const g = cv.getContext('2d'), F = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
    const bg = g.createLinearGradient(0, 0, 1200, 675); bg.addColorStop(0, '#0b1118'); bg.addColorStop(1, '#05080c'); g.fillStyle = bg; g.fillRect(0, 0, 1200, 675);
    g.strokeStyle = 'rgba(80,140,200,.08)'; for (let x = 0; x <= 1200; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 675); g.stroke(); } for (let y = 0; y <= 675; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); }
    const T = (t, x, y, sz, col, wt = 700, al = 'left') => { g.font = `${wt} ${sz}px ${F}`; g.fillStyle = col; g.textAlign = al; g.fillText(t, x, y); };
    g.fillStyle = '#ffb020'; g.fillRect(64, 64, 8, 52); T('우리 시 돈 추적기 · 어디가 더 많게?', 92, 102, 30, '#8fa0b3', 600); T(label(), 1136, 102, 30, '#ffb020', 700, 'right');
    T('두 도시 중 계약에 돈을 더 많이 쓴 곳 맞히기', 64, 210, 40, '#e8eef5', 700);
    T(`연속 ${n}개 맞힘`, 64, 360, 128, '#ffb020', 800);
    T(`최고 기록 ${best}개 · 나도 해 볼까?`, 64, 440, 40, '#cfd8e3', 600);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(64, 500, 1072, 2);
    T(SRC, 64, 600, 26, '#8fa0b3', 500); T(link().replace(/^https?:\/\//, '').replace(/[?#].*$/, ''), 1136, 600, 26, '#8fa0b3', 600, 'right');
    return cv; };
  window.__gmCard = (n) => card(n == null ? 7 : n).toDataURL('image/png');
  const share = async (n) => { const cv = card(n), u = link(), text = `두 도시 중 계약에 돈을 더 많이 쓴 곳, 몇 개나 맞힐 수 있을까? 나는 연속 ${n}개 맞혔어요. 너도 해 볼래?`;
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png')); const file = blob && new File([blob], 'money-tracker-game.png', {type: 'image/png'});
    if (file && navigator.canShare && navigator.canShare({files: [file]})) { try { await navigator.share({files: [file], text: text + ' ' + u, url: u}); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    const xu = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(u);
    const src = blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png'); const m = document.createElement('div'); m.className = 'dv-shm'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', '공유 이미지');
    m.innerHTML = `<div class="dv-shm-b"><img alt="게임 기록 공유 이미지" src="${src}"><div class="dv-shm-a"><a class="dv-shm-s" download="money-tracker-game.png" href="${src}">이미지 저장</a><a class="dv-shm-xp" href="${xu}" target="_blank" rel="noopener">X에 올리기</a><button type="button" class="dv-shm-x">닫기</button></div></div>`;
    m.onclick = (e) => { if (e.target === m || e.target.closest('.dv-shm-x')) m.remove(); }; document.body.append(m); };
  let lastLb = null; window.__gmPeriod = async () => { await load(); const lb = label(); if (pair && lb === lastLb) { const f = (k) => C.find((c) => c.slug === k); const a = f(pair[0].slug), b = f(pair[1].slug); if (a && b) { pair = [a, b]; draw(); return; } } lastLb = lb; streak = 0; next(); };
  const cityOn = () => new URLSearchParams(location.search).has('c');
  addEventListener('dv:go', () => { if (seen) { seen = false; ring(); } });
  addEventListener('popstate', () => { if (cityOn() && seen) { seen = false; ring(); } });
  const start = async () => { await load(); if (NAR.matches) await geoLoad(); lastLb = label(); if (!pair) next(); else draw(); if (location.hash === '#game') setTimeout(() => root.scrollIntoView({block: 'start'}), 400); };
  start(); let tries = 0; const w2 = () => (window.__dvBlink ? ring() : ++tries < 120 && setTimeout(w2, 300)); w2();
})();
