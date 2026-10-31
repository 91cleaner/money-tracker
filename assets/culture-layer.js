/* 세금추적단 큰 지도에 얹는 '축제·영화 돈' 레이어. culture.html 과 같은 자료(data/culture/culture_map.json), 숫자를 새로 만들지 않음.
   기본은 모두 꺼짐. 주소에 ?cult=flow,fest,film,unit 을 붙이면 그 레이어를 켠 채로 열림. */
(function(){
if(window.__cultLayer)return;window.__cultLayer=1;
var SRC='https://www.mcst.go.kr/site/s_culture/festival/festivalList.jsp',GOV=[36.48,127.289];
var css='#pg .pg-bar button.cl-btn[aria-expanded="true"]{color:#eafff2;background:linear-gradient(180deg,rgba(255,176,32,.18),rgba(255,176,32,.05));box-shadow:inset 0 0 0 1px rgba(255,176,32,.45)}'+
'#cl-menu{position:absolute;z-index:790;left:50%;transform:translateX(-50%);bottom:84px;width:min(340px,calc(100% - 16px));max-height:calc(100% - 170px);overflow:auto;background:rgba(2,10,6,.96);border:1px solid #2a7a4a;border-radius:14px;padding:10px 12px;color:#dcffe8;font:14px/1.5 Pretendard,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)}'+
'#cl-menu[hidden]{display:none}#cl-menu h3{margin:0 0 2px;font-size:15px;color:#ffd08a}#cl-menu .s{margin:0 0 6px;font-size:12px;color:#8fc9a5}'+
'#cl-menu .t{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;margin:4px 0;padding:6px 10px;border-radius:12px;border:1px solid #24563a;background:rgba(93,255,158,.04);color:#a9d8bb;font:700 14px Pretendard,system-ui,sans-serif;text-align:left;cursor:pointer}'+
'#cl-menu .t i{width:14px;height:14px;border-radius:50%;flex:none}#cl-menu .t em{margin-left:auto;font-style:normal;font-weight:400;font-size:12px;color:#7fae92}'+
'#cl-menu .t[aria-pressed="true"]{color:#eafff2;background:linear-gradient(180deg,rgba(93,255,158,.16),rgba(93,255,158,.05));box-shadow:inset 0 0 0 1px rgba(93,255,158,.35)}'+
'#cl-menu .t[aria-pressed="true"]::after{content:"켜짐";font-size:11px;color:#5dff9e;margin-left:6px}'+
'#cl-menu .yr{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px}#cl-menu select{min-height:40px;background:#07180f;color:#e4ffe9;border:1px solid #3a6d4a;border-radius:8px;padding:0 8px;font-size:15px}'+
'#cl-menu details{font-size:12.5px;color:#bfe6cf;margin-top:6px}#cl-menu summary{min-height:40px;display:flex;align-items:center;cursor:pointer;font-weight:700;color:#9fe8bd}#cl-menu ul{padding-left:18px;margin:4px 0}#cl-menu a{color:#9bcef0}'+
'.cl-pop .leaflet-popup-content-wrapper,.cl-pop .leaflet-popup-tip{background:#06150c;color:#e8fff0;border:1px solid #2f7a4c}.cl-pop .leaflet-popup-content{font:14px/1.55 Pretendard,system-ui,sans-serif;margin:12px 14px}.cl-pop b{font-size:15px}.cl-pop a{color:#9bcef0}.cl-pop small{color:#a9cdb8}.cl-pop .u{color:#ffcc66;font-weight:700}.cl-pop .leaflet-popup-close-button{width:40px!important;height:40px!important;font-size:22px!important;color:#cfe!important}'+
'.cl-tip{background:#6b7280;color:#fff;border:0;font-weight:700;font-size:13px;box-shadow:none}.cl-tip::before{display:none}'+
'body.cl-open #gg-btn{display:none!important}'+'@media(max-height:500px){#cl-menu{bottom:76px;max-height:calc(100% - 100px);left:auto;right:8px;transform:none;width:min(320px,calc(100% - 16px))}}';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function won(w){if(!w)return '0원';if(w>=1e8){var e=w/1e8;return (e>=10?Math.round(e).toLocaleString():e.toFixed(1).replace(/\.0$/,''))+'억원'}return Math.round(w/1e4).toLocaleString()+'만원'}
function src(y){return '<br>출처: <a href="'+SRC+'" target="_blank" rel="noopener">문화체육관광부 '+y+'년 지역축제 개최계획</a>'}
function bend(a,b){var dx=b[1]-a[1],dy=b[0]-a[0],d=Math.hypot(dx,dy)||1,o=d*.3,c=[(a[0]+b[0])/2+dx/d*o,(a[1]+b[1])/2-dy/d*o],p=[];for(var t=0;t<=1.0001;t+=1/24){var u=1-t;p.push([u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]])}return p}
function init(map,root){
 var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
 var R=L.canvas({padding:.3}),G={flow:L.layerGroup(),fest:L.layerGroup(),film:L.layerGroup(),unit:L.layerGroup()},D=null,FX=null,on={};
 var bar=root.querySelector('.pg-bar');if(!bar)return;
 var b=document.createElement('button');b.type='button';b.className='cl-btn';b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','cl-menu');
 b.innerHTML='<span class="ic"><svg viewBox="0 0 24 24"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><circle cx="12" cy="9.5" r="1.6" class="dot"/></svg></span>축제·영화';bar.appendChild(b);
 var m=document.createElement('section');m.id='cl-menu';m.hidden=true;m.setAttribute('aria-label','축제·영화 돈 지도 켜고 끄기');
 m.innerHTML='<h3>축제·영화 돈 지도</h3><p class="s">보고 싶은 것만 켜요. 처음에는 모두 꺼져 있어요.</p>'+
 '<button type="button" class="t" data-k="flow"><i style="background:#f97316;border-radius:2px;height:5px"></i>국비가 축제로 가는 길<em id="cl-n-flow"></em></button>'+
 '<button type="button" class="t" data-k="fest"><i style="background:#f59e0b"></i>축제 계획예산<em id="cl-n-fest"></em></button>'+
 '<button type="button" class="t" data-k="film"><i style="background:#2563eb"></i>영화 지원금(영진위)<em id="cl-n-film"></em></button>'+
 '<button type="button" class="t" data-k="unit"><i style="background:#9ca3af"></i>단위 확인 필요<em id="cl-n-unit"></em></button>'+
 '<label class="yr">축제 연도 <select id="cl-year" aria-label="축제 연도"><option value="2026">2026년</option><option value="2024">2024년</option></select></label>'+
 '<details><summary>낱말 풀이와 주의할 점</summary><ul>'+
 '<li><b>국비</b>: 나라(정부)가 내는 돈이에요. 움직이는 빛은 돈이 정부(세종 표시)에서 각 지역 축제로 간다는 뜻이에요. 선이 굵을수록 금액이 커요.</li>'+
 '<li><b>계획예산</b>: 축제 전에 쓰겠다고 세운 돈이에요. 실제로 쓴 돈과 다를 수 있어요.</li>'+
 '<li><b>지방비</b>: 시도와 시군구가 내는 돈이에요. 축제 점을 누르면 보여요.</li>'+
 '<li><b>영진위</b>: 영화진흥위원회. 한국 영화를 돕는 공공기관이에요. <b>지원결정액</b>은 주기로 정한 돈이에요.</li>'+
 '<li><b>단위 확인 필요</b>: 숫자 단위가 잘못 들어갔을 수 있는 자료예요. 회색 점으로만 보여 주고 합계에서는 뺐어요.</li>'+
 '<li>점 위치는 시군구 중심점이에요. 정확한 장소가 아니에요. 개인은 \'개인\'으로만 적어요.</li>'+
 '<li>출연료 기사 사례와 더 자세한 설명은 <a href="culture.html">축제·영화 지도 따로 보기</a>에 있어요.</li></ul></details>';
 root.appendChild(m);
 L.DomEvent.disableClickPropagation(m);L.DomEvent.disableScrollPropagation(m);
 b.onclick=function(){var o=m.hidden;m.hidden=!o;b.setAttribute('aria-expanded',String(o));document.body.classList.toggle('cl-open',o);if(o)load()};
 var year=m.querySelector('#cl-year');
 function yr(){return +year.value}
 function dot(ll,w,col,html,rad){return L.circleMarker(ll,{renderer:R,radius:rad||Math.max(2.5,Math.sqrt(w)/4000),color:'#fff',weight:1,fillColor:col,fillOpacity:.6}).bindPopup(html,{maxWidth:280,className:'cl-pop'})}
 function drawFlow(){G.flow.clearLayers();var y=yr(),A={},arcs=[],n=0;
  D.fest.forEach(function(x){if(x[2]!==y||!(x[7]>0))return;var k=x[0]+','+x[1];A[k]=A[k]||{lat:x[0],lon:x[1],w:0,list:[],at:x[4]+(x[5]&&x[5]!='-'?' '+x[5]:'')};A[k].w+=x[7]*1e6;A[k].list.push(x[3]+' '+won(x[7]*1e6))});
  var L2=Object.keys(A).map(function(k){return A[k]}),max=Math.max.apply(null,[1].concat(L2.map(function(a){return a.w})));
  L2.sort(function(a,b){return a.w-b.w}).forEach(function(a,i){n++;var pts=bend(GOV,[a.lat,a.lon]),w=window.mtW?mtW(a.w,max):1.5+7*Math.sqrt(a.w/max);
   L.polyline(pts,{color:'#f97316',opacity:.75,weight:w,lineCap:'round'}).bindPopup('<b>국비 → '+esc(a.at)+'</b><br>'+y+'년 계획 국비 합계: '+won(a.w)+'<br><small>'+a.list.map(esc).join('<br>')+'<br>출발점은 정부를 뜻하는 표시예요(세종). 실제로 돈을 보낸 부처는 축제마다 다를 수 있어요.</small>'+src(y),{maxWidth:280,className:'cl-pop'}).addTo(G.flow);
   L.circleMarker([a.lat,a.lon],{radius:3+w/2.5,weight:1.5,color:'#fff',fillColor:'#f97316',fillOpacity:.95,interactive:false}).addTo(G.flow);
   arcs.push({pts:pts,w:w,col:'#ffb020',n:window.mtFxN?mtFxN(a.w,max):2,d:i*.02})});
  L.circleMarker(GOV,{radius:7,weight:2,color:'#fff',fillColor:'#ffb020',fillOpacity:1}).bindTooltip('정부(세종)',{permanent:true,direction:'left',className:'cl-tip'}).addTo(G.flow);
  document.getElementById('cl-n-flow').textContent=n+'곳';return arcs}
 function drawFest(){G.fest.clearLayers();var y=yr(),n=0;
  D.fest.filter(function(x){return x[2]===y&&x[6]>0}).sort(function(a,b){return b[6]-a[6]}).forEach(function(x){n++;var w=x[6]*1e6;
   dot([x[0],x[1]],w,'#f59e0b','<b>'+esc(x[3])+'</b><br>'+esc(x[4])+(x[5]&&x[5]!='-'?' '+esc(x[5]):'')+' · '+y+'년<br>계획예산: '+won(w)+'<br>국비 '+won((x[7]||0)*1e6)+' · 지방비 '+won((x[8]||0)*1e6)+src(y)).addTo(G.fest)});
  document.getElementById('cl-n-fest').textContent=n+'곳'}
 function drawUnit(){G.unit.clearLayers();var y=yr(),n=0;
  (D.sus||[]).forEach(function(x){if(x[1].indexOf('바우덕이')<0||x[0]!==y)return;n++;
   L.circleMarker([37.0078,127.28],{radius:9,color:'#fff',weight:1,fillColor:'#9ca3af',fillOpacity:.9}).bindTooltip('단위 확인 필요',{permanent:true,direction:'right',className:'cl-tip'}).bindPopup('<b>'+esc(x[1])+'</b><br>경기 안성시 · '+y+'년<br>원자료 값: '+x[2].toLocaleString()+'백만원 <span class="u">미확인</span><br><small>단위 확인 필요: 숫자 단위가 잘못 들어갔을 수 있어서 합계에서 뺐어요. 백만원은 원자료가 쓰는 단위예요(1백만원 = 100만원).</small>'+src(y),{maxWidth:280,className:'cl-pop'}).addTo(G.unit)});
  document.getElementById('cl-n-unit').textContent=n?n+'건':(y+'년 없음')}
 function drawFilm(){G.film.clearLayers();
  D.film.slice().sort(function(a,b){return b[5]-a[5]}).forEach(function(x,i){var j=((i*37)%11-5)*.002;
   dot([x[0]+j,x[1]-j],x[5],'#2563eb','<b>'+esc(x[4])+'</b><br>받은 곳: '+esc(x[3])+'<br>'+esc(x[2])+'<br>지원결정액: '+won(x[5])+'<br><small>점 위치: 회사 주소 시군구('+esc(x[6])+') 중심점. (가제)는 아직 정해지지 않은 임시 제목, 추경은 한 해 중간에 더 짠 예산이에요.</small><br>출처: <a href="'+esc(x[7])+'" target="_blank" rel="noopener">영화진흥위원회 심사결과 공지</a>').addTo(G.film)});
  document.getElementById('cl-n-film').textContent=D.film.length+'건'}
 var arcs=[];
 function fx(){if(!FX&&window.mtFX&&on.flow)FX=mtFX(map,map.getContainer());if(FX)FX.set(on.flow?arcs:[])}
 function redraw(){if(!D)return;arcs=drawFlow();drawFest();drawUnit();fx()}
 var loading=null;
 function load(){return loading||(loading=fetch('data/culture/culture_map.json?v=202610310030').then(function(r){return r.json()}).then(function(d){D=d;drawFilm();redraw()}))}
 function set(k,v){on[k]=v;var t=m.querySelector('[data-k="'+k+'"]');t.setAttribute('aria-pressed',String(v));
  load().then(function(){if(v){G[k].addTo(map);if(k!=='film'&&map.getZoom()<5.5)map.flyToBounds([[33,125],[38.7,130]],{duration:.6})}else map.removeLayer(G[k]);fx()})}
 [].forEach.call(m.querySelectorAll('.t'),function(t){t.setAttribute('aria-pressed','false');t.onclick=function(){set(t.dataset.k,t.getAttribute('aria-pressed')!=='true')}});
 year.onchange=redraw;
 window.__cult={on:function(k){return map.hasLayer(G[k])},set:set,open:function(k){var l=G[k].getLayers().filter(function(x){return x.getPopup&&x.getPopup()});if(l[0])l[0].openPopup(l[0].getLatLng?l[0].getLatLng():l[0].getCenter());return l.length}};
 var q=(location.search.match(/[?&]cult=([^&]+)/)||[])[1];
 if(q){decodeURIComponent(q).split(',').forEach(function(k){if(G[k])set(k,true)});m.hidden=false;b.setAttribute('aria-expanded','true');document.body.classList.add('cl-open')}
}
(function wait(n){var map=window.mtCommandMap,root=document.getElementById('pg');if(map&&root&&root.querySelector('.pg-bar'))init(map,root);else if(n<100)setTimeout(function(){wait(n+1)},150)})(0);
})();
