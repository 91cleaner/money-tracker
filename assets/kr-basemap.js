(function(){if(document.getElementById('mt-darksat-css'))return;var s=document.createElement('style');s.id='mt-darksat-css';s.textContent='.mt-darksat{filter:brightness(.42) saturate(.45) contrast(1.05)}';document.head.appendChild(s)})();
/* 한국 쪽 지도 공통 바탕: national.html(polgame.js)과 같은 Esri 어두운 회색 바탕 + 확대하면 위성 사진 + 나라 경계선. */
(function(){
var DARK='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
window.mtKoreaDark=function(o){return L.tileLayer(DARK,Object.assign({className:'mt-darksat',maxZoom:12,attribution:'지도: 지도·위성: Esri, Maxar'},o||{}))};
window.mtKoreaExtras=function(map){if(!map||map.__krx)return;map.__krx=1;
 map.createPane('sat');map.getPane('sat').style.zIndex=250;map.getPane('sat').style.filter='brightness(.72) contrast(1.12) saturate(.75)';
 map.createPane('satlab');map.getPane('satlab').style.zIndex=260;map.getPane('satlab').style.pointerEvents='none';
 var sat=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{pane:'sat',maxZoom:18,maxNativeZoom:18,minZoom:6,opacity:0}).addTo(map);
 var lab={setOpacity:function(){}};
 var fade=function(){var o=Math.max(0,Math.min(1,(map.getZoom()-6.5)/1.5));sat.setOpacity(o);lab.setOpacity(o*.85)};map.on('zoom zoomend',fade);fade();
 map.createPane('countryBorders');map.getPane('countryBorders').style.zIndex=390;map.getPane('countryBorders').style.pointerEvents='none';
 var b=L.geoJSON(null,{pane:'countryBorders',interactive:false,style:function(){return{color:'#5b91b8',weight:.65,opacity:.48,fillColor:'#12304a',fillOpacity:.035}}}).addTo(map);
 fetch('data/national/countries-110m.geojson',{cache:'force-cache'}).then(function(r){return r.ok?r.json():null}).then(function(g){if(g&&g.features)b.addData(g)}).catch(function(){});
};
})();
