/* 정부 지출 '국회 돈 추적실': 화면 전체가 지도인 게임 화면.
   아래 도구 칸(1~5)을 바꿔 끼우면 지도가 바뀐다. 의원을 누르면 공식 사진이 들어간 '기록 파일'이 열리고, 다녀온 나라로 비행 경로가 그려진다.
   공개 기록을 보기 쉽게 모은 것일 뿐, 잘잘못을 따지지 않는다(문구도 그렇게 쓴다). */
(async () => {
  const root = document.getElementById('pg'); if (!root || !window.L) return;
  const D = 'data/national/';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const j = (f) => fetch(D + f, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const won = (n) => { n = Math.round(Number(n) || 0); const jo = Math.floor(n / 1e12), e = Math.floor((n % 1e12) / 1e8), m = Math.floor((n % 1e8) / 1e4); if (jo) return jo.toLocaleString('ko-KR') + '조 ' + e.toLocaleString('ko-KR') + '억원'; if (e) return e.toLocaleString('ko-KR') + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만' : '') + '원'; return m.toLocaleString('ko-KR') + '만원'; };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SE = [37.5319, 126.914]; // 국회
  const PC = { 더불어민주당: '#2f7bff', 국민의힘: '#ff3b47', 조국혁신당: '#1a5fd0', 개혁신당: '#ff8a1f', 진보당: '#e0284f', 기본소득당: '#00c2b0', 사회민주당: '#ffa31a', 무소속: '#9aa6b2' };
  const pc = (p) => PC[p] || '#b9c4cf';
  const C = { 일본: [35.7, 139.7], 중국: [39.9, 116.4], 미국: [38.9, 282.96], 영국: [51.5, -0.1], 독일: [52.5, 13.4], 베트남: [21, 105.8], 호주: [-35.3, 149.1], 인도: [28.6, 77.2], 싱가포르: [1.35, 103.8], 우즈베키스탄: [41.3, 69.2], 필리핀: [14.6, 121], 튀르키예: [39.9, 32.9], 체코: [50.1, 14.4], 인도네시아: [-6.2, 106.8], 말레이시아: [3.1, 101.7], 홍콩: [22.3, 114.2], 오스트리아: [48.2, 16.4], 캄보디아: [11.6, 104.9], 아랍에미리트: [24.5, 54.4], 우간다: [0.3, 32.6], 브라질: [-15.8, 312.1], 헝가리: [47.5, 19], 볼리비아: [-16.5, 291.9], 스위스: [46.9, 7.4], 태국: [13.8, 100.5], 대만: [25, 121.5], 벨기에: [50.8, 4.4], 폴란드: [52.2, 21], 캐나다: [45.4, 284.3], 이탈리아: [41.9, 12.5], 덴마크: [55.7, 12.6], 멕시코: [19.4, 260.9], 이집트: [30, 31.2], 몽골: [47.9, 106.9], 칠레: [-33.4, 289.4], 라오스: [18, 102.6], 프랑스: [48.9, 2.35] };
  const cname = (d) => (d === '오스크리아' ? '오스트리아' : d);
  const FG = /정부|대사관|국무부|정보방송부|감숙성|란저우|연방|인민대외우호협회|사회과학원/, SELF = /자비|자부담/, PUB = /외교부|국회미래연구원|국가지식재산위원회|한국국제교류재단|국회사무처/, PTY = /정당|더불어민주당|국민의힘/;
  const extF = (f) => { f = String(f || ''); return FG.test(f) || f.split(/[,/·]/).some((x) => x.trim() && !SELF.test(x) && !PUB.test(x) && !PTY.test(x)); };

  // ── 화면 뼈대 ──
  const css = document.createElement('style');
  css.textContent = `
#pg{position:relative;height:calc(100dvh - 112px);min-height:460px;margin:0 calc(50% - 50vw);width:100vw;background:#020805;overflow:hidden;font-family:Pretendard,system-ui,sans-serif;color:#cfe9d8}
@media(min-width:900px){#pg{height:calc(100dvh - 120px)}}
#pg .pg-map{position:absolute;inset:0;background:#020805}
#pg .leaflet-container{background:#020805;font-family:inherit}
#pg .leaflet-tile-pane{filter:sepia(1) hue-rotate(80deg) saturate(.9) brightness(.55) contrast(1.15)}
#pg .pg-scan{position:absolute;inset:0;pointer-events:none;z-index:500;background:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0 2px,rgba(0,0,0,.18) 2px 3px),radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.65) 100%)}
#pg .pg-top{position:absolute;z-index:700;left:8px;right:8px;top:8px;display:flex;justify-content:space-between;gap:8px;align-items:flex-start;pointer-events:none}
#pg .pg-box{pointer-events:auto;background:rgba(3,14,8,.82);border:1px solid #1d5a35;border-radius:10px;padding:6px 10px;box-shadow:0 0 18px rgba(40,255,140,.08) inset;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
#pg .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.02em}
#pg .live{font:700 11px ui-monospace,Menlo,monospace;color:#5dff9e}#pg .live i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff3b47;margin-right:5px;animation:pgBlink 1s steps(2) infinite;vertical-align:0}
@keyframes pgBlink{50%{opacity:.15}}
#pg .ttl{font:800 14px Pretendard,system-ui;color:#e8fff1;letter-spacing:.04em;display:flex;align-items:center;gap:6px}#pg .snd{width:30px;height:30px;border-radius:50%;border:0;background:rgba(93,255,158,.08);color:#cfe9d8;cursor:pointer;padding:0;display:grid;place-items:center;transition:background .15s}#pg .snd:hover{background:rgba(93,255,158,.16)}#pg .snd.off{color:#5f7d6c}#pg .snd.off .w{display:none}#pg .snd.off .m{display:inline!important}
#pg .ctr{text-align:right}#pg .ctr .n{font:800 17px ui-monospace,Menlo,monospace;color:#ffb020;font-variant-numeric:tabular-nums}#pg .ctr .l{font-size:10.5px;color:#8fc9a5}
#pg .pg-say{position:absolute;z-index:700;left:10px;right:10px;top:74px;font:600 12px ui-monospace,Menlo,monospace;color:#7dffb0;text-shadow:0 0 6px rgba(80,255,160,.5);pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pg .pg-bar{position:absolute;z-index:720;left:50%;transform:translateX(-50%);bottom:12px;display:flex;gap:2px;padding:5px;background:linear-gradient(180deg,rgba(14,32,22,.72),rgba(4,14,9,.86));-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);border:1px solid rgba(93,255,158,.18);border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.06);max-width:calc(100% - 16px)}
#pg .pg-bar button{position:relative;width:64px;height:56px;border-radius:15px;border:0;background:transparent;color:#86b89a;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0;font:600 10.5px Pretendard,system-ui;letter-spacing:-.01em;transition:color .18s,background .18s,transform .12s;-webkit-tap-highlight-color:transparent}
#pg .pg-bar button:hover{color:#d9f7e5;background:rgba(93,255,158,.06)}#pg .pg-bar button:active{transform:scale(.93)}
#pg .pg-bar .ic{width:24px;height:24px;display:block}#pg .pg-bar .ic svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;overflow:visible;transition:filter .18s}
#pg .pg-bar .ic .fillp{fill:currentColor;opacity:.22}#pg .pg-bar .ic .dot{fill:currentColor}
#pg .pg-bar .badge .pet ellipse{fill:rgba(255,200,90,.14);stroke:#e7b85a;stroke-width:1.1}#pg .pg-bar .badge circle{stroke:#e7b85a}#pg .pg-bar .badge .core{fill:#e7b85a;stroke:none}
#pg .pg-bar button .k{position:absolute;right:7px;top:5px;font:600 8.5px ui-monospace,Menlo,monospace;color:#3f6b52;opacity:.0;transition:opacity .2s}@media(hover:hover){#pg .pg-bar:hover button .k{opacity:1}}
#pg .pg-bar button[aria-pressed="true"]{color:#eafff2;background:linear-gradient(180deg,rgba(93,255,158,.16),rgba(93,255,158,.05));box-shadow:inset 0 0 0 1px rgba(93,255,158,.35)}
#pg .pg-bar button[aria-pressed="true"] .ic svg{filter:drop-shadow(0 0 5px rgba(93,255,158,.75))}#pg .pg-bar button[aria-pressed="true"] .badge{filter:drop-shadow(0 0 6px rgba(255,200,90,.8))!important}
#pg .pg-bar button[aria-pressed="true"]::after{content:"";position:absolute;bottom:3px;left:50%;width:16px;height:3px;margin-left:-8px;border-radius:2px;background:#5dff9e;box-shadow:0 0 8px #5dff9e}
#pg .pg-bar button[data-w="radar"][aria-pressed="true"] .ic svg{animation:pgSpin 3s linear infinite}@keyframes pgSpin{to{transform:rotate(360deg)}}
@media(max-width:600px){#pg .pg-bar{gap:0;padding:4px;bottom:calc(10px + env(safe-area-inset-bottom,0px))}#pg .pg-bar button{width:54px;height:54px;font-size:10px}#pg .pg-bar .ic{width:22px;height:22px}}@media(max-width:360px){#pg .pg-bar button{width:48px}}
@media(prefers-reduced-motion:reduce){#pg .pg-bar button[data-w="radar"] .ic svg{animation:none!important}}
#pg .pg-file{position:absolute;z-index:740;left:8px;right:8px;bottom:84px;max-height:58%;overflow:auto;background:rgba(2,10,6,.95);border:1px solid #2a7a4a;border-radius:12px;padding:12px 12px 10px;box-shadow:0 0 0 1px rgba(93,255,158,.08),0 10px 40px rgba(0,0,0,.6);transform:translateY(10px);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
#pg .pg-file.on{opacity:1;transform:none;pointer-events:auto}
@media(min-width:900px){#pg .pg-file{left:auto;right:12px;top:110px;bottom:84px;width:380px;max-height:none}}
@media(max-width:899px){#pg .pg-file{max-height:44%;padding:10px}#pg .who{grid-template-columns:64px 1fr;gap:10px}#pg .ph{width:64px;height:80px}#pg .nm{font-size:19px}#pg .st{margin:8px 0}#pg .st b{font-size:16px}#pg .st span{font-size:10.5px}#pg .ttl{font-size:13px}#pg .ctr .n{font-size:15px}#pg .live{font-size:10px}}
@media(min-width:900px){#pg.fileon .pg-map{right:404px}#pg.fileon .pg-bar{left:calc((100% - 404px)/2)}}
#pg .pg-file.min{max-height:52px!important;overflow:hidden;bottom:84px;top:auto!important}
#pg .pg-file.min .fh .mn{transform:rotate(180deg)}
#pg .fh .tools{display:flex;gap:6px}
#pg .fh{display:flex;justify-content:space-between;align-items:center;font:700 11px ui-monospace,Menlo,monospace;color:#5dff9e;margin-bottom:8px}
#pg .fh button{min-width:36px;min-height:36px;border-radius:8px;border:1px solid #1f4a30;background:#06150c;color:#cfe9d8;font-size:16px;cursor:pointer}
#pg .who{display:grid;grid-template-columns:86px 1fr;gap:12px;align-items:center}
#pg .ph{position:relative;width:86px;height:108px;border-radius:6px;overflow:hidden;border:1px solid #2a7a4a;background:#06150c}
#pg .ph img{width:100%;height:100%;object-fit:cover;filter:grayscale(.85) sepia(.35) hue-rotate(70deg) contrast(1.1) brightness(.95)}
#pg .ph::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0 2px,rgba(0,0,0,.22) 2px 3px)}
#pg .ph .ini{position:absolute;inset:0;display:grid;place-items:center;font:800 30px Pretendard;color:#5dff9e}
#pg .ph .scanl{position:absolute;left:0;right:0;height:18px;background:linear-gradient(180deg,rgba(93,255,158,0),rgba(93,255,158,.45),rgba(93,255,158,0));animation:pgScan 1.6s linear 2;z-index:1}
@keyframes pgScan{from{top:-18px}to{top:108px}}
#pg .nm{font:800 22px Pretendard;color:#fff;line-height:1.2}#pg .pt{display:inline-block;margin:4px 0;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:800;color:#fff}
#pg .ds{font-size:12.5px;color:#9fd3b4;line-height:1.45}
#pg .st{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}
#pg .st div{background:#06150c;border:1px solid #1f4a30;border-radius:8px;padding:6px 8px}#pg .st b{display:block;font:800 18px ui-monospace,Menlo,monospace;color:#ffb020}#pg .st span{font-size:11px;color:#8fc9a5}
#pg .st .z b{color:#5dff9e}
#pg .tr{padding:8px 0;border-top:1px dashed #1f4a30;font-size:13px;line-height:1.45}#pg .tr .d{font:700 12px ui-monospace,Menlo,monospace;color:#7dffb0}#pg .tr .f{font-size:12px;color:#ffd27a}
#pg .tr .p{color:#cfe9d8}#pg .tg{display:inline-block;font-size:11px;padding:0 6px;border-radius:999px;border:1px solid #2a7a4a;color:#9fd3b4;margin:2px 4px 0 0}
#pg .tg.y{border-color:#ffb02088;color:#ffd27a}
#pg .tabs{display:flex;gap:2px;margin:10px 0 2px;padding:3px;border-radius:11px;background:rgba(93,255,158,.05);border:1px solid rgba(93,255,158,.12);overflow-x:auto;scrollbar-width:none}#pg .tabs::-webkit-scrollbar{display:none}#pg .tabs button{flex:1 0 auto;min-height:36px;padding:0 10px;border-radius:8px;border:0;background:transparent;color:#86b89a;font:700 12.5px Pretendard,system-ui,sans-serif;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s}
#pg .tabs button.on{background:rgba(93,255,158,.16);color:#eafff2;box-shadow:inset 0 0 0 1px rgba(93,255,158,.4)}#pg .tabs button i{font-style:normal;opacity:.7;margin-left:3px;font-weight:600}
#pg .vt{display:inline-block;min-width:38px;text-align:center;font:800 11.5px Pretendard,system-ui,sans-serif;padding:1px 6px;border-radius:6px;margin-right:6px}#pg .vt.Y{background:#0f3b23;color:#7dffb0}#pg .vt.N{background:#3b1414;color:#ff9b9b}#pg .vt.A{background:#3a2c0b;color:#ffd27a}#pg .vt.X{background:#1b2420;color:#8fa79a}
#pg .vsum{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:8px 0}#pg .vsum div{background:#04140b;border:1px solid #1f4a30;border-radius:8px;padding:6px;text-align:center;font-size:11px;color:#8fc9a5}#pg .vsum b{display:block;font-size:17px;color:#e8fff1}
#pg .allb{width:100%;min-height:42px;margin-top:10px;border-radius:10px;border:1px solid rgba(93,255,158,.3);background:rgba(93,255,158,.08);color:#eafff2;font:700 13px Pretendard,system-ui,sans-serif;cursor:pointer}#pg .fl{display:flex;gap:4px;margin:0 0 6px}#pg .fl button{min-height:32px;padding:0 11px;border-radius:999px;border:1px solid #1f4a30;background:transparent;color:#86b89a;font:700 12px Pretendard,system-ui,sans-serif;cursor:pointer}#pg .fl button.on{background:rgba(93,255,158,.16);color:#eafff2;border-color:rgba(93,255,158,.4)}#pg .st4{grid-template-columns:repeat(4,1fr)}#pg .st4 b{color:#eafff2}#pg .st4 span{font-size:10.5px}
#pg .ph2{font:800 11.5px Pretendard,system-ui,sans-serif;color:#5dff9e;letter-spacing:.04em;margin:12px 0 4px}#pg .pl{font-size:13px;color:#cfe9d8;line-height:1.5;padding:2px 0}
#pg .lk a span{margin-left:auto;font-size:11px;color:#8fc9a5;text-align:right}
#pg .fh .fol{font-size:18px;color:#ffc94a}#pg .fh .fol.on{background:rgba(255,201,74,.14);border-color:rgba(255,201,74,.5)}
#pg .rate{display:flex;align-items:center;gap:10px}#pg .rate b{font:800 22px Pretendard,system-ui,sans-serif;color:#eafff2;font-variant-numeric:tabular-nums}#pg .rate .bar{flex:1;height:8px;border-radius:4px;background:#0b2416;overflow:hidden}#pg .rate .bar i{display:block;height:100%;background:linear-gradient(90deg,#2a9f5f,#5dff9e)}
#pg .seg{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:0 0 8px}#pg .seg::-webkit-scrollbar{display:none}#pg .seg button{flex:none;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid #1f4a30;background:transparent;color:#86b89a;font:700 12.5px Pretendard,system-ui,sans-serif;cursor:pointer}#pg .seg button.on{background:#5dff9e;color:#02110a;border-color:#5dff9e}
#pg .ord{display:flex;gap:4px;margin:0 0 4px;justify-content:flex-end}#pg .ord button{min-height:28px;padding:0 10px;border-radius:8px;border:0;background:transparent;color:#6fae88;font:700 11.5px Pretendard,system-ui,sans-serif;cursor:pointer}#pg .ord button.on{color:#eafff2;background:rgba(93,255,158,.12)}
#pg .rk{display:inline-block;min-width:20px;margin-right:6px;color:#5dff9e;font-size:11px}
#pg .vs{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin:4px 0 10px}#pg .vp{display:grid;justify-items:center;text-align:center;gap:2px;min-width:0}#pg .vp img,#pg .vp .ini{width:64px;height:80px;border-radius:8px;object-fit:cover;border:1px solid #2a7a4a;filter:grayscale(.6) sepia(.25) hue-rotate(70deg);display:grid;place-items:center;font:800 24px Pretendard;color:#5dff9e;background:#06150c}
#pg .vp b{font-size:16px;color:#fff}#pg .vp span{font-size:11.5px;font-weight:800}#pg .vp small{font-size:11px;color:#8fc9a5;overflow-wrap:anywhere}#pg .vx{font:900 20px ui-monospace,Menlo,monospace;color:#ffb020;text-shadow:0 0 12px rgba(255,176,32,.6)}
#pg .vr{display:grid;grid-template-columns:1fr 64px 1fr;align-items:center;gap:6px;padding:7px 0;border-top:1px solid #12301f}#pg .vr>span{text-align:center;font-size:11.5px;color:#8fc9a5}#pg .vr .l,#pg .vr .r{display:flex;align-items:center;gap:6px}#pg .vr .l{justify-content:flex-end}#pg .vr i{display:block;height:6px;border-radius:3px;background:#5dff9e;min-width:2px;max-width:60%}#pg .vr .r i{background:#ffb020}#pg .vr b{font:800 14px Pretendard,system-ui,sans-serif;color:#eafff2;font-variant-numeric:tabular-nums;white-space:nowrap}
#pg .pg-news{position:absolute;z-index:716;left:50%;transform:translateX(-50%);top:100px;max-width:calc(100% - 24px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,201,74,.5);background:rgba(30,22,4,.85);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#ffe7a8;font:700 13px Pretendard,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4)}#pg .pg-news b{color:#ffc94a}#pg .pg-news span{opacity:.7}
#pg .satb{position:absolute;z-index:705;left:12px;top:104px;font:700 10.5px ui-monospace,Menlo,monospace;color:#5dff9e;letter-spacing:.08em;padding:3px 8px;border-radius:6px;background:rgba(2,12,6,.7);border:1px solid rgba(93,255,158,.3);opacity:0;transition:opacity .4s;pointer-events:none}#pg .satb i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#5dff9e;margin-right:6px;box-shadow:0 0 6px #5dff9e}#pg.sat .satb{opacity:1}
#pg .usflag{position:absolute;z-index:715;left:12px;bottom:84px;display:flex;align-items:center;height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(93,255,158,.22);background:rgba(4,18,10,.82);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);font:700 13px Pretendard,system-ui,sans-serif;color:#cfe9d8;text-decoration:none;box-shadow:0 6px 24px rgba(0,0,0,.45);transition:opacity .2s}#pg .usflag:hover{color:#fff;border-color:rgba(93,255,158,.5)}@media(max-width:899px){#pg.fileon .usflag{opacity:0;pointer-events:none}}
#pg .tr a{color:#7fe8ff}#pg .lk{display:grid;gap:6px;margin-top:8px}#pg .lk a{display:flex;gap:8px;align-items:center;min-height:42px;padding:0 12px;border-radius:8px;border:1px solid #1f4a30;color:#cfe9d8;text-decoration:none;font-size:13px}
#pg .act{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}#pg .act a,#pg .act button{font:700 12.5px Pretendard;min-height:34px;padding:0 10px;border-radius:8px;border:1px solid #2a7a4a;background:#06150c;color:#cfe9d8;text-decoration:none;display:inline-flex;align-items:center;cursor:pointer}
#pg .act .p{background:#5dff9e;color:#02110a;border-color:#5dff9e}
#pg .fine{font-size:11px;color:#6fae88;margin-top:8px;line-height:1.45}#pg .fine a{color:#8fc9a5}
#pg .li{display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid #12301f;cursor:pointer}#pg .li:hover{background:#071a0f}
#pg .li img,#pg .li .av{width:30px;height:38px;border-radius:4px;object-fit:cover;filter:grayscale(.8) sepia(.3) hue-rotate(70deg);flex:none;background:#06150c;border:1px solid #1f4a30;display:grid;place-items:center;font:800 13px Pretendard;color:#5dff9e}
#pg .li .t{flex:1;min-width:0}#pg .li .t b{color:#fff}#pg .li .t div{font-size:11.5px;color:#8fc9a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pg .li .r{font:800 13px ui-monospace,Menlo,monospace;color:#ffb020;white-space:nowrap}
#pg .q{width:100%;font:700 16px Pretendard;color:#e8fff1;background:#06150c;border:1px solid #2a7a4a;border-radius:8px;padding:10px 12px;margin:2px 0 6px}
#pg .pb{margin:6px 0}#pg .pb .h{display:flex;justify-content:space-between;font-size:13px}#pg .pb .h b{font-family:ui-monospace,Menlo,monospace;color:#ffb020}#pg .pb .tk{height:8px;border-radius:4px;background:#06150c;overflow:hidden;margin-top:3px}#pg .pb .tk i{display:block;height:100%}
#pg .reticle{pointer-events:none}#pg .reticle svg{animation:pgLock .9s ease-out both}
@keyframes pgLock{from{transform:scale(2.6) rotate(45deg);opacity:0}to{transform:none;opacity:1}}
#pg .plane{font-size:18px;filter:drop-shadow(0 0 4px #ffb020);pointer-events:none}
#pg .clab{background:rgba(3,14,8,.85)!important;border:1px solid #1d5a35!important;color:#cfe9d8!important;font:700 11px Pretendard!important;padding:1px 6px!important;border-radius:6px!important;box-shadow:none!important}
#pg .clab::before{display:none}
#pg .mtag{background:rgba(3,14,8,.9)!important;border:1px solid #5dff9e!important;color:#e8fff1!important;font:800 12px Pretendard!important;padding:2px 7px!important;border-radius:6px!important;box-shadow:0 0 12px rgba(93,255,158,.3)!important}
#pg .mtag::before{display:none}
#pg .leaflet-control-attribution{background:transparent!important;color:#4f6f5d!important;font-size:9px!important;text-shadow:0 0 3px #000}#pg .leaflet-control-attribution a{color:#4f6f5d!important}
#pg .pg-dice{position:absolute;z-index:715;right:12px;bottom:84px;display:flex;align-items:center;gap:7px;height:40px;padding:0 15px 0 12px;border-radius:999px;border:1px solid rgba(93,255,158,.3);background:rgba(4,18,10,.82);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#eafff2;font:700 13px Pretendard,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 0 0 rgba(93,255,158,.5);animation:pgPulse 2.4s ease-out 3;transition:transform .12s,opacity .2s}
#pg .pg-dice:active{transform:scale(.94)}#pg .pg-dice svg{width:18px;height:18px;fill:none;stroke:#5dff9e;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}#pg .pg-dice.spin svg{animation:pgSpin .5s linear infinite}
@keyframes pgPulse{0%{box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 0 0 rgba(93,255,158,.45)}70%,100%{box-shadow:0 6px 24px rgba(0,0,0,.45),0 0 0 14px rgba(93,255,158,0)}}
@media(max-width:899px){#pg.fileon .pg-dice{opacity:0;pointer-events:none}}@media(min-width:900px){#pg.fileon .pg-dice{right:416px}}
#pg .pg-hint{position:absolute;z-index:700;left:50%;transform:translateX(-50%);bottom:134px;font:700 12px Pretendard;color:#02110a;background:#5dff9e;border-radius:999px;padding:4px 12px;white-space:nowrap;animation:pgBlink 1.4s ease-in-out 4}
`;
  document.head.append(css);
  root.innerHTML = `<div class="pg-map" aria-label="국회의원 지도"></div><div class="pg-scan"></div>
  <div class="pg-top"><div class="pg-box"><div class="live"><i></i>LIVE <span class="mono clk"></span></div><div class="ttl">국회 돈 추적실 <button type="button" class="snd" aria-label="소리 켜기·끄기"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="w" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="m" d="m16 9.5 5 5m0-5-5 5" style="display:none"/></svg></button></div></div>
  <div class="pg-box ctr"><div class="n mono">0원</div><div class="l">오늘 의원 <span class="nmem">300</span>명 세비 누적(지급 기준)</div></div></div>
  <div class="pg-say mono"></div>
  <div class="pg-file" role="dialog" aria-label="기록 파일"></div>
  <nav class="pg-bar" aria-label="도구">
    <button type="button" data-w="mp"><span class="k">1</span><span class="ic"><svg viewBox="0 0 24 24" class="badge"><circle cx="12" cy="12" r="10.2" fill="none" stroke-width="1.4"/><g class="pet"><ellipse cx="12" cy="7.1" rx="2.7" ry="3.9" transform="rotate(0 12 12)"/><ellipse cx="12" cy="7.1" rx="2.7" ry="3.9" transform="rotate(72 12 12)"/><ellipse cx="12" cy="7.1" rx="2.7" ry="3.9" transform="rotate(144 12 12)"/><ellipse cx="12" cy="7.1" rx="2.7" ry="3.9" transform="rotate(216 12 12)"/><ellipse cx="12" cy="7.1" rx="2.7" ry="3.9" transform="rotate(288 12 12)"/></g><circle cx="12" cy="12" r="2.1" class="core"/></svg></span>의원</button>
    <button type="button" data-w="trip"><span class="k">2</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M21 15.5v-1.8l-7.8-4.9V4.2a1.6 1.6 0 0 0-3.2 0v4.6L2.2 13.7v1.8l7.8-2.4v4.6l-2.2 1.6V21l3.8-1.1 3.8 1.1v-1.7l-2.2-1.6v-4.6z" stroke-linejoin="round"/></svg></span>출장</button>
    <button type="button" data-w="radar"><span class="k">3</span><span class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5" opacity=".6"/><path d="M12 12 18.7 5.3"/><path d="M12 2.5A9.5 9.5 0 0 1 18.7 5.3L12 12z" class="fillp" stroke="none"/><circle cx="16" cy="14.5" r="1.1" class="dot" stroke="none"/></svg></span>레이더</button>
    <button type="button" data-w="rank"><span class="k">4</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M8.5 21v-8h7v8"/><path d="M3 21v-5h5.5M15.5 21v-11H21v11"/><path d="M2 21h20"/><path d="m12 3.2.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" stroke-width="1.3" stroke-linejoin="round"/></svg></span>순위</button>
    <button type="button" data-w="pres"><span class="k">5</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M12 2.8 19.5 6v5.5c0 4.6-3.2 8-7.5 9.7-4.3-1.7-7.5-5.1-7.5-9.7V6z" stroke-linejoin="round"/><path d="m12 7.6 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" stroke-linejoin="round" stroke-width="1.3"/></svg></span>대통령</button>
    <button type="button" data-w="find"><span class="k">6</span><span class="ic"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 5.6 5.6"/><path d="M7.5 10.5a3 3 0 0 1 3-3" opacity=".6"/></svg></span>찾기</button>
  </nav>
  <a class="usflag" href="us.html" >🇺🇸 미국 의회</a>
  <button type="button" class="pg-dice" aria-label="아무 의원이나 골라 추적"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="#5dff9e" stroke="none"/><circle cx="15.5" cy="15.5" r="1.2" fill="#5dff9e" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="#5dff9e" stroke="none"/><circle cx="15.5" cy="8.5" r="1.2" fill="#5dff9e" stroke="none"/><circle cx="8.5" cy="15.5" r="1.2" fill="#5dff9e" stroke="none"/></svg>아무나 추적</button>`;
  const $ = (s) => root.querySelector(s);
  const file = $('.pg-file'), say = $('.pg-say');
  let typer = 0;
  const type = (t) => { clearInterval(typer); if (RM) { say.textContent = '> ' + t; return; } let i = 0; say.textContent = '> '; typer = setInterval(() => { say.textContent = '> ' + t.slice(0, ++i) + (i < t.length ? '▌' : ''); if (i >= t.length) clearInterval(typer); }, 22); };

  // ── 소리(Web Audio로 직접 만든 효과음, 파일 없음). 처음 누를 때부터 켜지고, 🔊 버튼으로 끌 수 있다 ──
  const SFX = (() => {
    let ac = null, muted = false;
    try { muted = localStorage.getItem('mt.pg.mute') === '1'; } catch (e) { /* 무시 */ }
    // 소리는 모두 master(음량 줄이기 + 고음 깎기 + 압축기)를 거쳐 나간다: 여러 소리가 겹쳐도 찢어지지 않게.
    let master = null;
    const ctx = () => {
      if (muted) return null;
      if (!ac) {
        const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
        // 아이폰: 컨텍스트를 만들기 전에 audioSession 을 정해야 중간에 장치 샘플레이트가 바뀌며 지직거리지 않는다(iOS 17+).
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 무시 */ }
        ac = new A();
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; // 폰 스피커에서 날카로운 고음 깎기
        master = ac.createGain(); master.gain.value = 0.7; master.connect(lp); lp.connect(comp); comp.connect(ac.destination);
      }
      if (ac.state === 'suspended' || ac.state === 'interrupted') ac.resume();
      return ac;
    };
    // 첫 터치 때 빈 소리를 한 번 틀어 Web Audio 를 깨운다(<audio> 무음 파일은 아이폰에서 샘플레이트를 바꿔 지직거려서 뺐다).
    let unlocked = false;
    const unlock = () => {
      if (unlocked || muted) return; unlocked = true;
      const a = ctx(); if (!a) return;
      try { const b = a.createBuffer(1, 1, a.sampleRate), src = a.createBufferSource(); src.buffer = b; src.connect(a.destination); src.start(0); } catch (e) { /* 무시 */ }
    };
    ['pointerdown', 'touchend', 'click'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && !muted) ac.resume(); });
    let live = 0;
    const tone = (f, dur, { type = 'sine', vol = 0.18, at = 0, f2 = null, echo = false } = {}) => {
      const a = ctx(); if (!a || live > 8) return; const t = a.currentTime + at; live++;
      const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      let d = null, fb = null;
      if (echo) { d = a.createDelay(); d.delayTime.value = 0.18; fb = a.createGain(); fb.gain.value = 0.3; g.connect(d); d.connect(fb); fb.connect(d); d.connect(master); }
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { live--; try { o.disconnect(); g.disconnect(); } catch (e) { /* 무시 */ } if (d) setTimeout(() => { try { d.disconnect(); fb.disconnect(); } catch (e) { /* 무시 */ } }, 1500); };
    };
    return {
      get muted() { return muted; },
      toggle() { muted = !muted; if (!muted) { unlocked = false; unlock(); } try { localStorage.setItem('mt.pg.mute', muted ? '1' : '0'); } catch (e) { /* 무시 */ } if (muted && ac) ac.suspend(); return muted; },
      ping() { tone(1100, 1.0, { vol: 0.14, echo: true }); },                       // 소나 '띵'
      blip() { tone(880, 0.09, { type: 'triangle', vol: 0.07 }); },                  // 레이더에 잡힌 점
      lock() { tone(660, 0.07, { type: 'triangle', vol: 0.09 }); tone(990, 0.09, { type: 'triangle', vol: 0.09, at: 0.09 }); tone(1320, 0.16, { type: 'triangle', vol: 0.08, at: 0.2 }); }, // 조준 완료 '삑삑삑'
      click() { tone(420, 0.05, { type: 'triangle', vol: 0.08 }); tone(840, 0.04, { type: 'triangle', vol: 0.05, at: 0.04 }); }, // 무기 바꾸기 '철컥'
      whoosh() { tone(260, 0.9, { type: 'sine', vol: 0.06, f2: 900 }); },     // 비행기 출발
    };
  })();

  // ── 자료 ──
  const [mem, sup, flw, par, geo, prez] = await Promise.all([j('members.json'), j('support.json'), j('flows.json'), j('parties.json'), j('geo.json'), j('president.json')]);
  if (!mem) { type('자료를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'); return; }
  let SEC = null; const secP = j('security.json').then((x) => (SEC = x));
  let BIO = null, VR = null; const bioP = j('bio.json').then((x) => (BIO = (x && x.members) || {})); const vrP = j('vote_rate.json').then((x) => (VR = x || false));
  // 팔로우(이 폰에만 저장): { 의원코드: [그때 발의 수, 그때 출장 수] }
  const FK = 'mt.pg.fol'; let FOL = {}; try { FOL = JSON.parse(localStorage.getItem(FK) || '{}') || {}; } catch (e) { FOL = {}; }
  const saveFol = () => { try { localStorage.setItem(FK, JSON.stringify(FOL)); } catch (e) { /* 무시 */ } };
  const people = mem.members || [], trips = mem.trips || [];
  const pos = (geo && geo.pos) || {};
  const per = Number(((sup && sup.allowance) || []).find((a) => a.amount)?.amount) || 0;
  const byM = {}; for (const t of trips) { if (!t.member_id) continue; (byM[t.member_id] = byM[t.member_id] || []).push(t); }
  const tripsOf = (m) => { const u = new Map(); for (const t of byM[m.id] || []) u.set(t.trip_id, t); return [...u.values()].sort((a, b) => String(b.start || '').localeCompare(String(a.start || ''))); };
  const statOf = (m) => { const ts = tripsOf(m); return { ts, n: ts.length, ext: ts.filter((t) => extF(t.funder)).length, norep: ts.filter((t) => t.report !== '유').length }; };
  const rateOf = (m) => { const v = VR && VR.m && VR.m[m.id]; if (!v) return null; const all = v[0] + v[1] + v[2] + v[3]; return all ? { p: Math.round(((v[0] + v[1] + v[2]) / all) * 1000) / 10, v, all } : null; };
  const numOf = (m) => { const ls = SEC && SEC.lead_stat && SEC.lead_stat[m.id]; const r = rateOf(m); return { bill: ls ? ls[0] : 0, pass: ls ? ls[1] : 0, trip: statOf(m).n, vote: r ? r.p : null, disc: SEC ? (SEC.discipline || []).filter((x) => (x.who || []).includes(m.name)).length : 0 }; };
  const byT = {}; for (const t of trips) (byT[t.trip_id] = byT[t.trip_id] || []).push(t);
  const ctry = {}; for (const [id, ts] of Object.entries(byT)) for (const d of new Set((ts[0].dest || []).map(cname))) (ctry[d] = ctry[d] || new Set()).add(id);
  root.querySelector('.nmem').textContent = people.length;

  // ── 시계·카운터 ──
  const clk = $('.clk'), ctr = $('.ctr .n');
  const tick = () => { const k = new Date(Date.now() + 9 * 3600e3); clk.textContent = k.toISOString().slice(11, 19) + ' KST'; const sec = k.getUTCHours() * 3600 + k.getUTCMinutes() * 60 + k.getUTCSeconds() + k.getUTCMilliseconds() / 1000; ctr.textContent = won(per * people.length / (365 * 86400) * sec); };
  tick(); setInterval(tick, RM ? 1000 : 100);

  // ── 지도 ──
  const map = L.map($('.pg-map'), { zoomControl: false, attributionControl: true, zoomSnap: 0.25, minZoom: 0, maxZoom: 11, worldCopyJump: false, tap: false });
  map.attributionControl.setPrefix(false);
  // 크게 줌아웃해도 대륙이 옆으로 되풀이되지 않게: 지구 한 바퀴(유럽 서쪽 ~ 아메리카 동쪽)만 보이게 묶고, 그 폭이 화면을 꽉 채우는 데까지만 줌아웃
  const WORLD = L.latLngBounds([[-60, -25], [78, 335]]);
  map.setMaxBounds(WORLD); map.options.maxBoundsViscosity = 1;
  const setMin = () => { const w = (root.querySelector('.pg-map') || root).clientWidth || 360; map.setMinZoom(Math.ceil(Math.log2(w / 256) * 4) / 4); };
  setMin();
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 11, attribution: '지도: Esri · 위성: Esri, Maxar, Earthstar Geographics · 자료: 열린국회정보' }).addTo(map);
  // 확대할수록 진짜 위성 사진으로: 줌 6.5부터 서서히 겹쳐 8에서 완전히(어둡게 눌러 추적실 느낌 유지), 지명은 위에 얹는다
  map.createPane('sat'); map.getPane('sat').style.zIndex = 250; map.getPane('sat').style.filter = 'brightness(.72) contrast(1.12) saturate(.75)';
  map.createPane('satlab'); map.getPane('satlab').style.zIndex = 260; map.getPane('satlab').style.pointerEvents = 'none';
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { pane: 'sat', maxZoom: 11, minZoom: 6, opacity: 0 }).addTo(map);
  const satLab = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { pane: 'satlab', maxZoom: 11, minZoom: 7, opacity: 0 }).addTo(map);
  let satOn = false;
  const satFade = () => {
    const z = map.getZoom(), o = Math.max(0, Math.min(1, (z - 6.5) / 1.5));
    sat.setOpacity(o); satLab.setOpacity(o * 0.85);
    const on = o > 0.6; if (on !== satOn) { satOn = on; root.classList.toggle('sat', on); }
  };
  map.on('zoom zoomend', satFade);
  { const sb = document.createElement('div'); sb.className = 'satb'; sb.innerHTML = '<i></i>SAT · 위성 영상'; root.append(sb); }
  const KR = L.latLngBounds([[33.0, 125.3], [38.7, 129.7]]);
  const fitKR = (anim) => map.fitBounds(KR, { padding: [70, 20], paddingBottomRight: [20, 90], animate: !!anim && !RM });
  fitKR(false);
  const gDots = L.layerGroup().addTo(map), gFx = L.layerGroup().addTo(map), gTop = L.layerGroup().addTo(map);

  // 의원 위치: 지역구는 지역 좌표(같은 곳이 여럿이면 둘레로 살짝), 비례대표는 국회 둘레 고리
  const slot = {}, LL = {};
  const prop = people.filter((m) => m.elect !== '지역구');
  for (const m of people) {
    let p = pos[m.id];
    if (m.elect !== '지역구' || !p) { const i = prop.indexOf(m), n = Math.max(1, prop.length), a = (i / n) * Math.PI * 2; p = [SE[0] + 0.16 * Math.sin(a), SE[1] + 0.2 * Math.cos(a)]; }
    else { const k = p.join(','), i = (slot[k] = (slot[k] || 0) + 1) - 1; if (i) { const a = i * 2.4, r = 0.035 * Math.sqrt(i); p = [p[0] + r * Math.sin(a), p[1] + r * 1.25 * Math.cos(a)]; } }
    LL[m.id] = p;
  }
  const dotOf = {};
  const drawDots = (filter) => {
    gDots.clearLayers();
    for (const m of people) {
      const on = !filter || filter(m);
      const fo = !!FOL[m.id];
      const mk = L.circleMarker(LL[m.id], { radius: on ? (fo ? 7 : 5.5) : 3, weight: on ? (fo ? 2.5 : 1.5) : 0.5, color: on ? (fo ? '#ffc94a' : '#e8fff1') : '#2a4a38', fillColor: pc(m.party), fillOpacity: on ? 0.95 : 0.25, opacity: on ? 0.9 : 0.4 }).addTo(gDots);
      mk.on('click', () => open(m));
      mk.bindTooltip(`${esc(m.name)} · ${esc(m.party)}`, { direction: 'top', className: 'clab', offset: [0, -4] });
      dotOf[m.id] = mk;
    }
  };

  // 비행 경로(국회 → 나라): 휘는 선 + 움직이는 ✈
  const arc = (a, b) => { const P = [], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[1] - a[1], dy = b[0] - a[0], k = 0.18, c = [mx + dx * k, my - dy * k]; for (let i = 0; i <= 40; i++) { const t = i / 40, u = 1 - t; P.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return P; };
  let planeRaf = 0;
  const fly = (routes) => {
    cancelAnimationFrame(planeRaf); gFx.clearLayers();
    const planes = routes.map((r, i) => {
      L.polyline(r.path, { color: r.col || '#ffb020', weight: r.w || 2.5, opacity: 0.35, dashArray: '2 8', interactive: false }).addTo(gFx);
      const line = L.polyline([r.path[0]], { color: r.col || '#ffb020', weight: r.w || 2.5, opacity: 0.95, interactive: false }).addTo(gFx);
      const pl = L.marker(r.path[0], { icon: L.divIcon({ className: 'plane', html: '✈', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false }).addTo(gFx);
      return { r, line, pl, off: i * 260 };
    });
    if (RM) { planes.forEach((p) => { p.line.setLatLngs(p.r.path); p.pl.setLatLng(p.r.path[p.r.path.length - 1]); }); return; }
    const t0 = performance.now(), DUR = 1800;
    const step = (now) => {
      let busy = false;
      for (const p of planes) {
        const u = Math.min(1, Math.max(0, (now - t0 - p.off) / DUR)); if (u < 1) busy = true;
        const k = Math.max(1, Math.round(u * (p.r.path.length - 1)));
        p.line.setLatLngs(p.r.path.slice(0, k + 1)); p.pl.setLatLng(p.r.path[k]);
        const a = p.r.path[Math.max(0, k - 1)], b = p.r.path[k];
        const el = p.pl.getElement(); if (el) { const ang = Math.atan2(-(b[0] - a[0]), b[1] - a[1]) * 180 / Math.PI; el.style.transform = el.style.transform.replace(/ rotate\([^)]*\)/, '') + ` rotate(${ang}deg)`; }
      }
      if (busy) planeRaf = requestAnimationFrame(step);
    };
    planeRaf = requestAnimationFrame(step);
  };
  const reticle = (ll, keep) => {
    if (!keep) gTop.clearLayers();
    L.marker(ll, { interactive: false, icon: L.divIcon({ className: 'reticle', iconSize: [70, 70], iconAnchor: [35, 35], html: '<svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="22" fill="none" stroke="#5dff9e" stroke-width="2"/><circle cx="35" cy="35" r="30" fill="none" stroke="#5dff9e" stroke-opacity=".35" stroke-width="1" stroke-dasharray="3 5"/><g stroke="#5dff9e" stroke-width="2"><line x1="35" y1="2" x2="35" y2="14"/><line x1="35" y1="56" x2="35" y2="68"/><line x1="2" y1="35" x2="14" y2="35"/><line x1="56" y1="35" x2="68" y2="35"/></g></svg>' }) }).addTo(gTop);
  };

  // ── 기록 파일 ──
  const cm = (t) => String(t || '').split(/\s*,\s*/).filter(Boolean).map((x) => (x.length > 14 ? x.slice(0, 13) + '…' : x)).join(' · '); // 긴 특위 이름은 줄여서
  const pic = (m, cls) => (m.pic ? `<img class="${cls || ''}" src="${esc(m.pic)}" alt="${esc(m.name)} 의원 공식 사진" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ini',textContent:'${esc(m.name.slice(0, 1))}'}))">` : `<span class="ini">${esc(m.name.slice(0, 1))}</span>`);
  const closeFile = () => { file.classList.remove('on'); };
  const padBR = () => (innerWidth >= 900 ? [40, 400] : [30, (file.classList.contains('on') ? file.offsetHeight : 0) + 100]); // 파일 창에 가리지 않게
  const fileHead = (t, extra) => `<div class="fh"><span>▣ ${esc(t)}</span><span class="tools">${extra || ''}<button type="button" class="mn" aria-label="접기·펴기">▾</button><button type="button" class="x" aria-label="닫기">×</button></span></div>`;
  const bindX = () => { file.classList.remove('min'); const x = file.querySelector('.x'); if (x) x.onclick = () => { closeFile(); gTop.clearLayers(); }; const mn = file.querySelector('.mn'); if (mn) mn.onclick = (e) => { e.stopPropagation(); file.classList.toggle('min'); }; };
  const SHARE = (m) => { try { const ix = window.__shIdx; if (ix && ix.mp && ix.mp[m.name]) return location.origin + location.pathname.replace(/[^/]*$/, '') + 's/m/' + ix.mp[m.name] + '.html'; } catch (e) { /* 무시 */ } return location.origin + location.pathname + '?mp=' + encodeURIComponent(m.name); };
  fetch('data/og/s/index.json').then((r) => (r.ok ? r.json() : null)).then((x) => { window.__shIdx = x; }).catch(() => {});
  let VSA = null; // 비교 상대를 고르는 중이면 첫 의원
  function open(m) {
    if (VSA) { const a = VSA; VSA = null; if (a.id !== m.id) return vs(a, m); }
    SFX.lock();
    const s = statOf(m);
    const ll = LL[m.id];
    reticle(ll);
    if (!RM) map.flyTo(ll, Math.max(map.getZoom(), 8.5), { duration: 0.9 }); else map.setView(ll, 8.5);
    type(`기록 열람: ${m.name} · ${m.party} · ${m.district}`);
    const dests = [...new Set(s.ts.flatMap((t) => (t.dest || []).map(cname)))];
    const fo = !!FOL[m.id];
    file.innerHTML = fileHead(`FILE · 22대 국회의원 · ${m.id || ''}`, `<button type="button" class="fol${fo ? ' on' : ''}" aria-pressed="${fo}" aria-label="팔로우">${fo ? '★' : '☆'}</button>`) + `
      <div class="who"><div class="ph"><span class="scanl"></span>${pic(m)}</div>
      <div><div class="nm">${esc(m.name)}</div><span class="pt" style="background:${pc(m.party)}">${esc(m.party)}</span>
      <div class="ds">${esc(m.district)} · ${esc(m.reele || '')}<br><span class="bio1"></span></div></div></div>
      <div class="st st4"><div><b class="s-bill">·</b><span>대표 발의</span></div><div><b class="s-pass">·</b><span>통과·반영</span></div><div><b>${s.n}</b><span>국외 출장</span></div><div><b class="s-vote">·</b><span>표결 참여</span></div></div>
      <div class="tabs" role="tablist"><button type="button" class="on" data-t="prof">프로필</button><button type="button" data-t="trip">출장<i>${s.n}</i></button><button type="button" data-t="bill">발의<i class="c-bill"></i></button><button type="button" data-t="vote">표결</button><button type="button" data-t="disc">징계안<i class="c-disc"></i></button></div>
      <div class="tb" data-t="prof"></div>
      <div class="tb" data-t="trip" hidden>${s.ts.length ? `<div class="ds" style="margin-top:8px">외부에서 비용 낸 출장 <b style="color:#ffd27a">${s.ext}</b> · 결과보고서 없이 신고 <b style="color:#ffd27a">${s.norep}</b></div>` + s.ts.map((t) => `<div class="tr"><div class="d">${esc(t.dates || t.start || '')} · ${esc((t.dest || []).map(cname).join(', '))}</div><div class="p">${esc(String(t.purpose || '').slice(0, 90))}</div><div><span class="tg y">비용 낸 곳: ${esc(t.funder || '적힌 곳 없음')}</span><span class="tg">결과보고서 ${t.report === '유' ? '있음' : '신고 때 없음'}</span>${t.dest_inferred ? '<span class="tg">나라는 목적 문구로 추정</span>' : ''}</div></div>`).join('') + '<div class="fine">공개된 기록일 뿐 잘잘못을 뜻하지 않아요. 결과보고서는 나중에 낼 수 있어요. 출처 열린국회정보</div>' : '<div class="ds" style="margin-top:8px">신고된 국외 출장이 없어요.</div>'}</div>
      <div class="tb" data-t="bill" hidden></div><div class="tb" data-t="vote" hidden></div><div class="tb" data-t="disc" hidden></div>
      <div class="act">${dests.length ? '<button type="button" class="p" data-a="fly">✈ 출장 경로</button>' : ''}<button type="button" data-a="vs">⇄ 다른 의원과 비교</button><button type="button" data-a="share">링크 복사</button></div>`;
    file.classList.add('on'); bindX();
    recs(m);
    const showFly = () => {
      const rs = dests.filter((d) => C[d]).map((d) => ({ path: arc(SE, C[d]), col: '#ffb020', w: 2.5 }));
      if (!rs.length) return;
      const b = L.latLngBounds([SE, ...dests.filter((d) => C[d]).map((d) => C[d])]);
      map.flyToBounds(b, { paddingTopLeft: [30, 100], paddingBottomRight: padBR(), duration: RM ? 0 : 1.1, maxZoom: 5 });
      setTimeout(() => { SFX.whoosh(); fly(rs); for (const d of dests.filter((x) => C[x])) { const n = s.ts.filter((t) => (t.dest || []).map(cname).includes(d)).length; L.circleMarker(C[d], { radius: 6, color: '#02110a', weight: 1, fillColor: '#ffb020', fillOpacity: 0.95, interactive: false }).addTo(gFx).bindTooltip(`${esc(d)}${n > 1 ? ' ×' + n : ''}`, { permanent: true, direction: 'top', className: 'mtag', offset: [0, -6] }); } }, RM ? 0 : 900);
      type(`${m.name} 출장 경로 ${rs.length}곳 · 국회(여의도) 출발`);
    };
    const fb = file.querySelector('[data-a="fly"]'); if (fb) fb.onclick = showFly;
    file.querySelector('[data-a="share"]').onclick = async (e) => { const u = SHARE(m); try { await navigator.clipboard.writeText(u); e.target.textContent = '복사했어요'; } catch (_) { prompt('링크', u); } };
    const fb2 = file.querySelector('.fol');
    fb2.onclick = (e) => { e.stopPropagation(); const n = numOf(m); if (FOL[m.id]) delete FOL[m.id]; else FOL[m.id] = [n.bill, n.trip]; saveFol(); const on = !!FOL[m.id]; fb2.classList.toggle('on', on); fb2.textContent = on ? '★' : '☆'; fb2.setAttribute('aria-pressed', String(on)); SFX.click(); type(on ? `${m.name} 팔로우 · 새 법안·출장이 생기면 다음에 알려 드려요(이 폰에만 저장)` : `${m.name} 팔로우 해제`); if (dotOf[m.id]) drawDots(); };
    file.querySelector('[data-a="vs"]').onclick = () => vsPick(m);
    if (FOL[m.id] && SEC) { const n = numOf(m); FOL[m.id] = [n.bill, n.trip]; saveFol(); } // 봤으니 '새 소식' 기준을 지금으로
    if (dests.length) setTimeout(showFly, RM ? 0 : 1300); else gFx.clearLayers();
    try { history.replaceState(null, '', '?mp=' + encodeURIComponent(m.name)); } catch (e) { /* 무시 */ }
  }
  // ── 공식 기록 탭: 대표 발의 · 외교·안보 표결 · 징계안 · 더 찾기. 모두 국회 공식 기록 그대로, 판단 없음 ──
  const VN = { Y: '찬성', N: '반대', A: '기권', X: '불참', '-': '기록 없음' };
  const RES = (r) => (!r ? '심사 중' : r === '대안반영폐기' ? '다른 법안에 내용 반영' : r);
  const billA = (id, t) => (id && SEC && SEC.bill_url ? `<a href="${esc(SEC.bill_url + id)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t));
  const rateBox = (m) => {
    const r = rateOf(m);
    if (!r) return VR ? '<div class="ds" style="margin-top:8px">본회의 표결 참여 기록을 모으는 중이에요.</div>' : '';
    const [y, n, a, x] = r.v;
    return `<div class="ph2">본회의 표결 참여</div><div class="rate"><b>${r.p}%</b><div class="bar"><i style="width:${r.p}%"></i></div></div>
      <div class="vsum"><div><b>${y}</b>찬성</div><div><b>${n}</b>반대</div><div><b>${a}</b>기권</div><div><b>${x}</b>불참</div></div>
      <div class="fine" style="margin-top:2px">22대 본회의 전자 표결 ${VR.bills_done.toLocaleString('ko-KR')}건 기준${VR.bills_done < VR.bills_total ? `(전체 ${VR.bills_total.toLocaleString('ko-KR')}건 중 모으는 중)` : ''} · 불참에는 공무·병가 등 사정이 있을 수 있어요.</div>`;
  };
  function recs(m) {
    file.dataset.mid = m.id;
    const tabs = file.querySelectorAll('.tabs button'), tb = (t) => file.querySelector(`.tb[data-t="${t}"]`);
    tabs.forEach((bt) => (bt.onclick = () => { SFX.click(); tabs.forEach((x) => x.classList.toggle('on', x === bt)); file.querySelectorAll('.tb').forEach((x) => (x.hidden = x.dataset.t !== bt.dataset.t)); }));
    const SRC = '<div class="fine">국회 공식 기록 그대로예요. 사이트가 성향을 판단하거나 좋고 나쁨을 매기지 않아요. 출처 <a href="https://open.assembly.go.kr" target="_blank" rel="noopener">열린국회정보</a></div>';
    // 프로필: 국회 공개 약력 그대로 + 재산·선관위·회의록 원문 링크
    const prof = () => {
      if (file.dataset.mid !== m.id) return;
      const b = (BIO || {})[m.id] || {};
      const age = b.y ? `${b.y}년생` : '';
      // 한 줄 요약용 학교: 대학원 말고 학부(학사·졸업·학과) 줄을 먼저, 'OO대학교' → 'OO대'
      const E = (b.edu || []).filter((x) => /대학|대\b|대 /.test(x) && !/대학원/.test(x));
      const e1 = E.find((x) => /학사|졸업|학과|학부/.test(x)) || E[0] || '';
      const sch = ((e1.match(/([가-힣A-Za-z]+?)(대학교|대학|대)(?![가-힣])/) || [])[1] || '');
      const b1 = file.querySelector('.bio1'); if (b1) b1.textContent = [age, sch ? sch + '대' : ''].filter(Boolean).join(' · ');
      const H = b.hist || [], more = H.length > 6;
      tb('prof').innerHTML = `
        ${b.edu && b.edu.length ? `<div class="ph2">학력</div>` + b.edu.map((x) => `<div class="pl">${esc(x)}</div>`).join('') : ''}
        ${H.length ? `<div class="ph2">경력</div>` + H.map((x, i) => `<div class="pl${i >= 6 ? ' hx' : ''}"${i >= 6 ? ' hidden' : ''}>${esc(x)}</div>`).join('') + (more ? '<button type="button" class="allb hm">경력 더 보기</button>' : '') : '<div class="ds" style="margin-top:8px">공개된 약력이 없어요.</div>'}
        ${m.cmits ? `<div class="ph2">소속 위원회</div><div class="pl">${esc(cm(m.cmits))}</div>` : ''}
        <div class="ph2">원문으로 확인</div><div class="lk">
          <a href="https://www.peti.go.kr" target="_blank" rel="noopener">재산 공개 원문 ↗<span>공직윤리시스템 · "${esc(m.name)}" 검색</span></a>
          <a href="http://info.nec.go.kr" target="_blank" rel="noopener">선관위 후보자 공개 서류 ↗<span>재산·병역·납세·전과</span></a>
          <a href="https://record.assembly.go.kr/" target="_blank" rel="noopener">국회 회의록 발언 ↗<span>"${esc(m.name)}" 검색</span></a>
          <a href="${esc(m.profile || 'https://www.assembly.go.kr')}" target="_blank" rel="noopener">국회 의원 소개 ↗</a></div>
        <div class="fine">약력은 국회가 공개한 글 그대로예요(열린국회정보). 재산은 매년 3월 정기 공개되고, 숫자를 옮겨 적다 틀리지 않게 원문 링크만 둬요.</div>`;
      const hm = tb('prof').querySelector('.hm'); if (hm) hm.onclick = () => { tb('prof').querySelectorAll('.hx').forEach((x) => (x.hidden = false)); hm.remove(); };
    };
    if (BIO) prof(); else bioP.then(prof);
    const fill = () => {
      if (!SEC) { ['bill', 'vote', 'disc'].forEach((t) => (tb(t).innerHTML = '<div class="ds" style="margin-top:8px">공식 기록을 불러오지 못했어요.</div>')); return; }
      // 대표 발의
      const st = (SEC.lead_stat || {})[m.id], L1 = (SEC.lead || {})[m.id] || [];
      file.querySelector('.c-bill').textContent = st ? st[0] : 0;
      tb('bill').innerHTML = st ? `<div class="vsum" style="grid-template-columns:repeat(3,1fr)"><div><b>${st[0]}</b>대표 발의</div><div><b>${st[1]}</b>통과·반영</div><div><b>${st[2]}</b>외교·안보 위원회</div></div>
        <div class="ds rc">22대 국회에서 이 의원이 대표로 낸 법안이에요. 최근 ${L1.length}건:</div>` + L1.map((b) => `<div class="tr"><div class="d">${esc(b.d)}</div><div class="p">${billA(b.id, b.n)}</div><div><span class="tg ${b.r && b.r !== '철회' ? 'y' : ''}">${esc(RES(b.r))}</span>${b.s ? '<span class="tg">외교·안보 위원회 소관</span>' : ''}</div></div>`).join('') + `${st[0] > L1.length ? `<button type="button" class="allb">전체 ${st[0]}건 보기</button>` : ''}` + SRC
        : '<div class="ds" style="margin-top:8px">22대 국회에서 대표로 낸 법안 기록이 없어요.</div>' + SRC;
      const nn = numOf(m);
      const sb = file.querySelector('.s-bill'); if (sb) { sb.textContent = nn.bill; file.querySelector('.s-pass').textContent = nn.pass; }
      // 표결: 본회의 전체 참여율 + 외교·안보 표결
      const vs = (SEC.votes || {})[m.id] || '', B = SEC.bills || [];
      const cnt = { Y: 0, N: 0, A: 0, X: 0 }; for (const c of vs) if (cnt[c] != null) cnt[c]++;
      const rows = B.map((b, i) => [b, vs[i] || '-']).filter(([, v]) => v !== '-');
      tb('vote').innerHTML = rateBox(m) + (rows.length ? `<div class="ph2">외교·안보 표결</div><div class="ds">국방·외교통일·정보위원회 소관이거나 외교·안보 안건 중, 본회의에서 반대·기권이 3표 이상 나온 ${B.length}건이에요(만장일치는 뺐어요).</div>
        <div class="vsum"><div><b>${cnt.Y}</b>찬성</div><div><b>${cnt.N}</b>반대</div><div><b>${cnt.A}</b>기권</div><div><b>${cnt.X}</b>불참</div></div>` + rows.map(([b, v]) => `<div class="tr"><div class="d">${esc(b.date)}</div><div class="p"><span class="vt ${v}">${VN[v]}</span>${billA(b.id, b.name)}</div><div><span class="tg">본회의 ${esc(b.result || '')} · 찬성 ${b.yes} · 반대 ${b.nay} · 기권 ${b.blank}</span></div></div>`).join('') + SRC
        : '<div class="ds" style="margin-top:8px">이 의원의 외교·안보 표결 기록이 없어요.</div>' + SRC);
      // 징계안
      const D2 = (SEC.discipline || []).filter((x) => (x.who || []).includes(m.name));
      file.querySelector('.c-disc').textContent = D2.length;
      tb('disc').innerHTML = (D2.length ? `<div class="ds" style="margin-top:8px">국회에 제출된, 이 의원 이름이 제목에 있는 징계안이에요. <b>징계안은 제출된 안건일 뿐, 징계가 정해졌다는 뜻이 아니에요.</b></div>` + D2.map((x) => `<div class="tr"><div class="d">${esc(x.date)} 제출</div><div class="p">${billA(x.id, x.name)}</div><div><span class="tg">${esc(x.result || '처리 전(윤리특별위원회 심사)')}</span></div></div>`).join('')
        : '<div class="ds" style="margin-top:8px">22대 국회에서 이 의원 이름으로 제출된 징계안이 없어요.</div>') + '<div class="fine">출처 열린국회정보 의안 접수목록 · 같은 이름의 다른 사람일 수 있으니 원문을 확인하세요.</div>';
      const ab = tb('bill').querySelector('.allb');
      if (ab) ab.onclick = async () => {
        SFX.click(); ab.textContent = '불러오는 중…'; ab.disabled = true;
        const all = await j('bills/' + m.id + '.json');
        if (!all || file.dataset.mid !== m.id) { ab.textContent = '불러오지 못했어요'; return; }
        const box = document.createElement('div');
        box.innerHTML = `<input class="q" type="search" placeholder="법안 이름으로 찾기 (예: 주택)" aria-label="법안 찾기" style="margin-top:10px"><div class="fl"><button type="button" data-f="" class="on">전체</button><button type="button" data-f="ok">통과·반영</button><button type="button" data-f="wait">심사 중</button></div><div class="ds cnt"></div><div class="ls"></div>`;
        ab.replaceWith(box); tb('bill').querySelectorAll(':scope > .tr, :scope > .rc').forEach((x) => x.remove()); // 최근 목록 대신 전체 목록
        const q = box.querySelector('.q'), ls = box.querySelector('.ls'), cnt = box.querySelector('.cnt'); let f = '', lim = 40;
        const ok = (b) => /가결|대안반영|수정/.test(b.r || '');
        const paint = () => {
          const nrm = (t) => String(t || '').replace(/\s+/g, '');
          const n = nrm(q.value);
          const L2 = all.filter((b) => (!n || nrm(b.n).includes(n)) && (!f || (f === 'ok' ? ok(b) : !b.r)));
          cnt.textContent = `${L2.length}건`;
          ls.innerHTML = L2.slice(0, lim).map((b) => `<div class="tr"><div class="d">${esc(b.d)}${b.c ? ' · ' + esc(b.c) : ''}</div><div class="p">${billA(b.id, b.n)}</div><div><span class="tg ${ok(b) ? 'y' : ''}">${esc(RES(b.r))}</span></div></div>`).join('') + (L2.length > lim ? '<button type="button" class="allb more">더 보기</button>' : '');
          const mb = ls.querySelector('.more'); if (mb) mb.onclick = () => { lim += 60; paint(); };
        };
        box.querySelectorAll('.fl button').forEach((x) => (x.onclick = () => { f = x.dataset.f; lim = 40; box.querySelectorAll('.fl button').forEach((y) => y.classList.toggle('on', y === x)); paint(); }));
        q.oninput = () => { lim = 40; paint(); }; paint();
      };
    };
    file.dataset.mid = m.id;
    vrP.then(() => { if (file.dataset.mid !== m.id) return; const r = rateOf(m), sv = file.querySelector('.s-vote'); if (sv) sv.textContent = r ? Math.round(r.p) + '%' : '—'; });
    if (SEC && VR !== null) fill(); else Promise.all([secP, vrP]).then(() => { if (file.dataset.mid === m.id && file.querySelector('.tabs')) fill(); });
  }
  // ── 1:1 비교 ──
  function vsPick(a) {
    VSA = a; SFX.click();
    type(`${a.name} 와(과) 비교할 의원을 지도에서 누르거나 찾아 주세요`);
    file.innerHTML = fileHead('비교 · 상대 고르기') + `<input class="q" type="search" placeholder="이름·동네·정당" aria-label="비교할 의원 찾기" autocomplete="off"><div class="res"></div><div class="ds">지도에서 점을 눌러도 돼요.</div>`;
    file.classList.add('on'); bindX();
    const q = file.querySelector('.q'), res = file.querySelector('.res'), nrm = (t) => String(t || '').replace(/\s+/g, '');
    const same = people.filter((m) => m.id !== a.id && m.district.split(' ')[0] === a.district.split(' ')[0] && m.elect === '지역구').slice(0, 5);
    const paint = () => { const n = nrm(q.value); const L2 = n ? people.filter((m) => m.id !== a.id && nrm(m.name + m.district + m.party).includes(n)).slice(0, 20) : same; res.innerHTML = (n ? '' : same.length ? '<div class="ph2">같은 지역 의원</div>' : '') + L2.map((m) => row(m)).join(''); bindRows(); };
    q.oninput = paint; paint(); if (innerWidth >= 900) setTimeout(() => q.focus(), 50);
    const x = file.querySelector('.x'); if (x) x.addEventListener('click', () => (VSA = null));
  }
  async function vs(a, b) {
    await Promise.all([secP, vrP, bioP]);
    SFX.lock(); gFx.clearLayers(); stopRadar(); drawDots((m) => m.id === a.id || m.id === b.id);
    reticle(LL[a.id]); reticle(LL[b.id], true);
    map.flyToBounds(L.latLngBounds([LL[a.id], LL[b.id]]), { paddingTopLeft: [40, 120], paddingBottomRight: padBR(), duration: RM ? 0 : 1, maxZoom: 9 });
    const A = numOf(a), B = numOf(b), ba = (BIO || {})[a.id] || {}, bb = (BIO || {})[b.id] || {};
    const rows = [['대표 발의', 'bill', (v) => v + '건'], ['통과·반영', 'pass', (v) => v + '건'], ['국외 출장', 'trip', (v) => v + '건'], ['표결 참여', 'vote', (v) => (v == null ? '—' : v + '%')], ['징계안', 'disc', (v) => v + '건']];
    const side = (m, bi) => `<div class="vp">${pic(m)}<b>${esc(m.name)}</b><span style="color:${pc(m.party)}">${esc(m.party)}</span><small>${esc(m.district)}${bi.y ? ' · ' + bi.y + '년생' : ''}</small></div>`;
    file.innerHTML = fileHead('1:1 비교') + `<div class="vs">${side(a, ba)}<div class="vx">VS</div>${side(b, bb)}</div>` +
      rows.map(([lab, k, f]) => { const x = A[k], y = B[k], mx = Math.max(x || 0, y || 0) || 1; return `<div class="vr"><div class="l"><b>${f(x)}</b><i style="width:${((x || 0) / mx) * 100}%"></i></div><span>${lab}</span><div class="r"><i style="width:${((y || 0) / mx) * 100}%"></i><b>${f(y)}</b></div></div>`; }).join('') +
      `<div class="act"><button type="button" class="p" data-a="again">다른 상대</button><button type="button" data-a="share">링크 복사</button><button type="button" data-a="oa">${esc(a.name)} 파일</button><button type="button" data-a="ob">${esc(b.name)} 파일</button></div>
      <div class="fine">국회 공식 기록의 숫자를 나란히 놓은 것일 뿐, 누가 더 잘한다는 뜻이 아니에요. 출처 열린국회정보</div>`;
    file.classList.add('on'); bindX();
    file.querySelector('[data-a="again"]').onclick = () => vsPick(a);
    file.querySelector('[data-a="oa"]').onclick = () => open(a);
    file.querySelector('[data-a="ob"]').onclick = () => open(b);
    file.querySelector('[data-a="share"]').onclick = async (e) => { const u = location.origin + location.pathname + '?vs=' + encodeURIComponent(a.name + ',' + b.name); try { await navigator.clipboard.writeText(u); e.target.textContent = '복사했어요'; } catch (_) { prompt('링크', u); } };
    type(`${a.name} vs ${b.name} · 공식 기록 비교`);
    try { history.replaceState(null, '', '?vs=' + encodeURIComponent(a.name + ',' + b.name)); } catch (e) { /* 무시 */ }
  }
  const row = (m, right) => `<div class="li" data-id="${esc(m.id)}">${m.pic ? `<img src="${esc(m.pic)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="av">${esc(m.name.slice(0, 1))}</span>`}<div class="t"><b>${esc(m.name)}</b> <span style="color:${pc(m.party)};font-size:11px;font-weight:800">${esc(m.party)}</span><div>${esc(m.district)}</div></div>${right ? `<span class="r">${right}</span>` : ''}</div>`;
  const bindRows = () => file.querySelectorAll('.li[data-id]').forEach((el) => (el.onclick = () => { const m = people.find((x) => x.id === el.dataset.id); if (m) open(m); }));

  // ── 도구(무기) ──
  let radarRaf = 0;
  const stopRadar = () => { cancelAnimationFrame(radarRaf); radarRaf = 0; const c = root.querySelector('.pg-radar'); if (c) c.remove(); };
  const RANKS = [
    { k: 'bill', label: '대표 발의', f: (v) => v + '건', note: '22대 국회에서 대표로 낸 법안 수.' },
    { k: 'pass', label: '통과·반영', f: (v) => v + '건', note: '대표로 낸 법안 중 가결되었거나 다른 법안에 내용이 반영된 수.' },
    { k: 'trip', label: '국외 출장', f: (v) => v + '건', note: '국외 출장 신고 수.' },
    { k: 'vote', label: '표결 참여', f: (v) => v + '%', note: '본회의 전자 표결 참여율. 불참에는 공무·병가 등 사정이 있을 수 있어요.' },
  ];
  let RSEG = 'bill', RDESC = true;
  const segBar = () => `<div class="seg">${RANKS.filter((x) => x.k !== 'vote' || (VR && VR.m)).map((x) => `<button type="button" data-s="${x.k}" class="${RSEG === x.k ? 'on' : ''}">${x.label}</button>`).join('')}<button type="button" data-s="party" class="${RSEG === 'party' ? 'on' : ''}">정당 돈</button></div>`;
  const bindSeg = () => file.querySelectorAll('.seg [data-s]').forEach((b) => (b.onclick = () => { RSEG = b.dataset.s; SFX.click(); W.rank(); }));
  const W = {
    mp() {
      stopRadar(); gFx.clearLayers(); gTop.clearLayers(); drawDots(); fitKR(true); closeFile();
      type(`의원 ${people.length}명 위치 표시 · 점을 누르면 기록 파일이 열려요 (비례대표는 국회 둘레)`);
    },
    trip() {
      stopRadar(); gTop.clearLayers(); drawDots(() => false);
      const list = Object.entries(ctry).filter(([c]) => C[c]).sort((a, b) => b[1].size - a[1].size);
      const mx = Math.max(1, ...list.map(([, s]) => s.size));
      fly(list.map(([c, s]) => ({ path: arc(SE, C[c]), w: 1.5 + (s.size / mx) * 5 })));
      for (const [c, s] of list) {
        const mk = L.circleMarker(C[c], { radius: 5 + (s.size / mx) * 7, color: '#02110a', weight: 1, fillColor: '#ffb020', fillOpacity: 0.95 }).addTo(gTop);
        mk.bindTooltip(`${esc(c)} ${s.size}`, { permanent: s.size >= mx * 0.25, direction: 'top', className: 'clab', offset: [0, -6] });
        mk.on('click', () => country(c));
      }
      const n = new Set(trips.map((t) => t.trip_id)).size;
      type(`국외 출장 신고 ${n}건 · ${list.length}개 나라 · 나라를 누르면 누가 갔는지 나와요`);
      file.innerHTML = fileHead('출장 추적') + `<div class="ds">국회에서 출발한 선이 굵을수록 신고가 많아요. 비용은 자비·외교부·외국 정부 등 여러 곳에서 냈어요(모두 세금은 아님).</div>` + list.slice(0, 15).map(([c, s]) => `<div class="li" data-c="${esc(c)}"><span class="av">✈</span><div class="t"><b>${esc(c)}</b><div>신고 ${s.size}건</div></div><span class="r">${s.size}</span></div>`).join('');
      file.classList.add('on'); bindX(); if (innerWidth < 900) file.classList.add('min'); file.querySelectorAll('.li[data-c]').forEach((el) => (el.onclick = () => country(el.dataset.c)));
      map.flyToBounds(L.latLngBounds([SE, ...list.map(([c]) => C[c]).filter((p) => p[1] < 200)]), { paddingTopLeft: [30, 100], paddingBottomRight: padBR(), duration: RM ? 0 : 1.2, maxZoom: 4 });
    },
    radar() {
      gFx.clearLayers(); gTop.clearLayers();
      const st = Object.fromEntries(people.map((m) => [m.id, statOf(m)]));
      const hit = (m) => st[m.id].ext > 0 || st[m.id].norep > 0;
      drawDots((m) => hit(m)); fitKR(true);
      const L2 = people.filter(hit).sort((a, b) => (st[b.id].ext * 2 + st[b.id].norep) - (st[a.id].ext * 2 + st[a.id].norep));
      const ne = people.filter((m) => st[m.id].ext).length, nn = people.filter((m) => st[m.id].norep).length;
      type(`레이더 가동 · 외부 비용 출장 ${ne}명 · 결과보고서 없이 신고 ${nn}명 감지`);
      file.innerHTML = fileHead('레이더 · 눈여겨볼 기록') + `<div class="ds">출장 비용을 외부(외국 정부·단체·기업 등)에서 냈거나, 신고할 때 결과보고서가 없던 기록이 있는 의원이에요. 규정상 허용될 수 있고 잘못을 뜻하지 않아요.</div>` + L2.slice(0, 40).map((m) => row(m, `${st[m.id].ext ? '외부 ' + st[m.id].ext : ''}${st[m.id].ext && st[m.id].norep ? ' · ' : ''}${st[m.id].norep ? '보고서 ' + st[m.id].norep : ''}`)).join('');
      file.classList.add('on'); bindX(); bindRows();
      // 훑는 레이더(캔버스)
      stopRadar(); if (RM) return;
      const cv = document.createElement('canvas'); cv.className = 'pg-radar'; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:600;pointer-events:none'; root.querySelector('.pg-map').after(cv);
      const g = cv.getContext('2d'); const size = () => { const r = devicePixelRatio || 1; cv.width = root.clientWidth * r; cv.height = root.clientHeight * r; g.setTransform(r, 0, 0, r, 0, 0); }; size();
      const t0 = performance.now(); let rev = -1, lastBlip = 0; const seen = new Set();
      const loop = (now) => {
        const r0 = Math.floor((now - t0) / 2600); if (r0 !== rev) { rev = r0; seen.clear(); SFX.ping(); }
        const c = map.latLngToContainerPoint([36.4, 127.8]), R = Math.max(root.clientWidth, root.clientHeight) * 0.6, a = ((now - t0) / 2600) * Math.PI * 2;
        g.clearRect(0, 0, cv.width, cv.height);
        const gr = g.createConicGradient ? g.createConicGradient(a - 0.9, c.x, c.y) : null;
        if (gr) { gr.addColorStop(0, 'rgba(93,255,158,0)'); gr.addColorStop(0.14, 'rgba(93,255,158,.28)'); gr.addColorStop(0.145, 'rgba(93,255,158,0)'); g.fillStyle = gr; g.beginPath(); g.arc(c.x, c.y, R, 0, 6.283); g.fill(); }
        g.strokeStyle = 'rgba(93,255,158,.18)'; for (const r of [R * 0.25, R * 0.5, R * 0.75]) { g.beginPath(); g.arc(c.x, c.y, r, 0, 6.283); g.stroke(); }
        g.strokeStyle = 'rgba(160,255,200,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x + R * Math.cos(a), c.y + R * Math.sin(a)); g.stroke(); g.lineWidth = 1;
        for (const m of L2) { const p = map.latLngToContainerPoint(LL[m.id]); let d = Math.atan2(p.y - c.y, p.x - c.x) - a; d = ((d % 6.283) + 6.283) % 6.283; const glow = Math.max(0, 1 - (6.283 - d) / 1.2); if (glow > 0) { g.fillStyle = `rgba(255,176,32,${0.9 * glow})`; g.beginPath(); g.arc(p.x, p.y, 7 + 10 * glow, 0, 6.283); g.fill(); if (glow > 0.9 && !seen.has(m.id) && now - lastBlip > 140) { seen.add(m.id); lastBlip = now; SFX.blip(); } } }
        radarRaf = requestAnimationFrame(loop);
      };
      radarRaf = requestAnimationFrame(loop);
    },
    party() {
      stopRadar(); gFx.clearLayers(); gTop.clearLayers(); fitKR(true); RSEG = 'party';
      const pf = ((flw && flw.flows) || []).filter((f) => f.kind === '경상보조금' && f.period === '3분기');
      const amt = Object.fromEntries(pf.map((f) => [f.to.party, f.amount]));
      const seats = {}; for (const m of people) seats[m.party] = (seats[m.party] || 0) + 1;
      const parties = Object.keys(seats).sort((a, b) => seats[b] - seats[a]);
      const mx = Math.max(1, ...Object.values(amt));
      let sel = null;
      const paint = () => {
        drawDots(sel ? (m) => m.party === sel : null);
        file.innerHTML = fileHead('순위') + segBar() + `<div class="ds">2026년 3분기 경상보조금: 정당이 3달마다 나라에서 받는 살림 돈이에요. 정당을 누르면 그 정당 의원만 지도에 남아요.</div>` + parties.map((p) => `<div class="pb li" data-p="${esc(p)}" style="display:block${sel && sel !== p ? ';opacity:.45' : ''}"><div class="h"><span><span style="color:${pc(p)}">●</span> ${esc(p)} <span style="color:#8fc9a5;font-size:11.5px">의석 ${seats[p]}</span></span><b>${amt[p] ? won(amt[p]) : '—'}</b></div><div class="tk"><i style="width:${amt[p] ? Math.max(2, amt[p] / mx * 100) : 0}%;background:${pc(p)}"></i></div></div>`).join('') + `<div class="fine">출처 중앙선거관리위원회 · 의석은 현재 기준</div>`;
        file.classList.add('on'); bindX(); bindSeg();
        file.querySelectorAll('[data-p]').forEach((el) => (el.onclick = () => { sel = sel === el.dataset.p ? null : el.dataset.p; paint(); type(sel ? `${sel} 의원 ${seats[sel]}명 표시` : '모든 정당 표시'); }));
      };
      paint(); type(`정당 ${parties.length}곳 · 3분기 경상보조금 합계 ${won(Object.values(amt).reduce((a, b) => a + b, 0))}`);
    },
    pres() {
      stopRadar(); gTop.clearLayers(); drawDots(() => false);
      const P = (prez && prez.presidents) || [];
      if (!P.length) { type('대통령 순방 자료를 불러오지 못했어요'); return; }
      const HOME = [37.44, 127.11]; // 서울공항(성남)
      const wrap = (ll) => [ll[0], ll[1] < -30 ? ll[1] + 360 : ll[1]]; // 아메리카는 태평양 쪽으로
      const tot = (p) => p.trips.reduce((a, t) => a + t.km, 0);
      const show = (p, only) => {
        const trips = only != null ? [p.trips[only]] : p.trips;
        const routes = [];
        for (const t of trips) { let prev = HOME; for (const st of t.stops) { const ll = wrap(st.ll); routes.push({ path: arc(prev, ll), w: 2, col: p.id === 'lee' ? '#5dff9e' : '#ffb020' }); prev = ll; } routes.push({ path: arc(prev, HOME), w: 1.2, col: p.id === 'lee' ? '#5dff9e' : '#ffb020' }); }
        SFX.whoosh(); fly(routes);
        const pts = [HOME, ...trips.flatMap((t) => t.stops.map((x) => wrap(x.ll)))];
        for (const t of trips) for (const st of t.stops) L.circleMarker(wrap(st.ll), { radius: 5, color: '#02110a', weight: 1, fillColor: p.id === 'lee' ? '#5dff9e' : '#ffb020', fillOpacity: 0.95 }).addTo(gTop).bindTooltip(esc(st.city), { direction: 'top', className: 'clab', offset: [0, -5], permanent: only != null });
        map.flyToBounds(L.latLngBounds(pts), { paddingTopLeft: [30, 100], paddingBottomRight: padBR(), duration: RM ? 0 : 1.1, maxZoom: only != null ? 4 : 3 });
        const k = tot(p);
        type(only != null ? `${p.name} ${p.trips[only].when} · ${p.trips[only].label} · ${p.trips[only].km.toLocaleString('ko-KR')}km` : `${p.name} 해외 순방 ${p.trips.length}번 · 약 ${Math.round(k / 10000).toLocaleString("ko-KR")}만 km · 지구 ${(k / 40075).toFixed(1)}바퀴`);
        return k;
      };
      let cur = 0;
      const paint = () => {
        const p = P[cur], k = tot(p);
        file.innerHTML = fileHead('대통령 해외 순방') + `<div class="act" style="margin:0 0 8px">${P.map((x, i) => `<button type="button" data-pi="${i}" class="${i === cur ? 'p' : ''}">${esc(x.name)} <span style="opacity:.75;font-weight:500;margin-left:4px">${esc(x.title)}</span></button>`).join('')}</div>
          <div class="st"><div><b>${p.trips.length}</b><span>해외 순방</span></div><div><b>${Math.round(k / 10000).toLocaleString('ko-KR')}만</b><span>날아간 거리(km, 어림)</span></div><div><b>${(k / 40075).toFixed(1)}</b><span>지구 몇 바퀴</span></div></div>
          <div class="ds">${esc(p.since)}${p.until ? ' ~ ' + esc(p.until) : ' ~ 지금'} · 서울공항에서 들른 도시를 차례로 이은 직선 거리예요.</div>` +
          p.trips.slice().reverse().map((t, ri) => { const i = p.trips.length - 1 - ri; return `<div class="li" data-ti="${i}"><span class="av">✈</span><div class="t"><b>${esc(t.when)}</b> <span style="font-size:12px;color:#cfe9d8">${esc(t.label)}</span><div>${esc(t.stops.map((x) => x.city).join(' → '))}</div></div><span class="r">${t.km.toLocaleString('ko-KR')}km</span></div>`; }).join('') +
          `<div class="fine">${esc((prez && prez.note) || '')} 출처: 대통령실 발표·언론 보도(${esc((prez && prez.updated) || '')}). 정상외교는 나라 일이고, 거리는 비교를 위한 어림값일 뿐 잘잘못을 뜻하지 않아요.</div>`;
        file.classList.add('on'); bindX(); if (innerWidth < 900) file.classList.add('min'); setTimeout(() => show(p), 60);
        file.querySelectorAll('[data-pi]').forEach((b) => (b.onclick = () => { cur = +b.dataset.pi; SFX.click(); gTop.clearLayers(); paint(); }));
        file.querySelectorAll('[data-ti]').forEach((el) => (el.onclick = () => { gTop.clearLayers(); show(P[cur], +el.dataset.ti); }));
      };
      paint();
    },
    async rank() {
      stopRadar(); gFx.clearLayers(); gTop.clearLayers();
      if (RSEG === 'party') return W.party();
      await Promise.all([secP, vrP]);
      const K = RANKS.find((x) => x.k === RSEG) || RANKS[0];
      const L0 = people.map((m) => [m, numOf(m)[K.k]]).filter(([, v]) => v != null);
      L0.sort((a, b) => (RDESC ? b[1] - a[1] : a[1] - b[1]) || a[0].name.localeCompare(b[0].name, 'ko'));
      const top = L0.slice(0, 20), ids = new Set(top.map(([m]) => m.id));
      drawDots((m) => ids.has(m.id)); fitKR(true);
      file.innerHTML = fileHead('순위') + segBar() + `<div class="ord"><button type="button" data-o="1" class="${RDESC ? 'on' : ''}">많은 순</button><button type="button" data-o="0" class="${RDESC ? '' : 'on'}">적은 순</button></div>` +
        top.map(([m, v], i) => row(m, `<span class="rk">${i + 1}</span>${K.f(v)}`)).join('') + `<div class="fine">${K.note} 공식 기록의 횟수일 뿐, 많고 적음이 잘하고 못함을 뜻하지 않아요.</div>`;
      file.classList.add('on'); bindX(); bindRows(); bindSeg();
      file.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { RDESC = b.dataset.o === '1'; SFX.click(); W.rank(); }));
      type(`${K.label} ${RDESC ? '많은' : '적은'} 순 20명 · 지도에 표시`);
    },
    find() {
      stopRadar(); gFx.clearLayers();
      const fl = people.filter((m) => FOL[m.id]);
      file.innerHTML = fileHead('찾기') + `<input class="q" type="search" placeholder="이름·동네·정당 (예: 분당, 동작구)" aria-label="의원 찾기" autocomplete="off">
        <button type="button" class="allb gps" style="margin:0 0 6px">📍 내 위치로 우리 동네 의원 찾기</button><div class="res"></div>
        ${fl.length ? `<div class="ph2">★ 팔로우</div>` + fl.map((m) => row(m)).join('') : ''}`;
      file.classList.add('on'); bindX();
      const q = file.querySelector('.q'), res = file.querySelector('.res');
      file.querySelector('.gps').onclick = (e) => {
        const bt = e.currentTarget; if (!navigator.geolocation) { bt.textContent = '이 기기에선 위치를 쓸 수 없어요'; return; }
        bt.textContent = '위치 확인 중…';
        navigator.geolocation.getCurrentPosition((p) => {
          const me = [p.coords.latitude, p.coords.longitude];
          const d2 = (a) => (a[0] - me[0]) ** 2 + ((a[1] - me[1]) * 0.8) ** 2;
          const loc = people.filter((m) => m.elect === '지역구' && pos[m.id]);
          if (!loc.length) { bt.textContent = '위치 자료가 없어요'; return; }
          const best = Math.min(...loc.map((m) => d2(pos[m.id])));
          const near = loc.filter((m) => d2(pos[m.id]) <= best + 0.0004).slice(0, 8);
          bt.textContent = '📍 내 근처 지역구 의원 (대략)';
          res.innerHTML = near.map((m) => row(m, statOf(m).n ? '✈ ' + statOf(m).n : '')).join('') + '<div class="fine">위치는 이 기기 안에서만 쓰고 저장하지 않아요. 지역구 중심과의 거리로 고른 대략값이라, 갑·을이 나뉜 곳은 여러 명이 나와요.</div>';
          bindRows(); if (near.length === 1) open(near[0]); else { reticle(LL[near[0].id]); map.flyTo(LL[near[0].id], 9, { duration: RM ? 0 : 0.9 }); }
          SFX.lock(); type(`우리 동네 의원 ${near.length}명 포착`);
        }, () => { bt.textContent = '위치 권한이 없어요 · 동네 이름으로 찾아보세요'; }, { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 });
      };
      const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
      const paint = () => { const n = norm(q.value); const L2 = n ? people.filter((m) => norm(m.name + m.district + m.party + (m.cmits || '')).includes(n)).slice(0, 30) : []; res.innerHTML = L2.map((m) => row(m, statOf(m).n ? '✈ ' + statOf(m).n : '')).join('') || (n ? '<div class="ds">못 찾았어요.</div>' : ''); bindRows(); };
      q.addEventListener('input', paint); if (innerWidth >= 900) setTimeout(() => q.focus(), 50); paint(); bindRows();
      type('검색 대기 중…');
    },
  };
  function country(c) {
    const ids = [...(ctry[c] || [])];
    if (C[c]) map.flyTo(C[c], 4, { duration: RM ? 0 : 0.9 });
    type(`${c} · 출장 신고 ${ids.length}건`);
    file.innerHTML = fileHead(`국가 파일 · ${c}`) + ids.map((id) => { const ts = byT[id], t = ts[0]; return `<div class="tr"><div class="d">${esc(t.dates || '')}</div><div class="p">${esc(String(t.purpose || '').slice(0, 80))}</div><div><span class="tg y">비용 낸 곳: ${esc(t.funder || '적힌 곳 없음')}</span></div>${ts.map((x) => { const m = people.find((p) => p.id === x.member_id); return m ? row(m) : `<div class="ds">${esc(x.name)} (${esc(x.party || '')})</div>`; }).join('')}</div>`; }).join('') + '<div class="fine">출처 열린국회정보 · 공개 기록일 뿐 잘잘못을 뜻하지 않아요</div>';
    file.classList.add('on'); bindX(); bindRows();
  }
  const snd = root.querySelector('.snd'); const paintSnd = () => { snd.classList.toggle('off', SFX.muted); snd.setAttribute('aria-pressed', String(!SFX.muted)); }; paintSnd(); snd.onclick = () => { SFX.toggle(); paintSnd(); if (!SFX.muted) SFX.click(); };
  // 파일 창이 열리면 컴퓨터에서는 지도를 창 왼쪽으로 줄여 가리지 않게, 휴대폰에서는 지도를 만지면 창을 접는다
  new MutationObserver(() => { const on = file.classList.contains('on'); if (root.classList.contains('fileon') !== on) { root.classList.toggle('fileon', on); setTimeout(() => { map.invalidateSize({ pan: false }); setMin(); }, 30); } }).observe(file, { attributes: true, attributeFilter: ['class'] });
  const mapEl = root.querySelector('.pg-map');
  ['touchstart', 'wheel'].forEach((ev) => mapEl.addEventListener(ev, () => { if (innerWidth < 900 && file.classList.contains('on')) file.classList.add('min'); }, { passive: true }));
  file.addEventListener('click', (e) => { if (file.classList.contains('min') && !e.target.closest('.x')) file.classList.remove('min'); });
  const btns = [...root.querySelectorAll('.pg-bar button')];
  const pick = (w, quiet) => { if (!quiet) SFX.click(); btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.w === w))); W[w](); };
  btns.forEach((b) => (b.onclick = () => pick(b.dataset.w)));
  addEventListener('keydown', (e) => { if (/input|textarea/i.test((e.target && e.target.tagName) || '')) return; const i = Number(e.key) - 1; if (i >= 0 && i < btns.length) pick(btns[i].dataset.w); if (e.key === 'Escape') { VSA = null; closeFile(); } });
  setTimeout(() => map.invalidateSize(), 300);
  addEventListener('resize', () => { map.invalidateSize(); setMin(); });

  // 아무나 추적: 지도 위 점들을 빠르게 훑다가(띡띡띡) 한 명에 조준
  const dice = root.querySelector('.pg-dice'); let rolling = false;
  dice.onclick = () => {
    if (rolling) return; rolling = true; dice.classList.add('spin'); dice.style.animation = 'none';
    closeFile(); gFx.clearLayers(); pick('mp', true);
    const pool = people.filter((m) => LL[m.id]);
    const flown = pool.filter((m) => statOf(m).n), rnd = (L) => L[Math.floor(Math.random() * L.length)];
    const target = flown.length && Math.random() < 0.8 ? rnd(flown) : rnd(pool); // 대개는 출장 기록이 있는 의원(보는 맛이 있게)
    if (!RM) map.flyTo(KR.getCenter(), Math.min(map.getZoom(), 7), { duration: 0.5 });
    const steps = RM ? 0 : 14; let k = 0;
    const hop = () => {
      if (k >= steps) { rolling = false; dice.classList.remove('spin'); open(target); return; }
      const m = pool[Math.floor(Math.random() * pool.length)]; reticle(LL[m.id]); SFX.blip(); type(`스캔 중… ${m.name}`);
      k++; setTimeout(hop, 60 + k * k * 2.2);
    };
    setTimeout(hop, RM ? 0 : 450);
  };
  pick('mp', true);
  const want = new URLSearchParams(location.search).get('mp');
  if (want) { const m = people.find((x) => x.name === want.trim()); if (m) setTimeout(() => open(m), 600); }
  const vq = (new URLSearchParams(location.search).get('vs') || '').split(',').map((x) => people.find((p) => p.name === x.trim()));
  if (!want && vq.length === 2 && vq[0] && vq[1]) setTimeout(() => vs(vq[0], vq[1]), 600);
  // 팔로우한 의원에게 새 소식(새 법안·새 출장)이 있으면 위에 한 줄로
  secP.then(() => {
    const news = people.filter((m) => FOL[m.id]).map((m) => { const n = numOf(m), o = FOL[m.id]; const nb = n.bill - o[0], nt = n.trip - o[1]; return nb > 0 || nt > 0 ? [m, [nb > 0 ? `새 법안 ${nb}건` : '', nt > 0 ? `새 출장 ${nt}건` : ''].filter(Boolean).join(' · ')] : null; }).filter(Boolean);
    if (!news.length) return;
    const el = document.createElement('button'); el.type = 'button'; el.className = 'pg-news';
    el.innerHTML = `<b>★</b> ${esc(news[0][0].name)} ${esc(news[0][1])}${news.length > 1 ? ` <span>외 ${news.length - 1}명</span>` : ''}`;
    el.onclick = () => { el.remove(); if (news.length > 1) pick('find'); else open(news[0][0]); };
    root.append(el); setTimeout(() => SFX.ping(), 400);
  });

})();
