import { JGApp, define, html, css } from '../core/app.js';
import { createLogic, GATES, SEGMENTS } from '../lib/logic.js';
import { icon } from '../ui/icons.js';
import { copyText } from '../core/util.js';

const sheet = css`
  .app { padding: 0; gap: 0; container-type: inline-size; overflow: hidden; }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex: none;
  }

  .body { flex: 1; min-height: 0; display: flex; }

  .palette {
    width: 158px;
    flex: none;
    border-right: 1px solid var(--border);
    padding: 8px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
    --icon-accent: currentColor;
  }
  .palette .group {
    padding: 9px 6px 3px;
    font: 600 10px/1 var(--font-sans);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .tool {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 9px;
    white-space: nowrap;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted-foreground);
    font: 500 12px/1 var(--font-sans);
    text-align: left;
    cursor: pointer;
  }
  .tool:hover { background: var(--accent); color: var(--foreground); }
  .tool[aria-pressed="true"] {
    background: color-mix(in srgb, var(--ring) 16%, var(--card));
    border-color: color-mix(in srgb, var(--ring) 55%, transparent);
    color: var(--foreground);
    font-weight: 600;
  }

  .board { position: relative; flex: 1; min-width: 0; background: var(--muted); }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
  canvas[data-tool="select"] { cursor: default; }
  .hint-bar {
    position: absolute;
    left: 12px;
    bottom: 10px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    color: var(--muted-foreground);
    pointer-events: none;
  }
  .hint-bar b {
    font: 600 11px/1 var(--font-sans);
    color: var(--foreground);
    padding: 3px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ring) 18%, var(--card));
    border: 1px solid color-mix(in srgb, var(--ring) 45%, transparent);
  }

  .side {
    width: 250px;
    flex: none;
    border-left: 1px solid var(--border);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: auto;
  }
  .samples { display: flex; flex-wrap: wrap; gap: 6px; }
  .samples button {
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    border-radius: 999px;
    padding: 4px 10px;
    font: 500 11.5px/1 var(--font-sans);
    cursor: pointer;
  }
  .samples button:hover { border-color: var(--ring); }
  .truth { width: 100%; border-collapse: collapse; font: 500 11.5px/1 var(--font-mono); }
  .truth th, .truth td { padding: 4px 6px; border-bottom: 1px solid var(--border); text-align: center; }
  .truth th { color: var(--muted-foreground); font-weight: 600; }
  .truth tr[data-now="true"] td { background: color-mix(in srgb, var(--ring) 16%, transparent); }

  @container (max-width: 780px) {
    .body { flex-direction: column; }
    .palette { width: auto; flex-direction: row; flex-wrap: wrap; border-right: 0; border-bottom: 1px solid var(--border); }
    .palette .group { width: 100%; }
    .side { width: auto; border-left: 0; border-top: 1px solid var(--border); max-height: 220px; }
  }
`;

const GRID = 26;

const KINDS = {
  toggle: { label: 'Switch', icon: 'toggle', inputs: 0, outputs: 1, width: 3, height: 2 },
  clock: { label: 'Clock', icon: 'timer', inputs: 0, outputs: 1, width: 3, height: 2, value: 2 },
  high: { label: 'Logic 1', icon: 'plus', inputs: 0, outputs: 1, width: 2, height: 2 },
  low: { label: 'Logic 0', icon: 'minus', inputs: 0, outputs: 1, width: 2, height: 2 },
  and: { label: 'AND', icon: 'gate', inputs: 2, outputs: 1, width: 4, height: 3 },
  or: { label: 'OR', icon: 'gate', inputs: 2, outputs: 1, width: 4, height: 3 },
  nand: { label: 'NAND', icon: 'gate', inputs: 2, outputs: 1, width: 4, height: 3 },
  nor: { label: 'NOR', icon: 'gate', inputs: 2, outputs: 1, width: 4, height: 3 },
  xor: { label: 'XOR', icon: 'gate', inputs: 2, outputs: 1, width: 4, height: 3 },
  xnor: { label: 'XNOR', icon: 'gate', inputs: 2, outputs: 1, width: 4, height: 3 },
  not: { label: 'NOT', icon: 'gate', inputs: 1, outputs: 1, width: 4, height: 2 },
  buffer: { label: 'Buffer', icon: 'gate', inputs: 1, outputs: 1, width: 4, height: 2 },
  dff: { label: 'D flip-flop', icon: 'blocks', inputs: 2, outputs: 2, width: 5, height: 4 },
  tff: { label: 'T flip-flop', icon: 'blocks', inputs: 2, outputs: 1, width: 5, height: 4 },
  counter: { label: '4 bit counter', icon: 'binary', inputs: 2, outputs: 4, width: 5, height: 6 },
  led: { label: 'LED', icon: 'sparkles', inputs: 1, outputs: 0, width: 2, height: 2 },
  seven: { label: '7 segment', icon: 'spec', inputs: 4, outputs: 0, width: 5, height: 7 },
};

