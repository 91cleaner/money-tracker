/* MONEY TRACKER backend bridge.
 * The public GitHub Pages build has NO authenticated AI backend yet.
 * This bridge enables real server-side AI and quotes only when a protected
 * same-origin Worker/Pages deployment has been configured.
 * Never put OpenAI/financial provider secrets in this file.
 */
(function(root,factory){
 var api=factory(root);
 if(typeof module==="object"&&module.exports)module.exports=api;
 root.MTBackend=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
"use strict";
function isGithubPages(origin){return /^https:\/\/[^/]+\.github\.io(?:$|:)/i.test(origin||"");}
function isProtectedOrigin(){
 try{
  var url=root.location&&root.location.origin||"";
  if(!url||isGithubPages(url))return false;
  return root.MT_BACKEND_ENABLED===true;
 }catch{return false}
}
async function analyze(question,fetcher){
 if(!isProtectedOrigin())return {status:"not-connected",message:"보호된 AI 분석 서버가 연결되지 않았습니다. 공개 자료 탐색만 이용할 수 있습니다."};
 var input=String(question||"").trim().slice(0,500);
 if(input.length<2)return {status:"invalid",message:"질문을 입력하세요."};
 var useFetch=fetcher||root.fetch;
 if(typeof useFetch!=="function")return {status:"unavailable",message:"검색 서버를 호출할 수 없습니다."};
 try{
  var r=await useFetch("/api/analyze",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({question:input})});
  var j=await r.json();
  if(!r.ok)return {status:"server-error",message:j.message||"서버가 요청을 처리하지 못했습니다.",code:j.error||r.status};
  return {status:"ok",result:j};
 }catch{return {status:"unavailable",message:"AI 서버 연결 또는 인증 상태를 확인하세요."};}
}
return {analyze:analyze,isProtectedOrigin:isProtectedOrigin,isGithubPages:isGithubPages};
});