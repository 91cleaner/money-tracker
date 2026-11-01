/* 나라별 전쟁 기록: 나라 버튼 → 전쟁 버튼 → 짧은 재생. 자료: data/warrec.json */
(function(){
var box=document.getElementById('warBox');if(!box)return;
var st=document.createElement('style');st.textContent=
'#warList{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}#warList[hidden],#warSub[hidden]{display:none}'+
'#warSub{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}'+
'#warList button,#warSub button{min-height:44px;border:1px solid #2e6b4a;border-radius:10px;background:#04140b;color:#e8fff0;font:600 14px system-ui,sans-serif;text-align:left;padding:6px 10px;cursor:pointer}'+
'#warList button.on{background:#0d3a22}#warSub small{display:block;opacity:.65;font-weight:400;font-size:11px}'+
'#usP .lg{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin:4px 0}#usP .lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}#usP .ss a{font-size:12px;color:#0645ad;word-break:break-all}';
document.head.appendChild(st);
box.style.marginTop='8px';
box.innerHTML='<button type="button" class="btn prime" id="warOpen" style="width:100%;min-height:44px">나라별 전쟁 기록<span style="display:block;font-weight:400;font-size:11px;opacity:.75">눌러 보세요</span></button><div id="warList" hidden></div><div id="warSub" hidden></div>';
var D,geo,map,P,lay,grp,c,i=0,tm=null,prev,SC={a:'#b03a2e',b:'#1f4e8c',c:'#d98a1a'};
var dt=function(d){var a=d.split('-');return a[0]+'년 '+(+a[1])+'월'+(a[2]?' '+(+a[2])+'일':'')};
function load(){return Promise.all([D||fetch('data/warrec.json').then(r=>r.json()).then(j=>D=j),geo||fetch('data/national/countries-110m.geojson').then(r=>r.json()).then(j=>geo=j)])}
var L1=document.getElementById('warList'),L2=document.getElementById('warSub');
document.getElementById('warOpen').onclick=function(){if(!L1.hidden){L1.hidden=true;L2.hidden=true;return}
 load().then(function(){L1.innerHTML=D.countries.map(function(x,k){return '<button type="button" data-k="'+k+'">'+x.n+'</button>'}).join('');
  L1.querySelectorAll('button').forEach(function(b){b.onclick=function(){L1.querySelectorAll('button').forEach(function(o){o.classList.toggle('on',o==b)});sub(+b.dataset.k)}});L1.hidden=false})};
function sub(k){var C=D.countries[k];L2.innerHTML=C.wars.length?C.wars.map(function(w,j){return '<button type="button" data-j="'+j+'">'+w.label+'<small>'+w.yr+'</small></button>'}).join(''):'<div class="sub">준비 중이에요</div>';
 L2.querySelectorAll('button').forEach(function(b){b.onclick=function(){start(C,+b.dataset.j)}});L2.hidden=false}
function iso(f){var p=f.properties||{},a=p.ISO_A2;if(!a||a=='-99')a=p.ISO_A2_EH;return a=='CN-TW'?'TW':a}
function start(C,j){map=window.mtMap;if(!map)return;if(P)stop();var o=document.querySelector('#usP .x');if(o)o.click();c=C.wars[j];
 prev={c:map.getCenter(),z:map.getZoom()};document.body.classList.add('us-on');window.scrollTo(0,0);
 if(!map.getPane('usA')){map.createPane('usA').style.zIndex=350;map.createPane('usM').style.zIndex=640}
 var side={};c.cc.forEach(function(x){side[x[0]]=x[1]});
 lay=L.geoJSON(geo,{pane:'usA',interactive:false,filter:function(f){return side[iso(f)]},style:function(f){var s=SC[side[iso(f)]];return {weight:2,color:s,fillColor:s,fillOpacity:.3}}}).addTo(map);
 grp=L.layerGroup().addTo(map);
 P=document.createElement('div');P.id='usP';document.body.appendChild(P);
 var lg=c.sides.map(function(s){return '<span><i style="background:'+SC[s[0]]+'"></i>'+s[1]+'</span>'}).join('');
 P.innerHTML='<button class="x">닫기</button><div class="hd"><div class="yr">'+c.yr.slice(0,4)+'</div><div><div class="cn">'+c.n+'</div><div style="font-size:12px;color:#555">'+c.yr+'</div></div></div>'+
 '<div class="lg">'+lg+'</div><div class="sd"></div><div class="cap"></div><div class="ss"></div><div class="ph" hidden></div>'+
 '<div class="ctl"><button class="pv">이전</button><button class="pp">멈춤</button><button class="nx">다음</button><input type="range" min="0" max="'+(c.steps.length-1)+'" value="0"></div>'+
 '<button class="mb">자세히 보기</button><div class="mo"><div>'+c.more+'</div><div style="margin-top:4px">출처</div>'+c.src.map(function(s){return '<div>· <a href="'+s[1]+'" target="_blank" rel="noopener">'+s[0]+'</a></div>'}).join('')+'<div style="margin-top:4px;color:#666">'+D.note+'</div></div>';
 P.querySelector('.x').onclick=stop;P.querySelector('.pv').onclick=function(){pause();show(i-1)};P.querySelector('.nx').onclick=function(){pause();show(i+1)};
 P.querySelector('.pp').onclick=function(){tm?pause():play()};P.querySelector('input').oninput=function(e){pause();show(+e.target.value)};
 P.querySelector('.mb').onclick=function(){var m=P.querySelector('.mo');m.style.display=m.style.display=='block'?'none':'block'};
 document.addEventListener('keydown',esc);var z=c.view[2];if(window.innerWidth<600)z--;map.setView([c.view[0],c.view[1]],z);show(0);play()}
function esc(e){if(e.key=='Escape')stop()}
function play(){if(i>=c.steps.length-1)show(0);tm=setInterval(function(){if(i>=c.steps.length-1){pause();return}show(i+1)},4500);P.querySelector('.pp').textContent='멈춤'}
function pause(){clearInterval(tm);tm=null;if(P)P.querySelector('.pp').textContent='재생'}
function arrow(a,b,cl,op){L.polyline([a,b],{pane:'usM',color:cl,weight:op<1?3:7,opacity:op,dashArray:'12 8',className:op<1?'':'us-arr',interactive:false}).addTo(grp);
 var pa=map.latLngToLayerPoint(a),pb=map.latLngToLayerPoint(b),an=Math.atan2(pb.y-pa.y,pb.x-pa.x),s=op<1?12:20;
 var p1=L.point(pb.x-s*Math.cos(an-0.45),pb.y-s*Math.sin(an-0.45)),p2=L.point(pb.x-s*Math.cos(an+0.45),pb.y-s*Math.sin(an+0.45));
 L.polygon([b,map.layerPointToLatLng(p1),map.layerPointToLatLng(p2)],{pane:'usM',color:cl,fillColor:cl,fillOpacity:op,weight:1,opacity:op,interactive:false}).addTo(grp)}
function show(k){k=Math.max(0,Math.min(c.steps.length-1,k));i=k;grp.clearLayers();var seen={};
 c.steps.slice(0,k+1).forEach(function(s,j){var cur=j==k,op=cur?1:.35;
  (s.ar||[]).forEach(function(a){arrow(a[0],a[1],cur?SC[a[2]||'a']:'#888',op)});
  (s.p||[]).forEach(function(p){var key=p[0]+','+p[1];if(!cur&&seen[key])return;
   var m=L.circleMarker([p[0],p[1]],{pane:'usM',radius:cur?8:5,color:'#fff',weight:2,fillColor:cur?'#111':'#888',fillOpacity:op,interactive:false}).addTo(grp);
   if(cur)m.bindTooltip(p[2],{permanent:true,direction:'right',className:'usLbl',pane:'usM'});seen[key]=1})});
 var s=c.steps[k];if(window.HFX){(s.f||[]).forEach(function(f){HFX.fire(f[0],f[1],grp,'usM')});(s.c||[]).forEach(function(n){HFX.num(n[0],n[1],n[2],n[3],grp,'usM')})}
 P.querySelector('.sd').textContent=(k+1)+'/'+c.steps.length+' 단계 · '+dt(s.d);P.querySelector('.cap').textContent=s.t;
 P.querySelector('.ss').innerHTML=s.s?'<span>출처</span> <a href="'+s.s[1]+'" target="_blank" rel="noopener">'+s.s[0]+'</a>':'';P.querySelector('input').value=k;
 if(window.HFX){HFX.thumb(P.querySelector('.ph'),'war:'+c.id+':'+k);HFX.tl(c.steps.map(function(x){return x.d}),k,function(j){pause();show(j)})}}
function stop(){pause();window.HFX&&HFX.end();document.removeEventListener('keydown',esc);if(lay)map.removeLayer(lay);if(grp)map.removeLayer(grp);if(P)P.remove();P=null;document.body.classList.remove('us-on');if(prev)map.setView(prev.c,prev.z)}
})();
