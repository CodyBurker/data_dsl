// interpreter.js
import { cities as sampleCities, people as samplePeople } from './samples.js';
import { loadCsv, exportCsv } from './csv.js';
import { loadJson } from './json.js';
import { loadExcel, exportExcel } from './excel.js';
import { keepColumns, dropColumns, renameColumns, withColumn, filterRows, joinDatasets, groupBy, aggregate, sortDataset } from './datasetOps.js';
import { buildDag } from './dag.js';
import { from } from 'arquero';

export class Interpreter {
    constructor(uiElements) {
        this.variables = {};
        this.activeVariableName = null;
        this.peekOutputs = [];
        this.stepOutputs = [];
        this.fileResolve = null;
        // Cache keyed by node id { fingerprint, dataset, unusedCount, usedThisRun }.
        // unusedCount increments when a node isn't touched in a run so unused
        // datasets can later be evicted based on their age.
        this.cache = {};

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

    clearInternalState(resetCache = false) {
        this.variables = {
            cities: from(sampleCities.map(r => ({ ...r }))),
            people: from(samplePeople.map(r => ({ ...r })))
        };
        this.activeVariableName = null;
        this.peekOutputs = [];
        this.stepOutputs = [];
        this.fileResolve = null; // Should be reset if a run is interrupted
        if (resetCache) {
            this.cache = {};
            this.log('Interpreter cache cleared.');
        }
        this.log('Interpreter state cleared. Built-in samples loaded.');
    }

    async requestCsvFile(fileNameHint, forVariable) {
        this.uiElements.fileInputContainerEl.classList.remove('hidden');
        this.uiElements.filePromptMessageEl.textContent = `Pipeline for VAR "${forVariable}": Select CSV for ${fileNameHint}.`;
        this.uiElements.csvFileInputEl.value = ''; // Clear previous selection
        this.uiElements.csvFileInputEl.accept = '.csv,.txt';
        // Automatically trigger the file picker so the user doesn't need to click
        this.uiElements.csvFileInputEl.click();
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

    async requestJsonFile(fileNameHint, forVariable) {
        this.uiElements.fileInputContainerEl.classList.remove('hidden');
        this.uiElements.filePromptMessageEl.textContent = `Pipeline for VAR "${forVariable}": Select JSON for ${fileNameHint}.`;
        this.uiElements.csvFileInputEl.value = '';
        this.uiElements.csvFileInputEl.accept = '.json';
        this.uiElements.csvFileInputEl.click();
        return new Promise((resolve, reject) => {
            this.fileResolve = (file) => {
                if (file) {
                    resolve(file);
                } else {
                    this.log(`File selection cancelled for VAR "${forVariable}".`);
                    reject(new Error('File selection cancelled or no file provided.'));
                }
            };
        });
    }

    async requestExcelFile(fileNameHint, forVariable) {
        this.uiElements.fileInputContainerEl.classList.remove('hidden');
        this.uiElements.filePromptMessageEl.textContent = `Pipeline for VAR "${forVariable}": Select Excel for ${fileNameHint}.`;
        this.uiElements.csvFileInputEl.value = '';
        this.uiElements.csvFileInputEl.accept = '.xlsx,.xls';
        this.uiElements.csvFileInputEl.click();
        return new Promise((resolve, reject) => {
            this.fileResolve = (file) => {
                if (file) {
                    resolve(file);
                } else {
                    this.log(`File selection cancelled for VAR "${forVariable}".`);
                    reject(new Error('File selection cancelled or no file provided.'));
                }
            };
        });
    }

    async run(ast) {
        this.log('Interpreter started.');
        this.clearInternalState(); // Clear state from previous runs

        const dag = buildDag(ast);
        const nodeMap = {};
        for (const n of dag) nodeMap[n.id] = n;

        for (const entry of Object.values(this.cache)) {
            entry.usedThisRun = false;
        }

        for (const varBlock of ast) {
            this.activeVariableName = varBlock.variableName;
            const varLine = varBlock.line;
            this.log(`Processing block for VAR "${this.activeVariableName}"`);
            this.variables[this.activeVariableName] = null;

            for (let index = 0; index < varBlock.pipeline.length; index++) {
                const commandNode = varBlock.pipeline[index];
                const nodeId = `${this.activeVariableName}-${index}`;
                const nodeInfo = nodeMap[nodeId];
                this.log(`Executing: ${commandNode.command} for VAR "${this.activeVariableName}"` + (commandNode.line ? ` (Line ${commandNode.line})` : ''));
                let useCache = false;
                const cacheEntry = this.cache[nodeId];
                if (cacheEntry && cacheEntry.fingerprint === nodeInfo.fingerprint) {
                    let depsOk = true;
                    for (const dep of nodeInfo.dependencies) {
                        if (nodeMap[dep]) {
                            const depEntry = this.cache[dep];
                            if (!depEntry || depEntry.fingerprint !== nodeMap[dep].fingerprint) {
                                depsOk = false;
                                break;
                            }
                        }
                    }
                    if (depsOk) useCache = true;
                }

                if (useCache) {
                    this.variables[this.activeVariableName] = cacheEntry.dataset;
                    cacheEntry.usedThisRun = true;
                    cacheEntry.unusedCount = 0;
                    this.log(`Using cached result for ${nodeId}`);
                } else {
                    try {
                        await this.executeCommand(commandNode);
                        this.cache[nodeId] = {
                            fingerprint: nodeInfo.fingerprint,
                            dataset: this.variables[this.activeVariableName],
                            unusedCount: 0,
                            usedThisRun: true
                        };
                    } catch (e) {
                        const err = e instanceof Error ? e.message : JSON.stringify(e);
                        this.log(`ERROR executing ${commandNode.command} for VAR "${this.activeVariableName}": ${err}`);
                        console.error(`Error details for ${commandNode.command} (VAR "${this.activeVariableName}"):`, e);
                        if (this.uiElements.fileInputContainerEl) this.uiElements.fileInputContainerEl.classList.add('hidden');
                        return;
                    }
                }

                const dataset = this.variables[this.activeVariableName];
                const stepId = `step-${this.activeVariableName}-l${commandNode.line}-${index}`;
                this.stepOutputs.push({ id: stepId, varName: this.activeVariableName, line: commandNode.line, dataset });
            }
            // record final dataset for the VAR line itself
            const finalDataset = this.variables[this.activeVariableName];
            const finalStepId = `step-${this.activeVariableName}-l${varLine}-final`;
            this.stepOutputs.push({ id: finalStepId, varName: this.activeVariableName, line: varLine, dataset: finalDataset });
            this.log(`Finished block for VAR "${this.activeVariableName}"`);
        }
        this.log('Interpreter finished all blocks.');
        for (const entry of Object.values(this.cache)) {
            if (entry.usedThisRun) {
                entry.unusedCount = 0;
            } else {
                entry.unusedCount = (entry.unusedCount || 0) + 1;
            }
            entry.usedThisRun = false;
        }
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
            case 'LOAD_JSON':
                this.variables[this.activeVariableName] = await loadJson(this, args);
                break;
            case 'LOAD_EXCEL':
                this.variables[this.activeVariableName] = await loadExcel(this, args);
                break;
            case 'KEEP_COLUMNS':
            case 'SELECT':
                if (!currentDataset || typeof currentDataset.select !== 'function') {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply ${command}.`);
                }
                this.variables[this.activeVariableName] = keepColumns(this, args, currentDataset);
                break;
            case 'DROP_COLUMNS':
                if (!currentDataset || typeof currentDataset.select !== 'function') {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply DROP_COLUMNS.`);
                }
                this.variables[this.activeVariableName] = dropColumns(this, args, currentDataset);
                break;
            case 'RENAME_COLUMNS':
                if (!currentDataset || typeof currentDataset.rename !== 'function') {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply RENAME_COLUMNS.`);
                }
                this.variables[this.activeVariableName] = renameColumns(this, args, currentDataset);
                break;
            case 'JOIN':
                if (!currentDataset || typeof currentDataset.join !== 'function') {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply JOIN.`);
                }
                this.variables[this.activeVariableName] = joinDatasets(this, args, currentDataset);
                break;
            case 'FILTER':
                if (!currentDataset || typeof currentDataset.filter !== 'function') {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply FILTER.`);
                }
                this.variables[this.activeVariableName] = filterRows(this, args, currentDataset);
                break;
            case 'WITH_COLUMN':
                if (!currentDataset || typeof currentDataset.derive !== 'function') {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply WITH_COLUMN.`);
                }
                this.variables[this.activeVariableName] = withColumn(this, args, currentDataset);
                break;
            case 'GROUP_BY':
                if (!currentDataset || typeof currentDataset.groupby !== 'function') {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply GROUP_BY.`);
                }
                this.variables[this.activeVariableName] = groupBy(this, args, currentDataset);
                break;
            case 'AGGREGATE':
                if (!currentDataset || typeof currentDataset.rollup !== 'function') {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply AGGREGATE.`);
                }
                this.variables[this.activeVariableName] = aggregate(this, args, currentDataset);
                break;
            case 'SORT':
                if (!currentDataset || typeof currentDataset.orderby !== 'function') {
                    throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply SORT.`);
                }
                this.variables[this.activeVariableName] = sortDataset(this, args, currentDataset);
                break;
            case 'EXPORT_CSV':
                if (!currentDataset) {
                    throw new Error(`No dataset available in VAR "${this.activeVariableName}" to export.`);
                }
                await exportCsv(this, args, currentDataset);
                break;
            case 'EXPORT_EXCEL':
                if (!currentDataset) {
                    throw new Error(`No dataset available in VAR "${this.activeVariableName}" to export.`);
                }
                await exportExcel(this, args, currentDataset);
                break;
            default: this.log(`Command ${command} for VAR "${this.activeVariableName}" is parsed but not yet fully implemented.`);
        }
    }

    getExecutedLines() {
        const lines = new Set();
        for (const out of this.stepOutputs) {
            if (typeof out.line === "number") lines.add(out.line);
        }
        return Array.from(lines);
    }
}
