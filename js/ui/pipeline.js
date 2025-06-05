// js/ui/pipeline.js

// Simple node-based pipeline builder that reuses the existing Interpreter.
// Each pipeline node has a type and params. The UI provides buttons to add
// nodes and a Run button to execute the pipeline using the interpreter.

export const NodeTypes = {
    UPLOAD: 'UPLOAD',
    FILTER: 'FILTER',
    RENAME_COLUMN: 'RENAME_COLUMN',
    SELECT_COLUMNS: 'SELECT_COLUMNS'
};

const nodes = [];

function renderList(listEl) {
    listEl.innerHTML = '';
    nodes.forEach((n, i) => {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between bg-gray-200 rounded px-2 py-1';
        const span = document.createElement('span');
        span.textContent = `${i + 1}. ${n.type}`;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.className = 'text-xs text-red-600 ml-2';
        removeBtn.addEventListener('click', () => {
            nodes.splice(i, 1);
            renderList(listEl);
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

export function initPipelineUI(interpreter) {
    const listEl = document.getElementById('nodePipelineList');
    const runBtn = document.getElementById('runPipelineButton');
    const addUpload = document.getElementById('addUploadStep');
    const addFilter = document.getElementById('addFilterStep');
    const addRename = document.getElementById('addRenameStep');
    const addSelect = document.getElementById('addSelectStep');
    const tableEl = document.getElementById('pipelineDataTable');

    if (!listEl || !runBtn) return;

    function addNode(type, params) {
        nodes.push({ type, params: params || {} });
        renderList(listEl);
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

    runBtn.addEventListener('click', async () => {
        const ast = buildAstFromNodes(nodes);
        await interpreter.run(ast);
        if (tableEl) {
            const data = interpreter.variables.main;
            renderTable(tableEl, data);
        }
    });

    renderList(listEl);
}
