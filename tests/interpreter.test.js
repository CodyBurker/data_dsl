import test from 'node:test';
import assert from 'node:assert/strict';
import { Interpreter } from '../js/interpreter.js';
import { tokenizeForParser } from '../js/tokenizer.js';
import { Parser } from '../js/parser.js';
import * as csv from '../js/csv.js';
import { keepColumns, dropColumns, renameColumns, joinDatasets, filterRows, withColumn, groupBy, aggregate, sortDataset } from '../js/datasetOps.js';
import { from } from 'arquero';

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
  const data = from([{A:1,B:2,C:3},{A:4,B:5,C:6}]);
  const result = keepColumns(interp, { columns: ['a','C'] }, data);
  assert.deepEqual(result.objects(), [{A:1,C:3},{A:4,C:6}]);
});

test('dropColumns removes columns case-insensitively', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([{A:1,B:2,C:3},{A:4,B:5,C:6}]);
  const result = dropColumns(interp, { columns: ['b'] }, data);
  assert.deepEqual(result.columnNames(), ['A','C']);
});

test('renameColumns renames columns case-insensitively', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([{A:1,B:2}]);
  const result = renameColumns(interp, { mappings:[{from:'a', to:'alpha'}] }, data);
  assert.deepEqual(result.columnNames(), ['alpha','B']);
});


test('exportCsv for array of objects uses Papa.unparse', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'data';
  const table = from([{A:1},{A:2}]);
  await csv.exportCsv(interp, { file: 'arr.csv' }, table);
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
  interp.variables.sel = from([{A:1,B:2,C:3}]);
  await interp.executeCommand({ command: 'SELECT', args: { columns: ['B'] } });
  assert.deepEqual(interp.variables.sel.objects(), [{B:2}]);
});

test('executeCommand DROP_COLUMNS uses dropColumns', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  interp.variables.d = from([{A:1,B:2,C:3}]);
  await interp.executeCommand({ command: 'DROP_COLUMNS', args: { columns: ['B'] } });
  assert.deepEqual(interp.variables.d.columnNames(), ['A','C']);
});

test('executeCommand RENAME_COLUMNS uses renameColumns', async () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  interp.variables.d = from([{A:1,B:2}]);
  await interp.executeCommand({ command: 'RENAME_COLUMNS', args: { mappings:[{from:'A', to:'AA'}] } });
  assert.deepEqual(interp.variables.d.columnNames(), ['AA','B']);
});

test('joinDatasets performs default inner join', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'left';
  interp.variables.left = from([{id:1,val:'a'},{id:2,val:'b'}]);
  interp.variables.right = from([{id:1,x:10},{id:3,x:30}]);
  const result = joinDatasets(interp, { variable: 'right', leftKey: 'id', rightKey: 'id' }, interp.variables.left);
  assert.deepEqual(result.objects(), [{id:1,val:'a',x:10}]);
});

test('joinDatasets left join keeps unmatched', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'l';
  interp.variables.l = from([{id:1,v:'a'},{id:2,v:'b'}]);
  interp.variables.r = from([{id:1,x:10}]);
  const result = joinDatasets(interp, { variable: 'r', leftKey: 'id', rightKey: 'id', type: 'LEFT' }, interp.variables.l);
  assert.deepEqual(result.objects(), [{id:1,v:'a',x:10},{id:2,v:'b',x:undefined}]);
});

test('joinDatasets with different keys', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'l';
  interp.variables.l = from([{name:'a'},{name:'b'}]);
  interp.variables.r = from([{"full name":'a',x:1},{"full name":'c',x:2}]);
  const result = joinDatasets(interp, { variable: 'r', leftKey: 'name', rightKey: 'full name' }, interp.variables.l);
  assert.deepEqual(result.objects(), [{name:'a',"full name":'a',x:1}]);
});

test('loadCsv returns an Arquero table', async () => {
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.activeVariableName = 'df';
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false });
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });
  const data = await csv.loadCsv(interp, { file: 'fake.csv' });
  assert.deepEqual(data.objects(), [{A:1,B:2},{A:3,B:4}]);
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
  assert.deepEqual(data.objects(), [{A:1,B:2},{A:3,B:4}]);
  assert.strictEqual(prompted, false);
  global.fetch = originalFetch;
});

test('clearInternalState loads sample datasets', () => {
  const interp = new Interpreter({});
  interp.clearInternalState();
  assert.ok(typeof interp.variables.cities.numRows === 'function');
  assert.strictEqual(interp.variables.cities.numRows(), 3);
  assert.ok(typeof interp.variables.people.numRows === 'function');
  assert.strictEqual(interp.variables.people.numRows(), 4);
});


