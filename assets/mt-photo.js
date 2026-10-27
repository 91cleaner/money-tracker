/* Curated reference photographs from Wikipedia's page thumbnail API.
 * The thumbnail may depict a building, portrait or company-related subject. Never label it as live CCTV.
 * Photo is displayed only if Wikipedia provides a thumbnail; no AI-generated substitute.
 */
(function(root){
"use strict";
var PAGES={
 "chips-bill":"United States Capitol",
 "chips-sponsor":"Tim Ryan (Ohio politician)",
 "chips-intel":"New Albany, Ohio",
 "chips-tsmc":"Taiwan Semiconductor Manufacturing Company",
 "chips-trades":"United States Capitol",
 "nvda-santa":"Nvidia",
 "nvda-tsmc":"Hsinchu Science Park",
 "nvda-capitol":"United States Capitol",
 "nvda-fed":"Federal Reserve",
 "trade-ustr":"Office of the United States Trade Representative",
 "trade-cn":"Beijing",
 "trade-us":"United States Capitol",
 "rates-fed":"Federal Reserve",
 "rates-ny":"Federal Reserve Bank of New York",
 "history-dc":"United States Department of State",
 "history-tw":"Taipei 101",
 "history-kr":"Seoul",
 "trades-house":"United States Capitol",
 "trades-graph":"United States Capitol",
 "nvda":"Nvidia",
 "chips":"United States Capitol",
 "trade":"United States Capitol",
 "rates":"Federal Reserve",
 "history":"Taipei 101",
 "disclosures":"United States Capitol"
};
var VERIFIED={
 "nvda-santa":{url:"https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/2788-2888_San_Tomas_Expwy.jpg/960px-2788-2888_San_Tomas_Expwy.jpg",source:"https://commons.wikimedia.org/wiki/File:2788-2888_San_Tomas_Expwy.jpg",credit:"NVIDIA 본사 사진 · Coolcaesar (2023) · CC BY-SA 4.0"}
};
var cache={};
function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
function render(container,key,caption){
 var title=PAGES[key];
 if(!container||!title)return;
 container.textContent="";
 var frame=el("div","mt-photo-card");
 var head=el("div","mt-photo-head","FIELD IMAGE · "+(caption||title));
 var note=el("div","mt-photo-note","위키백과 대표 이미지 조회 중 · 실시간 현장 사진 아님");
 var link=el("a","mt-photo-credit","사진 원문 및 출처 ↗");
 link.href="https://en.wikipedia.org/wiki/"+encodeURIComponent(title.replace(/ /g,"_"));
 link.target="_blank";link.rel="noopener noreferrer";
 frame.append(head,note,link);container.append(frame);
 var verified=VERIFIED[key];
 if(verified)link.href=verified.source;
 function show(data){
  if(!frame.isConnected)return;
  if(data&&data.url){
   var img=el("img","mt-photo-img");
   img.alt="위키백과 "+title+" 문서의 대표 이미지 (현장 실시간 영상 아님)";
   img.loading="lazy";img.referrerPolicy="no-referrer";
   img.onerror=function(){img.remove();note.textContent="이미지를 불러올 수 없어 원문 링크만 표시합니다.";};
   img.onload=function(){note.textContent=(data.credit||"Wikipedia / Wikimedia 참고 이미지")+" · 실시간 촬영 아님";};
   img.src=data.url;
   frame.insertBefore(img,note);
  }else note.textContent="확인 가능한 대표 이미지 없음 · 원문 링크에서 확인";
 }
 if(verified){show(verified);return;}
 if(cache[title]){cache[title].then(show);return;}
 var url="https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages&pithumbsize=740&redirects=1&origin=*&titles="+encodeURIComponent(title);
 cache[title]=fetch(url,{mode:"cors",credentials:"omit"}).then(function(r){if(!r.ok)throw Error("Wikipedia HTTP "+r.status);return r.json();}).then(function(x){
  var p=x.query&&x.query.pages&&x.query.pages[0];
  if(!p||!p.thumbnail||!/^https:\/\//.test(p.thumbnail.source))return null;
  if(p.pageimage&&/logo|logotype|wordmark/i.test(p.pageimage))return null;
  return {url:p.thumbnail.source};
 }).catch(function(){return null;});
 cache[title].then(show);
}
root.MTPhoto={render:render,pages:PAGES};
})(typeof globalThis!=="undefined"?globalThis:this);