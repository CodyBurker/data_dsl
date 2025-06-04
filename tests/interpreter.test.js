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
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false });
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });
  const data = await interp.handleLoadCsv({ file: 'fake.csv' });
  assert.deepEqual(data, [{A:1,B:2},{A:3,B:4}]);
  global.fetch = originalFetch;
});

test('handleLoadCsv uses example files when present', async () => {
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.activeVariableName = 'ex';
  let prompted = false;
  interp.requestCsvFile = async () => { prompted = true; return { name: 'x.csv' }; };
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => 'A,B\n1,2\n3,4' });
  const data = await interp.handleLoadCsv({ file: 'example.csv' });
  assert.deepEqual(data, [{A:1,B:2},{A:3,B:4}]);
  assert.strictEqual(prompted, false);
  global.fetch = originalFetch;
});

test('clearInternalState loads sample datasets', () => {
  const interp = new Interpreter({});
  interp.clearInternalState();
  assert.ok(Array.isArray(interp.variables.cities));
  assert.strictEqual(interp.variables.cities.length, 3);
  assert.ok(Array.isArray(interp.variables.people));
  assert.strictEqual(interp.variables.people.length, 4);
});


test('handleFilter filters rows using equality', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [
    {name:'Alice',age:30},
    {name:'Bob',age:40}
  ];
  const result = interp.handleFilter({ column:'age', operator:'=', value:30 }, data);
  assert.deepEqual(result, [{name:'Alice',age:30}]);
});

test('handleFilter supports other comparisons', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [
    {name:'Alice',age:30},
    {name:'Bob',age:40},
    {name:'Carl',age:25}
  ];
  const greater = interp.handleFilter({ column:'age', operator:'>', value:30 }, data);
  assert.deepEqual(greater, [{name:'Bob',age:40}]);
  const less = interp.handleFilter({ column:'age', operator:'<', value:30 }, data);
  assert.deepEqual(less, [{name:'Carl',age:25}]);
  const notEq = interp.handleFilter({ column:'name', operator:'!=', value:'Bob' }, data);
  assert.deepEqual(notEq, [
    {name:'Alice',age:30},
    {name:'Carl',age:25}
  ]);
  const le = interp.handleFilter({ column:'age', operator:'<=', value:30 }, data);
  assert.deepEqual(le, [
    {name:'Alice',age:30},
    {name:'Carl',age:25}
  ]);
});

test('handleFilter advanced operators and column references', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [
    {name:'Alice',age:30, other:30},
    {name:'Bob',age:25, other:30},
    {name:'Carl',age:35, other:35}
  ];
  const ge = interp.handleFilter({ column:'age', operator:'>=', value:30 }, data);
  assert.deepEqual(ge, [
    {name:'Alice',age:30, other:30},
    {name:'Carl',age:35, other:35}
  ]);
  const sw = interp.handleFilter({ column:'name', operator:'STARTSWITH', value:'B' }, data);
  assert.deepEqual(sw, [{name:'Bob',age:25, other:30}]);
  const colEq = interp.handleFilter({ column:'age', operator:'=', value:{type:'COLUMN_REFERENCE', name:'other'} }, data);
  assert.deepEqual(colEq, [
    {name:'Alice',age:30, other:30},
    {name:'Carl',age:35, other:35}
  ]);
  const contains = interp.handleFilter({ column:'name', operator:'CONTAINS', value:'a' }, data);
  assert.deepEqual(contains, [
    {name:'Carl',age:35, other:35}
  ]);
  const ends = interp.handleFilter({ column:'name', operator:'ENDSWITH', value:'e' }, data);
  assert.deepEqual(ends, [{name:'Alice',age:30, other:30}]);
  const isop = interp.handleFilter({ column:'age', operator:'IS', value:30 }, data);
  assert.deepEqual(isop, [{name:'Alice',age:30, other:30}]);
  const isNot = interp.handleFilter({ column:'age', operator:'IS NOT', value:25 }, data);
  assert.deepEqual(isNot, [
    {name:'Alice',age:30, other:30},
    {name:'Carl',age:35, other:35}
  ]);
});
