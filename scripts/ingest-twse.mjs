// Fetch official TWSE listed-company records; fail closed on invalid responses.
// Run: node scripts/ingest-twse.mjs
import {writeFile,mkdir} from 'node:fs/promises';
const endpoint='https://openapi.twse.com.tw/v1/opendata/t187ap03_L';
const res=await fetch(endpoint,{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});
if(!res.ok)throw Error('TWSE HTTP '+res.status);
const rows=await res.json();
if(!Array.isArray(rows)||rows.length<100)throw Error('Unexpected TWSE response size');
const get=(r,...keys)=>keys.map(k=>r[k]).find(v=>typeof v==='string'&&v.trim())||'';
const records=rows.map(r=>({
 company_code:get(r,'公司代號','Company Code'),
 company_name:get(r,'公司名稱','Company Name'),
 company_abbreviation:get(r,'公司簡稱'),
 industry:get(r,'產業別'),
 address:get(r,'住址','公司地址'),
 source_url:endpoint
})).filter(r=>/^\d{4,6}$/.test(r.company_code)&&r.company_name);
if(records.length<100)throw Error('Insufficient valid records: '+records.length);
const ids=new Set(records.map(r=>r.company_code));
if(ids.size!==records.length)throw Error('Duplicate company code');
const data={schema_version:1,country:'TW',source:'Taiwan Stock Exchange OpenAPI',endpoint,status:'ingested',fetched_at:new Date().toISOString(),record_count:records.length,records};
await mkdir('data/ingestion',{recursive:true});
await writeFile('data/ingestion/twse-companies.json',JSON.stringify(data,null,2)+'\n');
console.log('TWSE records:',records.length);
