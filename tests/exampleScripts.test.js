import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { tokenizeForParser } from '../js/tokenizer.js';
import { Parser } from '../js/parser.js';
import { Interpreter } from '../js/interpreter.js';

function stubFetchForExamples() {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.startsWith('examples/')) {
      const file = path.join('examples', path.basename(url));
      if (fs.existsSync(file)) {
        if (file.endsWith('.csv') || file.endsWith('.pd')) {
          return { ok: true, text: async () => fs.readFileSync(file, 'utf8') };
        }
        if (file.endsWith('.json')) {
          return { ok: true, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
        }
        if (file.endsWith('.xlsx')) {
          return { ok: true, arrayBuffer: async () => fs.readFileSync(file) };
        }
      }
    }
    return { ok: false };
  };
  return () => { global.fetch = originalFetch; };
}

function stubPapaParse() {
  const originalPapa = global.Papa;
  global.Papa = {
    unparse: originalPapa?.unparse,
    parse: (text, opts) => {
      const lines = text.trim().split(/\r?\n/);
      const headers = lines.shift().split(',');
      const data = lines.map(l => {
        const vals = l.split(',');
        const obj = {};
        headers.forEach((h, i) => {
          const num = Number(vals[i]);
          obj[h] = Number.isNaN(num) ? vals[i] : num;
        });
        return obj;
      });
      opts.complete({ data, meta: { fields: headers } });
    }
  };
  return () => { global.Papa = originalPapa; };
}

const scriptFiles = fs.readdirSync('test_scripts').filter(f => f.endsWith('.pd'));
for (const file of scriptFiles) {
  test(`example script ${file} runs without error`, async () => {
    const script = fs.readFileSync(path.join('test_scripts', file), 'utf8');
    const tokens = tokenizeForParser(script);
    const ast = new Parser(tokens).parse();
    const interp = new Interpreter({ csvFileInputEl: {} });
    const restoreFetch = stubFetchForExamples();
    const restorePapa = stubPapaParse();
    await interp.run(ast);
    restoreFetch();
    restorePapa();
    assert.ok(interp.stepOutputs.length > 0);
  });
}
