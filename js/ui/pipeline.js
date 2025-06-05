// js/ui/pipeline.js

// Simple node-based pipeline builder that reuses the existing Interpreter.
// Each pipeline node has a type and params. Users can select a node to
// configure it and preview the dataset at that point using the Interpreter's
// DAG cache. Pipelines can also sync with the text-based editor using
// the AST as an intermediate representation.

import { Parser } from '../parser.js';
import { tokenizeForParser } from '../tokenizer.js';

export const NodeTypes = {
    UPLOAD: 'UPLOAD',
    FILTER: 'FILTER',
    RENAME_COLUMN: 'RENAME_COLUMN',
    SELECT_COLUMNS: 'SELECT_COLUMNS'
};

const nodes = [];
let selectedIndex = null;
let interpreterInstance;

function renderList(listEl, configEl) {
    listEl.innerHTML = '';
    nodes.forEach((n, i) => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between rounded px-2 py-1 cursor-pointer';
        li.classList.add(i === selectedIndex ? 'bg-blue-200' : 'bg-gray-200');
        const span = document.createElement('span');
        span.textContent = `${i + 1}. ${n.type}`;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.className = 'text-xs text-red-600 ml-2';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            nodes.splice(i, 1);
            if (selectedIndex === i) selectedIndex = null;
            renderList(listEl, configEl);
            renderConfig(configEl, nodes[selectedIndex]);
        });
        li.addEventListener('click', () => {
            selectedIndex = i;
            renderList(listEl, configEl);
            renderConfig(configEl, nodes[i]);
            runAndShow(i);
        });
        li.appendChild(span);
        li.appendChild(removeBtn);
        listEl.appendChild(li);
    });
}

function renderTable(tableEl, data) {
    tableEl.innerHTML = '';
    if (!Array.isArray(data) || data.length === 0) {
        tableEl.textContent = 'No data';
        return;
    }
    const headers = Object.keys(data[0]);
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        th.className = 'border px-1';
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    const tbody = document.createElement('tbody');
    data.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            td.textContent = row[h];
            td.className = 'border px-1';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    tableEl.appendChild(thead);
    tableEl.appendChild(tbody);
}

function renderConfig(configEl, node) {
    if (!configEl) return;
    configEl.innerHTML = '';
    if (!node) {
        configEl.textContent = 'Select a step to configure';
        return;
    }
    const createInput = (labelText, key, value) => {
        const label = document.createElement('label');
        label.className = 'block text-xs text-gray-700 mt-1';
        label.textContent = labelText;
        const input = document.createElement('input');
        input.className = 'border rounded w-full px-1 text-xs';
        input.value = value || '';
        input.addEventListener('change', () => {
            if (key === 'columns') {
                node.params.columns = input.value.split(',').map(c => c.trim()).filter(Boolean);
            } else {
                node.params[key] = input.value;
            }
            runAndShow(selectedIndex);
        });
        label.appendChild(input);
        configEl.appendChild(label);
    };
    switch (node.type) {
        case NodeTypes.UPLOAD:
            createInput('File', 'file', node.params.file);
            break;
        case NodeTypes.FILTER:
            createInput('Column', 'column', node.params.column);
            createInput('Operator', 'operator', node.params.operator);
            createInput('Value', 'value', node.params.value);
            break;
        case NodeTypes.RENAME_COLUMN:
            createInput('Old Name', 'oldName', node.params.oldName);
            createInput('New Name', 'newName', node.params.newName);
            break;
        case NodeTypes.SELECT_COLUMNS:
            createInput('Columns (comma separated)', 'columns', node.params.columns ? node.params.columns.join(', ') : '');
            break;
    }
}

async function runAndShow(stepIndex) {
    const ast = buildAstFromNodes(nodes);
    await interpreterInstance.run(ast);
    showDataset(stepIndex);
}

function showDataset(stepIndex) {
    const tableEl = document.getElementById('pipelineDataTable');
    if (!tableEl) return;
    let dataset = interpreterInstance.variables.main || [];
    if (typeof stepIndex === 'number' && stepIndex >= 0 && stepIndex < nodes.length) {
        const stepId = `step-main-l${stepIndex + 1}-${stepIndex}`;
        const out = interpreterInstance.stepOutputs.find(o => o.id === stepId);
        if (out) dataset = out.dataset;
    } else {
        const finalId = 'step-main-l1-final';
        const out = interpreterInstance.stepOutputs.find(o => o.id === finalId);
        if (out) dataset = out.dataset;
    }
    renderTable(tableEl, dataset);
}

export function buildAstFromNodes(nodesInput) {
    const pipeline = [];
    nodesInput.forEach((n, idx) => {
        const line = idx + 1;
        switch (n.type) {
            case NodeTypes.UPLOAD:
                pipeline.push({ command: 'LOAD_CSV', args: { file: n.params.file }, line });
                break;
            case NodeTypes.FILTER:
                pipeline.push({ command: 'FILTER', args: n.params, line });
                break;
            case NodeTypes.RENAME_COLUMN:
                pipeline.push({ command: 'RENAME_COLUMN', args: n.params, line });
                break;
            case NodeTypes.SELECT_COLUMNS:
                pipeline.push({ command: 'SELECT', args: n.params, line });
                break;
        }
    });
    return [{ variableName: 'main', line: 1, pipeline }];
}

