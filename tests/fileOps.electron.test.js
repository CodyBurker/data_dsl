import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { saveScriptToFile, loadScriptFromFile } from '../js/ui/fileOps.js';
import { queryElements } from '../js/ui/elements.js';

function setup() {
  const dom = new JSDOM('<textarea id="pipeDataInput"></textarea><div id="highlightingOverlay"></div>');
  global.document = dom.window.document;
  global.window = dom.window;
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  queryElements();
}

test('electron API load and save', async () => {
  setup();
  let opened = false;
  let saved = false;
  window.electronAPI = {
    openFile: async () => { opened = true; return 'TEST'; },
    saveFile: async content => { saved = content === 'TEST'; }
  };

  const update = () => {};
  const ref = { currentLine: null };

  await loadScriptFromFile(null, update, ref);
  assert.strictEqual(document.getElementById('pipeDataInput').value, 'TEST');
  await saveScriptToFile(null);
  assert.ok(opened);
  assert.ok(saved);
});
