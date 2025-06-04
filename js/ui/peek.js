// js/ui/peek.js

import { elements } from './elements.js';
import { applySyntaxHighlighting, escapeHtml } from './highlight.js';

// Build HTML to display a peeked dataset.
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

// Render tabs and outputs for interpreter.peekOutputs and interpreter.stepOutputs.
function renderPeekOutputsUI(interpreter, { currentLineRef, updateVarBlockIndicator, suppressTabScrollRef }) {
    if (!elements.peekTabsContainerEl || !elements.peekOutputsDisplayAreaEl || !interpreter) {
        console.error('Peek UI elements not found or interpreter not set!');
        return;
    }

    elements.peekTabsContainerEl.innerHTML = '';
    elements.peekOutputsDisplayAreaEl.innerHTML = '';

    const peekOutputs = interpreter.peekOutputs;
    const stepOutputs = interpreter.stepOutputs;

    if (peekOutputs.length === 0 && stepOutputs.length === 0) {
        elements.peekOutputsDisplayAreaEl.innerHTML = '<div class="output-box-placeholder">No PEEK outputs to display.</div>';
        if (elements.exportPeekButton) elements.exportPeekButton.classList.add('hidden');
        clearEditorPeekHighlight({ currentLineRef });
        return;
    }

    if (elements.exportPeekButton) elements.exportPeekButton.classList.remove('hidden');

    stepOutputs.forEach((stepData, index) => {
        const tabButton = document.createElement('button');
        tabButton.classList.add('peek-tab');
        tabButton.textContent = stepData.varName;
        tabButton.dataset.target = stepData.id;
        tabButton.dataset.stepIndex = index;
        tabButton.dataset.line = stepData.line;

        const contentDiv = document.createElement('div');
        contentDiv.id = stepData.id;
        contentDiv.classList.add('peek-content');
        contentDiv.innerHTML = generatePeekHtmlForDisplay(stepData.dataset, stepData.varName, stepData.line);

        elements.peekTabsContainerEl.appendChild(tabButton);
        elements.peekOutputsDisplayAreaEl.appendChild(contentDiv);

        tabButton.addEventListener('click', () => {
            elements.peekTabsContainerEl.querySelectorAll('.peek-tab').forEach(tab => tab.classList.remove('active-peek-tab'));
            elements.peekOutputsDisplayAreaEl.querySelectorAll('.peek-content').forEach(content => content.classList.remove('active-peek-content'));

            tabButton.classList.add('active-peek-tab');
            contentDiv.classList.add('active-peek-content');

            if (elements.inputArea && elements.highlightingOverlay) {
                elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(elements.inputArea.value, stepData.line);
                currentLineRef.currentLine = stepData.line;
                const highlightedSpan = elements.highlightingOverlay.querySelector('#active-editor-peek-highlight');
                if (highlightedSpan) {
                    const scrollTargetOffset = highlightedSpan.offsetTop;
                    const inputAreaVisibleHeight = elements.inputArea.clientHeight;
                    const desiredScrollTop = scrollTargetOffset - (inputAreaVisibleHeight / 3);

                    if (!suppressTabScrollRef.suppressTabScroll) {
                        elements.inputArea.scrollTop = Math.max(0, desiredScrollTop);
                        elements.highlightingOverlay.scrollTop = elements.inputArea.scrollTop;
                    }
                }
                updateVarBlockIndicator(stepData.line);
            }
        });

        if (index === 0 && peekOutputs.length === 0) {
            tabButton.click();
        }
    });

    peekOutputs.forEach((peekData, index) => {
        const tabButton = document.createElement('button');
        tabButton.classList.add('peek-tab');
        tabButton.textContent = peekData.varName;
        tabButton.dataset.target = peekData.id;
        tabButton.dataset.peekIndex = index;
        tabButton.dataset.line = peekData.line;

        const contentDiv = document.createElement('div');
        contentDiv.id = peekData.id;
        contentDiv.classList.add('peek-content');
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
                currentLineRef.currentLine = peekData.line;

                const highlightedSpan = elements.highlightingOverlay.querySelector('#active-editor-peek-highlight');
                if (highlightedSpan) {
                    const scrollTargetOffset = highlightedSpan.offsetTop;
                    const inputAreaVisibleHeight = elements.inputArea.clientHeight;
                    const desiredScrollTop = scrollTargetOffset - (inputAreaVisibleHeight / 3);

                    if (!suppressTabScrollRef.suppressTabScroll) {
                        elements.inputArea.scrollTop = Math.max(0, desiredScrollTop);
                        elements.highlightingOverlay.scrollTop = elements.inputArea.scrollTop;
                    }
                }
                updateVarBlockIndicator(peekData.line);
            }
        });

        if (index === 0) {
            tabButton.click();
        }
    });
}

// Clear any highlight that was added by renderPeekOutputsUI.
function clearEditorPeekHighlight({ currentLineRef }) {
    if (elements.inputArea && elements.highlightingOverlay) {
        elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(elements.inputArea.value, null);
        currentLineRef.currentLine = null;
    }
}

// Export the currently selected PEEK tab's data to CSV using Papa.unparse.
function handleExportPeek(interpreter) {
    if (!interpreter || !elements.peekTabsContainerEl) return;

    const activeTab = elements.peekTabsContainerEl.querySelector('.peek-tab.active-peek-tab');
    if (!activeTab) {
        alert('No active PEEK tab found to export.');
        return;
    }

    const peekIndex = parseInt(activeTab.dataset.peekIndex, 10);
    const peekDataEntry = interpreter.peekOutputs[peekIndex];

    if (!peekDataEntry || !peekDataEntry.dataset) {
        alert('Could not find data for the active PEEK tab.');
        return;
    }

    const dataset = peekDataEntry.dataset;

    if (Array.isArray(dataset) && dataset.length > 0 && typeof dataset[0] === 'object') {
        try {
            const papaCSV = Papa.unparse(dataset);
            const blob = new Blob([papaCSV], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `peek_export_${peekDataEntry.varName}_L${peekDataEntry.line}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            interpreter.log(`Exported PEEK data (array of objects) for VAR "${peekDataEntry.varName}" (Line ${peekDataEntry.line}) to CSV.`);
        } catch (error) {
            console.error('Error exporting array of objects to CSV:', error);
            alert('Failed to export data to CSV. See console for details.');
            interpreter.log(`Error exporting PEEK (array of objects) for VAR "${peekDataEntry.varName}" to CSV: ${error.message}`);
        }
    } else {
        alert('The active PEEK tab data is not in a format that can be exported to CSV.');
        interpreter.log(`PEEK data for VAR "${peekDataEntry.varName}" (Line ${peekDataEntry.line}) is not exportable to CSV (type: ${typeof dataset})`);
    }
}

export {
    generatePeekHtmlForDisplay,
    renderPeekOutputsUI,
    clearEditorPeekHighlight,
    handleExportPeek
};
