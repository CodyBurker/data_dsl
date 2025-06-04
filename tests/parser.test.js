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

test('Parser parses FILTER command', () => {
  const tokens = tokenizeForParser('VAR "d" THEN FILTER age = 30');
  const ast = new Parser(tokens).parse();
  const filterCmd = ast[0].pipeline[0];
  assert.strictEqual(filterCmd.command, 'FILTER');
  assert.deepEqual(filterCmd.args, { column: 'age', operator: '=', value: 30 });
});

test('Parser parses FILTER with other operators', () => {
  const tokens = tokenizeForParser('VAR "d" THEN FILTER age > 25');
  const ast = new Parser(tokens).parse();
  const filterCmd = ast[0].pipeline[0];
  assert.deepEqual(filterCmd.args, { column: 'age', operator: '>', value: 25 });
  const tokens2 = tokenizeForParser('VAR "d" THEN FILTER name != "Bob"');
  const ast2 = new Parser(tokens2).parse();
  const filterCmd2 = ast2[0].pipeline[0];
  assert.deepEqual(filterCmd2.args, { column: 'name', operator: '!=', value: 'Bob' });
});

test('Parser parses FILTER with advanced operators', () => {
  const tokens = tokenizeForParser('VAR "d" THEN FILTER age >= 30');
  const ast = new Parser(tokens).parse();
  const cmd = ast[0].pipeline[0];
  assert.deepEqual(cmd.args, { column: 'age', operator: '>=', value: 30 });
  const tokens2 = tokenizeForParser('VAR "d" THEN FILTER name STARTSWITH "A"');
  const ast2 = new Parser(tokens2).parse();
  const cmd2 = ast2[0].pipeline[0];
  assert.deepEqual(cmd2.args, { column: 'name', operator: 'STARTSWITH', value: 'A' });
  const tokens3 = tokenizeForParser('VAR "d" THEN FILTER city_id = other_id');
  const ast3 = new Parser(tokens3).parse();
  const cmd3 = ast3[0].pipeline[0];
  assert.deepEqual(cmd3.args, { column: 'city_id', operator: '=', value: { type:'COLUMN_REFERENCE', name:'other_id' } });
  const tokens4 = tokenizeForParser('VAR "d" THEN FILTER WHERE age <= 40');
  const ast4 = new Parser(tokens4).parse();
  const cmd4 = ast4[0].pipeline[0];
  assert.deepEqual(cmd4.args, { column: 'age', operator: '<=', value: 40 });
});
