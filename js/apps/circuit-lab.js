import { JGApp, define, html, css } from '../core/app.js';
import { createCircuit } from '../lib/circuit.js';
import { settings } from '../core/settings.js';
import { copyText } from '../core/util.js';
import { icon } from '../ui/icons.js';

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
    width: 118px;
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
    gap: 8px;
    padding: 6px 8px;
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
  .tool svg { flex: none; }

  .board { position: relative; flex: 1; min-width: 0; background: var(--muted); }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
  canvas[data-tool="select"] { cursor: default; }
  canvas[data-grab="true"] { cursor: grab; }
  canvas[data-dragging="true"] { cursor: grabbing; }
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
  .warn {
    position: absolute;
    left: 12px;
    top: 12px;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--destructive) 16%, var(--card));
    color: var(--destructive);
    font-size: 12px;
  }

  .side {
    width: 232px;
    flex: none;
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .side .pane { padding: 12px; display: flex; flex-direction: column; gap: 10px; overflow: auto; }

  .footer {
    flex: none;
    border-top: 1px solid var(--border);
    padding: 10px 14px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 240px;
    gap: 14px;
    align-items: stretch;
    background: color-mix(in srgb, var(--muted) 35%, transparent);
  }
  .footer .trace { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .footer .trace-head { display: flex; align-items: baseline; gap: 10px; }
  .footer canvas {
    width: 100%;
    height: 168px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--muted) 70%, transparent);
  }
  .scope-controls { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 8px; align-items: center; font-size: 11.5px; }
  .scope-controls span { color: var(--muted-foreground); }
  .scope-foot { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
  .measures-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    font-size: 11.5px;
  }
  .measures-row div { display: flex; gap: 6px; }
  .measures-row dt { color: var(--muted-foreground); }
  .measures-row dd { margin: 0; font-family: var(--font-mono); }

  .readout { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; font-size: 12px; }
  .readout dt { color: var(--muted-foreground); }
  .readout dd { margin: 0; font-family: var(--font-mono); text-align: right; }

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

  @container (max-width: 720px) {
    .body { flex-direction: column; }
    .palette { width: auto; flex-direction: row; flex-wrap: wrap; border-right: 0; border-bottom: 1px solid var(--border); }
    .palette .group { width: 100%; }
    .footer { grid-template-columns: minmax(0, 1fr); }
    .side { width: auto; border-left: 0; border-top: 1px solid var(--border); max-height: 250px; }
  }
