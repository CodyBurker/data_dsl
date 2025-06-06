// js/datasetOps.js

// Helper functions for dataset transformations. Like csv.js, each
// function expects the interpreter instance as the first argument so
// logging remains centralized.
import { op, from } from 'arquero';

export function keepColumns(interp, args, currentDataset) {
    const { columns } = args;
    if (!Array.isArray(columns)) {
        throw new Error(`Invalid columns argument for KEEP_COLUMNS in VAR "${interp.activeVariableName}".`);
    }
    if (!currentDataset || typeof currentDataset.select !== 'function') {
        return currentDataset;
    }
    const allCols = currentDataset.columnNames();
    const columnsToKeep = columns.map(c => allCols.find(ac => ac.toLowerCase() === c.toLowerCase())).filter(Boolean);
    if (columnsToKeep.length === 0) {
        throw new Error(`None of the specified columns for KEEP_COLUMNS were found in VAR "${interp.activeVariableName}".`);
    }
    const newDataset = currentDataset.select(...columnsToKeep);
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

    const rows = currentDataset.objects();
    const newRows = rows.map(row => ({ ...row, [columnName]: evalExpr(row) }));
    const result = from(newRows);
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

    const filteredRows = currentDataset.objects().filter(r => evalCondition(condition, r));
    const filtered = from(filteredRows);
    interp.log(`FILTER kept ${filtered.numRows()} of ${currentDataset.numRows()} rows for VAR "${interp.activeVariableName}".`);
    return filtered;
}

export function joinDatasets(interp, args, currentDataset) {
    const { variable, leftKey, rightKey, type = 'INNER' } = args;
    const other = interp.variables[variable];
    if (!other || typeof other.join !== 'function') {
        throw new Error(`JOIN target VAR "${variable}" is not loaded or not a table.`);
    }
    if (!currentDataset || typeof currentDataset.join !== 'function') {
        throw new Error(`Current dataset for VAR "${interp.activeVariableName}" is not a table.`);
    }

    let joined;
    if (type === 'LEFT') {
        joined = currentDataset.join_left(other, [leftKey, rightKey]);
    } else {
        joined = currentDataset.join(other, [leftKey, rightKey]);
    }
    const cleaned = joined.objects().map(r => {
        const obj = {};
        for (const [k,v] of Object.entries(r)) if (v !== undefined) obj[k] = v;
        return obj;
    });
    const table = from(cleaned);
    interp.log(`JOIN ${type} completed using '${leftKey}' = '${rightKey}' with VAR "${variable}". Rows: ${table.numRows()}`);
    return table;
}
