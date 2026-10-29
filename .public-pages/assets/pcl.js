/* PC(900px 이상): 지도 칼럼을 붙잡아 두고(sticky), 오른쪽 칼럼에 지역 정보 → 오늘의 한 문제 → 게임 카드를 쌓는다.
   카드를 내려도 지도가 계속 보이게. 지도 위에는 아무것도 올리지 않는다. 폰은 원래 순서 그대로. */
(() => {
  const dv = document.getElementById('dive'); if (!dv) return;
  const mq = matchMedia('(min-width:900px)'), lc = document.createElement('div'); lc.className = 'dv-lc';
  let orig = null, on = false;
  const inv = () => window.__dvMap && setTimeout(() => window.__dvMap.invalidateSize(), 60);
  const apply = () => {
    const d = document.getElementById('daily'), g = document.getElementById('game');
    if (mq.matches && !on) {
      orig = [...dv.children];
      const pick = orig.filter((e) => e.matches('.dv-q, .pd, .dv-map, .maplg'));
      if (!pick.some((e) => e.matches('.dv-map'))) return;
      pick[0].before(lc); lc.append(...pick);
      if (d) dv.append(d); if (g) dv.append(g); dv.classList.add('dv-pc'); on = true; inv();
    } else if (!mq.matches && on) {
      dv.append(...orig); lc.remove(); const after = dv.nextSibling;
      if (g) dv.parentNode.insertBefore(g, after); if (d) g ? g.before(d) : dv.parentNode.insertBefore(d, after);
      dv.classList.remove('dv-pc'); on = false; inv();
    }
  };
  apply(); mq.addEventListener('change', apply);
  if (!on) { let n = 0; const t = setInterval(() => { apply(); if (on || ++n > 20 || !mq.matches) clearInterval(t); }, 250); }
})();
