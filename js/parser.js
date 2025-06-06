// parser.js
import { TokenType, KEYWORDS, CONDITION_OPERATORS } from './tokenizer.js';

export class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.position = 0;
        this.ast = [];
        this.errors = [];
    }

    parse() {
        this.ast = [];
        while (!this.isAtEnd()) {
            this.skipNewlines();
            if (this.isAtEnd()) break;

            if (this.peek().type === TokenType.KEYWORD && this.peek().value === 'VAR') {
                const varBlock = this.parseVarBlockStrict();
                if (varBlock) {
                    this.ast.push(varBlock);
                }
            } else {
                this.error("Expected 'VAR' to start a new pipeline block.");
            }
        }
        return this.ast;
    }

    parseAll() {
        this.ast = [];
        this.errors = [];
        while (!this.isAtEnd()) {
            this.skipNewlines();
            if (this.isAtEnd()) break;
            try {
                if (this.peek().type === TokenType.KEYWORD && this.peek().value === 'VAR') {
                    const varBlock = this.parseVarBlock();
                    if (varBlock) {
                        this.ast.push(varBlock);
                    }
                } else {
                    this.error("Expected 'VAR' to start a new pipeline block.");
                }
            } catch (e) {
                this.recordError(e);
                this.synchronize();
            }
        }
        return { ast: this.ast, errors: this.errors };
    }

    parseVarBlock() {
        const varToken = this.consume(TokenType.KEYWORD, 'VAR');
        const variableNameToken = this.consume(TokenType.STRING_LITERAL, undefined, "Expected variable name as string literal after VAR (e.g., \"myVar\")");
        const variableName = variableNameToken.value;
        const varLine = varToken.line;

        const commands = [];
        this.skipNewlines();

        try {
            this.consume(TokenType.KEYWORD, 'THEN', `VAR "${variableName}" must be followed by 'THEN'.`);
        } catch (e) {
            this.recordError(e);
            this.synchronize();
            return { variableName, line: varLine, pipeline: commands };
        }
        this.skipNewlines();

        if (this.isAtEnd() || (this.peek().type === TokenType.KEYWORD && this.peek().value === 'VAR')) {
            const err = new Error(`Parse Error (Line ${this.peek().line}, near '${this.peek().value}'): VAR "${variableName}" THEN must be followed by at least one command.`);
            err.line = this.peek().line;
            this.recordError(err);
            return { variableName, line: varLine, pipeline: commands };
        }

        const parseAndPush = () => {
            try {
                const c = this.parseCommand();
                if (c) commands.push(c);
            } catch (e) {
                this.recordError(e);
                this.synchronize();
            }
        };

        parseAndPush();

        while (!this.isAtEnd()) {
            this.skipNewlines();

            if (this.peek().type === TokenType.KEYWORD && this.peek().value === 'THEN') {
                const thenTok = this.consume(TokenType.KEYWORD, 'THEN');
                this.skipNewlines();

                if (this.isAtEnd() || (this.peek().type === TokenType.KEYWORD && this.peek().value === 'VAR')) {
                    const err = new Error(`Parse Error (Line ${thenTok.line}, near 'THEN'): 'THEN' must be followed by another command within VAR "${variableName}".`);
                    err.line = thenTok.line;
                    this.recordError(err);
                    this.synchronize();
                    continue;
                }

                parseAndPush();
            } else {
                if ((this.peek().type === TokenType.KEYWORD && this.peek().value === 'VAR') || this.isAtEnd()) {
                    break;
                }
                try {
                    this.error(`Unexpected token '${this.peek().value}' in VAR "${variableName}" block. Expected 'THEN' or start of new VAR block.`);
                } catch (e) {
                    this.recordError(e);
                    this.synchronize();
                }
            }
        }

        return { variableName: variableName, line: varLine, pipeline: commands };
    }

    parseVarBlockStrict() {
        const varToken = this.consume(TokenType.KEYWORD, 'VAR');
        const variableNameToken = this.consume(
            TokenType.STRING_LITERAL,
            undefined,
            "Expected variable name as string literal after VAR (e.g., \"myVar\")"
        );
        const variableName = variableNameToken.value;
        const varLine = varToken.line;

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
        return { variableName: variableName, line: varLine, pipeline: commands };
    }

    skipNewlines() {
        while(!this.isAtEnd() && this.peek().type === TokenType.NEWLINE) {
            this.advance();
        }
    }

    synchronize() {
        while (!this.isAtEnd() && this.peek().type !== TokenType.NEWLINE) {
            this.advance();
        }
        while (this.match(TokenType.NEWLINE)) {
            // consume remaining newlines
        }
    }

    parseCommand() {
        this.skipNewlines();
        const t = this.peek();
        const startLine = t.line;
        if (t.type === TokenType.EOF) return null;

        if (t.type !== TokenType.KEYWORD) {
            this.error(`Expected command keyword but got ${t.type} '${t.value}'`);
        }
        switch (t.value) {
            case 'LOAD_CSV': return { ...this.parseLoadCsv(), line: startLine };
            case 'LOAD_EXCEL': return { ...this.parseLoadExcel(), line: startLine };
            case 'KEEP_COLUMNS': return { ...this.parseKeepColumns(), line: startLine };
            case 'SELECT': return { ...this.parseSelect(), line: startLine };
            case 'DROP_COLUMNS':
            case 'DROP':
                return { ...this.parseDropColumns(), line: startLine };
            case 'FILTER': return { ...this.parseFilter(), line: startLine };
            case 'WITH': return { ...this.parseWithColumn(), line: startLine };
            case 'NEW_COLUMN': return { ...this.parseNewColumn(), line: startLine };
            case 'RENAME_COLUMN':
            case 'RENAME_COLUMNS':
                return { ...this.parseRenameColumns(), line: startLine };
            case 'SORT': return { ...this.parseSort(), line: startLine };
            case 'JOIN': return { ...this.parseJoin(), line: startLine };
            case 'GROUP_BY': return { ...this.parseGroupBy(), line: startLine };
            case 'AGGREGATE': return { ...this.parseAggregate(), line: startLine };
            // case 'STORE_AS': return this.parseStoreAs();
            case 'EXPORT_CSV': return { ...this.parseExportCsv(), line: startLine };
            case 'EXPORT_EXCEL': return { ...this.parseExportExcel(), line: startLine };
            default:
                this.error(`Unexpected keyword '${t.value}' found where a command was expected.`);
                return null;
        }
    }
    parseLoadCsv() { this.consume(TokenType.KEYWORD, 'LOAD_CSV'); this.consume(TokenType.KEYWORD, 'FILE'); const f = this.consume(TokenType.STRING_LITERAL).value; return { command: 'LOAD_CSV', args: { file: f } }; }
    parseLoadExcel() { this.consume(TokenType.KEYWORD, 'LOAD_EXCEL'); this.consume(TokenType.KEYWORD, 'FILE'); const f = this.consume(TokenType.STRING_LITERAL).value; let s = null; if (this.match(TokenType.KEYWORD, 'SHEET')) s = this.consume(TokenType.STRING_LITERAL).value; return { command: 'LOAD_EXCEL', args: { file: f, sheet: s } }; }
    parseColumnList() { const c = []; do { if (this.peek().type === TokenType.STRING_LITERAL) c.push(this.consume(TokenType.STRING_LITERAL).value); else if (this.peek().type === TokenType.IDENTIFIER) c.push(this.consume(TokenType.IDENTIFIER).value); else this.error("Expected column name (identifier or string literal)."); } while (this.match(TokenType.PUNCTUATION, ',')); return c; }
    parseKeepColumns() { this.consume(TokenType.KEYWORD, 'KEEP_COLUMNS'); const c = this.parseColumnList(); return { command: 'KEEP_COLUMNS', args: { columns: c } }; }
    parseSelect() { this.consume(TokenType.KEYWORD, 'SELECT'); const c = this.parseColumnList(); return { command: 'SELECT', args: { columns: c } }; }
    parseDropColumns() {
        if (this.match(TokenType.KEYWORD, 'DROP_COLUMNS')) {
            // already consumed
        } else {
            this.consume(TokenType.KEYWORD, 'DROP');
            if (this.peek().type === TokenType.KEYWORD && (this.peek().value === 'COLUMN' || this.peek().value === 'COLUMNS')) {
                this.advance();
            } else {
                this.error("Expected 'COLUMN' after DROP");
            }
        }
        const c = this.parseColumnList();
        return { command: 'DROP_COLUMNS', args: { columns: c } };
    }
    parseWithColumn() {
        this.consume(TokenType.KEYWORD, 'WITH');
        this.consume(TokenType.KEYWORD, 'COLUMN');
        let n;
        if (this.peek().type === TokenType.STRING_LITERAL) n = this.consume(TokenType.STRING_LITERAL).value; else n = this.consume(TokenType.IDENTIFIER).value;
        this.consume(TokenType.OPERATOR, '=');
        const e = this.parseExpression();
        return { command: 'WITH_COLUMN', args: { columnName: n, expression: e } };
    }
    parseExpression() {
        const p = [];
        while(
            !this.isAtEnd() &&
            this.peek().type !== TokenType.NEWLINE &&
            !['THEN', 'STORE_AS', 'VAR'].includes(this.peek().value)
        ) {
            const t = this.peek();
            if (
                ['IDENTIFIER', 'STRING_LITERAL', 'NUMBER_LITERAL'].includes(t.type) ||
                (t.type === TokenType.OPERATOR && ['*', '/', '+', '-'].includes(t.value)) ||
                (t.type === TokenType.PUNCTUATION && ['(', ')'].includes(t.value))
            ) {
                p.push(this.advance());
            } else {
                break;
            }
        }
        if (p.length === 0) this.error('Expected expression for column operation.');
        return p.map(i => ({ type: i.type, value: i.value }));
    }
    parseFilter() {
        this.consume(TokenType.KEYWORD, 'FILTER');
        this.match(TokenType.KEYWORD, 'WHERE'); // optional WHERE keyword
        const expr = this.parseFilterExpression();
        return { command: 'FILTER', args: expr };
    }

    parseFilterExpression() {
        return this.parseOrExpression();
    }

    parseOrExpression() {
        let left = this.parseAndExpression();
        while (this.match(TokenType.KEYWORD, 'OR')) {
            const right = this.parseAndExpression();
            left = { type: 'OR', left, right };
        }
        return left;
    }

    parseAndExpression() {
        let left = this.parsePrimaryExpression();
        while (this.match(TokenType.KEYWORD, 'AND')) {
            const right = this.parsePrimaryExpression();
            left = { type: 'AND', left, right };
        }
        return left;
    }

    parsePrimaryExpression() {
        if (this.match(TokenType.PUNCTUATION, '(')) {
            const expr = this.parseFilterExpression();
            this.consume(TokenType.PUNCTUATION, ')', "Expected ')' after expression");
            return expr;
        }
        return this.parseFilterCondition();
    }

    parseFilterCondition() {
        const cond = { type: 'condition', column: null, operator: null, value: null };
        if (this.peek().type === TokenType.IDENTIFIER) cond.column = this.consume(TokenType.IDENTIFIER).value;
        else if (this.peek().type === TokenType.STRING_LITERAL) cond.column = this.consume(TokenType.STRING_LITERAL).value;
        else this.error('Expected column name for filter condition.');

        const opToken = this.peek();
        if (opToken.value && opToken.value.toUpperCase() === 'IS' &&
            this.lookAhead(1) && typeof this.lookAhead(1).value === 'string' &&
            this.lookAhead(1).value.toUpperCase() === 'NOT') {
            this.advance();
            this.advance();
            cond.operator = 'IS NOT';
        } else if ((opToken.type === TokenType.KEYWORD || opToken.type === TokenType.OPERATOR) &&
            (CONDITION_OPERATORS.includes(opToken.value.toUpperCase()) || ['=','!=', '>', '<', '>=', '<='].includes(opToken.value))) {
            cond.operator = this.advance().value.toUpperCase();
        } else {
            this.error(`Expected filter operator (e.g., =, IS, >, CONTAINS) but got ${opToken.value}`);
        }

        if (this.peek().type === TokenType.STRING_LITERAL) cond.value = this.consume(TokenType.STRING_LITERAL).value;
        else if (this.peek().type === TokenType.NUMBER_LITERAL) cond.value = this.consume(TokenType.NUMBER_LITERAL).value;
        else if (this.peek().type === TokenType.IDENTIFIER) cond.value = { type: 'COLUMN_REFERENCE', name: this.consume(TokenType.IDENTIFIER).value };
        else this.error('Expected value (string, number, or column identifier) for filter condition.');
        return cond;
    }
    parseNewColumn() { this.consume(TokenType.KEYWORD, 'NEW_COLUMN'); let n; if (this.peek().type === TokenType.STRING_LITERAL) n = this.consume(TokenType.STRING_LITERAL).value; else n = this.consume(TokenType.IDENTIFIER).value; this.consume(TokenType.KEYWORD, 'AS'); const e = this.parseExpression(); return { command: 'NEW_COLUMN', args: { newColumnName: n, expression: e } }; }
    parseRenameColumns() {
        if (this.match(TokenType.KEYWORD, 'RENAME_COLUMN') || this.match(TokenType.KEYWORD, 'RENAME_COLUMNS')) {
            // keyword already consumed by match
        } else {
            this.consume(TokenType.KEYWORD, 'RENAME_COLUMN');
        }
        const mappings = [];
        do {
            let oldName;
            if (this.peek().type === TokenType.STRING_LITERAL) oldName = this.consume(TokenType.STRING_LITERAL).value;
            else oldName = this.consume(TokenType.IDENTIFIER).value;
            this.consume(TokenType.KEYWORD, 'AS');
            let newName;
            if (this.peek().type === TokenType.STRING_LITERAL) newName = this.consume(TokenType.STRING_LITERAL).value;
            else newName = this.consume(TokenType.IDENTIFIER).value;
            mappings.push({ from: oldName, to: newName });
        } while (this.match(TokenType.PUNCTUATION, ','));
        return { command: 'RENAME_COLUMNS', args: { mappings } };
    }
    parseSort() {
        this.consume(TokenType.KEYWORD, 'SORT');
        const specs = [];
        do {
            let order = 'DESC';
            if (this.match(TokenType.OPERATOR, '-')) {
                order = 'ASC';
            }
            let col;
            if (this.peek().type === TokenType.STRING_LITERAL) col = this.consume(TokenType.STRING_LITERAL).value;
            else col = this.consume(TokenType.IDENTIFIER).value;
            specs.push({ column: col, order });
        } while (this.match(TokenType.PUNCTUATION, ','));
        return { command: 'SORT', args: { columns: specs } };
    }
    parseJoin() {
        this.consume(TokenType.KEYWORD, 'JOIN');
        let v;
        if (this.peek().type === TokenType.STRING_LITERAL) v = this.consume(TokenType.STRING_LITERAL).value;
        else v = this.consume(TokenType.IDENTIFIER).value;
        this.consume(TokenType.KEYWORD, 'ON');
        let left;
        if (this.peek().type === TokenType.STRING_LITERAL) left = this.consume(TokenType.STRING_LITERAL).value;
        else left = this.consume(TokenType.IDENTIFIER).value;
        let right = left;
        if (this.match(TokenType.OPERATOR, '=')) {
            if (this.peek().type === TokenType.STRING_LITERAL) right = this.consume(TokenType.STRING_LITERAL).value;
            else right = this.consume(TokenType.IDENTIFIER).value;
        }
        let t = 'INNER';
        if (this.match(TokenType.KEYWORD, 'TYPE')) {
            const tt = this.consume(TokenType.STRING_LITERAL).value.toUpperCase();
            if (!['INNER', 'LEFT'].includes(tt)) this.error("JOIN TYPE must be 'INNER' or 'LEFT'.");
            t = tt;
        }
        return { command: 'JOIN', args: { variable: v, leftKey: left, rightKey: right, type: t } };
    }
    parseGroupBy() {
        this.consume(TokenType.KEYWORD, 'GROUP_BY');
        const cols = this.parseColumnList();
        return { command: 'GROUP_BY', args: { columns: cols } };
    }
    parseAggregate() {
        this.consume(TokenType.KEYWORD, 'AGGREGATE');
        const aggs = [];
        do {
            const funcTok = this.consume(TokenType.KEYWORD);
            const func = funcTok.value.toUpperCase();
            let col = null;
            if (this.peek().type === TokenType.OPERATOR && this.peek().value === '*') {
                col = '*';
                this.advance();
            } else if (this.peek().type === TokenType.IDENTIFIER) {
                col = this.consume(TokenType.IDENTIFIER).value;
            } else if (this.peek().type === TokenType.STRING_LITERAL) {
                col = this.consume(TokenType.STRING_LITERAL).value;
            }
            let as = null;
            if (this.match(TokenType.KEYWORD, 'AS')) {
                if (this.peek().type === TokenType.STRING_LITERAL) as = this.consume(TokenType.STRING_LITERAL).value;
                else as = this.consume(TokenType.IDENTIFIER).value;
            }
            aggs.push({ func, column: col === '*' ? null : col, as });
        } while (this.match(TokenType.PUNCTUATION, ','));
        return { command: 'AGGREGATE', args: { aggregates: aggs } };
    }
    // parseStoreAs() { this.consume(TokenType.KEYWORD, 'STORE_AS'); const v = this.consume(TokenType.IDENTIFIER).value; return { command: 'STORE_AS', args: { variableName: v } }; }
    parseExportCsv() { this.consume(TokenType.KEYWORD, 'EXPORT_CSV'); this.consume(TokenType.KEYWORD, 'TO'); const f = this.consume(TokenType.STRING_LITERAL).value; return { command: 'EXPORT_CSV', args: { file: f } }; }
    parseExportExcel() { this.consume(TokenType.KEYWORD, 'EXPORT_EXCEL'); this.consume(TokenType.KEYWORD, 'TO'); const f = this.consume(TokenType.STRING_LITERAL).value; let s = 'Sheet1'; if (this.match(TokenType.KEYWORD, 'SHEET')) s = this.consume(TokenType.STRING_LITERAL).value; return { command: 'EXPORT_EXCEL', args: { file: f, sheet: s } }; }


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
    error(message) {
        const t = this.peek() || this.previous() || { line: 'Unknown', value: 'N/A' };
        const err = new Error(`Parse Error (Line ${t.line}, near '${t.value}'): ${message}`);
        err.line = t.line;
        throw err;
    }

    recordError(err) {
        const line = typeof err.line === 'number'
            ? err.line
            : (/(\d+)/.exec(String(err.line)) || /Line (\d+)/.exec(err.message || '') || [])[1];
        this.errors.push({ line: line ? parseInt(line, 10) : null, message: err.message });
    }
}