const SAMPLES = {
  halfAdder: {
    name: 'Half adder',
    parts: [
      { kind: 'toggle', x: 2, y: 3, on: true },
      { kind: 'toggle', x: 2, y: 8, on: false },
      { kind: 'xor', x: 10, y: 3 },
      { kind: 'and', x: 10, y: 9 },
      { kind: 'led', x: 18, y: 4 },
      { kind: 'led', x: 18, y: 10 },
    ],
    links: [
      [0, 'out0', 2, 'in0'],
      [1, 'out0', 2, 'in1'],
      [0, 'out0', 3, 'in0'],
      [1, 'out0', 3, 'in1'],
      [2, 'out0', 4, 'in0'],
      [3, 'out0', 5, 'in0'],
    ],
  },
  counter: {
    name: 'Counter and display',
    parts: [
      { kind: 'clock', x: 2, y: 4, value: 3 },
      { kind: 'toggle', x: 2, y: 9, on: false },
      { kind: 'counter', x: 9, y: 3 },
      { kind: 'seven', x: 18, y: 3 },
    ],
    links: [
      [0, 'out0', 2, 'in0'],
      [1, 'out0', 2, 'in1'],
      [2, 'out0', 3, 'in0'],
      [2, 'out1', 3, 'in1'],
      [2, 'out2', 3, 'in2'],
      [2, 'out3', 3, 'in3'],
    ],
  },
  latch: {
    name: 'D latch',
    parts: [
      { kind: 'toggle', x: 2, y: 3, on: false },
      { kind: 'clock', x: 2, y: 8, value: 1.5 },
      { kind: 'dff', x: 10, y: 3 },
      { kind: 'led', x: 19, y: 4 },
      { kind: 'led', x: 19, y: 8 },
    ],
    links: [
      [0, 'out0', 2, 'in0'],
      [1, 'out0', 2, 'in1'],
      [2, 'out0', 3, 'in0'],
      [2, 'out1', 4, 'in0'],
    ],
  },
};

class LogicLab extends JGApp {
  static appId = 'logic-lab';
  static settings = [
    { key: 'rate', label: 'Ticks per second', type: 'number', default: 60, min: 4, max: 240 },
  ];
  static styles = [...JGApp.styles, sheet];

  #parts = [];
  #links = [];
  #tool = 'select';
  #selected = null;
  #wireFrom = null;
  #drag = null;
  #hover = null;
  #logic = createLogic();
  #frame = null;
  #seq = 1;
  #history = [];
  #running = true;

  connectedCallback() {
    this.#load(this.store.read() ?? 'halfAdder');
    super.connectedCallback();
  }