export function buildNodesFromAst(ast) {
    const result = [];
    if (!Array.isArray(ast) || ast.length === 0) return result;
    const block = ast[0];
    (block.pipeline || []).forEach(cmd => {
        switch (cmd.command) {
            case 'LOAD_CSV':
                result.push({ type: NodeTypes.UPLOAD, params: { file: cmd.args.file } });
                break;
            case 'FILTER':
                result.push({ type: NodeTypes.FILTER, params: cmd.args });
                break;
            case 'RENAME_COLUMN':
                result.push({ type: NodeTypes.RENAME_COLUMN, params: cmd.args });
                break;
            case 'SELECT':
                result.push({ type: NodeTypes.SELECT_COLUMNS, params: cmd.args });
                break;
        }
    });
    return result;
}

function quoteValue(val) {
    if (val == null) return '';
    if (typeof val === 'number') return String(val);
    const s = String(val);
    if (/\s/.test(s) || s.includes('"')) {
        return '"' + s.replace(/"/g, '\\"') + '"';
    }
    return s;
}

export function serializeAstToScript(ast) {
    if (!Array.isArray(ast)) return '';
    const lines = [];
    for (const block of ast) {
        lines.push(`VAR \"${block.variableName}\"`);
        for (const cmd of block.pipeline) {
            let line = '';
            switch (cmd.command) {
                case 'LOAD_CSV':
                    line = `LOAD_CSV FILE \"${cmd.args.file}\"`;
                    break;
                case 'FILTER':
                    line = `FILTER ${cmd.args.column} ${cmd.args.operator} ${quoteValue(cmd.args.value)}`;
                    break;
                case 'RENAME_COLUMN':
                    line = `RENAME_COLUMN ${cmd.args.oldName} TO ${cmd.args.newName}`;
                    break;
                case 'SELECT':
                    line = `SELECT ${cmd.args.columns.join(', ')}`;
                    break;
                default:
                    line = cmd.command;
            }
            lines.push(`THEN ${line}`);
        }
    }
    return lines.join('\n');
}

export function initPipelineUI(interpreter) {
    interpreterInstance = interpreter;
    const listEl = document.getElementById('nodePipelineList');
    const runBtn = document.getElementById('runPipelineButton');
    const addUpload = document.getElementById('addUploadStep');
    const addFilter = document.getElementById('addFilterStep');
    const addRename = document.getElementById('addRenameStep');
    const addSelect = document.getElementById('addSelectStep');
    const configEl = document.getElementById('nodeConfigContainer');
    const loadFromScriptBtn = document.getElementById('loadPipelineFromScript');
    const exportToScriptBtn = document.getElementById('exportPipelineToScript');

    if (!listEl || !runBtn) return;

    function addNode(type, params) {
        nodes.push({ type, params: params || {} });
        renderList(listEl, configEl);
    }

    addUpload?.addEventListener('click', () => {
        const file = prompt('CSV file name', 'exampleCities.csv');
        if (file) addNode(NodeTypes.UPLOAD, { file });
    });

    addFilter?.addEventListener('click', () => {
        const column = prompt('Column to filter');
        const operator = prompt('Operator (=, !=, >, <, >=, <=, CONTAINS)');
        const value = prompt('Value');
        if (column && operator) {
            addNode(NodeTypes.FILTER, { column, operator, value });
        }
    });

    addRename?.addEventListener('click', () => {
        const oldName = prompt('Old column name');
        const newName = prompt('New column name');
        if (oldName && newName) addNode(NodeTypes.RENAME_COLUMN, { oldName, newName });
    });

    addSelect?.addEventListener('click', () => {
        const cols = prompt('Columns to keep (comma separated)');
        if (cols) {
            const columns = cols.split(',').map(c => c.trim()).filter(Boolean);
            addNode(NodeTypes.SELECT_COLUMNS, { columns });
        }
    });

    runBtn.addEventListener('click', () => {
        selectedIndex = nodes.length; // final output
        runAndShow(selectedIndex);
    });

    loadFromScriptBtn?.addEventListener('click', () => {
        const input = document.getElementById('pipeDataInput');
        if (!input) return;
        const parser = new Parser(tokenizeForParser(input.value));
        const { ast, errors } = parser.parseAll();
        if (errors.length === 0) {
            nodes.length = 0;
            buildNodesFromAst(ast).forEach(n => nodes.push(n));
            selectedIndex = null;
            renderList(listEl, configEl);
            renderConfig(configEl, null);
        } else {
            alert('Script has errors. Unable to load pipeline.');
        }
    });

    exportToScriptBtn?.addEventListener('click', () => {
        const script = serializeAstToScript(buildAstFromNodes(nodes));
        const input = document.getElementById('pipeDataInput');
        if (input) {
            input.value = script;
            input.dispatchEvent(new Event('input'));
        }
    });

    renderList(listEl, configEl);
    renderConfig(configEl, null);
}
