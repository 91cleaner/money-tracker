/* 경기도 재정 자금줄 레이어. 사실만, 출처 링크 포함. */
(function(){
if(window.__ggFlow)return;window.__ggFlow=1;
var H={id:'hub',t:'경기도',a:'2회 추경 의결 총액 42조2,053억 (10/12)',d:'도 재정 중심점. 선이나 점을 누르면 금액과 출처가 나옵니다.',u:'https://gnews.gg.go.kr/news/news_detail_m.do?number=202610191006136004C071&s_code=daily',s:'경기도뉴스포털'};
var N=[
{id:'tax',dir:'in',x:70,y:70,t:'세수',a:'세수 결손 예상 약 3,000억',d:'2026-08-19 2회 추경 브리핑 기준, 예상치',u:'https://www.kyeonggi.com/article/20260819580191',s:'경기일보'},
{id:'bond',dir:'in',x:70,y:230,t:'지방채',a:'2038년까지 지방채·기금 차입 상환액 7조415억',d:'2025 지방채 발행 9,430억, 한도 9,460억의 99.6%',u:'https://www.yna.co.kr/view/AKR20260805145000061',s:'연합뉴스'},
{id:'bus',dir:'out',x:430,y:50,t:'시내버스 공공관리제 지원',a:'2026 약 3,120억 (2025 2,439억)',d:'버스 2026-10-30 합의, 시급 3.2% 인상',u:'https://www.yna.co.kr/view/AKR20261030004300061',s:'연합뉴스'},
{id:'cut',dir:'out',x:430,y:150,t:'2회 추경 감액 사업',a:'1,300여 개 사업 5,465억 감액',d:'2회 추경안 기준. 10/12 의결 총액 42조2,053억',u:'https://gnews.gg.go.kr/news/news_detail_m.do?number=202610191006136004C071&s_code=daily',s:'경기도뉴스포털'},
{id:'pr',dir:'out',x:430,y:250,t:'대변인실 홍보비',a:'21억5,000만원 증액',d:'2026 본예산 심사. 다른 실국 홍보비는 삭감',u:'https://www.etoday.co.kr/news/view/2534346',s:'이투데이'}];
var css='#gg-btn{position:fixed;right:12px;top:calc(120px + env(safe-area-inset-top,0px));z-index:9998;border:1px solid #5dff9e;background:#0b2416;color:#dfffea;font:800 13px Pretendard,system-ui,sans-serif;padding:10px 13px;border-radius:12px;cursor:pointer;box-shadow:0 6px 20px #0008}'+
'#gg-layer{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:#020805d9;padding:10px}#gg-layer.on{display:flex}'+
'#gg-box{position:relative;width:min(100%,560px);background:#06150c;border:1px solid #2f7a4c;border-radius:16px;padding:12px;color:#e8fff0;font-family:Pretendard,system-ui,sans-serif}'+
'#gg-box h2{margin:0 0 4px;font-size:16px}#gg-box .sub{font-size:11px;color:#8fc9a5;margin:0 0 6px}#gg-x{position:absolute;right:10px;top:8px;background:none;border:0;color:#cfe;font-size:20px;cursor:pointer}'+
'#gg-svg{width:100%;height:auto;display:block}#gg-svg .ln{cursor:pointer}#gg-svg .ln path.v{fill:none;stroke-width:4}#gg-svg .ln path.h{fill:none;stroke:transparent;stroke-width:18}#gg-svg .nd{cursor:pointer}#gg-svg text{fill:#e8fff0;font-size:12px;font-weight:700;pointer-events:none}'+
'#gg-svg .sel path.v{stroke-width:7}#gg-svg .nd.sel circle{stroke:#fff;stroke-width:3}'+
'#gg-card{position:relative;margin-top:8px;min-height:96px;background:#0d2216;border:1px solid #5dff9e;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.5;display:none}#gg-card.on{display:block}#gg-card b{display:block;font-size:14px}#gg-card .amt{color:#a6ffca;font-weight:800}#gg-card a{color:#9bcef0}#gg-card .c{position:absolute;right:8px;top:4px;background:none;border:0;color:#cfe;font-size:16px;cursor:pointer}';
function el(t,a){var e=document.createElementNS('http://www.w3.org/2000/svg',t);for(var k in a)e.setAttribute(k,a[k]);return e}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function init(){
var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
var b=document.createElement('button');b.id='gg-btn';b.type='button';b.textContent='경기도 재정 자금줄';document.body.appendChild(b);
var L=document.createElement('div');L.id='gg-layer';L.setAttribute('role','dialog');L.setAttribute('aria-label','경기도 재정 자금줄');
L.innerHTML='<div id="gg-box"><button id="gg-x" type="button" aria-label="닫기">×</button><h2>경기도 재정 자금줄</h2><p class="sub">들어오는 돈(파랑) · 나가는 돈(주황) · 점이나 선을 누르면 금액과 출처</p><div id="gg-card" role="status"></div></div>';
document.body.appendChild(L);
var box=L.querySelector('#gg-box'),card=L.querySelector('#gg-card');
var svg=el('svg',{id:'gg-svg',viewBox:'0 20 500 270'});box.insertBefore(svg,card);
var cx=250,cy=150,sel=null;
function show(o,g){if(sel)sel.classList.remove('sel');sel=g;g.classList.add('sel');
card.innerHTML='<button class="c" type="button" aria-label="카드 닫기">×</button><b>'+esc(o.t)+'</b><div class="amt">'+esc(o.a)+'</div><div>'+esc(o.d)+'</div><a href="'+esc(o.u)+'" target="_blank" rel="noopener">출처: '+esc(o.s)+'</a>';
card.classList.add('on');card.querySelector('.c').onclick=function(){card.classList.remove('on');if(sel)sel.classList.remove('sel');sel=null}}
N.forEach(function(o){var col=o.dir=='in'?'#5ab0ff':'#ffa04d';
var d='M'+(o.dir=='in'?o.x+12:cx+22)+' '+(o.dir=='in'?o.y:cy)+' L'+(o.dir=='in'?cx-22:o.x-12)+' '+(o.dir=='in'?cy:o.y);
var g=el('g',{'class':'ln','data-id':o.id,tabindex:0});g.appendChild(el('path',{'class':'h',d:d}));g.appendChild(el('path',{'class':'v',d:d,stroke:col,'stroke-dasharray':'8 5'}));
g.addEventListener('click',function(){show(o,g)});svg.appendChild(g);});
N.forEach(function(o){var col=o.dir=='in'?'#5ab0ff':'#ffa04d';var g=el('g',{'class':'nd','data-id':o.id,tabindex:0});
g.appendChild(el('circle',{cx:o.x,cy:o.y,r:11,fill:col}));
var t=el('text',{x:o.dir=='in'?o.x-12:o.x+12,y:o.y-17,'text-anchor':o.dir=='in'?'start':'end'});t.textContent=o.t;g.appendChild(t);
g.addEventListener('click',function(){show(o,g)});svg.appendChild(g);});
var hg=el('g',{'class':'nd','data-id':'hub',tabindex:0});hg.appendChild(el('circle',{cx:cx,cy:cy,r:22,fill:'#5dff9e'}));var ht=el('text',{x:cx,y:cy+40,'text-anchor':'middle'});ht.textContent='경기도';hg.appendChild(ht);
hg.addEventListener('click',function(){show(H,hg)});svg.appendChild(hg);
svg.addEventListener('keydown',function(e){if(e.key=='Enter'&&e.target.dispatchEvent)e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
function open(){L.classList.add('on')}function close(){L.classList.remove('on')}
b.onclick=open;L.querySelector('#gg-x').onclick=close;L.addEventListener('click',function(e){if(e.target===L)close()});
if(/[?&#]gg=1|#gg-flow/.test(location.href))open();
}
if(document.readyState=='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
