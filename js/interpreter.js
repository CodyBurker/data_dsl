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
        let currentDataset = this.variables[this.activeVariableName];

        switch (command) {
            case 'LOAD_CSV':
                this.variables[this.activeVariableName] = await this.handleLoadCsv(args);
                break;
            case 'KEEP_COLUMNS':
                if (!(currentDataset instanceof dfd.DataFrame)) {
                    throw new Error(`No valid DataFrame loaded for VAR "${this.activeVariableName}" to apply KEEP_COLUMNS.`);
                }
                this.variables[this.activeVariableName] = this.handleKeepColumns(args, currentDataset);
                break;
            case 'PEEK':
                // currentDataset is already what we want (DataFrame or null)
                const peekLine = commandNode.line;
                const peekId = `peek-${this.activeVariableName || 'context'}-l${peekLine}-idx${this.peekOutputs.length}`;

                this.peekOutputs.push({
                    id: peekId,
                    varName: this.activeVariableName || 'Current Context',
                    line: peekLine,
                    dataset: currentDataset // Store raw DataFrame (or null/other)
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
        if (!this.uiElements.csvFileInputEl) throw new Error("File input not available.");
        const file = await this.requestCsvFile(args.file, this.activeVariableName);

        return new Promise((resolve, reject) => {
            this.log(`Using PapaParse for CSV parsing for VAR "${this.activeVariableName}".`);
            if (typeof Papa === 'undefined') {
                this.log('PapaParse library is not loaded.');
                if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                reject(new Error('PapaParse library is not available.'));
                return;
            }
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true, // Automatically convert numbers, booleans
                complete: (results) => {
                    this.log(`Loaded ${results.data.length} rows for VAR "${this.activeVariableName}" from ${file.name}. Headers: ${results.meta.fields ? results.meta.fields.join(', ') : 'N/A'}`);
                    if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                    
                    // Convert to Danfo.js DataFrame
                    if (typeof dfd === 'undefined') {
                        reject(new Error('Danfo.js (dfd) library is not available.'));
                        return;
                    }
                    const df = new dfd.DataFrame(results.data);
                    this.log(`Converted to Danfo.js DataFrame for VAR "${this.activeVariableName}". Shape: (${df.shape[0]}, ${df.shape[1]})`);
                    resolve(df); // Resolve with the DataFrame
                },
                error: (err) => {
                    this.log(`PapaParse error for VAR "${this.activeVariableName}": ${err.message}`);
                    if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                    reject(err);
                }
            });
        });
    }

    handleKeepColumns(args, currentDataset) { // currentDataset is now a Danfo.js DataFrame
        // No need to check `!currentDataset` here as it's checked before calling in executeCommand
        const { columns } = args;
        if (!Array.isArray(columns)) {
            throw new Error(`Invalid columns argument for KEEP_COLUMNS in VAR "${this.activeVariableName}".`);
        }

        // Danfo.js is case-sensitive. Find actual column names matching requested ones (case-insensitive)
        // This is a common pattern if user input for column names might not match case exactly.
        const dfColumns = currentDataset.columns;
        const columnsToKeep = columns.map(requestedCol => {
            const foundCol = dfColumns.find(dfCol => dfCol.toLowerCase() === requestedCol.toLowerCase());
            if (!foundCol) {
                this.log(`Warning: Column "${requestedCol}" not found in DataFrame for VAR "${this.activeVariableName}". Available columns: ${dfColumns.join(', ')}`);
            }
            return foundCol || requestedCol; // Keep original if not found to let Danfo.js handle the error or non-selection
        }).filter(col => dfColumns.includes(col)); // Only keep columns that actually exist to avoid errors

        if (columnsToKeep.length === 0 && columns.length > 0) {
             throw new Error(`None of the specified columns for KEEP_COLUMNS were found in VAR "${this.activeVariableName}". Requested: ${columns.join(', ')}. Available: ${dfColumns.join(', ')}`);
        }


        const newDataset = currentDataset.loc({ columns: columnsToKeep });
        this.log(`Kept columns: ${columnsToKeep.join(', ')} for VAR "${this.activeVariableName}". New shape: (${newDataset.shape[0]}, ${newDataset.shape[1]}).`);
        return newDataset;
    }

    async handleExportCsv(args, dataset) {
        const fileName = args.file || 'export.csv';

        if (dataset instanceof dfd.DataFrame) {
            if (dataset.count() === 0) {
                this.log(`EXPORT_CSV skipped: DataFrame in VAR "${this.activeVariableName}" is empty.`);
                return;
            }
            const csvString = Papa.unparse(dataset.toJSON());
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.log(`Exported DataFrame from VAR "${this.activeVariableName}" to ${fileName}.`);
        } else if (Array.isArray(dataset) && dataset.length > 0 && typeof dataset[0] === 'object') {
            const csvString = Papa.unparse(dataset);
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.log(`Exported array of objects from VAR "${this.activeVariableName}" to ${fileName}.`);
        } else {
            throw new Error(`EXPORT_CSV does not support dataset type: ${typeof dataset}`);
        }
    }
}