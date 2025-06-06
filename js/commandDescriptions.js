// js/commandDescriptions.js
// Generate human-readable descriptions for commands in the AST/DAG.

function filterExprToString(node) {
    if (!node) return '';
    if (node.type === 'AND' || node.type === 'OR') {
        const left = filterExprToString(node.left);
        const right = filterExprToString(node.right);
        return `${left} ${node.type} ${right}`.trim();
    }
    if (node.type === 'condition') {
        const val = node.value && typeof node.value === 'object' && node.value.type === 'COLUMN_REFERENCE'
            ? node.value.name
            : JSON.stringify(node.value);
        return `${node.column} ${node.operator} ${val}`;
    }
    return '';
}

export function describeCommand(cmd) {
    if (!cmd || !cmd.command) return '';
    const { command, args } = cmd;
    switch (command) {
        case 'LOAD_CSV':
            return args && args.file ? `Load CSV \"${args.file}\"` : 'Load CSV';
        case 'SELECT':
        case 'KEEP_COLUMNS':
            if (args && Array.isArray(args.columns)) {
                return `Keep columns: ${args.columns.join(', ')}`;
            }
            break;
        case 'DROP_COLUMNS':
            if (args && Array.isArray(args.columns)) {
                return `Drop columns: ${args.columns.join(', ')}`;
            }
            break;
        case 'WITH_COLUMN':
            if (args && args.columnName) {
                const expr = Array.isArray(args.expression)
                    ? args.expression.map(t => t.value).join(' ')
                    : '';
                return `With column ${args.columnName} = ${expr}`.trim();
            }
            break;
        case 'FILTER':
            return args ? `Filter where ${filterExprToString(args)}` : 'Filter';
        case 'JOIN':
            if (args) {
                const { variable, leftKey, rightKey, type } = args;
                let desc = `Join ${variable} on ${leftKey}`;
                if (rightKey && rightKey !== leftKey) desc += ` = ${rightKey}`;
                if (type) desc += ` (${type})`;
                return desc;
            }
            break;
        case 'GROUP_BY':
            if (args && Array.isArray(args.columns)) {
                return `Group by ${args.columns.join(', ')}`;
            }
            break;
        case 'AGGREGATE':
            if (args && Array.isArray(args.aggregates)) {
                const parts = args.aggregates.map(a => `${a.func}${a.column ? `(${a.column})` : ''}${a.as ? ` AS ${a.as}` : ''}`);
                return `Aggregate ${parts.join(', ')}`;
            }
            break;
        case 'SORT':
            if (args && Array.isArray(args.columns)) {
                const parts = args.columns.map(c => (c.order === 'ASC' ? '-' : '') + c.column);
                return `Sort by ${parts.join(', ')}`;
            }
            break;
        case 'EXPORT_CSV':
            return args && args.file ? `Export CSV to \"${args.file}\"` : 'Export CSV';
        case 'EXPORT_EXCEL':
            return args && args.file ? `Export Excel to \"${args.file}\"` : 'Export Excel';
        default:
            if (args && Object.keys(args).length > 0) {
                try {
                    return `${command} ${JSON.stringify(args)}`;
                } catch {
                    return command;
                }
            }
    }
    return command;
}

export { filterExprToString };
