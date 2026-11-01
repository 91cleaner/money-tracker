(function(){
var box=document.getElementById('usBox');if(!box)return;
var st=document.createElement('style');st.textContent=
'#usBox{margin-top:8px}#usList{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}#usList[hidden]{display:none}'+
'#usList button{min-height:44px;border:1px solid #2e6b4a;border-radius:10px;background:#04140b;color:#e8fff0;font:600 14px system-ui,sans-serif;text-align:left;padding:6px 10px;cursor:pointer}'+
'#usList small{display:block;opacity:.65;font-weight:400;font-size:11px}'+
'body.us-on .leaflet-overlay-pane,body.us-on .leaflet-marker-pane,body.us-on .leaflet-shadow-pane,body.us-on .leaflet-tooltip-pane,body.us-on .leaflet-popup-pane,body.us-on #card,body.us-on #scnBox{display:none!important}'+
'#usP{position:fixed;top:0;bottom:0;right:0;width:var(--sw,360px);box-sizing:border-box;overflow:auto;z-index:6000;background:#fff;color:#111;font:14px system-ui,sans-serif;padding:10px 14px 12px;box-shadow:0 -2px 10px #0003}'+
'@media (max-width:760px) and (orientation:portrait){#usP{top:auto;left:0;width:auto;height:46dvh;padding:8px 12px}}'+
'@media (orientation:landscape) and (max-height:500px){#usP{width:50%;padding:6px 10px}}'+
'#usP .x{position:absolute;right:8px;top:8px;z-index:2;font:600 15px sans-serif;padding:8px 14px;border-radius:8px;border:1px solid #888;background:#fff;cursor:pointer}'+
'#usP .hd{display:flex;gap:10px;align-items:center;padding-right:70px}#usP .yr{font:700 34px sans-serif;line-height:1}#usP .cn{font:700 16px sans-serif}'+
'#usP .tg{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;margin:5px 0 2px;color:#fff}'+
'#usP .pp2{display:flex;gap:10px;margin:4px 0}#usP .pp2 figure{margin:0;display:flex;gap:6px;align-items:center;font-size:12px}#usP .pp2 img{width:40px;height:50px;object-fit:cover;border-radius:4px}'+
'#usP .sd{font-size:12px;color:#555;margin-top:4px}#usP .cap{font-size:15px;margin:2px 0}'+
'#usP .ctl{display:flex;gap:6px;align-items:center;margin-top:6px}#usP .ctl button,#usP .mb{font:14px sans-serif;padding:6px 11px;border-radius:8px;border:1px solid #888;background:#fff;cursor:pointer;color:#111}'+
'#usP input{flex:1}#usP .mo{display:none;font-size:12px;margin-top:6px;line-height:1.5}#usP .mo a{color:#0645ad;word-break:break-all}#usP .mb{margin-top:6px;font-size:13px}'+
'.usLbl{background:#111d;color:#fff;border:0;box-shadow:none;font:600 12px sans-serif;padding:2px 6px}.usLbl:before{display:none}';
document.head.appendChild(st);
var H='<span style="display:block;font-weight:400;font-size:11px;opacity:.75">눌러 보세요</span>';
box.innerHTML='<button type="button" class="btn prime" id="usOpen" style="width:100%;min-height:44px">미국 정권 교체 기록'+H+'</button><div id="usList" hidden></div>';
var D,geo,map,P,lay,grp,c,i=0,tm=null,prev;
var col=function(t){return t.indexOf('직접')==0?'#b03a2e':(t.indexOf('CIA')==0?'#1f4e8c':'#6b5b95')};
var dt=function(d){var a=d.split('-');return a[0]+'년 '+(+a[1])+'월'+(a[2]?' '+(+a[2])+'일':'')};
function load(){return Promise.all([D||fetch('data/usregime.json').then(r=>r.json()).then(j=>D=j),geo||fetch('data/national/countries-110m.geojson').then(r=>r.json()).then(j=>geo=j)])}
document.getElementById('usOpen').onclick=function(){var l=document.getElementById('usList');if(!l.hidden){l.hidden=true;return}
 load().then(function(){l.innerHTML=D.cases.map(function(x,k){return '<button type="button" data-k="'+k+'">'+x.label+'<small>'+x.tag.split(' (')[0]+'</small></button>'}).join('');
  l.querySelectorAll('button').forEach(function(b){b.onclick=function(){l.hidden=true;start(+b.dataset.k)}});l.hidden=false})};
function iso(f){var p=f.properties||{},a=p.ISO_A2;if(!a||a=='-99')a=p.ISO_A2_EH;return a=='CN-TW'?'TW':a}
function ppl(k){var p=k&&D.people[k];return p?'<figure><img src="'+p.img+'" alt="'+p.n+'"><figcaption>'+p.n+'</figcaption></figure>':''}
function start(k){map=window.mtMap;if(!map)return;if(P)stop();c=D.cases[k];
 prev={c:map.getCenter(),z:map.getZoom()};document.body.classList.add('us-on');window.scrollTo(0,0);
 if(!map.getPane('usA')){map.createPane('usA').style.zIndex=350;map.createPane('usM').style.zIndex=640}
 lay=L.geoJSON(geo,{pane:'usA',interactive:false,filter:function(f){return iso(f)==c.cc},style:{weight:2,color:col(c.tag),fillColor:col(c.tag),fillOpacity:.25}}).addTo(map);
 grp=L.layerGroup().addTo(map);
 P=document.createElement('div');P.id='usP';document.body.appendChild(P);
 var cr=[c.us,c.tg].filter(Boolean).map(function(x){var p=D.people[x];return '<div>· '+p.n+' 사진: '+p.lic+', '+p.by+' (<a href="'+p.url+'" target="_blank" rel="noopener">위키미디어 공용</a>)</div>'}).join('');
 P.innerHTML='<button class="x">닫기</button><div class="hd"><div class="yr">'+c.label.slice(-4)+'</div><div><div class="cn">'+c.n+'</div></div></div>'+
 '<div class="tg" style="background:'+col(c.tag)+'">'+c.tag+'</div><div class="pp2">'+ppl(c.us)+ppl(c.tg)+'</div>'+
 '<div class="sd"></div><div class="cap"></div>'+
 '<div class="ctl"><button class="pv">이전</button><button class="pp">멈춤</button><button class="nx">다음</button><input type="range" min="0" max="'+(c.steps.length-1)+'" value="0"></div>'+
 '<button class="mb">자세히 보기</button><div class="mo"><div>'+c.more+'</div><div style="margin-top:4px">출처</div>'+c.src.map(function(s){return '<div>· <a href="'+s[1]+'" target="_blank" rel="noopener">'+s[0]+'</a></div>'}).join('')+'<div style="margin-top:4px">사진</div>'+cr+'<div style="margin-top:4px;color:#666">'+D.note+'</div></div>';
 P.querySelector('.x').onclick=stop;P.querySelector('.pv').onclick=function(){pause();show(i-1)};P.querySelector('.nx').onclick=function(){pause();show(i+1)};
 P.querySelector('.pp').onclick=function(){tm?pause():play()};P.querySelector('input').oninput=function(e){pause();show(+e.target.value)};
 P.querySelector('.mb').onclick=function(){var m=P.querySelector('.mo');m.style.display=m.style.display=='block'?'none':'block'};
 document.addEventListener('keydown',esc);var z=c.view[2];if(window.innerWidth<600)z--;map.setView([c.view[0],c.view[1]],z);show(0);play()}
function esc(e){if(e.key=='Escape')stop()}
function play(){if(i>=c.steps.length-1)show(0);tm=setInterval(function(){if(i>=c.steps.length-1){pause();return}show(i+1)},4000);P.querySelector('.pp').textContent='멈춤'}
function pause(){clearInterval(tm);tm=null;if(P)P.querySelector('.pp').textContent='재생'}
function arrow(a,b,cl,op){L.polyline([a,b],{pane:'usM',color:cl,weight:3,opacity:op,dashArray:'6 5',interactive:false}).addTo(grp);
 var pa=map.latLngToLayerPoint(a),pb=map.latLngToLayerPoint(b),an=Math.atan2(pb.y-pa.y,pb.x-pa.x),s=12;
 var p1=L.point(pb.x-s*Math.cos(an-0.45),pb.y-s*Math.sin(an-0.45)),p2=L.point(pb.x-s*Math.cos(an+0.45),pb.y-s*Math.sin(an+0.45));
 L.polygon([b,map.layerPointToLatLng(p1),map.layerPointToLatLng(p2)],{pane:'usM',color:cl,fillColor:cl,fillOpacity:op,weight:1,opacity:op,interactive:false}).addTo(grp)}
function show(k){k=Math.max(0,Math.min(c.steps.length-1,k));i=k;grp.clearLayers();var cl=col(c.tag),seen={};
 c.steps.slice(0,k+1).forEach(function(s,j){var cur=j==k,op=cur?1:.35;
  s.ar.forEach(function(a){arrow(a[0],a[1],cur?cl:'#888',op)});
  s.p.forEach(function(p){var key=p[0]+','+p[1];if(!cur&&seen[key])return;
   var m=L.circleMarker([p[0],p[1]],{pane:'usM',radius:cur?8:5,color:'#fff',weight:2,fillColor:cur?cl:'#888',fillOpacity:op,interactive:false}).addTo(grp);
   if(cur)m.bindTooltip(p[2],{permanent:true,direction:'right',className:'usLbl',pane:'usM'});seen[key]=1})});
 var s=c.steps[k];P.querySelector('.sd').textContent=(k+1)+'/'+c.steps.length+' 단계 · '+dt(s.d);P.querySelector('.cap').textContent=s.t;P.querySelector('input').value=k}
function stop(){pause();document.removeEventListener('keydown',esc);if(lay)map.removeLayer(lay);if(grp)map.removeLayer(grp);if(P)P.remove();P=null;document.body.classList.remove('us-on');if(prev)map.setView(prev.c,prev.z)}
})();
