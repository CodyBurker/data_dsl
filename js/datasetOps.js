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

    const tokensToJs = (tokens) => {
        let i = 0;
        const convert = () => {
            const out = [];
            while (i < tokens.length) {
                const t = tokens[i];
                if (t.type === 'IDENTIFIER') {
                    const upper = t.value.toUpperCase();
                    if (['LOWER', 'UPPER', 'TRIM'].includes(upper) && tokens[i+1] && tokens[i+1].type === 'PUNCTUATION' && tokens[i+1].value === '(') {
                        i += 2; // skip name and opening paren
                        const inner = [];
                        let depth = 1;
                        while (i < tokens.length && depth > 0) {
                            const tk = tokens[i];
                            if (tk.type === 'PUNCTUATION' && tk.value === '(') depth++;
                            else if (tk.type === 'PUNCTUATION' && tk.value === ')') {
                                depth--;
                                if (depth === 0) { i++; break; }
                            }
                            if (depth > 0) { inner.push(tk); i++; }
                        }
                        const argJs = tokensToJs(inner);
                        const js = upper === 'LOWER' ? `(String(${argJs}).toLowerCase())` :
                                   upper === 'UPPER' ? `(String(${argJs}).toUpperCase())` :
                                   `(String(${argJs}).trim())`;
                        out.push(js);
                        continue;
                    }
                    out.push(`row["${t.value}"]`);
                    i++;
                    continue;
                }
                if (t.type === 'NUMBER_LITERAL') { out.push(t.value); i++; continue; }
                if (t.type === 'STRING_LITERAL') { out.push(JSON.stringify(t.value)); i++; continue; }
                if (t.type === 'OPERATOR' || (t.type === 'PUNCTUATION' && ['(', ')'].includes(t.value))) { out.push(t.value); i++; continue; }
                throw new Error(`Unsupported token ${t.value} in expression`);
            }
            return out.join(' ');
        };
        return convert();
    };

    const exprStr = tokensToJs(expression);
    const evalExpr = (row) => {
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

export function renameColumn(interp, args, currentDataset) {
    const { oldName, newName } = args;
    if (!oldName || !newName) {
        throw new Error('RENAME_COLUMN requires oldName and newName.');
    }
    if (!Array.isArray(currentDataset) || currentDataset.length === 0) {
        return [];
    }
    if (!Object.prototype.hasOwnProperty.call(currentDataset[0], oldName)) {
        throw new Error(`Column '${oldName}' not found for RENAME_COLUMN in VAR "${interp.activeVariableName}".`);
    }
    const renamed = currentDataset.map(row => {
        const obj = { ...row };
        obj[newName] = obj[oldName];
        delete obj[oldName];
        return obj;
    });
    interp.log(`RENAME_COLUMN '${oldName}' to '${newName}' for VAR "${interp.activeVariableName}".`);
    return renamed;
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

