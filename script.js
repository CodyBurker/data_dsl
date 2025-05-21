// --- Tokenizer (Lexer) ---
        const TokenType = {
            KEYWORD: 'KEYWORD', IDENTIFIER: 'IDENTIFIER', STRING_LITERAL: 'STRING_LITERAL',
            NUMBER_LITERAL: 'NUMBER_LITERAL', OPERATOR: 'OPERATOR', PUNCTUATION: 'PUNCTUATION',
            COMMENT: 'COMMENT',
            NEWLINE: 'NEWLINE', EOF: 'EOF', WHITESPACE: 'WHITESPACE', UNKNOWN: 'UNKNOWN'
        };
        const KEYWORDS = [
            'VAR',
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
                if (char === '#') {
                    while (cursor < input.length && input[cursor] !== '\n') {
                        cursor++;
                    }
                    continue;
                }
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
            return tokens;
        }

        class Parser {
            constructor(tokens) {
                this.tokens = tokens;
                this.position = 0;
                this.ast = [];
            }

            parse() {
                this.ast = [];
                while (!this.isAtEnd()) {
                    this.skipNewlines();
                    if (this.isAtEnd()) break;

                    if (this.peek().type === TokenType.KEYWORD && this.peek().value === 'VAR') {
                        const varBlock = this.parseVarBlock();
                        if (varBlock) {
                            this.ast.push(varBlock);
                        }
                    } else {
                        this.error("Expected 'VAR' to start a new pipeline block.");
                    }
                }
                return this.ast;
            }

            parseVarBlock() {
                this.consume(TokenType.KEYWORD, 'VAR');
                const variableNameToken = this.consume(TokenType.STRING_LITERAL, undefined, "Expected variable name as string literal after VAR (e.g., \"myVar\")");
                const variableName = variableNameToken.value;

                const commands = [];
                this.skipNewlines();

                this.consume(TokenType.KEYWORD, 'THEN', `VAR "${variableName}" must be followed by 'THEN'.`);
                this.skipNewlines();

                if (this.isAtEnd() || (this.peek().type === TokenType.KEYWORD && this.peek().value === 'VAR')) {
                    this.error(`VAR "${variableName}" THEN must be followed by at least one command.`);
                }

                let command = this.parseCommand();
                if (command) {
                    commands.push(command);
                } else {
                    this.error(`Expected a command after VAR "${variableName}" THEN.`);
                }

                while (!this.isAtEnd()) {
                    this.skipNewlines();

                    if (this.peek().type === TokenType.KEYWORD && this.peek().value === 'THEN') {
                        this.consume(TokenType.KEYWORD, 'THEN');
                        this.skipNewlines();

                        if (this.isAtEnd() || (this.peek().type === TokenType.KEYWORD && this.peek().value === 'VAR')) {
                            this.error(`'THEN' must be followed by another command within VAR "${variableName}".`);
                        }

                        command = this.parseCommand();
                        if (command) {
                            commands.push(command);
                        } else {
                            this.error(`Expected a command after 'THEN' in VAR "${variableName}" block.`);
                        }
                    } else {
                        if ((this.peek().type === TokenType.KEYWORD && this.peek().value === 'VAR') || this.isAtEnd()) {
                           break;
                        }
                        this.error(`Unexpected token '${this.peek().value}' in VAR "${variableName}" block. Expected 'THEN' or start of new VAR block.`);
                    }
                }

                if (commands.length === 0) {
                    this.error(`VAR "${variableName}" processing failed to identify commands (internal check).`);
                }
                return { variableName: variableName, pipeline: commands };
            }

            skipNewlines() {
                while(!this.isAtEnd() && this.peek().type === TokenType.NEWLINE) {
                    this.advance();
                }
            }

            parseCommand() {
                this.skipNewlines();
                const t = this.peek();
                if (t.type === TokenType.EOF) return null;

                if (t.type !== TokenType.KEYWORD) {
                    this.error(`Expected command keyword but got ${t.type} '${t.value}'`);
                }
                switch (t.value) {
                    case 'LOAD_CSV': return this.parseLoadCsv();
                    case 'LOAD_EXCEL': return this.parseLoadExcel();
                    case 'KEEP_COLUMNS': return this.parseKeepColumns();
                    case 'DROP_COLUMNS': return this.parseDropColumns();
                    case 'FILTER_ROWS': return this.parseFilterRows();
                    case 'NEW_COLUMN': return this.parseNewColumn();
                    case 'RENAME_COLUMN': return this.parseRenameColumn();
                    case 'SORT_BY': return this.parseSortBy();
                    case 'STORE_AS': return this.parseStoreAs();
                    case 'EXPORT_CSV': return this.parseExportCsv();
                    case 'EXPORT_EXCEL': return this.parseExportExcel();
                    case 'PEEK': return this.parsePeek();
                    default:
                        this.error(`Unexpected keyword '${t.value}' found where a command was expected.`);
                        return null;
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
                if ((opToken.type === TokenType.KEYWORD || opToken.type === TokenType.OPERATOR) && CONDITION_OPERATORS.includes(opToken.value.toUpperCase())) cond.operator = this.advance().value.toUpperCase();
                else if (opToken.value.toUpperCase() === 'IS' && this.lookAhead(1)?.value.toUpperCase() === 'NOT') { this.advance(); this.advance(); cond.operator = 'IS NOT';}
                else this.error(`Expected filter operator (e.g., IS, >, CONTAINS) but got ${opToken.value}`);
                if (this.peek().type === TokenType.STRING_LITERAL) cond.value = this.consume(TokenType.STRING_LITERAL).value; else if (this.peek().type === TokenType.NUMBER_LITERAL) cond.value = this.consume(TokenType.NUMBER_LITERAL).value; else if (this.peek().type === TokenType.IDENTIFIER) cond.value = { type: 'COLUMN_REFERENCE', name: this.consume(TokenType.IDENTIFIER).value }; else this.error("Expected value (string, number, or column identifier) for filter condition.");
                return { command: 'FILTER_ROWS', args: { condition: cond } };
            }
            parseExpression() { const p = []; while(!this.isAtEnd() && this.peek().type !== TokenType.NEWLINE && !['THEN', 'STORE_AS', 'VAR'].includes(this.peek().value) ) { const t = this.peek(); if (['IDENTIFIER', 'STRING_LITERAL', 'NUMBER_LITERAL'].includes(t.type) || (t.type === TokenType.OPERATOR && ['*', '/', '+', '-'].includes(t.value))) p.push(this.advance()); else break; } if (p.length === 0) this.error("Expected expression for NEW_COLUMN."); return p.map(i => ({ type: i.type, value: i.value })); }
            parseNewColumn() { this.consume(TokenType.KEYWORD, 'NEW_COLUMN'); let n; if (this.peek().type === TokenType.STRING_LITERAL) n = this.consume(TokenType.STRING_LITERAL).value; else n = this.consume(TokenType.IDENTIFIER).value; this.consume(TokenType.KEYWORD, 'AS'); const e = this.parseExpression(); return { command: 'NEW_COLUMN', args: { newColumnName: n, expression: e } }; }
            parseRenameColumn() { this.consume(TokenType.KEYWORD, 'RENAME_COLUMN'); let o; if(this.peek().type === TokenType.STRING_LITERAL) o = this.consume(TokenType.STRING_LITERAL).value; else o = this.consume(TokenType.IDENTIFIER).value; this.consume(TokenType.KEYWORD, 'TO'); let n; if(this.peek().type === TokenType.STRING_LITERAL) n = this.consume(TokenType.STRING_LITERAL).value; else n = this.consume(TokenType.IDENTIFIER).value; return { command: 'RENAME_COLUMN', args: { oldName: o, newName: n } }; }
            parseSortBy() { this.consume(TokenType.KEYWORD, 'SORT_BY'); let c; if(this.peek().type === TokenType.STRING_LITERAL) c = this.consume(TokenType.STRING_LITERAL).value; else c = this.consume(TokenType.IDENTIFIER).value; let o = 'ASC'; if (this.match(TokenType.KEYWORD, 'ORDER')) { const ot = this.consume(TokenType.STRING_LITERAL); if (['ASC', 'DESC'].includes(ot.value.toUpperCase())) o = ot.value.toUpperCase(); else this.error("Sort order must be 'ASC' or 'DESC'."); } return { command: 'SORT_BY', args: { column: c, order: o } }; }
            parseStoreAs() { this.consume(TokenType.KEYWORD, 'STORE_AS'); const v = this.consume(TokenType.IDENTIFIER).value; return { command: 'STORE_AS', args: { variableName: v } }; }
            parseExportCsv() { this.consume(TokenType.KEYWORD, 'EXPORT_CSV'); this.consume(TokenType.KEYWORD, 'TO'); const f = this.consume(TokenType.STRING_LITERAL).value; return { command: 'EXPORT_CSV', args: { file: f } }; }
            parseExportExcel() { this.consume(TokenType.KEYWORD, 'EXPORT_EXCEL'); this.consume(TokenType.KEYWORD, 'TO'); const f = this.consume(TokenType.STRING_LITERAL).value; let s = 'Sheet1'; if (this.match(TokenType.KEYWORD, 'SHEET')) s = this.consume(TokenType.STRING_LITERAL).value; return { command: 'EXPORT_EXCEL', args: { file: f, sheet: s } }; }

            parsePeek() {
                const peekToken = this.peek();
                this.consume(TokenType.KEYWORD, 'PEEK');
                return { command: 'PEEK', args: {}, line: peekToken.line };
            }

            match(type, value) { if (this.isAtEnd()) return false; const t = this.peek(); if (t.type !== type) return false; if (value !== undefined && t.value !== value) return false; this.advance(); return true; }
            consume(type, value, errorMessage) {
                const currentToken = this.peek();
                if (currentToken.type === type && (value === undefined || currentToken.value === value)) {
                    return this.advance();
                }
                const defaultError = `Expected ${type} ${value !== undefined ? "'" + value + "'" : ''} but got ${currentToken.type} '${currentToken.value}' at line ${currentToken.line}`;
                this.error(errorMessage || defaultError);
            }
            peek() { return this.tokens[this.position]; }
            lookAhead(offset = 1) { if (this.position + offset >= this.tokens.length) return this.tokens[this.tokens.length - 1]; return this.tokens[this.position + offset]; }
            advance() { if (!this.isAtEnd()) this.position++; return this.previous(); }
            previous() { return this.tokens[this.position - 1]; }
            isAtEnd() { return this.position >= this.tokens.length || this.peek().type === TokenType.EOF; }
            error(message) { const t = this.peek() || this.previous() || {line: 'Unknown', value: 'N/A'}; throw new Error(`Parse Error (Line ${t.line}, near '${t.value}'): ${message}`); }
        }

        class Interpreter {
            constructor() {
                this.variables = {};
                this.activeVariableName = null;
                this.logOutputEl = document.getElementById('logOutput');
                this.peekTabsContainerEl = document.getElementById('peekTabsContainer');
                this.peekOutputsDisplayAreaEl = document.getElementById('peekOutputsDisplayArea');
                this.peekOutputs = [];

                this.fileInputEl = document.getElementById('csvFileInput');
                this.fileInputContainerEl = document.getElementById('fileInputContainer');
                this.filePromptMessageEl = document.getElementById('filePromptMessage');
                this.fileResolve = null;
                this.currentEditorHighlightLine = null; 
            }

            log(message) { console.log(message); const time = new Date().toLocaleTimeString(); if (this.logOutputEl) { this.logOutputEl.innerHTML += `[${time}] ${message}<br>`; this.logOutputEl.scrollTop = this.logOutputEl.scrollHeight; } }

            clearLogsAndPeek() {
                if (this.logOutputEl) this.logOutputEl.innerHTML = 'Logs will appear here...<br>';

                this.peekOutputs = [];
                if (this.peekTabsContainerEl) this.peekTabsContainerEl.innerHTML = '';
                if (this.peekOutputsDisplayAreaEl) {
                    this.peekOutputsDisplayAreaEl.innerHTML = '<div class="output-box-placeholder">Peek results will appear here when a script is run.</div>';
                }
                this.clearEditorPeekHighlight(); 
            }

            clearEditorPeekHighlight() {
                const inputArea = document.getElementById('pipeDataInput');
                const highlightingOverlay = document.getElementById('highlightingOverlay');
                if (inputArea && highlightingOverlay && this.currentEditorHighlightLine !== null) {
                    highlightingOverlay.innerHTML = applySyntaxHighlighting(inputArea.value, null);
                    this.currentEditorHighlightLine = null;
                } else if (inputArea && highlightingOverlay && this.currentEditorHighlightLine === null) {
                     highlightingOverlay.innerHTML = applySyntaxHighlighting(inputArea.value, null);
                }
            }


            async requestCsvFile(fileNameHint, forVariable) {
                this.fileInputContainerEl.classList.remove('hidden');
                this.filePromptMessageEl.textContent = `Pipeline for VAR "${forVariable}": Select CSV for ${fileNameHint}.`;
                this.fileInputEl.value = '';
                return new Promise((resolve, reject) => {
                    this.fileResolve = (file) => {
                        if (file) {
                            resolve(file);
                        } else {
                            this.log(`File selection cancelled for VAR "${forVariable}".`);
                            reject(new Error("File selection cancelled or no file provided."));
                        }
                    };
                });
            }

            async run(ast) {
                this.log('Interpreter started.');
                this.peekOutputs = [];
                this.clearEditorPeekHighlight(); 

                for (const varBlock of ast) {
                    this.activeVariableName = varBlock.variableName;
                    this.log(`Processing block for VAR "${this.activeVariableName}"`);
                    this.variables[this.activeVariableName] = null;

                    for (const commandNode of varBlock.pipeline) {
                        this.log(`Executing: ${commandNode.command} for VAR "${this.activeVariableName}"` + (commandNode.line ? ` (Line ${commandNode.line})` : ''));
                        try {
                            await this.executeCommand(commandNode);
                        } catch (e) {
                            const err = e instanceof Error ? e.message : JSON.stringify(e);
                            this.log(`ERROR executing ${commandNode.command} for VAR "${this.activeVariableName}": ${err}`);
                            console.error(`Error details for ${commandNode.command} (VAR "${this.activeVariableName}"):`, e);
                            if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden');
                            this.renderPeekOutputsUI();
                            return;
                        }
                    }
                    this.log(`Finished block for VAR "${this.activeVariableName}"`);
                }
                this.log('Interpreter finished all blocks.');
                this.renderPeekOutputsUI();
                this.activeVariableName = null;
                if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden');
            }

            async executeCommand(commandNode) {
                const { command, args } = commandNode;
                switch (command) {
                    case 'LOAD_CSV':
                        this.variables[this.activeVariableName] = await this.handleLoadCsv(args);
                        break;
                    case 'KEEP_COLUMNS':
                        this.variables[this.activeVariableName] = this.handleKeepColumns(args, this.variables[this.activeVariableName]);
                        break;
                    case 'PEEK':
                        const currentDataset = this.variables[this.activeVariableName];
                        const peekLine = commandNode.line;
                        const peekHtmlContent = this.generatePeekHtml(currentDataset, this.activeVariableName, peekLine);
                        const peekId = `peek-${this.activeVariableName || 'context'}-l${peekLine}-idx${this.peekOutputs.length}`;

                        this.peekOutputs.push({
                            id: peekId,
                            varName: this.activeVariableName || 'Current Context',
                            line: peekLine,
                            htmlContent: peekHtmlContent
                        });
                        this.log(`PEEK data for VAR "${this.activeVariableName}" (Line ${peekLine}) captured.`);
                        break;
                    case 'STORE_AS':
                        this.log(`Command STORE_AS for VAR "${this.activeVariableName}" is parsed. Current active dataset for "${this.activeVariableName}" will be copied to "${args.variableName}".`);
                        if (this.variables[this.activeVariableName]) {
                            this.variables[args.variableName] = JSON.parse(JSON.stringify(this.variables[this.activeVariableName]));
                             this.log(`Dataset from VAR "${this.activeVariableName}" copied to new VAR "${args.variableName}".`);
                        } else {
                            this.log(`Cannot STORE_AS: VAR "${this.activeVariableName}" has no data to copy.`);
                             throw new Error(`No data in VAR "${this.activeVariableName}" to copy using STORE_AS.`);
                        }
                        break;
                    default: this.log(`Command ${command} for VAR "${this.activeVariableName}" is parsed but not yet fully implemented.`);
                }
            }

            async nativeParseCsv(fileContent) {
                return new Promise((resolve, reject) => {
                    try {
                        const lines = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(line => line.trim() !== '');
                        if (lines.length === 0) { resolve({ data: [], meta: { fields: [] } }); return; }
                        const headers = lines[0].split(',').map(h => h.trim());
                        const data = [];
                        for (let i = 1; i < lines.length; i++) {
                            const values = lines[i].split(',').map(v => v.trim());
                            const row = {};
                            headers.forEach((h, idx) => {
                                let v = values[idx];
                                if (v !== undefined && v !== "" && !isNaN(Number(v))) v = Number(v);
                                else if (v && (v.toLowerCase()==='true' || v.toLowerCase()==='false')) v = v.toLowerCase()==='true';
                                row[h] = v;
                            });
                            data.push(row);
                        }
                        resolve({ data, meta: { fields: headers } });
                    } catch (err) { reject(err); }
                });
            }

            async handleLoadCsv(args) {
                if (!this.fileInputEl) throw new Error("File input not available.");
                const file = await this.requestCsvFile(args.file, this.activeVariableName);

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            this.log(`Using native CSV parser for VAR "${this.activeVariableName}".`);
                            const results = await this.nativeParseCsv(event.target.result);
                            this.log(`Loaded ${results.data.length} rows for VAR "${this.activeVariableName}" from ${file.name}. Headers: ${results.meta.fields ? results.meta.fields.join(', ') : 'N/A'}`);
                            if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden');
                            resolve(results.data);
                        } catch (err) {
                            this.log(`Native CSV parsing error for VAR "${this.activeVariableName}": ${err.message}`);
                            if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden');
                            reject(err);
                        }
                    };
                    reader.onerror = (err) => {
                        this.log(`FileReader error for VAR "${this.activeVariableName}": ${err.message}`);
                        if (this.fileInputContainerEl) this.fileInputContainerEl.classList.add('hidden');
                        reject(err);
                    };
                    reader.readAsText(file);
                });
            }

            handleKeepColumns(args, currentDataset) {
                if (!currentDataset) throw new Error(`No dataset loaded for VAR "${this.activeVariableName}" to apply KEEP_COLUMNS.`);
                const { columns } = args;
                if (!Array.isArray(columns)) throw new Error(`Invalid columns argument for KEEP_COLUMNS in VAR "${this.activeVariableName}".`);

                const newDataset = currentDataset.map(row => {
                    const newRow = {};
                    columns.forEach(colName => {
                        const actualColName = Object.keys(row).find(key => key.toLowerCase() === colName.toLowerCase()) || colName;
                        if (row.hasOwnProperty(actualColName)) newRow[colName] = row[actualColName];
                    });
                    return newRow;
                });
                this.log(`Kept columns: ${columns.join(', ')} for VAR "${this.activeVariableName}". Rows: ${newDataset.length}.`);
                return newDataset;
            }

            generatePeekHtml(datasetToPeek, varName, line) {
                let outputHTML = `<h3 class="text-md font-semibold mb-2 text-gray-100">Data for: ${varName || 'Current Context'} (PEEK at Line ${line})</h3>`;

                if (!datasetToPeek) {
                    outputHTML += '<p class="text-gray-400">No dataset loaded to PEEK.</p>';
                } else {
                    const peekRowCount = 10;
                    const dataToDisplay = datasetToPeek.slice(0, peekRowCount);

                    if (dataToDisplay.length === 0) {
                        outputHTML += '<p class="text-gray-400">Dataset is empty.</p>';
                    } else {
                        let tableHtml = '<table><thead><tr>';
                        const allKeys = new Set();
                        datasetToPeek.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
                        const headers = Array.from(allKeys);

                        headers.forEach(header => tableHtml += `<th>${String(header).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</th>`);
                        tableHtml += '</tr></thead><tbody>';

                        dataToDisplay.forEach(row => {
                            tableHtml += '<tr>';
                            headers.forEach(header => {
                                const value = row[header];
                                tableHtml += `<td>${value === null || value === undefined ? '' : String(value).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`;
                            });
                            tableHtml += '</tr>';
                        });
                        tableHtml += `</tbody></table>`;
                        if (datasetToPeek.length > peekRowCount) {
                            tableHtml += `<p class="text-xs text-gray-400 mt-2">Showing first ${peekRowCount} of ${datasetToPeek.length} rows. Total columns: ${headers.length}.</p>`;
                        } else {
                            tableHtml += `<p class="text-xs text-gray-400 mt-2">Showing all ${datasetToPeek.length} rows. Total columns: ${headers.length}.</p>`;
                        }
                        outputHTML += tableHtml;
                    }
                }
                return outputHTML;
            }

            renderPeekOutputsUI() {
                if (!this.peekTabsContainerEl || !this.peekOutputsDisplayAreaEl) {
                    console.error("Peek UI elements not found!");
                    return;
                }

                this.peekTabsContainerEl.innerHTML = '';
                this.peekOutputsDisplayAreaEl.innerHTML = '';
                
                const inputArea = document.getElementById('pipeDataInput');
                const highlightingOverlay = document.getElementById('highlightingOverlay');

                if (this.peekOutputs.length === 0) {
                    this.peekOutputsDisplayAreaEl.innerHTML = '<div class="output-box-placeholder">No PEEK outputs to display.</div>';
                    this.clearEditorPeekHighlight(); 
                    return;
                }
                
                this.peekOutputs.forEach((peekData, index) => {
                    const tabButton = document.createElement('button');
                    tabButton.classList.add('peek-tab');
                    tabButton.textContent = `PEEK ${index + 1} (VAR "${peekData.varName}", L${peekData.line})`;
                    tabButton.dataset.target = peekData.id;

                    const contentDiv = document.createElement('div');
                    contentDiv.id = peekData.id;
                    contentDiv.classList.add('peek-content');
                    contentDiv.innerHTML = peekData.htmlContent;

                    this.peekTabsContainerEl.appendChild(tabButton);
                    this.peekOutputsDisplayAreaEl.appendChild(contentDiv);

                    tabButton.addEventListener('click', () => {
                        this.peekTabsContainerEl.querySelectorAll('.peek-tab').forEach(tab => tab.classList.remove('active-peek-tab'));
                        this.peekOutputsDisplayAreaEl.querySelectorAll('.peek-content').forEach(content => content.classList.remove('active-peek-content'));

                        tabButton.classList.add('active-peek-tab');
                        contentDiv.classList.add('active-peek-content');

                        if (inputArea && highlightingOverlay) {
                            highlightingOverlay.innerHTML = applySyntaxHighlighting(inputArea.value, peekData.line);
                            this.currentEditorHighlightLine = peekData.line;
                            
                            // Scroll to highlighted PEEK
                            const highlightedSpan = highlightingOverlay.querySelector('#active-editor-peek-highlight');
                            if (highlightedSpan) {
                                const scrollTargetOffset = highlightedSpan.offsetTop;
                                const inputAreaVisibleHeight = inputArea.clientHeight;
                                const desiredScrollTop = scrollTargetOffset - (inputAreaVisibleHeight / 3); // Aim for upper third

                                inputArea.scrollTop = Math.max(0, desiredScrollTop); // Ensure not negative
                                highlightingOverlay.scrollTop = inputArea.scrollTop; // Sync overlay
                            }
                        }
                    });

                    if (index === 0) { // Activate first tab by default
                        tabButton.classList.add('active-peek-tab');
                        contentDiv.classList.add('active-peek-content');
                        if (inputArea && highlightingOverlay) {
                            highlightingOverlay.innerHTML = applySyntaxHighlighting(inputArea.value, peekData.line);
                            this.currentEditorHighlightLine = peekData.line;
                             // Scroll to highlighted PEEK for the first active tab
                            const highlightedSpan = highlightingOverlay.querySelector('#active-editor-peek-highlight');
                            if (highlightedSpan) {
                                const scrollTargetOffset = highlightedSpan.offsetTop;
                                const inputAreaVisibleHeight = inputArea.clientHeight;
                                const desiredScrollTop = scrollTargetOffset - (inputAreaVisibleHeight / 3);

                                inputArea.scrollTop = Math.max(0, desiredScrollTop);
                                highlightingOverlay.scrollTop = inputArea.scrollTop;
                            }
                        }
                    }
                });
            }
        }

        function escapeHtml(unsafe) {
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        }

        function applySyntaxHighlighting(text, activePeekLine = null) {
            const tokens = tokenizeForHighlighting(text);
            let html = '';
            let currentVarBlockStyleIndex = 0;
            const varBlockStyles = ['var-block-bg-1', 'var-block-bg-2', 'var-block-bg-3', 'var-block-bg-4'];
            let inVarBlock = false;
            let blockContentHtml = '';
            const activePeekHighlightID = "active-editor-peek-highlight"; // Define ID for highlighted span

            function closeCurrentVarBlock() {
                if (inVarBlock && blockContentHtml.trim() !== '') {
                    html += `<div class="var-block ${varBlockStyles[currentVarBlockStyleIndex % varBlockStyles.length]}">${blockContentHtml}</div>`;
                    currentVarBlockStyleIndex++;
                } else if (blockContentHtml.trim() !== '') {
                    html += blockContentHtml;
                }
                blockContentHtml = '';
                inVarBlock = false;
            }

            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                let tokenHtml = '';
                const escapedValue = escapeHtml(token.value);

                if (token.type === TokenType.KEYWORD && token.value.toUpperCase() === 'VAR') {
                    closeCurrentVarBlock();
                    inVarBlock = true;
                }

                let classes = '';
                let idAttribute = ''; // Prepare for conditional ID

                switch (token.type) {
                    case TokenType.KEYWORD:
                        classes = 'token-keyword';
                        if (token.value.toUpperCase() === 'PEEK' && token.line === activePeekLine) {
                            classes += ' active-peek-line-highlight';
                            idAttribute = ` id="${activePeekHighlightID}"`; // Add ID only to the active PEEK
                        }
                        tokenHtml = `<span class="${classes}"${idAttribute}>${escapedValue}</span>`;
                        break;
                    case TokenType.STRING_LITERAL: tokenHtml = `<span class="token-string_literal">${escapedValue}</span>`; break;
                    case TokenType.NUMBER_LITERAL: tokenHtml = `<span class="token-number_literal">${escapedValue}</span>`; break;
                    case TokenType.COMMENT: tokenHtml = `<span class="token-comment">${escapedValue}</span>`; break;
                    case TokenType.OPERATOR: tokenHtml = `<span class="token-operator">${escapedValue}</span>`; break;
                    case TokenType.IDENTIFIER: tokenHtml = `<span class="token-identifier">${escapedValue}</span>`; break;
                    case TokenType.PUNCTUATION: tokenHtml = `<span class="token-punctuation">${escapedValue}</span>`; break;
                    case TokenType.NEWLINE: tokenHtml = '\n'; break;
                    case TokenType.WHITESPACE: tokenHtml = escapedValue; break;
                    default: tokenHtml = escapedValue;
                }

                if (inVarBlock) {
                    blockContentHtml += tokenHtml;
                } else {
                    html += tokenHtml;
                }
            }
            closeCurrentVarBlock();
            return html + '\n\n'; 
        }


        document.addEventListener('DOMContentLoaded', () => {
            const inputArea = document.getElementById('pipeDataInput');
            const highlightingOverlay = document.getElementById('highlightingOverlay');
            const astOutputArea = document.getElementById('astOutput');
            const runButton = document.getElementById('runButton');
            const clearButton = document.getElementById('clearButton');
            const csvFileInput = document.getElementById('csvFileInput');

            const interpreter = new Interpreter();

            const defaultScript = `VAR "citiesData"
THEN
    # Load CSV data into the "citiesData" variable
    LOAD_CSV FILE "cities.csv"
THEN
    PEEK  # Shows the content of "citiesData"
THEN
    KEEP_COLUMNS "City", "Population"
    # Note: Column names are case-sensitive based on your CSV!
THEN
    PEEK # Shows modified "citiesData"

# Add more lines to test scrolling
# Line
# Line
# Line
# Line
# Line
# Line
VAR "anotherVar"
THEN
    LOAD_CSV FILE "another.csv"
THEN
    PEEK # This is a PEEK on a later line
# Line
# Line
# Line
# Line
# Line
# Line
# Line
# Line
# Line
# Line
THEN
    PEEK # Another PEEK even later
`;
            inputArea.value = defaultScript;
            highlightingOverlay.innerHTML = applySyntaxHighlighting(inputArea.value, null); 
            interpreter.clearLogsAndPeek();

            inputArea.addEventListener('input', () => {
                const text = inputArea.value;
                highlightingOverlay.innerHTML = applySyntaxHighlighting(text, null);
                interpreter.currentEditorHighlightLine = null; 
                highlightingOverlay.scrollTop = inputArea.scrollTop;
                highlightingOverlay.scrollLeft = inputArea.scrollLeft;
            });

            inputArea.addEventListener('scroll', () => {
                highlightingOverlay.scrollTop = inputArea.scrollTop;
                highlightingOverlay.scrollLeft = inputArea.scrollLeft;
            });

            new ResizeObserver(() => {
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
                    const stackTrace = e instanceof Error && e.stack ? "\n" + e.stack.split('\n').slice(0,3).join('\n') : '';
                    astOutputArea.textContent = `Error: ${errorMessage}${stackTrace}`;
                    interpreter.log(`Error during parsing or execution: ${errorMessage}`);
                    console.error("Full error object:", e);
                    interpreter.renderPeekOutputsUI(); 
                }
            });

            clearButton.addEventListener('click', () => {
                interpreter.clearLogsAndPeek();
                astOutputArea.textContent = 'AST will appear here...';
                astOutputArea.classList.remove('error-box');
                if (document.getElementById('fileInputContainer')) {
                     document.getElementById('fileInputContainer').classList.add('hidden');
                }
            });
        });