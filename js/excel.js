import { from } from 'arquero';
import * as XLSX from 'xlsx';

export async function loadExcel(interp, args) {
    const { file, sheet = null, range = null } = args;
    if (!file) throw new Error('LOAD_EXCEL requires FILE argument.');

    let workbook = null;
    if (typeof fetch !== 'undefined') {
        try {
            const resp = await fetch(`examples/${file}`);
            if (resp.ok) {
                const buffer = await resp.arrayBuffer();
                workbook = XLSX.read(buffer, { type: 'array' });
            }
        } catch (err) {
            interp.log(`Fetch for example ${file} failed: ${err.message}`);
        }
    }

    if (!workbook) {
        if (!interp.uiElements.csvFileInputEl) throw new Error('File input not available.');
        const f = await interp.requestExcelFile(file, interp.activeVariableName);
        const buffer = await f.arrayBuffer();
        workbook = XLSX.read(buffer, { type: 'array' });
    }

    const sheetNames = workbook.SheetNames;
    let sheetName = sheet;
    if (typeof sheet === 'number') {
        if (sheet < 0 || sheet >= sheetNames.length) {
            throw new Error(`Sheet index ${sheet} out of range.`);
        }
        sheetName = sheetNames[sheet];
    } else if (typeof sheet === 'string' && sheet) {
        if (!sheetNames.includes(sheet)) {
            throw new Error(`Sheet name '${sheet}' not found.`);
        }
        sheetName = sheet;
    } else {
        sheetName = sheetNames[0];
    }

    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, range ? { range } : {});
    interp.log(`Loaded ${json.length} rows from ${file} sheet ${sheetName}${range ? ` range ${range}` : ''}.`);
    return from(json);
}

export async function exportExcel(interp, args, dataset) {
    const fileName = args.file || 'export.xlsx';
    const sheetName = args.sheet || 'Sheet1';

    let rows = null;
    if (dataset && typeof dataset.objects === 'function') {
        rows = dataset.objects();
    } else if (Array.isArray(dataset)) {
        rows = dataset;
    }

    if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        interp.log(`Exported data from VAR "${interp.activeVariableName}" to ${fileName} sheet ${sheetName}.`);
    } else {
        throw new Error(`EXPORT_EXCEL does not support dataset type: ${typeof dataset}`);
    }
}
