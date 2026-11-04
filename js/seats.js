/* 의석 좌우 지도: 우파/좌파 버튼, 나라를 아래에서부터 의석 비율만큼 채워요. 자료: data/seats.json (의석: 각 선거 위키백과 문서, 좌우 점수: CHES 2024·ParlGov·V-Party) */
(function(){
var after=document.getElementById('warBox');if(!after)return;
var box=document.createElement('div');box.id='seatBox';box.style.marginTop='8px';after.parentNode.insertBefore(box,after.nextSibling);
var st=document.createElement('style');st.textContent='#seatBtns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}#seatBtns[hidden]{display:none}#seatBtns button{min-height:44px;border-radius:10px;border:2px solid transparent;color:#fff;font:700 15px system-ui,sans-serif;cursor:pointer}#seatBtns .r{background:#b03a2e}#seatBtns .l{background:#1f4e8c}#seatBtns button.on{border-color:#fff}'+
'#seatCard{position:fixed;left:12px;bottom:70px;z-index:1200;width:280px;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4)}#seatCard .x{float:right;min-width:76px;height:44px;font-size:16px;font-weight:800;border-radius:10px;cursor:pointer}';
document.head.appendChild(st);
box.innerHTML='<button type="button" class="btn prime" id="seatOpen" style="width:100%;min-height:44px">의석 좌우 지도<span style="display:block;font-weight:400;font-size:11px;opacity:.75">최근 하원 선거 결과</span></button><div id="seatBtns" hidden><button type="button" class="r" data-s="R">우파</button><button type="button" class="l" data-s="L">좌파</button></div>';
var D=null,ly=null,cur=null,C={R:'#b03a2e',L:'#1f4e8c'};
var B=document.getElementById('seatBtns');
function off(){var m=window.mtMap;if(ly&&m)m.removeLayer(ly);ly=null;cur=null;B.querySelectorAll('button').forEach(function(b){b.classList.remove('on')});var k=document.getElementById('seatCard');if(k)k.remove();restorePts()}
function pct(a,t){return Math.round(a/t*1000)/10}
var SN={L:'좌파',R:'우파',U:'분류 안 됨'};
function card(c){var k=document.getElementById('seatCard');if(!k){k=document.createElement('div');k.id='seatCard';document.body.appendChild(k)}
 var h='<button type="button" class="x">닫기</button><b style="font-size:15px">'+c.n+'</b>';
 if(c.nc){h+='<div><span>일당제 또는 경쟁 선거가 없는 나라라서 색을 칠하지 않았어요.</span></div><div><span>출처</span>: <a href="'+c.su+'" target="_blank" rel="noopener">Wikipedia</a></div>'}
 else{h+='<div>'+(cur=='R'?'<span>우파</span>':'<span>좌파</span>')+' <b>'+pct(c[cur],c.tot)+'%</b> ('+c[cur]+' / '+c.tot+')</div><div><span>선거일</span>: '+c.d+'</div>'+(c.U?'<div style="font-size:12px;opacity:.75"><span>분류 안 된 의석</span>: '+c.U+'</div>':'')+
 '<div style="font-size:12px;max-height:110px;overflow:auto;margin-top:4px">'+c.p.filter(function(p){return p[1]>0}).map(function(p){return ((window.mtLang||document.documentElement.lang)=='en'||!p[6]?p[0]:p[6])+' '+p[1]+' · <span>'+SN[p[2]]+'</span>'+(p[3]?' ('+D.sc[p[3]][0]+' '+p[4]+(p[5]?', <span>연합은 대표 정당 점수</span>':'')+')':'')}).join('<br>')+'</div>'+
 (c.note?'<div style="font-size:12px;background:#fff3cd;padding:3px 6px;border-radius:6px;margin-top:4px"><span>'+c.note[0]+'</span></div>':'')+(c.vn&&!c.note?'<div style="font-size:12px;background:#fff3cd;padding:3px 6px;border-radius:6px;margin-top:4px"><span>V-Party 경제 축 점수만 있고 정당 간 차이가 작거나 정당이 하나뿐이라 칠하지 않았어요.</span></div>':'')+'<div><span>의석 출처</span>: <a href="'+c.su+'" target="_blank" rel="noopener">Wikipedia: '+c.eu+'</a></div>'+
 '<div style="font-size:12px;opacity:.75"><span>좌우 점수: 유럽은 CHES 2024를 먼저, 없으면 ParlGov(전문가 점수), 다른 나라는 ParlGov, 없으면 V-Party(경제 좌우, 0~6)를 써요. 0~10 점수는 5±0.5 안이면 가운데로 보고 다음 자료를 봐요. V-Party는 가장 가까운 단계로 읽어 2.5 미만은 좌파, 3.5 초과는 우파, 그 사이는 분류 안 함이에요. V-Party만 있는 나라에서 정당 점수 차이가 1 미만이거나 정당이 하나뿐이면 칠하지 않아요.</span></div>'}
 k.innerHTML=h;k.querySelector('.x').onclick=function(){k.remove()}}
var SV=null,TG=['planeTg','shipTg','cableTg','liveTg','confTg','gpsTg','zoneTg','fireTg','quakeTg'];
function hidePts(){if(SV)return;SV={};TG.forEach(function(i){var e=document.getElementById(i);if(!e)return;SV[i]=e.checked;if(e.checked){e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}))}})}
function restorePts(){if(!SV)return;TG.forEach(function(i){var e=document.getElementById(i);if(e&&SV[i]&&!e.checked){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}});SV=null}
function draw(s){var m=window.mtMap;hidePts();if(!m)return;if(ly)m.removeLayer(ly);cur=s;ly=L.layerGroup();
 if(!m.getPane('seat'))m.createPane('seat').style.zIndex=390;
 D.cases.forEach(function(c){
  if(c.nc){L.polygon(c.o,{pane:'seat',color:'#888',weight:1.5,dashArray:'4 4',fillOpacity:0}).on('click',function(){card(c)}).addTo(ly);return}
  c['f'+s].forEach(function(r){L.polygon(r,{pane:'seat',stroke:false,fillColor:C[s],fillOpacity:.75,interactive:false}).addTo(ly)});
  L.polygon(c.o,{pane:'seat',color:C[s],weight:1.5,fillColor:'#000',fillOpacity:.15}).on('click',function(){card(c)}).addTo(ly)});
 ly.addTo(m);m.setView([28,150],Math.max(1,Math.floor(Math.log2(m.getSize().x/256)*4)/4));var k=document.getElementById('seatCard');if(k)k.remove()}
document.getElementById('seatOpen').onclick=function(){if(!B.hidden){B.hidden=true;off();return}B.hidden=false};
B.querySelectorAll('button').forEach(function(b){b.onclick=function(){B.querySelectorAll('button').forEach(function(o){o.classList.toggle('on',o==b)});
 (D?Promise.resolve(D):fetch('data/seats.json').then(function(r){return r.json()}).then(function(j){D=j;return j})).then(function(){draw(b.dataset.s)})}});
})();
