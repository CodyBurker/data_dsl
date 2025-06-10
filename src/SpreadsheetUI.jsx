import React, { useState, useMemo, useEffect } from 'react';

// Simple ID generator for nodes
const generateId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

// Supported node types for the concept UI
const NODE_TYPES = {
  UPLOAD: 'UPLOAD',
  FILTER: 'FILTER',
  RENAME_COLUMN: 'RENAME_COLUMN',
  SELECT_COLUMNS: 'SELECT_COLUMNS'
};

// Dummy data used by the concept UI
const dummyDataSource = {
  headers: ['ID', 'Name', 'Age', 'City', 'Occupation', 'Salary'],
  data: [
    { ID: 1, Name: 'Alice', Age: 30, City: 'New York', Occupation: 'Engineer', Salary: 90000 },
    { ID: 2, Name: 'Bob', Age: 24, City: 'London', Occupation: 'Designer', Salary: 65000 },
    { ID: 3, Name: 'Charlie', Age: 35, City: 'Paris', Occupation: 'Manager', Salary: 105000 },
    { ID: 4, Name: 'Diana', Age: 28, City: 'Berlin', Occupation: 'Developer', Salary: 75000 },
    { ID: 5, Name: 'Edward', Age: 42, City: 'New York', Occupation: 'Analyst', Salary: 95000 },
    { ID: 6, Name: 'Fiona', Age: 29, City: 'London', Occupation: 'Developer', Salary: 72000 }
  ]
};

