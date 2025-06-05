// js/ui/dagView.js

import { elements } from './elements.js';

const lineMap = new Map();

function renderDag(dagNodes, { onNodeClick } = {}) {
    if (!elements.dagContainer) return;
    elements.dagContainer.innerHTML = '';
    lineMap.clear();
    if (!Array.isArray(dagNodes) || dagNodes.length === 0) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    const colWidth = 160;
    const rowHeight = 80;
    const rectWidth = 120;
    const rectHeight = 40;

    const varNames = Array.from(new Set(dagNodes.map(n => n.varName)));
    const stepCounts = {};
    for (const n of dagNodes) {
        const idx = parseInt(n.id.split('-')[1], 10) || 0;
        stepCounts[n.varName] = Math.max(stepCounts[n.varName] || 0, idx + 1);
    }
    const maxSteps = Math.max(...Object.values(stepCounts));

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', (maxSteps + 1) * colWidth);
    svg.setAttribute('height', varNames.length * rowHeight + 20);
    elements.dagContainer.appendChild(svg);

    const positions = {};
    for (const node of dagNodes) {
        const row = varNames.indexOf(node.varName);
        const stepIdx = parseInt(node.id.split('-')[1], 10) || 0;
        const x = stepIdx * colWidth + 20;
        const y = row * rowHeight + 20;
        positions[node.id] = { x, y };
    }

    // draw edges
    for (const node of dagNodes) {
        const pos = positions[node.id];
        for (const dep of node.dependencies || []) {
            if (!positions[dep]) continue;
            const from = positions[dep];
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', from.x + rectWidth / 2);
            line.setAttribute('y1', from.y + rectHeight / 2);
            line.setAttribute('x2', pos.x + rectWidth / 2);
            line.setAttribute('y2', pos.y + rectHeight / 2);
            line.setAttribute('stroke', '#9ca3af');
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
        }
    }

    // draw nodes
    for (const node of dagNodes) {
        const pos = positions[node.id];
        const g = document.createElementNS(svgNS, 'g');
        g.classList.add('dag-node');
        g.dataset.line = node.line;
        g.dataset.id = node.id;
        g.setAttribute('transform', `translate(${pos.x},${pos.y})`);

        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('width', rectWidth);
        rect.setAttribute('height', rectHeight);
        rect.setAttribute('rx', '6');
        g.appendChild(rect);

        const txt1 = document.createElementNS(svgNS, 'text');
        txt1.setAttribute('x', rectWidth / 2);
        txt1.setAttribute('y', 15);
        txt1.setAttribute('text-anchor', 'middle');
        txt1.textContent = node.varName;
        g.appendChild(txt1);

        const txt2 = document.createElementNS(svgNS, 'text');
        txt2.setAttribute('x', rectWidth / 2);
        txt2.setAttribute('y', 30);
        txt2.setAttribute('text-anchor', 'middle');
        txt2.textContent = node.command;
        g.appendChild(txt2);

        if (!lineMap.has(node.line)) lineMap.set(node.line, []);
        lineMap.get(node.line).push(g);

        g.addEventListener('click', () => {
            highlightDagNodeForLine(node.line);
            if (typeof onNodeClick === 'function') onNodeClick(node.line);
        });

        svg.appendChild(g);
    }
}

function highlightDagNodeForLine(line) {
    if (!elements.dagContainer) return;
    elements.dagContainer.querySelectorAll('.dag-node').forEach(n => {
        n.classList.remove('active-dag-node');
    });
    const nodes = lineMap.get(line) || [];
    nodes.forEach(n => n.classList.add('active-dag-node'));
}

export { renderDag, highlightDagNodeForLine };
