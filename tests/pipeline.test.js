import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAstFromNodes, buildNodesFromAst, serializeAstToScript, NodeTypes } from '../js/ui/pipeline.js';
import { Parser } from '../js/parser.js';
import { tokenizeForParser } from '../js/tokenizer.js';

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

test('buildNodesFromAst converts AST to nodes', () => {
  const ast = [{ variableName: 'main', line: 1, pipeline: [
    { command: 'LOAD_CSV', args: { file: 'f.csv' }, line: 1 },
    { command: 'RENAME_COLUMN', args: { oldName: 'a', newName: 'b' }, line: 2 }
  ] }];
  const nodes = buildNodesFromAst(ast);
  assert.strictEqual(nodes.length, 2);
  assert.strictEqual(nodes[0].type, NodeTypes.UPLOAD);
  assert.strictEqual(nodes[1].type, NodeTypes.RENAME_COLUMN);
});

test('serializeAstToScript produces DSL text', () => {
  const script = 'VAR "main"\nTHEN LOAD_CSV FILE "file.csv"\nTHEN SELECT A';
  const { ast } = new Parser(tokenizeForParser(script)).parseAll();
  const out = serializeAstToScript(ast);
  assert.ok(out.includes('LOAD_CSV'));
  assert.ok(out.includes('SELECT'));
});
