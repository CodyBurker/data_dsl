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
THEN PEEK
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

### PEEK
Display the current dataset in the Peek output area.

```
PEEK
```

Each command also records its result in a **Step Outputs** list. Only the
currently active output tab is shown, and each tab label displays the variable
name only. Selecting a step tab highlights the first word of that command line
so you can follow the pipeline. Placing the cursor on a line that produced a
peek or step output will also activate the corresponding tab automatically.
Clicking on the `VAR` line for a pipeline shows the dataset after all of that
variable's commands have executed.

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
Create or replace a column using arithmetic on existing columns.

```
WITH COLUMN result = (a + 2 * b) / c
```

### Parsed but Not Yet Executed
The tokenizer and parser recognize additional commands such as `LOAD_EXCEL`,
`DROP_COLUMNS`, `NEW_COLUMN`, `RENAME_COLUMN`, and `SORT_BY`. These commands are
parsed but currently have no effect in the interpreter.

## Tips

- Chain multiple commands with `THEN` to build a pipeline.
- Comments can appear on their own line or after a command.
- When loading a file, the UI will prompt you to select it.
- With a supported browser you can **Open File** or **Save File** to work
  with `.pd` files.
- The editor loads `examples/default.pd` automatically so you can see a working
  script right away.

