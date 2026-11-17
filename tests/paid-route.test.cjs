const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const { load } = require('./load.cjs');

for (const endpoint of ['analyze', 'exchange-rate']) {
  test(`paid ${endpoint} rejects missing credentials before provider call`, async () => {
    let calls = 0;
    class Provider { getGenerativeModel() { return { generateContent: async () => {
      calls++; return { response: { text: () => '{"items":[],"rates":{},"USD":1300}' } };
    } }; } }
    const route = load(path.resolve(__dirname, `../src/app/api/${endpoint}/route.ts`), {
      GEMINI_API_KEY: 'synthetic-key', AI_ACCESS_TOKEN: 'a'.repeat(32),
    }, Provider);
    const result = await route.POST(new Request(`https://example.test/api/${endpoint}`, {
      method: 'POST', body: JSON.stringify({ text: 'synthetic receipt 100 KRW' }),
    }));
    assert.equal(result.status, 401);
    assert.equal(calls, 0);
  });
}
