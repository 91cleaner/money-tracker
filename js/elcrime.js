/* 선거 범죄 기소 지도: 미국 법무부(DOJ) 연방검사장실 보도자료 기준, 주별 기소·체포 인원(원 크기). 매시간 GitHub Actions가 data/elcrime.json을 갱신. 유죄 확정 전에는 '기소'로만 표기. */
(function(){
var after=document.getElementById('seatBox')||document.getElementById('warBox');if(!after)return;
var box=document.createElement('div');box.id='ecBox';box.style.marginTop='8px';after.parentNode.insertBefore(box,after.nextSibling);
var st=document.createElement('style');st.textContent='#ecInfo{margin-top:6px;font:12px/1.6 system-ui,sans-serif;color:#ddd;background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px}#ecInfo[hidden]{display:none}#ecInfo a{color:#9cf}#ecInfo details{margin-top:4px}#ecInfo li{margin:2px 0}'+
'.ecLb{color:#fff;font:700 12px system-ui,sans-serif;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap;pointer-events:none;transform:translate(-50%,-50%)}'+
'#ecCard{position:fixed;left:12px;bottom:70px;z-index:1200;width:330px;max-width:calc(100vw - 24px);max-height:55vh;overflow:auto;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4)}'+
'#ecCard .x{float:right;min-width:76px;height:44px;font-size:16px;font-weight:800;border-radius:10px;cursor:pointer}#ecCard .it{border-top:1px solid #ddd;padding:6px 0}#ecCard .tg{display:inline-block;font-size:11px;color:#fff;border-radius:8px;padding:0 6px;margin-right:4px}#ecCard a{color:#0645ad;word-break:break-all}';
document.head.appendChild(st);
box.innerHTML='<button type="button" class="btn prime" id="ecOpen" style="width:100%;min-height:44px">선거 범죄 기소<span style="display:block;font-weight:400;font-size:11px;opacity:.75">미국 법무부 발표, 주별</span></button><div id="ecInfo" hidden></div>';
var D=null,ly=null,SV=null,TG=['planeTg','shipTg','cableTg','liveTg','confTg','gpsTg','zoneTg','fireTg','quakeTg'],I=document.getElementById('ecInfo');
var EN=function(){return (window.mtLang||document.documentElement.lang)=='en'};
var CEN={AL:[32.8,-86.8],AK:[64.2,-149.5],AZ:[34.2,-111.7],AR:[34.9,-92.4],CA:[37.2,-119.5],CO:[39,-105.5],CT:[41.6,-72.7],DE:[39,-75.5],DC:[38.9,-77],FL:[28.6,-82.4],GA:[32.7,-83.4],HI:[20.8,-156.3],ID:[44.4,-114.6],IL:[40,-89.2],IN:[39.9,-86.3],IA:[42.1,-93.5],KS:[38.5,-98.4],KY:[37.5,-85.3],LA:[31,-92],ME:[45.4,-69.2],MD:[39,-76.8],MA:[42.3,-71.8],MI:[44.3,-85.4],MN:[46.3,-94.3],MS:[32.7,-89.7],MO:[38.4,-92.5],MT:[47,-109.6],NE:[41.5,-99.8],NV:[39.3,-116.6],NH:[43.7,-71.6],NJ:[40.2,-74.7],NM:[34.4,-106.1],NY:[42.9,-75.5],NC:[35.5,-79.4],ND:[47.5,-100.5],OH:[40.3,-82.8],OK:[35.6,-97.5],OR:[43.9,-120.6],PA:[40.9,-77.8],RI:[41.7,-71.5],SC:[33.9,-80.9],SD:[44.4,-100.2],TN:[35.9,-86.4],TX:[31.5,-99.3],UT:[39.3,-111.7],VT:[44,-72.7],VA:[37.5,-78.8],WA:[47.4,-120.5],WV:[38.6,-80.6],WI:[44.6,-89.9],WY:[43,-107.5],PR:[18.2,-66.5],VI:[18.3,-64.9],GU:[13.4,144.8]};
var SN={AL:'앨라배마',AK:'알래스카',AZ:'애리조나',AR:'아칸소',CA:'캘리포니아',CO:'콜로라도',CT:'코네티컷',DE:'델라웨어',DC:'워싱턴 D.C.',FL:'플로리다',GA:'조지아',HI:'하와이',ID:'아이다호',IL:'일리노이',IN:'인디애나',IA:'아이오와',KS:'캔자스',KY:'켄터키',LA:'루이지애나',ME:'메인',MD:'메릴랜드',MA:'매사추세츠',MI:'미시간',MN:'미네소타',MS:'미시시피',MO:'미주리',MT:'몬태나',NE:'네브래스카',NV:'네바다',NH:'뉴햄프셔',NJ:'뉴저지',NM:'뉴멕시코',NY:'뉴욕',NC:'노스캐롤라이나',ND:'노스다코타',OH:'오하이오',OK:'오클라호마',OR:'오리건',PA:'펜실베이니아',RI:'로드아일랜드',SC:'사우스캐롤라이나',SD:'사우스다코타',TN:'테네시',TX:'텍사스',UT:'유타',VT:'버몬트',VA:'버지니아',WA:'워싱턴주',WV:'웨스트버지니아',WI:'위스콘신',WY:'와이오밍',PR:'푸에르토리코',VI:'미국령 버진아일랜드',GU:'괌'};
var SE={WA:'Washington',DC:'Washington, D.C.',VI:'U.S. Virgin Islands'};
function sn(s){if(!EN())return SN[s]||s;return SE[s]||(window.mtT?window.mtT(SN[s]):s)}
function stl(s){return s=='convicted'?'<span class="tg" style="background:#555"><span>유죄 인정·판결</span></span>':'<span class="tg" style="background:#8a5a00"><span>기소·체포(재판 전)</span></span>'}
function hidePts(){if(SV)return;SV={};TG.forEach(function(i){var e=document.getElementById(i);if(!e)return;SV[i]=e.checked;if(e.checked){e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}))}})}
function restorePts(){if(!SV)return;TG.forEach(function(i){var e=document.getElementById(i);if(e&&SV[i]&&!e.checked){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}});SV=null}
function it(c){return '<div class="it">'+stl(c.s)+'<b>'+c.d+'</b>'+(c.dup?' <span style="color:#888">(<span>중복 보도자료, 인원 미합산</span>)</span>':'')+'<div><span>혐의(원문)</span>: '+c.t+'</div>'+(c.tz?'<div style="color:#555;font-size:12px">'+c.tz+'</div>':'')+'<div><span>인원</span>: '+(c.nx?c.n:c.n+'+')+' · <a href="'+c.u+'" target="_blank" rel="noopener">justice.gov ('+c.of+')</a></div></div>'}
function card(s){var k=document.getElementById('ecCard');if(!k){k=document.createElement('div');k.id='ecCard';document.body.appendChild(k)}
 var b=D.states[s],cs=D.cases.filter(function(c){return c.st==s&&!c.opa}),dh=(D.dhs||[]).filter(function(x){return x[1]==s});
 k.innerHTML='<button class="x"><span>닫기</span></button><div style="font:700 17px sans-serif">'+sn(s)+'</div><div><span>기소·체포 인원</span> '+b.n+' · <span>그중 유죄 인정·판결</span> '+b.conv+' · <span>보도자료</span> '+b.cases+'</div>'+cs.map(it).join('')+
 (dh.length?'<div class="it"><b><span>국토안보부(DHS)·ICE 발표</span></b> <span style="color:#888">(<span>같은 사건, 인원 미합산</span>)</span>'+dh.map(function(x){return '<div>'+x[0]+' · <a href="'+x[3]+'" target="_blank" rel="noopener">'+x[2]+'</a></div>'}).join('')+'</div>':'');
 if(window.mtI18n)window.mtI18n(k);k.querySelector('.x').onclick=function(){k.remove()}}
