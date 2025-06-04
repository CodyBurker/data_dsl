// js/datasetOps.js

// Helper functions for dataset transformations. Like csv.js, each
// function expects the interpreter instance as the first argument so
// logging remains centralized.

export function keepColumns(interp, args, currentDataset) {
    const { columns } = args;
    if (!Array.isArray(columns)) {
        throw new Error(`Invalid columns argument for KEEP_COLUMNS in VAR "${interp.activeVariableName}".`);
    }
    if (!Array.isArray(currentDataset) || currentDataset.length === 0) {
        return [];
    }
    const allCols = Object.keys(currentDataset[0]);
    const columnsToKeep = columns.map(c => allCols.find(ac => ac.toLowerCase() === c.toLowerCase())).filter(Boolean);

    if (columnsToKeep.length === 0) {
        throw new Error(`None of the specified columns for KEEP_COLUMNS were found in VAR "${interp.activeVariableName}".`);
    }

    const newDataset = currentDataset.map(row => {
        const obj = {};
        columnsToKeep.forEach(col => { obj[col] = row[col]; });
        return obj;
    });
    interp.log(`Kept columns: ${columnsToKeep.join(', ')} for VAR "${interp.activeVariableName}".`);
    return newDataset;
}

export function withColumn(interp, args, currentDataset) {
    const { columnName, expression } = args;
    if (!Array.isArray(expression) || expression.length === 0) {
        throw new Error('WITH_COLUMN requires an expression.');
    }

    const evalExpr = (row) => {
        const exprStr = expression.map(t => {
            if (t.type === 'IDENTIFIER') return `row["${t.value}"]`;
            if (t.type === 'NUMBER_LITERAL') return t.value;
            if (t.type === 'OPERATOR' || (t.type === 'PUNCTUATION' && ['(', ')'].includes(t.value))) return t.value;
            throw new Error(`Unsupported token ${t.value} in expression`);
        }).join(' ');
        try {
            return Function('row', `return ${exprStr}`)(row);
        } catch (e) {
            throw new Error(`Error evaluating expression '${exprStr}': ${e.message}`);
        }
    };

    const result = currentDataset.map(row => ({ ...row, [columnName]: evalExpr(row) }));
    interp.log(`WITH_COLUMN '${columnName}' computed for VAR "${interp.activeVariableName}".`);
    return result;
}

export function filterRows(interp, condition, currentDataset) {
    const evalCondition = (node, row) => {
        if (!node) return false;
        if (node.type === 'AND') {
            return evalCondition(node.left, row) && evalCondition(node.right, row);
        }
        if (node.type === 'OR') {
            return evalCondition(node.left, row) || evalCondition(node.right, row);
        }
        const { column, operator = '=', value } = node;
        const getVal = () => {
            if (value && typeof value === 'object' && value.type === 'COLUMN_REFERENCE') {
                return row[value.name];
            }
            return value;
        };
        const a = row[column];
        const b = getVal();
        switch (operator) {
            case 'IS':
            case '=':
                return a === b;
            case 'IS NOT':
                return a !== b;
            case '!=':
                return a != b;
            case '>':
                return a > b;
            case '<':
                return a < b;
            case '>=':
                return a >= b;
            case '<=':
                return a <= b;
            case 'CONTAINS':
                return String(a).includes(String(b));
            case 'STARTSWITH':
                return String(a).startsWith(String(b));
            case 'ENDSWITH':
                return String(a).endsWith(String(b));
            default:
                throw new Error(`Unsupported operator ${operator}`);
        }
    };

    const filtered = currentDataset.filter(row => evalCondition(condition, row));
    interp.log(`FILTER kept ${filtered.length} of ${currentDataset.length} rows for VAR "${interp.activeVariableName}".`);
    return filtered;
}

export function joinDatasets(interp, args, currentDataset) {
    const { variable, leftKey, rightKey, type = 'INNER' } = args;
    const other = interp.variables[variable];
    if (!Array.isArray(other)) {
        throw new Error(`JOIN target VAR "${variable}" is not loaded or not an array.`);
    }
    if (!Array.isArray(currentDataset)) {
        throw new Error(`Current dataset for VAR "${interp.activeVariableName}" is not an array.`);
    }

    const map = new Map();
    for (const row of other) {
        if (row.hasOwnProperty(rightKey)) {
            const key = row[rightKey];
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        }
    }

    const joined = [];
    for (const lRow of currentDataset) {
        const key = lRow[leftKey];
        const matches = map.get(key);
        if (matches) {
            for (const rRow of matches) {
                joined.push({ ...lRow, ...rRow });
            }
        } else if (type === 'LEFT') {
            joined.push({ ...lRow });
        }
    }
    interp.log(`JOIN ${type} completed using '${leftKey}' = '${rightKey}' with VAR "${variable}". Rows: ${joined.length}`);
    return joined;
}

