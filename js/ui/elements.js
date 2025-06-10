// js/ui/elements.js

// Cached DOM elements used throughout the UI.
const elements = {};

// Query and store needed DOM elements. Should be called once during init.
function queryElements() {
    elements.inputArea = document.getElementById('pipeDataInput');
    elements.highlightingOverlay = document.getElementById('highlightingOverlay');
    elements.lineNumbers = document.getElementById('lineNumbers');
    elements.execStatus = document.getElementById('execStatus');
    elements.errorMarkers = document.getElementById('errorMarkers');
    elements.varBlockIndicator = document.getElementById('varBlockIndicator');
    elements.astOutputArea = document.getElementById('astOutput');
    elements.logOutputEl = document.getElementById('logOutput');
    elements.peekTabsContainerEl = document.getElementById('peekTabsContainer');
    elements.peekOutputsDisplayAreaEl = document.getElementById('peekOutputsDisplayArea');
    elements.dagContainer = document.getElementById('dagContainer');
    elements.runButton = document.getElementById('runButton');
    elements.clearButton = document.getElementById('clearButton');
    elements.openFileButton = document.getElementById('openScriptFileButton');
    elements.saveFileButton = document.getElementById('saveScriptFileButton');
    elements.csvFileInputEl = document.getElementById('csvFileInput');
    elements.fileInputContainerEl = document.getElementById('fileInputContainer');
    elements.filePromptMessageEl = document.getElementById('filePromptMessage');
    elements.exportPeekButton = document.getElementById('exportPeekButton');
    elements.exportExcelButton = document.getElementById('exportExcelButton');
}

export { elements, queryElements };
