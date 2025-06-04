import test from 'node:test';
import assert from 'node:assert/strict';
import { Interpreter } from '../js/interpreter.js';
import { tokenizeForParser } from '../js/tokenizer.js';
import { Parser } from '../js/parser.js';
import * as csv from '../js/csv.js';
import { keepColumns, joinDatasets, filterRows, withColumn } from '../js/datasetOps.js';

// Minimal stubs for browser APIs used in exports
global.document = {
  createElement: () => ({ click: () => { global.__clicked = true; }, set href(v){}, get href(){return ''}, set download(v){}, style:{} }),
  body: { appendChild(){}, removeChild(){} }
};

global.Papa = {
  unparse: data => { global.__unparseCalled = true; return 'csv'; },
  parse: (file, opts) => opts.complete({ data: [{A:1,B:2},{A:3,B:4}], meta: { fields:['A','B'] } })
};

test('keepColumns selects columns case-insensitively', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [{A:1,B:2,C:3},{A:4,B:5,C:6}];
  const result = keepColumns(interp, { columns: ['a','C'] }, data);
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

test('exportCsv for array of objects uses Papa.unparse', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  await csv.exportCsv(interp, { file: 'arr.csv' }, [{A:1},{A:2}]);
  assert.ok(global.__unparseCalled);
  assert.ok(global.__clicked);
  global.__unparseCalled = false;
  global.__clicked = false;
});

test('exportCsv throws on unsupported type', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  await assert.rejects(() => csv.exportCsv(interp, {file:'x.csv'}, 5), /does not support/);
});

test('executeCommand SELECT uses keepColumns', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'sel';
  interp.variables.sel = [{A:1,B:2,C:3}];
  await interp.executeCommand({ command: 'SELECT', args: { columns: ['B'] } });
  assert.deepEqual(interp.variables.sel, [{B:2}]);
});

test('joinDatasets performs default inner join', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'left';
  interp.variables.left = [{id:1,val:'a'},{id:2,val:'b'}];
  interp.variables.right = [{id:1,x:10},{id:3,x:30}];
  const result = joinDatasets(interp, { variable: 'right', leftKey: 'id', rightKey: 'id' }, interp.variables.left);
  assert.deepEqual(result, [{id:1,val:'a',x:10}]);
});

test('joinDatasets left join keeps unmatched', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'l';
  interp.variables.l = [{id:1,v:'a'},{id:2,v:'b'}];
  interp.variables.r = [{id:1,x:10}];
  const result = joinDatasets(interp, { variable: 'r', leftKey: 'id', rightKey: 'id', type: 'LEFT' }, interp.variables.l);
  assert.deepEqual(result, [{id:1,v:'a',x:10},{id:2,v:'b'}]);
});

test('joinDatasets with different keys', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'l';
  interp.variables.l = [{name:'a'},{name:'b'}];
  interp.variables.r = [{"full name":'a',x:1},{"full name":'c',x:2}];
  const result = joinDatasets(interp, { variable: 'r', leftKey: 'name', rightKey: 'full name' }, interp.variables.l);
  assert.deepEqual(result, [{name:'a',"full name":'a',x:1}]);
});

test('loadCsv returns array of objects', async () => {
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.activeVariableName = 'df';
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false });
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });
  const data = await csv.loadCsv(interp, { file: 'fake.csv' });
  assert.deepEqual(data, [{A:1,B:2},{A:3,B:4}]);
  global.fetch = originalFetch;
});

test('loadCsv uses example files when present', async () => {
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.activeVariableName = 'ex';
  let prompted = false;
  interp.requestCsvFile = async () => { prompted = true; return { name: 'x.csv' }; };
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => 'A,B\n1,2\n3,4' });
  const data = await csv.loadCsv(interp, { file: 'example.csv' });
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


test('filterRows filters rows using equality', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [
    {name:'Alice',age:30},
    {name:'Bob',age:40}
  ];
  const result = filterRows(interp, { column:'age', operator:'=', value:30 }, data);
  assert.deepEqual(result, [{name:'Alice',age:30}]);
});

