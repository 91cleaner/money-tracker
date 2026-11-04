/* 의석 좌우 지도: 우파/좌파 버튼, 나라를 아래에서부터 의석 비율만큼 채워요. 자료: data/seats.json (ParlGov) */
(function(){
var after=document.getElementById('warBox');if(!after)return;
var box=document.createElement('div');box.id='seatBox';box.style.marginTop='8px';after.parentNode.insertBefore(box,after.nextSibling);
var st=document.createElement('style');st.textContent='#seatBtns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}#seatBtns[hidden]{display:none}#seatBtns button{min-height:44px;border-radius:10px;border:2px solid transparent;color:#fff;font:700 15px system-ui,sans-serif;cursor:pointer}#seatBtns .r{background:#b03a2e}#seatBtns .l{background:#1f4e8c}#seatBtns button.on{border-color:#fff}'+
'#seatCard{position:fixed;left:12px;bottom:70px;z-index:1200;width:280px;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4)}#seatCard .x{float:right;min-width:76px;height:44px;font-size:16px;font-weight:800;border-radius:10px;cursor:pointer}';
document.head.appendChild(st);
box.innerHTML='<button type="button" class="btn prime" id="seatOpen" style="width:100%;min-height:44px">의석 좌우 지도<span style="display:block;font-weight:400;font-size:11px;opacity:.75">ParlGov 자료가 있는 나라</span></button><div id="seatBtns" hidden><button type="button" class="r" data-s="R">우파</button><button type="button" class="l" data-s="L">좌파</button></div>';
var D=null,ly=null,cur=null,C={R:'#b03a2e',L:'#1f4e8c'};
var B=document.getElementById('seatBtns');
function off(){var m=window.mtMap;if(ly&&m)m.removeLayer(ly);ly=null;cur=null;B.querySelectorAll('button').forEach(function(b){b.classList.remove('on')});var k=document.getElementById('seatCard');if(k)k.remove()}
function pct(a,t){return Math.round(a/t*1000)/10}
function card(c){var k=document.getElementById('seatCard');if(!k){k=document.createElement('div');k.id='seatCard';document.body.appendChild(k)}
 k.innerHTML='<button type="button" class="x">닫기</button><b style="font-size:15px">'+c.n+'</b><div>'+(cur=='R'?'<span>우파</span>':'<span>좌파</span>')+' <b>'+pct(c[cur],c.tot)+'%</b> ('+c[cur]+' / '+c.tot+')</div>'+
 '<div><span>선거일</span>: '+c.d+'</div>'+(c.U?'<div style="font-size:12px;opacity:.75"><span>분류 안 된 의석</span>: '+c.U+'</div>':'')+
 '<div><span>출처</span>: <a href="'+D.srcu+'" target="_blank" rel="noopener">ParlGov</a></div><div style="font-size:12px;opacity:.75"><span>좌우는 ParlGov 정당 점수(0~10) 기준, 5보다 작으면 좌파, 크면 우파예요. 더 최근 선거는 아직 반영되지 않았을 수 있어요.</span></div>';
 k.querySelector('.x').onclick=function(){k.remove()}}
function draw(s){var m=window.mtMap;if(!m)return;if(ly)m.removeLayer(ly);cur=s;ly=L.layerGroup();
 if(!m.getPane('seat'))m.createPane('seat').style.zIndex=390;
 D.cases.forEach(function(c){
  c['f'+s].forEach(function(r){L.polygon(r,{pane:'seat',stroke:false,fillColor:C[s],fillOpacity:.75,interactive:false}).addTo(ly)});
  L.polygon(c.o,{pane:'seat',color:C[s],weight:1.5,fillColor:'#000',fillOpacity:.15}).on('click',function(){card(c)}).addTo(ly)});
 ly.addTo(m);m.setView([28,150],Math.max(1,Math.floor(Math.log2(m.getSize().x/256)*4)/4));var k=document.getElementById('seatCard');if(k)k.remove()}
document.getElementById('seatOpen').onclick=function(){if(!B.hidden){B.hidden=true;off();return}B.hidden=false};
B.querySelectorAll('button').forEach(function(b){b.onclick=function(){B.querySelectorAll('button').forEach(function(o){o.classList.toggle('on',o==b)});
 (D?Promise.resolve(D):fetch('data/seats.json').then(function(r){return r.json()}).then(function(j){D=j;return j})).then(function(){draw(b.dataset.s)})}});
})();
