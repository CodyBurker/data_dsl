// js/ui/nodesToDsl.js
// Convert SpreadsheetUI nodes back into PipeData DSL text

function quote(val) {
  if (val == null) return '""';
  if (typeof val === 'number') return String(val);
  if (/^\d+$/.test(val)) return val;
  return '"' + String(val).replace(/"/g, '\\"') + '"';
}

function serializeNode(node) {
  switch (node.type) {
    case 'UPLOAD': {
      const cmd = node.command || 'LOAD_CSV';
      if (cmd === 'LOAD_CSV') {
        return `LOAD_CSV FILE ${quote(node.params.file || '')}`;
      }
      if (cmd === 'LOAD_JSON') {
        const root = node.params.root ? ` ROOT ${quote(node.params.root)}` : '';
        return `LOAD_JSON FILE ${quote(node.params.file || '')}${root}`;
      }
      if (cmd === 'LOAD_EXCEL') {
        let extra = '';
        if (node.params.sheet != null) extra += ` SHEET ${quote(node.params.sheet)}`;
        if (node.params.range) extra += ` RANGE ${quote(node.params.range)}`;
        return `LOAD_EXCEL FILE ${quote(node.params.file || '')}${extra}`;
      }
      return `${cmd}`;
    }
    case 'FILTER': {
      const op = node.params.operator === '==' ? '=' : node.params.operator;
      return `FILTER ${node.params.column} ${op} ${quote(node.params.value)}`;
    }
    case 'SELECT_COLUMNS':
      return `SELECT ${node.params.selectedColumns.join(', ')}`;
    case 'RENAME_COLUMN': {
      const pairs = (node.params.renames || []).map(r => `${r.from} AS ${r.to}`).join(', ');
      return `RENAME_COLUMNS ${pairs}`;
    }
    default:
      return node.command || '';
  }
}

export function nodesToDsl(pipelines) {
  const blocks = [];
  for (const [varName, nodes] of Object.entries(pipelines)) {
    if (!nodes || nodes.length === 0) continue;
    const lines = [`VAR ${quote(varName)}`];
    for (const node of nodes) {
      lines.push('THEN ' + serializeNode(node));
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

