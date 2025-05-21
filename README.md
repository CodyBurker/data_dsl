# PipeData DSL Overview

PipeData is a domain-specific language (DSL) designed for simple, scriptable data pipeline operations on CSV files directly in the browser. It allows users to load, transform, and preview tabular data using a readable, step-by-step syntax.

## Todo

### Language Features
#### I/O
- [ ] LOAD_CSV - Use papa instead of native
- [ ] LOAD_JSON
- [ ] LOAD_EXCEL
- [ ] Save to CSV
- [ ] Save to Excel
- [ ] Cache inputs or be able to give filepath so scripts can be rerun?
- [ ] Save/Load scripts

#### Transformations
- [ ] FILTER - Function to filter rows. Develop syntax for filtering rows based on conditions.
- [ ] SELECT - Function to select specific columns from the data.
- [ ] DROP - Function to drop specific columns from the data.
- [ ] GROUP_BY - Function to group data by specific columns and perform aggregations.
- [ ] JOIN - Function to join two datasets based on a common key.
- [ ] SORT - Function to sort data based on specific columns.
- [ ] AGGREGATE - Function to perform aggregations on grouped data.
- [ ] WITH_COLUMN - Function to create new columns based on existing ones.

#### UI Features
- [ ] Dynamically run script (clicking RUN every time is not ideal)
- [ ] Add a preview of the data after each step? Replace 'PEEK' with auto-preview
- [ ] Build DAG of operations to visualize the pipeline
- [ ] Add a way to visualize the data (e.g., charts, graphs) after transformations.