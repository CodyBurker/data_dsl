import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const css = fs.readFileSync('style.css', 'utf-8');

function getVarBlockRule() {
  const match = /\.var-block\s*\{([^}]*)\}/m.exec(css);
  return match ? match[1] : '';
}

test('var-block has no vertical padding', () => {
  const rule = getVarBlockRule();
  assert.ok(rule.includes('padding-top: 0')); 
  assert.ok(rule.includes('padding-bottom: 0')); 
});
