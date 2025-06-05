# PipeData Language Guide

PipeData is a small domain-specific language for manipulating CSV data directly in the browser.
This guide covers the core syntax and currently supported commands.

## Basics

- Scripts consist of commands chained with `THEN`.
- Each pipeline starts with `VAR "variableName"` which sets the active dataset.
- Comments start with `#` and run to the end of the line.
- Strings use double quotes. Column names may be identifiers or quoted strings.

### Example

```
VAR "cities"
THEN LOAD_CSV FILE "cities.csv"
THEN SELECT name, population
```

### Example Data
The `examples/` folder contains `exampleCities.csv` and `examplePeople.csv`.
If a `LOAD_CSV` command references one of these filenames, the interpreter will
fetch it automatically so you can explore joins and column selection without
uploading a file. The interpreter also preloads `cities` and `people` variables
with this data so you can start filtering and joining immediately.

## Commands

### VAR
Start a new pipeline for the specified variable.

```
VAR "myVar"
```

### LOAD_CSV
Load data from a CSV file chosen in the browser.

```
LOAD_CSV FILE "file.csv"
```

### KEEP_COLUMNS / SELECT
Keep only the specified columns. `SELECT` is an alias for `KEEP_COLUMNS`.

```
SELECT col1, col2
# or
KEEP_COLUMNS col1, col2
```

### JOIN
Merge the current dataset with another variable. Specify the column from the current dataset and optionally a different column from the other variable. Use `TYPE "LEFT"` to keep unmatched rows.

```
JOIN otherVar ON name = "full name" TYPE "LEFT"
```

Each command also records its result in a **Step Outputs** list. Only the
currently active output tab is shown, and each tab label displays the variable
name only. Selecting a step tab highlights the first word of that command line
so you can follow the pipeline. Placing the cursor on a line that produced an
output will also activate the corresponding tab automatically. Clicking on the
`VAR` line for a pipeline shows the dataset after all of that variable's
commands have executed. The editor shows line numbers so you can easily
reference pipeline steps. Next to these numbers a thin gutter displays
execution status. Lines that have run successfully show green bars, pending
steps are yellow, and syntax errors highlight in red. If parsing fails red dots appear next to each offending line and hovering reveals the messages. Parsing continues inside a block so only the faulty lines are marked. Blank lines inside a VAR
block inherit the previous line's color, while blank lines between blocks stay
uncolored. The interpreter automatically reruns the script after brief
pauses in typing so the preview stays current.

### EXPORT_CSV
Download the current dataset as a CSV file.

```
EXPORT_CSV TO "output.csv"
```

### FILTER
Filter rows using comparisons against values or other columns. Supported operators
include `=`, `!=`, `>`, `<`, `>=`, `<=`, `IS`, `IS NOT`, `CONTAINS`, `STARTSWITH`,
and `ENDSWITH`.

```
FILTER age >= 30
FILTER name STARTSWITH "A"
FILTER city_id = other_id
```

You can also group conditions with parentheses and combine them
using `AND`/`OR`:

```pipe
FILTER (col = 1 OR col = 2) AND (otherCol != 3)
```

### WITH COLUMN
Create or replace a column using arithmetic or string operations.

```
WITH COLUMN result = (a + 2 * b) / c
WITH COLUMN name_lower = LOWER(name)
WITH COLUMN greeting = name + "!"
```

### RENAME_COLUMN
Rename a column to a new name.

```pipe
RENAME_COLUMN old_name TO new_name
```

### Parsed but Not Yet Executed
The tokenizer and parser recognize additional commands such as `LOAD_EXCEL`,
`DROP_COLUMNS`, `NEW_COLUMN`, and `SORT_BY`. These commands are parsed but
currently have no effect in the interpreter.

## Tips

- Chain multiple commands with `THEN` to build a pipeline.
- Comments can appear on their own line or after a command.
- When loading a file, the UI will prompt you to select it.
- With a supported browser you can **Open File** or **Save File** to work
  with `.pd` files.
- The editor loads `examples/default.pd` automatically so you can see a working
  script right away.
  - Internally the parser output can be converted to a directed acyclic graph.
    Each command node has a fingerprint that ignores line numbers and includes
    the fingerprints of its dependencies, so formatting changes do not disrupt
    caching and updates to earlier steps propagate automatically.
  - The interpreter uses these fingerprints to cache datasets. When a command and
    its dependencies are unchanged, the cached result is reused instead of
    executing the step again. Step outputs rely on these cached
    datasets when possible. The cache persists across runs until you clear it with
    the **Clear Outputs** button or by calling `clearInternalState(true)`.
    Each cache entry tracks an `unusedCount` value that increments if a run
    doesn't touch that node. When the entry is used again the counter resets to
    zero. This can help future implementations decide which datasets to evict
    when memory becomes constrained.

