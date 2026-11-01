(function(){
var box=document.getElementById('usBox');if(!box)return;
var st=document.createElement('style');st.textContent=
'#usBox{margin-top:8px}'+
'#usOpen{width:100%;min-height:44px;border:1px solid #2e6b4a;border-radius:10px;background:#04140b;color:#e8fff0;font:600 15px system-ui,sans-serif;cursor:pointer}'+
'#usList{display:none;margin-top:6px}'+
'#usList button{width:100%;min-height:44px;border:1px solid #2e6b4a;border-radius:10px;background:#04140b;color:#e8fff0;font:600 14px system-ui,sans-serif;text-align:left;padding:6px 10px;cursor:pointer}'+
'body.us-on .leaflet-overlay-pane,body.us-on .leaflet-marker-pane,body.us-on .leaflet-shadow-pane,body.us-on .leaflet-tooltip-pane,body.us-on .leaflet-popup-pane,body.us-on #card,body.us-on #scnBox{display:none!important}'+
'#usP{position:fixed;top:0;bottom:0;right:0;width:var(--sw,360px);height:100dvh;box-sizing:border-box;overflow:auto;z-index:3500;background:#fff;color:#111;font:14px sans-serif;padding:12px 16px 14px;box-shadow:0 -2px 10px #0003;}'+'@media (max-width:760px) and (orientation:portrait){#usP{top:auto;left:0;width:auto;height:50dvh}}'+
'#usP .x{position:absolute;right:10px;top:10px;z-index:2;font:600 15px sans-serif;padding:8px 14px;border-radius:8px;border:1px solid #888;background:#fff;cursor:pointer}'+
'#usP .ttl{font-size:12px;color:#555}#usP .yr{font:700 40px sans-serif;line-height:1.1}#usP .cn{font:700 18px sans-serif}'+
'#usP .tg{display:inline-block;font-size:12px;padding:2px 8px;border-radius:10px;margin:4px 0;color:#fff}'+
'#usP .cap{font-size:15px;margin:4px 0}#usP .ctl{display:flex;gap:8px;align-items:center;margin-top:8px}'+
'#usP .ctl button{font:14px sans-serif;padding:7px 12px;border-radius:8px;border:1px solid #888;background:#fff;cursor:pointer;color:#111}'+
'#usP input{flex:1}#usP .mo{display:none;font-size:13px;margin-top:6px;line-height:1.5}#usP .mo a{color:#0645ad;word-break:break-all}'+
'#usP .nt{font-size:11px;color:#666;margin-top:6px}'+
'@media (orientation:landscape) and (max-height:500px){#usP{width:52%}#usP .yr{font-size:30px}}';
document.head.appendChild(st);
box.innerHTML='<button id="usOpen">미국</button><div id="usList"><button data-k="r">미국 정권 교체 기록</button></div>';
var D,geo,map,P,lay,i=0,tm=null,prev;
var col=function(t){return t.indexOf('직접')==0?'#b03a2e':(t.indexOf('CIA')==0?'#1f4e8c':'#6b5b95')};
document.getElementById('usOpen').onclick=function(){var l=document.getElementById('usList');l.style.display=l.style.display=='block'?'none':'block'};
box.querySelector('[data-k=r]').onclick=function(){document.getElementById('usList').style.display='none';start()};
function load(){return Promise.all([D||fetch('data/usregime.json').then(r=>r.json()).then(j=>D=j),geo||fetch('data/national/countries-110m.geojson').then(r=>r.json()).then(j=>geo=j)])}
function iso(f){var p=f.properties||{},a=p.ISO_A2;if(!a||a=='-99')a=p.ISO_A2_EH;return a=='CN-TW'?'TW':a}
function start(){map=window.mtMap;if(!map)return;load().then(function(){
 prev={c:map.getCenter(),z:map.getZoom()};document.body.classList.add('us-on');window.scrollTo(0,0);
 if(!map.getPane('usA')){map.createPane('usA').style.zIndex=350}
 lay=L.geoJSON(geo,{pane:'usA',interactive:false,filter:function(f){return D.cases.some(c=>c.cc==iso(f))},style:{weight:0,fillOpacity:0}}).addTo(map);
 P=document.createElement('div');P.id='usP';document.body.appendChild(P);
 P.innerHTML='<button class="x">닫기</button><div class="ttl">'+D.title+'</div><div class="yr"></div><div class="cn"></div><div class="tg"></div><div class="cap"></div>'+
 '<div class="ctl"><button class="pv">이전</button><button class="pp">멈춤</button><button class="nx">다음</button><input type="range" min="0" max="'+(D.cases.length-1)+'" value="0"></div>'+
 '<button class="mb" style="margin-top:8px;font:13px sans-serif;padding:6px 10px;border-radius:8px;border:1px solid #888;background:#fff;cursor:pointer">자세히 보기</button><div class="mo"></div><div class="nt">'+D.note+'</div>';
 P.querySelector('.x').onclick=stop;P.querySelector('.pv').onclick=function(){pause();show(i-1)};P.querySelector('.nx').onclick=function(){pause();show(i+1)};
 P.querySelector('.pp').onclick=function(){tm?pause():play()};P.querySelector('input').oninput=function(e){pause();show(+e.target.value)};
 P.querySelector('.mb').onclick=function(){var m=P.querySelector('.mo');m.style.display=m.style.display=='block'?'none':'block'};
 document.addEventListener('keydown',esc);show(0);play();
})}
function esc(e){if(e.key=='Escape')stop()}
function play(){if(i>=D.cases.length-1)show(0);tm=setInterval(function(){if(i>=D.cases.length-1){pause();return}show(i+1)},4500);P.querySelector('.pp').textContent='멈춤'}
function pause(){clearInterval(tm);tm=null;if(P)P.querySelector('.pp').textContent='재생'}
function show(k){k=Math.max(0,Math.min(D.cases.length-1,k));i=k;var c=D.cases[k];
 var seen={};D.cases.slice(0,k).forEach(x=>seen[x.cc]=1);
 lay.setStyle(function(f){var a=iso(f);return a==c.cc?{weight:2,color:col(c.tag),fillColor:col(c.tag),fillOpacity:.55}:(seen[a]?{weight:1,color:'#777',fillColor:'#999',fillOpacity:.3}:{weight:0,fillOpacity:0})});
 P.querySelector('.yr').textContent=c.d.slice(0,4);P.querySelector('.cn').textContent=c.n;
 var t=P.querySelector('.tg');t.textContent=c.tag;t.style.background=col(c.tag);
 P.querySelector('.cap').textContent=c.t+' ('+c.d.replace(/^(\d+)-0?(\d+)-0?(\d+)$/,'$1년 $2월 $3일')+')';
 P.querySelector('.mo').innerHTML='<div>'+c.more+'</div><div style="margin-top:4px">출처</div>'+c.src.map(s=>'<div>· <a href="'+s[1]+'" target="_blank" rel="noopener">'+s[0]+'</a></div>').join('');
 P.querySelector('input').value=k;map.flyTo(c.ll,window.innerWidth<600?3:4,{duration:1.2})}
function stop(){pause();document.removeEventListener('keydown',esc);if(lay)map.removeLayer(lay);if(P)P.remove();P=null;document.body.classList.remove('us-on');if(prev)map.setView(prev.c,prev.z)}
})();
