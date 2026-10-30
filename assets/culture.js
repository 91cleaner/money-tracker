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
var L2=L.layerGroup(),LB=[];
function eok(m){var e=m/100;return (e>=100?Math.round(e).toLocaleString():e.toFixed(1))+'억'}
function placeLabels(){L2.clearLayers();var used=[],z=map.getZoom(),max=z<=7?(innerWidth<600?12:25):80;var cnt=0;
 LB.filter(function(b){return map.hasLayer(G[b.k])}).sort(function(a,b){return b.v-a.v}).forEach(function(b){if(cnt>=max)return;var p=map.latLngToContainerPoint(b.ll),w=b.t.length*7+12,h=18,R=[p.x-w/2,p.y-h/2,p.x+w/2,p.y+h/2];
  var sz=map.getSize();if(R[0]<0||R[1]<0||R[2]>sz.x||R[3]>sz.y)return;
  if(used.some(function(u){return !(R[2]<u[0]||R[0]>u[2]||R[3]<u[1]||R[1]>u[3])}))return;used.push(R);cnt++;
  L.marker(b.ll,{icon:L.divIcon({className:'cm-lbl'+(b.k=='film'?' f':''),html:'<span>'+b.t+'</span>',iconSize:[0,0]}),interactive:false,keyboard:false}).addTo(L2)})}
fetch('data/culture/culture_stats.json?v=202610310840').then(function(r){return r.json()}).then(function(S){
 var u='<span class="u">미확인</span>',F=S.fest,FL=S.film;
 document.getElementById('sum').innerHTML='<h2>2026 축제 계획예산 합계</h2><div class="big">'+eok(F.w)+'원'+u+'</div><small>축제 '+F.n.toLocaleString()+'건 · 국비 '+eok(F.g)+' · 지방비 '+eok(F.l)+' · 기타 '+eok(F.e)+'</small><small>팩트체크 끝난 숫자는 1,237건 · 5,853억원이에요. 새로 센 숫자는 아직 확인 전이라 미확인이에요.</small><hr><h2>2026 영진위 지원결정액 합계</h2><div class="big">'+(FL.w/1e8).toFixed(1)+'억원'+u+'</div><small>'+FL.n+'건 (팩트체크 끝난 건 70건)</small>';
 var t=function(head,rows){return '<table><tr>'+head.map(function(x){return '<th>'+x+'</th>'}).join('')+'</tr>'+rows.join('')+'</table>'},td=function(a){return '<tr>'+a.map(function(x,i){return '<td'+(i&&typeof x!='string'||/억|건$/.test(x)?' class="n"':'')+'>'+x+'</td>'}).join('')+'</tr>'};
 document.getElementById('statsBody').innerHTML='<p>모든 숫자는 2026년 계획·결정 금액이에요. 아직 팩트체크 전이라 전부 <span class="u">미확인</span>이에요. 개인은 이름 없이 \'개인\'으로만 적어요.</p>'+
 '<h2>시도별 축제 예산 합계</h2>'+t(['순위','시도','축제 수','예산','국비'],S.sido.map(function(a,i){return td([i+1,a[0],a[1]+'건',eok(a[2]),eok(a[3])])}))+
 '<h2>시군구별 축제 예산 순위</h2>'+t(['순위','시군구','축제 수','예산'],S.sgg.map(function(a,i){return td([i+1,esc(a[0]),a[1]+'건',eok(a[2])])}))+
 '<h2>예산이 큰 축제 TOP 20</h2>'+t(['순위','축제','지역','예산'],S.topfest.map(function(a,i){return td([i+1,esc(a[0])+(a[0].indexOf('바우덕이')>=0?' <span class="u">단위 확인 필요</span>':''),esc(a[1]),eok(a[2])])}))+
 '<h2>영진위 지원을 많이 받은 곳</h2>'+t(['순위','받은 곳','건수','지원결정액'],S.co.map(function(a,i){return td([i+1,esc(a[0])+(a[0]=='개인'?' (여러 명 합계)':''),a[1]+'건',(a[2]/1e8).toFixed(1).replace(/\.0$/,'')+'억'])}))+
 '<p>출처: 문화체육관광부 2026년 지역축제 개최계획, 영화진흥위원회 심사결과 공지</p>';
 S.sggpt.forEach(function(a){if(a[0].indexOf('안성')>=0)return;LB.push({k:'fest',ll:[a[1],a[2]],v:a[3],t:eok(a[3])})});
 L2.addTo(map);placeLabels()});
var FA={};
function filmLabels(){if(!D)return setTimeout(filmLabels,300);LB=LB.filter(function(b){return b.k!='film'});FA={};D.film.forEach(function(x){var k=x[6];(FA[k]=FA[k]||{ll:[x[0],x[1]],v:0}).v+=x[5]});Object.keys(FA).forEach(function(k){LB.push({k:'film',ll:FA[k].ll,v:FA[k].v/1e6,t:(FA[k].v/1e8).toFixed(1).replace(/\.0$/,'')+'억'})});placeLabels()}
filmLabels();
map.on('zoomend moveend overlayadd',placeLabels);
document.getElementById('openStats').onclick=function(){document.getElementById('stats').hidden=false};
document.getElementById('closeStats').onclick=function(){document.getElementById('stats').hidden=true};
[].forEach.call(document.querySelectorAll('[data-l]'),function(c){c.addEventListener('change',placeLabels)});

[].forEach.call(document.querySelectorAll('[data-l]'),function(c){c.onchange=function(){var g=G[c.dataset.l];c.checked?g.addTo(map):map.removeLayer(g)}});
})();
