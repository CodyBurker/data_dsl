// dag.js
// Build a directed acyclic graph (DAG) representation of an AST
// Each command node becomes a DAG node with stable fingerprint ignoring line numbers

export function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map(v => stableStringify(v)).join(',') + ']';
    }
    const keys = Object.keys(value).sort();
    return '{' + keys.map(k => JSON.stringify(k)+':'+stableStringify(value[k])).join(',') + '}';
}

export function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
}

export function buildDag(ast) {
    const nodes = [];
    const lastForVar = {};
    const fingerprints = {};

    for (const varBlock of ast) {
        const varName = varBlock.variableName;
        const pipeline = varBlock.pipeline || [];

        for (let idx = 0; idx < pipeline.length; idx++) {
            const cmd = pipeline[idx];
            const nodeId = `${varName}-${idx}`;
            const deps = [];
            if (idx > 0) deps.push(`${varName}-${idx - 1}`);
            if (cmd.command === 'JOIN' && cmd.args && cmd.args.variable) {
                const other = cmd.args.variable;
                if (lastForVar[other] !== undefined) {
                    deps.push(lastForVar[other]);
                } else {
                    deps.push(`root-${other}`);
                }
            }
            const depFps = deps.map(d => fingerprints[d] || d).sort();
            const fpObj = { command: cmd.command, args: cmd.args, deps: depFps };
            const fingerprint = simpleHash(stableStringify(fpObj));
            nodes.push({
                id: nodeId,
                varName,
                command: cmd.command,
                args: cmd.args,
                line: cmd.line,
                dependencies: deps,
                fingerprint
            });
            fingerprints[nodeId] = fingerprint;
            lastForVar[varName] = nodeId;
        }
    }

    return nodes;
}

