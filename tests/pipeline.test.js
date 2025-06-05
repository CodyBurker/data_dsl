import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAstFromNodes, NodeTypes } from '../js/ui/pipeline.js';

test('buildAstFromNodes converts nodes to AST', () => {
  const nodes = [
    { type: NodeTypes.UPLOAD, params: { file: 'file.csv' } },
    { type: NodeTypes.SELECT_COLUMNS, params: { columns: ['A'] } }
  ];
  const ast = buildAstFromNodes(nodes);
  assert.strictEqual(ast.length, 1);
  assert.strictEqual(ast[0].pipeline.length, 2);
  assert.strictEqual(ast[0].pipeline[0].command, 'LOAD_CSV');
  assert.strictEqual(ast[0].pipeline[1].command, 'SELECT');
});
