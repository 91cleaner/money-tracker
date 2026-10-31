/* 홈 맨 위: 오늘의 영수증 한 장 + 우리 시(이 휴대폰에 기억). 사람들이 매일 다시 오게 하는 칸.
   우리 시는 이 기기 브라우저에만 저장한다(서버로 보내지 않음). */
(() => {
  if ((document.body.dataset.page || '') !== 'home') return;
  const main = document.querySelector('main'); if (!main) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const won = (n) => { n = Math.round(Number(n) || 0); if (n >= 1e12) { const j = Math.floor(n / 1e12), e = Math.round((n % 1e12) / 1e8); return j.toLocaleString('ko-KR') + '조' + (e ? ' ' + e.toLocaleString('ko-KR') + '억' : '') + '원'; }
    if (n >= 1e8) return (n >= 1e10 ? Math.round(n / 1e8).toLocaleString('ko-KR') : (n / 1e8).toFixed(1).replace(/\.0$/, '')) + '억원'; return Math.round(n / 1e4).toLocaleString('ko-KR') + '만원'; };
  const md = (s) => (s ? `${+String(s).slice(5, 7)}월 ${+String(s).slice(8, 10)}일` : '');
  const josa = (w) => { const c = String(w).slice(-1).charCodeAt(0) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? '을' : '를'; };
  const mask = (s) => (typeof window.maskT === 'function' ? window.maskT(String(s || '')) : String(s || ''));
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('mt.my') || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('mt.my', JSON.stringify(v)); } catch (e) { /* 저장이 막힌 브라우저는 이번 방문에만 */ } },
  };
  const css = document.createElement('style');
  css.textContent = `#mytop{display:grid;gap:8px;margin:0 0 12px}
#mytop .tr{background:#121820;border:1px solid #2a3541;border-radius:14px;padding:12px 14px;display:grid;gap:4px}
#mytop .tr-h{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;color:#ffb020;font-weight:800}
#mytop .tr-h span{color:#9aa6b2;font-weight:500}
#mytop .tr-a{font-size:24px;font-weight:800;line-height:1.2;color:#f4f7fb}
#mytop .tr-a small{font-size:15px;color:#c9d3dd;font-weight:700;margin-left:6px}
#mytop .tr-t{font-size:14px;color:#d6dde4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#mytop .tr-s{font-size:12.5px;color:#9aa6b2}
#mytop .tr-b{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
#mytop .tr-b a,#mytop .tr-b button,#mytop .my button{font:700 13px Pretendard,system-ui,sans-serif;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid #2a3541;background:#0f141b;color:#e8edf2;text-decoration:none;display:inline-flex;align-items:center;cursor:pointer}
#mytop .tr-nav{display:inline-flex;align-items:center;gap:6px}#mytop .tr-nav button{font:700 18px/1 system-ui;width:36px;height:36px;border-radius:50%;border:1px solid #2a3541;background:#0f141b;color:#e8edf2;cursor:pointer}#mytop .tr-nav button:disabled{opacity:.3;cursor:default}
#mytop .my{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#0f1a2a;border:1px solid #1f3a5f;border-radius:14px;padding:10px 12px;font-size:14px}
#mytop .my b{color:#fff}#mytop .my .nw{color:#ffb020;font-weight:800}
#mytop .my .sp{flex:1 1 auto}
#mytop .my button.go{background:#0a84ff;border-color:#0a84ff}`;
  document.head.append(css);
  const box = document.createElement('section'); box.id = 'mytop'; box.setAttribute('aria-label', '오늘의 영수증과 우리 시');
  const dive = document.getElementById('dive'); (dive || main.firstChild) ? main.insertBefore(box, dive || main.firstChild) : main.append(box);
  const get = (u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  Promise.all([get('data/today.json'), get('data/index.json'), get('data/daily.json')]).then(([td, idx, daily]) => {
    const items = ((td && td.items) || []).filter((it) => it.n >= 20); // 주말·공휴일처럼 계약이 몇 건 없는 날은 건너뜀
    let k = 0;
    const rcpt = document.createElement('div'); rcpt.className = 'tr';
    const myRow = document.createElement('div'); myRow.className = 'my';
    box.append(rcpt, myRow);

    // 오늘의 영수증
    const paintR = () => {
      const it = items[k]; if (!it) { rcpt.hidden = true; return; }
      const p = it.pick;
      rcpt.innerHTML = `<div class="tr-h">${k === 0 ? '오늘의 영수증' : '지난 영수증'} <span class="tr-nav"><button type="button" data-d="1" aria-label="전날 영수증" ${k >= items.length - 1 ? 'disabled' : ''}>‹</button>${md(it.date)}<button type="button" data-d="-1" aria-label="다음 영수증" ${k === 0 ? 'disabled' : ''}>›</button></span></div>
        <div class="tr-a">${esc(won(p.amount))}<small>${esc(p.cname)}</small></div>
        <div class="tr-t">${esc(mask(p.title))}</div>
        <div class="tr-s">${esc(mask(p.vendor || ''))}${p.vregion ? ' · ' + esc(String(p.vregion).split(' ').slice(0, 2).join(' ')) : ''} · ${p.ann === false ? '공고 없이 계약' : p.ann ? '미리 알림' : esc(p.method || '')} · 그날 85개 시 계약 ${Number(it.n).toLocaleString('ko-KR')}건 중 가장 큰 금액</div>
        <div class="tr-b">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">나라장터 원문 ↗</a>` : ''}<a href="city.html?c=${esc(p.slug)}">${esc(p.cname)} 보기</a></div>`;
      rcpt.querySelectorAll('button[data-d]').forEach((b) => b.onclick = () => { k = Math.max(0, Math.min(items.length - 1, k + Number(b.dataset.d))); paintR(); });
    };
    paintR();

    // 우리 시
    const cities = (idx && idx.cities) || [];
    const byS = Object.fromEntries(cities.map((c) => [c.slug, c]));
    const newSince = (slug, since) => { const m = (daily && daily.c && daily.c[slug]) || {}; let n = 0; for (const d in m) if (!since || d > since) n += m[d][0]; return n; };
    const goCity = (slug) => {
      if (window.__dvGo) { window.__dvGo({ c: slug }); const dv = document.getElementById('dive'); if (dv) dv.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else location.href = './?c=' + encodeURIComponent(slug) + '#map';
    };
    const choose = (cur) => { if (!window.regionPicker) { location.href = 'city.html'; return; } window.regionPicker(cur || null, (s) => { save(s); paintMy(); goCity(s); }); };
    const save = (slug) => { const c = byS[slug]; store.set({ slug, seen: (daily && daily.last) || '', alerts: (c && c.alerts) || 0 }); };
    let lastSeen = null;
    const paintMy = () => {
      const my = store.get(); const c = my && byS[my.slug];
      if (!c) {
        myRow.innerHTML = `● <span class="sp">우리 시를 정해 두면 다음부터 열자마자 보여요</span><button type="button" class="go" data-a="pick">우리 시 고르기</button>`;
      } else {
        const fresh = lastSeen ? newSince(c.slug, lastSeen.seen) : 0;
        const na = lastSeen ? Math.max(0, (c.alerts || 0) - (lastSeen.alerts || 0)) : 0;
        const news = lastSeen && lastSeen.seen && lastSeen.seen < ((daily && daily.last) || '') ? `<span class="nw">지난번 뒤 새 계약 ${fresh.toLocaleString('ko-KR')}건${na ? ` · 새 이상 징후 ${na}건` : ''}</span>` : `<span>오늘 새 계약 ${Number(c.today || 0).toLocaleString('ko-KR')}건</span>`;
        myRow.innerHTML = `● <b>${esc(c.short || c.name)}</b><span class="sp">${news}</span><button type="button" class="go" data-a="go">우리 시 보기</button><button type="button" data-a="pick">바꾸기</button>`;
      }
      myRow.querySelectorAll('button').forEach((b) => b.onclick = () => { const m = store.get(); if (b.dataset.a === 'go' && m) goCity(m.slug); else choose(m && m.slug); });
    };
    lastSeen = store.get();
    paintMy();
    // 우리 시가 있으면 열자마자 그 시로(주소에 다른 시·칸이 없을 때만)
    if (lastSeen && byS[lastSeen.slug] && !location.search && !location.hash) {
      let tries = 0; const t = setInterval(() => { if (window.__dvGo || ++tries > 40) { clearInterval(t); if (window.__dvGo) window.__dvGo({ c: lastSeen.slug }, true); } }, 150);
    }
    // 이번 방문을 '본 것'으로 기록(새 소식 숫자는 다음 방문 때 다시 셈)
    if (lastSeen && byS[lastSeen.slug]) setTimeout(() => save(lastSeen.slug), 4000);
    // 우리 시가 없고 지도에서 시를 고르면 바로 '우리 시로 정하기'를 권한다
    addEventListener('dv:go', (e) => {
      const s = e.detail && e.detail.c; if (!s || store.get() || !byS[s]) return;
      myRow.innerHTML = `● <span class="sp">방금 본 <b>${esc(byS[s].short || byS[s].name)}</b>${josa(byS[s].short || byS[s].name)} 우리 시로 정할까요?</span><button type="button" class="go" data-a="set">우리 시로 정하기</button>`;
      myRow.querySelector('button').onclick = () => { save(s); lastSeen = store.get(); paintMy(); };
    });
  });
})();
