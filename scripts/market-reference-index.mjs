/**
 * Index the sector → factor reference map and the official market calendar
 * (data/market/sectors.json, data/market/calendar.json) for the offline search.
 * Reference links only: no forecast, no recommendation, no causal claim.
 */
const TABLE_URL = "https://github.com/91cleaner/money-tracker/blob/main/data/market/sectors.json";
const REGION = {us:"미국",kr:"한국",jp:"일본",tw:"대만",eu:"유럽",cn:"중국",uk:"영국"};
const tidy = (v,n=180) => String(v ?? "").replace(/\s+/g," ").trim().slice(0,n);
const list = (xs,n=6) => xs.filter(Boolean).slice(0,n).join(", ")+(xs.length>n?" 외 "+(xs.length-n)+"개":"");

export function marketReferenceDocuments(sectors,calendar,marketName=()=>null,topicLabel=t=>t){
 const out=[];
 const factors=new Map((sectors?.factors||[]).map(f=>[f.id,f]));
 const usedBy=new Map();
 for(const s of sectors?.sectors||[])for(const f of s.factors||[])(usedBy.get(f)||usedBy.set(f,[]).get(f)).push(s.label);
 for(const s of sectors?.sectors||[]){
  const fl=(s.factors||[]).map(id=>factors.get(id)?.label).filter(Boolean);
  const names=(s.markets||[]).map(m=>marketName(m)||m);
  out.push({id:"sector-"+s.id,type:"sector",title:"업종 참고표 · "+tidy(s.label,60),
   aliases:[s.label,s.label_en,"업종","섹터",...(s.law_topics||[]).map(topicLabel).slice(0,3),...fl.slice(0,6),...names.slice(0,6)],
   summary:"함께 확인할 공개 지표: "+list(fl)+" · 관련 법안 주제: "+list((s.law_topics||[]).map(topicLabel))+" · 대표 종목: "+list(names)+". 참고용 연결이며 예상·추천이 아닙니다.",
   source:"MONEY TRACKER 업종·요인 참고표",url:TABLE_URL,source_date:sectors.updated||null,route:null});
 }
 for(const f of factors.values()){
  out.push({id:"factor-"+f.id,type:"factor",title:"참고 요인 · "+tidy(f.label,80),
   aliases:[f.label,f.kind,"요인",...(usedBy.get(f.id)||[]).slice(0,8)],
   summary:(f.status==="collected"?"자동 수집 중인 자료와 연결됨":"수집 예정(아직 자료 없음)")+" · 함께 보는 업종: "+list(usedBy.get(f.id)||[])+" · 출처: "+tidy(f.source,90)+". 투자 신호가 아닙니다.",
   source:tidy(f.source,100),url:f.source_url,source_date:sectors.updated||null,route:f.kind==="rates"?"rates":null});
 }
 for(const e of calendar?.events||[]){
  const where=REGION[e.region]||e.region;
  out.push({id:"calendar-"+e.region+"-"+e.date,type:"calendar",title:"일정 · "+tidy(e.title,80)+" · "+e.date,
   aliases:[e.body,where,"일정","금리 결정","중앙은행","캘린더",e.date.slice(0,7)],
   summary:where+" "+tidy(e.title,80)+" — 회의 "+(e.start===e.date?e.date:e.start+"~"+e.date)+(e.note?" · "+tidy(e.note,60):"")+(e.tentative?" · 기관 표기상 잠정":"")+". 공식 일정이며 기관 사정으로 바뀔 수 있음 (확인일 "+e.verified_on+").",
   source:tidy(e.body,100),url:e.source_url,source_date:e.verified_on||null,route:e.kind==="central_bank"?"rates":null});
 }
 return out;
}
