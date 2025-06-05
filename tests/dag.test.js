import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeForParser } from '../js/tokenizer.js';
import { Parser } from '../js/parser.js';
import { buildDag } from '../js/dag.js';

const script = `VAR "a" THEN LOAD_CSV FILE "f.csv"

VAR "b" THEN JOIN a ON id`;

test('buildDag produces nodes with dependencies', () => {
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  const dag = buildDag(ast);
  // a has one command -> 1 node, b has one -> 1, total 2
  assert.strictEqual(dag.length, 2);
  const joinNode = dag.find(n => n.varName === 'b' && n.command === 'JOIN');
  assert.ok(joinNode);
  // join depends on final step of VAR "a"
  assert.deepEqual(joinNode.dependencies, ['a-0']);
});

test('fingerprints ignore line numbers', () => {
  const script1 = `VAR "x" THEN LOAD_CSV FILE "f.csv"`;
  const script2 = `VAR "x"\nTHEN LOAD_CSV FILE "f.csv"`;
  const ast1 = new Parser(tokenizeForParser(script1)).parse();
  const ast2 = new Parser(tokenizeForParser(script2)).parse();
  const dag1 = buildDag(ast1);
  const dag2 = buildDag(ast2);
  assert.strictEqual(dag1.length, 1);
  assert.strictEqual(dag2.length, 1);
  assert.strictEqual(dag1[0].fingerprint, dag2[0].fingerprint);
});
