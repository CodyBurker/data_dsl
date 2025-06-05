import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeForParser } from '../js/tokenizer.js';
import { Parser } from '../js/parser.js';

test('Parser handles multiple VAR blocks', () => {
  const script = `VAR "v1" THEN LOAD_CSV FILE "f.csv" THEN EXPORT_CSV TO "out.csv"

VAR "v2" THEN LOAD_EXCEL FILE "book.xlsx" SHEET "Sheet1"`;
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  assert.strictEqual(ast.length, 2);
  assert.strictEqual(ast[0].variableName, 'v1');
  assert.strictEqual(ast[0].pipeline[0].command, 'LOAD_CSV');
  assert.strictEqual(ast[0].pipeline.at(-1).command, 'EXPORT_CSV');
  assert.strictEqual(ast[1].pipeline[0].command, 'LOAD_EXCEL');
});

test('Parser throws on missing THEN', () => {
  const tokens = tokenizeForParser('VAR "x" SELECT A');
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
  assert.deepEqual(filterCmd.args, { type: 'condition', column: 'age', operator: '=', value: 30 });
});

test('Parser parses FILTER with other operators', () => {
  const tokens = tokenizeForParser('VAR "d" THEN FILTER age > 25');
  const ast = new Parser(tokens).parse();
  const filterCmd = ast[0].pipeline[0];
  assert.deepEqual(filterCmd.args, { type: 'condition', column: 'age', operator: '>', value: 25 });
  const tokens2 = tokenizeForParser('VAR "d" THEN FILTER name != "Bob"');
  const ast2 = new Parser(tokens2).parse();
  const filterCmd2 = ast2[0].pipeline[0];
  assert.deepEqual(filterCmd2.args, { type: 'condition', column: 'name', operator: '!=', value: 'Bob' });
  const tokens3 = tokenizeForParser('VAR "d" THEN FILTER age < 40');
  const ast3 = new Parser(tokens3).parse();
  const filterCmd3 = ast3[0].pipeline[0];
  assert.deepEqual(filterCmd3.args, { type: 'condition', column: 'age', operator: '<', value: 40 });
});

test('Parser parses FILTER with advanced operators', () => {
  const tokens = tokenizeForParser('VAR "d" THEN FILTER age >= 30');
  const ast = new Parser(tokens).parse();
  const cmd = ast[0].pipeline[0];
  assert.deepEqual(cmd.args, { type: 'condition', column: 'age', operator: '>=', value: 30 });
  const tokens2 = tokenizeForParser('VAR "d" THEN FILTER name STARTSWITH "A"');
  const ast2 = new Parser(tokens2).parse();
  const cmd2 = ast2[0].pipeline[0];
  assert.deepEqual(cmd2.args, { type: 'condition', column: 'name', operator: 'STARTSWITH', value: 'A' });
  const tokens3 = tokenizeForParser('VAR "d" THEN FILTER city_id = other_id');
  const ast3 = new Parser(tokens3).parse();
  const cmd3 = ast3[0].pipeline[0];
  assert.deepEqual(cmd3.args, { type: 'condition', column: 'city_id', operator: '=', value: { type:'COLUMN_REFERENCE', name:'other_id' } });
  const tokens4 = tokenizeForParser('VAR "d" THEN FILTER WHERE age <= 40');
  const ast4 = new Parser(tokens4).parse();
  const cmd4 = ast4[0].pipeline[0];
  assert.deepEqual(cmd4.args, { type: 'condition', column: 'age', operator: '<=', value: 40 });
  const tokens5 = tokenizeForParser('VAR "d" THEN FILTER name CONTAINS "Al"');
  const ast5 = new Parser(tokens5).parse();
  const cmd5 = ast5[0].pipeline[0];
  assert.deepEqual(cmd5.args, { type: 'condition', column: 'name', operator: 'CONTAINS', value: 'Al' });
  const tokens6 = tokenizeForParser('VAR "d" THEN FILTER city ENDSWITH "town"');
  const ast6 = new Parser(tokens6).parse();
  const cmd6 = ast6[0].pipeline[0];
  assert.deepEqual(cmd6.args, { type: 'condition', column: 'city', operator: 'ENDSWITH', value: 'town' });
  const tokens7 = tokenizeForParser('VAR "d" THEN FILTER flag IS 1');
  const ast7 = new Parser(tokens7).parse();
  const cmd7 = ast7[0].pipeline[0];
  assert.deepEqual(cmd7.args, { type: 'condition', column: 'flag', operator: 'IS', value: 1 });
  const tokens8 = tokenizeForParser('VAR "d" THEN FILTER flag IS NOT 0');
  const ast8 = new Parser(tokens8).parse();
  const cmd8 = ast8[0].pipeline[0];
  assert.deepEqual(cmd8.args, { type: 'condition', column: 'flag', operator: 'IS NOT', value: 0 });
});

test('Parser parses FILTER with grouped conditions', () => {
  const tokens = tokenizeForParser('VAR "d" THEN FILTER (age = 30 OR age = 40) AND name != "Bob"');
  const ast = new Parser(tokens).parse();
  const filter = ast[0].pipeline[0];
  assert.strictEqual(filter.command, 'FILTER');
  const expected = {
    type: 'AND',
    left: {
      type: 'OR',
      left: { type: 'condition', column: 'age', operator: '=', value: 30 },
      right: { type: 'condition', column: 'age', operator: '=', value: 40 }
    },
    right: { type: 'condition', column: 'name', operator: '!=', value: 'Bob' }
  };
  assert.deepEqual(filter.args, expected);
});

test('Parser parses WITH COLUMN command', () => {
  const tokens = tokenizeForParser('VAR "d" THEN WITH COLUMN total = (a + 2 * b) / c');
  const ast = new Parser(tokens).parse();
  const cmd = ast[0].pipeline[0];
  assert.strictEqual(cmd.command, 'WITH_COLUMN');
  assert.strictEqual(cmd.args.columnName, 'total');
  assert.ok(Array.isArray(cmd.args.expression));
});

test('parseAll collects multiple errors', () => {
  const script = 'VAR "x" THEN SELECT\nVAR "y" THEN JOIN';
  const parser = new Parser(tokenizeForParser(script));
  const result = parser.parseAll();
  assert.strictEqual(result.errors.length, 2);
  assert.ok(result.errors[0].line);
  assert.ok(result.errors[1].line);
});

test('parseAll continues parsing within a block after an error', () => {
  const script = [
    'VAR "cities"',
    'THEN LOAD_CSV FILE "exampleCities.csv"',
    'THEN WITH COLUMN population_millions = population / 1000000',
    'THEN WITH COLUMN COL city_of = "City of " + name',
    'THEN SELECT population, id, city_of'
  ].join('\n');
  const parser = new Parser(tokenizeForParser(script));
  const result = parser.parseAll();
  assert.strictEqual(result.errors.length, 1);
  assert.strictEqual(result.errors[0].line, 4);
  assert.strictEqual(result.ast[0].pipeline.at(-1).command, 'SELECT');
});
