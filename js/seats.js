/* 의석 좌우 지도: 우파/좌파 버튼(둘 다 켤 수 있음). 아래부터 우파(빨강), 그 위에 좌파(파랑), 모든 정당을 좌우 중 하나로. 자료: data/seats.json (의석: 위키백과·IPU Parline, 좌우: CHES 2024·ParlGov·V-Party, 없으면 계보·국제 연대·연합) */
(function(){
var after=document.getElementById('warBox');if(!after)return;
var box=document.createElement('div');box.id='seatBox';box.style.marginTop='8px';after.parentNode.insertBefore(box,after.nextSibling);
var st=document.createElement('style');st.textContent='#seatBtns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}#seatBtns[hidden],#seatLeg[hidden],#seatBal[hidden]{display:none}#seatBtns button{min-height:44px;border-radius:10px;border:2px solid transparent;color:#fff;font:700 15px system-ui,sans-serif;cursor:pointer;opacity:.6}#seatBtns .r{background:#b03a2e}#seatBtns .l{background:#1f4e8c}#seatBtns button.on{border-color:#fff;opacity:1}'+
'#seatLeg,#seatBal{margin-top:6px;font:12px/1.6 system-ui,sans-serif;color:#ddd}#seatLeg i{display:inline-block;width:14px;height:10px;margin:0 4px 0 8px;vertical-align:middle;border:1px solid #aaa}#seatBal{background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px}'+
'.seatLb{color:#fff;font:700 12px system-ui,sans-serif;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000,0 0 2px #000;text-align:center;pointer-events:none}.seatSmHide .seatLb.sm{display:none}'+
'#seatCard{position:fixed;left:12px;bottom:70px;z-index:1200;width:280px;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4)}#seatCard .x{float:right;min-width:76px;height:44px;font-size:16px;font-weight:800;border-radius:10px;cursor:pointer}';
document.head.appendChild(st);
var HB='repeating-linear-gradient(45deg,#999 0 2px,transparent 2px 5px)';
box.innerHTML='<button type="button" class="btn prime" id="seatOpen" style="width:100%;min-height:44px">의석 좌우 지도<span style="display:block;font-weight:400;font-size:11px;opacity:.75">최근 하원 선거 결과</span></button><div id="seatBtns" hidden><button type="button" class="r" data-s="R">우파</button><button type="button" class="l" data-s="L">좌파</button></div>'+
 '<div id="seatLeg" hidden><i style="background:#b03a2e"></i><span>우파</span><i style="background:#1f4e8c"></i><span>좌파</span><i style="background:'+HB+'"></i><span>왕정·군정·신정·정당 없는 의회</span></div><div id="seatBal" hidden></div>';
var D=null,ly=null,on={R:false,L:false},C={R:'#b03a2e',L:'#1f4e8c'};
var B=document.getElementById('seatBtns'),LG=document.getElementById('seatLeg'),BL=document.getElementById('seatBal');
var EN=function(){return (window.mtLang||document.documentElement.lang)=='en'};
var tr=function(s){return window.mtT?window.mtT(s):s};
var KN={cp:'공산당 일당 체제',dom:'일당 우위 체제',m:'왕정',j:'군정',t:'신정 체제',np:'정당 없는 의회'};
function pct(a,t){return Math.round(a/t*1000)/10}
function isOn(){return on.R||on.L}
var SN={L:'좌파',R:'우파',U:'분류 안 됨'};
function shareLine(c,s){return '<div><span>'+SN[s]+'</span> <b>'+pct(c[s],c.tot)+'%</b> ('+c[s]+' / '+c.tot+')</div>'}
function card(c){var k=document.getElementById('seatCard');if(!k){k=document.createElement('div');k.id='seatCard';document.body.appendChild(k)}
 var h='<button type="button" class="x">닫기</button><b style="font-size:15px">'+(EN()?c.en:c.n)+'</b>',src='<div><span>출처</span>: <a href="'+c.su+'" target="_blank" rel="noopener">'+(c.sn?'<span>'+c.sn+'</span>':'Wikipedia')+'</a></div>';
 if(c.k){h+='<div><b><span>'+KN[c.k]+'</span></b></div>'+(c.k=='cp'?'<div style="font-size:12px"><span>헌법이 공산당의 영도를 정하고 있어요. 지도에는 좌파로 칠했어요.</span></div>':c.k=='dom'?'<div style="font-size:12px"><span>통합러시아가 의석 대부분을 가진 일당 우위 체제예요(공산당 체제 아님). 지도에는 좌파 색으로 칠했어요.</span></div>':'<div style="font-size:12px"><span>'+(c.k=='m'?'헌법상 국왕이 행정권을 가지거나 정부 수반을 임명·해임하는 나라예요.':c.k=='j'?'군이 정권을 잡고 있는 과도 정부예요.':c.k=='np'?'정당 명부로 뽑은 의회가 없어요.':'최고지도자(성직자)가 최종 권한을 가진 체제예요.')+'</span> <span>좌우 비율은 없어요.</span></div>')+(c.note?'<div style="font-size:12px"><span>'+c.note[0]+'</span></div>':'')+src}
 else if(c.nc){h+='<div><span>일당제 또는 경쟁 선거가 없는 나라라서 색을 칠하지 않았어요.</span></div>'+src}
 else{h+=(on.R||!on.L?shareLine(c,'R'):'')+(on.L||!on.R?shareLine(c,'L'):'')+'<div><span>선거일</span>: '+c.d+'</div>'+(c.U?'<div style="font-size:12px;opacity:.75"><span>분류 안 된 의석</span>: '+c.U+'</div>':'')+
 '<div style="font-size:12px;max-height:110px;overflow:auto;margin-top:4px">'+c.p.filter(function(p){return p[1]>0}).map(function(p){return (EN()||!p[6]?p[0]:p[6])+' '+p[1]+' · <span>'+SN[p[2]]+'</span>'+(p[3]?' (<span>'+D.sc[p[3]][0]+'</span> '+(p[7]?'<a href="'+p[7]+'" target="_blank" rel="noopener">'+p[4]+'</a>':p[4])+(p[5]?', <span>연합은 대표 정당 점수</span>':'')+')':'')}).join('<br>')+'</div>'+
 (c.note?c.note.map(function(t){return '<div style="font-size:12px;background:#fff3cd;padding:3px 6px;border-radius:6px;margin-top:4px"><span>'+t+'</span></div>'}).join(''):'')+(c.vn&&!c.note?'<div style="font-size:12px;background:#fff3cd;padding:3px 6px;border-radius:6px;margin-top:4px"><span>V-Party 경제 축 점수만 있고 정당 간 차이가 작거나 정당이 하나뿐이라 칠하지 않았어요.</span></div>':'')+'<div><span>의석 출처</span>: <a href="'+c.su+'" target="_blank" rel="noopener">'+(c.sn||'Wikipedia')+': '+c.eu+'</a></div>'+
 '<div style="font-size:12px;opacity:.75"><span>좌우 점수: 유럽은 CHES 2024를 먼저, 없으면 ParlGov(전문가 점수), 다른 나라는 ParlGov, 없으면 V-Party(경제 좌우, 0~6)를 써요. 0~10 점수는 5±0.5 안이면 가운데로 보고 다음 자료를 봐요. V-Party는 가장 가까운 단계로 읽어 2.5 미만은 좌파, 3.5 초과는 우파, 그 사이는 분류 안 함이에요. 점수로 정할 수 없으면 계보·국제 연대·연합으로 정해요.</span></div>'}
 k.innerHTML=h;if(window.mtI18n)window.mtI18n(k);k.querySelector('.x').onclick=function(){k.remove()}}
var SV=null,TG=['planeTg','shipTg','cableTg','liveTg','confTg','gpsTg','zoneTg','fireTg','quakeTg'];
function hidePts(){if(SV)return;SV={};TG.forEach(function(i){var e=document.getElementById(i);if(!e)return;SV[i]=e.checked;if(e.checked){e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}))}})}
function restorePts(){if(!SV)return;TG.forEach(function(i){var e=document.getElementById(i);if(e&&SV[i]&&!e.checked){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}});SV=null}
function lab(c){var R=EN()?'R':'우',Lf=EN()?'L':'좌';
 if(c.k){return c.k=='cp'||c.k=='dom'?tr(KN[c.k]):tr(KN[c.k])}
 if(c.nc)return '';if(!c.L&&!c.R)return tr('미분류');var r=Math.round(c.R/c.tot*100),l=Math.round(c.L/c.tot*100);
 if(on.R&&on.L)return R+' '+r+' · '+Lf+' '+l;return on.R?R+' '+r+'%':Lf+' '+l+'%'}
