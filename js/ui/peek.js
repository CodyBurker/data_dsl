// js/ui/peek.js

import { elements } from './elements.js';
import { applySyntaxHighlighting, escapeHtml } from './highlight.js';
import * as XLSX from 'xlsx';

// Build HTML to display a peeked dataset.
function generatePeekHtmlForDisplay(datasetToPeek, varName, line) {
    if (datasetToPeek && typeof datasetToPeek.objects === 'function') {
        datasetToPeek = datasetToPeek.objects();
    }
    let outputHTML = `<h3 class="text-md font-semibold mb-2 text-gray-100">Data for: ${varName || 'Current Context'} (Line ${line})</h3>`;

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

// Update the special "Active" tab with new data. Optionally activate the tab.
function updateActiveTab(dataset, varName, line, activate = false) {
    const tabButton = elements.peekTabsContainerEl?.querySelector('.peek-tab[data-special="active"]');
    const contentDiv = elements.peekOutputsDisplayAreaEl?.querySelector('#active-peek-content');
    if (!tabButton || !contentDiv) return;
    tabButton.dataset.line = line;
    contentDiv.innerHTML = generatePeekHtmlForDisplay(dataset, varName, line);
    if (activate) {
        elements.peekTabsContainerEl.querySelectorAll('.peek-tab').forEach(t => t.classList.remove('active-peek-tab'));
        elements.peekOutputsDisplayAreaEl.querySelectorAll('.peek-content').forEach(c => c.classList.remove('active-peek-content'));
        tabButton.classList.add('active-peek-tab');
        contentDiv.classList.add('active-peek-content');
    }
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
        if (elements.exportExcelButton) elements.exportExcelButton.classList.add('hidden');
        clearEditorPeekHighlight({ currentLineRef });
        return;
    }

    if (elements.exportPeekButton) elements.exportPeekButton.classList.remove('hidden');
    if (elements.exportExcelButton) elements.exportExcelButton.classList.remove('hidden');

    const activeTab = document.createElement('button');
    activeTab.classList.add('peek-tab', 'active-peek-tab');
    activeTab.textContent = 'Active';
    activeTab.dataset.target = 'active-peek-content';
    activeTab.dataset.special = 'active';
    elements.peekTabsContainerEl.appendChild(activeTab);

    const activeContent = document.createElement('div');
    activeContent.id = 'active-peek-content';
    activeContent.classList.add('peek-content', 'active-peek-content');
    activeContent.innerHTML = '<div class="output-box-placeholder">Select a line to see output.</div>';
    elements.peekOutputsDisplayAreaEl.appendChild(activeContent);

    // When the Active tab is clicked, refresh its preview using the last
    // highlighted line or the current cursor position without moving the cursor.
    activeTab.addEventListener('click', () => {
        const inputEl = elements.inputArea;
        let lineNum = currentLineRef.currentLine;
        if (lineNum == null && inputEl) {
            const val = inputEl.value.slice(0, inputEl.selectionStart);
            lineNum = val.split(/\r?\n/).length;
        }
        if (lineNum == null) return;

        let dataset = null;
        let varName = null;
        const stepOutputsArr = interpreter.stepOutputs || [];
        for (let i = stepOutputsArr.length - 1; i >= 0; i--) {
            const s = stepOutputsArr[i];
            if (s.line === lineNum) { dataset = s.dataset; varName = s.varName; break; }
        }
        if (!dataset) {
            const peekOutputsArr = interpreter.peekOutputs || [];
            for (let i = peekOutputsArr.length - 1; i >= 0; i--) {
                const p = peekOutputsArr[i];
                if (p.line === lineNum) { dataset = p.dataset; varName = p.varName; break; }
            }
        }

        if (dataset) {
            updateActiveTab(dataset, varName, lineNum, true);
        }
    });

    const finalOutputs = [];
    const seen = new Set();
    stepOutputs.forEach((s) => {
        if (s.id && s.id.endsWith('-final') && !seen.has(s.varName)) {
            finalOutputs.push(s);
            seen.add(s.varName);
        }
    });

    finalOutputs.forEach((finalData) => {
        const tabButton = document.createElement('button');
        tabButton.classList.add('peek-tab');
        tabButton.textContent = finalData.varName;
        tabButton.dataset.target = `final-${finalData.varName}`;
        tabButton.dataset.line = finalData.line;
        tabButton.dataset.finalVar = finalData.varName;

        const contentDiv = document.createElement('div');
        contentDiv.id = `final-${finalData.varName}`;
        contentDiv.classList.add('peek-content');
        contentDiv.innerHTML = generatePeekHtmlForDisplay(finalData.dataset, finalData.varName, finalData.line);

        elements.peekTabsContainerEl.appendChild(tabButton);
        elements.peekOutputsDisplayAreaEl.appendChild(contentDiv);

        tabButton.addEventListener('click', () => {
            elements.peekTabsContainerEl.querySelectorAll('.peek-tab').forEach(t => t.classList.remove('active-peek-tab'));
            elements.peekOutputsDisplayAreaEl.querySelectorAll('.peek-content').forEach(c => c.classList.remove('active-peek-content'));
            tabButton.classList.add('active-peek-tab');
            contentDiv.classList.add('active-peek-content');
            updateActiveTab(finalData.dataset, finalData.varName, finalData.line, false);
        });
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

            updateActiveTab(peekData.dataset, peekData.varName, peekData.line, false);
        });

        if (index === 0) {
            tabButton.click();
        }
    });

    let lastData = null;
    if (stepOutputs.length > 0) {
        lastData = stepOutputs[stepOutputs.length - 1];
    } else if (peekOutputs.length > 0) {
        lastData = peekOutputs[peekOutputs.length - 1];
    }

    if (lastData) {
        updateActiveTab(lastData.dataset, lastData.varName, lastData.line, true);
        if (elements.inputArea && elements.highlightingOverlay) {
            elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(elements.inputArea.value, lastData.line);
            currentLineRef.currentLine = lastData.line;
            updateVarBlockIndicator(lastData.line);
        }
    }
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

    let datasetEntry = null;

    if (activeTab.dataset.peekIndex) {
        const idx = parseInt(activeTab.dataset.peekIndex, 10);
        if (!Number.isNaN(idx)) datasetEntry = interpreter.peekOutputs[idx];
    } else if (activeTab.dataset.finalVar) {
        const stepOutputs = interpreter.stepOutputs || [];
        for (const s of stepOutputs) {
            if (s.id && s.id.endsWith('-final') && s.varName === activeTab.dataset.finalVar) {
                datasetEntry = s;
                break;
            }
        }
    } else if (activeTab.dataset.special === 'active') {
        const line = parseInt(activeTab.dataset.line, 10);
        if (!Number.isNaN(line)) {
            const stepOutputs = interpreter.stepOutputs || [];
            for (let i = stepOutputs.length - 1; i >= 0; i--) {
                const s = stepOutputs[i];
                if (s.line === line) { datasetEntry = s; break; }
            }
            if (!datasetEntry) {
                const peekOutputs = interpreter.peekOutputs || [];
                for (let i = peekOutputs.length - 1; i >= 0; i--) {
                    const p = peekOutputs[i];
                    if (p.line === line) { datasetEntry = p; break; }
                }
            }
        }
    }

    if (!datasetEntry || !datasetEntry.dataset) {
        alert('Could not find data for the active PEEK tab.');
        return;
    }

    let dataset = datasetEntry.dataset;
    if (dataset && typeof dataset.objects === 'function') {
        dataset = dataset.objects();
    }

    if (Array.isArray(dataset) && dataset.length > 0 && typeof dataset[0] === 'object') {
        try {
            const papaCSV = Papa.unparse(dataset);
            const blob = new Blob([papaCSV], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            let fileName = `export_${datasetEntry.varName}_L${datasetEntry.line}.csv`;
            if (datasetEntry.id && datasetEntry.id.endsWith('-final')) {
                fileName = `${datasetEntry.varName}.csv`;
            }
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            interpreter.log(`Exported PEEK data (array of objects) for VAR "${datasetEntry.varName}" (Line ${datasetEntry.line}) to CSV.`);
        } catch (error) {
            console.error('Error exporting array of objects to CSV:', error);
            alert('Failed to export data to CSV. See console for details.');
            interpreter.log(`Error exporting PEEK (array of objects) for VAR "${datasetEntry.varName}" to CSV: ${error.message}`);
        }
    } else {
        alert('The active PEEK tab data is not in a format that can be exported to CSV.');
        interpreter.log(`PEEK data for VAR "${datasetEntry.varName}" (Line ${datasetEntry.line}) is not exportable to CSV (type: ${typeof dataset})`);
    }
}

