/* 미국 치안·의회: 119대 하원 지구(정당) + 대도시 FBI 범죄율 + (선택) ACS 인종 구성. 임시 단일 진입점. */
(function(){
var after=document.getElementById('ecBox')||document.getElementById('seatBox')||document.getElementById('warBox');if(!after)return;
var box=document.createElement('div');box.id='usdcBox';box.style.marginTop='8px';after.parentNode.insertBefore(box,after.nextSibling);
var st=document.createElement('style');st.textContent=
'#usdcPanel[hidden]{display:none}#usdcPanel{margin-top:6px;font:12px/1.6 system-ui,sans-serif;color:#ddd}'+
'#usdcPanel .row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}'+
'#usdcPanel button.tg{min-height:40px;border-radius:10px;border:2px solid transparent;color:#fff;font:700 13px system-ui,sans-serif;cursor:pointer;opacity:.7;background:#1a3a2a}'+
'#usdcPanel button.tg.on{border-color:#fff;opacity:1}'+
'#usdcPanel label.chk{display:flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer}'+
'#usdcSum{margin-top:6px;background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px}'+
'#usdcSum a{color:#9cf}'+
'#usdcCard{position:fixed;left:12px;bottom:70px;z-index:1200;width:300px;max-width:calc(100vw - 24px);max-height:50vh;overflow:auto;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4)}'+
'#usdcCard .x{float:right;min-width:76px;height:44px;font-size:16px;font-weight:800;border-radius:10px;cursor:pointer}'+
'#usdcCard a{color:#0645ad;word-break:break-all}'+
'.usdcPie{width:28px;height:28px;border-radius:50%;border:1px solid #fff;box-shadow:0 0 2px #000}';
document.head.appendChild(st);
box.innerHTML='<button type="button" class="btn prime" id="usdcOpen" style="width:100%;min-height:44px">미국 치안·의회<span style="display:block;font-weight:400;font-size:11px;opacity:.75">하원 지구 · 도시 범죄 (임시)</span></button>'+
'<div id="usdcPanel" hidden>'+
'<div class="row"><button type="button" class="tg" id="usdcDist" data-k="dist">하원 지구</button><button type="button" class="tg" id="usdcCrime" data-k="crime">도시 범죄율</button></div>'+
'<label class="chk"><input type="checkbox" id="usdcRace"> <span>도시 인종·민족 구성 표시</span></label><div style="opacity:.75;margin-top:2px"><span>범죄율과 동시에 켤 수 없어요. 구성을 켜면 범죄율 표시는 꺼져요.</span></div>'+
'<div id="usdcSum" hidden></div></div>';
var CD=null,CT=null,ly=null,mode=null,SV=null;
var TG=['planeTg','shipTg','cableTg','liveTg','confTg','gpsTg','zoneTg','fireTg','quakeTg'];
var C={D:'#1f4e8c',R:'#b03a2e',I:'#888',V:'#666'};
var EN=function(){return (window.mtLang||document.documentElement.lang)=='en'};
function hidePts(){if(SV)return;SV={};TG.forEach(function(i){var e=document.getElementById(i);if(!e)return;SV[i]=e.checked;if(e.checked){e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}))}})}
function restorePts(){if(!SV)return;TG.forEach(function(i){var e=document.getElementById(i);if(e&&SV[i]&&!e.checked){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}});SV=null}
function clearLy(){var m=window.mtMap;if(ly&&m)m.removeLayer(ly);ly=null;var k=document.getElementById('usdcCard');if(k)k.remove()}
function card(html){var k=document.getElementById('usdcCard');if(!k){k=document.createElement('div');k.id='usdcCard';document.body.appendChild(k)}
 k.innerHTML='<button type="button" class="x"><span>닫기</span></button>'+html;
 if(window.mtI18n)window.mtI18n(k);k.querySelector('.x').onclick=function(){k.remove()}}
