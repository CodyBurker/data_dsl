import { from } from 'arquero';

export async function loadJson(interp, args) {
    const fileName = args.file;
    if (!fileName) throw new Error('LOAD_JSON requires FILE argument.');
    const root = args.root || null;

    if (typeof fetch !== 'undefined') {
        try {
            const resp = await fetch(`examples/${fileName}`);
            if (resp.ok) {
                const json = await resp.json();
                const data = root ? json[root] : json;
                if (Array.isArray(data)) return from(data);
                throw new Error('JSON does not contain an array of objects');
            }
        } catch (err) {
            interp.log(`Fetch for example ${fileName} failed: ${err.message}`);
        }
    }

    if (!interp.uiElements.csvFileInputEl) throw new Error('File input not available.');
    const file = await interp.requestJsonFile(fileName, interp.activeVariableName);
    const text = await file.text();
    const json = JSON.parse(text);
    const data = root ? json[root] : json;
    if (!Array.isArray(data)) throw new Error('JSON does not contain an array of objects');
    return from(data);
}