test('filterRows supports other comparisons', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [
    {name:'Alice',age:30},
    {name:'Bob',age:40},
    {name:'Carl',age:25}
  ];
  const greater = filterRows(interp, { column:'age', operator:'>', value:30 }, data);
  assert.deepEqual(greater, [{name:'Bob',age:40}]);
  const less = filterRows(interp, { column:'age', operator:'<', value:30 }, data);
  assert.deepEqual(less, [{name:'Carl',age:25}]);
  const notEq = filterRows(interp, { column:'name', operator:'!=', value:'Bob' }, data);
  assert.deepEqual(notEq, [
    {name:'Alice',age:30},
    {name:'Carl',age:25}
  ]);
  const le = filterRows(interp, { column:'age', operator:'<=', value:30 }, data);
  assert.deepEqual(le, [
    {name:'Alice',age:30},
    {name:'Carl',age:25}
  ]);
});

test('filterRows advanced operators and column references', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [
    {name:'Alice',age:30, other:30},
    {name:'Bob',age:25, other:30},
    {name:'Carl',age:35, other:35}
  ];
  const ge = filterRows(interp, { column:'age', operator:'>=', value:30 }, data);
  assert.deepEqual(ge, [
    {name:'Alice',age:30, other:30},
    {name:'Carl',age:35, other:35}
  ]);
  const sw = filterRows(interp, { column:'name', operator:'STARTSWITH', value:'B' }, data);
  assert.deepEqual(sw, [{name:'Bob',age:25, other:30}]);
  const colEq = filterRows(interp, { column:'age', operator:'=', value:{type:'COLUMN_REFERENCE', name:'other'} }, data);
  assert.deepEqual(colEq, [
    {name:'Alice',age:30, other:30},
    {name:'Carl',age:35, other:35}
  ]);
  const contains = filterRows(interp, { column:'name', operator:'CONTAINS', value:'a' }, data);
  assert.deepEqual(contains, [
    {name:'Carl',age:35, other:35}
  ]);
  const ends = filterRows(interp, { column:'name', operator:'ENDSWITH', value:'e' }, data);
  assert.deepEqual(ends, [{name:'Alice',age:30, other:30}]);
  const isop = filterRows(interp, { column:'age', operator:'IS', value:30 }, data);
  assert.deepEqual(isop, [{name:'Alice',age:30, other:30}]);
  const isNot = filterRows(interp, { column:'age', operator:'IS NOT', value:25 }, data);
  assert.deepEqual(isNot, [
    {name:'Alice',age:30, other:30},
    {name:'Carl',age:35, other:35}
  ]);
});

test('filterRows evaluates grouped conditions', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [
    {name:'Alice',age:30},
    {name:'Bob',age:40},
    {name:'Carl',age:20}
  ];
  const cond = {
    type: 'AND',
    left: {
      type: 'OR',
      left: { column:'age', operator:'=', value:30 },
      right: { column:'age', operator:'=', value:40 }
    },
    right: { column:'name', operator:'!=', value:'Bob' }
  };
  const result = filterRows(interp, cond, data);
  assert.deepEqual(result, [{name:'Alice',age:30}]);
});

test('withColumn computes arithmetic expression', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [{a:1,b:2,c:3}];
  const expr = [
    { type: 'PUNCTUATION', value: '(' },
    { type: 'IDENTIFIER', value: 'a' },
    { type: 'OPERATOR', value: '+' },
    { type: 'NUMBER_LITERAL', value: 2 },
    { type: 'OPERATOR', value: '*' },
    { type: 'IDENTIFIER', value: 'b' },
    { type: 'PUNCTUATION', value: ')' },
    { type: 'OPERATOR', value: '/' },
    { type: 'IDENTIFIER', value: 'c' }
  ];
  const result = withColumn(interp, { columnName:'res', expression: expr }, data);
  assert.strictEqual(result[0].res, (1 + 2 * 2) / 3);
});

