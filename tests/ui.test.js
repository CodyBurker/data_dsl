import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Interpreter } from '../src/lib/interpreter.js';
import { initUI, renderPeekOutputsUI } from '../src/lib/ui.js';

import { TokenType, tokenizeForParser, tokenizeForHighlighting } from "../src/lib/tokenizer.js";
import { Parser } from "../src/lib/parser.js";
function setupDom() {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <textarea id="pipeDataInput"></textarea>
    <div id="highlightingOverlay"></div>
    <pre id="astOutput"></pre>
    <div id="logOutput"></div>
    <div id="peekTabsContainer"></div>
    <div id="peekOutputsDisplayArea"></div>
    <button id="runButton"></button>
    <button id="clearButton"></button>
    <input id="csvFileInput" />
    <div id="fileInputContainer"></div>
    <span id="filePromptMessage"></span>
    <button id="exportPeekButton"></button>
  </body>`);
  global.document = dom.window.document;
  global.window = dom.window;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}

test('renderPeekOutputsUI creates a tab for each PEEK output', () => {
  setupDom();

  const interp = new Interpreter({});
  initUI(interp);
  interp.peekOutputs = [
    { id: 'p1', varName: 'x', line: 1, dataset: [{A:1}] },
    { id: 'p2', varName: 'x', line: 2, dataset: [{A:2}] }
  ];
  renderPeekOutputsUI();
  const tabs = document.querySelectorAll('.peek-tab');
  assert.strictEqual(tabs.length, 2);
});

test('running script updates AST output and peek UI', async () => {
  setupDom();
  global.Papa = {
    parse: (file, opts) => {
      opts.complete({ data: [{A:1,B:2},{A:3,B:4}], meta:{ fields:['A','B'] } });
    }
  };

  const uiEls = {
    logOutputEl: document.getElementById('logOutput'),
    csvFileInputEl: document.getElementById('csvFileInput'),
    fileInputContainerEl: document.getElementById('fileInputContainer'),
    filePromptMessageEl: document.getElementById('filePromptMessage')
  };

  const interp = new Interpreter(uiEls);
  initUI(interp);
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });

  const script = `VAR "d"
THEN LOAD_CSV FILE "fake.csv"
THEN PEEK
THEN SELECT A
THEN PEEK`;

  document.getElementById('pipeDataInput').value = script;
  document.getElementById('highlightingOverlay').innerHTML = '';
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  document.getElementById('astOutput').textContent = JSON.stringify(ast, null, 2);

  await interp.run(ast);
  renderPeekOutputsUI();

  assert.strictEqual(ast[0].pipeline.length, 4);
  assert.strictEqual(interp.peekOutputs.length, 2);
  assert.deepEqual(interp.peekOutputs[0].dataset, [{A:1,B:2},{A:3,B:4}]);
  assert.deepEqual(interp.peekOutputs[1].dataset, [{A:1},{A:3}]);

  const tabs = document.querySelectorAll('.peek-tab');
  assert.strictEqual(tabs.length, 2);
  const contents = document.querySelectorAll('.peek-content');
  assert.strictEqual(contents.length, 2);
  assert.ok(document.getElementById('astOutput').textContent.includes('LOAD_CSV'));
});

test('full chain handles multi-block script and empty dataset', async () => {
  setupDom();
  global.Papa = {
    parse: (file, opts) => {
      const rows = Array.from({length: 12}, (_, i) => ({A: i + 1, B: (i + 1) * 2}));
      opts.complete({ data: rows, meta: { fields:['A','B'] } });
    }
  };

  const uiEls = {
    logOutputEl: document.getElementById('logOutput'),
    csvFileInputEl: document.getElementById('csvFileInput'),
    fileInputContainerEl: document.getElementById('fileInputContainer'),
    filePromptMessageEl: document.getElementById('filePromptMessage')
  };

  const interp = new Interpreter(uiEls);
  initUI(interp);
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });

  const script = `VAR "main"
THEN LOAD_CSV FILE "fake.csv" #load file
THEN PEEK
THEN SELECT A
THEN PEEK

VAR "other"
THEN PEEK`;

  document.getElementById('pipeDataInput').value = script;
  document.getElementById('highlightingOverlay').innerHTML = '';

  const highlightTokens = tokenizeForHighlighting(script);
  assert.ok(highlightTokens.some(t => t.type === TokenType.COMMENT));
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  document.getElementById("astOutput").textContent = JSON.stringify(ast, null, 2);
  await interp.run(ast);
  renderPeekOutputsUI();

  assert.strictEqual(ast.length, 2);
  assert.strictEqual(interp.peekOutputs.length, 3);
  assert.strictEqual(interp.peekOutputs[0].dataset.length, 12);
  assert.deepEqual(interp.peekOutputs[1].dataset[0], {A:1});
  assert.strictEqual(interp.peekOutputs[2].dataset, null);

  const tabs = document.querySelectorAll('.peek-tab');
  assert.strictEqual(tabs.length, 3);
  const emptyHtml = document.getElementById(interp.peekOutputs[2].id).innerHTML;
  assert.ok(emptyHtml.includes('No dataset loaded to PEEK.'));
  const peekHtml = document.getElementById(interp.peekOutputs[0].id).innerHTML;
  assert.ok(peekHtml.includes('Showing first 10 of 12'));
  assert.ok(document.getElementById('highlightingOverlay').innerHTML.length > 0);
});

test('ui shows error message for invalid script', async () => {
  setupDom();
  const uiEls = {
    logOutputEl: document.getElementById('logOutput'),
    csvFileInputEl: document.getElementById('csvFileInput'),
    fileInputContainerEl: document.getElementById('fileInputContainer'),
    filePromptMessageEl: document.getElementById('filePromptMessage')
  };
  const interp = new Interpreter(uiEls);
  initUI(interp);

  const script = 'VAR "x" PEEK';
  document.getElementById('pipeDataInput').value = script;
  document.getElementById('highlightingOverlay').innerHTML = '';

  let error;
  try {
    const tokens = tokenizeForParser(script);
    const parser = new Parser(tokens);
    await interp.run(parser.parse());
  } catch (e) {
    error = e;
    document.getElementById('astOutput').classList.add('error-box');
    document.getElementById('astOutput').textContent = `Error: ${e.message}`;
  }

  renderPeekOutputsUI();

  assert.ok(error);
  assert.ok(document.getElementById('astOutput').classList.contains('error-box'));
  assert.strictEqual(interp.peekOutputs.length, 0);
  assert.ok(document.getElementById('peekOutputsDisplayArea').textContent.includes('No PEEK outputs'));
});

