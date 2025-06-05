import React, { useState, useMemo, useEffect } from 'react';
import { FileUp, Filter, Edit3, Columns, Trash2, ChevronRight, Settings2, PlusCircle, Eye } from 'lucide-react';

// Helper to generate unique IDs
const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Initial Node Types
const NODE_TYPES = {
  UPLOAD: 'UPLOAD',
  FILTER: 'FILTER',
  RENAME_COLUMN: 'RENAME_COLUMN',
  SELECT_COLUMNS: 'SELECT_COLUMNS',
};

const NODE_ICONS = {
  UPLOAD: <FileUp className="w-5 h-5 mr-2" />,
  FILTER: <Filter className="w-5 h-5 mr-2" />,
  RENAME_COLUMN: <Edit3 className="w-5 h-5 mr-2" />,
  SELECT_COLUMNS: <Columns className="w-5 h-5 mr-2" />,
};

const NODE_DESCRIPTIONS = {
  UPLOAD: "Represents the initial loaded dataset.",
  FILTER: "Filters rows based on a column's value.",
  RENAME_COLUMN: "Renames one or more columns.",
  SELECT_COLUMNS: "Selects a subset of columns to keep.",
};

// Dummy Data Source
const dummyDataSource = {
  headers: ["ID", "Name", "Age", "City", "Occupation", "Salary"],
  data: [
    { "ID": 1, "Name": "Alice", "Age": 30, "City": "New York", "Occupation": "Engineer", "Salary": 90000 },
    { "ID": 2, "Name": "Bob", "Age": 24, "City": "London", "Occupation": "Designer", "Salary": 65000 },
    { "ID": 3, "Name": "Charlie", "Age": 35, "City": "Paris", "Occupation": "Manager", "Salary": 105000 },
    { "ID": 4, "Name": "Diana", "Age": 28, "City": "Berlin", "Occupation": "Developer", "Salary": 75000 },
    { "ID": 5, "Name": "Edward", "Age": 42, "City": "New York", "Occupation": "Analyst", "Salary": 95000 },
    { "ID": 6, "Name": "Fiona", "Age": 29, "City": "London", "Occupation": "Developer", "Salary": 72000 },
    { "ID": 7, "Name": "George", "Age": 38, "City": "New York", "Occupation": "Manager", "Salary": 110000 },
    { "ID": 8, "Name": "Hannah", "Age": 22, "City": "Berlin", "Occupation": "Intern", "Salary": 30000 },
  ]
};