test('filterRows filters rows using equality', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([
    {name:'Alice',age:30},
    {name:'Bob',age:40}
  ]);
  const result = filterRows(interp, { column:'age', operator:'=', value:30 }, data);
  assert.deepEqual(result.objects(), [{name:'Alice',age:30}]);
});

test('filterRows supports other comparisons', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([
    {name:'Alice',age:30},
    {name:'Bob',age:40},
    {name:'Carl',age:25}
  ]);
  const greater = filterRows(interp, { column:'age', operator:'>', value:30 }, data);
  assert.deepEqual(greater.objects(), [{name:'Bob',age:40}]);
  const less = filterRows(interp, { column:'age', operator:'<', value:30 }, data);
  assert.deepEqual(less.objects(), [{name:'Carl',age:25}]);
  const notEq = filterRows(interp, { column:'name', operator:'!=', value:'Bob' }, data);
  assert.deepEqual(notEq.objects(), [
    {name:'Alice',age:30},
    {name:'Carl',age:25}
  ]);
  const le = filterRows(interp, { column:'age', operator:'<=', value:30 }, data);
  assert.deepEqual(le.objects(), [
    {name:'Alice',age:30},
    {name:'Carl',age:25}
  ]);
});

test('filterRows advanced operators and column references', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([
    {name:'Alice',age:30, other:30},
    {name:'Bob',age:25, other:30},
    {name:'Carl',age:35, other:35}
  ]);
  const ge = filterRows(interp, { column:'age', operator:'>=', value:30 }, data);
  assert.deepEqual(ge.objects(), [
    {name:'Alice',age:30, other:30},
    {name:'Carl',age:35, other:35}
  ]);
  const sw = filterRows(interp, { column:'name', operator:'STARTSWITH', value:'B' }, data);
  assert.deepEqual(sw.objects(), [{name:'Bob',age:25, other:30}]);
  const colEq = filterRows(interp, { column:'age', operator:'=', value:{type:'COLUMN_REFERENCE', name:'other'} }, data);
  assert.deepEqual(colEq.objects(), [
    {name:'Alice',age:30, other:30},
    {name:'Carl',age:35, other:35}
  ]);
  const contains = filterRows(interp, { column:'name', operator:'CONTAINS', value:'a' }, data);
  assert.deepEqual(contains.objects(), [
    {name:'Carl',age:35, other:35}
  ]);
  const ends = filterRows(interp, { column:'name', operator:'ENDSWITH', value:'e' }, data);
  assert.deepEqual(ends.objects(), [{name:'Alice',age:30, other:30}]);
  const isop = filterRows(interp, { column:'age', operator:'IS', value:30 }, data);
  assert.deepEqual(isop.objects(), [{name:'Alice',age:30, other:30}]);
  const isNot = filterRows(interp, { column:'age', operator:'IS NOT', value:25 }, data);
  assert.deepEqual(isNot.objects(), [
    {name:'Alice',age:30, other:30},
    {name:'Carl',age:35, other:35}
  ]);
});

test('filterRows evaluates grouped conditions', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([
    {name:'Alice',age:30},
    {name:'Bob',age:40},
    {name:'Carl',age:20}
  ]);
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
  assert.deepEqual(result.objects(), [{name:'Alice',age:30}]);
});

test('withColumn computes arithmetic expression', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([{a:1,b:2,c:3}]);
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
  assert.strictEqual(result.objects()[0].res, (1 + 2 * 2) / 3);
});

test('withColumn concatenates strings and literals', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([{a:'hi', b:'there'}]);
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
  assert.strictEqual(r1.objects()[0].greet, 'hithere');
  assert.strictEqual(r2.objects()[0].exclaim, 'hi!');
});

test('withColumn applies string functions', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([{name:' Alice '}]);
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
  assert.strictEqual(r1.objects()[0].lower, ' Alice '.toLowerCase());
  assert.strictEqual(r2.objects()[0].upper, ' Alice '.toUpperCase());
  assert.strictEqual(r3.objects()[0].trim, ' Alice '.trim());
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
    if (url.endsWith('exampleSales.csv')) {
      return { ok: true, text: async () => fs.readFileSync(path.join('examples', 'exampleSales.csv'), 'utf8') };
    }
    return { ok: false };
  };
  await interp.run(ast);
  global.fetch = originalFetch;
  global.Papa = originalPapa;
  assert.strictEqual(interp.peekOutputs.length, 0);
  assert.strictEqual(interp.stepOutputs.length, 21);
});

test('run records step outputs for each command', async () => {
  const script = `VAR "d"\nTHEN LOAD_CSV FILE "fake.csv"\nTHEN SELECT A`;
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.requestCsvFile = async () => ({ name: 'fake.csv' });
  global.Papa = {
    parse: (file, opts) => opts.complete({ data: [{A:1,B:2},{A:3,B:4}], meta:{ fields:['A','B'] } })
  };
  await interp.run(ast);
  assert.strictEqual(interp.stepOutputs.length, ast[0].pipeline.length + 1);
  assert.deepEqual(interp.stepOutputs[1].dataset.objects(), [{A:1},{A:3}]);
});

