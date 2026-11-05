/* 미국 치안·의회: 119대 하원 지구(정당) + 대도시 FBI 범죄율 + (선택) ACS 인종 구성. 임시 단일 진입점. */
(function(){
var after=document.getElementById('ecBox')||document.getElementById('seatBox')||document.getElementById('warBox');if(!after)return;
var box=document.createElement('div');box.id='usdcBox';box.style.marginTop='8px';after.parentNode.insertBefore(box,after.nextSibling);
var CRIME_COL='#e67e22';
var st=document.createElement('style');st.textContent=
'#usdcPanel[hidden]{display:none}#usdcPanel{margin-top:6px;font:12px/1.6 system-ui,sans-serif;color:#ddd}'+
'#usdcPanel .row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}'+
'#usdcPanel button.tg{min-height:40px;border-radius:10px;border:2px solid transparent;color:#fff;font:700 13px system-ui,sans-serif;cursor:pointer;opacity:.7;background:#1a3a2a}'+
'#usdcPanel button.tg.on{border-color:#fff;opacity:1}'+
'#usdcPanel label.chk{display:flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer}'+
'#usdcLeg{margin-top:6px;background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px;line-height:1.5}'+
'#usdcLeg i{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:4px;vertical-align:-1px}'+
'#usdcLeg i.dot{border-radius:50%;background:'+CRIME_COL+';border:1px solid #fff}'+
'#usdcSum{margin-top:6px;background:rgba(255,255,255,.06);border-radius:8px;padding:6px 8px}'+
'#usdcSum a,#usdcLeg a{color:#9cf}'+
'#usdcCard{position:fixed;left:12px;bottom:70px;z-index:1200;width:300px;max-width:calc(100vw - 24px);max-height:50vh;overflow:auto;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4)}'+
'#usdcCard .x{float:right;min-width:76px;height:44px;font-size:16px;font-weight:800;border-radius:10px;cursor:pointer}'+
'#usdcCard a{color:#0645ad;word-break:break-all}'+
'.usdcPie{width:28px;height:28px;border-radius:50%;border:1px solid #fff;box-shadow:0 0 2px #000}';
document.head.appendChild(st);
box.innerHTML='<button type="button" class="btn prime" id="usdcOpen" style="width:100%;min-height:44px">미국 치안·의회<span style="display:block;font-weight:400;font-size:11px;opacity:.75">하원 지구 · 도시 범죄 (임시)</span></button>'+
'<div id="usdcPanel" hidden>'+
'<div class="row"><button type="button" class="tg" id="usdcDist" data-k="dist">하원 지구</button><button type="button" class="tg" id="usdcCrime" data-k="crime">도시 범죄율</button></div>'+
'<label class="chk"><input type="checkbox" id="usdcRace"> <span>도시 인종·민족 구성 표시</span></label><div style="opacity:.75;margin-top:2px"><span>범죄율과 동시에 켤 수 없어요. 구성을 켜면 범죄율 표시는 꺼져요.</span></div>'+
'<div id="usdcLeg" hidden></div>'+
'<div id="usdcSum" hidden></div></div>';
var CD=null,CT=null,ly=null,mode=null,SV=null;
var TG=['planeTg','shipTg','cableTg','liveTg','confTg','gpsTg','zoneTg','fireTg','quakeTg'];
var C={D:'#1f4e8c',R:'#b03a2e',I:'#888',V:'#666'};
var EN=function(){return (window.mtLang||document.documentElement.lang)==='en'};
function T(ko,en){return EN()?en:ko}
function hidePts(){if(SV)return;SV={};TG.forEach(function(i){var e=document.getElementById(i);if(!e)return;SV[i]=e.checked;if(e.checked){e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}))}})}
function restorePts(){if(!SV)return;TG.forEach(function(i){var e=document.getElementById(i);if(e&&SV[i]&&!e.checked){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}});SV=null}
function clearLy(){var m=window.mtMap;if(ly&&m)m.removeLayer(ly);ly=null;var k=document.getElementById('usdcCard');if(k)k.remove()}
function card(html){
  var k=document.getElementById('usdcCard');if(!k){k=document.createElement('div');k.id='usdcCard';document.body.appendChild(k)}
  k.innerHTML='<button type="button" class="x" data-noi18n="1">'+T('닫기','Close')+'</button>'+html;
  k.querySelector('.x').onclick=function(){k.remove()}}
