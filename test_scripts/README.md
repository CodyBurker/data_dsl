Scripts in this folder are executed automatically by exampleScripts.test.js.
Running `npm test` will load each `.pd` file here and verify it runs without errors.
The test harness makes the sample data from `examples/` available via the regular
LOAD_* commands, so scripts can reference files like `exampleCities.csv` directly.
Add new scripts here to include them in future test runs.
