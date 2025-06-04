// tokenizer.js

export const TokenType = {
    KEYWORD: 'KEYWORD', IDENTIFIER: 'IDENTIFIER', STRING_LITERAL: 'STRING_LITERAL',
    NUMBER_LITERAL: 'NUMBER_LITERAL', OPERATOR: 'OPERATOR', PUNCTUATION: 'PUNCTUATION',
    COMMENT: 'COMMENT',
    NEWLINE: 'NEWLINE', EOF: 'EOF', WHITESPACE: 'WHITESPACE', UNKNOWN: 'UNKNOWN'
};

export const KEYWORDS = [
    'VAR',
    'LOAD_CSV', 'LOAD_EXCEL', 'THEN', 'KEEP_COLUMNS', 'SELECT', 'DROP_COLUMNS', 'FILTER', 'WHERE',
    'NEW_COLUMN', 'AS', 'RENAME_COLUMN', 'TO', 'SORT_BY', 'ORDER', 'STORE_AS',
    'EXPORT_CSV', 'EXPORT_EXCEL', 'SHEET', 'FILE', 'PEEK', 'AND', 'OR',
    'WITH', 'COLUMN',
    'JOIN', 'ON', 'TYPE',
    'IS', 'CONTAINS', 'STARTSWITH', 'ENDSWITH'
];

export const OPERATORS_REGEX = /^(\*|\+|\-|\/|==|!=|>=|<=|>|<|=)/;
export const CONDITION_OPERATORS = ['IS', '!=', '>', '<', '>=', '<=', 'CONTAINS', 'STARTSWITH', 'ENDSWITH'];
export const getLineNumber = (subInput, subCursor) => (subInput.substring(0, subCursor).match(/\n/g) || []).length + 1;
export function tokenizeForHighlighting(input) {
    const tokens = [];
    let cursor = 0;
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
        if (char === ',' || char === '(' || char === ')') {
            tokens.push({ type: TokenType.PUNCTUATION, value: char, line: getLineNumber(input, cursor) });
            cursor++;
            continue;
        }

        tokens.push({ type: TokenType.UNKNOWN, value: char, line: getLineNumber(input, cursor) });
        cursor++;
    }
    return tokens;
}

export function tokenizeForParser(input) {
    const tokens = [];
    let cursor = 0;

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
        if (char === ',' || char === '(' || char === ')') { tokens.push({ type: TokenType.PUNCTUATION, value: char, line: getLineNumber(input, cursor) }); cursor++; continue; }
        throw new Error(`Unexpected character: '${char}' at line ${getLineNumber(input, cursor)}`);
    }
    tokens.push({ type: TokenType.EOF, value: 'EOF', line: getLineNumber(input, cursor) });
    return tokens;
}