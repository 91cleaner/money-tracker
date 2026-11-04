/* 해저 케이블 켜기/끄기 층. 자료: data/cables.json (TeleGeography 2022, CC BY-NC-SA 3.0) */
(function(){
var tg=document.getElementById('cableTg');if(!tg)return;
var D=null,ly=null,rd=null;
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function card(c){var el=document.getElementById('cabCard');if(!el){el=document.createElement('div');el.id='cabCard';el.style.cssText='position:fixed;left:12px;bottom:70px;z-index:1200;width:300px;max-height:45vh;overflow:auto;background:#fff;color:#111;border-radius:12px;padding:10px 12px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4)';document.body.appendChild(el)}
 var u='https://github.com/stevesong/open_undersea_cable_map/blob/main/cable/'+encodeURIComponent(c.id)+'.json';
 el.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><b style="font-size:15px">'+esc(c.n)+'</b><button type="button" id="cabX" style="min-width:76px;height:44px;font-size:16px;font-weight:800;border-radius:10px;cursor:pointer">닫기</button></div>'+
 '<div><span>상륙 지점</span>: '+c.lp.map(esc).join(' · ')+'</div>'+
 (c.len?'<div><span>길이</span>: '+esc(c.len)+'</div>':'')+(c.rfs?'<div><span>개통</span>: '+esc(c.rfs)+(c.pl?' (<span>계획</span>)':'')+'</div>':'')+
 '<div style="margin-top:4px"><span>출처</span>: <a href="'+u+'" target="_blank" rel="noopener">TeleGeography Submarine Cable Map (2022)</a> · <a href="'+D.lic+'" target="_blank" rel="noopener">CC BY-NC-SA 3.0</a></div>'+
 '<div style="opacity:.7;font-size:12px"><span>2022년 자료라 그 뒤에 생긴 케이블은 없어요. 선은 대략적인 경로예요.</span></div>';
 document.getElementById('cabX').onclick=function(){el.remove()};
}
function draw(){var map=window.mtMap;if(!map)return;
 if(!map.getPane('cab')){map.createPane('cab').style.zIndex=380}
 rd=rd||L.canvas({pane:'cab',tolerance:6});ly=L.layerGroup();
 D.cables.forEach(function(c){c.l.forEach(function(l){L.polyline(l,{renderer:rd,pane:'cab',color:c.col,weight:1.6,opacity:.75,dashArray:c.pl?'4 4':null}).on('click',function(){card(c)}).addTo(ly)})});
 ly.addTo(map);if(!map._cabAttr){map.attributionControl.addAttribution('해저 케이블: <a href="'+D.srcu+'" target="_blank" rel="noopener">TeleGeography (2022, CC BY-NC-SA 3.0)</a>');map._cabAttr=1}}
tg.addEventListener('change',function(){var map=window.mtMap;if(!map)return;
 if(!tg.checked){if(ly)map.removeLayer(ly);var k=document.getElementById('cabCard');if(k)k.remove();return}
 if(ly){ly.addTo(map);return}
 (D?Promise.resolve(D):fetch('data/cables.json').then(function(r){return r.json()}).then(function(j){D=j;return j})).then(draw)});
})();
