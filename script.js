
        // --- Tokenizer (Lexer) ---
        const TokenType = {
            KEYWORD: 'KEYWORD', IDENTIFIER: 'IDENTIFIER', STRING_LITERAL: 'STRING_LITERAL',
            NUMBER_LITERAL: 'NUMBER_LITERAL', OPERATOR: 'OPERATOR', PUNCTUATION: 'PUNCTUATION',
            COMMENT: 'COMMENT', 
            NEWLINE: 'NEWLINE', EOF: 'EOF', WHITESPACE: 'WHITESPACE', UNKNOWN: 'UNKNOWN' 
        };
        const KEYWORDS = [
            'LOAD_CSV', 'LOAD_EXCEL', 'THEN', 'KEEP_COLUMNS', 'DROP_COLUMNS', 'FILTER_ROWS', 'WHERE',
            'NEW_COLUMN', 'AS', 'RENAME_COLUMN', 'TO', 'SORT_BY', 'ORDER', 'STORE_AS',
            'EXPORT_CSV', 'EXPORT_EXCEL', 'SHEET', 'FILE', 'PEEK', 'AND', 'OR',
            'IS', 'CONTAINS', 'STARTSWITH', 'ENDSWITH'
        ];
        const OPERATORS_REGEX = /^(\*|\+|\-|\/|==|!=|>=|<=|>|<)/;
        const CONDITION_OPERATORS = ['IS', '!=', '>', '<', '>=', '<=', 'CONTAINS', 'STARTSWITH', 'ENDSWITH'];

        function tokenizeForHighlighting(input) {
            const tokens = [];
            let cursor = 0;
            const getLineNumber = (subInput, subCursor) => (subInput.substring(0, subCursor).match(/\n/g) || []).length + 1;

            while (cursor < input.length) {
                let char = input[cursor];
                let currentTokenValue = '';

                if (/\s/.test(char) && char !== '\n') {
                    currentTokenValue = '';
                    while (cursor < input.length && /\s/.test(input[cursor]) && input[cursor] !== '\n') {
                        currentTokenValue += input[cursor];
                        cursor++;
                    }
                    tokens.push({ type: TokenType.WHITESPACE, value: currentTokenValue, line: getLineNumber(input, cursor) });
                    continue;
                }
                if (char === '\n') {
                    tokens.push({ type: TokenType.NEWLINE, value: '\n', line: getLineNumber(input, cursor) });
                    cursor++;
                    continue;
                }
                if (char === '#') {
                    currentTokenValue = '';
                    while (cursor < input.length && input[cursor] !== '\n') {
                        currentTokenValue += input[cursor];
                        cursor++;
                    }
                    tokens.push({ type: TokenType.COMMENT, value: currentTokenValue, line: getLineNumber(input, cursor) });
                    continue; 
                }
                if (char === '"') {
                    currentTokenValue = char; 
                    cursor++; 
                    while (cursor < input.length && input[cursor] !== '"') {
                        currentTokenValue += input[cursor];
                        cursor++;
                    }
                    if (input[cursor] === '"') {
                        currentTokenValue += input[cursor];
                        cursor++;
                    }
                    tokens.push({ type: TokenType.STRING_LITERAL, value: currentTokenValue, line: getLineNumber(input, cursor) });
                    continue;
                }
                if (/\d/.test(char)) {
                    currentTokenValue = '';
                    while (cursor < input.length && (/\d/.test(input[cursor]) || (input[cursor] === '.' && !currentTokenValue.includes('.')))) {
                        currentTokenValue += input[cursor];
                        cursor++;
                    }
                    tokens.push({ type: TokenType.NUMBER_LITERAL, value: currentTokenValue, line: getLineNumber(input, cursor) });
                    continue;
                }
                const opMatch = input.substring(cursor).match(OPERATORS_REGEX);
                if (opMatch) {
                    const op = opMatch[0];
                    if (!KEYWORDS.includes(op.toUpperCase())) {
                         tokens.push({ type: TokenType.OPERATOR, value: op, line: getLineNumber(input, cursor) });
                         cursor += op.length;
                         continue;
                    }
                }
                if (/[a-zA-Z_]/.test(char)) {
                    currentTokenValue = '';
                    while (cursor < input.length && /[a-zA-Z0-9_]/.test(input[cursor])) {
                        currentTokenValue += input[cursor];
                        cursor++;
                    }
                    const upperValue = currentTokenValue.toUpperCase();
                    if (KEYWORDS.includes(upperValue)) {
                        tokens.push({ type: TokenType.KEYWORD, value: currentTokenValue, line: getLineNumber(input, cursor) });
                    } else {
                        tokens.push({ type: TokenType.IDENTIFIER, value: currentTokenValue, line: getLineNumber(input, cursor) });
                    }
                    continue;
                }
                if (char === ',') {
                    tokens.push({ type: TokenType.PUNCTUATION, value: char, line: getLineNumber(input, cursor) });
                    cursor++;
                    continue;
                }
                
                tokens.push({ type: TokenType.UNKNOWN, value: char, line: getLineNumber(input, cursor) });
                cursor++;
            }
            return tokens;
        }

        function tokenizeForParser(input) {
            const tokens = [];
            let cursor = 0;
            const getLineNumber = (subInput, subCursor) => (subInput.substring(0, subCursor).match(/\n/g) || []).length + 1;

            while (cursor < input.length) {
                let char = input[cursor];
                if (/\s/.test(char) && char !== '\n') { cursor++; continue; }
                if (char === '\n') { tokens.push({ type: TokenType.NEWLINE, value: '\n', line: getLineNumber(input, cursor) }); cursor++; continue; }
                if (char === '#') { while (cursor < input.length && input[cursor] !== '\n') cursor++; continue; } 
                if (char === '"') {
                    let value = ''; cursor++;
                    while (cursor < input.length && input[cursor] !== '"') value += input[cursor++];
                    if (input[cursor] !== '"') throw new Error(`Unterminated string literal at line ${getLineNumber(input, cursor)}`);
                    cursor++; tokens.push({ type: TokenType.STRING_LITERAL, value, line: getLineNumber(input, cursor) }); continue;
                }
                if (/\d/.test(char)) {
                    let value = '';
                    while (cursor < input.length && (/\d/.test(input[cursor]) || (input[cursor] === '.' && !value.includes('.')))) value += input[cursor++];
                    tokens.push({ type: TokenType.NUMBER_LITERAL, value: parseFloat(value), line: getLineNumber(input, cursor) }); continue;
                }
                const opMatch = input.substring(cursor).match(OPERATORS_REGEX);
                if (opMatch) {
                    const op = opMatch[0];
                    if (!KEYWORDS.includes(op.toUpperCase())) {
                        tokens.push({ type: TokenType.OPERATOR, value: op, line: getLineNumber(input, cursor) });
                        cursor += op.length; continue;
                    }
                }
                if (/[a-zA-Z_]/.test(char)) {
                    let value = '';
                    while (cursor < input.length && /[a-zA-Z0-9_]/.test(input[cursor])) value += input[cursor++];
                    const upperValue = value.toUpperCase();
                    tokens.push({ type: KEYWORDS.includes(upperValue) ? TokenType.KEYWORD : TokenType.IDENTIFIER, value: KEYWORDS.includes(upperValue) ? upperValue : value, line: getLineNumber(input, cursor) });
                    continue;
                }
                if (char === ',') { tokens.push({ type: TokenType.PUNCTUATION, value: ',', line: getLineNumber(input, cursor) }); cursor++; continue; }
                throw new Error(`Unexpected character: '${char}' at line ${getLineNumber(input, cursor)}`);
            }
            tokens.push({ type: TokenType.EOF, value: 'EOF', line: getLineNumber(input, cursor) });
            return tokens.filter((t, i, arr) => t.type !== TokenType.NEWLINE || arr[i - 1]?.type !== TokenType.NEWLINE);
        }
        class Parser {
            constructor(tokens) { this.tokens = tokens; this.position = 0; this.ast = []; } 
            parse() { 
                let currentPipeline = [];
                while (!this.isAtEnd()) {
                     while (
                        this.match(TokenType.NEWLINE) ||
                        (this.peek().type === TokenType.COMMENT && this.advance())
                    );
                    const command = this.parseCommand();
                    if (command) {
                        currentPipeline.push(command);
                    }
                    if (this.match(TokenType.KEYWORD, 'THEN')) { /* continue */ } 
                    else if (this.isAtEnd() || (currentPipeline.length > 0 && !this.checkNextIsCommand())) {
                        if (currentPipeline.length > 0) this.ast.push(currentPipeline);
                        currentPipeline = [];
                    }
                    while(this.match(TokenType.NEWLINE));
                }
                if (currentPipeline.length > 0) this.ast.push(currentPipeline);
                return this.ast;
            }
            checkNextIsCommand() { if (this.isAtEnd()) return false; const next = this.peek(); return next.type === TokenType.KEYWORD && !['THEN', 'WHERE', 'AS', 'TO', 'ORDER', 'SHEET', 'FILE', 'IS', 'CONTAINS', 'STARTSWITH', 'ENDSWITH'].includes(next.value); }
            parseCommand() { const t = this.peek(); if (t.type !== TokenType.KEYWORD) { if(t.type === TokenType.EOF) return null; this.error(`Expected command keyword but got ${t.type} '${t.value}'`); }
                switch (t.value) {
                    case 'LOAD_CSV': return this.parseLoadCsv(); case 'LOAD_EXCEL': return this.parseLoadExcel();
                    case 'KEEP_COLUMNS': return this.parseKeepColumns(); case 'DROP_COLUMNS': return this.parseDropColumns();
                    case 'FILTER_ROWS': return this.parseFilterRows(); case 'NEW_COLUMN': return this.parseNewColumn();
                    case 'RENAME_COLUMN': return this.parseRenameColumn(); case 'SORT_BY': return this.parseSortBy();
                    case 'STORE_AS': return this.parseStoreAs(); case 'EXPORT_CSV': return this.parseExportCsv();
                    case 'EXPORT_EXCEL': return this.parseExportExcel(); case 'PEEK': return this.parsePeek();
                    default: if(t.type === TokenType.EOF) return null; if (!['THEN', 'WHERE', 'AS', 'TO', 'ORDER', 'SHEET', 'FILE'].includes(t.value)) this.error(`Unknown command: ${t.value}`); return null;
                }
            }
            parseLoadCsv() { this.consume(TokenType.KEYWORD, 'LOAD_CSV'); this.consume(TokenType.KEYWORD, 'FILE'); const f = this.consume(TokenType.STRING_LITERAL).value; return { command: 'LOAD_CSV', args: { file: f } }; }
            parseLoadExcel() { this.consume(TokenType.KEYWORD, 'LOAD_EXCEL'); this.consume(TokenType.KEYWORD, 'FILE'); const f = this.consume(TokenType.STRING_LITERAL).value; let s = null; if (this.match(TokenType.KEYWORD, 'SHEET')) s = this.consume(TokenType.STRING_LITERAL).value; return { command: 'LOAD_EXCEL', args: { file: f, sheet: s } }; }
            parseColumnList() { const c = []; do { if (this.peek().type === TokenType.STRING_LITERAL) c.push(this.consume(TokenType.STRING_LITERAL).value); else if (this.peek().type === TokenType.IDENTIFIER) c.push(this.consume(TokenType.IDENTIFIER).value); else this.error("Expected column name (identifier or string literal)."); } while (this.match(TokenType.PUNCTUATION, ',')); return c; }
            parseKeepColumns() { this.consume(TokenType.KEYWORD, 'KEEP_COLUMNS'); const c = this.parseColumnList(); return { command: 'KEEP_COLUMNS', args: { columns: c } }; }
            parseDropColumns() { this.consume(TokenType.KEYWORD, 'DROP_COLUMNS'); const c = this.parseColumnList(); return { command: 'DROP_COLUMNS', args: { columns: c } }; }
            parseFilterRows() { this.consume(TokenType.KEYWORD, 'FILTER_ROWS'); this.consume(TokenType.KEYWORD, 'WHERE'); const cond = { column: null, operator: null, value: null };
                if (this.peek().type === TokenType.IDENTIFIER) cond.column = this.consume(TokenType.IDENTIFIER).value; else if (this.peek().type === TokenType.STRING_LITERAL) cond.column = this.consume(TokenType.STRING_LITERAL).value; else this.error("Expected column name for filter condition.");
                const opToken = this.peek();
                if ((opToken.type === TokenType.KEYWORD || opToken.type === TokenType.OPERATOR) && CONDITION_OPERATORS.includes(opToken.value)) cond.operator = this.advance().value;
                else if (opToken.value === 'IS' && this.lookAhead(1)?.value === 'NOT') { this.advance(); this.advance(); cond.operator = 'IS NOT';}
                else this.error(`Expected filter operator (e.g., IS, >, CONTAINS) but got ${opToken.value}`);
                if (this.peek().type === TokenType.STRING_LITERAL) cond.value = this.consume(TokenType.STRING_LITERAL).value; else if (this.peek().type === TokenType.NUMBER_LITERAL) cond.value = this.consume(TokenType.NUMBER_LITERAL).value; else if (this.peek().type === TokenType.IDENTIFIER) cond.value = { type: 'COLUMN_REFERENCE', name: this.consume(TokenType.IDENTIFIER).value }; else this.error("Expected value (string, number, or column identifier) for filter condition.");
                return { command: 'FILTER_ROWS', args: { condition: cond } };
            }
            parseExpression() { const p = []; while(!this.isAtEnd() && this.peek().type !== TokenType.NEWLINE && !['THEN', 'STORE_AS'].includes(this.peek().value) ) { const t = this.peek(); if (['IDENTIFIER', 'STRING_LITERAL', 'NUMBER_LITERAL'].includes(t.type) || (t.type === TokenType.OPERATOR && ['*', '/', '+', '-'].includes(t.value))) p.push(this.advance()); else break; } if (p.length === 0) this.error("Expected expression for NEW_COLUMN."); return p.map(i => ({ type: i.type, value: i.value })); }
            parseNewColumn() { this.consume(TokenType.KEYWORD, 'NEW_COLUMN'); let n; if (this.peek().type === TokenType.STRING_LITERAL) n = this.consume(TokenType.STRING_LITERAL).value; else n = this.consume(TokenType.IDENTIFIER).value; this.consume(TokenType.KEYWORD, 'AS'); const e = this.parseExpression(); return { command: 'NEW_COLUMN', args: { newColumnName: n, expression: e } }; }
            parseRenameColumn() { this.consume(TokenType.KEYWORD, 'RENAME_COLUMN'); let o; if(this.peek().type === TokenType.STRING_LITERAL) o = this.consume(TokenType.STRING_LITERAL).value; else o = this.consume(TokenType.IDENTIFIER).value; this.consume(TokenType.KEYWORD, 'TO'); let n; if(this.peek().type === TokenType.STRING_LITERAL) n = this.consume(TokenType.STRING_LITERAL).value; else n = this.consume(TokenType.IDENTIFIER).value; return { command: 'RENAME_COLUMN', args: { oldName: o, newName: n } }; }
            parseSortBy() { this.consume(TokenType.KEYWORD, 'SORT_BY'); let c; if(this.peek().type === TokenType.STRING_LITERAL) c = this.consume(TokenType.STRING_LITERAL).value; else c = this.consume(TokenType.IDENTIFIER).value; let o = 'ASC'; if (this.match(TokenType.KEYWORD, 'ORDER')) { const ot = this.consume(TokenType.STRING_LITERAL); if (['ASC', 'DESC'].includes(ot.value.toUpperCase())) o = ot.value.toUpperCase(); else this.error("Sort order must be 'ASC' or 'DESC'."); } return { command: 'SORT_BY', args: { column: c, order: o } }; }
            parseStoreAs() { this.consume(TokenType.KEYWORD, 'STORE_AS'); const v = this.consume(TokenType.IDENTIFIER).value; return { command: 'STORE_AS', args: { variableName: v } }; }
            parseExportCsv() { this.consume(TokenType.KEYWORD, 'EXPORT_CSV'); this.consume(TokenType.KEYWORD, 'TO'); const f = this.consume(TokenType.STRING_LITERAL).value; return { command: 'EXPORT_CSV', args: { file: f } }; }
            parseExportExcel() { this.consume(TokenType.KEYWORD, 'EXPORT_EXCEL'); this.consume(TokenType.KEYWORD, 'TO'); const f = this.consume(TokenType.STRING_LITERAL).value; let s = 'Sheet1'; if (this.match(TokenType.KEYWORD, 'SHEET')) s = this.consume(TokenType.STRING_LITERAL).value; return { command: 'EXPORT_EXCEL', args: { file: f, sheet: s } }; }
            parsePeek() { this.consume(TokenType.KEYWORD, 'PEEK'); return { command: 'PEEK', args: {} }; }
            match(type, value) { if (this.isAtEnd()) return false; const t = this.peek(); if (t.type !== type) return false; if (value !== undefined && t.value !== value) return false; this.advance(); return true; }
            consume(type, value) { const t = this.peek(); if (t.type === type && (value === undefined || t.value === value)) return this.advance(); this.error(`Expected ${type} '${value || ''}' but got ${t.type} '${t.value}' at line ${t.line}`); }
            peek() { return this.tokens[this.position]; }
            lookAhead(offset = 1) { if (this.position + offset >= this.tokens.length) return this.tokens[this.tokens.length - 1]; return this.tokens[this.position + offset]; }
            advance() { if (!this.isAtEnd()) this.position++; return this.previous(); }
            previous() { return this.tokens[this.position - 1]; }
            isAtEnd() { return this.position >= this.tokens.length || this.peek().type === TokenType.EOF; }
            error(message) { const t = this.peek() || this.previous(); throw new Error(`Parse Error (Line ${t.line}): ${message}`); }
        }

        // --- Interpreter ---
        class Interpreter {
            constructor() {
                this.variables = {};
                this.currentDataset = null; 
                this.logOutputEl = document.getElementById('logOutput');
                this.peekOutputEl = document.getElementById('peekOutputContainer');
                this.fileInputEl = document.getElementById('csvFileInput');
                this.fileInputContainerEl = document.getElementById('fileInputContainer');
                this.filePromptMessageEl = document.getElementById('filePromptMessage');
                this.fileResolve = null; 
            }

            log(message) { console.log(message); const time = new Date().toLocaleTimeString(); if (this.logOutputEl) { this.logOutputEl.innerHTML += `[${time}] ${message}<br>`; this.logOutputEl.scrollTop = this.logOutputEl.scrollHeight; } }
            clearLogsAndPeek() { if (this.logOutputEl) this.logOutputEl.innerHTML = 'Logs will appear here...<br>'; if (this.peekOutputEl) this.peekOutputEl.innerHTML = 'Peek results will appear here...'; }
            async requestCsvFile(fileNameHint) { this.fileInputContainerEl.classList.remove('hidden'); this.filePromptMessageEl.textContent = `Script wants to load: "${fileNameHint}". Please select the corresponding CSV file.`; this.fileInputEl.value = ''; return new Promise((resolve, reject) => { this.fileResolve = (file) => { if (file) resolve(file); else reject(new Error("File selection cancelled or no file provided.")); }; }); }
            async run(ast) { this.log('Interpreter started.'); for (const pipeline of ast) { for (const commandNode of pipeline) { this.log(`Executing: ${commandNode.command}`); try { await this.executeCommand(commandNode); } catch (e) { const err = e instanceof Error ? e.message : JSON.stringify(e); this.log(`ERROR executing ${commandNode.command}: ${err}`); console.error(`Error for ${commandNode.command}:`, e); if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden'); return; } } } this.log('Interpreter finished.'); if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden'); }
            async executeCommand(commandNode) { const { command, args } = commandNode; switch (command) { case 'LOAD_CSV': await this.handleLoadCsv(args); break; case 'KEEP_COLUMNS': this.handleKeepColumns(args); break; case 'PEEK': this.handlePeek(args); break; default: this.log(`Command ${command} is parsed but not yet implemented.`); } }
            async nativeParseCsv(fileContent) {
                return new Promise((resolve, reject) => {
                    Papa.parse(fileContent, {
                        header: true,
                        skipEmptyLines: true,
                        dynamicTyping: true,
                        complete: (results) => {
                            resolve({
                                data: results.data,
                                meta: { fields: results.meta.fields }
                            });
                        },
                        error: (err) => {
                            reject(err);
                        }
                    });
                });
}
// ...existing code...
            async handleLoadCsv(args) { if (!this.fileInputEl) throw new Error("File input not available."); const file = await this.requestCsvFile(args.file); return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = async (event) => { try { this.log("Using native CSV parser."); const results = await this.nativeParseCsv(event.target.result); this.currentDataset = results.data; this.log(`Loaded ${this.currentDataset.length} rows from ${file.name}. Headers: ${results.meta.fields ? results.meta.fields.join(', ') : 'N/A'}`); if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden'); resolve(); } catch (err) { this.log(`Native CSV parsing error: ${err.message}`); if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden'); reject(err); } }; reader.onerror = (err) => { this.log(`FileReader error: ${err.message}`); if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden'); reject(err); }; reader.readAsText(file); }); }
            handleKeepColumns(args) { if (!this.currentDataset) throw new Error("No dataset for KEEP_COLUMNS."); const { columns } = args; if (!Array.isArray(columns)) throw new Error("Invalid columns for KEEP_COLUMNS."); this.currentDataset = this.currentDataset.map(row => { const newRow = {}; columns.forEach(colName => { const actualColName = Object.keys(row).find(key => key.toLowerCase() === colName.toLowerCase()) || colName; if (row.hasOwnProperty(actualColName)) newRow[colName] = row[actualColName]; }); return newRow; }); this.log(`Kept columns: ${columns.join(', ')}. Rows: ${this.currentDataset.length}.`); }
            handlePeek(args) { if (!this.currentDataset) { if (this.peekOutputEl) this.peekOutputEl.innerHTML = '<p>No dataset to PEEK.</p>'; this.log("PEEK: No dataset."); return; } const peekCount = 10; const data = this.currentDataset.slice(0, peekCount); if (data.length === 0) { if (this.peekOutputEl) this.peekOutputEl.innerHTML = '<p>Dataset is empty.</p>'; this.log("PEEK: Dataset empty."); return; } let html = '<table><thead><tr>'; const allKeys = new Set(); this.currentDataset.forEach(r => Object.keys(r).forEach(k => allKeys.add(k))); const headers = Array.from(allKeys); headers.forEach(h => html += `<th>${String(h).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</th>`); html += '</tr></thead><tbody>'; data.forEach(r => { html += '<tr>'; headers.forEach(h => { const v = r[h]; html += `<td>${v === null || v === undefined ? '' : String(v).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`; }); html += '</tr>'; }); html += `</tbody></table><p class="text-xs mt-2">Showing ${data.length} of ${this.currentDataset.length} rows. Columns: ${headers.length}.</p>`; if (this.peekOutputEl) this.peekOutputEl.innerHTML = html; this.log(`PEEK displayed ${data.length} rows.`); }
        }

        // --- Syntax Highlighting Logic ---
        function escapeHtml(unsafe) {
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        }

        function applySyntaxHighlighting(text) {
            const tokens = tokenizeForHighlighting(text); 
            let html = '';
            tokens.forEach(token => {
                const escapedValue = escapeHtml(token.value);
                switch (token.type) {
                    case TokenType.KEYWORD: html += `<span class="token-keyword">${escapedValue}</span>`; break;
                    case TokenType.STRING_LITERAL: html += `<span class="token-string_literal">${escapedValue}</span>`; break;
                    case TokenType.NUMBER_LITERAL: html += `<span class="token-number_literal">${escapedValue}</span>`; break;
                    case TokenType.COMMENT: html += `<span class="token-comment">${escapedValue}</span>`; break;
                    case TokenType.OPERATOR: html += `<span class="token-operator">${escapedValue}</span>`; break;
                    case TokenType.IDENTIFIER: html += `<span class="token-identifier">${escapedValue}</span>`; break;
                    case TokenType.PUNCTUATION: html += `<span class="token-punctuation">${escapedValue}</span>`; break;
                    case TokenType.NEWLINE: html += '\n'; break; 
                    case TokenType.WHITESPACE: html += escapedValue; break; 
                    default: html += escapedValue; 
                }
            });
            return html;
        }


        // --- Main ---
        document.addEventListener('DOMContentLoaded', () => {
            const inputArea = document.getElementById('pipeDataInput');
            const highlightingOverlay = document.getElementById('highlightingOverlay'); 
            const astOutputArea = document.getElementById('astOutput');
            const runButton = document.getElementById('runButton');
            const clearButton = document.getElementById('clearButton');
            const csvFileInput = document.getElementById('csvFileInput');
            
            const interpreter = new Interpreter(); 

            const defaultScript = `# Welcome to PipeData!
# 1. Write your script.
# 2. If using LOAD_CSV, the "Choose File" prompt will appear when you run.
# 3. Click "Run Script".

LOAD_CSV FILE "your_data.csv"
THEN
    PEEK
THEN
    KEEP_COLUMNS "Column Name From CSV", AnotherColumn
    # Ensure column names match your CSV headers (case might matter depending on CSV).
THEN
    PEEK
`;
            inputArea.value = defaultScript;
            highlightingOverlay.innerHTML = applySyntaxHighlighting(inputArea.value);


            inputArea.addEventListener('input', () => {
                const text = inputArea.value;
                highlightingOverlay.innerHTML = applySyntaxHighlighting(text);
                highlightingOverlay.scrollTop = inputArea.scrollTop;
                highlightingOverlay.scrollLeft = inputArea.scrollLeft;
            });

            inputArea.addEventListener('scroll', () => {
                highlightingOverlay.scrollTop = inputArea.scrollTop;
                highlightingOverlay.scrollLeft = inputArea.scrollLeft;
            });
            
            new ResizeObserver(() => {
                // Attempt to sync height more reliably
                highlightingOverlay.style.height = inputArea.clientHeight + 'px'; 
                highlightingOverlay.style.width = inputArea.clientWidth + 'px';
            }).observe(inputArea);


            csvFileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (interpreter.fileResolve) { 
                    interpreter.fileResolve(file);  
                    interpreter.fileResolve = null; 
                }
            });

            runButton.addEventListener('click', async () => {
                const script = inputArea.value; 
                astOutputArea.classList.remove('error-box');
                astOutputArea.textContent = 'Parsing...';
                interpreter.clearLogsAndPeek(); 

                try {
                    const tokensForParser = tokenizeForParser(script);
                    const parser = new Parser(tokensForParser);
                    const ast = parser.parse();
                    astOutputArea.textContent = JSON.stringify(ast, null, 2);
                    
                    await interpreter.run(ast);

                } catch (e) {
                    astOutputArea.classList.add('error-box');
                    const errorMessage = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
                    const stackTrace = e instanceof Error && e.stack ? e.stack.split('\n').slice(0,3).join('\n') : '';
                    astOutputArea.textContent = `Error: ${errorMessage}\n${stackTrace}`;
                    interpreter.log(`Error during parsing or execution: ${errorMessage}`);
                    console.error("Full error object:", e);
                }
            });

            clearButton.addEventListener('click', () => {
                interpreter.clearLogsAndPeek();
                astOutputArea.textContent = 'AST will appear here...';
                astOutputArea.classList.remove('error-box');
                inputArea.value = ''; 
                highlightingOverlay.innerHTML = ''; 
                if (document.getElementById('fileInputContainer')) {
                     document.getElementById('fileInputContainer').classList.add('hidden');
                }
            });
        });
    