// parser.js
import { TokenType, KEYWORDS, CONDITION_OPERATORS } from './tokenizer.js';

export class Parser {
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
            case 'SELECT': return this.parseSelect();
            case 'DROP_COLUMNS': return this.parseDropColumns();
            case 'FILTER': return this.parseFilter();
            case 'NEW_COLUMN': return this.parseNewColumn();
            case 'RENAME_COLUMN': return this.parseRenameColumn();
            case 'SORT_BY': return this.parseSortBy();
            case 'JOIN': return this.parseJoin();
            // case 'STORE_AS': return this.parseStoreAs();
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
    parseSelect() { this.consume(TokenType.KEYWORD, 'SELECT'); const c = this.parseColumnList(); return { command: 'SELECT', args: { columns: c } }; }
    parseDropColumns() { this.consume(TokenType.KEYWORD, 'DROP_COLUMNS'); const c = this.parseColumnList(); return { command: 'DROP_COLUMNS', args: { columns: c } }; }
    parseExpression() { const p = []; while(!this.isAtEnd() && this.peek().type !== TokenType.NEWLINE && !['THEN', 'STORE_AS', 'VAR'].includes(this.peek().value) ) { const t = this.peek(); if (['IDENTIFIER', 'STRING_LITERAL', 'NUMBER_LITERAL'].includes(t.type) || (t.type === TokenType.OPERATOR && ['*', '/', '+', '-'].includes(t.value))) p.push(this.advance()); else break; } if (p.length === 0) this.error("Expected expression for NEW_COLUMN."); return p.map(i => ({ type: i.type, value: i.value })); }
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
    parseRenameColumn() { this.consume(TokenType.KEYWORD, 'RENAME_COLUMN'); let o; if(this.peek().type === TokenType.STRING_LITERAL) o = this.consume(TokenType.STRING_LITERAL).value; else o = this.consume(TokenType.IDENTIFIER).value; this.consume(TokenType.KEYWORD, 'TO'); let n; if(this.peek().type === TokenType.STRING_LITERAL) n = this.consume(TokenType.STRING_LITERAL).value; else n = this.consume(TokenType.IDENTIFIER).value; return { command: 'RENAME_COLUMN', args: { oldName: o, newName: n } }; }
    parseSortBy() { this.consume(TokenType.KEYWORD, 'SORT_BY'); let c; if(this.peek().type === TokenType.STRING_LITERAL) c = this.consume(TokenType.STRING_LITERAL).value; else c = this.consume(TokenType.IDENTIFIER).value; let o = 'ASC'; if (this.match(TokenType.KEYWORD, 'ORDER')) { const ot = this.consume(TokenType.STRING_LITERAL); if (['ASC', 'DESC'].includes(ot.value.toUpperCase())) o = ot.value.toUpperCase(); else this.error("Sort order must be 'ASC' or 'DESC'."); } return { command: 'SORT_BY', args: { column: c, order: o } }; }
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
    // parseStoreAs() { this.consume(TokenType.KEYWORD, 'STORE_AS'); const v = this.consume(TokenType.IDENTIFIER).value; return { command: 'STORE_AS', args: { variableName: v } }; }
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