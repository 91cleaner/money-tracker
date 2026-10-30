(function(){
var C={fest:'#f59e0b',fee:'#e11d48',film:'#2563eb'},HOME=[[33.0,125.0],[38.7,130.0]];
var map=L.map('map',{zoomControl:true,preferCanvas:true});map.attributionControl.setPrefix(false);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'지도: &copy; OpenStreetMap 기여자'}).addTo(map);
function home(){map.fitBounds(HOME,innerWidth<600?{paddingBottomRight:[0,innerHeight*.4]}:{paddingBottomRight:[320,0]})}home();
document.getElementById('reset').onclick=function(){map.closePopup();home()};
function won(w){if(!w)return '0원';if(w>=1e8){var e=w/1e8;return (e>=10?Math.round(e).toLocaleString():e.toFixed(1).replace(/\.0$/,''))+'억원'}return Math.round(w/1e4).toLocaleString()+'만원'}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
// 원 넓이 ∝ 금액 → 반지름 ∝ √금액
function r(w,k){return Math.max(2.5,Math.sqrt(w)/k)}
var U=' <span class="u">미확인</span>',G={flow:L.layerGroup(),fest:L.layerGroup(),fee:L.layerGroup(),film:L.layerGroup()},D;
function dot(lat,lon,w,col,k,html){return L.circleMarker([lat,lon],{radius:r(w,k),color:'#fff',weight:1,fillColor:col,fillOpacity:.55}).bindPopup('<div class="cm-pop">'+html+'</div>',{maxWidth:300})}
function src(u,t){return '<br>출처: <a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(t)+'</a>'}
var GOV=[36.48,127.289];
function drawFlow(){G.flow.clearLayers();var y=+document.getElementById('year').value,A={},n=0;
 D.fest.forEach(function(x){if(x[2]!==y||!(x[7]>0))return;var k=x[0]+','+x[1];(A[k]=A[k]||{lat:x[0],lon:x[1],w:0,list:[],at:x[4]+(x[5]&&x[5]!='-'?' '+x[5]:'')});A[k].w+=x[7]*1e6;A[k].list.push(x[3]+' '+won(x[7]*1e6))});
 Object.keys(A).map(function(k){return A[k]}).sort(function(a,b){return a.w-b.w}).forEach(function(a){n++;
  L.polyline([GOV,[a.lat,a.lon]],{color:'#f97316',opacity:.7,weight:Math.max(1.5,Math.sqrt(a.w)/5000)}).bindPopup('<div class="cm-pop"><b>국비 → '+esc(a.at)+'</b><br>'+y+'년 계획 국비 합계: '+won(a.w)+'<br><small>'+a.list.map(esc).join('<br>')+'</small><br><small>출발점은 정부를 뜻하는 표시예요(세종). 실제로 돈을 보낸 부처는 축제마다 다를 수 있어요.</small>'+src('https://www.mcst.go.kr/site/s_culture/festival/festivalList.jsp','문화체육관광부 '+y+'년 지역축제 개최계획')+'</div>',{maxWidth:300}).addTo(G.flow)});
 document.getElementById('n-flow').textContent=n+'곳'}
function drawFest(){drawFlow();G.fest.clearLayers();var y=+document.getElementById('year').value,n=0;
 D.fest.filter(function(x){return x[2]===y&&x[6]>0}).sort(function(a,b){return b[6]-a[6]}).forEach(function(x){n++;var w=x[6]*1e6;
  dot(x[0],x[1],w,C.fest,4000,'<b>'+esc(x[3])+'</b><br>'+esc(x[4])+(x[5]&&x[5]!='-'?' '+esc(x[5]):'')+' · '+y+'년<br>계획예산: '+won(w)+'<br>국비 '+won((x[7]||0)*1e6)+' · 지방비 '+won((x[8]||0)*1e6)+src('https://www.mcst.go.kr/site/s_culture/festival/festivalList.jsp','문화체육관광부 '+y+'년 지역축제 개최계획')).addTo(G.fest)});
 (D.sus||[]).forEach(function(x){if(x[1].indexOf('바우덕이')<0||x[0]!==y)return;L.circleMarker([37.0078,127.28],{radius:9,color:'#fff',weight:1,fillColor:'#9ca3af',fillOpacity:.9}).bindTooltip('단위 확인 필요',{permanent:true,direction:'right',className:'cm-tip'}).bindPopup('<div class="cm-pop"><b>'+esc(x[1])+'</b><br>경기 안성시 · '+y+'년<br>원자료 값: '+x[2].toLocaleString()+'백만원'+U+'<br><small>단위 확인 필요: 숫자 단위가 잘못 들어갔을 수 있어서 합계에서 뺐어요.</small>'+src('https://www.mcst.go.kr/site/s_culture/festival/festivalList.jsp','문화체육관광부 '+y+'년 지역축제 개최계획')+'</div>',{maxWidth:300}).addTo(G.fest)});
 document.getElementById('n-fest').textContent=n+'곳'}
fetch('data/culture/culture_map.json?v=202610310010').then(function(r){return r.json()}).then(function(d){D=d;drawFest();
 d.fee.forEach(function(x){dot(x[0],x[1],x[5],C.fee,4000,'<b>'+esc(x[3])+'</b><br>'+esc(x[4])+(x[2]?' · '+x[2]+'년':'')+'<br>기사 속 출연료: '+esc(x[6])+U+'<br><small>기사에 나온 숫자예요. 공식 통계가 아니에요.'+(x[8]?'<br>'+esc(x[8]):'')+'</small>'+src(x[7],'기사 보기')).addTo(G.fee)});
 d.film.sort(function(a,b){return b[5]-a[5]}).forEach(function(x){dot(x[0]+(Math.random()-.5)*.02,x[1]+(Math.random()-.5)*.02,x[5],C.film,4000,'<b>'+esc(x[4])+'</b><br>받은 곳: '+esc(x[3])+'<br>'+esc(x[2])+'<br>지원결정액: '+won(x[5])+'<br><small>회사 주소 시군구('+esc(x[6])+') 중심점</small>'+src(x[7],'영화진흥위원회 심사결과 공지')).addTo(G.film)});
 document.getElementById('n-fee').textContent=d.fee.length+'건';document.getElementById('n-film').textContent=d.film.length+'건';
 Object.keys(G).forEach(function(k){G[k].addTo(map)});
});
window.__cmOn=function(k){return map.hasLayer(G[k])};window.__cm=function(k){var l=G[k||'film'].getLayers();if(l[0])l[0].openPopup();return l.length};
document.getElementById('year').onchange=drawFest;
[].forEach.call(document.querySelectorAll('[data-l]'),function(c){c.onchange=function(){var g=G[c.dataset.l];c.checked?g.addTo(map):map.removeLayer(g)}});
})();
