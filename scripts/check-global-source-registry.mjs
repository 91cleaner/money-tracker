import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=JSON.parse(readFileSync(new URL('../data/global-source-registry.json',import.meta.url),'utf8'));
assert.equal(db.schema_version,1);
assert.deepEqual([...db.countries].sort(),['JP','KR','TW','US']);
assert.ok(db.sources.length>=10);
const ids=new Set();
for(const source of db.sources){
 assert.ok(db.countries.includes(source.country));
 assert.ok(source.id&&!ids.has(source.id));ids.add(source.id);
 assert.match(source.url,/^https:\/\//);
 assert.equal(source.authority,'official');
 assert.equal(source.ingestion,'index_only');
 assert.equal(source.record_count,0);
 assert.equal(source.last_ingested_at,null);
}
console.log('Validated '+db.sources.length+' official source registry entries; zero filings claimed.');
