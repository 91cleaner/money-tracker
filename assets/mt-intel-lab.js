/* 미국주식추적단 public research lab. Only uses verified public records; no private scoring. */
(()=>{'use strict';
const $=id=>document.getElementById(id), state={members:[],selected:null,bills:[],map:null,markers:[]};
const events=new Set(['member_selected','bill_opened','source_opened','mission_started','trace_completed']);
function track(event){if(!events.has(event))return;try{if(window.goatcounter?.count)window.goatcounter.count({path:'/events/'+event,title:'미국주식추적단 / '+event,event:true});}catch{}}
const text=(node,value)=>{node.textContent=String(value??'');return node};
function element(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)text(e,value);return e}
function source(parent,url,label){if(!/^https:\/\/[\w.-]+(?:\/|$)/i.test(url||''))return;const a=element('a','source',label+' ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',()=>track('source_opened'));parent.append(a)}
function clearMarkers(){state.markers.forEach(m=>state.map.removeLayer(m));state.markers=[]}
function renderMap(member){if(!state.map||!Array.isArray(member.ll)||member.ll.length!==2)return;clearMarkers();const ll=member.ll.map(Number);if(ll.some(x=>!Number.isFinite(x)))return;state.map.flyTo(ll,8,{animate:true,duration:2.2});const marker=L.marker(ll).addTo(state.map);marker.bindPopup(element('span','',member.name+' · '+member.state));state.markers.push(marker)}
function traceBill(bill){
 const member=state.selected;if(!member||!state.map||!Array.isArray(member.ll))return;
 clearMarkers();const home=member.ll.map(Number),capitol=[38.8899,-77.0091];
 const route=L.polyline([home,capitol],{color:'#7bffad',weight:2,dashArray:'6 8',opacity:.85}).addTo(state.map);
 const homePin=L.marker(home).addTo(state.map).bindPopup(member.name+' · 공개 지역 좌표');
 const congressPin=L.marker(capitol).addTo(state.map).bindPopup('미국 의회 · '+(bill.no||'법안'));
 state.markers.push(route,homePin,congressPin);
 state.map.flyToBounds([home,capitol],{padding:[55,55],duration:2.5});
 $('traceStatus').textContent='지역 → 미국 의회 · '+(bill.no||'법안')+' · 실제 의원 이동 경로 아님';
 track('trace_completed');
}
function renderMember(member){
 state.selected=member;track('member_selected');
 $('selected').hidden=false;$('name').textContent=member.name;
 $('bio').textContent=[member.party==='D'?'민주당':member.party==='R'?'공화당':'무소속',member.state,member.chamber==='sen'?'상원':'하원'].join(' · ');
 $('portrait').replaceChildren();if(/^https:\/\/unitedstates\.github\.io\/images\/congress\//.test(member.pic||'')){const img=element('img');img.src=member.pic;img.alt=member.name+' 공식 인물 사진 출처';img.loading='lazy';img.referrerPolicy='no-referrer';$('portrait').append(img)}
 $('traceStatus').textContent='법안 기록을 선택하면 지역과 의회 간 정책 관계를 지도에서 보여줍니다.';
 $('committees').replaceChildren();(member.cmits||[]).slice(0,6).forEach(c=>$('committees').append(element('li','',c)));
 renderMap(member);loadBills(member);
}
async function loadBills(member){
 const id=member.id;const container=$('bills');container.replaceChildren(element('p','muted','공식 법안 기록 불러오는 중…'));
 try{
  const response=await fetch('data/us/bills/'+encodeURIComponent(id)+'.json',{cache:'no-store'});
  if(!response.ok)throw Error('no bill file');
  const bills=await response.json();if(!Array.isArray(bills))throw Error('invalid bill file');
  if(state.selected?.id!==id)return;
  state.bills=bills;container.replaceChildren();
  $('billCount').textContent=bills.length+'개 법안 기록 · 출처: Congress.gov · 현재 수집 범위';
  if(!bills.length)container.append(element('p','muted','수집된 법안 기록 없음. 실제 발의 건수가 0건이라는 뜻은 아님.'));
  bills.slice(0,35).forEach(b=>{
   const article=element('article','bill');const title=element('strong','',b.n||b.no||'제목 미확인');
   article.append(title,element('small','',[(b.no||''),(b.d||''),(b.law?'법률 제정':b.pass?'의회 통과':'진행 기록')].filter(Boolean).join(' · ')));
   if(b.a)article.append(element('p','',b.a));
   source(article,b.u,'Congress.gov 원문');
   const trace=element('button','result','지도에서 법안 추적');trace.type='button';trace.addEventListener('click',()=>{track('bill_opened');traceBill(b)});article.append(trace);
   container.append(article);
  });
 }catch{if(state.selected?.id===id){container.replaceChildren(element('p','muted','법안 데이터를 확인할 수 없음. 미확인을 0건으로 표시하지 않음.'));$('billCount').textContent='데이터 확인 필요'}}
}
function search(){const q=$('search').value.trim().toLowerCase();const matches=state.members.filter(m=>[m.name,m.id,m.state].some(x=>String(x||'').toLowerCase().includes(q))).slice(0,24);const host=$('results');host.replaceChildren();matches.forEach(m=>{const b=element('button','result',m.name+' · '+m.state+' · '+m.party);b.type='button';b.addEventListener('click',()=>renderMember(m));host.append(b)});if(!matches.length)host.append(element('p','muted','검색 결과 없음'))}
async function init(){
 if(window.L){state.map=L.map('intelMap',{zoomControl:true}).setView([39,-98],4);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(state.map)}
 try{const r=await fetch('data/us/members.json');if(!r.ok)throw Error('members unavailable');const data=await r.json();state.members=Array.isArray(data.members)?data.members:[];search();$('status').textContent='공개 의원 데이터 '+state.members.length.toLocaleString('ko-KR')+'명 로드 · 거래 기록 자동 매칭 미연결';}catch{$('status').textContent='의원 데이터 로드 실패';}
 $('search').addEventListener('input',search);$('startMission').addEventListener('click',()=>{track('mission_started');$('search').focus();$('search').scrollIntoView({block:'nearest'})});
}
init();
})();