test('withColumn concatenates strings and literals', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [{a:'hi', b:'there'}];
  const expr1 = [
    { type:'IDENTIFIER', value:'a' },
    { type:'OPERATOR', value:'+' },
    { type:'IDENTIFIER', value:'b' }
  ];
  const expr2 = [
    { type:'IDENTIFIER', value:'a' },
    { type:'OPERATOR', value:'+' },
    { type:'STRING_LITERAL', value:'!' }
  ];
  const r1 = withColumn(interp, { columnName:'greet', expression: expr1 }, data);
  const r2 = withColumn(interp, { columnName:'exclaim', expression: expr2 }, data);
  assert.strictEqual(r1[0].greet, 'hithere');
  assert.strictEqual(r2[0].exclaim, 'hi!');
});

test('withColumn applies string functions', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = [{name:' Alice '}];
  const lowerExpr = [
    { type:'IDENTIFIER', value:'LOWER' },
    { type:'PUNCTUATION', value:'(' },
    { type:'IDENTIFIER', value:'name' },
    { type:'PUNCTUATION', value:')' }
  ];
  const upperExpr = [
    { type:'IDENTIFIER', value:'UPPER' },
    { type:'PUNCTUATION', value:'(' },
    { type:'IDENTIFIER', value:'name' },
    { type:'PUNCTUATION', value:')' }
  ];
  const trimExpr = [
    { type:'IDENTIFIER', value:'TRIM' },
    { type:'PUNCTUATION', value:'(' },
    { type:'IDENTIFIER', value:'name' },
    { type:'PUNCTUATION', value:')' }
  ];
  const r1 = withColumn(interp, { columnName:'lower', expression: lowerExpr }, data);
  const r2 = withColumn(interp, { columnName:'upper', expression: upperExpr }, data);
  const r3 = withColumn(interp, { columnName:'trim', expression: trimExpr }, data);
  assert.strictEqual(r1[0].lower, ' Alice '.toLowerCase());
  assert.strictEqual(r2[0].upper, ' Alice '.toUpperCase());
  assert.strictEqual(r3[0].trim, ' Alice '.trim());
});

import fs from 'fs';
import path from 'path';

test('default script file runs without error', async () => {
  const script = fs.readFileSync(path.join('examples', 'default.pd'), 'utf8');
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter({ csvFileInputEl: {} });
  const originalFetch = global.fetch;
  const originalPapa = global.Papa;
  global.Papa = {
    unparse: originalPapa.unparse,
    parse: (text, opts) => {
      const lines = text.trim().split(/\r?\n/);
      const headers = lines.shift().split(',');
      const data = lines.map(l => {
        const vals = l.split(',');
        const obj = {};
        headers.forEach((h,i) => {
          const num = Number(vals[i]);
          obj[h] = isNaN(num) ? vals[i] : num;
        });
        return obj;
      });
      opts.complete({ data, meta: { fields: headers } });
    }
  };
  global.fetch = async (url) => {
    if (url.endsWith('exampleCities.csv')) {
      return { ok: true, text: async () => fs.readFileSync(path.join('examples', 'exampleCities.csv'), 'utf8') };
    }
    if (url.endsWith('examplePeople.csv')) {
      return { ok: true, text: async () => fs.readFileSync(path.join('examples', 'examplePeople.csv'), 'utf8') };
    }
    return { ok: false };
  };
  await interp.run(ast);
  global.fetch = originalFetch;
  global.Papa = originalPapa;
  assert.strictEqual(interp.peekOutputs.length, 3);
  assert.deepEqual(interp.peekOutputs[1].dataset[0], { person_id: 1, name: 'Alice', age: 30, city_id: 1 });
});

test('run records step outputs for each command', async () => {
  const script = `VAR "d"\nTHEN LOAD_CSV FILE "fake.csv"\nTHEN SELECT A\nTHEN PEEK`;
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });
  global.Papa = {
    parse: (file, opts) => opts.complete({ data: [{A:1,B:2},{A:3,B:4}], meta:{ fields:['A','B'] } })
  };
  await interp.run(ast);
  assert.strictEqual(interp.stepOutputs.length, ast[0].pipeline.length + 1);
  assert.deepEqual(interp.stepOutputs[1].dataset, [{A:1},{A:3}]);
});