function balance(){var n={R:0,L:0,U:0},p={R:0,L:0,U:0},P=0;
 D.cases.forEach(function(c){if(c.nc||c.k=='m'||c.k=='j'||c.k=='t'||c.k=='np')return;var r,l;if(c.k){r=0;l=1}else{r=c.R/c.tot;l=c.L/c.tot}
  n[r>l&&r>.0?'R':l>r?'L':'U']++;p.R+=c.pop*r;p.L+=c.pop*l;p.U+=c.pop*(1-r-l);P+=c.pop});
 BL.innerHTML='<b><span>세계 좌우 균형</span></b><br><span>나라 수(더 많은 쪽)</span>: <span>우파</span> '+n.R+' · <span>좌파</span> '+n.L+'<br><span>인구 가중</span>: <span>우파</span> '+Math.round(p.R/P*100)+'% · <span>좌파</span> '+Math.round(p.L/P*100)+'%<br><span style="opacity:.7"><span>공산당 일당·일당 우위 나라는 좌파로, 왕정·군정·신정·정당 없는 의회는 빼고 셌어요. 인구: Natural Earth.</span></span>';if(window.mtI18n)window.mtI18n(BL)}
function zoomCls(){var m=window.mtMap;if(m)m.getContainer().classList.toggle('seatSmHide',m.getZoom()<4)}
function draw(){var m=window.mtMap;if(!m)return;if(ly)m.removeLayer(ly);ly=null;
 B.querySelectorAll('button').forEach(function(b){b.classList.toggle('on',on[b.dataset.s])});
 var k0=document.getElementById('seatCard');if(k0)k0.remove();
 if(!isOn()){LG.hidden=BL.hidden=true;restorePts();return}
 hidePts();LG.hidden=BL.hidden=false;ly=L.layerGroup();
 if(!m.getPane('seat'))m.createPane('seat').style.zIndex=390;
 if(!m.getPane('seatLb')){m.createPane('seatLb').style.zIndex=395;m.on('zoomend',zoomCls)}
 var both=on.R&&on.L,edge=both?'#ddd':C[on.R?'R':'L'];
 D.cases.forEach(function(c){var lb=lab(c);
  if(c.nc){L.polygon(c.o,{pane:'seat',color:'#888',weight:1.5,dashArray:'4 4',fillOpacity:0}).on('click',function(){card(c)}).addTo(ly)}
  else if(c.k=='m'||c.k=='j'||c.k=='t'||c.k=='np'){L.polygon(c.o,{pane:'seat',color:'#999',weight:1.2,fillColor:'url(#seatHatch)',fillOpacity:1,className:'seatH'}).on('click',function(){card(c)}).addTo(ly)}
  else if(c.k){L.polygon(c.o,{pane:'seat',color:C.L,weight:1.5,fillColor:C.L,fillOpacity:.75}).on('click',function(){card(c)}).addTo(ly)}
  else{var F=both?[['fR','R'],['fS','L']]:[[on.R?'fR':'fL',on.R?'R':'L']];
   F.forEach(function(f){(c[f[0]]||[]).forEach(function(r){L.polygon(r,{pane:'seat',stroke:false,fillColor:C[f[1]],fillOpacity:.75,interactive:false}).addTo(ly)})});
   L.polygon(c.o,{pane:'seat',color:edge,weight:1.5,fillColor:'#000',fillOpacity:.15}).on('click',function(){card(c)}).addTo(ly)}
  if(lb)L.marker(c.lp,{pane:'seatLb',interactive:false,icon:L.divIcon({className:'',html:'<div class="seatLb'+(c.sm?' sm':'')+'" style="transform:translate(-50%,-50%)">'+lb+'</div>',iconSize:[0,0]})}).addTo(ly)});
 ly.addTo(m);hatchDef();zoomCls();balance()}
