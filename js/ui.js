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
}


function escapeHtml(unsafe) {
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
    let outputHTML = `<h3 class="text-md font-semibold mb-2 text-gray-100">Data for: ${varName || 'Current Context'} (PEEK at Line ${line})</h3>`;

    if (!datasetToPeek) {
        outputHTML += '<p class="text-gray-400">No dataset loaded to PEEK.</p>';
    } else {
        const peekRowCount = 10;
        const dataToDisplay = datasetToPeek.slice(0, peekRowCount);

        if (dataToDisplay.length === 0) {
            outputHTML += '<p class="text-gray-400">Dataset is empty.</p>';
        } else {
            let tableHtml = '<table><thead><tr>';
            const allKeys = new Set();
            // Ensure allKeys come from the original dataset if it was larger, or the slice.
            // If datasetToPeek is the full dataset, this is fine. If it's already sliced,
            // and we want headers from the *original* dataset, this logic might need adjustment
            // based on what `datasetToPeek` represents. Assuming it's the full dataset here.
            datasetToPeek.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
            const headers = Array.from(allKeys);

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
                tableHtml += `<p class="text-xs text-gray-400 mt-2">Showing first ${peekRowCount} of ${datasetToPeek.length} rows. Total columns: ${headers.length}.</p>`;
            } else {
                tableHtml += `<p class="text-xs text-gray-400 mt-2">Showing all ${datasetToPeek.length} rows. Total columns: ${headers.length}.</p>`;
            }
            outputHTML += tableHtml;
        }
    }
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
        clearEditorPeekHighlight();
        return;
    }
    
    peekOutputs.forEach((peekData, index) => {
        const tabButton = document.createElement('button');
        tabButton.classList.add('peek-tab');
        tabButton.textContent = `PEEK ${index + 1} (VAR "${peekData.varName}", L${peekData.line})`;
        tabButton.dataset.target = peekData.id;

        const contentDiv = document.createElement('div');
        contentDiv.id = peekData.id;
        contentDiv.classList.add('peek-content');
        contentDiv.innerHTML = generatePeekHtmlForDisplay(peekData.dataset, peekData.varName, peekData.line); // Use the stored dataset

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
    clearEditorPeekHighlight();
}


export function initUI(interpreter) {
    uiInterpreterInstance = interpreter; // Store interpreter instance for UI use
    queryElements(); // Get all DOM elements

    const defaultScript = `VAR "citiesData"
THEN
    # Load CSV data into the "citiesData" variable
    LOAD_CSV FILE "cities.csv"
THEN
    PEEK  # Shows the content of "citiesData"
THEN
    KEEP_COLUMNS "City", "Population"
    # Note: Column names are case-sensitive based on your CSV!
THEN
    PEEK # Shows modified "citiesData"

# Add more lines to test scrolling
# Line
# Line
# Line
# Line
# Line
# Line
VAR "anotherVar"
THEN
    LOAD_CSV FILE "another.csv"
THEN
    PEEK # This is a PEEK on a later line
# Line
# Line
# Line
# Line
# Line
# Line
# Line
# Line
# Line
# Line
THEN
    PEEK # Another PEEK even later
`;
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
        
        // Clear previous logs and peek UI before running interpreter, but preserve interpreter's internal peekOutputs for now
        if (elements.logOutputEl) elements.logOutputEl.innerHTML = 'Logs will appear here...<br>';
        if (elements.peekTabsContainerEl) elements.peekTabsContainerEl.innerHTML = '';
        if (elements.peekOutputsDisplayAreaEl) elements.peekOutputsDisplayAreaEl.innerHTML = '<div class="output-box-placeholder">Peek results will appear here when a script is run.</div>';
        clearEditorPeekHighlight();
        uiInterpreterInstance.clearInternalState(); // Crucially, clear interpreter's old data

        try {
            const tokensForParser = tokenizeForParser(script);
            const parser = new Parser(tokensForParser);
            const ast = parser.parse();
            elements.astOutputArea.textContent = JSON.stringify(ast, null, 2);

            await uiInterpreterInstance.run(ast); // Interpreter updates its own peekOutputs

        } catch (e) {
            elements.astOutputArea.classList.add('error-box');
            const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
            const stackTrace = e instanceof Error && e.stack ? "\n" + e.stack.split('\n').slice(0,3).join('\n') : '';
            elements.astOutputArea.textContent = `Error: ${errorMessage}${stackTrace}`;
            uiInterpreterInstance.log(`Error during parsing or execution: ${errorMessage}`);
            console.error("Full error object:", e);
        } finally {
            renderPeekOutputsUI(); // Always render peek outputs based on interpreter's state
        }
    });

    elements.clearButton?.addEventListener('click', () => {
        clearOutputs();
    });
}