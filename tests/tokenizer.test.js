import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeForParser, tokenizeForHighlighting, TokenType } from '../js/tokenizer.js';

const sampleScript = `VAR "data" THEN LOAD_CSV FILE "cities.csv"
# comment line
THEN KEEP_COLUMNS name, population
THEN PEEK`;

const selectScript = `VAR "d" THEN LOAD_CSV FILE "f.csv" THEN SELECT a, b`;

test('tokenizeForParser produces expected token sequence', () => {
  const tokens = tokenizeForParser(sampleScript);
  const noNewlines = tokens.filter(t => t.type !== TokenType.NEWLINE);
  const types = noNewlines.map(t => t.type);
  assert.deepEqual(types, [
    TokenType.KEYWORD,
    TokenType.STRING_LITERAL,
    TokenType.KEYWORD,
    TokenType.KEYWORD,
    TokenType.KEYWORD,
    TokenType.STRING_LITERAL,
    TokenType.KEYWORD,
    TokenType.KEYWORD,
    TokenType.IDENTIFIER,
    TokenType.PUNCTUATION,
    TokenType.IDENTIFIER,
    TokenType.KEYWORD,
    TokenType.KEYWORD,
    TokenType.EOF
  ]);
  assert.strictEqual(noNewlines[0].value, 'VAR');
  assert.strictEqual(noNewlines[1].value, 'data');
  assert.strictEqual(noNewlines[3].value, 'LOAD_CSV');
});

test('tokenizeForHighlighting keeps comment and case', () => {
  const tokens = tokenizeForHighlighting('Var "X"\n#hello');
  const comment = tokens.find(t => t.type === TokenType.COMMENT);
  assert.ok(comment && comment.value.includes('#hello'));
  assert.strictEqual(tokens[0].value, 'Var');
});

test('tokenizeForParser recognizes SELECT as keyword', () => {
  const tokens = tokenizeForParser(selectScript);
  const kw = tokens.find(t => t.value === 'SELECT');
  assert.ok(kw && kw.type === TokenType.KEYWORD);
});

test('tokenizeForParser recognizes JOIN and ON keywords', () => {
  const tokens = tokenizeForParser('VAR "a" THEN JOIN b ON id');
  const join = tokens.find(t => t.value === 'JOIN');
  const on = tokens.find(t => t.value === 'ON');
  assert.ok(join && join.type === TokenType.KEYWORD);
  assert.ok(on && on.type === TokenType.KEYWORD);
});

test('tokenizeForParser recognizes TYPE keyword', () => {
  const tokens = tokenizeForParser('VAR "a" THEN JOIN b ON id TYPE "LEFT"');
  const typeKw = tokens.find(t => t.value === 'TYPE');
  assert.ok(typeKw && typeKw.type === TokenType.KEYWORD);
});

test('tokenizeForParser recognizes FILTER keyword', () => {
  const tokens = tokenizeForParser('VAR "x" THEN FILTER age = 30');
  const filterKw = tokens.find(t => t.value === 'FILTER');
  assert.ok(filterKw && filterKw.type === TokenType.KEYWORD);
});

test('tokenizeForParser recognizes = operator', () => {
  const tokens = tokenizeForParser('VAR "x" THEN JOIN y ON a = b');
  const eq = tokens.find(t => t.type === TokenType.OPERATOR && t.value === '=');
  assert.ok(eq);
});

test('tokenizeForParser recognizes parentheses as punctuation', () => {
  const tokens = tokenizeForParser('VAR "x" THEN FILTER (a = 1)');
  const open = tokens.find(t => t.type === TokenType.PUNCTUATION && t.value === '(');
  const close = tokens.find(t => t.type === TokenType.PUNCTUATION && t.value === ')');
  assert.ok(open);
  assert.ok(close);
});

test('tokenizeForParser recognizes WITH and COLUMN keywords', () => {
  const tokens = tokenizeForParser('VAR "d" THEN WITH COLUMN c = a + b');
  const withKw = tokens.find(t => t.value === 'WITH');
  const columnKw = tokens.find(t => t.value === 'COLUMN');
  assert.ok(withKw && withKw.type === TokenType.KEYWORD);
  assert.ok(columnKw && columnKw.type === TokenType.KEYWORD);
});
