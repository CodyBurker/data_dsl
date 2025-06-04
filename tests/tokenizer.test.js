import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeForParser, tokenizeForHighlighting, TokenType } from '../js/tokenizer.js';

const sampleScript = `VAR "data" THEN LOAD_CSV FILE "cities.csv"
# comment line
THEN KEEP_COLUMNS name, population
THEN PEEK`;

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
