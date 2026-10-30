/* 홈: '국회 추적실' 들어가는 카드. 레이더가 돌고, 오늘 의원들에게 쌓인 세비(지급 기준)가 실시간으로 올라간다. */
(() => {
  if ((document.body.dataset.page || '') !== 'home') return;
  const css = document.createElement('style');
  css.textContent = `.htk{position:relative;display:flex;align-items:center;gap:14px;margin:0 0 12px;padding:14px 16px;border-radius:18px;text-decoration:none;color:#e8fff1;overflow:hidden;
background:radial-gradient(120% 140% at 0% 0%,#0f3a22 0%,#06140c 55%,#040b07 100%);border:1px solid rgba(93,255,158,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 30px rgba(0,0,0,.35);transition:transform .15s,border-color .2s}
.htk:active{transform:scale(.985)}.htk:hover{border-color:rgba(93,255,158,.5)}
.htk::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(93,255,158,.03) 3px 4px);pointer-events:none}
.htk svg{flex:none;width:58px;height:58px}.htk .sw{transform-origin:29px 29px;animation:htkSpin 2.6s linear infinite}@keyframes htkSpin{to{transform:rotate(360deg)}}
.htk .bl{animation:htkBl 2.6s linear infinite}.htk .bl.b2{animation-delay:-1.1s}@keyframes htkBl{0%,8%{opacity:1}40%,100%{opacity:.08}}
.htk .t{flex:1;min-width:0;display:grid;gap:2px}.htk .k{font:700 11px ui-monospace,Menlo,monospace;color:#5dff9e;letter-spacing:.06em}.htk .k i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff3b47;margin-right:6px;vertical-align:1px;animation:htkBl 1s steps(2) infinite}
.htk .n{font:800 24px Pretendard,system-ui,sans-serif;color:#fff;font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1.15}.htk .n small{font-size:13px;color:#ffb020;margin-left:2px}
.htk .s{font-size:12.5px;color:#8fc9a5;line-height:1.4}.htk .go{flex:none;font:700 13px Pretendard,system-ui,sans-serif;color:#02110a;background:#5dff9e;border-radius:999px;padding:8px 13px;box-shadow:0 0 18px rgba(93,255,158,.35)}
#mytop .htk{margin:0}.htk-wrap{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin:0 0 12px;min-width:0;max-width:100%}.htk-se{display:flex;gap:6px;min-width:0;max-width:100%}.htk-se input{flex:1 1 0;width:0;min-width:0;font:600 16px var(--sans,Pretendard,system-ui,sans-serif);color:#e8eef5;background:#0f151c;border:1.5px solid #2f3d4a;border-radius:14px;padding:12px 13px}.htk-se input:focus{outline:none;border-color:#ffb020}.htk-se button{flex:none;min-width:60px;border:0;border-radius:14px;background:#ffb020;color:#111;font:800 15px var(--sans,Pretendard,system-ui,sans-serif);cursor:pointer}.htk-wrap .htk{margin:0}.htk-us{background:radial-gradient(120% 140% at 0% 0%,#10233f 0%,#070d18 60%,#05080f 100%);border-color:rgba(120,170,255,.25);padding:12px 16px}.htk-us .fl{font-size:34px;line-height:1;flex:none;width:58px;text-align:center}.htk-us .k{color:#8fb4ff}.htk-us .u1{font:800 17px Pretendard,system-ui,sans-serif;color:#fff}.htk-us .s{color:#9fb3d1}.htk-us .go{background:#8fb4ff;box-shadow:0 0 18px rgba(120,170,255,.35)}@media(max-width:380px){.htk-us .fl{width:48px;font-size:28px}.htk-us .u1{font-size:15px}}@media(max-width:380px){.htk{gap:10px;padding:12px}.htk svg{width:48px;height:48px}.htk .n{font-size:21px}.htk .go{padding:7px 10px}}
@media(prefers-reduced-motion:reduce){.htk .sw,.htk .bl,.htk .k i{animation:none}}`;
  document.head.append(css);
  const a = document.createElement('a'); a.className = 'htk'; a.href = 'national.html';
  a.innerHTML = `<svg viewBox="0 0 58 58" aria-hidden="true"><defs><linearGradient id="htkG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5dff9e" stop-opacity="0"/><stop offset="1" stop-color="#5dff9e" stop-opacity=".55"/></linearGradient></defs>
<circle cx="29" cy="29" r="27" fill="#03100a" stroke="#1f6a3f"/><circle cx="29" cy="29" r="18" fill="none" stroke="#1f6a3f" stroke-dasharray="2 3"/><circle cx="29" cy="29" r="9" fill="none" stroke="#1f6a3f"/>
<g class="sw"><path d="M29 29 L29 2 A27 27 0 0 1 52.4 15.5 Z" fill="url(#htkG)"/><line x1="29" y1="29" x2="52.4" y2="15.5" stroke="#5dff9e" stroke-width="1.4"/></g>
<circle class="bl" cx="41" cy="20" r="2.4" fill="#ffb020"/><circle class="bl b2" cx="19" cy="38" r="2" fill="#ffb020"/><circle cx="29" cy="29" r="2" fill="#5dff9e"/></svg>
<span class="t"><span class="k"><i></i>국회 살펴보기 · 실시간</span><span class="n">0<small>원</small></span><span class="s">오늘 의원 <b class="m">299</b>명에게 쌓이는 의원 월급 · 출장·법 만들기·찬반 추적</span></span><span class="go">입장</span>`;
  let per = 160925680, n = 299;
  const won = (v) => { v = Math.floor(v); const e = Math.floor(v / 1e8), m = Math.floor((v % 1e8) / 1e4); return (e ? e.toLocaleString() + '억 ' : '') + m.toLocaleString() + '만'; };
  const num = a.querySelector('.n');
  const tick = () => { const k = new Date(Date.now() + 9 * 3600e3); const sec = k.getUTCHours() * 3600 + k.getUTCMinutes() * 60 + k.getUTCSeconds() + k.getUTCMilliseconds() / 1000; num.firstChild.textContent = won(per * n / (365 * 86400) * sec); };
  fetch('data/national/support.json').then((r) => r.json()).then((d) => { const x = (d.allowance || []).find((y) => y.amount); if (x) per = Number(x.amount); }).catch(() => {});
  const place = () => { const t = document.getElementById('mytop'); if (!t) return false; t.before(wrap); return true; }; // 홈 맨 위: 처음 들어와도 의원 추적부터
  // 미국 입구: 영어 의회 추적기는 2026-10-26부터 비공개, 지금 us.html은 미국 관제실 미리보기(개발 중)
  const us = document.createElement('a'); us.className = 'htk htk-us'; us.href = 'us.html';
  us.innerHTML = '<span class="fl">●</span><span class="t"><span class="k">미국 (준비 중)</span><b class="u1">미국 살펴보기</b><span class="s">개발 중 · 지도에서 사건·법안·기업 추적</span></span><span class="go">입장</span>';
  // 통합 검색 입구 (search.html, 저장된 공개 기록으로 흐름 추적)
  const se = document.createElement('form'); se.className = 'htk-se'; se.action = 'search.html'; se.method = 'get'; se.setAttribute('role', 'search');
  se.innerHTML = '<input name="q" type="search" enterkeyhint="search" required autocomplete="off" placeholder="무엇이든 검색 · 업체 · 시 · 계약 · 의원 · 법안 · 종목" aria-label="통합 검색"><button type="submit">검색</button>';
  const wrap = document.createElement('div'); wrap.className = 'htk-wrap'; wrap.append(se, a, us);
  const park = () => {
    if (!matchMedia('(max-width:767px)').matches) return false;
    const dive = document.getElementById('dive');
    const map = dive && dive.querySelector('.dv-map');
    if (!map || !wrap.isConnected) return false;
    const bits = [
      document.querySelector('.country-entry'),
      wrap,
      document.getElementById('mytop'),
      document.querySelector('.visits'),
      document.querySelector('.pwa'),
    ].filter(Boolean);
    let anchor = dive.querySelector('.maplg') || map;
    for (const n of bits) { n.classList.add('below-map'); anchor.after(n); anchor = n; }
    return !!(document.getElementById('mytop') && document.querySelector('.visits'));
  };
  let tries = 0; const t = setInterval(() => {
    if (!wrap.isConnected && !place() && ++tries > 40) { clearInterval(t); const d = document.getElementById('dive'); if (d) d.before(wrap); }
    if (park() || ++tries > 40) clearInterval(t);
  }, 150);
  tick(); setInterval(tick, matchMedia('(prefers-reduced-motion: reduce)').matches ? 1000 : 120);
})();
