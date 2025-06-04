# PipeData DSL Overview

PipeData is a domain-specific language (DSL) designed for simple, scriptable data pipeline operations on CSV files directly in the browser. It allows users to load, transform, and preview tabular data using a readable, step-by-step syntax.

Mission: To provide a simple and intuitive way to manipulate tabular data in the browser, making data processing accessible to everyone.

---

**Live Demo:** [Try PipeData DSL in your browser](https://codyburker.github.io/data_dsl/)

**Language Guide:** [View the full DSL guide](guide.md)

Example CSV files `exampleCities.csv` and `examplePeople.csv` live in the
`examples/` folder. If you reference these filenames in a `LOAD_CSV` command,
the interpreter loads them automatically so you can try joins without uploading
anything. Additionally the interpreter preloads `cities` and `people`
variables with the same data so you can experiment without any `LOAD_CSV`
commands.

The editor automatically loads `examples/default.pd` on startup. The script shows
how to compute `population_millions` with `WITH COLUMN`.

With a supported browser you can **Open File** or **Save File** to work directly with `.pd` script files.

--- 

# PipeData Development Roadmap

## Guiding Principles for Development (Especially for a Solo ADHD Developer)

* **Short Iterations & Visible Progress:** Each phase aims to deliver tangible results quickly.
* **Focus on Core Value:** Prioritize features that directly address the goal of replacing spreadsheet vlookups and similar tasks.
* **Flexibility:** This roadmap is a guide, not a rigid constraint. Pivots are okay based on engagement and emerging priorities.
* **Leverage Existing Tools:** Use libraries like PapaParse to reduce boilerplate and focus on unique features.
* **Quick Wins & Feedback Loops:** Emphasize features that provide immediate visual feedback.

---

## 🎯 Phase 1: The "It Works!" Core

**Goal:** Get basic vlookup-like functionality working ASAP. A user can load two CSVs, join them, select columns, and see the result.

**ADHD Strategy:** Lean into hyperfocus on getting the first end-to-end flow working. Keep it simple.

1.  **Data Engine (Foundation First):**
    * [X] **Use Native Arrays:** Move away from external DataFrame libraries for a simpler core.
2.  **I/O (Getting Data In & Out):**
    * [X] **LOAD_CSV (Better):** Implement `LOAD_CSV` using PapaParse.
    * [X] **Save to CSV:** Implement basic functionality to download the transformed data as a CSV.
3.  **Transformations (The "VLOOKUP" Core):**
    * [X] **SELECT:** Implement function to select specific columns.
    * [X] **JOIN (Inner/Left):** Implement function to join two datasets on matching or distinct keys with inner or left semantics.
4.  **UI Features (Minimal Viable Preview):**
    * [ ] **Basic Script Input Area:** Simple textarea for script input.
    * [ ] **"Run" Button:** Manual trigger for script execution.
    * [ ] **Simple Tabular Preview:** Display the *final* output in a basic HTML table (replaces 'PEEK').

---

## 🚀 Phase 2: Enhancing the Experience & Core Operations

**Goal:** Make the tool more usable, add more common spreadsheet operations, and improve responsiveness.

**ADHD Strategy:** Mix UI tasks with backend tasks. Allow for task switching if needed.

1.  **Data Engine (Smarter Execution):**
    * [ ] **Cache Inputs:** Allow re-running scripts without re-uploading files (e.g., session-based cache or allow local file paths if feasible securely).
2.  **I/O (More Formats & Script Management):**
    * [ ] **LOAD\_JSON:** Implement loading data from JSON files.
    * [X] **Save/Load Scripts:** Allow users to save and load their PipeData scripts (e.g., using file download/upload).
3.  **Transformations (Expanding the Toolkit):**
    * **FILTER:**
        * [X] Basic equals filtering on strings and numbers.
        * [X] Support additional comparisons like `!=`, `>`, `<`, `>=`, `<=`, `IS`, and string operations.
        * [X] Allow grouped conditions with `AND`/`OR` using parentheses,
          e.g., `(col=1 OR col=2) AND (otherCol != 3)`.
        * [ ] Extensive unit and integration tests with syntax-highlighted docs.
    * [ ] **DROP:** Implement function to drop specified columns.
    * [X] **WITH COLUMN (Basic):**
        * [X] Implement arithmetic operations (e.g., `new_col = col1 + col2`).
        * [ ] Implement basic string operations (e.g., `new_col = concat(col1, " ", col2)`).
4.  **UI Features (Better Feedback):**
    * [ ] **Clearer Error Messages:** Improve feedback for script errors.
    * [ ] **Data Preview Enhancement:** Consider options for previewing data after each step (if performance allows without caching) or ensure final preview is robust.

---

## ✨ Phase 3: Power & Polish

**Goal:** Make the tool significantly more powerful with advanced transformations, a more dynamic UI, and performance optimizations.

**ADHD Strategy:** Focus on intellectually stimulating features (like DAGs) or visually rewarding UI enhancements.

1.  **Data Engine (Performance & Insight):**
    * [ ] **Build DAG of Operations:** Internally represent the script as a Directed Acyclic Graph.
    * [ ] **Cache Intermediate Results:** Use the DAG to cache results of intermediate steps for faster re-runs and dynamic updates.
    * [ ] **Dynamically Run Script:** Explore running the script automatically (e.g., on pause after typing, or when script is valid) leveraging the cached results.
2.  **I/O (Wider Compatibility):**
    * [ ] **LOAD\_EXCEL:** Implement loading data from Excel files (e.g., using SheetJS for .xlsx).
    * [ ] **Save to Excel:** Implement saving data to Excel format.
3.  **Transformations (More Analytic Power):**
    * [ ] **GROUP\_BY:** Implement grouping functionality.
    * [ ] **AGGREGATE:** Implement core aggregation functions (`SUM`, `AVG`, `COUNT`, `MIN`, `MAX`) for grouped data.
    * [ ] **SORT:** Implement data sorting based on column values.
    * [ ] **WITH COLUMN (Enhanced):**
        * [ ] Date operations (e.g., basic formatting).
        * [ ] Conditional operations (e.g., simple if/else).
        * [ ] Data type conversions.
4.  **UI Features (Richer Interaction):**
    * [ ] **Visualize Pipeline (DAG):** Display the DAG to the user.
    * [ ] **Manage Multiple Inputs:** Create a UI to list and manage loaded files/datasets.
    * [ ] **Preview Data After Each Step:** With caching, implement a reliable preview of the data after each transformation step.

---

## 🌟 Phase 4: Advanced Features & Broader Appeal

**Goal:** Add sophisticated data operations and user-friendly features for complex scenarios, making PipeData a comprehensive tool.

**ADHD Strategy:** Tackle larger features one at a time. Switch tasks if motivation wanes, but ensure completion.

1.  **Transformations (Sophisticated Manipulations):**
    * [ ] **RENAME:** Implement column renaming.
    * [ ] **DISTINCT:** Implement removal of duplicate rows.
    * [ ] **FILL:** Implement functions to fill missing values.
    * [ ] **More Aggregation Functions:** Add `COUNT_DISTINCT`, `MEDIAN`, `MODE`, `STDDEV`, `VARIANCE`, `FIRST`, `LAST`, `CONCAT` (group concat).
    * [ ] **PIVOT:** Implement data pivoting.
    * [ ] **UNPIVOT:** Implement data unpivoting.
2.  **I/O (Professional Grade):**
    * [ ] **Support for Parquet/Avro:** Add support for these formats (lower priority unless specific demand).
3.  **UI Features (Data Exploration & Presentation):**
    * [ ] **Data Visualization:** Integrate a simple charting library (e.g., Chart.js) to create basic charts/graphs from data at any pipeline stage.
    * [ ] **Realtime Updates (Full):** Refine dynamic script execution for seamless, real-time updates to the data preview as the script is written (with debouncing).

---

## General ADHD Developer Survival Tips for This Project:

* **Break It Down Religiously:** Further break down each roadmap item into the smallest actionable tasks.
* **Timeboxing/Pomodoro:** Work in focused bursts with short breaks.
* **"Done" List:** Keep a visible list of accomplishments for motivation.
* **Embrace Novelty (Strategically):** Switch tasks if bored, but ensure critical path items are completed.
* **Externalize Motivation:** Share progress with others.
* **Visual Reminders:** Keep the roadmap and current goals visible.
* **Reduce Friction:** Make the first step of any task incredibly easy.
* **Automate Repetitive Tasks:** Script build/test processes if possible.
* **Be Kind to Yourself:** Forgive "off" days.
* **Prioritize Well-being:** Sleep, exercise, and breaks are crucial.
* **Celebrate Milestones:** Acknowledge and reward progress.

This roadmap will evolve. The key is consistent, focused effort on manageable chunks. Good luck!