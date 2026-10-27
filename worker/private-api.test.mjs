import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './private-api.js';
test('health contains no private data', async () => {
  const r=await worker.fetch(new Request('https://private.example/health'), {});
  assert.equal(r.status,200);
  assert.equal((await r.json()).privateData,false);
});
test('unknown paths return 404', async () => {
  const r=await worker.fetch(new Request('https://private.example/nope'), {});
  assert.equal(r.status,404);
});
test('missing bindings fail closed', async () => {
  const r=await worker.fetch(new Request('https://private.example/private/records'), {});
  assert.equal(r.status,503);
});
test('missing token is denied with configured bindings', async () => {
  const r=await worker.fetch(new Request('https://private.example/private/records'), {ACCESS_TEAM_DOMAIN:'team.cloudflareaccess.com',ACCESS_AUD:'aud',PRIVATE_DATA:{}});
  assert.equal(r.status,401);
});
test('invalid token is denied', async () => {
  const r=await worker.fetch(new Request('https://private.example/private/records',{headers:{'Cf-Access-Jwt-Assertion':'bad'}}), {ACCESS_TEAM_DOMAIN:'team.cloudflareaccess.com',ACCESS_AUD:'aud',PRIVATE_DATA:{}});
  assert.equal(r.status,401);
});
