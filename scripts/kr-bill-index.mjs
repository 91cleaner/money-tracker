/**
 * Index Korean National Assembly bill metadata already collected by the official
 * Open Assembly API. These are saved snapshots, NOT live bill statuses.
 * No bill/company relationship or investment causality is inferred here.
 */
const BILL_ID = /^[A-Za-z0-9_]{8,100}$/;
const ISO_DATE = /^20\d{2}-\d{2}-\d{2}$/;
const ASSEMBLY = {lat:37.531,lng:126.914,label:"서울 여의도 · 국회 공식 입법기록 출처 (기업·의원 실시간 위치 아님)"};
const OFFICIAL = "https://likms.assembly.go.kr/bill/billDetail.do?billId=";
const tidy = (value,limit=180) => String(value ?? "").replace(/\s+/g," ").trim().slice(0,limit);

export function koreanBillDocuments(security,members,{maxRecent=900,maxVoted=120}={}) {
 const byMember=new Map((members?.members||[]).filter(m=>m?.id&&m?.name).map(m=>[m.id,m]));
 const seen=new Map();
 const make=(entry,member=null,kind="proposed")=>{
  const id=tidy(entry?.id,100),name=tidy(entry?.n||entry?.name,180);
  if(!BILL_ID.test(id)||!name)return null;
  const date=tidy(entry?.d||entry?.date,10);
  const source_date=ISO_DATE.test(date)?date:null;
  const result=tidy(entry?.r||entry?.result,80);
  const committee=tidy(entry?.c||entry?.cmt,90);
  const proposer=tidy(member?.name,70);
  const detail=kind==="voted"?
   `제22대 국회 본회의 처리안건 저장 기록 · 처리결과: ${result||"미확인"}. 표결 기록은 해당 법안의 현재 시행 여부를 보장하지 않습니다.`:
   `제22대 국회 대표발의 기록 · 대표발의자: ${proposer||"미확인"} · 저장 당시 처리결과: ${result||"미확인"}. 최신 심사·통과·시행 여부는 원문 확인 필요.`;
  return {id:"kr-bill-"+id,type:"bill",title:"한국 국회 법안 · "+name,
   aliases:["한국","대한민국","국회","법안","의안",proposer,tidy(member?.party,60),committee].filter(Boolean),
   summary:detail,source:"대한민국 열린국회정보 · 저장된 공식 응답",
   url:OFFICIAL+encodeURIComponent(id),source_date,location:ASSEMBLY,route:null};
 };
 const voted=(security?.bills||[]).filter(b=>!b?.kind||b.kind==="법률안").map(b=>make(b,null,"voted")).filter(Boolean)
  .sort((a,b)=>(b.source_date||"").localeCompare(a.source_date||"")||a.id.localeCompare(b.id));
 for(const d of voted.slice(0,Math.max(0,Math.min(500,maxVoted))))seen.set(d.id,d);
 const proposed=[];
 for(const [memberId,bills] of Object.entries(security?.lead||{})){
  const member=byMember.get(memberId);
  if(!member||!Array.isArray(bills))continue;
  for(const b of bills){const d=make(b,member);if(d)proposed.push(d);}
 }
 proposed.sort((a,b)=>(b.source_date||"").localeCompare(a.source_date||"")||a.id.localeCompare(b.id));
 let added=0;
 for(const d of proposed){
  if(seen.has(d.id))continue;
  if(added>=Math.max(0,Math.min(2500,maxRecent)))break;
  seen.set(d.id,d);added++;
 }
 return [...seen.values()].sort((a,b)=>(b.source_date||"").localeCompare(a.source_date||"")||a.id.localeCompare(b.id));
}
