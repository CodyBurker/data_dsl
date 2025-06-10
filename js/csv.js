// js/csv.js

// CSV-related helper functions used by the Interpreter. All functions expect
// the interpreter instance as the first argument so logging and UI updates
// remain consistent.
import { from } from 'arquero';

export async function loadCsv(interp, args) {
    const fileName = args.file;
    if (!fileName) throw new Error('LOAD_CSV requires FILE argument.');

    if (typeof fetch !== 'undefined') {
        try {
            const resp = await fetch(`examples/${fileName}`);
            if (resp.ok) {
                const text = await resp.text();
                return await parseCsvInput(interp, text, fileName);
            }
        } catch (err) {
            interp.log(`Fetch for example ${fileName} failed: ${err.message}`);
        }
    }

    if (!interp.uiElements.csvFileInputEl) throw new Error('File input not available.');
    const file = await interp.requestCsvFile(fileName, interp.activeVariableName);
    return parseCsvInput(interp, file, file.name);
}

export function parseCsvInput(interp, input, name) {
    return new Promise((resolve, reject) => {
        interp.log(`Using PapaParse for CSV parsing for VAR "${interp.activeVariableName}".`);
        if (typeof Papa === 'undefined') {
            interp.log('PapaParse library is not loaded.');
            if (interp.uiElements.fileInputContainerEl) interp.uiElements.fileInputContainerEl.classList.add('hidden');
            reject(new Error('PapaParse library is not available.'));
            return;
        }
        Papa.parse(input, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => {
                interp.log(`Loaded ${results.data.length} rows for VAR "${interp.activeVariableName}" from ${name}. Headers: ${results.meta.fields ? results.meta.fields.join(', ') : 'N/A'}`);
                if (interp.uiElements.fileInputContainerEl) interp.uiElements.fileInputContainerEl.classList.add('hidden');
                const rows = results.data;
                const table = from(rows);
                interp.log(`Parsed CSV for VAR "${interp.activeVariableName}". Rows: ${table.numRows()}`);
                resolve(table);
            },
            error: (err) => {
                interp.log(`PapaParse error for VAR "${interp.activeVariableName}": ${err.message}`);
                if (interp.uiElements.fileInputContainerEl) interp.uiElements.fileInputContainerEl.classList.add('hidden');
                reject(err);
            }
        });
    });
}

export async function exportCsv(interp, args, dataset) {
    const fileName = args.file || 'export.csv';

    let rows = null;
    if (dataset && typeof dataset.objects === 'function') {
        rows = dataset.objects();
    } else if (Array.isArray(dataset)) {
        rows = dataset;
    }

    if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object') {
        const csvString = Papa.unparse(rows);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        interp.log(`Exported data from VAR "${interp.activeVariableName}" to ${fileName}.`);
    } else {
        throw new Error(`EXPORT_CSV does not support dataset type: ${typeof dataset}`);
    }
}

