/* 홈 화면 앱: 서비스 워커 등록 + '앱으로 설치' 안내(안드로이드는 설치 버튼, 아이폰은 홈 화면에 추가 방법). 홈에서만 안내를 보여 준다. */
(() => {
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone || (document.body.dataset.page || '') !== 'home') return;
  let off = false; try { off = localStorage.getItem('mt.pwa.off') === '1'; } catch (e) { /* 저장 막힘 */ }
  if (off) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
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
    const at = document.querySelector('.visits') || document.getElementById('mytop');
    if (at) at.after(box); else { const m = document.querySelector('main'); if (m) m.prepend(box); }
  };
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; setTimeout(() => show('<b>앱으로 설치</b>하면 홈 화면에서 바로 열려요', true), 1500); });
  if (ios) setTimeout(() => show('<b>홈 화면에 추가</b>하면 앱처럼 바로 열려요 · Safari 아래 공유 버튼(네모에 위 화살표) → <b>홈 화면에 추가</b>', false), 2500);
  addEventListener('appinstalled', () => { box.remove(); close(); });
})();
