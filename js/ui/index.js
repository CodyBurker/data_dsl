// js/ui/index.js

import { Parser } from '../parser.js';
import { tokenizeForParser } from '../tokenizer.js';
import { elements, queryElements } from './elements.js';
import { applySyntaxHighlighting } from './highlight.js';
import {
    generatePeekHtmlForDisplay,
    renderPeekOutputsUI as renderPeekOutputsUIHelper,
    clearEditorPeekHighlight as clearEditorPeekHighlightHelper,
    handleExportPeek as handleExportPeekHelper
} from './peek.js';
import { saveScriptToFile, loadScriptFromFile, loadDefaultScript } from './fileOps.js';

let uiInterpreterInstance = null;
const highlightState = { currentLine: null };
const scrollState = { suppressTabScroll: false };

function getCursorLineNumber() {
    if (!elements.inputArea) return null;
    const value = elements.inputArea.value.slice(0, elements.inputArea.selectionStart);
    return value.split(/\r?\n/).length;
}

function updateLineNumbers() {
    if (!elements.inputArea || !elements.lineNumbers) return;
    const lineCount = elements.inputArea.value.split(/\r?\n/).length || 1;
    let numbers = '';
    for (let i = 1; i <= Math.min(lineCount, 999); i++) {
        numbers += String(i).padStart(3, ' ') + '\n';
    }
    elements.lineNumbers.textContent = numbers;
    elements.lineNumbers.scrollTop = elements.inputArea.scrollTop;
}

function renderPeekOutputsUI() {
    renderPeekOutputsUIHelper(uiInterpreterInstance, {
        currentLineRef: highlightState,
        updateVarBlockIndicator,
        suppressTabScrollRef: scrollState
    });
}

function clearEditorPeekHighlight() {
    clearEditorPeekHighlightHelper({ currentLineRef: highlightState });
}

function handleExportPeek() {
    handleExportPeekHelper(uiInterpreterInstance);
}

function showOutputForLine(lineNumber) {
    if (!elements.peekTabsContainerEl) return;
    const tabSelectors = [
        `.peek-tab[data-peek-index][data-line='${lineNumber}']`,
        `.peek-tab[data-step-index][data-line='${lineNumber}']`
    ];
    for (const sel of tabSelectors) {
        const tab = elements.peekTabsContainerEl.querySelector(sel);
        if (tab) {
            scrollState.suppressTabScroll = true;
            tab.click();
            scrollState.suppressTabScroll = false;
            return;
        }
    }
}

function updateVarBlockIndicator(lineNumber) {
    if (!elements.varBlockIndicator || !elements.inputArea) return;
    const lines = elements.inputArea.value.split(/\r?\n/);
    if (lineNumber < 1 || lineNumber > lines.length) {
        elements.varBlockIndicator.style.display = 'none';
        return;
    }

    let start = null;
    for (let i = lineNumber - 1; i >= 0; i--) {
        if (/^\s*VAR\b/i.test(lines[i])) { start = i + 1; break; }
    }
    if (start === null) {
        elements.varBlockIndicator.style.display = 'none';
        return;
    }
    let end = lines.length;
    for (let i = lineNumber; i < lines.length; i++) {
        if (/^\s*VAR\b/i.test(lines[i])) { end = i; break; }
        if (/^\s*THEN\s+PEEK\b/i.test(lines[i])) { end = i + 1; break; }
    }

    while (end > start && /^\s*$/.test(lines[end - 1])) {
        end--;
    }

    const style = getComputedStyle(elements.inputArea);
    const lineHeight = parseFloat(style.lineHeight);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingLeft = parseFloat(style.paddingLeft);
    const borderLeft = parseFloat(style.borderLeftWidth);
    const borderTop = parseFloat(style.borderTopWidth);

    const top = paddingTop + borderTop + (start - 1) * lineHeight - elements.inputArea.scrollTop;
    const height = (end - start + 1) * lineHeight;
    const left = paddingLeft + borderLeft - elements.inputArea.scrollLeft - 6;

    elements.varBlockIndicator.style.top = `${top}px`;
    elements.varBlockIndicator.style.left = `${left}px`;
    elements.varBlockIndicator.style.height = `${height}px`;
    elements.varBlockIndicator.style.display = 'block';
}

