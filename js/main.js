// main.js
import { Interpreter } from './interpreter.js';
import { initUI } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Query elements needed by the interpreter here, or ensure ui.js does it and provides them.
    // For simplicity, ui.js will query all elements it needs, including those for the interpreter.
    // The interpreter constructor in interpreter.js expects an object of these elements.
    
    const uiElementsForInterpreter = {
        logOutputEl: document.getElementById('logOutput'),
        peekTabsContainerEl: document.getElementById('peekTabsContainer'), // Though rendering is in ui.js, interpreter might need to know about it
        peekOutputsDisplayAreaEl: document.getElementById('peekOutputsDisplayArea'), // Same as above
        csvFileInputEl: document.getElementById('csvFileInput'),
        fileInputContainerEl: document.getElementById('fileInputContainer'),
        filePromptMessageEl: document.getElementById('filePromptMessage')
    };

    const interpreter = new Interpreter(uiElementsForInterpreter);
    
    // initUI now takes the interpreter instance.
    // Parser and tokenizers are used directly within ui.js for the run button logic.
    await initUI(interpreter);
});