const ts = require('typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function load(file, env, provider, transport = fetch) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === '@google/generative-ai') return { GoogleGenerativeAI: provider };
    if (id === 'next/server') return { NextResponse: Response };
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'), env, provider, transport);
    return require(id);
  };
  vm.runInNewContext(source, { require: localRequire, module, exports: module.exports,
    process: { env }, console, Request, Response, TextDecoder, AbortSignal, fetch: transport,
    Buffer, crypto: globalThis.crypto, setTimeout, clearTimeout });
  return module.exports;
}
module.exports = { load };
