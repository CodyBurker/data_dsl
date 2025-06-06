import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Interpreter } from '../js/interpreter.js';
import { initUI, renderPeekOutputsUI } from '../js/ui/index.js';
import { renderDag } from '../js/ui/dagView.js';
import { buildDag } from '../js/dag.js';

import { TokenType, tokenizeForParser, tokenizeForHighlighting } from "../js/tokenizer.js";
import { Parser } from "../js/parser.js";
import { from } from 'arquero';
function setupDom() {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <textarea id="pipeDataInput"></textarea>
    <div id="highlightingOverlay"></div>
    <pre id="lineNumbers"></pre>
    <div id="execStatus"></div>
    <div id="errorMarkers"></div>
    <div id="varBlockIndicator"></div>
    <pre id="astOutput"></pre>
    <div id="logOutput"></div>
    <div id="peekTabsContainer"></div>
    <div id="peekOutputsDisplayArea"></div>
    <div id="dagContainer"></div>
    <button id="openScriptFileButton"></button>
    <button id="saveScriptFileButton"></button>
    <button id="runButton"></button>
    <button id="clearButton"></button>
    <input id="csvFileInput" />
    <div id="fileInputContainer"></div>
    <span id="filePromptMessage"></span>
    <button id="exportPeekButton"></button>
  </body>`, { url: 'https://example.com' });
  global.document = dom.window.document;
  global.window = dom.window;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.getComputedStyle = () => ({
    lineHeight: '16px',
    paddingTop: '0',
    paddingLeft: '0',
    borderLeftWidth: '0',
    borderTopWidth: '0'
  });
}

test('dag container is present after initUI', async () => {
  setupDom();
  const interp = new Interpreter({});
  await initUI(interp, { autoRun: false });
  assert.ok(document.getElementById('dagContainer'));
});

test('renderDag creates node elements with descriptions', async () => {
  setupDom();
  const interp = new Interpreter({});
  await initUI(interp, { autoRun: false });
  const tokens = tokenizeForParser('VAR "v" THEN SELECT A');
  const ast = new Parser(tokens).parse();
  const dag = buildDag(ast);
  renderDag(dag);
  const nodes = document.querySelectorAll('.dag-node');
  assert.strictEqual(nodes.length, 1);
  assert.ok(nodes[0].dataset.description.includes('Keep columns'));
  const tooltip = document.querySelector('#dagContainer .dag-tooltip');
  assert.ok(tooltip);
});

test('renderPeekOutputsUI creates a tab for each PEEK output', async () => {
  setupDom();

  const interp = new Interpreter({});
  await initUI(interp, { autoRun: false });
  interp.peekOutputs = [
    { id: 'p1', varName: 'x', line: 1, dataset: from([{A:1}]) },
    { id: 'p2', varName: 'x', line: 2, dataset: from([{A:2}]) }
  ];
  renderPeekOutputsUI();
  const tabs = document.querySelectorAll('.peek-tab');
  assert.strictEqual(tabs.length, 3); // Active tab plus two peek tabs
  assert.strictEqual(tabs[2].dataset.line, '2');
});

test('moving cursor selects matching peek tab', async () => {
  setupDom();

  const interp = new Interpreter({});
  await initUI(interp, { autoRun: false });
  interp.peekOutputs = [
    { id: 'p1', varName: 'x', line: 1, dataset: from([{A:1}]) },
    { id: 'p2', varName: 'x', line: 2, dataset: from([{A:2}]) }
  ];
  renderPeekOutputsUI();

  const input = document.getElementById('pipeDataInput');
  input.value = 'LINE1\nLINE2';
  input.setSelectionRange(6,6); // Start of line 2
  input.dispatchEvent(new window.Event('keyup'));

  const active = document.querySelector('.peek-tab.active-peek-tab');
  assert.ok(active);
  assert.strictEqual(active.textContent, 'Active');
  assert.strictEqual(active.dataset.line, '2');
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
  await initUI(interp, { autoRun: false });
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });

  const script = `VAR "d"
THEN LOAD_CSV FILE "fake.csv"
THEN SELECT A`;

  document.getElementById('pipeDataInput').value = script;
  document.getElementById('highlightingOverlay').innerHTML = '';
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  document.getElementById('astOutput').textContent = JSON.stringify(ast, null, 2);

  await interp.run(ast);
  renderPeekOutputsUI();

  assert.strictEqual(ast[0].pipeline.length, 2);
  assert.strictEqual(interp.peekOutputs.length, 0);
  assert.strictEqual(interp.stepOutputs.length, 3);

  const tabs = document.querySelectorAll('.peek-tab');
  // active tab + one final output
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
  await initUI(interp, { autoRun: false });
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });

  const script = `VAR "main"
THEN LOAD_CSV FILE "fake.csv" #load file
THEN SELECT A

VAR "other"
THEN LOAD_CSV FILE "fake.csv"`;

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
  assert.strictEqual(interp.peekOutputs.length, 0);
  assert.strictEqual(interp.stepOutputs.length, 5);

  const tabs = document.querySelectorAll('.peek-tab');
  // active tab plus two final outputs
  assert.strictEqual(tabs.length, 3);
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
  await initUI(interp, { autoRun: false });
  global.fetch = async () => ({ ok: true, text: async () => 'A,B\n1,2' });

  const script = 'VAR "x" SELECT A';
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


test('saving script to file uses File System Access API', async () => {
  setupDom();
  const interp = new Interpreter({});
  await initUI(interp, { autoRun: false });

  let data = null;
  let closed = false;
  window.showSaveFilePicker = async () => ({
    createWritable: async () => ({
      write: async d => { data = d; },
      close: async () => { closed = true; }
    })
  });

  document.getElementById('pipeDataInput').value = 'VAR "x"';
  document.getElementById('saveScriptFileButton').click();
  await new Promise(r => setTimeout(r, 0));

  assert.strictEqual(data, 'VAR "x"');
  assert.ok(closed);
});

test('loading script from file populates editor', async () => {
  setupDom();
  const interp = new Interpreter({});
  await initUI(interp, { autoRun: false });

  window.showOpenFilePicker = async () => [{
    getFile: async () => new File(['VAR "z"'], 'script.pd')
  }];

  document.getElementById('pipeDataInput').value = '';
  document.getElementById('openScriptFileButton').click();
  await new Promise(r => setTimeout(r, 0));

  assert.strictEqual(document.getElementById('pipeDataInput').value, 'VAR "z"');
});

test('debounced input updates execStatus', async () => {
  setupDom();
  global.Papa = { parse: (f, o) => o.complete({ data: [], meta: { fields: [] } }) };
  const uiEls = {
    logOutputEl: document.getElementById('logOutput'),
    csvFileInputEl: document.getElementById('csvFileInput'),
    fileInputContainerEl: document.getElementById('fileInputContainer'),
    filePromptMessageEl: document.getElementById('filePromptMessage')
  };
  const interp = new Interpreter(uiEls);
  await initUI(interp, { autoRun: false });

  const input = document.getElementById('pipeDataInput');
  input.value = 'VAR "x"\nTHEN LOAD_CSV FILE "exampleCities.csv"';
  input.dispatchEvent(new window.Event('input'));
  await new Promise(r => setTimeout(r, 400));

  global.fetch = undefined;

  const bars = document.querySelectorAll('#execStatus div');
  assert.strictEqual(bars.length, 2);
  assert.ok(Array.from(bars).every(b => b.classList.contains('line-success')));
});

test('execStatus highlights error lines in red', async () => {
  setupDom();
  const interp = new Interpreter({});
  await initUI(interp, { autoRun: false });
  const input = document.getElementById('pipeDataInput');
  input.value = 'VAR "x" SELECT A\nVAR "y" JOIN';
  input.dispatchEvent(new window.Event('input'));
  await new Promise(r => setTimeout(r, 400));
  const bars = document.querySelectorAll('#execStatus div');
  assert.strictEqual(bars.length, 2);
  assert.ok(bars[0].classList.contains('line-error'));
  assert.ok(bars[1].classList.contains('line-error'));
  const dots = document.querySelectorAll('#errorMarkers .error-dot');
  assert.strictEqual(dots.length, 2);
});

test('valid lines after an error are not marked', async () => {
  setupDom();
  const interp = new Interpreter({});
  await initUI(interp, { autoRun: false });
  const input = document.getElementById('pipeDataInput');
  input.value = [
    'VAR "cities"',
    'THEN LOAD_CSV FILE "exampleCities.csv"',
    'THEN WITH COLUMN population_millions = population / 1000000',
    'THEN WITH COLUMN COL city_of = "City of " + name',
    'THEN SELECT population, id, city_of'
  ].join('\n');
  input.dispatchEvent(new window.Event('input'));
  await new Promise(r => setTimeout(r, 400));
  const bars = document.querySelectorAll('#execStatus div');
  assert.strictEqual(bars.length, 5);
  assert.ok(bars[3].classList.contains('line-error'));
  assert.ok(!bars[4].classList.contains('line-error'));
  const dots = document.querySelectorAll('#errorMarkers .error-dot');
  assert.strictEqual(dots.length, 1);
});

test('blank lines remain uncolored', async () => {
  setupDom();
  global.Papa = { parse: (f, o) => o.complete({ data: [], meta: { fields: [] } }) };
  const uiEls = {
    logOutputEl: document.getElementById('logOutput'),
    csvFileInputEl: document.getElementById('csvFileInput'),
    fileInputContainerEl: document.getElementById('fileInputContainer'),
    filePromptMessageEl: document.getElementById('filePromptMessage')
  };
  const interp = new Interpreter(uiEls);
  await initUI(interp, { autoRun: false });

  const input = document.getElementById('pipeDataInput');
  input.value = 'VAR "a"\nTHEN SELECT A\n\nVAR "b"\nTHEN SELECT A\n';
  input.dispatchEvent(new window.Event('input'));
  await new Promise(r => setTimeout(r, 400));

  const bars = document.querySelectorAll('#execStatus div');
  assert.strictEqual(bars.length, 6);
  assert.ok(!bars[2].classList.contains('line-pending'));
  assert.ok(!bars[2].classList.contains('line-success'));
  assert.ok(!bars[5].classList.contains('line-pending'));
  assert.ok(!bars[5].classList.contains('line-success'));
});

test('blank line within VAR block inherits status', async () => {
  setupDom();
  global.Papa = { parse: (f, o) => o.complete({ data: [], meta: { fields: [] } }) };
  const uiEls = {
    logOutputEl: document.getElementById('logOutput'),
    csvFileInputEl: document.getElementById('csvFileInput'),
    fileInputContainerEl: document.getElementById('fileInputContainer'),
    filePromptMessageEl: document.getElementById('filePromptMessage')
  };
  const interp = new Interpreter(uiEls);
  await initUI(interp, { autoRun: false });

  const input = document.getElementById('pipeDataInput');
  input.value = 'VAR "x"\nTHEN SELECT A\n\nTHEN SELECT A';
  input.dispatchEvent(new window.Event('input'));
  await new Promise(r => setTimeout(r, 400));

  const bars = document.querySelectorAll('#execStatus div');
  assert.strictEqual(bars.length, 4);
  assert.ok(bars[2].classList.contains('line-pending'));
});

