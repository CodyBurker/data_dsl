// js/ui/fileOps.js

import { elements } from './elements.js';
import { applySyntaxHighlighting } from './highlight.js';

async function saveScriptToFile(interpreter) {
    if (!elements.inputArea || typeof window.showSaveFilePicker !== 'function') return;
    try {
        const handle = await window.showSaveFilePicker({
            types: [{ description: 'PipeData Script', accept: { 'text/plain': ['.pd'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(elements.inputArea.value);
        await writable.close();
        if (interpreter) interpreter.log('Script saved to file.');
    } catch (e) {
        // User cancelled
    }
}

async function loadScriptFromFile(interpreter, updateLineNumbers, highlightRef) {
    if (!elements.inputArea || typeof window.showOpenFilePicker !== 'function') return;
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'PipeData Script', accept: { 'text/plain': ['.pd', '.txt'] } }]
        });
        const file = await handle.getFile();
        const text = await file.text();
        elements.inputArea.value = text;
        updateLineNumbers();
        if (elements.highlightingOverlay) {
            elements.highlightingOverlay.innerHTML = applySyntaxHighlighting(text, null);
            highlightRef.currentLine = null;
        }
        if (interpreter) interpreter.log('Loaded script from file.');
    } catch (e) {
        // User cancelled
    }
}

const fallbackScript = `VAR "cities"
THEN LOAD_CSV FILE "exampleCities.csv"
THEN SELECT population, id
THEN WITH COLUMN population_millions = population / 1000000
VAR "people"
THEN LOAD_CSV FILE "examplePeople.csv"
THEN JOIN cities ON city_id=id TYPE "LEFT"
THEN SELECT name, age, population, population_millions
THEN FILTER name STARTSWITH "A"`;

async function loadDefaultScript() {
    try {
        const resp = await fetch('examples/default.pd');
        if (resp.ok) {
            return await resp.text();
        }
    } catch (e) {
        // ignore and fall back
    }
    return fallbackScript;
}

export { saveScriptToFile, loadScriptFromFile, loadDefaultScript };
