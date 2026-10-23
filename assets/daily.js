/* 오늘의 한 문제 — 날짜(한국 시간)로 고정된 두 도시 비교. 숫자는 data/daily.json(사이트 일별 집계)만 쓴다.
   기간: 문제 날짜 전날까지 30일(모두 같은 숫자). 링크: ?q=YYYY-MM-DD#daily */
(() => {
  const game = document.getElementById('game'); if (!game) return;
  const box = document.createElement('section'); box.className = 'sec gm dq'; box.id = 'daily'; box.setAttribute('aria-label', '오늘의 한 문제'); game.before(box);
  const K = 'mt-daily-v1', SRC = '출처: 조달청 나라장터 공공데이터';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const krw = (n) => { const a = Math.abs(n || 0); if (a >= 1e12) return (a / 1e12).toFixed(1).replace(/\.0$/, '') + '조원'; if (a >= 1e8) return (a / 1e8 >= 100 ? Math.round(a / 1e8).toLocaleString('ko-KR') : (a / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원'; return Math.round(a / 1e4).toLocaleString('ko-KR') + '만원'; };
  const kst = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const add = (s, k) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
  const md = (s) => `${+s.slice(5, 7)}월 ${+s.slice(8)}일`;
  const today = kst(), qp = new URLSearchParams(location.search).get('q');
  const D = /^\d{4}-\d\d-\d\d$/.test(qp || '') && qp <= today ? qp : today;
  const rnd = (seed) => { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const st = (() => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { return {}; } })();
  const save = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch (e) {} };
  st.days = st.days || {};
  let Q = null;
  window.__dq = () => (Q && !st.days[D] ? {el: box, ss: [Q.a.slug, Q.b.slug]} : null);
  const build = async () => {
    const rf = (u) => fetch(u, {cache: 'no-cache'}).then((r) => (r.ok ? r.json() : null));
    const [dl, ix] = await Promise.all([rf('data/daily.json'), rf('data/index.json')]); if (!ix) return null;
    // 데이터 담당이 고정한 문제(data/daily_q.json)가 있으면 그 값을 그대로 쓴다(예전 날짜 숫자 고정)
    const fx = await fetch('data/daily_q.json', {cache: 'no-cache'}).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const nm0 = {}; for (const c of ix.cities || []) nm0[c.slug] = c.name;
    const f = fx && fx[D]; if (f && nm0[f.a] && nm0[f.b] && f.av > 0 && f.bv > 0 && /^\d{4}-\d\d-\d\d$/.test(f.from) && /^\d{4}-\d\d-\d\d$/.test(f.to))
      return {a: {slug: f.a, name: nm0[f.a], total: f.av}, b: {slug: f.b, name: nm0[f.b], total: f.bv}, from: f.from, to: f.to, fixed: true};
    if (!dl || !dl.c) return null;
    let to = add(D, -1); if (to > dl.last) to = dl.last; const from = add(to, -29); if (from < (dl.cover_from || dl.first)) return null;
    const nm = {}; for (const c of ix.cities || []) nm[c.slug] = c.name;
    const C = Object.keys(dl.c).filter((s) => nm[s]).sort().map((s) => { let t = 0; for (const k in dl.c[s]) if (k >= from && k <= to) t += dl.c[s][k][1]; return {slug: s, name: nm[s], total: t}; }).filter((c) => c.total >= 1e8);
    if (C.length < 2) return null; const r = rnd('mt-daily|' + D);
    for (let i = 0; i < 500; i++) { const a = C[Math.floor(r() * C.length)], b = C[Math.floor(r() * C.length)]; if (a === b) continue;
      const q = Math.max(a.total, b.total) / Math.min(a.total, b.total); if (q >= 1.2 && q <= 4) return {a, b, from, to}; }
    return null; };
  const link = () => location.origin + location.pathname.replace(/[^/]*$/, '') + `?q=${D}#daily`;
  const streakText = () => (st.streak ? `연속 <b>${st.streak}</b>일 맞힘` : '') + (st.best ? `${st.streak ? ' · ' : ''}최고 <b>${st.best}</b>일` : '');
  const draw = () => {
    if (!Q) { box.innerHTML = `<div class="dq-h"><span class="dq-k">오늘의 한 문제</span><span class="dq-d">${md(D)}</span></div><p class="sub">오늘 문제를 만들 자료가 아직 없어요.</p>`; return; }
    const {a, b, from, to} = Q, me = st.days[D], done = !!me, win = a.total >= b.total ? 0 : 1;
    const past = D !== today ? `<p class="dq-old">${md(D)} 문제예요. 오늘 문제는 <a href="./#daily">여기</a>에서 풀 수 있어요.</p>` : '';
    box.innerHTML = `<div class="dq-h"><span class="dq-k">오늘의 한 문제</span><span class="dq-d">${md(D)}</span></div>${past}
      <p class="dq-q">${md(from)}부터 ${md(to)}까지 ${Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1}일 동안, 계약에 돈을 더 많이 쓴 시는?</p>
      <div class="dq-pick">${[a, b].map((c, i) => `<button type="button" class="dq-c dq-c${i}${done ? (i === win ? ' dq-win' : ' dq-lose') + (me.pick === i ? ' dq-me' : '') : ''}" data-i="${i}"${done ? ' disabled' : ''}><b>${esc(c.name)}</b><span>${done ? krw(c.total) : '?'}</span></button>`).join('')}</div>
      ${done ? `<p class="dq-res" aria-live="polite">${me.ok ? '맞았어요!' : '아쉬워요.'} ${esc([a, b][win].name)}가 ${krw([a, b][win].total)}, ${esc([a, b][1 - win].name)}가 ${krw([a, b][1 - win].total)}을 썼어요. 내일 새 문제가 나와요.</p>
        <div class="dq-bar"><span class="dq-st">${streakText()}</span><button type="button" class="gm-btn dq-sh">결과 공유</button></div>` : `<p class="dq-st">${streakText() || '하루에 한 번만 풀 수 있어요.'}</p>`}
      <p class="src">한 업체랑만 맺은 계약(경쟁 없이)까지 모두 더한 돈 · 날짜별로 모두 같은 문제 · ${SRC}</p>`;
    window.__gmRing && window.__gmRing();
    box.querySelectorAll('.dq-c:not([disabled])').forEach((x) => (x.onclick = () => answer(+x.dataset.i)));
    const sh = box.querySelector('.dq-sh'); if (sh) sh.onclick = share; };
  const answer = (i) => { if (!Q || st.days[D]) return; const ok = (Q.a.total >= Q.b.total ? 0 : 1) === i; st.days[D] = {pick: i, ok};
    if (D === today) { if (ok) { st.streak = st.lastWin === add(D, -1) ? (st.streak || 0) + 1 : 1; st.lastWin = D; st.best = Math.max(st.best || 0, st.streak); } else st.streak = 0; }
    const ks = Object.keys(st.days).sort(); while (ks.length > 60) delete st.days[ks.shift()];
    save(); draw(); };
  const share = async () => { const me = st.days[D]; const t = `우리 시 돈 추적기 오늘의 한 문제(${md(D)}): ${Q.a.name}와 ${Q.b.name} 중 계약에 돈을 더 많이 쓴 곳은? 나는 ${me.ok ? '맞혔어요' : '틀렸어요'}${st.streak && me.ok ? `, 연속 ${st.streak}일째` : ''}. 너도 풀어 볼래?`, u = link();
    if (navigator.share) { try { await navigator.share({text: t, url: u}); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(t + ' ' + u); } catch (e) {}
    const res = box.querySelector('.dq-bar'); if (res && !box.querySelector('.dq-x')) res.insertAdjacentHTML('afterend', `<p class="dq-x">공유 문구를 복사했어요. <a href="https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}" target="_blank" rel="noopener">X에 올리기</a></p>`); };
  box.innerHTML = '<div class="dq-h"><span class="dq-k">오늘의 한 문제</span><span class="dq-d">' + md(D) + '</span></div><p class="sub">불러오는 중…</p>';
  build().then((q) => { Q = q; draw(); if (location.hash === '#daily') setTimeout(() => box.scrollIntoView({block: 'start'}), 400); }).catch(() => { Q = null; draw(); });
})();
