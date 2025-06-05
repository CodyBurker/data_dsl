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
import { buildDag } from '../dag.js';
import { renderDag, highlightDagNodeForLine } from './dagView.js';
import { saveScriptToFile, loadScriptFromFile, loadDefaultScript } from './fileOps.js';

let uiInterpreterInstance = null;
const highlightState = { currentLine: null };
const scrollState = { suppressTabScroll: false };
let debounceTimer = null;

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

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateExecStatus(executed, total, errorInfos = [], lines = []) {
    if (!elements.execStatus) return;
    const set = new Set(executed);
    const errorMap = new Map();
    for (const err of errorInfos) {
        if (err && err.line != null) errorMap.set(err.line, err.message);
    }

    const varStarts = [];
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*VAR\b/i.test(lines[i])) varStarts.push(i);
    }
    const varEnds = {};
    for (let s = 0; s < varStarts.length; s++) {
        const start = varStarts[s];
        let end = (s + 1 < varStarts.length) ? varStarts[s + 1] - 1 : lines.length - 1;
        while (end > start && /^\s*$/.test(lines[end])) end--;
        varEnds[start] = end;
    }

    let currentVarStart = null;
    let currentVarEnd = null;
    let prevClass = '';
    let html = '';

    for (let lineNum = 1; lineNum <= total; lineNum++) {
        const idx = lineNum - 1;
        const content = lines[idx] ?? '';
        const isBlank = /^\s*$/.test(content);

        if (varStarts.includes(idx)) {
            currentVarStart = idx;
            currentVarEnd = varEnds[idx];
            prevClass = '';
        } else if (currentVarEnd !== null && idx > currentVarEnd) {
            currentVarStart = null;
            currentVarEnd = null;
            prevClass = '';
        }

        let cls = '';
        if (set.has(lineNum)) {
            cls = 'line-success';
        } else if (errorMap.has(lineNum)) {
            cls = 'line-error';
        } else if (!isBlank) {
            cls = 'line-pending';
        }

        if (isBlank && currentVarStart !== null && idx <= currentVarEnd) {
            cls = prevClass;
        } else if (!isBlank) {
            prevClass = cls;
        } else {
            prevClass = '';
        }

        html += `<div class="${cls}"></div>`;
    }

    elements.execStatus.innerHTML = html;
    elements.execStatus.scrollTop = elements.inputArea.scrollTop;

    if (elements.errorMarkers) {
        if (errorMap.size > 0) {
            const style = getComputedStyle(elements.inputArea);
            const lineHeight = parseFloat(style.lineHeight);
            const paddingTop = parseFloat(style.paddingTop);
            const borderTop = parseFloat(style.borderTopWidth);
            let dots = '';
            for (const [line, msgRaw] of errorMap.entries()) {
                const top = paddingTop + borderTop + (line - 1) * lineHeight - elements.inputArea.scrollTop + (lineHeight / 2) - 3;
                const msg = escapeHtml(msgRaw || '');
                dots += `<div class="error-dot" data-message="${msg}" style="top:${top}px"></div>`;
            }
            elements.errorMarkers.innerHTML = dots;
            elements.errorMarkers.style.pointerEvents = 'auto';
        } else {
            elements.errorMarkers.innerHTML = '';
            elements.errorMarkers.style.pointerEvents = 'none';
        }
    }
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

