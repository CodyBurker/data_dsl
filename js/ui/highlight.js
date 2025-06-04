// js/ui/highlight.js

import { TokenType, tokenizeForHighlighting } from '../tokenizer.js';

// Escape HTML for safe rendering in the highlighting overlay.
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        unsafe = String(unsafe);
    }
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Convert tokens to highlighted HTML. Optionally highlights a specific line.
function applySyntaxHighlighting(text, activePeekLine = null) {
    const tokens = tokenizeForHighlighting(text);
    let html = '';
    let currentVarBlockStyleIndex = 0;
    const varBlockStyles = ['var-block-bg-1', 'var-block-bg-2', 'var-block-bg-3', 'var-block-bg-4'];
    let inVarBlock = false;
    let blockContentHtml = '';
    const activePeekHighlightID = "active-editor-peek-highlight";

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

    const firstTokenFound = new Set();

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        let tokenHtml = '';
        const escapedValue = escapeHtml(token.value);

        const isFirstNonWhitespace =
            !firstTokenFound.has(token.line) &&
            token.type !== TokenType.WHITESPACE &&
            token.type !== TokenType.NEWLINE;
        if (isFirstNonWhitespace) firstTokenFound.add(token.line);

        if (token.type === TokenType.KEYWORD && token.value.toUpperCase() === 'VAR') {
            closeCurrentVarBlock();
            inVarBlock = true;
        }

        let classes = '';
        let idAttribute = '';

        const shouldHighlight = token.line === activePeekLine && isFirstNonWhitespace;

        switch (token.type) {
            case TokenType.KEYWORD:
                classes = 'token-keyword';
                break;
            case TokenType.STRING_LITERAL:
                classes = 'token-string_literal';
                break;
            case TokenType.NUMBER_LITERAL:
                classes = 'token-number_literal';
                break;
            case TokenType.COMMENT:
                classes = 'token-comment';
                break;
            case TokenType.OPERATOR:
                classes = 'token-operator';
                break;
            case TokenType.IDENTIFIER:
                classes = 'token-identifier';
                break;
            case TokenType.PUNCTUATION:
                classes = 'token-punctuation';
                break;
            case TokenType.NEWLINE:
                tokenHtml = '\n';
                break;
            case TokenType.WHITESPACE:
                tokenHtml = escapedValue;
                break;
            default:
                tokenHtml = escapedValue;
        }

        if (!tokenHtml) {
            if (shouldHighlight) {
                classes += ' active-peek-line-highlight';
                idAttribute = ` id="${activePeekHighlightID}"`;
            }
            tokenHtml = `<span class="${classes}"${idAttribute}>${escapedValue}</span>`;
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

export { escapeHtml, applySyntaxHighlighting };
