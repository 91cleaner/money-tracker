/* 미국과의 관계 지도: 공식 목록 기준 4분류(동맹·주둔 / 협력 / 중립 / 제재·대립). 좌우와 별개. 자료: data/usrel.json (NATO, 미 국무부 집단방위 조약·MNNA, OAS 리우 조약, 미군 기지, 미 상무부 15 CFR 791.4, OFAC, 유엔총회 표결 일치도) */
(function(){
var after=document.getElementById('ecBox')||document.getElementById('seatBox');if(!after)return;
var box=document.createElement('div');box.id='urBox';box.style.marginTop='8px';after.parentNode.insertBefore(box,after.nextSibling);
var st=document.createElement('style');st.textContent='#urInfo{margin-top:6px;font:12px/1.6 system-ui,sans-serif;color:#ddd;background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px}#urInfo[hidden]{display:none}#urInfo i{display:inline-block;width:14px;height:10px;margin:0 4px 0 0;vertical-align:middle;border:1px solid #aaa}#urInfo a{color:#9cf}'+
'#urCard{position:fixed;left:12px;bottom:70px;z-index:1200;width:300px;max-width:calc(100vw - 24px);max-height:55vh;overflow:auto;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4)}#urCard .x{float:right;min-width:76px;height:44px;font-size:16px;font-weight:800;border-radius:10px;cursor:pointer}#urCard a{color:#0645ad}#urCard li{margin:3px 0}';
document.head.appendChild(st);
box.innerHTML='<button type="button" class="btn prime" id="urOpen" style="width:100%;min-height:44px">미국과의 관계<span style="display:block;font-weight:400;font-size:11px;opacity:.75">조약·지정·제재 공식 목록 기준</span></button><div id="urInfo" hidden></div>';
var C={a:'#1d4ed8',p:'#38bdf8',n:'#6b7280',x:'#c2410c'},K={a:'동맹·주둔',p:'협력',n:'중립',x:'제재·대립'};
var D=null,G=null,ly=null,SV=null,TG=['planeTg','shipTg','cableTg','liveTg','confTg','gpsTg','zoneTg','fireTg','quakeTg'],I=document.getElementById('urInfo');
var EN=function(){return (window.mtLang||document.documentElement.lang)=='en'};
function hidePts(){if(SV)return;SV={};TG.forEach(function(i){var e=document.getElementById(i);if(!e)return;SV[i]=e.checked;if(e.checked){e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}))}})}
function restorePts(){if(!SV)return;TG.forEach(function(i){var e=document.getElementById(i);if(e&&SV[i]&&!e.checked){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}});SV=null}
function lk(u){if(!u)return'';var s=D.src[u];if(s)return ' <a href="'+s[1]+'" target="_blank" rel="noopener"><span>'+s[0]+'</span></a>';return ' <a href="'+u+'" target="_blank" rel="noopener"><span>출처</span></a>'}
function card(c,p){var k=document.getElementById('urCard');if(!k){k=document.createElement('div');k.id='urCard';document.body.appendChild(k)}
 var nm=EN()?(p.NAME_EN||p.NAME):(c.a3=='TWN'?'대만':(p.NAME_KO||p.NAME));
 k.innerHTML='<button class="x"><span>닫기</span></button><div style="font:700 17px sans-serif">'+nm+'</div><div style="margin:4px 0"><span style="display:inline-block;background:'+C[c.c]+';color:#fff;border-radius:8px;padding:1px 8px;font-size:12px"><span>'+K[c.c]+'</span></span></div><ul style="padding-left:16px;margin:4px 0">'+
 c.f.map(function(x){return '<li><span>'+x[0]+'</span>'+lk(x[1])+'</li>'}).join('')+
 '<li><span>유엔총회 표결 미국과 일치율</span> ('+D.unyear+'): '+(c.un==null?(c.a3=='TWN'||c.a3=='KOS'||c.a3=='PSX'?'<span>유엔 비회원</span>':'<span>자료 없음</span>'):c.un+'%')+lk('un')+'</li></ul>';
 if(window.mtI18n)window.mtI18n(k);k.querySelector('.x').onclick=function(){k.remove()}}
function info(){var n={a:0,p:0,n:0,x:0};D.cases.forEach(function(c){n[c.c]++});
 I.innerHTML='<b><span>미국과의 관계</span></b><br>'+['a','p','n','x'].map(function(k){return '<i style="background:'+C[k]+'"></i><span>'+K[k]+'</span> '+n[k]}).join(' · ')+
 '<br><span style="opacity:.75"><span>동맹·주둔: 미국과 상호방위 조약(NATO·한미·미일·미필리핀·앤저스·마닐라·리우 조약) 당사국, 또는 미군 주요 기지가 있는 나라. 협력: 주요 비NATO 동맹·주요 방위 동반자 지정. 제재·대립: 미 상무부 외국 적대국 목록 또는 정부 대상 OFAC 제재 프로그램. 중립: 그 밖의 나라. 좌우 분류와는 별개예요.</span></span>';
 if(window.mtI18n)window.mtI18n(I)}
function draw(){var m=window.mtMap;if(!m)return;hidePts();if(!m.getPane('ur'))m.createPane('ur').style.zIndex=392;var by={};D.cases.forEach(function(c){by[c.a3]=c});
 ly=L.geoJSON(G,{pane:'ur',filter:function(f){return by[f.properties.ADM0_A3]},style:function(f){var c=by[f.properties.ADM0_A3];return {color:'#eee',weight:.8,fillColor:C[c.c],fillOpacity:.7}},
  onEachFeature:function(f,l){l.on('click',function(){card(by[f.properties.ADM0_A3],f.properties)})}}).addTo(m);
 m.setView([25,20],Math.max(1,Math.floor(Math.log2(m.getSize().x/256)*4)/4));info();I.hidden=false}
function off(){var m=window.mtMap;if(ly&&m)m.removeLayer(ly);ly=null;I.hidden=true;var k=document.getElementById('urCard');if(k)k.remove();restorePts()}
document.getElementById('urOpen').onclick=function(){if(ly){off();return}
 Promise.all([D||fetch('data/usrel.json').then(function(r){return r.json()}).then(function(j){D=j}),G||fetch('data/national/countries-110m.geojson').then(function(r){return r.json()}).then(function(j){G=j})]).then(draw)};
})();
