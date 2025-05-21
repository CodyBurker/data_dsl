# PipeData DSL Overview

PipeData is a domain-specific language (DSL) designed for simple, scriptable data pipeline operations on CSV files directly in the browser. It allows users to load, transform, and preview tabular data using a readable, step-by-step syntax.

## Todo

Un-prioritized list of features and improvements to be made to PipeData.

### Data engine

- More robust (preferable existing) dataframe library (e.g., Danfo.js, DataFrame.js) for better performance and features.
- Dynamically run script (clicking RUN every time is not ideal)
- Build DAG of operations to visualize the pipeline
- Cache intermediate results based on the DAG to make realtime updates possible

### I/O

- LOAD_CSV - Use papa instead of native
- LOAD_JSON
- LOAD_EXCEL
- Save to CSV
- Save to Excel
- Cache inputs or be able to give filepath so scripts can be rerun?
- Save/Load scripts
- Add support for other file formats (e.g., Parquet, Avro, etc.)

### Transformations

- FILTER - Function to filter rows. Develop syntax for filtering rows based on conditions.
- SELECT - Function to select specific columns from the data.
- DROP - Function to drop specific columns from the data.
- GROUP_BY - Function to group data by specific columns and perform aggregations.
- JOIN - Function to join two datasets based on a common key.
- SORT - Function to sort data based on specific columns.
- AGGREGATE - Function to perform aggregations on grouped data.
- WITH_COLUMN - Function to create new columns based on existing ones.
- RENAME - Function to rename columns in the dataset.
- DISTINCT - Function to remove duplicate rows from the dataset.
- PIVOT - Function to pivot data based on specific columns.
- UNPIVOT - Function to unpivot data based on specific columns.
- FILL - Function to fill missing values in the dataset.

### WITH_COLUMN features

Syntax needed for creating new columns based on existing ones to handle basic transformations:

- Arithmetic operations (addition, subtraction, multiplication, division)
- String operations (concatenation, substring, etc.)
- Date operations (date formatting, date difference, etc.)
- Conditional operations (if-else statements, case statements)
- Data type conversions (casting columns to different types)

### Aggregation functions

Functions to perform aggregations on grouped data:

- SUM - Sum of a numeric column.
- AVG - Average of a numeric column.
- COUNT - Count of rows
- COUNT_DISTINCT - Count of distinct values in a column.
- MIN - Minimum value of a numeric column.
- MAX - Maximum value of a numeric column.
- MEDIAN - Median value of a numeric column.
- MODE - Mode value of a column.
- STDDEV - Standard deviation of a numeric column.
- VARIANCE - Variance of a numeric column.
- FIRST - First value of a column.
- LAST - Last value of a column.
- CONCAT - Concatenate values from multiple rows into a single string.

### UI Features

- Add a preview of the data after each step? Replace 'PEEK' with auto-preview
- Add a way to visualize the data (e.g., charts, graphs) after transformations.
- Add a way to visualize the pipeline (e.g., DAG, flowchart)
- Manage multiple inputs
- Realtime updates to the data preview as the script is being written (wait until user is finished typing or their script is valid enough to be run)