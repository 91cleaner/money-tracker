/* 방문자 수 + 감사 문구. GoatCounter(moneytracker) 공개 카운터에서 오늘·전체 방문 수를 읽는다.
   카운터를 못 읽으면(설정 꺼짐·차단) 숫자 없이 감사 문구만 보여 준다. 스튜디오(내부용)에서는 세지도 보여 주지도 않는다. */
(() => {
  const page = document.body.dataset.page || '';
  if (/studio/.test(location.pathname)) return;
  const GC = 'https://moneytracker.goatcounter.com';
  // 방문 세기: 아직 count.js 가 없는 페이지에도 붙인다
  if (!document.querySelector('script[data-goatcounter]')) {
    const s = document.createElement('script'); s.async = true; s.src = '//gc.zgo.at/count.js'; s.dataset.goatcounter = GC + '/count';
    document.head.append(s);
  }
  const css = document.createElement('style');
  css.textContent = `.visits{display:grid;gap:2px;margin:0 0 12px;padding:10px 14px;border-radius:14px;background:#14161f;border:1px solid #2a3040;font-size:13.5px;line-height:1.5;color:#c9d3dd}
.visits .vn{display:block;font-weight:800;color:#fff}.visits .vn[hidden]{display:none}.visits .vn b{display:inline!important;color:#ffb020;font-size:16px;margin:0 1px}.visits .vt{display:block;min-width:0}
.visits .vx{display:block;margin-top:6px;padding-top:6px;border-top:1px solid #2a3040;color:#ffd27a;text-decoration:none;font-size:13px}.visits .vx b{color:#ffb020}.visits .vx:hover{text-decoration:underline}
footer .visits{margin:8px 0 0;background:transparent;border:0;padding:0;font-size:12.5px;color:#9aa6b2}footer .visits .vn b{font-size:13px}`;
  document.head.append(css);
  const THANKS = '여러분의 관심으로 세금이 절약될 수 있습니다. 감사합니다 🙏';
  const box = document.createElement('div'); box.className = 'visits';
  const X = 'https://x.com/KORROOFTOPARODY';
  box.innerHTML = `<span class="vn" hidden></span><span class="vt">${THANKS}</span><a class="vx" href="${X}" target="_blank" rel="noopener">☕ 이 사이트는 <b>@청소부</b> 혼자 만들어요 · <b>월 1달러 X 구독</b>으로 응원하기 ›</a>`;
  const place = () => {
    if (page === 'home') {
      const top = document.getElementById('mytop'), main = document.querySelector('main');
      if (top) top.after(box); else if (main) main.prepend(box); else return false;
    } else {
      const f = document.querySelector('footer'); if (f) f.append(box); else { const m = document.querySelector('main'); if (!m) return false; m.append(box); }
    }
    return true;
  };
  // 홈은 today.js 가 #mytop 을 만든 뒤에 놓는다
  let tries = 0;
  const tryPlace = () => { if (page === 'home' && !document.getElementById('mytop') && tries++ < 20) { setTimeout(tryPlace, 150); return; } place(); };
  tryPlace();
  const kst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const num = (j) => (j ? parseInt(String(j.count || '').replace(/\D/g, ''), 10) || 0 : 0);
  const get = (q) => fetch(GC + '/counter/TOTAL.json' + q, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const show = (today, total) => {
    const vn = box.querySelector('.vn'); if (!today && !total) return;
    vn.innerHTML = '👀 ' + [today ? `오늘 <b>${today.toLocaleString('ko-KR')}</b>명` : '', total ? `지금까지 <b>${total.toLocaleString('ko-KR')}</b>명` : ''].filter(Boolean).join(' · ');
    vn.hidden = false;
  };
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem('mt.visits') || 'null'); } catch (e) { cached = null; }
  if (cached && cached.d === kst && Date.now() - cached.at < 10 * 60e3) { show(cached.today, cached.total); return; }
  Promise.all([get(`?start=${kst}&end=${kst}`), get('')]).then(([a, b]) => {
    const today = num(a), total = num(b); show(today, total);
    try { sessionStorage.setItem('mt.visits', JSON.stringify({ d: kst, at: Date.now(), today, total })); } catch (e) { /* 저장 막힘 */ }
  });
})();
