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
#mytop .htk{margin:0}@media(max-width:380px){.htk{gap:10px;padding:12px}.htk svg{width:48px;height:48px}.htk .n{font-size:21px}.htk .go{padding:7px 10px}}
@media(prefers-reduced-motion:reduce){.htk .sw,.htk .bl,.htk .k i{animation:none}}`;
  document.head.append(css);
  const a = document.createElement('a'); a.className = 'htk'; a.href = 'national.html';
  a.innerHTML = `<svg viewBox="0 0 58 58" aria-hidden="true"><defs><linearGradient id="htkG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5dff9e" stop-opacity="0"/><stop offset="1" stop-color="#5dff9e" stop-opacity=".55"/></linearGradient></defs>
<circle cx="29" cy="29" r="27" fill="#03100a" stroke="#1f6a3f"/><circle cx="29" cy="29" r="18" fill="none" stroke="#1f6a3f" stroke-dasharray="2 3"/><circle cx="29" cy="29" r="9" fill="none" stroke="#1f6a3f"/>
<g class="sw"><path d="M29 29 L29 2 A27 27 0 0 1 52.4 15.5 Z" fill="url(#htkG)"/><line x1="29" y1="29" x2="52.4" y2="15.5" stroke="#5dff9e" stroke-width="1.4"/></g>
<circle class="bl" cx="41" cy="20" r="2.4" fill="#ffb020"/><circle class="bl b2" cx="19" cy="38" r="2" fill="#ffb020"/><circle cx="29" cy="29" r="2" fill="#5dff9e"/></svg>
<span class="t"><span class="k"><i></i>국회 추적실 · LIVE</span><span class="n">0<small>원</small></span><span class="s">오늘 의원 <b class="m">299</b>명에게 쌓이는 세비 · 출장·발의·표결 추적</span></span><span class="go">입장</span>`;
  let per = 160925680, n = 299;
  const won = (v) => { v = Math.floor(v); const e = Math.floor(v / 1e8), m = Math.floor((v % 1e8) / 1e4); return (e ? e.toLocaleString() + '억 ' : '') + m.toLocaleString() + '만'; };
  const num = a.querySelector('.n');
  const tick = () => { const k = new Date(Date.now() + 9 * 3600e3); const sec = k.getUTCHours() * 3600 + k.getUTCMinutes() * 60 + k.getUTCSeconds() + k.getUTCMilliseconds() / 1000; num.firstChild.textContent = won(per * n / (365 * 86400) * sec); };
  fetch('data/national/support.json').then((r) => r.json()).then((d) => { const x = (d.allowance || []).find((y) => y.amount); if (x) per = Number(x.amount); }).catch(() => {});
  const place = () => { const r = document.querySelector('#mytop .tr'); if (!r) return false; r.after(a); return true; }; // 오늘의 영수증 바로 아래
  let tries = 0; const t = setInterval(() => { if (place() || ++tries > 40) { clearInterval(t); if (!a.isConnected) { const d = document.getElementById('dive'); if (d) d.before(a); } } }, 150);
  tick(); setInterval(tick, matchMedia('(prefers-reduced-motion: reduce)').matches ? 1000 : 120);
})();
