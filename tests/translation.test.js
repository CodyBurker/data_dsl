import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeForParser } from '../js/tokenizer.js';
import { Parser } from '../js/parser.js';
import { buildDag } from '../js/dag.js';
import { dagToNodes } from '../js/ui/dagToNodes.js';
import { nodesToDsl } from '../js/ui/nodesToDsl.js';

const script = `VAR "data" THEN LOAD_CSV FILE "f.csv" THEN FILTER age > 30 THEN RENAME_COLUMNS name AS full_name THEN SELECT age, full_name`;

function stripLines(ast) {
  return ast.map(v => ({
    variableName: v.variableName,
    pipeline: v.pipeline.map(c => ({ command: c.command, args: c.args }))
  }));
}

test('dagToNodes and nodesToDsl round-trip', () => {
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  const dag = buildDag(ast);
  const pipelines = dagToNodes(dag);
  assert.ok(pipelines.data);
  assert.strictEqual(pipelines.data.length, 4);

  const out = nodesToDsl(pipelines);
  const tokens2 = tokenizeForParser(out);
  const ast2 = new Parser(tokens2).parse();
  assert.deepStrictEqual(stripLines(ast2), stripLines(ast));
});