test('cached datasets persist between runs', async () => {
  const script = `VAR "d" THEN LOAD_CSV FILE "f.csv"`;
  const tokens = tokenizeForParser(script);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.requestCsvFile = async () => ({ name: 'f.csv' });

  const ds1 = from([{A:1}]);
  const ds2 = from([{A:2}]);
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
  assert.deepEqual(interp.stepOutputs[1].dataset.objects(), ds1.objects());

  await interp.run(ast);
  assert.deepEqual(interp.stepOutputs[1].dataset.objects(), ds1.objects()); // cached
  assert.strictEqual(callCount, 1);

  interp.executeCommand = originalExec;
});

test('join result updates when upstream step changes', async () => {
  const script1 = `VAR "cities" THEN LOAD_CSV FILE "c.csv" THEN WITH COLUMN city_of = "City of " + name THEN SELECT id, city_of\nVAR "people" THEN LOAD_CSV FILE "p.csv" THEN JOIN cities ON city_id=id TYPE "LEFT"`;
  const script2 = `VAR "cities" THEN LOAD_CSV FILE "c.csv" THEN WITH COLUMN city_of = "City of a " + name THEN SELECT id, city_of\nVAR "people" THEN LOAD_CSV FILE "p.csv" THEN JOIN cities ON city_id=id TYPE "LEFT"`;
  const ast1 = new Parser(tokenizeForParser(script1)).parse();
  const ast2 = new Parser(tokenizeForParser(script2)).parse();
  const interp = new Interpreter({ csvFileInputEl: {} });
  const { cities, people } = await import('../js/samples.js');
  const origExec = interp.executeCommand.bind(interp);
  interp.executeCommand = async function(node) {
    if (node.command === 'LOAD_CSV') {
      this.variables[this.activeVariableName] = this.activeVariableName === 'cities'
        ? from(cities.map(r => ({ ...r })))
        : from(people.map(r => ({ ...r }))); 
    } else {
      await origExec(node);
    }
  };

  await interp.run(ast1);
  const first = interp.stepOutputs.find(s => s.varName === 'people' && s.id.endsWith('final')).dataset.objects();

  await interp.run(ast2);
  const second = interp.stepOutputs.find(s => s.varName === 'people' && s.id.endsWith('final')).dataset.objects();

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
  const scriptD = `VAR "d" THEN LOAD_CSV FILE "f.csv"`;
  const scriptX = `VAR "x" THEN LOAD_CSV FILE "f.csv"`;
  const astD = new Parser(tokenizeForParser(scriptD)).parse();
  const astX = new Parser(tokenizeForParser(scriptX)).parse();
  const interp = new Interpreter({ csvFileInputEl: {} });
  interp.requestCsvFile = async () => ({ name: 'f.csv' });

  const orig = interp.executeCommand.bind(interp);
  interp.executeCommand = async function(node) {
    if (node.command === 'LOAD_CSV') {
      this.variables[this.activeVariableName] = from([{A:1}]);
    } else {
      await orig(node);
    }
  };

  await interp.run(astD);
  assert.strictEqual(interp.cache['d-0'].unusedCount, 0);

  await interp.run(astX);
  assert.strictEqual(interp.cache['d-0'].unusedCount, 1);

  await interp.run(astD);
  assert.strictEqual(interp.cache['d-0'].unusedCount, 0);

  interp.executeCommand = orig;
});

test('groupBy and aggregate summarize data', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([
    {cat:'A', val:1},
    {cat:'A', val:2},
    {cat:'B', val:3}
  ]);
  const g = groupBy(interp, { columns:['cat'] }, data);
  const result = aggregate(interp, { aggregates:[{func:'SUM', column:'val', as:'total'}, {func:'COUNT'}] }, g);
  const objs = result.objects();
  assert.deepEqual(objs, [
    {cat:'A', total:3, count:2},
    {cat:'B', total:3, count:1}
  ]);
});

test('sortDataset orders rows by multiple columns', () => {
  const interp = new Interpreter({});
  interp.activeVariableName = 'd';
  const data = from([
    {a:2,b:2},
    {a:1,b:3},
    {a:2,b:1}
  ]);
  const result = sortDataset(interp, { columns:[{column:'a', order:'DESC'}, {column:'b', order:'ASC'}] }, data);
  assert.deepEqual(result.objects(), [
    {a:2,b:1},
    {a:2,b:2},
    {a:1,b:3}
  ]);
});