  #load(name) {
    const sample = SAMPLES[name] ?? SAMPLES.halfAdder;
    this.#seq = 1;
    this.#parts = sample.parts.map((part) => ({
      id: this.#seq++,
      kind: part.kind,
      x: part.x,
      y: part.y,
      on: part.on ?? false,
      value: part.value ?? KINDS[part.kind]?.value ?? 0,
    }));
    this.#links = sample.links.map(([from, fromPin, to, toPin]) => ({
      from: `${this.#parts[from].id}:${fromPin}`,
      to: `${this.#parts[to].id}:${toPin}`,
    }));
    this.#selected = null;
    this.#wireFrom = null;
    this.#rebuild();
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">Logic Lab</div>
        <div class="hint">Gates, flip-flops, counters and a seven segment display.</div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head"><jg-toolbar id="bar"></jg-toolbar></div>
      <div class="body">
        <div class="palette" id="palette"></div>
        <div class="board">
          <canvas id="view"></canvas>
          <div class="hint-bar"><b id="tool-name">Select</b><span id="tool-hint"></span></div>
        </div>
        <aside class="side">
          <div class="label">Circuits</div>
          <div class="samples">
            ${Object.entries(SAMPLES).map(([key, sample]) => html`<button data-sample="${key}">${sample.name}</button>`)}
          </div>
          <div class="sep"></div>
          <div id="inspector"></div>
          <div class="sep"></div>
          <div class="label">Truth table</div>
          <div id="truth"></div>
        </aside>
      </div>
    </div>`);

    this.$('#bar').items = [
      { id: 'run', label: this.#running ? 'Pause' : 'Run', icon: this.#running ? 'timer' : 'play', action: () => this.#toggleRun() },
      { id: 'reset', label: 'Reset', icon: 'repeat', action: () => this.#logic.reset() },
      { separator: true },
      { id: 'undo', label: 'Undo', icon: 'undo', iconOnly: true, title: 'Undo', action: () => this.#undo() },
      { id: 'delete', label: 'Delete', icon: 'eraser', iconOnly: true, title: 'Delete the selection', action: () => this.#remove() },
      { spacer: true },
      { id: 'copy', label: 'Copy netlist', icon: 'copy', action: () => copyText(this.#netlist()) },
    ];

    this.$('#palette').innerHTML = html`
      <div class="group">Edit</div>
      ${[
        { id: 'select', label: 'Select', icon: 'launcher' },
        { id: 'wire', label: 'Wire', icon: 'link' },
      ].map(
        (tool) => html`<button class="tool" data-tool="${tool.id}" aria-pressed="${String(this.#tool === tool.id)}">
          ${icon(tool.icon, 15)}<span>${tool.label}</span>
        </button>`,
      )}
      <div class="group">Inputs</div>
      ${['toggle', 'clock', 'high', 'low'].map((kind) => this.#toolButton(kind))}
      <div class="group">Gates</div>
      ${['and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buffer'].map((kind) => this.#toolButton(kind))}
      <div class="group">Memory</div>
      ${['dff', 'tff', 'counter'].map((kind) => this.#toolButton(kind))}
      <div class="group">Output</div>
      ${['led', 'seven'].map((kind) => this.#toolButton(kind))}
    `;

    this.bind('.tool', 'click', (event) => this.#setTool(event.currentTarget.dataset.tool));
    this.bind('[data-sample]', 'click', (event) => {
      const key = event.currentTarget.dataset.sample;
      this.store.write(key);
      this.#load(key);
      this.#inspector();
      this.#draw();
    });

    const canvas = this.$('#view');
    this.on(canvas, 'pointerdown', (event) => this.#down(event));
    this.on(canvas, 'pointermove', (event) => this.#move(event));
    this.on(canvas, 'pointerup', () => this.#up());

    this.hotkeys((event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        this.#undo();
        return;
      }
      if (event.key === 'Escape') {
        if (this.#tool === 'select') return;
        event.preventDefault();
        this.#setTool('select');
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        this.#remove();
      }
    });

    const observer = new ResizeObserver(() => this.#draw());
    observer.observe(this.$('.board'));
    this.track(() => observer.disconnect());

    this.#setTool(this.#tool);
    this.#inspector();
    this.#loop();
  }

  #toolButton(kind) {
    const meta = KINDS[kind];
    return html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
      ${icon(meta.icon, 15)}<span>${meta.label}</span>
    </button>`;
  }

  #setTool(tool) {
    this.#tool = tool;
    this.#wireFrom = null;
    this.toggleAttribute('data-keeps-escape', tool !== 'select');
    this.$$('.tool').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.tool === tool)));
    const canvas = this.$('#view');
    if (canvas) canvas.dataset.tool = tool === 'select' ? 'select' : 'place';
    const name = this.$('#tool-name');
    const hint = this.$('#tool-hint');
    if (name && hint) {
      name.textContent = tool === 'select' ? 'Select' : tool === 'wire' ? 'Wire' : KINDS[tool]?.label ?? tool;
      hint.textContent =
        tool === 'select'
          ? 'Drag a part to move it, click a switch to flip it, Delete removes.'
          : tool === 'wire'
            ? 'Click an output pin, then an input pin. Esc goes back to Select.'
            : 'Click to drop one. Esc goes back to Select.';
    }
    this.#draw();
  }

  #toggleRun() {
    this.#running = !this.#running;
    this.$('#bar').update('run', { label: this.#running ? 'Pause' : 'Run', icon: this.#running ? 'timer' : 'play' });
  }

  #snapshot() {
    this.#history.push(JSON.stringify({ parts: this.#parts, links: this.#links }));
    if (this.#history.length > 50) this.#history.shift();
  }

  #undo() {
    const previous = this.#history.pop();
    if (!previous) return;
    const state = JSON.parse(previous);
    this.#parts = state.parts;
    this.#links = state.links;
    this.#selected = null;
    this.#rebuild();
    this.#inspector();
    this.#draw();
  }

  #remove() {
    if (this.#selected === null) return;
    this.#snapshot();
    const gone = String(this.#selected);
    this.#parts = this.#parts.filter((part) => part.id !== this.#selected);
    this.#links = this.#links.filter((link) => link.from.split(':')[0] !== gone && link.to.split(':')[0] !== gone);
    this.#selected = null;
    this.#rebuild();
    this.#inspector();
    this.#draw();
  }

  #rebuild() {
    this.#logic.build(
      this.#parts.map((part) => ({
        id: part.id,
        kind: part.kind,
        on: part.on,
        value: part.value,
        inputs: Array.from({ length: KINDS[part.kind]?.inputs ?? 0 }, (item, index) => index),
        outputs: Array.from({ length: KINDS[part.kind]?.outputs ?? 0 }, (item, index) => index),
      })),
      this.#links,
    );
  }

  #pins(part) {
    const meta = KINDS[part.kind];
    const spread = (count, index) => part.y + Math.round(((meta.height * (index + 1)) / (count + 1)) * 2) / 2;
    const inputs = Array.from({ length: meta.inputs }, (item, index) => ({
      pin: `in${index}`,
      x: part.x,
      y: spread(meta.inputs, index),
    }));
    const outputs = Array.from({ length: meta.outputs }, (item, index) => ({
      pin: `out${index}`,
      x: part.x + meta.width,
      y: spread(meta.outputs, index),
    }));
    return [...inputs, ...outputs];
  }

  #pinAt(point) {
    for (const part of this.#parts) {
      for (const pin of this.#pins(part)) {
        if (Math.hypot(point[0] - pin.x, point[1] - pin.y) < 0.6) return { part, ...pin };
      }
    }
    return null;
  }

  #partAt(point) {
    return this.#parts.find((part) => {
      const meta = KINDS[part.kind];
      return point[0] >= part.x && point[0] <= part.x + meta.width && point[1] >= part.y && point[1] <= part.y + meta.height;
    });
  }

  #point(event) {
    const rect = this.$('#view').getBoundingClientRect();
    return [(event.clientX - rect.left) / GRID, (event.clientY - rect.top) / GRID];
  }

  #down(event) {
    const raw = this.#point(event);
    const point = [Math.round(raw[0]), Math.round(raw[1])];
    this.$('#view').setPointerCapture(event.pointerId);

    if (this.#tool === 'wire') {
      const pin = this.#pinAt(raw);
      if (!pin) return;
      if (!this.#wireFrom) {
        this.#wireFrom = pin;
      } else {
        const from = this.#wireFrom.pin.startsWith('out') ? this.#wireFrom : pin;
        const to = this.#wireFrom.pin.startsWith('out') ? pin : this.#wireFrom;
        if (from.pin.startsWith('out') && to.pin.startsWith('in')) {
          this.#snapshot();
          this.#links = this.#links.filter((link) => link.to !== `${to.part.id}:${to.pin}`);
          this.#links.push({ from: `${from.part.id}:${from.pin}`, to: `${to.part.id}:${to.pin}` });
          this.#rebuild();
        }
        this.#wireFrom = null;
      }
      this.#draw();
      return;
    }

    if (this.#tool === 'select') {
      const part = this.#partAt(raw);
      this.#selected = part?.id ?? null;
      if (part) {
        const meta = KINDS[part.kind];
        const centre = [part.x + meta.width / 2, part.y + meta.height / 2];
        if (part.kind === 'toggle' && Math.hypot(raw[0] - centre[0], raw[1] - centre[1]) < 1.4) {
          this.#snapshot();
          part.on = !part.on;
          this.#rebuild();
        } else {
          this.#snapshot();
          this.#drag = { part, from: point, origin: [part.x, part.y] };
        }
      }
      this.#inspector();
      this.#draw();
      return;
    }

    this.#snapshot();
    const meta = KINDS[this.#tool];
    const part = {
      id: this.#seq++,
      kind: this.#tool,
      x: point[0],
      y: point[1],
      on: false,
      value: meta?.value ?? 0,
    };
    this.#parts.push(part);
    this.#selected = part.id;
    this.#rebuild();
    this.#inspector();
    this.#draw();
  }

  #move(event) {
    const raw = this.#point(event);
    this.#hover = [Math.round(raw[0]), Math.round(raw[1])];
    if (this.#drag) {
      const { part, from, origin } = this.#drag;
      part.x = origin[0] + (this.#hover[0] - from[0]);
      part.y = origin[1] + (this.#hover[1] - from[1]);
    }
    this.#draw();
  }

  #up() {
    this.#drag = null;
    this.#draw();
  }

  #loop() {
    let carry = 0;
    let last = performance.now();
    const tick = (now) => {
      const rate = Math.max(4, Number(this.config.get('rate', 60)));
      carry += Math.min(0.25, (now - last) / 1000);
      last = now;
      const step = 1 / rate;
      let guard = 0;
      while (carry >= step && guard < 8) {
        if (this.#running) this.#logic.step();
        carry -= step;
        guard += 1;
      }
      this.#draw();
      this.#truth();
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
    this.track(() => cancelAnimationFrame(this.#frame));
  }

  #palette() {
    const styles = getComputedStyle(this);
    return {
      line: styles.getPropertyValue('--foreground').trim() || '#111',
      soft: styles.getPropertyValue('--muted-foreground').trim() || '#888',
      border: styles.getPropertyValue('--border').trim() || '#ddd',
      ring: styles.getPropertyValue('--ring').trim() || '#8a1c3b',
      card: styles.getPropertyValue('--card').trim() || '#fff',
      font: styles.getPropertyValue('--font-sans') || 'sans-serif',
      mono: styles.getPropertyValue('--font-mono') || 'monospace',
      live: '#4a9d6b',
    };
  }

  #draw() {
    const canvas = this.$('#view');
    if (!canvas) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    if (canvas.width !== width * ratio) canvas.width = width * ratio;
    if (canvas.height !== height * ratio) canvas.height = height * ratio;
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const paint = this.#palette();

    context.fillStyle = paint.soft;
    context.globalAlpha = 0.22;
    for (let x = 0; x <= width; x += GRID) {
      for (let y = 0; y <= height; y += GRID) context.fillRect(x, y, 1, 1);
    }
    context.globalAlpha = 1;

    this.#links.forEach((link) => {
      const from = this.#pinPoint(link.from);
      const to = this.#pinPoint(link.to);
      if (!from || !to) return;
      const live = this.#logic.value(Number(link.from.split(':')[0]), link.from.split(':')[1]);
      context.strokeStyle = live ? paint.live : paint.soft;
      context.lineWidth = live ? 2.4 : 1.6;
      context.beginPath();
      context.moveTo(from.x * GRID, from.y * GRID);
      const midX = ((from.x + to.x) / 2) * GRID;
      context.lineTo(midX, from.y * GRID);
      context.lineTo(midX, to.y * GRID);
      context.lineTo(to.x * GRID, to.y * GRID);
      context.stroke();
    });

    this.#parts.forEach((part) => this.#drawPart(context, part, paint));

    if (this.#wireFrom) {
      const from = this.#pinPoint(`${this.#wireFrom.part.id}:${this.#wireFrom.pin}`);
      if (from && this.#hover) {
        context.save();
        context.setLineDash([5, 4]);
        context.strokeStyle = paint.ring;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(from.x * GRID, from.y * GRID);
        context.lineTo(this.#hover[0] * GRID, this.#hover[1] * GRID);
        context.stroke();
        context.restore();
      }
    }
  }

  #pinPoint(key) {
    const [id, pin] = key.split(':');
    const part = this.#parts.find((entry) => entry.id === Number(id));
    if (!part) return null;
    return this.#pins(part).find((entry) => entry.pin === pin) ?? null;
  }

  #drawPart(context, part, paint) {
    const meta = KINDS[part.kind];
    const x = part.x * GRID;
    const y = part.y * GRID;
    const width = meta.width * GRID;
    const height = meta.height * GRID;
    const selected = part.id === this.#selected;

    context.save();
    context.lineWidth = selected ? 2.4 : 1.7;
    context.strokeStyle = selected ? paint.ring : paint.line;
    context.fillStyle = paint.card;

    this.#pins(part).forEach((pin) => {
      const live = this.#logic.value(part.id, pin.pin);
      context.beginPath();
      context.moveTo(pin.x * GRID + (pin.pin.startsWith('in') ? 8 : -8), pin.y * GRID);
      context.lineTo(pin.x * GRID, pin.y * GRID);
      context.strokeStyle = live ? paint.live : paint.soft;
      context.lineWidth = live ? 2.4 : 1.6;
      context.stroke();
      context.beginPath();
      context.arc(pin.x * GRID, pin.y * GRID, 3, 0, Math.PI * 2);
      context.fillStyle = live ? paint.live : paint.soft;
      context.fill();
    });

    context.strokeStyle = selected ? paint.ring : paint.line;
    context.lineWidth = selected ? 2.4 : 1.7;
    context.fillStyle = paint.card;

    if (part.kind === 'led') {
      const on = this.#logic.value(part.id, 'in0');
      context.beginPath();
      context.arc(x + width / 2, y + height / 2, 13, 0, Math.PI * 2);
      context.fillStyle = on ? '#e0483d' : paint.card;
      context.fill();
      context.stroke();
    } else if (part.kind === 'toggle') {
      context.beginPath();
      context.roundRect(x + 6, y + 8, width - 12, height - 16, 12);
      context.fillStyle = part.on ? paint.live : paint.card;
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(part.on ? x + width - 16 : x + 16, y + height / 2, 7, 0, Math.PI * 2);
      context.fillStyle = paint.card;
      context.fill();
      context.stroke();
    } else if (part.kind === 'seven') {
      this.#drawSeven(context, part, x, y, width, height, paint);
    } else if (GATES[part.kind]) {
      this.#drawGate(context, part.kind, x, y, width, height, paint);
    } else {
      context.beginPath();
      context.roundRect(x + 4, y + 6, width - 8, height - 12, 6);
      context.fill();
      context.stroke();
      context.fillStyle = paint.line;
      context.font = `600 12px ${paint.font}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const label = part.kind === 'clock' ? `${part.value} Hz` : meta.label;
      context.fillText(label, x + width / 2, y + height / 2);
    }

    context.restore();
  }

  #drawGate(context, kind, x, y, width, height, paint) {
    const inverting = ['nand', 'nor', 'xnor', 'not'].includes(kind);
    const curved = ['or', 'nor', 'xor', 'xnor'].includes(kind);
    const pointed = ['not', 'buffer'].includes(kind);

    const left = x + 8;
    const right = x + width - (inverting ? 14 : 6);
    const top = y + 5;
    const bottom = y + height - 5;
    const mid = (top + bottom) / 2;

    context.beginPath();
    if (pointed) {
      context.moveTo(left, top);
      context.lineTo(right, mid);
      context.lineTo(left, bottom);
      context.closePath();
    } else if (curved) {
      context.moveTo(left, top);
      context.quadraticCurveTo(left + (right - left) * 0.55, top, right, mid);
      context.quadraticCurveTo(left + (right - left) * 0.55, bottom, left, bottom);
      context.quadraticCurveTo(left + 12, mid, left, top);
    } else {
      const radius = (bottom - top) / 2;
      context.moveTo(left, top);
      context.lineTo(right - radius, top);
      context.arc(right - radius, mid, radius, -Math.PI / 2, Math.PI / 2);
      context.lineTo(left, bottom);
      context.closePath();
    }
    context.fill();
    context.stroke();

    if (kind === 'xor' || kind === 'xnor') {
      context.beginPath();
      context.moveTo(left - 6, top);
      context.quadraticCurveTo(left + 6, mid, left - 6, bottom);
      context.stroke();
    }

    if (inverting) {
      context.beginPath();
      context.arc(right + 5, mid, 4.5, 0, Math.PI * 2);
      context.fillStyle = paint.card;
      context.fill();
      context.stroke();
    }

    context.fillStyle = paint.soft;
    context.font = `500 9px ${paint.mono}`;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.fillText(GATES[kind].label, x + width / 2, bottom + 11);
  }

  #drawSeven(context, part, x, y, width, height, paint) {
    const bits = [0, 1, 2, 3].reduce((sum, index) => sum + (this.#logic.value(part.id, `in${index}`) ? 1 << index : 0), 0);
    const lit = SEGMENTS[bits] ?? '';
    const left = x + 18;
    const top = y + 16;
    const w = width - 46;
    const h = height - 44;

    context.fillStyle = paint.card;
    context.beginPath();
    context.roundRect(x + 4, y + 6, width - 8, height - 12, 6);
    context.fill();
    context.stroke();

    const bar = (name, bx, by, bw, bh) => {
      context.fillStyle = lit.includes(name) ? '#e0483d' : paint.border;
      context.beginPath();
      context.roundRect(bx, by, bw, bh, 2);
      context.fill();
    };

    const thick = 6;
    bar('a', left + thick, top, w - thick * 2, thick);
    bar('b', left + w - thick, top + thick, thick, h / 2 - thick);
    bar('c', left + w - thick, top + h / 2 + 2, thick, h / 2 - thick);
    bar('d', left + thick, top + h, w - thick * 2, thick);
    bar('e', left, top + h / 2 + 2, thick, h / 2 - thick);
    bar('f', left, top + thick, thick, h / 2 - thick);
    bar('g', left + thick, top + h / 2 - thick / 2 + 1, w - thick * 2, thick);

    context.fillStyle = paint.soft;
    context.font = `500 10px ${paint.mono}`;
    context.textAlign = 'center';
    context.fillText(bits.toString(16).toUpperCase(), x + width / 2, y + height - 8);
  }

  #inspector() {
    const part = this.#parts.find((entry) => entry.id === this.#selected);
    const target = this.$('#inspector');
    if (!target) return;
    if (!part) {
      target.innerHTML = html`<div class="hint">Pick a part to change it, or drop a new one from the palette.</div>`;
      return;
    }
    target.innerHTML = html`
      <div class="label">${KINDS[part.kind]?.label ?? part.kind}</div>
      ${part.kind === 'clock'
        ? html`<jg-field label="Rate"><jg-input id="rate" size="sm" type="number" value="${part.value}" min="0.2" max="30" step="0.1"></jg-input></jg-field>`
        : ''}
      ${part.kind === 'toggle'
        ? html`<div class="row"><jg-switch id="on" ${part.on ? 'checked' : ''}></jg-switch><span class="hint">Closed</span></div>`
        : ''}
      <jg-button size="sm" variant="outline" id="drop">Remove part</jg-button>
    `;
    const rate = this.$('#rate');
    if (rate) {
      this.on(rate, 'input', () => {
        part.value = Math.max(0.2, Number(rate.value) || 1);
        this.#rebuild();
      });
    }
    const on = this.$('#on');
    if (on) {
      this.on(on, 'change', (event) => {
        part.on = event.detail.checked;
        this.#rebuild();
      });
    }
    this.on(this.$('#drop'), 'click', () => this.#remove());
  }

  #truth() {
    const target = this.$('#truth');
    if (!target) return;
    const part = this.#parts.find((entry) => entry.id === this.#selected);
    const gate = part && GATES[part.kind];
    if (!gate) {
      if (target.dataset.kind !== 'none') {
        target.dataset.kind = 'none';
        target.innerHTML = html`<div class="hint">Select a gate to see its table.</div>`;
      }
      return;
    }

    const bits = Array.from({ length: gate.inputs }, (item, index) => this.#logic.value(part.id, `in${index}`));
    const rows = [];
    for (let value = 0; value < 2 ** gate.inputs; value += 1) {
      const inputs = Array.from({ length: gate.inputs }, (item, index) => Boolean((value >> (gate.inputs - 1 - index)) & 1));
      rows.push({ inputs, out: gate.apply(inputs) });
    }
    const now = bits.reduce((sum, bit, index) => sum + (bit ? 1 << (gate.inputs - 1 - index) : 0), 0);

    const signature = `${part.kind}:${now}`;
    if (target.dataset.kind === signature) return;
    target.dataset.kind = signature;
    target.innerHTML = html`<table class="truth">
      <tr>${Array.from({ length: gate.inputs }, (item, index) => html`<th>${String.fromCharCode(65 + index)}</th>`)}<th>Q</th></tr>
      ${rows.map(
        (row, index) => html`<tr data-now="${String(index === now)}">
          ${row.inputs.map((bit) => html`<td>${bit ? 1 : 0}</td>`)}
          <td>${row.out ? 1 : 0}</td>
        </tr>`,
      )}
    </table>`;
  }

  #netlist() {
    return [
      ...this.#parts.map((part) => `${part.kind} #${part.id} at ${part.x},${part.y}`),
      ...this.#links.map((link) => `${link.from} -> ${link.to}`),
    ].join('\n');
  }
}

define('jg-app-logic-lab', LogicLab);
