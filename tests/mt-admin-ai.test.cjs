"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const worker=fs.readFileSync(path.join(__dirname,"../cloudflare/admin-worker.js"),"utf8");
const config=JSON.parse(fs.readFileSync(path.join(__dirname,"../wrangler.jsonc"),"utf8"));
const standalone=fs.readFileSync(path.join(__dirname,"../server/worker.mjs"),"utf8");
test("existing GitHub owner OAuth and same repository deployment entrypoint are preserved",()=>{
 assert.equal(config.main,"cloudflare/admin-worker.js");
 assert.match(worker,/GITHUB_CLIENT_SECRET/);
 assert.match(worker,/ADMIN_GITHUB_LOGIN/);
 assert.match(worker,/const session=await unseal/);
});
test("PAID AI routes fail closed after owner auth, even if old keys are present",()=>{
 const i=worker.indexOf("if(path==='/api/health'||path==='/api/analyze')");
 const auth=worker.indexOf("return json({error:'authentication-required'},401)",i);
 const blocked=worker.indexOf("return json({error:'ai-paused'",auth);
 assert.ok(i>=0&&auth>i&&blocked>auth,"AI call disabled behind OAuth");
 assert.doesNotMatch(worker,/return json\(await createResult\(/);
 assert.match(standalone,/if\(url\.pathname==="\/api\/analyze"\)return json\(\{error:"ai-paused"/);
});
test("no Grok/AI panel appears on private or public control room while gathering data",()=>{
 const publicHtml=fs.readFileSync(path.join(__dirname,"../usa-command-legacy.html"),"utf8");
 assert.match(worker,/return new Response\(COMMAND_HTML,\{headers:/);
 assert.doesNotMatch(worker,/AI_OPERATOR_OVERLAY/);
 assert.doesNotMatch(publicHtml,/src="assets\/mt-backend\.js/);
 assert.match(publicHtml,/assets\/mt-local-search\.js/);
});