function handleExportPeekExcel(interpreter) {
    if (!interpreter || !elements.peekTabsContainerEl) return;

    const activeTab = elements.peekTabsContainerEl.querySelector('.peek-tab.active-peek-tab');
    if (!activeTab) {
        alert('No active PEEK tab found to export.');
        return;
    }

    let datasetEntry = null;

    if (activeTab.dataset.peekIndex) {
        const idx = parseInt(activeTab.dataset.peekIndex, 10);
        if (!Number.isNaN(idx)) datasetEntry = interpreter.peekOutputs[idx];
    } else if (activeTab.dataset.finalVar) {
        const stepOutputs = interpreter.stepOutputs || [];
        for (const s of stepOutputs) {
            if (s.id && s.id.endsWith('-final') && s.varName === activeTab.dataset.finalVar) {
                datasetEntry = s;
                break;
            }
        }
    } else if (activeTab.dataset.special === 'active') {
        const line = parseInt(activeTab.dataset.line, 10);
        if (!Number.isNaN(line)) {
            const stepOutputs = interpreter.stepOutputs || [];
            for (let i = stepOutputs.length - 1; i >= 0; i--) {
                const s = stepOutputs[i];
                if (s.line === line) { datasetEntry = s; break; }
            }
            if (!datasetEntry) {
                const peekOutputs = interpreter.peekOutputs || [];
                for (let i = peekOutputs.length - 1; i >= 0; i--) {
                    const p = peekOutputs[i];
                    if (p.line === line) { datasetEntry = p; break; }
                }
            }
        }
    }

    if (!datasetEntry || !datasetEntry.dataset) {
        alert('Could not find data for the active PEEK tab.');
        return;
    }

    let dataset = datasetEntry.dataset;
    if (dataset && typeof dataset.objects === 'function') {
        dataset = dataset.objects();
    }

    if (Array.isArray(dataset) && dataset.length > 0 && typeof dataset[0] === 'object') {
        try {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dataset);
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            let fileName = `export_${datasetEntry.varName}_L${datasetEntry.line}.xlsx`;
            if (datasetEntry.id && datasetEntry.id.endsWith('-final')) {
                fileName = `${datasetEntry.varName}.xlsx`;
            }
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            interpreter.log(`Exported PEEK data (array of objects) for VAR "${datasetEntry.varName}" (Line ${datasetEntry.line}) to Excel.`);
        } catch (error) {
            console.error('Error exporting array of objects to Excel:', error);
            alert('Failed to export data to Excel. See console for details.');
            interpreter.log(`Error exporting PEEK (array of objects) for VAR "${datasetEntry.varName}" to Excel: ${error.message}`);
        }
    } else {
        alert('The active PEEK tab data is not in a format that can be exported to Excel.');
        interpreter.log(`PEEK data for VAR "${datasetEntry.varName}" (Line ${datasetEntry.line}) is not exportable to Excel (type: ${typeof dataset})`);
    }
}

export {
    generatePeekHtmlForDisplay,
    renderPeekOutputsUI,
    updateActiveTab,
    clearEditorPeekHighlight,
    handleExportPeek,
    handleExportPeekExcel
};