function pie(c){
  var w=c.pct_white_nh||0,b=c.pct_black_nh||0,a=c.pct_asian_nh||0,h=c.pct_hispanic||0;
  var o=Math.max(0,100-w-b-a-h);
  var stops=[w,b,a,h,o],cols=['#c8d6e5','#2f3640','#f9ca24','#e67e22','#95a5a6'],acc=0,parts=[];
  stops.forEach(function(v,i){if(v<=0)return;parts.push(cols[i]+' '+acc+'% '+(acc+v)+'%');acc+=v});
  return 'conic-gradient('+parts.join(',')+')'}
function distCard(d){
  var party=d.party==='D'?'<span>민주당</span>':d.party==='R'?'<span>공화당</span>':d.party==='V'?'<span>공석</span>':'<span>무소속·기타</span>';
  var nm=EN()&&d.name_en?d.name_en:d.name;
  card('<b style="font-size:15px">'+d.label+'</b><div>'+nm+'</div><div><span>정당</span>: '+party+'</div>'+
    (d.note?'<div style="font-size:12px;margin-top:4px">'+d.note+'</div>':'')+
    '<div style="margin-top:6px"><span>출처</span>: <a href="'+(d.su||'https://clerk.house.gov/Members')+'" target="_blank" rel="noopener">clerk.house.gov</a> · <a href="https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html" target="_blank" rel="noopener">Census TIGER CD 119</a></div>')}
function cityCard(c,showRace){
  var nm=EN()?c.city:(c.city_ko||c.city);
  var mp=c.mparty==='D'?'<span>민주당</span>':c.mparty==='R'?'<span>공화당</span>':'<span>무소속·기타</span>';
  var h='<b style="font-size:15px">'+nm+'</b> <span style="opacity:.7">'+c.st+'</span>'+
    '<div><span>시장</span>: '+c.mayor+' ('+mp+')</div>';
  if(showRace){
    h+='<div style="margin-top:6px"><span>인종·민족 구성</span> (ACS 5년, %)</div>'+
      '<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><div class="usdcPie" style="background:'+pie(c)+'"></div>'+
      '<div style="font-size:12px"><span>비히스패닉 백인</span> '+c.pct_white_nh+'%<br><span>비히스패닉 흑인</span> '+c.pct_black_nh+'%<br><span>비히스패닉 아시아</span> '+c.pct_asian_nh+'%<br><span>히스패닉</span> '+c.pct_hispanic+'%</div></div>'+
      '<div style="font-size:12px;opacity:.8"><span>구성 표시일 뿐, 원인이나 책임을 가리키지 않아요.</span></div>'+
      '<div><span>출처</span>: <a href="'+c.su_acs+'" target="_blank" rel="noopener">Census ACS 5-year</a></div>';
  }else{
    h+='<div><span>폭력범죄</span> '+c.violent+' / 10만 명 ('+c.year+')</div>'+
      '<div><span>살인</span> '+c.homicide+' / 10만 명 ('+c.year+')</div>'+
      '<div><span>출처</span>: <a href="'+c.su_crime+'" target="_blank" rel="noopener">FBI Crime Data Explorer / UCR 2024</a></div>'+
      '<div style="font-size:12px"><span>시장 정당</span>: <a href="'+c.su_mayor+'" target="_blank" rel="noopener">위키 대도시 시장 목록</a></div>';
  }
  card(h)}
function summary(){
  if(!CT)return;var s=CT.summary,el=document.getElementById('usdcSum');
  el.hidden=false;
  el.innerHTML='<b><span>도시 범죄율 요약</span></b> (FBI UCR 2024, /10만)<br>'+
    '<span>폭력범죄 평균</span>: <span>민주당 시장</span> '+s.violent_mean_D+' · <span>공화당 시장</span> '+s.violent_mean_R+'<br>'+
    '<span>살인 평균</span>: <span>민주당 시장</span> '+s.homicide_mean_D+' · <span>공화당 시장</span> '+s.homicide_mean_R+'<br>'+
    '<span style="opacity:.8"><span>'+(EN()?s.note_en:s.note_ko)+'</span></span><br>'+
    '<span>출처</span>: <a href="https://cde.ucr.cjis.gov/LATEST/webapp/#/pages/home" target="_blank" rel="noopener">FBI CDE</a>';
  if(window.mtI18n)window.mtI18n(el)}
