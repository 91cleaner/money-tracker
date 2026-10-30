(function(){
var C={fest:'#f59e0b',fee:'#e11d48',film:'#2563eb'},HOME=[[33.0,125.0],[38.7,130.0]];
var map=L.map('map',{zoomControl:true,preferCanvas:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(map);
function home(){map.fitBounds(HOME,innerWidth<600?{paddingBottomRight:[0,innerHeight*.4]}:{paddingBottomRight:[320,0]})}home();
document.getElementById('reset').onclick=function(){map.closePopup();home()};
function won(w){if(w>=1e8){var e=w/1e8;return (e>=10?Math.round(e).toLocaleString():e.toFixed(1).replace(/\.0$/,''))+'억원'}return Math.round(w/1e4).toLocaleString()+'만원'}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
// 원 넓이 ∝ 금액 → 반지름 ∝ √금액
function r(w,k){return Math.max(2.5,Math.sqrt(w)/k)}
var U=' <span class="u">미확인</span>',G={fest:L.layerGroup(),fee:L.layerGroup(),film:L.layerGroup()},D;
function dot(lat,lon,w,col,k,html){return L.circleMarker([lat,lon],{radius:r(w,k),color:'#fff',weight:1,fillColor:col,fillOpacity:.55}).bindPopup('<div class="cm-pop">'+html+'</div>',{maxWidth:300})}
function src(u,t){return '<br>출처: <a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(t)+'</a>'}
function drawFest(){G.fest.clearLayers();var y=+document.getElementById('year').value,n=0;
 D.fest.filter(function(x){return x[2]===y&&x[6]>0}).sort(function(a,b){return b[6]-a[6]}).forEach(function(x){n++;var w=x[6]*1e6;
  dot(x[0],x[1],w,C.fest,4000,'<b>'+esc(x[3])+'</b><br>'+esc(x[4])+(x[5]&&x[5]!='-'?' '+esc(x[5]):'')+' · '+y+'년<br>계획예산: '+won(w)+U+'<br>국비 '+won((x[7]||0)*1e6)+' · 지방비 '+won((x[8]||0)*1e6)+src('https://www.mcst.go.kr/site/s_culture/festival/festivalList.jsp','문화체육관광부 '+y+'년 지역축제 개최계획')).addTo(G.fest)});
 document.getElementById('n-fest').textContent=n+'곳'}
fetch('data/culture/culture_map.json?v=202610302330').then(function(r){return r.json()}).then(function(d){D=d;drawFest();
 d.fee.forEach(function(x){dot(x[0],x[1],x[5],C.fee,4000,'<b>'+esc(x[3])+'</b><br>'+esc(x[4])+(x[2]?' · '+x[2]+'년':'')+'<br>기사 속 출연료: '+esc(x[6])+U+'<br><small>보도됨 · 공식 통계 아님'+(x[8]?'<br>'+esc(x[8]):'')+'</small>'+src(x[7],'기사 보기')).addTo(G.fee)});
 d.film.sort(function(a,b){return b[5]-a[5]}).forEach(function(x){dot(x[0]+(Math.random()-.5)*.02,x[1]+(Math.random()-.5)*.02,x[5],C.film,4000,'<b>'+esc(x[4])+'</b><br>받은 곳: '+esc(x[3])+'<br>'+esc(x[2])+'<br>지원결정액: '+won(x[5])+U+'<br><small>회사 주소 시군구('+esc(x[6])+') 중심점</small>'+src(x[7],'영화진흥위원회 심사결과 공지')).addTo(G.film)});
 document.getElementById('n-fee').textContent=d.fee.length+'건';document.getElementById('n-film').textContent=d.film.length+'건';
 Object.keys(G).forEach(function(k){G[k].addTo(map)});
});
document.getElementById('year').onchange=drawFest;
[].forEach.call(document.querySelectorAll('[data-l]'),function(c){c.onchange=function(){var g=G[c.dataset.l];c.checked?g.addTo(map):map.removeLayer(g)}});
})();
