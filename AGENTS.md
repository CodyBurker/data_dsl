# Agent Guidelines

This project contains an Electron-based desktop app for manipulating CSV data. The JavaScript code uses ES modules and a small Node-based test suite.

## Environment Setup
- Use Node **18+** (Node 20 is available in the Codex container).
- Run `npm install` once to ensure dependencies are installed
- Run `npm run build` to generate the compiled app in `docs/`. The CI workflow also runs this command and commits any changes so the built files always match the source. Running it locally helps avoid extra commits from CI.
- Run `npm run desktop` to launch the Electron shell with the built files.

## Testing
- All unit tests reside in the `tests/` directory and use Node's built-in test runner.
- Run `npm test` (which executes `node --test`) before each commit to verify functionality.

## Documentation Tips
- Update `README.md` and `guide.md` whenever the DSL syntax or interpreter behavior changes.
- Include concise examples in the guide for new commands.
- Keep documentation lines under 100 characters when possible to preserve readability.

## Helpful Context
- The `js/` directory contains the tokenizer, parser, interpreter, and UI logic.
- `js/csv.js` contains helper functions for CSV import/export used by the interpreter.
- `js/datasetOps.js` contains dataset transformation helpers (joins, filtering, column math).
- `index.html` loads PapaParse from a CDN for CSV processing in the desktop app.
- Style rules live in `style.css`; maintain existing formatting when making UI tweaks.

## UI Module Structure
UI-related code lives under `js/ui/` and is split into several modules:

- `elements.js` – caches DOM nodes via `queryElements` and exports the `elements` object.
- `highlight.js` – provides `escapeHtml` and `applySyntaxHighlighting` for the editor overlay.
- `peek.js` – handles PEEK output rendering and export with `generatePeekHtmlForDisplay`, `renderPeekOutputsUI`, `clearEditorPeekHighlight`, and `handleExportPeek`.
- `fileOps.js` – file helpers `saveScriptToFile`, `loadScriptFromFile`, and `loadDefaultScript`.
- `index.js` – orchestrates UI initialization, event bindings, and exports helpers used in tests.

When modifying UI behavior keep these files in sync and update this guide if the structure changes.

## Interpreter Helper Modules
`js/interpreter.js` focuses on orchestrating pipeline execution. Heavy lifting is delegated to:

- `csv.js` – `loadCsv`, `parseCsvInput`, `exportCsv`
- `datasetOps.js` – `keepColumns`, `joinDatasets`, `filterRows`, `withColumn`

## Maintenance
Whenever the project structure changes, update this AGENTS.md to reflect the new organization so future agents can navigate quickly.

