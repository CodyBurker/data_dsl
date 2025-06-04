import test from 'node:test';
import assert from 'node:assert/strict';
import { Interpreter } from '../js/interpreter.js';

// Minimal stubs for browser APIs used in exports
global.document = {
  createElement: () => ({ click: () => { global.__clicked = true; }, set href(v){}, get href(){return ''}, set download(v){}, style:{} }),
  body: { appendChild(){}, removeChild(){} }
};

global.Papa = {
  unparse: data => { global.__unparseCalled = true; return 'csv'; },
  parse: (file, opts) => opts.complete({ data: [{A:1,B:2},{A:3,B:4}], meta: { fields:['A','B'] } })
};

test('handleKeepColumns selects columns case-insensitively', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [{A:1,B:2,C:3},{A:4,B:5,C:6}];
  const result = interp.handleKeepColumns({ columns: ['a','C'] }, data);
  assert.deepEqual(result, [{A:1,C:3},{A:4,C:6}]);
});

test('executeCommand PEEK stores peek output', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  interp.variables.data = [{A:1}];
  await interp.executeCommand({ command: 'PEEK', args:{}, line:5 });
  assert.strictEqual(interp.peekOutputs.length, 1);
  assert.strictEqual(interp.peekOutputs[0].line, 5);
});

test('handleExportCsv for array of objects uses Papa.unparse', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  await interp.handleExportCsv({ file: 'arr.csv' }, [{A:1},{A:2}]);
  assert.ok(global.__unparseCalled);
  assert.ok(global.__clicked);
  global.__unparseCalled = false;
  global.__clicked = false;
});

test('handleExportCsv throws on unsupported type', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  await assert.rejects(() => interp.handleExportCsv({file:'x.csv'}, 5), /does not support/);
});

test('executeCommand SELECT uses handleKeepColumns', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'sel';
  interp.variables.sel = [{A:1,B:2,C:3}];
  await interp.executeCommand({ command: 'SELECT', args: { columns: ['B'] } });
  assert.deepEqual(interp.variables.sel, [{B:2}]);
});

test('handleJoin performs default inner join', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'left';
  interp.variables.left = [{id:1,val:'a'},{id:2,val:'b'}];
  interp.variables.right = [{id:1,x:10},{id:3,x:30}];
  const result = interp.handleJoin({ variable: 'right', leftKey: 'id', rightKey: 'id' }, interp.variables.left);
  assert.deepEqual(result, [{id:1,val:'a',x:10}]);
});

test('handleJoin left join keeps unmatched', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'l';
  interp.variables.l = [{id:1,v:'a'},{id:2,v:'b'}];
  interp.variables.r = [{id:1,x:10}];
  const result = interp.handleJoin({ variable: 'r', leftKey: 'id', rightKey: 'id', type: 'LEFT' }, interp.variables.l);
  assert.deepEqual(result, [{id:1,v:'a',x:10},{id:2,v:'b'}]);
});

test('handleJoin with different keys', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'l';
  interp.variables.l = [{name:'a'},{name:'b'}];
  interp.variables.r = [{"full name":'a',x:1},{"full name":'c',x:2}];
  const result = interp.handleJoin({ variable: 'r', leftKey: 'name', rightKey: 'full name' }, interp.variables.l);
  assert.deepEqual(result, [{name:'a',"full name":'a',x:1}]);
});

test('handleLoadCsv returns array of objects', async () => {
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.activeVariableName = 'df';
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });
  const data = await interp.handleLoadCsv({ file: 'fake.csv' });
  assert.deepEqual(data, [{A:1,B:2},{A:3,B:4}]);
});
