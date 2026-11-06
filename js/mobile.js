/* 폰 가로 화면 전용: 가로 고정 안내, 전체 화면, 가로 배치. PC 배치는 건드리지 않아요. */
(function () {
  var coarse = matchMedia('(pointer:coarse)').matches;
  var small = Math.min(screen.width, screen.height) <= 540;
  if (!coarse || !small) return;
  var ios = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  document.documentElement.classList.add('mt-phone');
  var css =
    '@media (orientation:landscape) and (max-height:540px){' +
    ':root{--sw:min(272px,34vw)}' +
    '#side{gap:5px;padding:6px 8px;font-size:13px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}' +
    '#side h1{font-size:14px}#side .sub{font-size:11px}' +
    '.hero{padding:6px 8px;border-radius:10px}.hero.two .n{font-size:20px}.hero .k{font-size:11px}' +
    '.grid{grid-template-columns:repeat(3,1fr);gap:4px}.cc{padding:4px 5px}.cc .v{font-size:14px}.cc .l{font-size:10px}' +
    '.tg{gap:2px 10px;font-size:13px}.tg label{min-height:32px}' +
    '#q{height:38px;font-size:15px}#qx{height:30px}' +
    '#scnBox .scn-list,#usList{grid-template-columns:1fr}' +
    '#scnBox button,#usBox button,#hisBox button{min-height:40px;font-size:14px}' +
    '#side details,#pnote,#shipNote,#liveNote{display:none}' +
    '#card{width:var(--sw);max-height:100dvh;padding:4px}' +
    '.cin{max-height:calc(100dvh - 8px);padding:10px;border-radius:12px}' +
    '.ct{font-size:17px;margin:4px 76px 8px 0}.cg .v{font-size:18px}.cg>div{padding:5px 7px}' +
    '.cx{min-width:68px;height:44px;top:6px;right:6px}' +
    '.leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important}' +
    '.leaflet-control-attribution{font-size:9px;max-width:50vw;white-space:nowrap;overflow:hidden}' +
    '}' +
    '#mtRot,#mtGo{position:fixed;inset:0;z-index:99999;background:#020a06;color:#e8fff0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:24px}' +
    '#mtRot[hidden],#mtGo[hidden]{display:none}' +
    '#mtRot .big{font-size:28px;font-weight:800;color:#5dff9e;line-height:1.35}' +
    '#mtRot svg{width:84px;height:84px;animation:mtR 1.8s ease-in-out infinite}' +
    '@keyframes mtR{0%,30%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}' +
    '#mtRot .sm{background:none;border:1px solid #2e6b4a;color:#9effc0;border-radius:999px;padding:8px 16px;font-size:13px}' +
    '#mtGo .go{background:#5dff9e;color:#02110a;border:0;border-radius:16px;padding:18px 34px;font:800 22px system-ui,sans-serif}' +
    '#mtGo .sm{background:none;border:0;color:#9effc0;font-size:13px;text-decoration:underline}' +
    '@media (orientation:landscape){#mtRot{display:none!important}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function fix() { if (window.mtMap) setTimeout(function () { window.mtMap.invalidateSize(); }, 250); }
  addEventListener('resize', fix); addEventListener('orientationchange', fix);

  var skip = false;
  try { skip = sessionStorage.getItem('mtPortraitOk') === '1'; } catch (e) {}

  /* 세로일 때 가로로 돌리라는 안내 (iOS와 잠금 실패한 안드로이드) */
  var rot = document.createElement('div'); rot.id = 'mtRot'; rot.hidden = true;
  rot.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#5dff9e" stroke-width="1.6"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>' +
    '<div class="big">폰을 가로로<br>돌려 주세요</div><button type="button" class="sm">세로로 그냥 보기</button>';
  rot.querySelector('.sm').onclick = function () { skip = true; try { sessionStorage.setItem('mtPortraitOk', '1'); } catch (e) {} rot.hidden = true; fix(); };
  var pq = matchMedia('(orientation:portrait)');
  function upd() { rot.hidden = !(pq.matches && !skip); }
  (pq.addEventListener ? pq.addEventListener('change', upd) : pq.addListener(upd));

  /* 안드로이드: 첫 터치에 전체 화면 + 가로 잠금 */
  var canLock = !ios && screen.orientation && screen.orientation.lock && document.documentElement.requestFullscreen;
  function goLand() {
    var p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    return Promise.resolve(p).then(function () { return screen.orientation.lock('landscape'); }).then(fix, function () { upd(); });
  }
  function mount() {
    document.body.appendChild(rot);
    if (canLock && !document.fullscreenElement) {
      var go = document.createElement('div'); go.id = 'mtGo';
      go.innerHTML = '<div style="font-size:15px;opacity:.8">가로 전체 화면으로 봐요</div><button type="button" class="go">시작</button><button type="button" class="sm">그냥 보기</button>';
      go.querySelector('.go').onclick = function () { go.hidden = true; goLand(); };
      go.querySelector('.sm').onclick = function () { go.hidden = true; upd(); };
      document.body.appendChild(go);
    } else upd();
  }
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);
})();