test('cached datasets persist between runs', async () => {
  const script = `VAR "d" THEN LOAD_CSV FILE "f.csv" THEN PEEK`;
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.requestCsvFile = async () => ({ name: 'f.csv' });

  const ds1 = [{A:1}];
  const ds2 = [{A:2}];
  const originalExec = interp.executeCommand.bind(interp);
  let callCount = 0;
  interp.executeCommand = async function(node) {
    if (node.command === 'LOAD_CSV') {
      callCount++;
      this.variables[this.activeVariableName] = callCount === 1 ? ds1 : ds2;
    } else {
      await originalExec(node);
    }
  };

  await interp.run(ast);
  assert.deepEqual(interp.stepOutputs[1].dataset, ds1);

  await interp.run(ast);
  assert.deepEqual(interp.stepOutputs[1].dataset, ds1); // cached
  assert.strictEqual(callCount, 1);

  interp.executeCommand = originalExec;
});

test('join result updates when upstream step changes', async () => {
  const script1 = `VAR "cities" THEN LOAD_CSV FILE "c.csv" THEN WITH COLUMN city_of = "City of " + name THEN SELECT id, city_of THEN PEEK\nVAR "people" THEN LOAD_CSV FILE "p.csv" THEN JOIN cities ON city_id=id TYPE "LEFT" THEN PEEK`;
  const script2 = `VAR "cities" THEN LOAD_CSV FILE "c.csv" THEN WITH COLUMN city_of = "City of a " + name THEN SELECT id, city_of THEN PEEK\nVAR "people" THEN LOAD_CSV FILE "p.csv" THEN JOIN cities ON city_id=id TYPE "LEFT" THEN PEEK`;
  const ast1 = new Parser(tokenizeForParser(script1)).parse();
  const ast2 = new Parser(tokenizeForParser(script2)).parse();
  const interp = new Interpreter({ csvFileInputEl: {} });
  const { cities, people } = await import('../js/samples.js');
  const origExec = interp.executeCommand.bind(interp);
  interp.executeCommand = async function(node) {
    if (node.command === 'LOAD_CSV') {
      this.variables[this.activeVariableName] = this.activeVariableName === 'cities'
        ? cities.map(r => ({ ...r }))
        : people.map(r => ({ ...r }));
    } else {
      await origExec(node);
    }
  };

  await interp.run(ast1);
  const first = interp.stepOutputs.find(s => s.varName === 'people' && s.id.endsWith('final')).dataset;

  await interp.run(ast2);
  const second = interp.stepOutputs.find(s => s.varName === 'people' && s.id.endsWith('final')).dataset;

  const expectedFirst = people.map(p => {
    const c = cities.find(c => c.id === p.city_id);
    return { ...p, id: c.id, city_of: `City of ${c.name}` };
  });

  const expectedSecond = people.map(p => {
    const c = cities.find(c => c.id === p.city_id);
    return { ...p, id: c.id, city_of: `City of a ${c.name}` };
  });

  assert.deepEqual(first, expectedFirst);
  assert.deepEqual(second, expectedSecond);
});

test('cache entries track unusedCount across runs', async () => {
  const scriptD = `VAR "d" THEN LOAD_CSV FILE "f.csv" THEN PEEK`;
  const scriptX = `VAR "x" THEN LOAD_CSV FILE "f.csv" THEN PEEK`;
  const astD = new Parser(tokenizeForParser(scriptD)).parse();
  const astX = new Parser(tokenizeForParser(scriptX)).parse();
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.requestCsvFile = async () => ({ name: 'f.csv' });

  const orig = interp.executeCommand.bind(interp);
  interp.executeCommand = async function(node) {
    if (node.command === 'LOAD_CSV') {
      this.variables[this.activeVariableName] = [{A:1}];
    } else {
      await orig(node);
    }
  };

  await interp.run(astD);
  assert.strictEqual(interp.cache['d-0'].unusedCount, 0);
  assert.strictEqual(interp.cache['d-1'].unusedCount, 0);

  await interp.run(astX);
  assert.strictEqual(interp.cache['d-0'].unusedCount, 1);
  assert.strictEqual(interp.cache['d-1'].unusedCount, 1);

  await interp.run(astD);
  assert.strictEqual(interp.cache['d-0'].unusedCount, 0);
  assert.strictEqual(interp.cache['d-1'].unusedCount, 0);

  interp.executeCommand = orig;
});
