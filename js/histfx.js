/* 역사 재생 공통 효과: 사진 썸네일·확대, 아래쪽 시간 막대, 불꽃(공격 지점), 숫자 비례 원. 사진 목록: data/histphotos.json */
(() => {
  const css = `
.hfx-ph{display:flex;gap:8px;align-items:center;min-height:0}.hfx-ph[hidden]{display:none}
.hfx-ph button{padding:0;border:1px solid #fff4;border-radius:8px;overflow:hidden;background:#000;width:96px;height:64px;flex:none;cursor:zoom-in}
.hfx-ph img{width:100%;height:100%;object-fit:cover;display:block}.hfx-ph span{font-size:11px;opacity:.7;line-height:1.3}
#hfxLB{position:fixed;z-index:7000;left:50%;top:50%;transform:translate(-50%,-50%);max-width:min(86vw,720px);max-height:72dvh;background:#000;border:1px solid #fff6;border-radius:14px;padding:10px;box-sizing:border-box;box-shadow:0 8px 30px #000a;display:flex;flex-direction:column;gap:6px}
#hfxLB[hidden]{display:none}#hfxLB img{max-width:100%;max-height:calc(72dvh - 110px);object-fit:contain;display:block;margin:0 auto}
#hfxLB .c{color:#ddd;font:12px system-ui,sans-serif;line-height:1.35}#hfxLB .c a{color:#9effc0}
#hfxLB .x{align-self:flex-end;min-width:80px;height:52px;border-radius:12px;border:1px solid #ff8a8a;background:#3a0d0d;color:#fff;font:800 18px system-ui,sans-serif}
#hfxTL{position:fixed;z-index:3400;left:8px;right:calc(var(--sw,360px) + 16px);bottom:30px;height:40px;background:#000b;border:1px solid #fff3;border-radius:12px;padding:0 12px;box-sizing:border-box;font:600 11px system-ui,sans-serif;color:#fff}
#hfxTL[hidden]{display:none}#hfxTL .tr{position:absolute;left:44px;right:44px;top:19px;height:3px;background:#fff3;border-radius:2px}
#hfxTL .fl{position:absolute;left:0;top:0;bottom:0;background:#5dff9e;border-radius:2px;transition:width .6s}
#hfxTL .mk{position:absolute;top:-9px;width:20px;height:20px;margin-left:-10px;border:0;background:none;padding:0;cursor:pointer}
#hfxTL .mk:after{content:'';position:absolute;left:6px;top:6px;width:8px;height:8px;border-radius:50%;background:#bbb;border:1px solid #000}
#hfxTL .mk.on:after{left:2px;top:2px;width:14px;height:14px;background:#5dff9e;box-shadow:0 0 8px #5dff9e}
#hfxTL .y0,#hfxTL .y1{position:absolute;top:13px}#hfxTL .y0{left:8px}#hfxTL .y1{right:8px}
.hfx-fire{width:0;height:0}.hfx-fire i{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle,#fff6b0 0,#ffb020 35%,#ff3d00 60%,#ff3d0000 72%);animation:hfxF 1.1s ease-in-out infinite alternate}
.hfx-fire b{position:absolute;left:-22px;top:-22px;width:40px;height:40px;border-radius:50%;border:3px solid #ff7a00;animation:hfxR 1.6s ease-out infinite}
@keyframes hfxF{from{transform:scale(.75);opacity:.85}to{transform:scale(1.15);opacity:1}}@keyframes hfxR{from{transform:scale(.4);opacity:1}to{transform:scale(1.6);opacity:0}}
.hfx-nl{background:#000d;border:1px solid #ffd23f;color:#ffd23f;font:700 12px system-ui,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;transform:translate(-50%,8px)}
@media (max-width:760px) and (orientation:portrait){#hfxTL{right:8px;bottom:calc(46dvh + 6px);height:36px}#hfxTL .tr{top:17px}#hfxTL .y0,#hfxTL .y1{top:11px}.hfx-ph button{width:80px;height:54px}}
@media (orientation:landscape) and (max-height:500px){#hfxTL{bottom:22px;height:34px}#hfxTL .tr{top:15px}#hfxTL .y0,#hfxTL .y1{top:10px}body.us-on #hfxTL{right:calc(50% + 8px)}.hfx-ph button{width:72px;height:48px}}
@media (prefers-reduced-motion:reduce){.hfx-fire i,.hfx-fire b{animation:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let PH = null; const ready = fetch('data/histphotos.json').then((r) => r.json()).then((j) => (PH = j)).catch(() => (PH = {}));
  const LB = document.createElement('div'); LB.id = 'hfxLB'; LB.hidden = true; LB.innerHTML = '<button type="button" class="x">닫기</button><img alt=""><div class="c"></div>';
  const TL = document.createElement('div'); TL.id = 'hfxTL'; TL.hidden = true;
  const add = () => { document.body.append(LB, TL); }; document.body ? add() : document.addEventListener('DOMContentLoaded', add);
  LB.querySelector('.x').addEventListener('click', () => { LB.hidden = true; LB.querySelector('img').src = ''; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !LB.hidden) { LB.hidden = true; e.stopImmediatePropagation(); } }, true);
  const credit = (p) => `${esc(p.t)} · ${esc(p.lic)} · ${esc(p.by)} · <a href="${esc(p.url)}" target="_blank" rel="noopener">위키미디어 공용</a>`;
  const ms = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return Date.UTC(y, (m || 1) - 1, dd || 1); };
  let jump = null;
  window.HFX = {
    thumb(el, key, fb) { if (!el) return; el.className = 'hfx-ph'; el.hidden = true; ready.then(() => { const p = PH[key] || (fb && PH[fb]); if (!p) { el.hidden = true; el.innerHTML = ''; return; }
      el.hidden = false; el.innerHTML = `<button type="button" aria-label="사진 크게 보기"><img loading="lazy" src="${esc(p.f)}" alt="${esc(p.t)}"></button><span>당시 사진 · 누르면 커져요</span>`;
      el.querySelector('button').onclick = () => { LB.querySelector('img').src = p.f; LB.querySelector('img').alt = p.t; LB.querySelector('.c').innerHTML = credit(p); LB.hidden = false; }; }); },
    credits(el, prefix) { if (!el) return; ready.then(() => { const ks = Object.keys(PH).filter((k) => k.startsWith(prefix + ':')); el.innerHTML = ks.length ? ks.map((k) => `<li>${credit(PH[k])}</li>`).join('') : '<li>사진 없음</li>'; }); },
    tl(dates, i, onJump) { jump = onJump; const t = dates.map(ms), a = t[0], b = t[t.length - 1], sp = Math.max(1, b - a), pos = (x) => (dates.length < 2 ? 50 : ((x - a) / sp) * 100);
      if (TL.dataset.k !== dates.join()) { TL.dataset.k = dates.join();
        TL.innerHTML = `<span class="y0">${String(dates[0]).slice(0, 4)}</span><div class="tr"><div class="fl"></div>${t.map((x, k) => `<button type="button" class="mk" data-k="${k}" style="left:${pos(x)}%" aria-label="${k + 1}단계"></button>`).join('')}</div><span class="y1">${String(dates[dates.length - 1]).slice(0, 4)}</span>`;
        TL.querySelectorAll('.mk').forEach((m) => m.addEventListener('click', () => jump && jump(+m.dataset.k))); }
      TL.hidden = false; TL.querySelector('.fl').style.width = pos(t[i]) + '%'; TL.querySelectorAll('.mk').forEach((m, k) => m.classList.toggle('on', k === i)); },
    end() { TL.hidden = true; TL.dataset.k = ''; LB.hidden = true; jump = null; },
    fire(la, lo, g, pane) { L.marker([la, lo], { pane, interactive: false, keyboard: false, icon: L.divIcon({ className: 'hfx-fire', iconSize: [0, 0], html: '<b></b><i></i>' }) }).addTo(g); },
    num(la, lo, n, label, g, pane, lpane) { const r = Math.min(110, 6 + 0.055 * Math.sqrt(n));
      L.circleMarker([la, lo], { pane, radius: r, color: '#ffd23f', weight: 2, dashArray: '5 4', fillColor: '#ffd23f', fillOpacity: .18, interactive: false }).addTo(g);
      L.marker([la, lo], { pane: lpane || pane, interactive: false, icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="hfx-nl">${esc(label)}</div>` }) }).addTo(g); },
  };
})();