// Basic table for displaying dataset rows
function SpreadsheetTable({ data, headers }) {
  return (
    <table className="min-w-full text-sm text-left text-gray-200">
      <thead className="bg-gray-700">
        <tr>
          {headers.map(h => (
            <th key={h} className="px-2 py-1 font-semibold border-b border-gray-600">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx} className="odd:bg-gray-800">
            {headers.map(h => (
              <td key={h} className="px-2 py-1 border-b border-gray-700">{String(row[h] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function SpreadsheetUI({ nodes = null, onNodesChange = () => {} }) {
  const [originalData, setOriginalData] = useState([]);
  const [originalHeaders, setOriginalHeaders] = useState([]);
  const [pipelineNodes, setPipelineNodes] = useState(nodes || []); // {id,type,params,name}
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [viewNodeId, setViewNodeId] = useState(null);

  // Initialize with dummy dataset on mount if no nodes provided
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      setPipelineNodes(nodes);
      setActiveNodeId(nodes[0].id);
      setViewNodeId(nodes[0].id);
      return;
    }
    setOriginalData(dummyDataSource.data);
    setOriginalHeaders(dummyDataSource.headers);
    const uploadNode = {
      id: generateId(),
      type: NODE_TYPES.UPLOAD,
      name: 'Loaded: Dummy Dataset',
      params: {}
    };
    setPipelineNodes([uploadNode]);
    setActiveNodeId(uploadNode.id);
    setViewNodeId(uploadNode.id);
  }, [nodes]);

  useEffect(() => {
    onNodesChange(pipelineNodes);
  }, [pipelineNodes, onNodesChange]);

  // Compute processed data for each node
  const processedDataHistory = useMemo(() => {
    if (!originalData.length) return {};
    const history = {};
    const upload = pipelineNodes[0];
    if (upload && upload.type === NODE_TYPES.UPLOAD) {
      history[upload.id] = { data: [...originalData], headers: [...originalHeaders] };
    }

    for (let i = 1; i < pipelineNodes.length; i++) {
      const node = pipelineNodes[i];
      const prevNode = pipelineNodes[i - 1];
      const input = history[prevNode.id];
      if (!input) continue;
      let data = [...input.data];
      let headers = [...input.headers];

      switch (node.type) {
        case NODE_TYPES.FILTER:
          data = data.filter(row => {
            const v = row[node.params.column];
            const c = node.params.value;
            switch (node.params.operator) {
              case '==': return v == c;
              case '!=': return v != c;
              case '>': return parseFloat(v) > parseFloat(c);
              case '<': return parseFloat(v) < parseFloat(c);
              case '>=': return parseFloat(v) >= parseFloat(c);
              case '<=': return parseFloat(v) <= parseFloat(c);
              case 'contains': return String(v).toLowerCase().includes(String(c).toLowerCase());
              default: return true;
            }
          });
          break;
        case NODE_TYPES.RENAME_COLUMN:
          const renameMap = {};
          for (const r of node.params.renames) {
            if (r.from && r.to) renameMap[r.from] = r.to;
          }
          headers = headers.map(h => renameMap[h] || h);
          data = data.map(row => {
            const newRow = {};
            for (const key of Object.keys(row)) {
              newRow[renameMap[key] || key] = row[key];
            }
            return newRow;
          });
          break;
        case NODE_TYPES.SELECT_COLUMNS:
          headers = headers.filter(h => node.params.selectedColumns.includes(h));
          data = data.map(row => {
            const newRow = {};
            for (const h of node.params.selectedColumns) newRow[h] = row[h];
            return newRow;
          });
          break;
        default:
          break;
      }
      history[node.id] = { data, headers };
    }
    return history;
  }, [pipelineNodes, originalData, originalHeaders]);

  const currentView = processedDataHistory[viewNodeId] || { data: [], headers: [] };

  const addNode = type => {
    const lastNode = pipelineNodes[pipelineNodes.length - 1];
    const lastHeaders = processedDataHistory[lastNode.id]?.headers || originalHeaders;
    let params = {};
    let name = '';
    switch (type) {
      case NODE_TYPES.FILTER:
        params = { column: lastHeaders[0] || '', operator: '==', value: '' };
        name = 'New Filter';
        break;
      case NODE_TYPES.RENAME_COLUMN:
        params = { renames: [{ from: lastHeaders[0] || '', to: '' }] };
        name = 'New Rename';
        break;
      case NODE_TYPES.SELECT_COLUMNS:
        params = { selectedColumns: [...lastHeaders] };
        name = 'New Select';
        break;
      default:
        return;
    }
    const id = generateId();
    const node = { id, type, params, name };
    setPipelineNodes(nodes => [...nodes, node]);
    setActiveNodeId(id);
    setViewNodeId(id);
  };

  const updateNodeParams = (id, updates) => {
    setPipelineNodes(nodes => nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const removeNode = id => {
    const idx = pipelineNodes.findIndex(n => n.id === id);
    if (idx <= 0) return; // don't remove upload
    const newNodes = pipelineNodes.filter(n => n.id !== id);
    setPipelineNodes(newNodes);
    const nextActive = newNodes[Math.max(0, idx - 1)];
    setActiveNodeId(nextActive.id);
    setViewNodeId(nextActive.id);
  };

  const NodeConfigPanel = () => {
    const node = pipelineNodes.find(n => n.id === activeNodeId);
    if (!node || node.type === NODE_TYPES.UPLOAD) return null;

    const lastNode = pipelineNodes.findIndex(n => n.id === node.id);
    const prevId = lastNode > 0 ? pipelineNodes[lastNode - 1].id : null;
    const inputHeaders = prevId ? (processedDataHistory[prevId]?.headers || originalHeaders) : originalHeaders;

    const handleParamChange = (name, value) => {
      updateNodeParams(node.id, { params: { ...node.params, [name]: value } });
    };

    const handleRenameChange = (i, field, value) => {
      const renames = [...node.params.renames];
      renames[i][field] = value;
      updateNodeParams(node.id, { params: { ...node.params, renames } });
    };

    const addRenamePair = () => {
      const renames = [...node.params.renames, { from: inputHeaders[0] || '', to: '' }];
      updateNodeParams(node.id, { params: { ...node.params, renames } });
    };

    const removeRenamePair = i => {
      const renames = node.params.renames.filter((_, idx) => idx !== i);
      updateNodeParams(node.id, { params: { ...node.params, renames } });
    };

    return (
      <div className="bg-gray-800 p-3 rounded-lg shadow mt-2">
        <h3 className="text-gray-100 font-semibold mb-2">Edit Node</h3>
        <input
          type="text"
          className="w-full p-2 mb-2 rounded bg-gray-700 text-gray-100"
          value={node.name}
          onChange={e => updateNodeParams(node.id, { name: e.target.value })}
        />
        {node.type === NODE_TYPES.FILTER && (
          <>
            <label className="block text-sm text-gray-300 mb-1">Column</label>
            <select
              value={node.params.column}
              onChange={e => handleParamChange('column', e.target.value)}
              className="w-full p-2 mb-2 rounded bg-gray-700 text-gray-100"
            >
              {inputHeaders.map(h => (<option key={h} value={h}>{h}</option>))}
            </select>
            <label className="block text-sm text-gray-300 mb-1">Operator</label>
            <select
              value={node.params.operator}
              onChange={e => handleParamChange('operator', e.target.value)}
              className="w-full p-2 mb-2 rounded bg-gray-700 text-gray-100"
            >
              {['==','!=','>','<','>=','<=','contains'].map(op => (<option key={op} value={op}>{op}</option>))}
            </select>
            <label className="block text-sm text-gray-300 mb-1">Value</label>
            <input
              type="text"
              value={node.params.value}
              onChange={e => handleParamChange('value', e.target.value)}
              className="w-full p-2 mb-2 rounded bg-gray-700 text-gray-100"
            />
          </>
        )}
        {node.type === NODE_TYPES.RENAME_COLUMN && (
          <div className="space-y-2">
            {node.params.renames.map((r, i) => (
              <div key={i} className="flex items-center space-x-2">
                <select
                  value={r.from}
                  onChange={e => handleRenameChange(i, 'from', e.target.value)}
                  className="p-2 bg-gray-700 rounded text-gray-100"
                >
                  {inputHeaders.map(h => (<option key={h} value={h}>{h}</option>))}
                </select>
                <span className="text-gray-400">→</span>
                <input
                  type="text"
                  value={r.to}
                  onChange={e => handleRenameChange(i, 'to', e.target.value)}
                  className="p-2 bg-gray-700 rounded text-gray-100"
                />
                <button className="text-red-400" onClick={() => removeRenamePair(i)}>x</button>
              </div>
            ))}
            <button className="text-sm underline" onClick={addRenamePair}>Add Pair</button>
          </div>
        )}
        {node.type === NODE_TYPES.SELECT_COLUMNS && (
          <div className="space-y-1">
            {inputHeaders.map(h => (
              <label key={h} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={node.params.selectedColumns.includes(h)}
                  onChange={e => {
                    const cols = node.params.selectedColumns.includes(h)
                      ? node.params.selectedColumns.filter(c => c !== h)
                      : [...node.params.selectedColumns, h];
                    handleParamChange('selectedColumns', cols);
                  }}
                />
                <span>{h}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="space-x-2">
          <button className="bg-gray-700 text-gray-100 px-3 py-1 rounded" onClick={() => addNode(NODE_TYPES.FILTER)}>Add Filter</button>
          <button className="bg-gray-700 text-gray-100 px-3 py-1 rounded" onClick={() => addNode(NODE_TYPES.RENAME_COLUMN)}>Add Rename</button>
          <button className="bg-gray-700 text-gray-100 px-3 py-1 rounded" onClick={() => addNode(NODE_TYPES.SELECT_COLUMNS)}>Add Select</button>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/4 space-y-2">
          <div className="bg-gray-800 p-3 rounded-lg shadow overflow-y-auto max-h-64">
            <h2 className="text-gray-100 font-semibold mb-2">Pipeline</h2>
            <ul className="space-y-1">
              {pipelineNodes.map(n => (
                <li
                  key={n.id}
                  className={`p-2 rounded cursor-pointer ${activeNodeId === n.id ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  onClick={() => { setActiveNodeId(n.id); setViewNodeId(n.id); }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-100 text-sm truncate" title={n.name}>{n.name}</span>
                    {n.type !== NODE_TYPES.UPLOAD && (
                      <button className="text-red-300 ml-2" onClick={e => { e.stopPropagation(); removeNode(n.id); }}>x</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <NodeConfigPanel />
        </div>
        <div className="flex-1 overflow-auto bg-gray-800 rounded-lg p-3">
          <SpreadsheetTable data={currentView.data} headers={currentView.headers} />
        </div>
      </div>
    </div>
  );
}
