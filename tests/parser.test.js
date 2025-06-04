import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeForParser } from '../js/tokenizer.js';
import { Parser } from '../js/parser.js';

test('Parser handles multiple VAR blocks', () => {
  const script = `VAR "v1" THEN LOAD_CSV FILE "f.csv" THEN PEEK THEN EXPORT_CSV TO "out.csv"

VAR "v2" THEN LOAD_EXCEL FILE "book.xlsx" SHEET "Sheet1" THEN PEEK`;
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  assert.strictEqual(ast.length, 2);
  assert.strictEqual(ast[0].variableName, 'v1');
  assert.strictEqual(ast[0].pipeline[0].command, 'LOAD_CSV');
  assert.strictEqual(ast[0].pipeline.at(-1).command, 'EXPORT_CSV');
  assert.strictEqual(ast[1].pipeline[0].command, 'LOAD_EXCEL');
});

test('Parser throws on missing THEN', () => {
  const tokens = tokenizeForParser('VAR "x" PEEK');
  const parser = new Parser(tokens);
  assert.throws(() => parser.parse(), /must be followed by 'THEN'/);
});
