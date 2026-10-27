"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const worker=fs.readFileSync(path.join(__dirname,"../cloudflare/admin-worker.js"),"utf8");
const research=fs.readFileSync(path.join(__dirname,"../server/worker.mjs"),"utf8");
const config=JSON.parse(fs.readFileSync(path.join(__dirname,"../wrangler.jsonc"),"utf8"));
test("existing GitHub OAuth Worker remains deployment entrypoint",()=>{
 assert.equal(config.main,"cloudflare/admin-worker.js");
 assert.match(worker,/GITHUB_CLIENT_SECRET/);
 assert.match(worker,/ADMIN_GITHUB_LOGIN/);
 assert.match(worker,/const session=await unseal/);
 assert.match(worker,/session\.login\.toLowerCase\(\)!==env\.ADMIN_GITHUB_LOGIN\.toLowerCase\(\)/);
});
test("AI research endpoint requires authenticated session before any query",()=>{
 const start=worker.indexOf("if(path==='/api/health'||path==='/api/analyze')");
 const authenticated=worker.indexOf("if(!session||session.login.toLowerCase()!==env.ADMIN_GITHUB_LOGIN.toLowerCase())return json({error:'authentication-required'},401)",start);
 const call=worker.indexOf("return json(await createResult(question,env))",start);
 assert.ok(start>0&&authenticated>start&&call>authenticated);
 assert.match(worker,/if\(Number\(request\.headers\.get\('content-length'\)/);
 assert.match(worker,/if\(request\.method!=='POST'\)/);
});
test("private command includes operator AI overlay and same-origin POST",()=>{
 assert.match(worker,/COMMAND_HTML\.replace\('<\/body>',AI_OPERATOR_OVERLAY\+'<\/body>'\)/);
 assert.match(worker,/fetch\('\/api\/analyze'/);
 assert.match(worker,/fetch\('\/api\/health'/);
 assert.match(worker,/credentials:'same-origin'/);
 assert.match(worker,/X-Frame-Options/);
});
test("research secrets remain server-only",()=>{
 assert.match(research,/env\.OPENAI_API_KEY/);
 assert.match(research,/env\.FINNHUB_API_TOKEN/);
 assert.doesNotMatch(worker,/sk-proj-[A-Za-z0-9]{8}/);
 assert.match(research,/store:false/);
 assert.match(research,/response_format|json_schema/);
});