function info(){var tot=0,cv=0,ns=0;Object.keys(D.states).forEach(function(s){tot+=D.states[s].n;cv+=D.states[s].conv;ns++});
 var op=D.cases.filter(function(c){return c.opa}),dn=(D.dhs||[]).filter(function(x){return x[1]=='US'});
 I.innerHTML='<b><span>선거 범죄 기소·체포</span></b> ('+D.since+' ~)<br><span>주 수</span> '+ns+' · <span>인원</span> '+tot+' · <span>그중 유죄 인정·판결</span> '+cv+'<br><span style="opacity:.75"><span>원 크기 = 각 주 연방검사장실 보도자료 속 기소·체포 인원. 법무부 본부의 종합 발표와 같은 날 같은 제목 자료는 빼고 셌어요. 제목에 숫자가 없는 복수형은 2명으로 셌어요(최소). 유죄 인정·판결 전에는 모두 혐의 단계예요. 매시간 자동 갱신.</span></span>'+
 '<details><summary><span>법무부 본부 종합 발표</span> ('+op.length+')</summary><ul style="padding-left:16px;margin:2px 0">'+op.map(function(c){return '<li>'+c.d+' · <a href="'+c.u+'" target="_blank" rel="noopener">'+c.t+'</a></li>'}).join('')+'</ul></details>'+
 (dn.length?'<details><summary><span>국토안보부(DHS)·ICE 전국 발표</span></summary><ul style="padding-left:16px;margin:2px 0">'+dn.map(function(x){return '<li>'+x[0]+' · <a href="'+x[3]+'" target="_blank" rel="noopener">'+x[2]+'</a></li>'}).join('')+'</ul></details>':'')+
 '<div><span>출처</span>: <a href="https://www.justice.gov/news" target="_blank" rel="noopener">justice.gov</a>, <a href="https://www.dhs.gov/news-releases" target="_blank" rel="noopener">dhs.gov</a></div>';
 if(window.mtI18n)window.mtI18n(I)}
function draw(){var m=window.mtMap;if(!m)return;hidePts();if(!m.getPane('ec'))m.createPane('ec').style.zIndex=640;ly=L.layerGroup();
 Object.keys(D.states).forEach(function(s){var b=D.states[s],p=CEN[s];if(!p)return;var r=4+Math.sqrt(b.n)*4;
  L.circleMarker(p,{pane:'ec',radius:r,color:'#fff',weight:1.5,fillColor:'#d97706',fillOpacity:.75}).on('click',function(){card(s)}).addTo(ly);
  L.marker(p,{pane:'ec',interactive:false,icon:L.divIcon({className:'',html:'<div class="ecLb">'+b.n+'</div>',iconSize:[0,0]})}).addTo(ly)});
 ly.addTo(m);m.setView([38,-97],window.innerWidth<600?3:4);info();I.hidden=false}
function off(){var m=window.mtMap;if(ly&&m)m.removeLayer(ly);ly=null;I.hidden=true;var k=document.getElementById('ecCard');if(k)k.remove();restorePts()}
document.getElementById('ecOpen').onclick=function(){if(ly){off();return}
 (D?Promise.resolve():fetch('data/elcrime.json?'+Date.now()).then(function(r){return r.json()}).then(function(j){D=j})).then(draw)};
})();