async function runRealtime() {
    if (!uiInterpreterInstance) return;
    const script = elements.inputArea.value;
    const lines = script.split(/\r?\n/);
    const lineCount = lines.length || 1;
    elements.astOutputArea.classList.remove('error-box');
    let parsedAst = null;
    try {
        const tokens = tokenizeForParser(script);
        const parser = new Parser(tokens);
        const { ast, errors } = parser.parseAll();
        if (errors.length === 0) {
            parsedAst = ast;
            elements.astOutputArea.textContent = JSON.stringify(ast, null, 2);
            await uiInterpreterInstance.run(ast);
            updateExecStatus(uiInterpreterInstance.getExecutedLines(), lineCount, [], lines);
        } else {
            elements.astOutputArea.classList.add('error-box');
            elements.astOutputArea.textContent = `Error: ${errors[0].message}`;
            updateExecStatus([], lineCount, errors, lines);
        }
    } catch (e) {
        elements.astOutputArea.classList.add('error-box');
        const msg = e instanceof Error ? e.message : String(e);
        elements.astOutputArea.textContent = `Error: ${msg}`;
        const match = /Line (\d+)/.exec(msg);
        const errLine = match ? parseInt(match[1], 10) : null;
        updateExecStatus([], lineCount, errLine ? [{ line: errLine, message: msg }] : [], lines);
    } finally {
        renderPeekOutputsUI();
        if (parsedAst) {
            renderDag(buildDag(parsedAst), { onNodeClick: showOutputForLine });
        }
    }
}

function scheduleRealtimeRun() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runRealtime, 300);
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

    const visibleHeight = elements.inputArea.clientHeight;
    if (top + height <= 0 || top >= visibleHeight) {
        elements.varBlockIndicator.style.display = 'none';
        return;
    }

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
    if (elements.dagContainer) elements.dagContainer.innerHTML = '';
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
        const lines = text.split(/\r?\n/);
        updateExecStatus([], lines.length || 1, [], lines);
        scheduleRealtimeRun();
    });

    elements.inputArea?.addEventListener('scroll', () => {
        elements.highlightingOverlay.scrollTop = elements.inputArea.scrollTop;
        elements.highlightingOverlay.scrollLeft = elements.inputArea.scrollLeft;
        updateLineNumbers();
        if (elements.execStatus) elements.execStatus.scrollTop = elements.inputArea.scrollTop;
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
            if (elements.execStatus) {
                elements.execStatus.style.height = elements.inputArea.clientHeight + 'px';
            }
            if (elements.errorMarkers) {
                elements.errorMarkers.style.height = elements.inputArea.clientHeight + 'px';
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

        let ast = null;
        try {
            const tokensForParser = tokenizeForParser(script);
            const parser = new Parser(tokensForParser);
            const parsed = parser.parseAll();
            ast = parsed.ast;
            const errors = parsed.errors;
            if (errors.length === 0) {
                elements.astOutputArea.textContent = JSON.stringify(ast, null, 2);
                await uiInterpreterInstance.run(ast);
            } else {
                elements.astOutputArea.classList.add('error-box');
                elements.astOutputArea.textContent = `Error: ${errors[0].message}`;
                updateExecStatus([], script.split(/\r?\n/).length || 1, errors, script.split(/\r?\n/));
                return;
            }

        } catch (e) {
            elements.astOutputArea.classList.add('error-box');
            const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
            const stackTrace = e instanceof Error && e.stack ? "\n" + e.stack.split('\n').slice(0,3).join('\n') : '';
            elements.astOutputArea.textContent = `Error: ${errorMessage}${stackTrace}`;
            uiInterpreterInstance.log(`Error during parsing or execution: ${errorMessage}`);
            console.error('Full error object:', e);
        } finally {
            renderPeekOutputsUI();
            if (ast) {
                renderDag(buildDag(ast), { onNodeClick: showOutputForLine });
            }
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
            highlightDagNodeForLine(line);
        }
    });
    elements.inputArea?.addEventListener('click', () => {
        const line = getCursorLineNumber();
        if (line) {
            showOutputForLine(line);
            updateVarBlockIndicator(line);
            highlightDagNodeForLine(line);
        }
    });

    elements.inputArea?.addEventListener('mousemove', (e) => {
        const rect = elements.inputArea.getBoundingClientRect();
        const style = getComputedStyle(elements.inputArea);
        const lineHeight = parseFloat(style.lineHeight);
        const y = e.clientY - rect.top + elements.inputArea.scrollTop;
        const line = Math.floor(y / lineHeight) + 1;
        highlightDagNodeForLine(line);
    });
}

export { renderPeekOutputsUI, generatePeekHtmlForDisplay, clearOutputs };
