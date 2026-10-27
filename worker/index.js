// MONEY TRACKER private-key AI gateway. Never embed keys in GitHub Pages.
const json=(data,status=200,origin="")=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...(origin?{"access-control-allow-origin":origin,"vary":"Origin"}:{})}});
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"";
 const allowed=env.ALLOWED_ORIGIN||"https://91cleaner.github.io";
 const cors=origin===allowed?origin:"";
 const url=new URL(request.url);
 if(request.method==="OPTIONS")return new Response(null,{status:cors?204:403,headers:cors?{"access-control-allow-origin":cors,"access-control-allow-methods":"POST, GET, OPTIONS","access-control-allow-headers":"content-type","vary":"Origin"}:{}});
 if(url.pathname==="/health"&&request.method==="GET")return json({status:"ok",ai:env.OPENAI_API_KEY?"configured":"not-connected",market:"not-connected"},200,cors);
 if(url.pathname!=="/api/analyze"||request.method!=="POST")return json({error:"not-found"},404,cors);
 if(!cors)return json({error:"origin-not-allowed"},403);
 if(!env.OPENAI_API_KEY)return json({status:"not-connected",message:"AI 비밀키 미설정"},503,cors);
 const size=Number(request.headers.get("content-length")||0);
 if(size>3000)return json({error:"too-large"},413,cors);
 let body;try{body=await request.json()}catch{return json({error:"invalid-json"},400,cors)}
 const question=String(body?.question||"").trim().slice(0,500);
 if(question.length<2)return json({error:"invalid-question"},400,cors);
 // This endpoint is deliberately disabled for public use until authenticated access
 // and per-user rate limiting are configured. CORS is not authentication.
 if(env.OWNER_AUTH_READY!=="true")return json({status:"not-connected",message:"소유자 인증과 호출 제한 설정 전에는 AI 분석을 활성화하지 않습니다."},503,cors);
 return json({status:"not-connected",message:"소유자 인증 연동 대기"},503,cors);
}};
