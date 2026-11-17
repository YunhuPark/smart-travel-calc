const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./load.cjs');
const token = 'a'.repeat(32);
const env = { GEMINI_API_KEY: 'synthetic-key', AI_ACCESS_TOKEN: token,
 AI_REDIS_REST_URL: 'https://redis.example.test', AI_REDIS_REST_TOKEN: 'synthetic-redis',
 AI_BUDGET_NAMESPACE: 'test', AI_DAILY_CALL_LIMIT: '3' };
const request = body => new Request('https://example.test/api', { method: 'POST',
 headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
const guardPath = path.resolve(__dirname, '../src/lib/paid-ai.ts');

test('stream size and JSON object boundary reject input before acquiring budget', async () => {
 const guard = load(guardPath, env);
 await assert.rejects(guard.readPaidJson(request({text: 'a'.repeat(100)}), 32), e => e.status === 413);
 await assert.rejects(guard.readPaidJson(request([]), 32), e => e.status === 400);
 assert.deepEqual(JSON.parse(JSON.stringify(await guard.readPaidJson(request({text: 'ok'}), 32))), {text:'ok'});
});
test('absent or unavailable Redis fails closed and rejected reservations never release', async () => {
 let calls=0;
 const missing=load(guardPath, {...env, AI_REDIS_REST_URL: undefined}, undefined, async()=>{calls++;});
 await assert.rejects(missing.acquirePaidAi(request({})), e=>e.status===503);
 assert.equal(calls,0);
 const unavailable=load(guardPath, env, undefined, async()=>new Response('{}',{status:500}));
 await assert.rejects(unavailable.acquirePaidAi(request({})), e=>e.status===503);
 const denied=load(guardPath, env, undefined, async()=>{calls++; return Response.json({result:0});});
 await assert.rejects(denied.acquirePaidAi(request({})), e=>e.status===429);
 assert.equal(calls,1);
});
test('provider success reserves worst case attempts first then releases only the concurrency lease', async () => {
 const commands=[]; let calls=0;
 class Provider {getGenerativeModel(){return {generateContent:async()=>{calls++;
 assert.equal(commands[0][0], 'EVAL');
 return {response:{text:()=>JSON.stringify({items:[],summary:'ok'})}};
 }}}}
 const transport=async(url,opts)=>{const cmd=JSON.parse(opts.body);commands.push(cmd);return Response.json({result:1});};
 const route=load(path.resolve(__dirname,'../src/app/api/analyze/route.ts'), env, Provider, transport);
 const response=await route.POST(request({text:'coffee 100 KRW'}));
 assert.equal(response.status,200); assert.equal(calls,1);
 assert.equal(commands[0][8],1); assert.equal(commands[0][9],3);
 assert.equal(commands[1][0],'ZREM'); assert.equal(commands[1][2],commands[0][7]);
});

test('invalid reservation size cannot subtract or bypass daily usage', async () => {
 let calls=0;
 const guard=load(guardPath,env,undefined,async()=>{calls++;return Response.json({result:1});});
 for(const value of [-1,0,1.5,4,NaN]) await assert.rejects(guard.acquirePaidAi(request({}),value),e=>e.status===503);
 assert.equal(calls,0);
});

test('no-key currency conversion uses only the free rates fallback', async () => {
 let calls=0;
 class Provider {getGenerativeModel(){throw new Error('must never call Gemini');}}
 const transport=async(url)=>{calls++; assert.equal(url,'https://open.er-api.com/v6/latest/KRW');
 return Response.json({rates:{KRW:1,USD:0.001}});};
 const route=load(path.resolve(__dirname,'../src/app/api/exchange-rate/route.ts'),{},Provider,transport);
 const result=await route.POST(new Request('https://example.test/api',{method:'POST'}));
 assert.equal(result.status,200); assert.equal((await result.json()).rates.USD,1000); assert.equal(calls,1);
});
