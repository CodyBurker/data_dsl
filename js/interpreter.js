// interpreter.js

export class Interpreter {
    constructor(uiElements) {
        this.variables = {};
        this.activeVariableName = null;
        this.peekOutputs = [];
        this.fileResolve = null;

        // Store references to UI elements passed from ui.js
        this.uiElements = uiElements;
    }

    log(message) {
        console.log(message);
        const time = new Date().toLocaleTimeString();
        if (this.uiElements.logOutputEl) {
            this.uiElements.logOutputEl.innerHTML += `[${time}] ${message}<br>`;
            this.uiElements.logOutputEl.scrollTop = this.uiElements.logOutputEl.scrollHeight;
        }
    }

    clearInternalState() {
        this.variables = {};
        this.activeVariableName = null;
        this.peekOutputs = [];
        this.fileResolve = null; // Should be reset if a run is interrupted
        this.log('Interpreter state cleared.');
    }

    async requestCsvFile(fileNameHint, forVariable) {
        this.uiElements.fileInputContainerEl.classList.remove('hidden');
        this.uiElements.filePromptMessageEl.textContent = `Pipeline for VAR "${forVariable}": Select CSV for ${fileNameHint}.`;
        this.uiElements.csvFileInputEl.value = ''; // Clear previous selection
        return new Promise((resolve, reject) => {
            this.fileResolve = (file) => {
                if (file) {
                    resolve(file);
                } else {
                    this.log(`File selection cancelled for VAR "${forVariable}".`);
                    reject(new Error("File selection cancelled or no file provided."));
                }
            };
            // The actual event listener is in ui.js, it will call this.fileResolve
        });
    }

    async run(ast) {
        this.log('Interpreter started.');
        this.clearInternalState(); // Clear state from previous runs

        for (const varBlock of ast) {
            this.activeVariableName = varBlock.variableName;
            this.log(`Processing block for VAR "${this.activeVariableName}"`);
            this.variables[this.activeVariableName] = null;

            for (const commandNode of varBlock.pipeline) {
                this.log(`Executing: ${commandNode.command} for VAR "${this.activeVariableName}"` + (commandNode.line ? ` (Line ${commandNode.line})` : ''));
                try {
                    await this.executeCommand(commandNode);
                } catch (e) {
                    const err = e instanceof Error ? e.message : JSON.stringify(e);
                    this.log(`ERROR executing ${commandNode.command} for VAR "${this.activeVariableName}": ${err}`);
                    console.error(`Error details for ${commandNode.command} (VAR "${this.activeVariableName}"):`, e);
                    if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                    // UI will handle rendering peek outputs based on this.peekOutputs
                    return; // Stop execution on error
                }
            }
            this.log(`Finished block for VAR "${this.activeVariableName}"`);
        }
        this.log('Interpreter finished all blocks.');
        this.activeVariableName = null;
        if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
    }

