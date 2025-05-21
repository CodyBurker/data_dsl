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
        switch (command) {
            case 'LOAD_CSV':
                this.variables[this.activeVariableName] = await this.handleLoadCsv(args);
                break;
            case 'KEEP_COLUMNS':
                this.variables[this.activeVariableName] = this.handleKeepColumns(args, this.variables[this.activeVariableName]);
                break;
            case 'PEEK':
                const currentDataset = this.variables[this.activeVariableName];
                const peekLine = commandNode.line;
                // HTML generation is moved to ui.js or happens during rendering there
                const peekId = `peek-${this.activeVariableName || 'context'}-l${peekLine}-idx${this.peekOutputs.length}`;

                this.peekOutputs.push({
                    id: peekId,
                    varName: this.activeVariableName || 'Current Context',
                    line: peekLine,
                    dataset: currentDataset // Store raw dataset
                });
                this.log(`PEEK data for VAR "${this.activeVariableName}" (Line ${peekLine}) captured.`);
                break;
            case 'STORE_AS':
                this.log(`Command STORE_AS for VAR "${this.activeVariableName}" is parsed. Current active dataset for "${this.activeVariableName}" will be copied to "${args.variableName}".`);
                if (this.variables[this.activeVariableName]) {
                    this.variables[args.variableName] = JSON.parse(JSON.stringify(this.variables[this.activeVariableName]));
                     this.log(`Dataset from VAR "${this.activeVariableName}" copied to new VAR "${args.variableName}".`);
                } else {
                    this.log(`Cannot STORE_AS: VAR "${this.activeVariableName}" has no data to copy.`);
                     throw new Error(`No data in VAR "${this.activeVariableName}" to copy using STORE_AS.`);
                }
                break;
            default: this.log(`Command ${command} for VAR "${this.activeVariableName}" is parsed but not yet fully implemented.`);
        }
    }

    async nativeParseCsv(fileContent) {
        return new Promise((resolve, reject) => {
            try {
                const lines = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(line => line.trim() !== '');
                if (lines.length === 0) { resolve({ data: [], meta: { fields: [] } }); return; }
                const headers = lines[0].split(',').map(h => h.trim());
                const data = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim());
                    const row = {};
                    headers.forEach((h, idx) => {
                        let v = values[idx];
                        if (v !== undefined && v !== "" && !isNaN(Number(v))) v = Number(v);
                        else if (v && (v.toLowerCase()==='true' || v.toLowerCase()==='false')) v = v.toLowerCase()==='true';
                        row[h] = v;
                    });
                    data.push(row);
                }
                resolve({ data, meta: { fields: headers } });
            } catch (err) { reject(err); }
        });
    }

    async handleLoadCsv(args) {
        if (!this.uiElements.csvFileInputEl) throw new Error("File input not available.");
        const file = await this.requestCsvFile(args.file, this.activeVariableName);

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    this.log(`Using native CSV parser for VAR "${this.activeVariableName}".`);
                    const results = await this.nativeParseCsv(event.target.result);
                    this.log(`Loaded ${results.data.length} rows for VAR "${this.activeVariableName}" from ${file.name}. Headers: ${results.meta.fields ? results.meta.fields.join(', ') : 'N/A'}`);
                    if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                    resolve(results.data);
                } catch (err) {
                    this.log(`Native CSV parsing error for VAR "${this.activeVariableName}": ${err.message}`);
                    if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                    reject(err);
                }
            };
            reader.onerror = (err) => {
                this.log(`FileReader error for VAR "${this.activeVariableName}": ${err.message}`);
                if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                reject(err);
            };
            reader.readAsText(file);
        });
    }

    handleKeepColumns(args, currentDataset) {
        if (!currentDataset) throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply KEEP_COLUMNS.`);
        const { columns } = args;
        if (!Array.isArray(columns)) throw new Error(`Invalid columns argument for KEEP_COLUMNS in VAR "${this.activeVariableName}".`);

        const newDataset = currentDataset.map(row => {
            const newRow = {};
            columns.forEach(colName => {
                const actualColName = Object.keys(row).find(key => key.toLowerCase() === colName.toLowerCase()) || colName;
                if (row.hasOwnProperty(actualColName)) newRow[colName] = row[actualColName];
            });
            return newRow;
        });
        this.log(`Kept columns: ${columns.join(', ')} for VAR "${this.activeVariableName}". Rows: ${newDataset.length}.`);
        return newDataset;
    }
}