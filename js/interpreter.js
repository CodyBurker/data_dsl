// interpreter.js
import { cities as sampleCities, people as samplePeople } from './samples.js';
import { loadCsv, exportCsv } from './csv.js';
import { keepColumns, withColumn, filterRows, joinDatasets } from './datasetOps.js';

export class Interpreter {
    constructor(uiElements) {
        this.variables = {};
        this.activeVariableName = null;
        this.peekOutputs = [];
        this.stepOutputs = [];
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
        this.variables = {
            cities: sampleCities.map(r => ({ ...r })),
            people: samplePeople.map(r => ({ ...r }))
        };
        this.activeVariableName = null;
        this.peekOutputs = [];
        this.stepOutputs = [];
        this.fileResolve = null; // Should be reset if a run is interrupted
        this.log('Interpreter state cleared. Built-in samples loaded.');
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
            const varLine = varBlock.line;
            this.log(`Processing block for VAR "${this.activeVariableName}"`);
            this.variables[this.activeVariableName] = null;

            for (let index = 0; index < varBlock.pipeline.length; index++) {
                const commandNode = varBlock.pipeline[index];
                this.log(`Executing: ${commandNode.command} for VAR "${this.activeVariableName}"` + (commandNode.line ? ` (Line ${commandNode.line})` : ''));
                try {
                    await this.executeCommand(commandNode);
                    const dataset = this.variables[this.activeVariableName];
                    const stepId = `step-${this.activeVariableName}-l${commandNode.line}-${index}`;
                    this.stepOutputs.push({ id: stepId, varName: this.activeVariableName, line: commandNode.line, dataset });
                } catch (e) {
                    const err = e instanceof Error ? e.message : JSON.stringify(e);
                    this.log(`ERROR executing ${commandNode.command} for VAR "${this.activeVariableName}": ${err}`);
                    console.error(`Error details for ${commandNode.command} (VAR "${this.activeVariableName}"):`, e);
                    if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                    // UI will handle rendering peek outputs based on this.peekOutputs
                    return; // Stop execution on error
                }
            }
            // record final dataset for the VAR line itself
            const finalDataset = this.variables[this.activeVariableName];
            const finalStepId = `step-${this.activeVariableName}-l${varLine}-final`;
            this.stepOutputs.push({ id: finalStepId, varName: this.activeVariableName, line: varLine, dataset: finalDataset });
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
                this.variables[this.activeVariableName] = await loadCsv(this, args);
                break;
            case 'KEEP_COLUMNS':
            case 'SELECT':
                if (!Array.isArray(currentDataset)) {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply ${command}.`);
                }
                this.variables[this.activeVariableName] = keepColumns(this, args, currentDataset);
                break;
            case 'JOIN':
                if (!Array.isArray(currentDataset)) {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply JOIN.`);
                }
                this.variables[this.activeVariableName] = joinDatasets(this, args, currentDataset);
                break;
            case 'FILTER':
                if (!Array.isArray(currentDataset)) {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply FILTER.`);
                }
                this.variables[this.activeVariableName] = filterRows(this, args, currentDataset);
                break;
            case 'WITH_COLUMN':
                if (!Array.isArray(currentDataset)) {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply WITH_COLUMN.`);
                }
                this.variables[this.activeVariableName] = withColumn(this, args, currentDataset);
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
                await exportCsv(this, args, currentDataset);
                break;
            default: this.log(`Command ${command} for VAR "${this.activeVariableName}" is parsed but not yet fully implemented.`);
        }
    }

}
