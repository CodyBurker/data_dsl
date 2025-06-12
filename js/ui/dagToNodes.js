// js/ui/dagToNodes.js
// Convert interpreter DAG nodes into SpreadsheetUI node format

import { describeCommand } from '../commandDescriptions.js';

function simpleFilterParams(args) {
  if (!args || args.type !== 'condition') return null;
  return {
    column: args.column,
    operator: args.operator,
    value: args.value
  };
}

function mapNode(dagNode) {
  let type = null;
  let params = {};

  switch (dagNode.command) {
    case 'LOAD_CSV':
    case 'LOAD_JSON':
    case 'LOAD_EXCEL':
      type = 'UPLOAD';
      params = { ...dagNode.args, sourceType: dagNode.command };
      break;
    case 'SELECT':
    case 'KEEP_COLUMNS':
      type = 'SELECT_COLUMNS';
      params = { selectedColumns: dagNode.args.columns || [] };
      break;
    case 'RENAME_COLUMNS':
      type = 'RENAME_COLUMN';
      params = { renames: dagNode.args.mappings || [] };
      break;
    case 'FILTER': {
      const filt = simpleFilterParams(dagNode.args);
      if (filt) {
        type = 'FILTER';
        params = filt;
      }
      break;
    }
    default:
      break;
  }

  if (!type) return null;

  return {
    id: dagNode.id,
    type,
    command: dagNode.command,
    name: dagNode.description || dagNode.command,
    params
  };
}

export function dagToNodes(dag) {
  const pipelines = {};
  if (!Array.isArray(dag)) return pipelines;
  const byVar = {};
  for (const node of dag) {
    if (!byVar[node.varName]) byVar[node.varName] = [];
    byVar[node.varName].push(node);
  }
  for (const [varName, nodes] of Object.entries(byVar)) {
    nodes.sort((a, b) => {
      const ai = parseInt(a.id.split('-').pop(), 10);
      const bi = parseInt(b.id.split('-').pop(), 10);
      return ai - bi;
    });
    pipelines[varName] = nodes.map(mapNode).filter(Boolean);
  }
  return pipelines;
}