    async executeCommand(commandNode) {
        const { command, args } = commandNode;
        let currentDataset = this.variables[this.activeVariableName];

        switch (command) {
            case 'LOAD_CSV':
                this.variables[this.activeVariableName] = await this.handleLoadCsv(args);
                break;
            case 'KEEP_COLUMNS':
            case 'SELECT':
                if (!Array.isArray(currentDataset)) {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply ${command}.`);
                }
                this.variables[this.activeVariableName] = this.handleKeepColumns(args, currentDataset);
                break;
            case 'JOIN':
                if (!Array.isArray(currentDataset)) {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply JOIN.`);
                }
                this.variables[this.activeVariableName] = this.handleJoin(args, currentDataset);
                break;
            case 'PEEK':
                // currentDataset is already what we want (array or null)
                const peekLine = commandNode.line;
                const peekId = `peek-${this.activeVariableName || 'context'}-l${peekLine}-idx${this.peekOutputs.length}`;

                this.peekOutputs.push({
                    id: peekId,
                    varName: this.activeVariableName || 'Current Context',
                    line: peekLine,
                    dataset: currentDataset // Store raw dataset (array or other)
                });
                this.log(`PEEK data for VAR "${this.activeVariableName}" (Line ${peekLine}) captured.`);
                break;
            case 'EXPORT_CSV':
                if (!currentDataset) {
                    throw new Error(`No dataset available in VAR "${this.activeVariableName}" to export.`);
                }
                await this.handleExportCsv(args, currentDataset);
                break;
            default: this.log(`Command ${command} for VAR "${this.activeVariableName}" is parsed but not yet fully implemented.`);
        }
    }

    async handleLoadCsv(args) {
        const fileName = args.file;
        if (!fileName) throw new Error('LOAD_CSV requires FILE argument.');

        if (typeof fetch !== 'undefined') {
            try {
                const resp = await fetch(`examples/${fileName}`);
                if (resp.ok) {
                    const text = await resp.text();
                    return await this.parseCsvInput(text, fileName);
                }
            } catch (err) {
                this.log(`Fetch for example ${fileName} failed: ${err.message}`);
            }
        }

        if (!this.uiElements.csvFileInputEl) throw new Error('File input not available.');
        const file = await this.requestCsvFile(fileName, this.activeVariableName);
        return this.parseCsvInput(file, file.name);
    }

    parseCsvInput(input, name) {
        return new Promise((resolve, reject) => {
            this.log(`Using PapaParse for CSV parsing for VAR "${this.activeVariableName}".`);
            if (typeof Papa === 'undefined') {
                this.log('PapaParse library is not loaded.');
                if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                reject(new Error('PapaParse library is not available.'));
                return;
            }
            Papa.parse(input, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete: (results) => {
                    this.log(`Loaded ${results.data.length} rows for VAR "${this.activeVariableName}" from ${name}. Headers: ${results.meta.fields ? results.meta.fields.join(', ') : 'N/A'}`);
                    if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                    const rows = results.data;
                    this.log(`Parsed CSV for VAR "${this.activeVariableName}". Rows: ${rows.length}`);
                    resolve(rows);
                },
                error: (err) => {
                    this.log(`PapaParse error for VAR "${this.activeVariableName}": ${err.message}`);
                    if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                    reject(err);
                }
            });
        });
    }

    handleKeepColumns(args, currentDataset) {
        // currentDataset is an array of objects
        const { columns } = args;
        if (!Array.isArray(columns)) {
            throw new Error(`Invalid columns argument for KEEP_COLUMNS in VAR "${this.activeVariableName}".`);
        }
        if (!Array.isArray(currentDataset) || currentDataset.length === 0) {
            return [];
        }
        const allCols = Object.keys(currentDataset[0]);
        const columnsToKeep = columns.map(c => allCols.find(ac => ac.toLowerCase() === c.toLowerCase())).filter(Boolean);

        if (columnsToKeep.length === 0) {
            throw new Error(`None of the specified columns for KEEP_COLUMNS were found in VAR "${this.activeVariableName}".`);
        }

        const newDataset = currentDataset.map(row => {
            const obj = {};
            columnsToKeep.forEach(col => { obj[col] = row[col]; });
            return obj;
        });
        this.log(`Kept columns: ${columnsToKeep.join(', ')} for VAR "${this.activeVariableName}".`);
        return newDataset;
    }

    handleJoin(args, currentDataset) {
        const { variable, leftKey, rightKey, type = 'INNER' } = args;
        const other = this.variables[variable];
        if (!Array.isArray(other)) {
            throw new Error(`JOIN target VAR "${variable}" is not loaded or not an array.`);
        }
        if (!Array.isArray(currentDataset)) {
            throw new Error(`Current dataset for VAR "${this.activeVariableName}" is not an array.`);
        }

        const map = new Map();
        for (const row of other) {
            if (row.hasOwnProperty(rightKey)) {
                const key = row[rightKey];
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(row);
            }
        }

        const joined = [];
        for (const lRow of currentDataset) {
            const key = lRow[leftKey];
            const matches = map.get(key);
            if (matches) {
                for (const rRow of matches) {
                    joined.push({ ...lRow, ...rRow });
                }
            } else if (type === 'LEFT') {
                joined.push({ ...lRow });
            }
        }
        this.log(`JOIN ${type} completed using '${leftKey}' = '${rightKey}' with VAR "${variable}". Rows: ${joined.length}`);
        return joined;
    }

    async handleExportCsv(args, dataset) {
        const fileName = args.file || 'export.csv';

        if (Array.isArray(dataset) && dataset.length > 0 && typeof dataset[0] === 'object') {
            const csvString = Papa.unparse(dataset);
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.log(`Exported data from VAR "${this.activeVariableName}" to ${fileName}.`);
        } else {
            throw new Error(`EXPORT_CSV does not support dataset type: ${typeof dataset}`);
        }
    }
}
