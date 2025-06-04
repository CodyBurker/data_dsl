// ui.js
import { TokenType, tokenizeForHighlighting } from './tokenizer.js';
import { Parser } from './parser.js'; // Needed for the run button
import { tokenizeForParser } from './tokenizer.js'; // Needed for the run button

let currentEditorHighlightLine = null;
let uiInterpreterInstance = null; // To store the interpreter instance

// DOM Elements Cache
const elements = {};

function queryElements() {
    elements.inputArea = document.getElementById('pipeDataInput');
    elements.highlightingOverlay = document.getElementById('highlightingOverlay');
    elements.astOutputArea = document.getElementById('astOutput');
    elements.logOutputEl = document.getElementById('logOutput');
    elements.peekTabsContainerEl = document.getElementById('peekTabsContainer');
    elements.peekOutputsDisplayAreaEl = document.getElementById('peekOutputsDisplayArea');
    elements.runButton = document.getElementById('runButton');
    elements.clearButton = document.getElementById('clearButton');
    elements.csvFileInputEl = document.getElementById('csvFileInput');
    elements.fileInputContainerEl = document.getElementById('fileInputContainer');
    elements.filePromptMessageEl = document.getElementById('filePromptMessage');
    elements.exportPeekButton = document.getElementById('exportPeekButton'); // <-- New element
}


function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        unsafe = String(unsafe);
    }
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

export function applySyntaxHighlighting(text, activePeekLine = null) {
    const tokens = tokenizeForHighlighting(text);
    let html = '';
    let currentVarBlockStyleIndex = 0;
    const varBlockStyles = ['var-block-bg-1', 'var-block-bg-2', 'var-block-bg-3', 'var-block-bg-4'];
    let inVarBlock = false;
    let blockContentHtml = '';
    const activePeekHighlightID = "active-editor-peek-highlight";

    function closeCurrentVarBlock() {
        if (inVarBlock && blockContentHtml.trim() !== '') {
            html += `<div class="var-block ${varBlockStyles[currentVarBlockStyleIndex % varBlockStyles.length]}">${blockContentHtml}</div>`;
            currentVarBlockStyleIndex++;
        } else if (blockContentHtml.trim() !== '') {
            html += blockContentHtml;
        }
        blockContentHtml = '';
        inVarBlock = false;
    }

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        let tokenHtml = '';
        const escapedValue = escapeHtml(token.value);

        if (token.type === TokenType.KEYWORD && token.value.toUpperCase() === 'VAR') {
            closeCurrentVarBlock();
            inVarBlock = true;
        }

        let classes = '';
        let idAttribute = '';

        switch (token.type) {
            case TokenType.KEYWORD:
                classes = 'token-keyword';
                if (token.value.toUpperCase() === 'PEEK' && token.line === activePeekLine) {
                    classes += ' active-peek-line-highlight';
                    idAttribute = ` id="${activePeekHighlightID}"`;
                }
                tokenHtml = `<span class="${classes}"${idAttribute}>${escapedValue}</span>`;
                break;
            case TokenType.STRING_LITERAL: tokenHtml = `<span class="token-string_literal">${escapedValue}</span>`; break;
            case TokenType.NUMBER_LITERAL: tokenHtml = `<span class="token-number_literal">${escapedValue}</span>`; break;
            case TokenType.COMMENT: tokenHtml = `<span class="token-comment">${escapedValue}</span>`; break;
            case TokenType.OPERATOR: tokenHtml = `<span class="token-operator">${escapedValue}</span>`; break;
            case TokenType.IDENTIFIER: tokenHtml = `<span class="token-identifier">${escapedValue}</span>`; break;
            case TokenType.PUNCTUATION: tokenHtml = `<span class="token-punctuation">${escapedValue}</span>`; break;
            case TokenType.NEWLINE: tokenHtml = '\n'; break;
            case TokenType.WHITESPACE: tokenHtml = escapedValue; break;
            default: tokenHtml = escapedValue;
        }

        if (inVarBlock) {
            blockContentHtml += tokenHtml;
        } else {
            html += tokenHtml;
        }
    }
    closeCurrentVarBlock();
    return html + '\n\n'; // Extra newlines for padding if needed
}