// Main Application Component
function App() {
  const [originalData, setOriginalData] = useState([]);
  const [originalHeaders, setOriginalHeaders] = useState([]);
  const [pipelineNodes, setPipelineNodes] = useState([]); // { id, type, params, name }
  
  const [activeNodeId, setActiveNodeId] = useState(null); 
  const [viewNodeId, setViewNodeId] = useState(null); 

  const [error, setError] = useState('');

  // --- Load Dummy Data on Mount ---
  useEffect(() => {
    setError('');
    setOriginalData(dummyDataSource.data);
    setOriginalHeaders(dummyDataSource.headers);
    
    const uploadNode = {
      id: generateId(),
      type: NODE_TYPES.UPLOAD,
      name: `Loaded: Dummy Dataset`,
      params: { dataSourceName: "Internal Dummy Data" },
    };
    setPipelineNodes([uploadNode]);
    setActiveNodeId(uploadNode.id); 
    setViewNodeId(uploadNode.id); 
  }, []);


  // --- Data Processing Logic ---
  const processedDataHistory = useMemo(() => {
    if (!originalData.length) return {};
    
    // Initialize history with the UPLOAD node's data (original data)
    const uploadNode = pipelineNodes.find(node => node.type === NODE_TYPES.UPLOAD);
    const history = uploadNode ? 
        { [uploadNode.id]: { data: [...originalData], headers: [...originalHeaders] } } 
        : {};
    
    // Iterate over nodes that are NOT the UPLOAD node, or all if no UPLOAD node (should not happen)
    const nodesToProcess = uploadNode 
        ? pipelineNodes.filter(node => node.id !== uploadNode.id)
        : pipelineNodes;

    nodesToProcess.forEach(node => {
      const nodeIndex = pipelineNodes.findIndex(pn => pn.id === node.id);
      // Determine the ID of the previous node in the full pipeline
      const prevNodeInPipelineId = nodeIndex > 0 ? pipelineNodes[nodeIndex - 1].id : null;

      let currentData;
      let currentHeaders;

      if (prevNodeInPipelineId && history[prevNodeInPipelineId]) {
          if (history[prevNodeInPipelineId].error) {
              console.error("Previous node had an error, skipping current node:", node.id);
              history[node.id] = { data: [], headers: [], error: true, errorMessage: "Upstream error in previous node." };
              return; // Skip processing this node
          }
          currentData = [...history[prevNodeInPipelineId].data];
          currentHeaders = [...history[prevNodeInPipelineId].headers];
      } else if (!prevNodeInPipelineId && uploadNode) { 
          // This case should ideally not be hit if nodesToProcess filters out the uploadNode
          // However, if it's the first *operational* node, its input is the UPLOAD node's output.
          currentData = [...originalData];
          currentHeaders = [...originalHeaders];
      }
       else {
          console.error("Could not find input data for node:", node.id);
          history[node.id] = { data: [], headers: [], error: true, errorMessage: "Missing input data stream." };
          return; 
      }

      try {
        let processedNodeData = [...currentData];
        let processedNodeHeaders = [...currentHeaders]; // Start with headers from previous step

        switch (node.type) {
          case NODE_TYPES.FILTER:
            if (node.params.column && node.params.operator && node.params.value !== undefined) {
              processedNodeData = processedNodeData.filter(row => {
                const val = row[node.params.column];
                const compareVal = node.params.value;
                const numVal = parseFloat(val);
                const numCompareVal = parseFloat(compareVal);

                switch (node.params.operator) {
                  case '==': return val == compareVal;
                  case '!=': return val != compareVal;
                  case '>': return !isNaN(numVal) && !isNaN(numCompareVal) ? numVal > numCompareVal : String(val) > String(compareVal);
                  case '<': return !isNaN(numVal) && !isNaN(numCompareVal) ? numVal < numCompareVal : String(val) < String(compareVal);
                  case '>=': return !isNaN(numVal) && !isNaN(numCompareVal) ? numVal >= numCompareVal : String(val) >= String(compareVal);
                  case '<=': return !isNaN(numVal) && !isNaN(numCompareVal) ? numVal <= numCompareVal : String(val) <= String(compareVal);
                  case 'contains': return String(val).toLowerCase().includes(String(compareVal).toLowerCase());
                  case 'startsWith': return String(val).toLowerCase().startsWith(String(compareVal).toLowerCase());
                  case 'endsWith': return String(val).toLowerCase().endsWith(String(compareVal).toLowerCase());
                  default: return true;
                }
              });
            }
            // Headers don't change for a filter operation
            break;
          case NODE_TYPES.RENAME_COLUMN:
            if (node.params.renames && node.params.renames.length > 0) {
              const renameMap = node.params.renames.reduce((acc, r) => {
                if (r.from && r.to) acc[r.from] = r.to;
                return acc;
              }, {});
              
              processedNodeHeaders = currentHeaders.map(h => renameMap[h] || h);
              processedNodeData = currentData.map(row => {
                const newRow = {};
                for (const key in row) {
                  newRow[renameMap[key] || key] = row[key];
                }
                return newRow;
              });
            }
            break;
          case NODE_TYPES.SELECT_COLUMNS:
            if (node.params.selectedColumns && node.params.selectedColumns.length > 0) {
              // Update headers: these are the headers that will exist *after* this node's operation.
              // node.params.selectedColumns contains the names of columns from the *input* (currentHeaders) to this node that should be kept.
              processedNodeHeaders = currentHeaders.filter(h => node.params.selectedColumns.includes(h));

              // Then, map the data rows to include only these selected columns.
              processedNodeData = currentData.map(row => {
                // For each row from the input data (currentData),
                // create a new object that only contains the keys specified in node.params.selectedColumns.
                return node.params.selectedColumns.reduce((newRowObject, columnName) => {
                  if (row.hasOwnProperty(columnName)) {
                    newRowObject[columnName] = row[columnName];
                  }
                  return newRowObject;
                }, {}); // Initial value for reduce is an empty object for the new row.
              });
            }
            break;
          default:
            // If an unknown node type, pass data through or handle as error
            console.warn("Unknown node type:", node.type);
            break;
        }
        history[node.id] = { data: [...processedNodeData], headers: [...processedNodeHeaders] };
      } catch (e) {
        console.error("Error processing node:", node.id, e);
        setError(`Error processing node ${node.name || node.type}: ${e.message}`);
        // Store error state for this node, keeping input data as a fallback for display if needed, or empty
        history[node.id] = { data: [...currentData], headers: [...currentHeaders], error: true, errorMessage: e.message };
      }
    });
    return history;
  }, [originalData, originalHeaders, pipelineNodes]);


  const displayData = useMemo(() => {
    const viewingNode = pipelineNodes.find(n => n.id === viewNodeId);
    if (viewingNode && processedDataHistory[viewingNode.id]) {
      return processedDataHistory[viewingNode.id];
    }
    // Fallback if viewNodeId is somehow invalid or not in history (e.g. before processing)
    // If viewing the UPLOAD node specifically, and it's the only one or first.
    if (viewingNode && viewingNode.type === NODE_TYPES.UPLOAD) {
        return { data: originalData, headers: originalHeaders };
    }
    return { data: [], headers: [] };
  }, [viewNodeId, processedDataHistory, originalData, originalHeaders, pipelineNodes]);


  const addNode = (type) => {
    let params = {};
    let name = '';
    const lastNodeInPipeline = pipelineNodes[pipelineNodes.length - 1];
    const lastNodeId = lastNodeInPipeline?.id;
    
    let inputHeadersForNewNode = originalHeaders; 
    if (lastNodeId && processedDataHistory[lastNodeId] && !processedDataHistory[lastNodeId].error) {
        inputHeadersForNewNode = processedDataHistory[lastNodeId].headers;
    } else if (lastNodeInPipeline?.type === NODE_TYPES.UPLOAD) { 
        inputHeadersForNewNode = originalHeaders;
    }


    switch (type) {
      case NODE_TYPES.FILTER:
        name = 'New Filter';
        params = { column: inputHeadersForNewNode[0] || '', operator: '==', value: '' };
        break;
      case NODE_TYPES.RENAME_COLUMN:
        name = 'New Rename';
        params = { renames: [{ from: inputHeadersForNewNode[0] || '', to: '' }] };
        break;
      case NODE_TYPES.SELECT_COLUMNS:
        name = 'New Select Columns';
        params = { selectedColumns: [...inputHeadersForNewNode] };
        break;
      default:
        return;
    }
    const newNode = { id: generateId(), type, params, name };
    setPipelineNodes(prevNodes => [...prevNodes, newNode]);
    setActiveNodeId(newNode.id);
    setViewNodeId(newNode.id); 
  };

  const updateNodeParams = (nodeId, newParamsOrName) => { 
    setPipelineNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === nodeId ? { ...node, ...newParamsOrName } : node
      )
    );
  };

  const removeNode = (nodeIdToRemove) => {
    const nodeIndex = pipelineNodes.findIndex(node => node.id === nodeIdToRemove);
    if (pipelineNodes[nodeIndex]?.type === NODE_TYPES.UPLOAD && pipelineNodes.length === 1) {
        setError("Cannot remove the base data source node.");
        return;
    }

    const newPipelineNodes = pipelineNodes.filter(node => node.id !== nodeIdToRemove);
    setPipelineNodes(newPipelineNodes);
    
    if (activeNodeId === nodeIdToRemove) {
      if (newPipelineNodes.length === 0) {
        setActiveNodeId(null);
        setViewNodeId(null); // Or some default view like "original" if that concept is reinstated
      } else if (nodeIndex > 0) { // If not the first node removed
        setActiveNodeId(newPipelineNodes[Math.max(0, nodeIndex - 1)].id);
        setViewNodeId(newPipelineNodes[Math.max(0, nodeIndex - 1)].id);
      } else { // First node removed, select the new first node
         setActiveNodeId(newPipelineNodes[0].id);
         setViewNodeId(newPipelineNodes[0].id);
      }
    } else if (viewNodeId === nodeIdToRemove) {
        if (newPipelineNodes.length === 0) {
            setViewNodeId(null);
        } else if (nodeIndex > 0) {
            setViewNodeId(newPipelineNodes[Math.max(0, nodeIndex - 1)].id);
        } else {
            setViewNodeId(newPipelineNodes[0].id);
        }
    }
  };

  const handleViewNodeData = (nodeId) => {
    setViewNodeId(nodeId);
  };
  
  const handleEditNode = (nodeId) => {
    const nodeToEdit = pipelineNodes.find(n => n.id === nodeId);
    // Allow setting UPLOAD node as active to see its info panel, but it won't have editable params like others
    if (nodeToEdit) { 
        setActiveNodeId(nodeId);
    }
  }

  // --- Child Components ---

  const NodeConfigPanel = () => {
    const node = pipelineNodes.find(n => n.id === activeNodeId);
    if (!node) return (
        <div className="p-4 bg-gray-700 rounded-lg shadow mt-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Node Configuration</h3>
            <p className="text-gray-300">Select a node from the pipeline to configure its parameters.</p>
        </div>
    );
    
    if (node.type === NODE_TYPES.UPLOAD) return (
        <div className="p-4 bg-gray-700 rounded-lg shadow mt-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-1">Node Details:</h3>
             <input 
                type="text"
                value={node.name}
                readOnly 
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-100 mb-3 text-base font-semibold cursor-not-allowed"
            />
            <p className="text-gray-300">{NODE_DESCRIPTIONS[node.type]}</p>
            {node.params.dataSourceName && (
                <p className="text-sm text-gray-400 mt-2">Source: {node.params.dataSourceName}</p>
            )}
        </div>
    );

    const nodeIndex = pipelineNodes.findIndex(n => n.id === activeNodeId);
    const prevNodeId = nodeIndex > 0 ? pipelineNodes[nodeIndex - 1].id : null;
    
    let currentInputHeaders = originalHeaders; // Default for safety or if it's the first operational node after UPLOAD
    if (prevNodeId && processedDataHistory[prevNodeId] && !processedDataHistory[prevNodeId].error) {
        currentInputHeaders = processedDataHistory[prevNodeId].headers;
    } else if (nodeIndex === 0 && pipelineNodes[0]?.type === NODE_TYPES.UPLOAD) { // Should not happen if UPLOAD node is not configurable here
        currentInputHeaders = originalHeaders;
    } else if (nodeIndex > 0 && pipelineNodes[0]?.type === NODE_TYPES.UPLOAD && nodeIndex === 1) {
        // If this is the first node *after* the UPLOAD node
        currentInputHeaders = originalHeaders;
    }


    const handleParamChange = (paramName, value) => {
      updateNodeParams(activeNodeId, { params: { ...node.params, [paramName]: value } });
    };
    
    const handleNameChange = (newName) => {
        updateNodeParams(activeNodeId, { name: newName });
    };

    const renderFilterConfig = () => (
      <>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">Column to Filter</label>
          <select
            value={node.params.column}
            onChange={(e) => handleParamChange('column', e.target.value)}
            className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">-- Select Column --</option>
            {currentInputHeaders.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">Operator</label>
          <select
            value={node.params.operator}
            onChange={(e) => handleParamChange('operator', e.target.value)}
            className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {['==', '!=', '>', '<', '>=', '<=', 'contains', 'startsWith', 'endsWith'].map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">Value</label>
          <input
            type="text"
            value={node.params.value}
            onChange={(e) => handleParamChange('value', e.target.value)}
            className="w-full p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </>
    );

    const handleRenameChange = (index, field, value) => {
      const newRenames = [...node.params.renames];
      newRenames[index][field] = value;
      updateNodeParams(activeNodeId, { params: { ...node.params, renames: newRenames } });
    };

    const addRenamePair = () => {
      const newRenames = [...node.params.renames, { from: currentInputHeaders[0] || '', to: '' }];
      updateNodeParams(activeNodeId, { params: { ...node.params, renames: newRenames } });
    };
    
    const removeRenamePair = (index) => {
      const newRenames = node.params.renames.filter((_, i) => i !== index);
      updateNodeParams(activeNodeId, { params: { ...node.params, renames: newRenames } });
    };

    const renderRenameConfig = () => (
      <>
        {node.params.renames.map((rename, index) => (
          <div key={index} className="flex items-center space-x-2 mb-2">
            <select
              value={rename.from}
              onChange={(e) => handleRenameChange(index, 'from', e.target.value)}
              className="w-1/2 p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">-- Original Column --</option>
              {currentInputHeaders.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <ChevronRight className="text-gray-400"/>
            <input
              type="text"
              placeholder="New Name"
              value={rename.to}
              onChange={(e) => handleRenameChange(index, 'to', e.target.value)}
              className="w-1/2 p-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button onClick={() => removeRenamePair(index)} className="p-1 text-red-400 hover:text-red-300">
                <Trash2 size={18}/>
            </button>
          </div>
        ))}
        <button onClick={addRenamePair} className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 flex items-center">
          <PlusCircle size={16} className="mr-1"/> Add Rename Rule
        </button>
      </>
    );

    const handleSelectColumnsChange = (columnName) => {
      const newSelectedColumns = node.params.selectedColumns.includes(columnName)
        ? node.params.selectedColumns.filter(c => c !== columnName)
        : [...node.params.selectedColumns, columnName];
      updateNodeParams(activeNodeId, { params: { ...node.params, selectedColumns: newSelectedColumns } });
    };

    const renderSelectColumnsConfig = () => (
      <div className="space-y-1">
        <p className="text-sm text-gray-400 mb-2">Select columns to keep (based on this node's input):</p>
        {currentInputHeaders.map(header => (
          <label key={header} className="flex items-center space-x-2 p-1.5 hover:bg-gray-650 rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={node.params.selectedColumns.includes(header)}
              onChange={() => handleSelectColumnsChange(header)}
              className="form-checkbox h-4 w-4 text-indigo-500 bg-gray-600 border-gray-500 rounded focus:ring-indigo-400"
            />
            <span className="text-gray-200">{header}</span>
          </label>
        ))}
         {currentInputHeaders.length === 0 && <p className="text-xs text-gray-500">No input columns available for selection.</p>}
      </div>
    );

    return (
      <div className="p-4 bg-gray-700 rounded-lg shadow mt-4">
        <h3 className="text-lg font-semibold text-gray-100 mb-1">Configure Node:</h3>
        <input 
            type="text"
            value={node.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-gray-100 mb-3 text-base font-semibold"
            placeholder="Node Name"
        />
        {node.type === NODE_TYPES.FILTER && renderFilterConfig()}
        {node.type === NODE_TYPES.RENAME_COLUMN && renderRenameConfig()}
        {node.type === NODE_TYPES.SELECT_COLUMNS && renderSelectColumnsConfig()}
      </div>
    );
  };

  const SpreadsheetTable = ({ data, headers, nodeError, nodeErrorMessage, nodeName }) => {
    if (nodeError) {
        return <div className="p-4 text-red-300 bg-red-800 bg-opacity-30 rounded-md h-full flex flex-col justify-center items-center">
            <h3 className="text-lg font-semibold mb-2">Error in Data Processing</h3>
            <p className="text-sm">Could not display data for node: <span className="font-medium">{nodeName}</span>.</p>
            <p className="text-xs mt-1">Details: {nodeErrorMessage || "An unspecified error occurred."}</p>
        </div>;
    }

    if (!data || data.length === 0) {
        if (originalData.length > 0 || pipelineNodes.length > 0) { 
             return <div className="p-4 text-gray-400 h-full flex justify-center items-center">Selected operation resulted in no data.</div>;
        }
        return <div className="p-4 text-gray-400 h-full flex justify-center items-center">No data loaded.</div>;
    }

    const displayHeaders = headers && headers.length > 0 ? headers : (data[0] ? Object.keys(data[0]) : []);

    return (
      <div className="overflow-auto h-full rounded-lg shadow-md bg-gray-800">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-750 sticky top-0 z-10">
            <tr>
              {displayHeaders.map(header => (
                <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {data.slice(0, 100).map((row, rowIndex) => ( 
              <tr key={rowIndex} className="hover:bg-gray-700 transition-colors duration-150">
                {displayHeaders.map(header => (
                  <td key={`${rowIndex}-${header}`} className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                    {String(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 100 && <p className="p-2 text-xs text-gray-500 text-center bg-gray-750">Showing first 100 rows of {data.length} total rows.</p>}
         {data.length === 0 && displayHeaders.length > 0 && <p className="p-4 text-sm text-gray-500 text-center">No rows match the current criteria, but columns are defined.</p>}
      </div>
    );
  };

  // --- Main Render ---
  const currentViewNodeDetails = processedDataHistory[viewNodeId] || {};
  const viewingNode = pipelineNodes.find(n => n.id === viewNodeId);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200 font-sans">
      <header className="p-3 bg-gray-800 shadow-md flex items-center justify-between space-x-3">
        <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-indigo-400 mr-2">
                <path d="M12.378 1.602a.75.75 0 00-.756 0L3.366 6.026A.75.75 0 003 6.692V17.308a.75.75 0 00.366.666l8.256 4.424a.75.75 0 00.756 0l8.256-4.424a.75.75 0 00.366-.666V6.692a.75.75 0 00-.366-.666L12.378 1.602zM12 7.5c.966 0 1.75.784 1.75 1.75S12.966 11 12 11s-1.75-.784-1.75-1.75S11.034 7.5 12 7.5zM10.06 13.693c.303.394.788.632 1.29.632h.026c.455 0 .894-.196 1.21-.557l3.042-3.476a.75.75 0 10-1.118-.98l-3.042 3.476a.252.252 0 01-.354.028l-1.542-1.233a.75.75 0 10-.94.118l1.428 1.736z" />
            </svg>
            <h1 className="text-xl font-semibold text-gray-100">NodeSheet Processor</h1>
        </div>
        <div className="flex items-center space-x-2">
          {originalData.length > 0 && ( 
            <>
              <button onClick={() => addNode(NODE_TYPES.FILTER)} title="Add Filter Node" className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-indigo-400 hover:text-indigo-300 transition-colors duration-150"><Filter size={18}/></button>
              <button onClick={() => addNode(NODE_TYPES.RENAME_COLUMN)} title="Add Rename Column Node" className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-indigo-400 hover:text-indigo-300 transition-colors duration-150"><Edit3 size={18}/></button>
              <button onClick={() => addNode(NODE_TYPES.SELECT_COLUMNS)} title="Add Select Columns Node" className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-indigo-400 hover:text-indigo-300 transition-colors duration-150"><Columns size={18}/></button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden p-3 space-x-3">
        <div className="w-1/3 lg:w-1/4 flex flex-col space-y-3 overflow-y-auto p-1 pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-850">
          <div className="bg-gray-800 p-3 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-100 mb-3 border-b border-gray-700 pb-2">Processing Pipeline</h2>
            {pipelineNodes.length === 0 && (
              <p className="text-sm text-gray-400">Initializing data...</p>
            )}
            
            <ul className="space-y-1.5">
              {pipelineNodes.map((node) => (
                <li key={node.id} 
                    className={`p-2.5 rounded-md transition-all duration-150 group relative
                                ${activeNodeId === node.id ? 'bg-indigo-600 shadow-md' : 'bg-gray-700 hover:bg-gray-650'}
                                ${viewNodeId === node.id && activeNodeId !== node.id ? 'ring-2 ring-indigo-500 ring-opacity-75' : ''}
                                ${processedDataHistory[node.id]?.error ? 'border-l-4 border-red-500' : 'border-l-4 border-transparent hover:border-indigo-500'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center overflow-hidden mr-2 cursor-pointer flex-grow min-w-0" onClick={() => handleEditNode(node.id)}>
                      {NODE_ICONS[node.type] || <Settings2 className="w-5 h-5 mr-2"/>}
                      <span className="text-sm font-medium text-gray-100 truncate" title={node.name}>{node.name}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 absolute right-1.5 top-1/2 -translate-y-1/2 bg-gray-700 group-hover:bg-opacity-90 p-1 rounded-md shadow">
                       <button onClick={(e) => {e.stopPropagation(); handleViewNodeData(node.id)}} title="View data from this node" className={`p-1 rounded ${viewNodeId === node.id ? 'text-indigo-300 bg-indigo-800_bg-opacity-50' : 'text-gray-400 hover:text-indigo-300'}`}>
                            <Eye size={16}/>
                        </button>
                        {node.type !== NODE_TYPES.UPLOAD && ( 
                            <button onClick={(e) => {e.stopPropagation(); handleEditNode(node.id)}} title="Edit node" className={`p-1 rounded ${activeNodeId === node.id ? 'text-indigo-200' : 'text-gray-400 hover:text-indigo-300'}`}>
                                <Settings2 size={16}/>
                            </button>
                        )}
                        {node.type !== NODE_TYPES.UPLOAD && (
                            <button onClick={(e) => {e.stopPropagation(); removeNode(node.id)}} title="Remove node" className="p-1 text-red-400 hover:text-red-300">
                                <Trash2 size={16}/>
                            </button>
                        )}
                    </div>
                  </div>
                   {processedDataHistory[node.id]?.error && (
                        <p className="text-xs text-red-400 mt-1 pl-7" title={processedDataHistory[node.id]?.errorMessage}>Error in this step.</p>
                    )}
                </li>
              ))}
            </ul>
          </div>
          {activeNodeId && <NodeConfigPanel />}
        </div>

        <div className="flex-1 overflow-hidden bg-gray-800 rounded-lg shadow-lg">
          <SpreadsheetTable 
            data={currentViewNodeDetails.data} 
            headers={currentViewNodeDetails.headers}
            nodeError={currentViewNodeDetails.error}
            nodeErrorMessage={currentViewNodeDetails.errorMessage}
            nodeName={viewingNode?.name}
          />
        </div>
      </div>

      {error && ( 
        <div className="fixed bottom-4 right-4 bg-red-700 text-white p-3 rounded-lg shadow-xl max-w-md z-50">
          <p className="font-semibold">Application Error:</p>
          <p className="text-sm">{error}</p>
          <button onClick={() => setError('')} className="mt-2 text-xs underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}

export default App;