`;

const GRID = 26;
const DIVISIONS = 10;
const POINTS = 900;

const SPEEDS = [
  { label: '1/200 speed', factor: 0.005 },
  { label: '1/50 speed', factor: 0.02 },
  { label: '1/10 speed', factor: 0.1 },
  { label: '1/4 speed', factor: 0.25 },
  { label: 'Half speed', factor: 0.5 },
  { label: 'Real time', factor: 1 },
];

const TIMEBASE = [
  { label: '20 µs/div', seconds: 0.00002 },
  { label: '100 µs/div', seconds: 0.0001 },
  { label: '500 µs/div', seconds: 0.0005 },
  { label: '2 ms/div', seconds: 0.002 },
  { label: '5 ms/div', seconds: 0.005 },
  { label: '20 ms/div', seconds: 0.02 },
  { label: '50 ms/div', seconds: 0.05 },
];

const KINDS = {
  wire: { label: 'Wire', icon: 'link' },
  resistor: { label: 'Resistor', icon: 'activity', unit: 'Ω', value: 1000 },
  capacitor: { label: 'Capacitor', icon: 'binary', unit: 'F', value: 1e-6 },
  inductor: { label: 'Inductor', icon: 'repeat', unit: 'H', value: 0.01 },
  vsource: { label: 'Battery', icon: 'battery', unit: 'V', value: 5 },
  ac: { label: 'AC source', icon: 'motion', unit: 'V', value: 5 },
  diode: { label: 'Diode', icon: 'transform', unit: '', value: 0 },
  led: { label: 'LED', icon: 'sparkles', unit: '', value: 0 },
  lamp: { label: 'Lamp', icon: 'sun', unit: 'Ω', value: 220 },
  switch: { label: 'Switch', icon: 'toggle', unit: '', value: 0 },
  ground: { label: 'Ground', icon: 'landmark', unit: '', value: 0 },
};

const prefix = (value, unit) => {
  const magnitude = Math.abs(value);
  if (!magnitude) return `0 ${unit}`;
  const steps = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
  ];
  const [scale, symbol] = steps.find(([size]) => magnitude >= size) ?? [1e-12, 'p'];
  const scaled = value / scale;
  const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
  const text = scaled.toFixed(digits);
  const trimmed = text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
  return `${trimmed} ${symbol}${unit}`;
};

const parseValue = (text, fallback) => {
  const match = String(text).trim().match(/^(-?[\d.]+)\s*([a-zA-ZµΩ]*)/);
  if (!match) return fallback;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return fallback;
  const factor = { g: 1e9, meg: 1e6, m: 1e-3, k: 1e3, u: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12 }[match[2].toLowerCase().replace(/[ωvfh]$/i, '')] ?? 1;
  return number * factor;
};

const SAMPLES = {
  divider: {
    name: 'Divider',
    parts: [
      { kind: 'vsource', a: [3, 3], b: [3, 8], value: 9 },
      { kind: 'resistor', a: [3, 3], b: [9, 3], value: 1000 },
      { kind: 'resistor', a: [9, 3], b: [9, 8], value: 2200 },
      { kind: 'wire', a: [9, 8], b: [3, 8] },
      { kind: 'ground', a: [3, 8], b: [3, 8] },
    ],
    probe: [9, 3],
  },
  rc: {
    name: 'RC filter',
    parts: [
      { kind: 'ac', a: [3, 3], b: [3, 9], value: 5, frequency: 120 },
      { kind: 'resistor', a: [3, 3], b: [9, 3], value: 1000 },
      { kind: 'capacitor', a: [9, 3], b: [9, 9], value: 2e-6 },
      { kind: 'wire', a: [9, 9], b: [3, 9] },
      { kind: 'ground', a: [3, 9], b: [3, 9] },
    ],
    probe: [9, 3],
  },
  rectifier: {
    name: 'Rectifier',
    parts: [
      { kind: 'ac', a: [3, 3], b: [3, 9], value: 8, frequency: 60 },
      { kind: 'diode', a: [3, 3], b: [9, 3] },
      { kind: 'capacitor', a: [9, 3], b: [9, 9], value: 4e-5 },
      { kind: 'resistor', a: [13, 3], b: [13, 9], value: 2000 },
      { kind: 'wire', a: [9, 3], b: [13, 3] },
      { kind: 'wire', a: [13, 9], b: [9, 9] },
      { kind: 'wire', a: [9, 9], b: [3, 9] },
      { kind: 'ground', a: [3, 9], b: [3, 9] },
    ],
    probe: [9, 3],
  },
  tank: {
    name: 'LC tank',
    parts: [
      { kind: 'vsource', a: [3, 3], b: [3, 9], value: 5 },
      { kind: 'resistor', a: [3, 3], b: [8, 3], value: 50 },
      { kind: 'inductor', a: [8, 3], b: [8, 9], value: 0.05 },
      { kind: 'capacitor', a: [13, 3], b: [13, 9], value: 1e-6 },
      { kind: 'wire', a: [8, 3], b: [13, 3] },
      { kind: 'wire', a: [13, 9], b: [8, 9] },
      { kind: 'wire', a: [8, 9], b: [3, 9] },
      { kind: 'ground', a: [3, 9], b: [3, 9] },
    ],
    probe: [8, 3],
  },
  led: {
    name: 'LED',
    parts: [
      { kind: 'vsource', a: [3, 3], b: [3, 9], value: 5 },
      { kind: 'switch', a: [3, 3], b: [8, 3], closed: true },
      { kind: 'resistor', a: [8, 3], b: [13, 3], value: 220 },
      { kind: 'led', a: [13, 3], b: [13, 9] },
      { kind: 'wire', a: [13, 9], b: [3, 9] },
      { kind: 'ground', a: [3, 9], b: [3, 9] },
    ],
    probe: [13, 3],
  },
};

class CircuitLab extends JGApp {
  static appId = 'circuit-lab';
  static settings = [
    { key: 'step', label: 'Time step (µs)', type: 'number', default: 20, min: 1, max: 500 },
    { key: 'labels', label: 'Show node voltages', type: 'switch', default: true },
  ];
  static styles = [...JGApp.styles, sheet];

  #parts = [];
  #tool = 'select';
  #selected = null;
  #probe = null;
  #running = true;
  #frame = null;
  #circuit = createCircuit();
  #trace = [];
  #drag = null;
  #hover = null;
  #nodes = new Map();
  #seq = 1;
  #history = [];
  #future = [];
  #signal = 'voltage';
  #timebase = 3;
  #range = 0;
  #hold = false;
  #trigger = true;
  #ticks = 0;
  #interval = 0;
  #speed = 2;

  connectedCallback() {
    this.#load(this.store.read() ?? 'divider');
    super.connectedCallback();
  }

  #load(sample) {
    const preset = SAMPLES[sample] ?? SAMPLES.divider;
    this.#parts = preset.parts.map((part) => ({
      id: this.#seq++,
      kind: part.kind,
      a: [...part.a],
      b: [...part.b],
      value: part.value ?? KINDS[part.kind]?.value ?? 0,
      frequency: part.frequency ?? 60,
      closed: part.closed ?? true,
    }));
    this.#probe = preset.probe ? [...preset.probe] : null;
    this.#trace = [];
    this.#selected = null;
    this.#circuit.reset();
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">Circuit Lab</div>
        <div class="hint">Build resistors, capacitors and diodes, then watch the scope.</div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head">
        <jg-toolbar id="bar"></jg-toolbar>
      </div>
      <div class="body">
        <div class="palette" id="palette"></div>
        <div class="board">
          <canvas id="view"></canvas>
          <div class="hint-bar"><b id="tool-name">Select</b><span id="tool-hint"></span></div>
          <div class="warn" id="warn" hidden>The solver could not settle. Check for shorted sources.</div>
        </div>
        <aside class="side">
          <div class="pane">
            <div class="label">Circuits</div>
            <div class="samples">
              ${Object.entries(SAMPLES).map(([key, sample]) => html`<button data-sample="${key}">${sample.name}</button>`)}
            </div>
            <div class="sep"></div>
            <div id="inspector"></div>
          </div>
        </aside>
      </div>

      <div class="footer">
        <div class="trace">
          <div class="trace-head">
            <span class="label">Scope</span>
            <span class="hint mono tiny" id="scope-label">no probe</span>
            <span class="grow"></span>
            <dl class="measures-row" id="measures"></dl>
          </div>
          <canvas id="scope"></canvas>
        </div>
        <div class="stack tight">
          <div class="scope-controls">
            <span>Signal</span>
            <jg-select id="signal" size="sm" value="voltage">
              <option value="voltage">Node voltage</option>
              <option value="current">Part current</option>
            </jg-select>
            <span>Speed</span>
            <jg-select id="speed" size="sm" value="${this.#speed}">
              ${SPEEDS.map((step, index) => html`<option value="${index}">${step.label}</option>`)}
            </jg-select>
            <span>Time base</span>
            <jg-select id="timebase" size="sm" value="${this.#timebase}">
              ${TIMEBASE.map((step, index) => html`<option value="${index}">${step.label}</option>`)}
            </jg-select>
            <span>Volts/div</span>
            <jg-slider id="range" min="0" max="40" step="1" value="${this.#range}"></jg-slider>
          </div>
          <div class="scope-foot">
            <label class="hint" style="display:flex;align-items:center;gap:6px">
              <jg-switch id="trigger" checked></jg-switch>Trigger
            </label>
            <div class="row tight">
              <jg-button size="sm" variant="ghost" id="hold">Hold</jg-button>
              <jg-button size="sm" variant="ghost" id="clear">Clear</jg-button>
            </div>
          </div>
        </div>
      </div>
    </div>`);

    this.$('#bar').items = [
      { id: 'run', label: this.#running ? 'Pause' : 'Run', icon: this.#running ? 'timer' : 'play', action: () => this.#toggleRun() },
      { id: 'reset', label: 'Reset', icon: 'repeat', action: () => this.#reset() },
      { separator: true },
      { id: 'undo', label: 'Undo', icon: 'undo', iconOnly: true, title: 'Undo', action: () => this.#undo() },
      { id: 'redo', label: 'Redo', icon: 'redo', iconOnly: true, title: 'Redo', action: () => this.#redo() },
      { id: 'delete', label: 'Delete', icon: 'eraser', iconOnly: true, title: 'Delete the selected part', action: () => this.#remove() },
      { spacer: true },
      { id: 'copy', label: 'Copy netlist', icon: 'copy', action: () => copyText(this.#netlist()) },
    ];

    this.$('#palette').innerHTML = html`
      <div class="group">Edit</div>
      ${[
        { id: 'select', label: 'Select', icon: 'launcher' },
        { id: 'probe', label: 'Probe', icon: 'search' },
      ].map(
        (tool) => html`<button class="tool" data-tool="${tool.id}" aria-pressed="${String(this.#tool === tool.id)}">
          ${icon(tool.icon, 15)}<span>${tool.label}</span>
        </button>`,
      )}
      <div class="group">Parts</div>
      ${Object.entries(KINDS).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>${meta.label}</span>
        </button>`,
      )}
    `;
    this.bind('.tool', 'click', (event) => this.#setTool(event.currentTarget.dataset.tool));
    this.#hint();

    this.bind('[data-sample]', 'click', (event) => {
      const key = event.currentTarget.dataset.sample;
      this.store.write(key);
      this.#load(key);
      this.#rebuild();
      this.#inspector();
      this.#draw();
    });

    const canvas = this.$('#view');
    this.on(canvas, 'pointerdown', (event) => this.#down(event));
    this.on(canvas, 'pointermove', (event) => this.#move(event));
    this.on(canvas, 'pointerup', (event) => this.#up(event));
    this.on(canvas, 'pointerleave', () => {
      this.#hover = null;
      this.#draw();
    });

    this.hotkeys((event) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.#redo();
        else this.#undo();
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

    this.#rebuild();
    this.#inspector();
    this.#loop();
  }

  #setTool(tool) {
    this.#tool = tool;
    this.toggleAttribute('data-keeps-escape', tool !== 'select');
    this.$$('.tool').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.tool === tool)));
    const canvas = this.$('#view');
    if (canvas) canvas.dataset.tool = tool === 'select' || tool === 'probe' ? 'select' : 'place';
    if (tool !== 'select') {
      this.#selected = null;
      this.#inspector();
    }
    this.#hint();
    this.#draw();
  }

  #toggleRun() {
    this.#running = !this.#running;
    this.$('#bar').update('run', { label: this.#running ? 'Pause' : 'Run', icon: this.#running ? 'timer' : 'play' });
  }

  #reset() {
    this.#circuit.reset();
    this.#trace = [];
    this.#ticks = 0;
    this.$('#warn').hidden = true;
    this.#draw();
  }

  #hint() {
    const name = this.$('#tool-name');
    const hint = this.$('#tool-hint');
    if (!name || !hint) return;
    if (this.#tool === 'select') {
      name.textContent = 'Select';
      hint.textContent = 'Drag a part to move it, drag an end to re-route, click a switch to flip it. Delete removes.';
      return;
    }
    if (this.#tool === 'probe') {
      name.textContent = 'Probe';
      hint.textContent = 'Click any junction to watch its voltage on the scope.';
      return;
    }
    name.textContent = KINDS[this.#tool]?.label ?? this.#tool;
    hint.textContent =
      this.#tool === 'ground'
        ? 'Click a junction to tie it to ground. Esc goes back to Select.'
        : 'Click to drop one, or drag to set its length and direction. Esc goes back to Select.';
  }

  #snapshot() {
    this.#history.push(JSON.stringify(this.#parts));
    if (this.#history.length > 60) this.#history.shift();
    this.#future = [];
  }

  #undo() {
    const previous = this.#history.pop();
    if (previous === undefined) return;
    this.#future.push(JSON.stringify(this.#parts));
    this.#parts = JSON.parse(previous);
    this.#selected = null;
    this.#rebuild();
    this.#inspector();
    this.#draw();
  }

  #redo() {
    const next = this.#future.pop();
    if (next === undefined) return;
    this.#history.push(JSON.stringify(this.#parts));
    this.#parts = JSON.parse(next);
    this.#selected = null;
    this.#rebuild();
    this.#inspector();
    this.#draw();
  }

  #remove() {
    if (this.#selected === null) return;
    this.#snapshot();
    this.#parts = this.#parts.filter((part) => part.id !== this.#selected);
    this.#selected = null;
    this.#rebuild();
    this.#inspector();
    this.#draw();
  }

  #point(event) {
    const rect = this.$('#view').getBoundingClientRect();
    return [(event.clientX - rect.left) / GRID, (event.clientY - rect.top) / GRID];
  }

  #snap(point) {
    return [Math.round(point[0]), Math.round(point[1])];
  }

  #near(point, target) {
    return Math.hypot(point[0] - target[0], point[1] - target[1]);
  }

  #hit(point) {
    let best = null;
    let closest = 0.6;
    this.#parts.forEach((part) => {
      const [ax, ay] = part.a;
      const [bx, by] = part.b;
      const dx = bx - ax;
      const dy = by - ay;
      const span = dx * dx + dy * dy;
      const t = span ? Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / span)) : 0;
      const distance = Math.hypot(point[0] - (ax + dx * t), point[1] - (ay + dy * t));
      if (distance < closest) {
        closest = distance;
        best = part;
      }
    });
    return best;
  }

  #down(event) {
    const raw = this.#point(event);
    const point = this.#snap(raw);
    this.$('#view').setPointerCapture(event.pointerId);

    if (this.#tool === 'probe') {
      this.#probe = point;
      this.#trace = [];
      this.#scopeLabel();
      this.#draw();
      return;
    }

    if (this.#tool === 'select') {
      const part = this.#hit(raw);
      this.#selected = part?.id ?? null;

      if (part) {
        if (part.kind === 'switch' && this.#near(raw, [(part.a[0] + part.b[0]) / 2, (part.a[1] + part.b[1]) / 2]) < 0.5) {
          this.#snapshot();
          part.closed = !part.closed;
          this.#rebuild();
        } else {
          const endA = this.#near(raw, part.a);
          const endB = this.#near(raw, part.b);
          this.#snapshot();
          this.#drag =
            endA < 0.45 || endB < 0.45
              ? { kind: 'end', part, end: endA <= endB ? 'a' : 'b' }
              : { kind: 'move', part, from: point, origin: { a: [...part.a], b: [...part.b] } };
          this.$('#view').dataset.dragging = 'true';
        }
      }

      this.#inspector();
      this.#draw();
      return;
    }

    if (this.#tool === 'ground') {
      this.#snapshot();
      this.#parts.push({ id: this.#seq++, kind: 'ground', a: point, b: point, value: 0 });
      this.#rebuild();
      this.#draw();
      return;
    }

    this.#drag = { kind: 'place', from: point, to: point, moved: false };
  }

  #move(event) {
    const raw = this.#point(event);
    const point = this.#snap(raw);
    this.#hover = point;
    const canvas = this.$('#view');

    if (!this.#drag) {
      if (this.#tool === 'select' && canvas) canvas.dataset.grab = String(Boolean(this.#hit(raw)));
      this.#draw();
      return;
    }

    if (this.#drag.kind === 'place') {
      const [fx, fy] = this.#drag.from;
      this.#drag.to = Math.abs(point[0] - fx) >= Math.abs(point[1] - fy) ? [point[0], fy] : [fx, point[1]];
      this.#drag.moved = this.#drag.to[0] !== fx || this.#drag.to[1] !== fy;
    } else if (this.#drag.kind === 'move') {
      const dx = point[0] - this.#drag.from[0];
      const dy = point[1] - this.#drag.from[1];
      const { part, origin } = this.#drag;
      part.a = [origin.a[0] + dx, origin.a[1] + dy];
      part.b = [origin.b[0] + dx, origin.b[1] + dy];
    } else if (this.#drag.kind === 'end') {
      this.#drag.part[this.#drag.end] = point;
    }

    this.#draw();
  }

  #up() {
    const drag = this.#drag;
    this.#drag = null;
    const canvas = this.$('#view');
    if (canvas) canvas.dataset.dragging = 'false';
    if (!drag) return;

    if (drag.kind === 'place') {
      const meta = KINDS[this.#tool];
      const from = drag.from;
      const to = drag.moved ? drag.to : [from[0] + 4, from[1]];
      this.#snapshot();
      const part = {
        id: this.#seq++,
        kind: this.#tool,
        a: from,
        b: to,
        value: meta?.value ?? 0,
        frequency: 60,
        closed: true,
      };
      this.#parts.push(part);
      this.#selected = part.id;
    }

    this.#rebuild();
    this.#inspector();
    this.#draw();
  }

  #rebuild() {
    const key = (point) => `${point[0]},${point[1]}`;
    const parent = new Map();
    const find = (node) => {
      let root = node;
      while (parent.get(root) !== root) root = parent.get(root);
      return root;
    };
    const add = (point) => {
      const id = key(point);
      if (!parent.has(id)) parent.set(id, id);
      return id;
    };
    const union = (first, second) => {
      const a = find(first);
      const b = find(second);
      if (a !== b) parent.set(a, b);
    };

    this.#parts.forEach((part) => {
      add(part.a);
      add(part.b);
    });
    this.#parts.filter((part) => part.kind === 'wire').forEach((part) => union(key(part.a), key(part.b)));

    const ids = new Map();
    parent.forEach((value, id) => {
      const root = find(id);
      if (!ids.has(root)) ids.set(root, ids.size);
    });

    this.#nodes = new Map();
    parent.forEach((value, id) => this.#nodes.set(id, ids.get(find(id))));

    const groundPart = this.#parts.find((part) => part.kind === 'ground');
    const ground = groundPart ? this.#nodes.get(key(groundPart.a)) ?? 0 : 0;

    const solverParts = this.#parts
      .filter((part) => part.kind !== 'wire' && part.kind !== 'ground')
      .map((part) => ({
        id: part.id,
        type: part.kind === 'ac' ? 'vsource' : part.kind,
        wave: part.kind === 'ac' ? 'sine' : 'dc',
        frequency: part.frequency,
        closed: part.closed,
        value: part.value,
        a: this.#nodes.get(key(part.a)) ?? 0,
        b: this.#nodes.get(key(part.b)) ?? 0,
      }));

    this.#circuit.build(solverParts, ids.size, ground);
    this.#trace = [];
  }

  #sample() {
    if (this.#signal === 'current') {
      return this.#selected === null ? null : this.#circuit.current(this.#selected);
    }
    if (!this.#probe) return null;
    const node = this.#node(this.#probe);
    return node === null ? null : this.#circuit.voltage(node);
  }

  #scopeLabel() {
    const label = this.$('#scope-label');
    if (!label) return;
    if (this.#signal === 'current') {
      const part = this.#parts.find((entry) => entry.id === this.#selected);
      label.textContent = part ? `current in ${KINDS[part.kind]?.label ?? part.kind}` : 'select a part';
      return;
    }
    label.textContent = this.#probe ? `node at ${this.#probe.join(',')}` : 'no probe';
  }

  #node(point) {
    return this.#nodes.get(`${point[0]},${point[1]}`) ?? null;
  }

  #loop() {
    const dt = Math.max(1, Number(this.config.get('step', 20))) * 1e-6;
    const tick = () => {
      if (this.#running && this.#parts.length) {
        const span = TIMEBASE[this.#timebase].seconds * DIVISIONS;
        const every = Math.max(1, Math.round(span / (dt * POINTS)));
        this.#interval = dt * every;
        const budget = Math.max(1, Math.round((SPEEDS[this.#speed].factor / 60) / dt));
        for (let index = 0; index < budget; index += 1) {
          this.#circuit.step(dt);
          this.#ticks += 1;
          if (this.#hold || this.#ticks % every) continue;
          const sample = this.#sample();
          if (sample === null) continue;
          this.#trace.push(sample);
          while (this.#trace.length > POINTS * 2) this.#trace.shift();
        }
        this.$('#warn').hidden = !this.#circuit.failed;
        this.#draw();
        this.#scope();
        this.#readout();
      }
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
    this.track(() => cancelAnimationFrame(this.#frame));
  }

  #fit(canvas) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (!width || !height) return null;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width: canvas.clientWidth, height: canvas.clientHeight };
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
    };
  }

  #draw() {
    const view = this.#fit(this.$('#view'));
    if (!view) return;
    const { context, width, height } = view;
    const paint = this.#palette();

    context.clearRect(0, 0, width, height);

    context.fillStyle = paint.soft;
    context.globalAlpha = 0.25;
    for (let x = 0; x <= width; x += GRID) {
      for (let y = 0; y <= height; y += GRID) {
        context.fillRect(x, y, 1, 1);
      }
    }
    context.globalAlpha = 1;

    this.#parts.forEach((part) => this.#drawPart(context, part, paint));

    const ends = new Map();
    this.#parts.forEach((part) => {
      [part.a, part.b].forEach((point) => {
        const id = `${point[0]},${point[1]}`;
        ends.set(id, (ends.get(id) ?? 0) + 1);
      });
    });
    context.fillStyle = paint.line;
    ends.forEach((count, id) => {
      if (count < 3) return;
      const [x, y] = id.split(',').map(Number);
      context.beginPath();
      context.arc(x * GRID, y * GRID, 3.4, 0, Math.PI * 2);
      context.fill();
    });

    if (this.#drag?.kind === 'place') {
      this.#drawPart(context, { ...this.#drag, kind: this.#tool, a: this.#drag.from, b: this.#drag.to, id: -1, closed: true, value: KINDS[this.#tool]?.value ?? 0 }, paint, 0.45);
    } else if (this.#hover && this.#tool !== 'select' && this.#tool !== 'probe') {
      const ghost = this.#tool === 'ground'
        ? { kind: 'ground', a: this.#hover, b: this.#hover }
        : { kind: this.#tool, a: this.#hover, b: [this.#hover[0] + 4, this.#hover[1]] };
      this.#drawPart(context, { ...ghost, id: -1, closed: true, value: KINDS[this.#tool]?.value ?? 0 }, paint, 0.3);
    }

    if (this.#hover) {
      context.fillStyle = paint.ring;
      context.globalAlpha = 0.5;
      context.beginPath();
      context.arc(this.#hover[0] * GRID, this.#hover[1] * GRID, 3.2, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    if (settings.get('appearance.motion') && this.config.get('labels', true)) this.#drawLabels(context, paint);

    if (this.#probe) {
      const [x, y] = this.#probe;
      context.strokeStyle = paint.ring;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x * GRID, y * GRID, 6, 0, Math.PI * 2);
      context.stroke();
    }
  }

  #drawLabels(context, paint) {
    const seen = new Set();
    context.font = `500 10px ${paint.mono}`;
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    this.#parts.forEach((part) => {
      [part.a, part.b].forEach((point) => {
        const id = `${point[0]},${point[1]}`;
        if (seen.has(id)) return;
        seen.add(id);
        const node = this.#nodes.get(id);
        if (node === undefined) return;
        context.fillStyle = paint.soft;
        context.fillText(prefix(this.#circuit.voltage(node), 'V'), point[0] * GRID, point[1] * GRID - 8);
      });
    });
  }

  #drawPart(context, part, paint, ghost = 0) {
    const [ax, ay] = [part.a[0] * GRID, part.a[1] * GRID];
    const [bx, by] = [part.b[0] * GRID, part.b[1] * GRID];
    const selected = part.id === this.#selected;
    const angle = Math.atan2(by - ay, bx - ax);
    const length = Math.hypot(bx - ax, by - ay);
    const current = this.#circuit.current(part.id);

    context.save();
    if (ghost) {
      context.globalAlpha = ghost;
      context.setLineDash([5, 4]);
    }
    context.translate(ax, ay);
    context.rotate(angle);
    context.lineWidth = selected ? 2.6 : 1.8;
    context.strokeStyle = selected ? paint.ring : paint.line;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.fillStyle = paint.card;

    const lead = Math.max(0, (length - 26) / 2);
    const draw = (body) => {
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(lead, 0);
      context.stroke();
      context.beginPath();
      context.moveTo(length - lead, 0);
      context.lineTo(length, 0);
      context.stroke();
      body(lead, length - lead);
    };

    if (part.kind === 'wire') {
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(length, 0);
      context.stroke();
    } else if (part.kind === 'ground') {
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(0, 9);
      context.moveTo(-9, 9);
      context.lineTo(9, 9);
      context.moveTo(-5.5, 13);
      context.lineTo(5.5, 13);
      context.moveTo(-2, 17);
      context.lineTo(2, 17);
      context.stroke();
    } else if (part.kind === 'resistor' || part.kind === 'lamp') {
      draw((start, end) => {
        const span = end - start;
        context.beginPath();
        context.moveTo(start, 0);
        for (let step = 0; step < 6; step += 1) {
          context.lineTo(start + (span / 6) * (step + 0.5), step % 2 === 0 ? -7 : 7);
        }
        context.lineTo(end, 0);
        context.stroke();
        if (part.kind === 'lamp') {
          const glow = Math.min(1, Math.abs(current) * 30);
          context.beginPath();
          context.arc((start + end) / 2, 0, 11, 0, Math.PI * 2);
          context.fillStyle = `rgba(255,196,80,${0.15 + glow * 0.7})`;
          context.fill();
          context.strokeStyle = selected ? paint.ring : paint.line;
          context.stroke();
        }
      });
    } else if (part.kind === 'capacitor') {
      draw((start, end) => {
        const mid = (start + end) / 2;
        context.beginPath();
        context.moveTo(mid - 3, -10);
        context.lineTo(mid - 3, 10);
        context.moveTo(mid + 3, -10);
        context.lineTo(mid + 3, 10);
        context.stroke();
        context.beginPath();
        context.moveTo(start, 0);
        context.lineTo(mid - 3, 0);
        context.moveTo(mid + 3, 0);
        context.lineTo(end, 0);
        context.stroke();
      });
    } else if (part.kind === 'inductor') {
      draw((start, end) => {
        const span = end - start;
        context.beginPath();
        for (let step = 0; step < 4; step += 1) {
          context.arc(start + (span / 4) * (step + 0.5), 0, span / 8, Math.PI, 0, false);
        }
        context.stroke();
      });
    } else if (part.kind === 'vsource' || part.kind === 'ac') {
      draw((start, end) => {
        const mid = (start + end) / 2;
        if (part.kind === 'ac') {
          context.beginPath();
          context.arc(mid, 0, 12, 0, Math.PI * 2);
          context.fillStyle = paint.card;
          context.fill();
          context.stroke();
          context.beginPath();
          for (let step = -8; step <= 8; step += 1) {
            const value = Math.sin((step / 8) * Math.PI) * 5;
            if (step === -8) context.moveTo(mid + step, -value);
            else context.lineTo(mid + step, -value);
          }
          context.stroke();
          context.beginPath();
          context.moveTo(start, 0);
          context.lineTo(mid - 12, 0);
          context.moveTo(mid + 12, 0);
          context.lineTo(end, 0);
          context.stroke();
          return;
        }
        context.beginPath();
        context.moveTo(mid - 4, -11);
        context.lineTo(mid - 4, 11);
        context.moveTo(mid + 4, -6);
        context.lineTo(mid + 4, 6);
        context.stroke();
        context.beginPath();
        context.moveTo(start, 0);
        context.lineTo(mid - 4, 0);
        context.moveTo(mid + 4, 0);
        context.lineTo(end, 0);
        context.stroke();
      });
    } else if (part.kind === 'diode' || part.kind === 'led') {
      draw((start, end) => {
        const mid = (start + end) / 2;
        context.beginPath();
        context.moveTo(mid - 6, -8);
        context.lineTo(mid - 6, 8);
        context.lineTo(mid + 6, 0);
        context.closePath();
        if (part.kind === 'led') {
          const glow = Math.min(1, Math.abs(current) * 90);
          context.fillStyle = `rgba(220,70,60,${0.25 + glow * 0.7})`;
        } else {
          context.fillStyle = paint.line;
        }
        context.fill();
        context.beginPath();
        context.moveTo(mid + 6, -8);
        context.lineTo(mid + 6, 8);
        context.stroke();
        context.beginPath();
        context.moveTo(start, 0);
        context.lineTo(mid - 6, 0);
        context.moveTo(mid + 6, 0);
        context.lineTo(end, 0);
        context.stroke();
        if (part.kind === 'led') {
          context.beginPath();
          context.moveTo(mid + 2, -12);
          context.lineTo(mid + 8, -18);
          context.moveTo(mid + 7, -11);
          context.lineTo(mid + 13, -17);
          context.stroke();
        }
      });
    } else if (part.kind === 'switch') {
      draw((start, end) => {
        context.beginPath();
        context.arc(start + 2, 0, 2, 0, Math.PI * 2);
        context.arc(end - 2, 0, 2, 0, Math.PI * 2);
        context.fillStyle = paint.line;
        context.fill();
        context.beginPath();
        context.moveTo(start + 2, 0);
        context.lineTo(end - 2, part.closed ? 0 : -10);
        context.stroke();
      });
    }

    if (part.kind !== 'wire' && part.kind !== 'ground') {
      const meta = KINDS[part.kind === 'ac' ? 'ac' : part.kind];
      if (meta?.unit) {
        context.rotate(-angle);
        context.fillStyle = paint.soft;
        context.font = `500 10px ${paint.mono}`;
        context.textAlign = 'center';
        const dx = (Math.cos(angle) * length) / 2;
        const dy = (Math.sin(angle) * length) / 2;
        context.fillText(prefix(part.value, meta.unit), dx, dy + (Math.abs(Math.sin(angle)) > 0.5 ? 4 : 22));
      }
    }

    context.restore();
  }

  #scope() {
    const view = this.#fit(this.$('#scope'));
    if (!view) return;
    const { context, width, height } = view;
    const paint = this.#palette();
    context.clearRect(0, 0, width, height);

    context.strokeStyle = paint.border;
    context.lineWidth = 1;
    context.globalAlpha = 0.55;
    for (let step = 1; step < DIVISIONS; step += 1) {
      const x = Math.round((width / DIVISIONS) * step) + 0.5;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let step = 1; step < 8; step += 1) {
      const y = Math.round((height / 8) * step) + 0.5;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.globalAlpha = 1;
    context.strokeStyle = paint.soft;
    context.beginPath();
    context.moveTo(0, Math.round(height / 2) + 0.5);
    context.lineTo(width, Math.round(height / 2) + 0.5);
    context.stroke();

    const unit = this.#signal === 'current' ? 'A' : 'V';
    const trace = this.#trace;
    if (trace.length < 2) return;

    const span = TIMEBASE[this.#timebase].seconds * DIVISIONS;
    const sweep = Math.max(2, Math.min(POINTS, Math.round(span / (this.#interval || span / POINTS))));
    const latest = Math.max(0, trace.length - sweep);
    let start = latest;
    if (this.#trigger && trace.length > POINTS) {
      const mid = trace.reduce((sum, value) => sum + value, 0) / trace.length;
      for (let index = latest; index > 0; index -= 1) {
        if (trace[index - 1] <= mid && trace[index] > mid) {
          start = index;
          break;
        }
      }
    }

    const window = trace.slice(start, start + sweep);
    const peak = this.#range || Math.max(this.#signal === 'current' ? 1e-6 : 0.5, ...window.map((value) => Math.abs(value))) * 1.1;

    context.strokeStyle = paint.ring;
    context.lineWidth = 1.6;
    context.lineJoin = 'round';
    context.beginPath();
    window.forEach((value, index) => {
      const x = (index / Math.max(1, sweep - 1)) * width;
      const y = height / 2 - (value / peak) * (height / 2 - 4);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();

    context.fillStyle = paint.soft;
    context.font = `500 10px ${paint.mono}`;
    context.textAlign = 'left';
    context.fillText(`${prefix(peak / 4, unit)}/div`, 6, 12);
    context.textAlign = 'right';
    context.fillText(TIMEBASE[this.#timebase].label, width - 6, 12);

    this.#measure(window, unit);
  }

  #measure(window, unit) {
    const target = this.$('#measures');
    if (!target) return;
    if (window.length < 2) {
      target.innerHTML = '';
      return;
    }

    const min = Math.min(...window);
    const max = Math.max(...window);
    const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
    const rms = Math.sqrt(window.reduce((sum, value) => sum + value * value, 0) / window.length);

    const interval = this.#interval || TIMEBASE[this.#timebase].seconds * DIVISIONS / POINTS;
    const mid = mean;
    const crossings = [];
    for (let index = 1; index < window.length; index += 1) {
      const before = window[index - 1];
      const after = window[index];
      if (before <= mid && after > mid) {
        const slope = after - before;
        crossings.push(index - 1 + (slope ? (mid - before) / slope : 0));
      }
    }
    const period = crossings.length > 1 ? ((crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1)) * interval : 0;

    target.innerHTML = html`
      <div><dt>Vpp</dt><dd>${prefix(max - min, unit)}</dd></div>
      <div><dt>min</dt><dd>${prefix(min, unit)}</dd></div>
      <div><dt>max</dt><dd>${prefix(max, unit)}</dd></div>
      <div><dt>avg</dt><dd>${prefix(mean, unit)}</dd></div>
      <div><dt>rms</dt><dd>${prefix(rms, unit)}</dd></div>
      ${period ? html`<div><dt>freq</dt><dd>${prefix(1 / period, 'Hz')}</dd></div>` : ''}
    `;
  }

  #readout() {
    const target = this.$('#readout');
    if (!target) return;
    const part = this.#parts.find((entry) => entry.id === this.#selected);
    if (part) {
      const current = this.#circuit.current(part.id);
      const across = this.#circuit.voltage(this.#node(part.a) ?? 0) - this.#circuit.voltage(this.#node(part.b) ?? 0);
      target.innerHTML = html`
        <dt>Voltage</dt><dd>${prefix(across, 'V')}</dd>
        <dt>Current</dt><dd>${prefix(current, 'A')}</dd>
        <dt>Power</dt><dd>${prefix(Math.abs(across * current), 'W')}</dd>
      `;
      return;
    }
    if (this.#probe) {
      const node = this.#node(this.#probe);
      target.innerHTML = html`<dt>Node ${node ?? '-'}</dt><dd>${node === null ? '-' : prefix(this.#circuit.voltage(node), 'V')}</dd>`;
    }
  }

  #inspector() {
    const part = this.#parts.find((entry) => entry.id === this.#selected);
    const meta = part ? KINDS[part.kind] : null;
    this.#scopeLabel();

    this.$('#inspector').innerHTML = html`
      <div class="label">${part ? meta?.label ?? part.kind : 'Probe'}</div>
      ${part && meta?.unit
        ? html`<jg-field label="Value">
            <jg-input id="value" size="sm" value="${prefix(part.value, meta.unit)}"></jg-input>
          </jg-field>`
        : ''}
      ${part && part.kind === 'ac'
        ? html`<jg-field label="Frequency">
            <jg-input id="frequency" size="sm" value="${part.frequency}"></jg-input>
          </jg-field>`
        : ''}
      ${part && part.kind === 'switch'
        ? html`<div class="row"><jg-switch id="closed" ${part.closed ? 'checked' : ''}></jg-switch><span class="hint">Closed</span></div>`
        : ''}
      <dl class="readout" id="readout"></dl>
      ${part ? html`<jg-button size="sm" variant="outline" id="remove">Remove part</jg-button>` : html`<div class="hint">Click a wire junction to probe it, or a part to edit it.</div>`}
    `;

    const value = this.$('#value');
    if (value) {
      this.on(value, 'change', () => {
        part.value = parseValue(value.value, part.value);
        value.value = prefix(part.value, meta.unit);
        this.#rebuild();
        this.#draw();
      });
    }
    const frequency = this.$('#frequency');
    if (frequency) {
      this.on(frequency, 'change', () => {
        part.frequency = Math.max(0.1, Number(frequency.value) || 60);
        this.#rebuild();
      });
    }
    const closed = this.$('#closed');
    if (closed) {
      this.on(closed, 'change', (event) => {
        part.closed = event.detail.checked;
        this.#rebuild();
        this.#draw();
      });
    }
    const remove = this.$('#remove');
    if (remove) {
      this.on(remove, 'click', () => {
        this.#parts = this.#parts.filter((entry) => entry.id !== this.#selected);
        this.#selected = null;
        this.#rebuild();
        this.#inspector();
        this.#draw();
      });
    }
    this.#readout();
  }

  #netlist() {
    return this.#parts
      .filter((part) => part.kind !== 'ground')
      .map((part, index) => {
        const a = this.#node(part.a);
        const b = this.#node(part.b);
        const unit = KINDS[part.kind]?.unit ?? '';
        return `${part.kind.toUpperCase()}${index + 1} ${a} ${b} ${unit ? prefix(part.value, unit) : ''}`.trim();
      })
      .join('\n');
  }
}

define('jg-app-circuit-lab', CircuitLab);
