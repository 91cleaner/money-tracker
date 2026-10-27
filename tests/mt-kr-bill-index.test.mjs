import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {koreanBillDocuments} from "../scripts/kr-bill-index.mjs";

const members={members:[{id:"ABC12345",name:"홍길동",party:"테스트정당"}]};
const data={bills:[{id:"PRC_12345678",name:"방위산업법 개정안",date:"2026-09-10",result:"원안가결",kind:"법률안",cmt:"국방위원회"}],
 lead:{ABC12345:[{id:"PRC_98765432",n:"반도체산업법 개정안",d:"2026-10-20",r:null},{id:"PRC_12345678",n:"방위산업법 개정안",d:"2026-09-10"}]}};

test("indexes Korean bills with source links, proposer, and honest snapshot status",()=>{
 const docs=koreanBillDocuments(data,members);
 assert.equal(docs.length,2);
 assert.equal(docs[0].title,"한국 국회 법안 · 반도체산업법 개정안");
 assert.ok(docs[0].aliases.includes("홍길동"));
 assert.match(docs[0].summary,/미확인/);
 assert.match(docs[0].summary,/원문 확인 필요/);
 assert.equal(docs[0].source_date,"2026-10-20");
 assert.equal(docs[0].type,"bill");
 assert.equal(docs[1].url,"https://likms.assembly.go.kr/bill/billDetail.do?billId=PRC_12345678");
 assert.match(docs[1].summary,/원안가결/);
 assert.ok(docs[1].aliases.includes("홍길동"),"voted bill must retain proposer link");
 assert.match(docs[1].summary,/대표발의자: 홍길동/);
 assert.doesNotMatch(docs[1].summary,/주가|매수|매도/);
});

test("rejects invalid IDs, unknown lawmakers, and invalid dates",()=>{
 const docs=koreanBillDocuments({lead:{UNKNOWN:[{id:"PRC_11111111",n:"미확인 발의자"}],
  ABC12345:[{id:"../../etc/passwd",n:"위험"},{id:"PRC_22222222",n:"정상 법안",d:"2026/10/20"}]}},members);
 assert.equal(docs.length,1);
 assert.equal(docs[0].source_date,null);
 assert.equal(docs[0].title,"한국 국회 법안 · 정상 법안");
});

test("caps size, excludes non-law motions, and tolerates missing snapshots",()=>{
 assert.deepEqual(koreanBillDocuments(null,null),[]);
 assert.equal(koreanBillDocuments(data,members,{maxRecent:0,maxVoted:0}).length,0);
 assert.equal(koreanBillDocuments(data,members,{maxRecent:1,maxVoted:1}).length,2);
 assert.equal(koreanBillDocuments({bills:[{id:"PRC_11111111",name:"결의안",kind:"결의안"}]},members).length,0);
});

test("stored 22nd Assembly snapshot yields real, deduplicated sourced bills",()=>{
 const security=JSON.parse(fs.readFileSync(new URL("../data/national/security.json",import.meta.url),"utf8"));
 const realMembers=JSON.parse(fs.readFileSync(new URL("../data/national/members.json",import.meta.url),"utf8"));
 const docs=koreanBillDocuments(security,realMembers);
 assert.ok(docs.length>=200,"expected 200+ records from the saved official Assembly snapshot");
 assert.equal(new Set(docs.map(d=>d.id)).size,docs.length);
 assert.ok(docs.every(d=>d.url.startsWith("https://likms.assembly.go.kr/bill/billDetail.do?billId=")));
 assert.ok(docs.every(d=>d.summary.includes("저장")||d.summary.includes("시행")));
});