function drawDist(){
  var m=window.mtMap;if(!m||!CD)return;clearLy();hidePts();mode='dist';
  document.getElementById('usdcDist').classList.add('on');document.getElementById('usdcCrime').classList.remove('on');
  document.getElementById('usdcRace').checked=false;
  if(!m.getPane('usdc'))m.createPane('usdc').style.zIndex=420;
  ly=L.layerGroup();
  CD.cases.forEach(function(d){
    var col=C[d.party]||'#888';
    var rings=Array.isArray(d.poly[0][0])?d.poly:[d.poly];
    rings.forEach(function(r){
      L.polygon(r,{pane:'usdc',color:'#222',weight:.4,fillColor:col,fillOpacity:d.party==='V'?.35:.55}).on('click',function(){distCard(d)}).addTo(ly);
    });
  });
  ly.addTo(m);m.setView([38,-97],window.innerWidth<600?3:4);summary()}
function drawCities(race){
  var m=window.mtMap;if(!m||!CT)return;clearLy();hidePts();mode=race?'race':'crime';
  document.getElementById('usdcCrime').classList.toggle('on',!race);
  document.getElementById('usdcDist').classList.remove('on');
  if(race)document.getElementById('usdcCrime').classList.remove('on');
  if(!m.getPane('usdc'))m.createPane('usdc').style.zIndex=420;
  ly=L.layerGroup();
  CT.cities.forEach(function(c){
    if(race){
      L.marker([c.la,c.lo],{pane:'usdc',icon:L.divIcon({className:'',html:'<div class="usdcPie" style="background:'+pie(c)+';transform:translate(-50%,-50%)"></div>',iconSize:[0,0]})}).on('click',function(){cityCard(c,true)}).addTo(ly);
    }else{
      var r=6+Math.sqrt(c.violent)/4;
      L.circleMarker([c.la,c.lo],{pane:'usdc',radius:Math.min(22,r),color:'#fff',weight:1.2,fillColor:C[c.mparty]||'#888',fillOpacity:.75}).on('click',function(){cityCard(c,false)}).addTo(ly);
    }
  });
  ly.addTo(m);m.setView([38,-97],window.innerWidth<600?3:4);summary()}
function loadCD(){return CD?Promise.resolve():fetch('data/usdc_cds.json').then(function(r){return r.json()}).then(function(j){CD=j})}
function loadCT(){return CT?Promise.resolve():fetch('data/usdc_cities.json').then(function(r){return r.json()}).then(function(j){CT=j})}
function offAll(){clearLy();mode=null;restorePts();document.getElementById('usdcPanel').hidden=true;
  document.getElementById('usdcDist').classList.remove('on');document.getElementById('usdcCrime').classList.remove('on');
  document.getElementById('usdcRace').checked=false;document.getElementById('usdcSum').hidden=true}
document.getElementById('usdcOpen').onclick=function(){
  var P=document.getElementById('usdcPanel');
  if(!P.hidden){offAll();return}
  P.hidden=false;
  Promise.all([loadCD(),loadCT()]).then(function(){drawDist()});
};
document.getElementById('usdcDist').onclick=function(){loadCD().then(drawDist)};
document.getElementById('usdcCrime').onclick=function(){
  document.getElementById('usdcRace').checked=false;
  loadCT().then(function(){drawCities(false)});
};
document.getElementById('usdcRace').onchange=function(){
  var on=this.checked;
  if(on){loadCT().then(function(){drawCities(true)})}
  else if(mode==='race'){loadCT().then(function(){drawCities(false)})}
};
})();
