# Agent Guidelines

This project contains a browser-based DSL for manipulating CSV data. The JavaScript code uses ES modules and a small Node-based test suite.

## Environment Setup
- Use Node **18+** (Node 20 is available in the Codex container).
- Run `npm install` once to ensure dependencies are installed (currently there are none, but future dependencies may be added).
- The demo can be viewed by opening `index.html` directly or by serving the repo with a simple HTTP server, e.g. `npx http-server` or `python -m http.server`.

## Testing
- All unit tests reside in the `tests/` directory and use Node's built-in test runner.
- Run `npm test` (which executes `node --test`) before each commit to verify functionality.

## Documentation Tips
- Update `README.md` and `guide.md` whenever the DSL syntax or interpreter behavior changes.
- Include concise examples in the guide for new commands.
- Keep documentation lines under 100 characters when possible to preserve readability.

## Helpful Context
- The `js/` directory contains the tokenizer, parser, interpreter, and UI logic.
- `index.html` loads PapaParse from a CDN for CSV processing in the browser.
- Style rules live in `style.css`; maintain existing formatting when making UI tweaks.

