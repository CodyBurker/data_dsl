import test from 'node:test';
import assert from 'node:assert/strict';
import { Interpreter } from '../js/interpreter.js';

class MockDataFrame {
  constructor(data) {
    this.data = data;
    this.columns = data.length ? Object.keys(data[0]) : [];
    this.shape = [data.length, this.columns.length];
  }
  count() { return this.data.length; }
  loc({ columns }) {
    const newData = this.data.map(row => {
      const obj = {};
      columns.forEach(col => { obj[col] = row[col]; });
      return obj;
    });
    return new MockDataFrame(newData);
  }
  toJSON() { return this.data; }
}

global.dfd = { DataFrame: MockDataFrame };
global.Papa = { unparse: data => { global.__unparseCalled = true; return 'csv'; } };

global.document = {
  createElement: () => ({ click: () => { global.__clickCalled = true; } , set href(v){}, get href(){return ''}, set download(v){}, style:{} }),
  body: { appendChild: () => {}, removeChild: () => {} }
};

test('handleKeepColumns selects columns case-insensitively', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const df = new MockDataFrame([{A:1,B:2,C:3},{A:4,B:5,C:6}]);
  const result = interp.handleKeepColumns({ columns: ['a','C'] }, df);
  assert.deepEqual(result.columns, ['A','C']);
  assert.strictEqual(result.shape[1], 2);
});

test('executeCommand PEEK stores peek output', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  interp.variables.data = new MockDataFrame([{A:1}]);
  await interp.executeCommand({ command: 'PEEK', args:{}, line:5 });
  assert.strictEqual(interp.peekOutputs.length, 1);
  assert.strictEqual(interp.peekOutputs[0].line, 5);
});

test('handleExportCsv exports DataFrame using Papa.unparse', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  const df = new MockDataFrame([{A:1}]);
  await interp.handleExportCsv({ file: 'out.csv' }, df);
  assert.ok(global.__unparseCalled);
  assert.ok(global.__clickCalled);
  global.__unparseCalled = false;
  global.__clickCalled = false;
});

test('handleExportCsv for array of objects uses Papa.unparse', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  await interp.handleExportCsv({ file: 'arr.csv' }, [{A:1},{A:2}]);
  assert.ok(global.__unparseCalled);
  assert.ok(global.__clickCalled);
  global.__unparseCalled = false;
  global.__clickCalled = false;
});

test('handleExportCsv throws on unsupported type', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  await assert.rejects(() => interp.handleExportCsv({file:'x.csv'}, 5), /does not support/);
});

test('executeCommand SELECT uses handleKeepColumns', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'sel';
  interp.variables.sel = new MockDataFrame([{A:1,B:2,C:3}]);
  await interp.executeCommand({ command: 'SELECT', args: { columns: ['B'] } });
  assert.deepEqual(interp.variables.sel.columns, ['B']);
});
