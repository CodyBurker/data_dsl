import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as dfd from 'danfojs-node';
import { Interpreter } from '../js/interpreter.js';
import { initUI, renderPeekOutputsUI } from '../js/ui.js';

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
  global.dfd = dfd;
  const interp = new Interpreter({});
  initUI(interp);
  interp.peekOutputs = [
    { id: 'p1', varName: 'x', line: 1, dataset: new dfd.DataFrame([{A:1}]) },
    { id: 'p2', varName: 'x', line: 2, dataset: new dfd.DataFrame([{A:2}]) }
  ];
  renderPeekOutputsUI();
  const tabs = document.querySelectorAll('.peek-tab');
  assert.strictEqual(tabs.length, 2);
});