function generatePeekHtmlForDisplay(datasetToPeek, varName, line) {
    let outputHTML = `<h3 class="text-md font-semibold mb-2 text-gray-100">Data for: VAR "${varName || 'Current Context'}" (PEEK at Line ${line})</h3>`;

    if (!datasetToPeek) {
        outputHTML += '<p class="text-gray-400">No dataset loaded to PEEK.</p>';
        return outputHTML;
    }

    if (!Array.isArray(datasetToPeek)) {
        outputHTML += `<p class="text-gray-400">PEEKed data is not tabular (Type: ${typeof datasetToPeek}). Preview may be limited.</p>`;
        if (typeof datasetToPeek === 'object') {
            outputHTML += `<pre class="text-gray-400">${escapeHtml(JSON.stringify(datasetToPeek, null, 2))}</pre>`;
        } else {
            outputHTML += `<pre class="text-gray-400">${escapeHtml(String(datasetToPeek))}</pre>`;
        }
        return outputHTML;
    }

    if (datasetToPeek.length > 0 && typeof datasetToPeek[0] === 'object') {
        const peekRowCount = 10;
        const dataToDisplay = datasetToPeek.slice(0, peekRowCount);
        const headers = Object.keys(dataToDisplay[0]);
            let tableHtml = '<table><thead><tr>';
            headers.forEach(header => tableHtml += `<th>${escapeHtml(String(header))}</th>`);
            tableHtml += '</tr></thead><tbody>';
            dataToDisplay.forEach(row => {
                tableHtml += '<tr>';
                headers.forEach(header => {
                    const value = row[header];
                    tableHtml += `<td>${value === null || value === undefined ? '' : escapeHtml(String(value))}</td>`;
                });
                tableHtml += '</tr>';
            });
            tableHtml += `</tbody></table>`;
             if (datasetToPeek.length > peekRowCount) {
                tableHtml += `<p class="text-xs text-gray-400 mt-2">Showing first ${peekRowCount} of ${datasetToPeek.length} rows (basic preview).</p>`;
            } else {
                tableHtml += `<p class="text-xs text-gray-400 mt-2">Showing all ${datasetToPeek.length} rows (basic preview).</p>`;
            }
            outputHTML += tableHtml;
        if (datasetToPeek.length > peekRowCount) {
            outputHTML += `<p class="text-xs text-gray-400 mt-2">Showing first ${peekRowCount} of ${datasetToPeek.length} rows.</p>`;
        } else {
            outputHTML += `<p class="text-xs text-gray-400 mt-2">Showing all ${datasetToPeek.length} rows.</p>`;
        }
        return outputHTML;
    }

    outputHTML += `<pre class="text-gray-400">${escapeHtml(JSON.stringify(datasetToPeek, null, 2))}</pre>`;
    return outputHTML;
}

function renderPeekOutputsUI() {
    if (!elements.peekTabsContainerEl || !elements.peekOutputsDisplayAreaEl || !uiInterpreterInstance) {
        console.error("Peek UI elements not found or interpreter not set!");
        return;
    }

    elements.peekTabsContainerEl.innerHTML = '';
    elements.peekOutputsDisplayAreaEl.innerHTML = '';
    
    const peekOutputs = uiInterpreterInstance.peekOutputs;

    if (peekOutputs.length === 0) {
        elements.peekOutputsDisplayAreaEl.innerHTML = '<div class="output-box-placeholder">No PEEK outputs to display.</div>';
        if (elements.exportPeekButton) elements.exportPeekButton.classList.add('hidden'); // <-- Hide export button
        clearEditorPeekHighlight();
        return;
    }
    
    if (elements.exportPeekButton) elements.exportPeekButton.classList.remove('hidden'); // <-- Show export button

    peekOutputs.forEach((peekData, index) => {
        const tabButton = document.createElement('button');
        tabButton.classList.add('peek-tab');
        tabButton.textContent = `PEEK ${index + 1} (VAR "${peekData.varName}", L${peekData.line})`;
        tabButton.dataset.target = peekData.id;
        tabButton.dataset.peekIndex = index; // Store index for easy data retrieval

        const contentDiv = document.createElement('div');
        contentDiv.id = peekData.id;
        contentDiv.classList.add('peek-content');
        // Pass the raw dataset (array or other structure)
        contentDiv.innerHTML = generatePeekHtmlForDisplay(peekData.dataset, peekData.varName, peekData.line);

        elements.peekTabsContainerEl.appendChild(tabButton);
        elements.peekOutputsDisplayAreaEl.appendChild(contentDiv);

        tabButton.addEventListener('click', () => {
            elements.peekTabsContainerEl.querySelectorAll('.peek-tab').forEach(tab => tab.classList.remove('active-peek-tab'));
            elements.peekOutputsDisplayAreaEl.querySelectorAll('.peek-content').forEach(content => content.classList.remove('active-peek-content'));

            tabButton.classList.add('active-peek-tab');
            contentDiv.classList.add('active-peek-content');

            if (elements.inputArea && elements.highlightingOverlay) {
                elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(elements.inputArea.value, peekData.line);
                currentEditorHighlightLine = peekData.line;
                
                const highlightedSpan = elements.highlightingOverlay.querySelector('#active-editor-peek-highlight');
                if (highlightedSpan) {
                    const scrollTargetOffset = highlightedSpan.offsetTop;
                    const inputAreaVisibleHeight = elements.inputArea.clientHeight;
                    const desiredScrollTop = scrollTargetOffset - (inputAreaVisibleHeight / 3); 

                    elements.inputArea.scrollTop = Math.max(0, desiredScrollTop); 
                    elements.highlightingOverlay.scrollTop = elements.inputArea.scrollTop; 
                }
            }
        });

        if (index === 0) { 
            tabButton.click(); // Programmatically click the first tab to activate it and its logic
        }
    });
}