function clearOutputs() {
    if (uiInterpreterInstance) {
        uiInterpreterInstance.clearInternalState(true);
        if (elements.logOutputEl) elements.logOutputEl.innerHTML = 'Logs will appear here...<br>';
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
    if (elements.exportPeekButton) elements.exportPeekButton.classList.add('hidden');
    clearEditorPeekHighlight();
    if (elements.varBlockIndicator) elements.varBlockIndicator.style.display = 'none';
}

export async function initUI(interpreter) {
    uiInterpreterInstance = interpreter;
    queryElements();
    updateLineNumbers();

    const defaultScript = await loadDefaultScript();
    if (elements.inputArea && elements.inputArea.value.trim() === '') {
        elements.inputArea.value = defaultScript;
        updateLineNumbers();
        if (elements.highlightingOverlay) {
            elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(defaultScript, null);
        }
        if (elements.varBlockIndicator) updateVarBlockIndicator(1);
    }
    clearOutputs();

    elements.inputArea?.addEventListener('input', () => {
        const text = elements.inputArea.value;
        updateLineNumbers();
        elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(text, null);
        highlightState.currentLine = null;
        elements.highlightingOverlay.scrollTop = elements.inputArea.scrollTop;
        elements.highlightingOverlay.scrollLeft = elements.inputArea.scrollLeft;
        const line = getCursorLineNumber();
        if (line) updateVarBlockIndicator(line);
    });

    elements.inputArea?.addEventListener('scroll', () => {
        elements.highlightingOverlay.scrollTop = elements.inputArea.scrollTop;
        elements.highlightingOverlay.scrollLeft = elements.inputArea.scrollLeft;
        updateLineNumbers();
        const line = getCursorLineNumber();
        if (line) updateVarBlockIndicator(line);
    });

    if (elements.inputArea) {
        new ResizeObserver(() => {
            elements.highlightingOverlay.style.height = elements.inputArea.clientHeight + 'px';
            elements.highlightingOverlay.style.width = elements.inputArea.clientWidth + 'px';
            if (elements.lineNumbers) {
                elements.lineNumbers.style.height = elements.inputArea.clientHeight + 'px';
            }
        }).observe(elements.inputArea);
    }

    elements.csvFileInputEl?.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (uiInterpreterInstance && uiInterpreterInstance.fileResolve) {
            uiInterpreterInstance.fileResolve(file);
            uiInterpreterInstance.fileResolve = null;
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
        if (elements.exportPeekButton) elements.exportPeekButton.classList.add('hidden');
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
            console.error('Full error object:', e);
        } finally {
            renderPeekOutputsUI();
        }
    });

    elements.clearButton?.addEventListener('click', () => {
        clearOutputs();
    });

    elements.saveFileButton?.addEventListener('click', () => saveScriptToFile(uiInterpreterInstance));
    elements.openFileButton?.addEventListener('click', () => loadScriptFromFile(uiInterpreterInstance, updateLineNumbers, highlightState));
    elements.exportPeekButton?.addEventListener('click', handleExportPeek);

    elements.inputArea?.addEventListener('keyup', () => {
        const line = getCursorLineNumber();
        if (line) {
            showOutputForLine(line);
            updateVarBlockIndicator(line);
        }
    });
    elements.inputArea?.addEventListener('click', () => {
        const line = getCursorLineNumber();
        if (line) {
            showOutputForLine(line);
            updateVarBlockIndicator(line);
        }
    });
}

export { renderPeekOutputsUI, generatePeekHtmlForDisplay, clearOutputs };
