import React, { useEffect } from 'react';
import { Interpreter } from '../js/interpreter.js';
import { initUI } from '../js/ui/index.js';
import '../style.css';

export default function App() {
  useEffect(() => {
    const interpreter = new Interpreter({});
    initUI(interpreter);
  }, []);

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-6xl bg-white p-6 sm:p-8 rounded-xl shadow-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800">PipeData DSL Runner</h1>
          <p className="text-gray-600 mt-2">Write PipeData script, select a CSV if needed, and run to see results.</p>
          <p className="mt-1 text-right">
            <a href="https://github.com/CodyBurker/data_dsl" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium underline">View on GitHub</a>
            <a href="guide.html" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium underline ml-4">Language Guide</a>
          </p>
        </header>
        <div className="file-input-container hidden" id="fileInputContainer">
          <label htmlFor="csvFileInput" className="block text-sm font-medium text-gray-700 mb-2">A `LOAD_CSV` or `LOAD_JSON` command requires you to select a file:</label>
          <input type="file" id="csvFileInput" accept=".csv,.txt,.json" className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer focus:outline-none p-2" />
          <p id="filePromptMessage" className="text-xs text-gray-500 mt-1"></p>
        </div>
        <div className="mb-6">
          <label className="block text-lg font-medium text-gray-700 mb-1">Datapipe View:</label>
          <div id="dagContainer" className="border border-gray-300 rounded-lg"></div>
        </div>
        <div className="mb-6">
          <label htmlFor="pipeDataInput" className="block text-lg font-medium text-gray-700 mb-1">PipeData Script Editor:</label>
          <div className="code-editor-container editor-prominent">
            <pre id="lineNumbers" aria-hidden="true"></pre>
            <div id="execStatus" aria-hidden="true"></div>
            <div id="errorMarkers" aria-hidden="true"></div>
            <div id="varBlockIndicator" aria-hidden="true"></div>
            <textarea
              id="pipeDataInput"
              spellCheck="false"
              autoComplete="off"
              autoCapitalize="off"
              placeholder={'# Example: VAR "myVar" THEN LOAD_CSV FILE "your_file.csv" OR LOAD_JSON FILE "data.json"...'}
            ></textarea>
            <pre id="highlightingOverlay" aria-hidden="true"></pre>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row justify-end items-center gap-4">
            <button id="openScriptFileButton" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto text-sm">Open File</button>
            <button id="saveScriptFileButton" className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto text-sm">Save File</button>
            <button id="clearButton" className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto text-sm">Clear Outputs</button>
            <button id="runButton" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto text-sm">Run Script</button>
          </div>
        </div>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-0">
            <label className="block text-lg font-medium text-gray-700">PEEK Outputs:</label>
            <button id="exportPeekButton" className="bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-3 rounded-lg shadow-md transition duration-150 ease-in-out transform hover:scale-105 text-xs hidden">Export Active PEEK (CSV)</button>
          </div>
          <div id="peekTabsContainer" className="flex flex-wrap border-b border-gray-300"></div>
          <div id="peekOutputsDisplayArea" className="peek-output-area-container">
            <div className="output-box-placeholder">Peek results will appear here when a script is run.</div>
          </div>
        </div>
        <div className="mb-6">
          <details className="output-collapsible rounded-lg border border-gray-300">
            <summary className="cursor-pointer p-3 font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-t-lg">View AST / Parse Error</summary>
            <div id="astOutput" className="output-box output-box-collapsible-content">AST will appear here...</div>
          </details>
        </div>
        <div className="mb-6">
          <details className="output-collapsible rounded-lg border border-gray-300">
            <summary className="cursor-pointer p-3 font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-t-lg">View Interpreter Logs</summary>
            <div id="logOutput" className="output-box output-box-collapsible-content">Logs will appear here...</div>
          </details>
        </div>
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Syntax Guide:</h3>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Start pipelines with `VAR \"variableName\"`.</li>
            <li>Supported: `LOAD_CSV FILE \"name\"`, `LOAD_JSON FILE \"name\"`, `KEEP_COLUMNS cols` or `SELECT cols`, `JOIN var ON left = right TYPE \"LEFT\"`, `EXPORT_CSV TO \"name\"`.</li>
            <li>Other commands are parsed but not yet interpreted for all operations.</li>
            <li>Piping: Use `THEN`. Comments: Start with `#`.</li>
            <li>CSV Loading uses a basic native parser.</li>
            <li><a href="guide.html" className="underline text-indigo-600">View the full language guide</a> for more details.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