function partyLab(p){
  if(p==='D')return T('민주당','Democratic');
  if(p==='R')return T('공화당','Republican');
  if(p==='V')return T('공석','Vacant');
  return T('무소속·기타','Independent/other')}
function pie(c){
  var w=c.pct_white_nh||0,b=c.pct_black_nh||0,a=c.pct_asian_nh||0,h=c.pct_hispanic||0;
  var o=Math.max(0,100-w-b-a-h);
  var stops=[w,b,a,h,o],cols=['#c8d6e5','#2f3640','#f9ca24','#e67e22','#95a5a6'],acc=0,parts=[];
  stops.forEach(function(v,i){if(v<=0)return;parts.push(cols[i]+' '+acc+'% '+(acc+v)+'%');acc+=v});
  return 'conic-gradient('+parts.join(',')+')'}
function per100k(v,year){return v+' '+T('/ 10만 명','/ 100k')+' ('+year+')'}
function distCard(d){
  var nm=EN()&&d.name_en?d.name_en:d.name;
  var note=d.note?(EN()&&d.note_en?d.note_en:d.note):'';
  card('<b style="font-size:15px" data-noi18n="1">'+d.label+'</b><div data-noi18n="1">'+nm+'</div><div data-noi18n="1">'+T('정당','Party')+': '+partyLab(d.party)+'</div>'+
    (note?'<div style="font-size:12px;margin-top:4px" data-noi18n="1">'+note+'</div>':'')+
    '<div style="margin-top:6px" data-noi18n="1">'+T('출처','Sources')+': <a href="'+(d.su||'https://clerk.house.gov/Members')+'" target="_blank" rel="noopener">clerk.house.gov</a> · <a href="https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html" target="_blank" rel="noopener">Census TIGER CD 119</a></div>')}
function cityCard(c,showRace){
  var nm=EN()?c.city:(c.city_ko||c.city);
  var h='<b style="font-size:15px" data-noi18n="1">'+nm+'</b> <span style="opacity:.7" data-noi18n="1">'+c.st+'</span>'+
    '<div data-noi18n="1">'+T('시장','Mayor')+': '+c.mayor+' ('+partyLab(c.mparty)+')</div>';
  if(showRace){
    h+='<div style="margin-top:6px" data-noi18n="1">'+T('인종·민족 구성','Race/ethnicity shares')+' (ACS 5-year, %)</div>'+
      '<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><div class="usdcPie" style="background:'+pie(c)+'"></div>'+
      '<div style="font-size:12px" data-noi18n="1">'+T('비히스패닉 백인','Non-Hispanic White')+' '+c.pct_white_nh+'%<br>'+T('비히스패닉 흑인','Non-Hispanic Black')+' '+c.pct_black_nh+'%<br>'+T('비히스패닉 아시아','Non-Hispanic Asian')+' '+c.pct_asian_nh+'%<br>'+T('히스패닉','Hispanic')+' '+c.pct_hispanic+'%</div></div>'+
      '<div style="font-size:12px;opacity:.8" data-noi18n="1">'+T('구성 표시일 뿐, 원인이나 책임을 가리키지 않아요.','Shares only — not a claim about causes or blame.')+'</div>'+
      '<div data-noi18n="1">'+T('출처','Sources')+': <a href="'+c.su_acs+'" target="_blank" rel="noopener">Census ACS 5-year</a></div>';
  }else{
    h+='<div data-noi18n="1">'+T('폭력범죄','Violent crime')+' '+per100k(c.violent,c.year)+'</div>'+
      '<div data-noi18n="1">'+T('살인','Homicide')+' '+per100k(c.homicide,c.year)+'</div>'+
      '<div data-noi18n="1">'+T('출처','Sources')+': <a href="'+c.su_crime+'" target="_blank" rel="noopener">FBI Crime Data Explorer / UCR 2024</a></div>'+
      '<div style="font-size:12px" data-noi18n="1">'+T('시장 정당','Mayor party')+': <a href="'+c.su_mayor+'" target="_blank" rel="noopener">'+(EN()?'Wikipedia: mayors of the 50 largest cities':'위키 대도시 시장 목록')+'</a></div>';
  }
  card(h)}
