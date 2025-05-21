# PipeData DSL Overview

PipeData is a domain-specific language (DSL) designed for simple, scriptable data pipeline operations on CSV files directly in the browser. It allows users to load, transform, and preview tabular data using a readable, step-by-step syntax.

## Key Features

- **Load CSV**: Import CSV files for processing.
- **Column Operations**: Keep or drop specific columns.
- **Peek**: Preview the first rows of your dataset at any step.
- **Piping**: Chain operations using `THEN`.
- **Comments**: Use `#` for script annotations.
- **Extensible Syntax**: Additional commands (e.g., filtering, sorting, exporting) are parsed for future support.

## Example Script
```
LOAD_CSV FILE "data.csv"
KEEP_COLUMNS col1, col2, col3
PEEK
THEN
KEEP_COLUMNS col4, col5
PEEK
```

## Supported Commands

- `LOAD_CSV FILE "filename.csv"`: Load a CSV file (prompts for file selection).
- `KEEP_COLUMNS col1, col2, ...`: Keep only the listed columns.
- `PEEK`: Show the first 10 rows of the current dataset.
- `THEN`: Chain commands in sequence.
- `# ...`: Add comments to your script.

## Usage

1. Write your PipeData script in the editor.
2. Click **Run Script**.
3. If your script uses `LOAD_CSV`, select the required file when prompted.
4. View logs, AST, and peeked data in the output panels.

> **Note:** Only basic CSV parsing is supported. For complex CSVs (e.g., with commas in fields), results may vary.

---
For more details, see [index.html](index.html) and [script.js](script.js).