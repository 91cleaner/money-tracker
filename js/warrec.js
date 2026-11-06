/* 나라별 전쟁 기록: 나라 버튼 → 전쟁 버튼 → 짧은 재생. 자료: data/warrec.json */
(function(){
var box=document.getElementById('warBox');if(!box)return;
var st=document.createElement('style');st.textContent=
'#warList{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}#warList[hidden],#warSub[hidden],#warCat[hidden]{display:none}#warCat{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}#warCat button{min-height:40px;border:1px solid #6b5a2e;border-radius:10px;background:#141004;color:#fff6e0;font:700 14px system-ui,sans-serif;cursor:pointer}#warCat button.on{background:#3a300d}#usP .bk{font-size:12px;margin:4px 0;line-height:1.5}#usP .bk i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}'+
'#warSub{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}'+
'#warList button,#warSub button{min-height:44px;border:1px solid #2e6b4a;border-radius:10px;background:#04140b;color:#e8fff0;font:600 14px system-ui,sans-serif;text-align:left;padding:6px 10px;cursor:pointer}'+
'#warList button.on{background:#0d3a22}#usP .x{min-width:76px;height:50px;font-size:17px;font-weight:800}#usP .hd{padding-right:90px}.wr-tz{filter:drop-shadow(0 0 3px rgba(0,0,0,.6))}.wr-bang{animation:wrBang 1.4s ease-out forwards}@keyframes wrBang{0%{stroke-opacity:1;fill-opacity:.8}100%{stroke-opacity:0;fill-opacity:0}}.wr-cr{animation:wrCr 2s ease-in-out infinite}@keyframes wrCr{50%{fill-opacity:.12}}#warSub small{display:block;opacity:.65;font-weight:400;font-size:11px}'+
'#usP .lg{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;margin:4px 0}#usP .lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}#usP .ss a{font-size:12px;color:#0645ad;word-break:break-all}';
document.head.appendChild(st);
box.style.marginTop='8px';
box.innerHTML='<button type="button" class="btn prime" id="warOpen" style="width:100%;min-height:44px">세계 역사 기록<span style="display:block;font-weight:400;font-size:11px;opacity:.75">전쟁 · 국경 · 대리전 · 핵실험 · 기지 · 재난</span></button><div id="warCat" hidden></div><div id="warList" hidden></div><div id="warSub" hidden></div>';
var D,geo,map,P,lay,grp,c,i=0,tm=null,prev,SC={a:'#b03a2e',b:'#1f4e8c',c:'#d98a1a',d:'#8a8a8a',e:'#e0a39b',f:'#8fb0dc'};
var dt=function(d){var a=d.split('-');if(!a[1])return a[0];return a[0]+'년 '+(+a[1])+'월'+(a[2]?' '+(+a[2])+'일':'')};
var CATS=[['war','전쟁','data/warrec.json'],['border','국경 변화','data/hist_border.json'],['proxy','냉전 대리전','data/hist_proxy.json'],['nuke','핵실험','data/hist_nuke.json'],['base','군사기지','data/hist_base.json'],['disaster','재난','data/hist_disaster.json']],DS={},cat='war';
function get(k){if(DS[k])return Promise.resolve(DS[k]);var u=CATS.filter(function(x){return x[0]==k})[0][2];return fetch(u).then(r=>r.json()).then(function(j){DS[k]=j;return j})}
function load(){return Promise.all([get('war').then(function(W){var by={};W.countries.forEach(function(x){x.wars.forEach(function(w){by[w.id]=w})});return get(cat).then(function(j){j.countries.forEach(function(x){x.wars=x.wars.map(function(w){if(!w.ref)return w;var o=Object.assign({},by[w.ref]);o.bk=w.bk;o.bks=w.bks;return o})});D=j})}),geo||fetch('data/national/countries-110m.geojson').then(r=>r.json()).then(j=>geo=j)])}
var L1=document.getElementById('warList'),L2=document.getElementById('warSub');
document.getElementById('warOpen').onclick=function(){if(!L1.hidden){L1.hidden=true;L2.hidden=true;document.getElementById('warCat').hidden=true;return}
 var K=document.getElementById('warCat');K.innerHTML=CATS.map(function(x){return '<button type="button" data-c="'+x[0]+'"'+(x[0]==cat?' class="on"':'')+'>'+x[1]+'</button>'}).join('');K.hidden=false;
 K.querySelectorAll('button').forEach(function(b){b.onclick=function(){cat=b.dataset.c;K.querySelectorAll('button').forEach(function(o){o.classList.toggle('on',o==b)});L2.hidden=true;fill()}});fill()};
function fill(){load().then(function(){L1.innerHTML=D.countries.map(function(x,k){return '<button type="button" data-k="'+k+'">'+x.n+'</button>'}).join('');
  L1.querySelectorAll('button').forEach(function(b){b.onclick=function(){L1.querySelectorAll('button').forEach(function(o){o.classList.toggle('on',o==b)});sub(+b.dataset.k)}});L1.hidden=false})}
function sub(k){var C=D.countries[k];L2.innerHTML=C.wars.length?C.wars.map(function(w,j){return '<button type="button" data-j="'+j+'">'+w.label+'<small>'+w.yr+'</small></button>'}).join(''):'<div class="sub">준비 중이에요</div>';
 L2.querySelectorAll('button').forEach(function(b){b.onclick=function(){start(C,+b.dataset.j)}});L2.hidden=false}
function iso(f){var p=f.properties||{},a=p.ISO_A2;if(!a||a=='-99')a=p.ISO_A2_EH;return a=='CN-TW'?'TW':a}
function start(C,j){map=window.mtMap;if(!map)return;if(P)stop();var o=document.querySelector('#usP .x');if(o)o.click();c=C.wars[j];
 prev={c:map.getCenter(),z:map.getZoom()};document.body.classList.add('us-on');window.scrollTo(0,0);
 if(!map.getPane('usA')){map.createPane('usA').style.zIndex=350;map.createPane('usM').style.zIndex=640}
 var side={};c.cc.forEach(function(x){side[x[0]]=x[1]});
 lay=L.geoJSON(geo,{pane:'usA',interactive:false,filter:function(f){return side[iso(f)]},style:function(f){var s=SC[side[iso(f)]];return {weight:2,color:s,fillColor:s,fillOpacity:.08,dashArray:'4 4'}}}).addTo(map);
 grp=L.layerGroup().addTo(map);
 P=document.createElement('div');P.id='usP';document.body.appendChild(P);
 var lg=c.sides.map(function(s){return '<span><i style="background:'+SC[s[0]]+'"></i>'+s[1]+'</span>'}).join('');
 P.innerHTML='<button class="x">닫기</button><div class="hd"><div class="yr">'+c.yr.slice(0,4)+'</div><div><div class="cn">'+c.n+'</div><div style="font-size:12px;color:#555">'+c.yr+'</div></div></div>'+
 '<div class="lg">'+lg+'</div>'+(c.bk?'<div class="bk"><b>지원 세력</b>'+c.bk.map(function(s){return '<div><i style="background:'+SC[s[0]]+'"></i>'+s[1]+'</div>'}).join('')+(c.bks||[]).map(function(s){return '<div>출처: <a href="'+s[1]+'" target="_blank" rel="noopener">'+s[0]+'</a></div>'}).join('')+'</div>':'')+'<div class="sd"></div><div class="cap"></div><div class="ss"></div><div class="ph" hidden></div>'+
 '<div class="ctl"><button class="pv">이전</button><button class="pp">멈춤</button><button class="nx">다음</button><input type="range" min="0" max="'+(c.steps.length-1)+'" value="0"></div>'+
 '<button class="mb">자세히 보기</button><div class="mo"><div>'+c.more+'</div><div style="margin-top:4px">출처</div>'+c.src.map(function(s){return '<div>· <a href="'+s[1]+'" target="_blank" rel="noopener">'+s[0]+'</a></div>'}).join('')+'<div style="margin-top:4px;color:#666">'+D.note+'</div></div>';
 P.querySelector('.x').onclick=stop;P.querySelector('.pv').onclick=function(){pause();show(i-1)};P.querySelector('.nx').onclick=function(){pause();show(i+1)};
 P.querySelector('.pp').onclick=function(){tm?pause():play()};P.querySelector('input').oninput=function(e){pause();show(+e.target.value)};
 P.querySelector('.mb').onclick=function(){var m=P.querySelector('.mo');m.style.display=m.style.display=='block'?'none':'block'};
 document.addEventListener('keydown',esc);var z=c.view[2];if(window.innerWidth<600)z--;if(c.vb)map.fitBounds(c.vb,{padding:[10,10]});else map.setView([c.view[0],c.view[1]],z);show(0);play()}
function esc(e){if(e.key=='Escape')stop()}
function play(){if(i>=c.steps.length-1)show(0);tm=setInterval(function(){if(i>=c.steps.length-1){pause();return}show(i+1)},4500);P.querySelector('.pp').textContent='멈춤'}
function pause(){clearInterval(tm);tm=null;if(P)P.querySelector('.pp').textContent='재생'}
function rs(r,n,closed){var q=r.slice();if(closed)q.push(r[0]);var d=[0],i2,t=0;for(i2=1;i2<q.length;i2++){t+=Math.hypot(q[i2][0]-q[i2-1][0],q[i2][1]-q[i2-1][1]);d.push(t)}
 var o=[],j=0;for(var k2=0;k2<n;k2++){var u=t*k2/(closed?n:n-1);while(j<q.length-2&&d[j+1]<u)j++;var g=d[j+1]-d[j]||1,f=Math.min(1,(u-d[j])/g);o.push([q[j][0]+(q[j+1][0]-q[j][0])*f,q[j][1]+(q[j+1][1]-q[j][1])*f])}return o}
function al(a,b){var n=a.length,best=0,bv=1e18;for(var r=0;r<n;r+=2){var v=0;for(var k2=0;k2<n;k2+=4){var x=b[(k2+r)%n];v+=Math.pow(a[k2][0]-x[0],2)+Math.pow(a[k2][1]-x[1],2)}if(v<bv){bv=v;best=r}}return b.slice(best).concat(b.slice(0,best))}
function cen(r){var a=0,b=0;r.forEach(function(p){a+=p[0];b+=p[1]});return [a/r.length,b/r.length]}
var TZ={},LN=[],raf=null,NP=72;
function tzAt(k){for(var j=k;j>=0;j--)if(c.steps[j].tz)return c.steps[j].tz;return []}
function lnAt(k){for(var j=k;j>=0;j--)if(c.steps[j].ln)return c.steps[j].ln;return []}
function morph(k){if(raf)cancelAnimationFrame(raf);var T=tzAt(k),want={},cnt={};
 T.forEach(function(t){var sd=t[1];cnt[sd]=(cnt[sd]||0)+1;want[sd+(cnt[sd]-1)]={sd:sd,to:rs(t[0],NP,1)}});
 var jobs=[];Object.keys(TZ).forEach(function(key){if(!want[key]){var o=TZ[key],ce=cen(o.cur);jobs.push({o:o,a:o.cur,b:o.cur.map(function(){return ce}),kill:key})}});
 Object.keys(want).forEach(function(key){var w=want[key],o=TZ[key];
  if(!o){var ce=cen(w.to);o=TZ[key]={cur:w.to.map(function(){return ce}),ly:L.polygon(w.to.map(function(){return ce}),{pane:'usA',color:SC[w.sd],weight:3,fillColor:SC[w.sd],fillOpacity:.5,className:'wr-tz',interactive:false}).addTo(map)}}
  jobs.push({o:o,a:o.cur,b:al(o.cur,w.to)})});
 var L0=lnAt(k),lj=[];L0.forEach(function(l,n){var to=rs(l,40,0),o=LN[n];if(!o){o=LN[n]={cur:to.map(function(){return to[0]}),bg:L.polyline([],{pane:'usM',color:'#000',weight:8,opacity:.55,interactive:false}).addTo(map),fg:L.polyline([],{pane:'usM',color:'#fff',weight:4,dashArray:'10 6',className:'us-arr',interactive:false}).addTo(map)}}lj.push({o:o,a:o.cur,b:to})});
 LN.slice(L0.length).forEach(function(o){map.removeLayer(o.bg);map.removeLayer(o.fg)});LN.length=L0.length;
 var t0=performance.now(),D0=2200;
 function fr(now){var u=Math.min(1,(now-t0)/D0),e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
  jobs.forEach(function(j){j.o.cur=j.a.map(function(p,n){return [p[0]+(j.b[n][0]-p[0])*e,p[1]+(j.b[n][1]-p[1])*e]});j.o.ly.setLatLngs(j.o.cur)});
  lj.forEach(function(j){j.o.cur=j.a.map(function(p,n){return [p[0]+(j.b[n][0]-p[0])*e,p[1]+(j.b[n][1]-p[1])*e]});j.o.bg.setLatLngs(j.o.cur);j.o.fg.setLatLngs(j.o.cur)});
  if(u<1)raf=requestAnimationFrame(fr);else{raf=null;jobs.forEach(function(j){if(j.kill){map.removeLayer(j.o.ly);delete TZ[j.kill]}})}}
 raf=requestAnimationFrame(fr)}
function clearMorph(){if(raf)cancelAnimationFrame(raf);raf=null;Object.keys(TZ).forEach(function(key){map.removeLayer(TZ[key].ly)});TZ={};LN.forEach(function(o){map.removeLayer(o.bg);map.removeLayer(o.fg)});LN=[]}
function head(a,b,cl,op,g){var pa=map.latLngToLayerPoint(a),pb=map.latLngToLayerPoint(b),an=Math.atan2(pb.y-pa.y,pb.x-pa.x),s=op<1?12:24;
 var p1=L.point(pb.x-s*Math.cos(an-0.45),pb.y-s*Math.sin(an-0.45)),p2=L.point(pb.x-s*Math.cos(an+0.45),pb.y-s*Math.sin(an+0.45));
 return L.polygon([b,map.layerPointToLatLng(p1),map.layerPointToLatLng(p2)],{pane:'usM',color:cl,fillColor:cl,fillOpacity:op,weight:1,opacity:op,interactive:false}).addTo(g)}
function arrow(a,b,cl,op){if(op<1){L.polyline([a,b],{pane:'usM',color:cl,weight:3,opacity:op,dashArray:'12 8',interactive:false}).addTo(grp);head(a,b,cl,op,grp);return}
 var sh=L.polyline([a,a],{pane:'usM',color:'#000',weight:13,opacity:.45,interactive:false}).addTo(grp),ln=L.polyline([a,a],{pane:'usM',color:cl,weight:9,opacity:1,dashArray:'16 8',className:'us-arr',interactive:false}).addTo(grp),hd=null,t0=performance.now(),g=grp;
 (function f(now){if(g!==grp||!map.hasLayer(ln))return;var u=Math.min(1,(now-t0)/1500),e=1-Math.pow(1-u,3),m=[a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e];sh.setLatLngs([a,m]);ln.setLatLngs([a,m]);if(hd)g.removeLayer(hd);if(e>.02)hd=head(a,m,cl,1,g);if(u<1)requestAnimationFrame(f)})(t0)}
function bang(la,lo,g){[0,500,1000].forEach(function(dl,n){setTimeout(function(){if(g!==grp)return;window.HFX&&HFX.fire(la,lo,g,'usM');var r=L.circle([la,lo],{pane:'usM',radius:60000+n*40000,color:'#ffcf4d',weight:3,fillColor:'#ff5a1f',fillOpacity:.6,className:'wr-bang',interactive:false}).addTo(g);setTimeout(function(){g.removeLayer(r)},1500)},900+dl)})}
function show(k){k=Math.max(0,Math.min(c.steps.length-1,k));i=k;map.removeLayer(grp);grp=L.layerGroup().addTo(map);var seen={};
 c.steps.slice(0,k+1).forEach(function(s,j){var cur=j==k,op=cur?1:.35;
  (s.ar||[]).forEach(function(a){arrow(a[0],a[1],cur?SC[a[2]||'a']:'#888',op)});
  (s.p||[]).forEach(function(p){var key=p[0]+','+p[1];if(!cur&&seen[key])return;
   var m=L.circleMarker([p[0],p[1]],{pane:'usM',radius:cur?8:5,color:'#fff',weight:2,fillColor:cur?'#111':'#888',fillOpacity:op,interactive:false}).addTo(grp);
   if(cur)m.bindTooltip(p[2],{permanent:true,direction:'right',className:'usLbl',pane:'usM'});seen[key]=1})});
 var s=c.steps[k];
 morph(k);
 (s.cr||[]).forEach(function(r){L.circle([r[0],r[1]],{pane:'usA',radius:Math.max(r[2]*1000,30000),color:SC[r[3]],weight:2,fillColor:SC[r[3]],fillOpacity:.4,className:'wr-cr',interactive:false}).addTo(grp)});
 if(s.v)map.flyToBounds(s.v,{duration:1.1,padding:[10,10]});else if(k>0&&c.steps[k-1].v)map.flyToBounds(c.vb||[[c.view[0]-5,c.view[1]-5],[c.view[0]+5,c.view[1]+5]],{duration:1.1,padding:[10,10]});
 (s.f||[]).forEach(function(f){bang(f[0],f[1],grp)});if(window.HFX){(s.c||[]).forEach(function(n){HFX.num(n[0],n[1],n[2],n[3],grp,'usM')})}
 P.querySelector('.sd').textContent=(k+1)+'/'+c.steps.length+' 단계 · '+dt(s.d);P.querySelector('.cap').textContent=s.t;
 P.querySelector('.ss').innerHTML=s.s?'<span>출처</span> <a href="'+s.s[1]+'" target="_blank" rel="noopener">'+s.s[0]+'</a>'+(s.s2?'<br><span>출처</span> <a href="'+s.s2[1]+'" target="_blank" rel="noopener">'+s.s2[0]+'</a>':''):'';P.querySelector('input').value=k;
 if(window.HFX){HFX.thumb(P.querySelector('.ph'),'war:'+c.id+':'+k);HFX.tl(c.steps.map(function(x){return x.d}),k,function(j){pause();show(j)})}}
function stop(){pause();window.HFX&&HFX.end();document.removeEventListener('keydown',esc);clearMorph();if(lay)map.removeLayer(lay);if(grp)map.removeLayer(grp);if(P)P.remove();P=null;document.body.classList.remove('us-on');if(prev)map.setView(prev.c,prev.z)}
})();
