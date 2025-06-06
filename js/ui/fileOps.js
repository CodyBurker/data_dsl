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
THEN WITH COLUMN city_of = "City of " + name
THEN SELECT id, city_of

VAR "people"
THEN LOAD_CSV FILE "examplePeople.csv"
THEN JOIN cities ON city_id=id TYPE "LEFT"
THEN WITH COLUMN clean_name = TRIM(name)
THEN WITH COLUMN greeting = UPPER(clean_name) + " from " + city_of
THEN SELECT person_id, greeting, age

VAR "sales"
THEN LOAD_CSV FILE "exampleSales.csv"
THEN WITH COLUMN revenue = quantity * unit_price
THEN GROUP_BY person_id
THEN AGGREGATE SUM revenue AS total_revenue, COUNT AS order_count
THEN JOIN people ON person_id=person_id TYPE "LEFT"
THEN FILTER total_revenue > 100
THEN SELECT greeting, total_revenue, order_count
THEN EXPORT_CSV TO "top_customers.csv"`;

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
