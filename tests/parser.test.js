import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeForParser } from '../src/lib/tokenizer.js';
import { Parser } from '../src/lib/parser.js';

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

test('Parser parses SELECT command', () => {
  const tokens = tokenizeForParser('VAR "d" THEN LOAD_CSV FILE "f.csv" THEN SELECT A');
  const ast = new Parser(tokens).parse();
  assert.strictEqual(ast[0].pipeline[1].command, 'SELECT');
  assert.deepEqual(ast[0].pipeline[1].args.columns, ['A']);
});

test('Parser parses JOIN command', () => {
  const tokens = tokenizeForParser('VAR "a" THEN LOAD_CSV FILE "f.csv" THEN JOIN b ON id');
  const ast = new Parser(tokens).parse();
  const joinCmd = ast[0].pipeline[1];
  assert.strictEqual(joinCmd.command, 'JOIN');
  assert.deepEqual(joinCmd.args, { variable: 'b', leftKey: 'id', rightKey: 'id', type: 'INNER' });
});

test('Parser parses JOIN with TYPE', () => {
  const tokens = tokenizeForParser('VAR "x" THEN JOIN y ON key TYPE "LEFT"');
  const ast = new Parser(tokens).parse();
  const joinCmd = ast[0].pipeline[0];
  assert.strictEqual(joinCmd.command, 'JOIN');
  assert.deepEqual(joinCmd.args, { variable: 'y', leftKey: 'key', rightKey: 'key', type: 'LEFT' });
});

test('Parser parses JOIN with different keys', () => {
  const tokens = tokenizeForParser('VAR "x" THEN JOIN y ON name = "full name"');
  const ast = new Parser(tokens).parse();
  const joinCmd = ast[0].pipeline[0];
  assert.strictEqual(joinCmd.command, 'JOIN');
  assert.deepEqual(joinCmd.args, { variable: 'y', leftKey: 'name', rightKey: 'full name', type: 'INNER' });
});