function hatchDef(){var s=document.querySelector('.leaflet-seat-pane svg');if(!s||s.querySelector('#seatHatch'))return;var ns='http://www.w3.org/2000/svg',df=document.createElementNS(ns,'defs'),p=document.createElementNS(ns,'pattern');p.setAttribute('id','seatHatch');p.setAttribute('patternUnits','userSpaceOnUse');p.setAttribute('width','6');p.setAttribute('height','6');p.setAttribute('patternTransform','rotate(45)');var r=document.createElementNS(ns,'rect');r.setAttribute('width','2');r.setAttribute('height','6');r.setAttribute('fill','#aaa');p.appendChild(r);df.appendChild(p);s.insertBefore(df,s.firstChild)}
document.getElementById('seatOpen').onclick=function(){if(!B.hidden){B.hidden=true;on.R=on.L=false;if(D)draw();return}B.hidden=false};
B.querySelectorAll('button').forEach(function(b){b.onclick=function(){var first=!isOn();on[b.dataset.s]=!on[b.dataset.s];
 (D?Promise.resolve(D):fetch('data/seats.json').then(function(r){return r.json()}).then(function(j){D=j;return j})).then(function(){draw();var m=window.mtMap;if(first&&isOn()&&m)m.setView([28,150],Math.max(1,Math.floor(Math.log2(m.getSize().x/256)*4)/4))})}});
})();
