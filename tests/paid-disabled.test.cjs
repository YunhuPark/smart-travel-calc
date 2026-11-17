const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./load.cjs');

test('operator-disabled receipt analysis never reaches a paid provider', async () => {
  let calls = 0;
  class Provider { getGenerativeModel() { calls++; throw new Error('Paid provider must not run'); } }
  const route = load(path.resolve(__dirname, '../src/app/api/analyze/route.ts'), {
    GEMINI_API_KEY: 'synthetic-configured-key', PAID_AI_ENABLED: 'false',
    AI_ACCESS_TOKEN: 'a'.repeat(32), AI_REDIS_REST_URL: 'https://redis.example.test',
    AI_REDIS_REST_TOKEN: 'synthetic', AI_BUDGET_NAMESPACE: 'test',
  }, Provider, async () => Response.json({ result: 1 }));
  const result = await route.POST(new Request('https://example.test/api/analyze', {
    method: 'POST', headers: { Authorization: `Bearer ${'a'.repeat(32)}` },
    body: JSON.stringify({ text: 'receipt' }),
  }));
  assert.equal(result.status, 503);
  assert.equal(calls, 0);
});

test('operator-disabled AI preserves free currency rates without auth or paid calls', async () => {
  let paidCalls = 0;
  class Provider { getGenerativeModel() { paidCalls++; throw new Error('Paid provider must not run'); } }
  const route = load(path.resolve(__dirname, '../src/app/api/exchange-rate/route.ts'), {
    GEMINI_API_KEY: 'synthetic-configured-key', PAID_AI_ENABLED: 'false',
  }, Provider, async (url) => {
    assert.equal(url, 'https://open.er-api.com/v6/latest/KRW');
    return Response.json({ rates: { KRW: 1, USD: 0.001, JPY: 0.1 } });
  });
  const result = await route.POST(new Request('https://example.test/api/exchange-rate', { method: 'POST' }));
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(data.source, 'fallback');
  assert.equal(data.rates.USD, 1000);
  assert.equal(paidCalls, 0);
});
