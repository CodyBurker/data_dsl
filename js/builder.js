// js/builder.js

function initBuilder() {
    const area = document.getElementById('builderArea');
    const svg = document.getElementById('connections');
    const addLoadBtn = document.getElementById('addLoadCsv');
    const addSelectBtn = document.getElementById('addSelect');
    const nodes = [];
    const connections = [];
    let dragging = null;

    function createNode(type) {
        const el = document.createElement('div');
        el.className = 'builder-node';
        el.textContent = type;
        el.dataset.type = type;
        el.style.left = '10px';
        el.style.top = `${10 + nodes.length * 60}px`;
        el.addEventListener('mousedown', e => {
            dragging = { el, offsetX: e.offsetX, offsetY: e.offsetY };
        });
        nodes.push(el);
        area.appendChild(el);
        return el;
    }

    function updateConnections() {
        connections.forEach(c => {
            const aRect = c.a.getBoundingClientRect();
            const bRect = c.b.getBoundingClientRect();
            const areaRect = area.getBoundingClientRect();
            const x1 = aRect.left + aRect.width / 2 - areaRect.left;
            const y1 = aRect.top + aRect.height - areaRect.top;
            const x2 = bRect.left + bRect.width / 2 - areaRect.left;
            const y2 = bRect.top - areaRect.top;
            c.line.setAttribute('x1', x1);
            c.line.setAttribute('y1', y1);
            c.line.setAttribute('x2', x2);
            c.line.setAttribute('y2', y2);
        });
    }

    function connect(a, b) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', '#4b5563');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
        connections.push({ a, b, line });
        updateConnections();
    }

    addLoadBtn.onclick = () => createNode('LOAD_CSV');
    addSelectBtn.onclick = () => createNode('SELECT');

    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const areaRect = area.getBoundingClientRect();
        dragging.el.style.left = `${e.clientX - areaRect.left - dragging.offsetX}px`;
        dragging.el.style.top = `${e.clientY - areaRect.top - dragging.offsetY}px`;
        updateConnections();
    });
    document.addEventListener('mouseup', () => { dragging = null; });

    area.addEventListener('dblclick', () => {
        const load = nodes.find(n => n.dataset.type === 'LOAD_CSV');
        const select = nodes.find(n => n.dataset.type === 'SELECT');
        if (load && select && !connections.length) connect(load, select);
    });
}

document.addEventListener('DOMContentLoaded', initBuilder);
