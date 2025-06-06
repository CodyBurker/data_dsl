# PipeData DSL Overview

PipeData is a domain-specific language (DSL) designed for simple, scriptable data pipeline operations on CSV files directly in the browser. It allows users to load, transform, and preview tabular data using a readable, step-by-step syntax.

**Mission:** To provide a simple and intuitive way to manipulate tabular data in the browser, making data processing accessible to everyone.

---

**Live Demo:** [Try PipeData DSL in your browser](https://codyburker.github.io/data_dsl/)

**Language Guide:** [View the full DSL guide](guide.md)

Run `npm run dev` to start the Vite development server.
Run `npm run build` to generate the compiled React app in the `docs/` folder. This command also copies the `examples/` folder so the demo can load the sample CSV files. GitHub Pages serves files from that directory. The CI workflow also runs this build and commits the results so `docs/` always reflects the latest source code.

Example CSV files `exampleCities.csv` and `examplePeople.csv` live in the
`examples/` folder. If you reference these filenames in a `LOAD_CSV` command,
the interpreter loads them automatically so you can try joins without uploading
anything. Additionally the interpreter preloads `cities` and `people`
variables with the same data so you can experiment without any `LOAD_CSV`
commands.

Every command execution now records its result in a **Step Outputs** list shown
next to the preview outputs. Only the active output tab is visible at any time and
each tab label shows just the variable name. Selecting a step highlights the
first word of that line in the editor so you can trace pipeline execution.
Moving the cursor onto a line with a recorded output automatically switches to
that tab so you can quickly inspect results as you edit. When editing introduces
a parse error, the peek view now reverts to the last line that produced valid
output.
Clicking on a line containing `VAR "name"` now shows the final value assigned to
that variable after all of its commands run.

The script editor now includes a subtle line number gutter so you can quickly
reference line positions while tracing your pipelines.

An adjacent status gutter now shows which lines executed. Green bars mark
completed lines, yellow bars mark steps that haven't run yet, and red bars
highlight syntax errors. When parse errors occur red dots appear next to each bad line and hovering them shows the messages. Parsing now continues within a block so only the lines with issues are highlighted. Blank lines within a VAR block inherit the color of the
preceding command, while gaps between blocks stay uncolored. The interpreter runs
automatically a moment after you stop typing.

The editor automatically loads `examples/default.pd` on startup and now runs it
once on first launch. The script shows how to compute `population_millions` with
`WITH COLUMN`.

With a supported browser you can **Open File** or **Save File** to work directly with `.pd` script files.

### DAG Representation

A helper module `dag.js` converts the parsed script into a directed acyclic graph
(DAG). Each command becomes a node with a stable fingerprint derived from the
command, its arguments and the fingerprints of its dependencies. Because
fingerprints ignore line numbers, reformatting a script will not affect future
caching logic and changes to upstream steps automatically update downstream
fingerprints.
The interpreter stores a cache of datasets keyed by these fingerprints. When you
re-run a script withoutchanging a step or its dependencies, the cached result is
reused so the pipeline executes faster. PEEK results and step outputs come from
the cache when a step is skipped, so the UI stays in sync. This cache persists
across runs until you clear it using the **Clear Outputs** button (or calling
`clearInternalState(true)` in code).
Each cached entry also tracks `unusedCount`, incremented whenever a run doesn't
need that node. The counter resets to `0` when a cached result is used, letting
future logic evict the stalest datasets if memory becomes an issue.

The UI visualizes this DAG below the editor. Nodes are arranged so that every dependency appears to the left of the step that relies on it. Each node displays the variable and command names. Hovering a node reveals a custom tooltip describing the step, such as which columns were selected or the join keys used.

---

# PipeData Development Roadmap

## Guiding Principles for Development

* **Short Iterations & Visible Progress:** Each phase aims to deliver tangible results quickly.
* **Focus on Core Value:** Prioritize features that directly address the goal of replacing spreadsheet vlookups and similar tasks.
* **Flexibility:** This roadmap is a guide, not a rigid constraint. Pivots are okay based on engagement and emerging priorities.
* **Leverage Existing Tools:** Use libraries like PapaParse to reduce boilerplate and focus on unique features.
* **Quick Wins & Feedback Loops:** Emphasize features that provide immediate visual feedback.

---

## ✅ Phase 1: The "It Works!" Core (Complete)

**Goal:** Get basic vlookup-like functionality working ASAP.

* **[X] Data Engine:** Use native JavaScript arrays and objects as the foundation, avoiding complex external DataFrame libraries.
* **[X] I/O:** Implement `LOAD_CSV` (with PapaParse) and the ability to save the final output to a new CSV file.
* **[X] Core Transformations:** Implement `SELECT` and `JOIN` (inner/left) to cover the basic "vlookup" use case.
* **[X] UI:** Create a minimal viable product with a script input area, a "Run" button, and a basic HTML table to preview the final result.

---

## ✅ Phase 2: Enhancing the Experience & Core Operations (Complete)

**Goal:** Make the tool more usable, add more common spreadsheet operations, and improve responsiveness.

* **[X] Data Engine:** Cache loaded CSV files so that scripts can be re-run without needing to re-upload files.
* **[X] I/O:** Allow users to save and load their PipeData scripts.
* **[X] Transformations:**
    * Implement a comprehensive `FILTER` command with support for various operators (`=`, `!=`, `>`, `<`, etc.), string matching, and grouped conditions with `AND`/`OR`.
    * Implement a basic `WITH COLUMN` command for arithmetic and simple string operations (`LOWER`, `UPPER`, `TRIM`, concatenation).
* **[X] UI Features:** Improve the data preview to be more robust and provide better feedback on the state of the pipeline.

---

## ✨ Phase 3: Achieving Spreadsheet Parity (Current Focus)

**Goal:** Make the tool significantly more powerful by implementing the most common and essential spreadsheet operations that are currently missing.

* **[ ] High-Priority Transformations:**
    * **`GROUP_BY` & `AGGREGATE`**: This is the most critical feature for this phase. Implement grouping and aggregation functions like `SUM`, `COUNT`, `AVG`, `MIN`, and `MAX`.
    * **`SORT`**: Implement data sorting based on one or more columns.
    * **`DROP`**: Implement the `DROP_COLUMNS` command.
    * **`RENAME`**: Implement the `RENAME_COLUMN` command.
* **[ ] I/O (Wider Compatibility):**
    * **`LOAD_JSON`**: Implement loading data from JSON files.
    * **`LOAD_EXCEL`**: Implement loading data from Excel files (e.g., using SheetJS for .xlsx).
    * **`SAVE_EXCEL`**: Implement saving data to Excel format.
* **[ ] UI & UX Enhancements:**
    * **Manage Multiple Inputs:** Create a UI to list and manage loaded files/datasets.
    * **Clearer Error Messages:** Improve feedback for script errors, providing more context and suggestions.
    * **Add Variable-based Tabs:** Add persistent tabs for each `VAR` block's final output, in addition to the line-by-line step outputs.

---

## 🌟 Phase 4: Advanced Features & Polish (Future Vision)

**Goal:** Add sophisticated data operations and user-friendly features for complex scenarios, making PipeData a comprehensive tool.

* **[ ] Advanced Transformations:**
    * **`DISTINCT`**: Implement removal of duplicate rows.
    * **`FILL`**: Implement functions to fill missing values (e.g., with a specific value, mean, or median).
    * **`PIVOT` / `UNPIVOT`**: Implement data pivoting and unpivoting.
    * **More Aggregation Functions:** Add `COUNT_DISTINCT`, `MEDIAN`, `STDDEV`, `VARIANCE`, etc.
    * **`WITH COLUMN` (Enhanced):** Add date operations and conditional logic.
* **[ ] Professional-Grade I/O:**
    * Add support for `Parquet` or `Avro` formats based on user demand.
* **[ ] UI & Language Polish:**
    * **Data Visualization:** Integrate a simple charting library (e.g., Chart.js) to create basic charts from data at any pipeline stage.
    * **Dark Mode:** Implement a dark theme for the UI.
    * **Editor Enhancements:**
        * Add autocomplete for commands and column names.
        * Implement proper Tab key support for indentation.
        * Add keyboard shortcuts (e.g., Ctrl+S to save).
    * **Language Consistency:** Standardize command names to be consistent (e.g., remove all underscores).