function clearEditorPeekHighlight() {
    if (elements.inputArea && elements.highlightingOverlay && currentEditorHighlightLine !== null) {
        elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(elements.inputArea.value, null);
        currentEditorHighlightLine = null;
    } else if (elements.inputArea && elements.highlightingOverlay && currentEditorHighlightLine === null) {
         elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(elements.inputArea.value, null);
    }
}


function clearOutputs() {
    if (uiInterpreterInstance) {
         // Clear interpreter's log output element
        if (elements.logOutputEl) elements.logOutputEl.innerHTML = 'Logs will appear here...<br>';
        // Clear interpreter's peek data and related UI
        uiInterpreterInstance.peekOutputs = []; // Clear stored peeks in interpreter
    }
   
    if (elements.peekTabsContainerEl) elements.peekTabsContainerEl.innerHTML = '';
    if (elements.peekOutputsDisplayAreaEl) {
        elements.peekOutputsDisplayAreaEl.innerHTML = '<div class="output-box-placeholder">Peek results will appear here when a script is run.</div>';
    }
    if (elements.astOutputArea) {
        elements.astOutputArea.textContent = 'AST will appear here...';
        elements.astOutputArea.classList.remove('error-box');
    }
    if (elements.fileInputContainerEl) {
        elements.fileInputContainerEl.classList.add('hidden');
    }
    if (elements.exportPeekButton) elements.exportPeekButton.classList.add('hidden'); // <-- Hide export button
    clearEditorPeekHighlight();
}