function legend(){
  var el=document.getElementById('usdcLeg');el.hidden=false;
  el.innerHTML='<b data-noi18n="1">'+T('범례','Legend')+'</b><br>'+
    '<i style="background:#1f4e8c"></i><span data-noi18n="1">'+T('지구 칠: 민주당','District fill: Democratic')+'</span> · '+
    '<i style="background:#b03a2e"></i><span data-noi18n="1">'+T('공화당','Republican')+'</span> · '+
    '<i style="background:#666"></i><span data-noi18n="1">'+T('공석·기타','Vacant/other')+'</span><br>'+
    '<i class="dot"></i><span data-noi18n="1">'+T('주황 원: 폭력범죄 / 10만 명 (FBI UCR 2024). 크기 = 비율. 정당 색 아님.','Orange circle: violent crime / 100k (FBI UCR 2024). Size = rate. Not a party colour.')+'</span>';
}
function summary(){
  if(!CT)return;var s=CT.summary,el=document.getElementById('usdcSum');
  el.hidden=false;legend();
  el.innerHTML='<b data-noi18n="1">'+T('도시 범죄율 요약','City crime rate summary')+'</b> (FBI UCR 2024, '+T('/10만','/100k')+')<br>'+
    '<span data-noi18n="1">'+T('폭력범죄 평균','Mean violent crime')+': '+T('민주당 시장','Democratic mayor')+' '+s.violent_mean_D+' · '+T('공화당 시장','Republican mayor')+' '+s.violent_mean_R+'</span><br>'+
    '<span data-noi18n="1">'+T('살인 평균','Mean homicide')+': '+T('민주당 시장','Democratic mayor')+' '+s.homicide_mean_D+' · '+T('공화당 시장','Republican mayor')+' '+s.homicide_mean_R+'</span><br>'+
    '<span style="opacity:.8" data-noi18n="1">'+(EN()?s.note_en:s.note_ko)+'</span><br>'+
    '<span data-noi18n="1">'+T('출처','Sources')+': <a href="https://cde.ucr.cjis.gov/LATEST/webapp/#/pages/home" target="_blank" rel="noopener">FBI CDE</a> · <a href="'+(s.mayor_src||'https://en.wikipedia.org/wiki/List_of_mayors_of_the_50_largest_cities_in_the_United_States')+'" target="_blank" rel="noopener">'+T('시장 정당 (위키, 2026-11)','Mayor party (Wikipedia, 2026-11)')+'</a></span>';
}
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
      L.circleMarker([c.la,c.lo],{pane:'usdc',radius:Math.min(22,r),color:'#fff',weight:1.2,fillColor:CRIME_COL,fillOpacity:.8}).on('click',function(){cityCard(c,false)}).addTo(ly);
    }
  });
  ly.addTo(m);m.setView([38,-97],window.innerWidth<600?3:4);summary()}
function loadCD(){return CD?Promise.resolve():fetch('data/usdc_cds.json').then(function(r){return r.json()}).then(function(j){CD=j})}
function loadCT(){return CT?Promise.resolve():fetch('data/usdc_cities.json').then(function(r){return r.json()}).then(function(j){CT=j})}
function offAll(){clearLy();mode=null;restorePts();document.getElementById('usdcPanel').hidden=true;
  document.getElementById('usdcDist').classList.remove('on');document.getElementById('usdcCrime').classList.remove('on');
  document.getElementById('usdcRace').checked=false;document.getElementById('usdcSum').hidden=true;document.getElementById('usdcLeg').hidden=true}
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
