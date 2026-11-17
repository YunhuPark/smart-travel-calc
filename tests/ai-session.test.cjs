const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
test('operator code is initially absent, explicitly applied, and removable from request headers', () => {
 const module={exports:{}}; const events=[];
 const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/lib/ai-session.ts'),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,Event,
 window:{dispatchEvent:event=>events.push(event.type)}});
 const session=module.exports;
 assert.deepEqual(Object.keys(session.aiHeaders()),[]);
 session.setAiAccessToken('synthetic-operator-code');
 assert.equal(session.aiHeaders().Authorization,'Bearer synthetic-operator-code');
 session.setAiAccessToken('');
 assert.deepEqual(Object.keys(session.aiHeaders()),[]);
 assert.deepEqual(events,['ai-access-changed','ai-access-changed']);
});