// --- START NEW FUNCTION ---
function handleExportPeek() {
    if (!uiInterpreterInstance || !elements.peekTabsContainerEl) return;

    const activeTab = elements.peekTabsContainerEl.querySelector('.peek-tab.active-peek-tab');
    if (!activeTab) {
        alert("No active PEEK tab found to export.");
        return;
    }

    const peekIndex = parseInt(activeTab.dataset.peekIndex, 10);
    const peekDataEntry = uiInterpreterInstance.peekOutputs[peekIndex];

    if (!peekDataEntry || !peekDataEntry.dataset) {
        alert("Could not find data for the active PEEK tab.");
        return;
    }

    const dataset = peekDataEntry.dataset;

    if (Array.isArray(dataset) && dataset.length > 0 && typeof dataset[0] === 'object') {
        // Basic CSV conversion for array of objects
        try {
            const papaCSV = Papa.unparse(dataset);
            const blob = new Blob([papaCSV], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `peek_export_${peekDataEntry.varName}_L${peekDataEntry.line}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            uiInterpreterInstance.log(`Exported PEEK data (array of objects) for VAR "${peekDataEntry.varName}" (Line ${peekDataEntry.line}) to CSV.`);
        } catch (error) {
            console.error("Error exporting array of objects to CSV:", error);
            alert("Failed to export data to CSV. See console for details.");
            uiInterpreterInstance.log(`Error exporting PEEK (array of objects) for VAR "${peekDataEntry.varName}" to CSV: ${error.message}`);
        }
    } else {
        alert("The active PEEK tab data is not in a format that can be exported to CSV.");
        uiInterpreterInstance.log(`PEEK data for VAR "${peekDataEntry.varName}" (Line ${peekDataEntry.line}) is not exportable to CSV (type: ${typeof dataset})`);
    }
}
// --- END NEW FUNCTION ---


export function initUI(interpreter) {
    uiInterpreterInstance = interpreter; // Store interpreter instance for UI use
    queryElements(); // Get all DOM elements

    const defaultScript = `VAR "cities"
THEN
    PEEK
VAR "people"
THEN
    KEEP_COLUMNS name, age, city_id
THEN
    FILTER_ROWS WHERE age > 27
THEN
    JOIN cities ON city_id = id TYPE "LEFT"
THEN
    PEEK`;
    if (elements.inputArea) {
        elements.inputArea.value = defaultScript;
        if (elements.highlightingOverlay) {
            elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(elements.inputArea.value, null);
        }
    }
    clearOutputs(); // Initial clear

    elements.inputArea?.addEventListener('input', () => {
        const text = elements.inputArea.value;
        elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(text, null); // Clear peek highlight on input
        currentEditorHighlightLine = null;
        elements.highlightingOverlay.scrollTop = elements.inputArea.scrollTop;
        elements.highlightingOverlay.scrollLeft = elements.inputArea.scrollLeft;
    });

    elements.inputArea?.addEventListener('scroll', () => {
        elements.highlightingOverlay.scrollTop = elements.inputArea.scrollTop;
        elements.highlightingOverlay.scrollLeft = elements.inputArea.scrollLeft;
    });

    if (elements.inputArea) {
        new ResizeObserver(() => {
            elements.highlightingOverlay.style.height = elements.inputArea.clientHeight + 'px';
            elements.highlightingOverlay.style.width = elements.inputArea.clientWidth + 'px';
        }).observe(elements.inputArea);
    }

    elements.csvFileInputEl?.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (uiInterpreterInstance && uiInterpreterInstance.fileResolve) {
            uiInterpreterInstance.fileResolve(file);
            uiInterpreterInstance.fileResolve = null; // Consume the resolver
        }
    });

    elements.runButton?.addEventListener('click', async () => {
        if (!uiInterpreterInstance) return;

        const script = elements.inputArea.value;
        elements.astOutputArea.classList.remove('error-box');
        elements.astOutputArea.textContent = 'Parsing...';
        
        if (elements.logOutputEl) elements.logOutputEl.innerHTML = 'Logs will appear here...<br>';
        if (elements.peekTabsContainerEl) elements.peekTabsContainerEl.innerHTML = '';
        if (elements.peekOutputsDisplayAreaEl) elements.peekOutputsDisplayAreaEl.innerHTML = '<div class="output-box-placeholder">Peek results will appear here when a script is run.</div>';
        if (elements.exportPeekButton) elements.exportPeekButton.classList.add('hidden'); // <-- Hide export on run
        clearEditorPeekHighlight();
        uiInterpreterInstance.clearInternalState(); 

        try {
            const tokensForParser = tokenizeForParser(script);
            const parser = new Parser(tokensForParser);
            const ast = parser.parse();
            elements.astOutputArea.textContent = JSON.stringify(ast, null, 2);

            await uiInterpreterInstance.run(ast); 

        } catch (e) {
            elements.astOutputArea.classList.add('error-box');
            const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
            const stackTrace = e instanceof Error && e.stack ? "\n" + e.stack.split('\n').slice(0,3).join('\n') : '';
            elements.astOutputArea.textContent = `Error: ${errorMessage}${stackTrace}`;
            uiInterpreterInstance.log(`Error during parsing or execution: ${errorMessage}`);
            console.error("Full error object:", e);
        } finally {
            renderPeekOutputsUI(); 
        }
    });

    elements.clearButton?.addEventListener('click', () => {
        clearOutputs();
    });

    // --- START NEW EVENT LISTENER ---
    elements.exportPeekButton?.addEventListener('click', handleExportPeek);
    // --- END NEW EVENT LISTENER ---
}

export { renderPeekOutputsUI, generatePeekHtmlForDisplay, clearOutputs };
