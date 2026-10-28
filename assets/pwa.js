/* 홈 화면 앱: 서비스 워커 등록 + '앱으로 설치' 안내(안드로이드는 설치 버튼, 아이폰은 홈 화면에 추가 방법). 홈에서만 안내를 보여 준다. */
(() => {
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone || (document.body.dataset.page || '') !== 'home') return;
  let off = false; try { off = localStorage.getItem('mt.pwa.off') === '1'; } catch (e) { /* 저장 막힘 */ }
  if (off) return;
  let seen = 0; try { seen = Number(localStorage.getItem('mt.pwa.n') || 0) + 1; localStorage.setItem('mt.pwa.n', String(seen)); } catch (e) { /* 무시 */ }
  if (seen < 2) return; // 처음 온 사람에겐 설치부터 권하지 않는다
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|Twitter|TwitterAndroid|DaumApps|everytimeApp/i.test(ua); // 앱 안 브라우저(여기선 홈 화면 추가가 없음)
  const iosHow = inApp ? '<b>지금은 앱 안 화면</b>이라 홈 화면 추가가 안 돼요 · 오른쪽 아래 <b>…</b> 또는 나침반 아이콘 → <b>Safari로 열기</b> 뒤 공유 버튼 → 홈 화면에 추가'
    : /crios/i.test(ua) ? '<b>홈 화면에 추가</b>하면 앱처럼 열려요 · 주소창 오른쪽 <b>공유 버튼</b> → 목록을 내려 <b>홈 화면에 추가</b> (이 안내는 눌러도 설치되지 않아요)'
    : '<b>홈 화면에 추가</b>하면 앱처럼 열려요 · 화면 맨 아래 가운데 <b>공유 버튼</b>(네모에 위 화살표) → 목록을 내려 <b>홈 화면에 추가</b> (이 안내는 눌러도 설치되지 않아요)';
  let deferred = null;
  const css = document.createElement('style');
  css.textContent = `.pwa{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:10px 12px;border-radius:14px;background:#101a14;border:1px solid #24432f;font-size:13.5px;line-height:1.45;color:#cfe9d8}
.pwa img{width:36px;height:36px;border-radius:9px;flex:none}.pwa .t{flex:1 1 auto;min-width:0}.pwa b{color:#fff}
.pwa button{font:700 13px Pretendard,system-ui,sans-serif;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid #2f6b44;background:#1f8a4c;color:#fff;cursor:pointer;flex:none}
.pwa button.x{background:transparent;border-color:transparent;color:#8fa0b3;padding:0 6px;min-width:36px;font-size:18px}`;
  document.head.append(css);
  const box = document.createElement('div'); box.className = 'pwa'; box.setAttribute('role', 'note');
  const close = () => { box.remove(); try { localStorage.setItem('mt.pwa.off', '1'); } catch (e) { /* 무시 */ } };
  const show = (html, btn) => {
    box.innerHTML = `<img src="assets/icons/radar2-192.png" alt=""><span class="t">${html}</span>${btn ? '<button type="button" class="go">설치</button>' : ''}<button type="button" class="x" aria-label="닫기">×</button>`;
    box.querySelector('.x').onclick = close;
    const go = box.querySelector('.go'); if (go) go.onclick = async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (e) { /* 무시 */ } deferred = null; box.remove(); };
    box.classList.add('below-map');
    const at = document.querySelector('.visits') || document.getElementById('mytop');
    if (at) at.after(box); else { const m = document.querySelector('main'); if (m) m.prepend(box); }
  };
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; setTimeout(() => show('<b>앱으로 설치</b>하면 홈 화면에서 바로 열려요', true), 1500); });
  if (ios) setTimeout(() => show(iosHow, false), 2500);
  addEventListener('appinstalled', () => { box.remove(); close(); });
})();
