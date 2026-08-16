import { JGApp, define, html, css } from '../core/app.js';
import { createLogic, GATES, SEGMENTS } from '../lib/logic.js';
import { icon } from '../ui/icons.js';
import { copyText, toast } from '../core/util.js';
import { createDesigns } from '../lib/designs.js';

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
  canvas[data-pin="true"] { cursor: crosshair; }
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
  .samples button[data-open="true"] { border-color: var(--ring); background: color-mix(in srgb, var(--ring) 14%, var(--card)); }
  .saved { display: flex; flex-direction: column; gap: 5px; }
  .saved .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .saved .row button:first-child {
    flex: 1;
    text-align: left;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    border-radius: var(--radius-sm);
    padding: 5px 9px;
    font: 500 11.5px/1.3 var(--font-sans);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .saved .row button:first-child:hover { border-color: var(--ring); }
  .saved .row button[data-open="true"] { border-color: var(--ring); background: color-mix(in srgb, var(--ring) 14%, var(--card)); }
  .saved .row .drop {
    flex: none;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 4px;
    line-height: 0;
    border-radius: var(--radius-sm);
  }
  .saved .row .drop:hover { background: var(--accent); color: var(--foreground); }
  .save-row { display: flex; gap: 6px; align-items: center; }
  .save-row jg-input { flex: 1; }
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
const MATRIX = 8;

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
  decoder: { label: '2 to 4 decoder', icon: 'blocks', inputs: 3, outputs: 4, width: 6, height: 6 },
  encoder: { label: '4 to 2 encoder', icon: 'blocks', inputs: 4, outputs: 3, width: 6, height: 6 },
  mux: { label: '4 to 1 mux', icon: 'transform', inputs: 6, outputs: 1, width: 6, height: 7 },
  demux: { label: '1 to 4 demux', icon: 'transform', inputs: 3, outputs: 4, width: 6, height: 6 },
  node: { label: 'Splitter', icon: 'square', inputs: 1, outputs: 2, width: 2, height: 3 },
  led: { label: 'LED', icon: 'sparkles', inputs: 1, outputs: 0, width: 2, height: 2 },
  seven: { label: '7 segment', icon: 'spec', inputs: 4, outputs: 0, width: 5, height: 7 },
  matrix: { label: '8x8 matrix', icon: 'grid', inputs: 16, outputs: 0, rows: 8, width: 10, height: 10 },
};

const PIN_NAMES = {
  dff: { in0: 'D', in1: 'CLK', out0: 'Q', out1: 'Q\u0305' },
  tff: { in0: 'T', in1: 'CLK', out0: 'Q' },
  counter: { in0: 'CLK', in1: 'RST', out0: 'Q0', out1: 'Q1', out2: 'Q2', out3: 'Q3' },
  decoder: { in0: 'A0', in1: 'A1', in2: 'EN', out0: 'Y0', out1: 'Y1', out2: 'Y2', out3: 'Y3' },
  encoder: { in0: 'I0', in1: 'I1', in2: 'I2', in3: 'I3', out0: 'A0', out1: 'A1', out2: 'V' },
  mux: { in0: 'D0', in1: 'D1', in2: 'D2', in3: 'D3', in4: 'S0', in5: 'S1', out0: 'Y' },
  demux: { in0: 'D', in1: 'S0', in2: 'S1', out0: 'Y0', out1: 'Y1', out2: 'Y2', out3: 'Y3' },
  seven: { in0: 'A', in1: 'B', in2: 'C', in3: 'D' },
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
  #wireStart = null;
  #hoverPin = null;
  #paint = null;
  #pan = { x: 0, y: 0 };
  #zoom = 1;
  #panDrag = null;
  #routeDrag = null;
  #selectedLink = null;
  #designs = null;
  #openName = null;
  #press = null;
  #drag = null;
  #hover = null;
  #logic = createLogic();
  #frame = null;
  #grid = null;
  #seq = 1;
  #history = [];
  #running = true;

  connectedCallback() {
    this.#designs = createDesigns(this.store, 'logic-lab');
    const open = this.#designs.open();
    const saved = open ? this.#designs.get(open) : null;
    if (saved) {
      this.#restore(saved);
      this.#openName = open;
    } else {
      this.#load(SAMPLES[open] ? open : 'halfAdder');
    }
    super.connectedCallback();
  }

  #restore(design) {
    this.#parts = (design.parts ?? []).filter((part) => KINDS[part.kind]).map((part) => ({ ...part }));
    this.#seq = this.#parts.reduce((top, part) => Math.max(top, Number(part.id) || 0), 0) + 1;
    const alive = new Set(this.#parts.map((part) => String(part.id)));
    this.#links = (design.links ?? [])
      .filter((link) => alive.has(String(link.from).split(':')[0]) && alive.has(String(link.to).split(':')[0]))
      .map((link) => ({ from: link.from, to: link.to, ...(link.bend != null ? { bend: link.bend } : {}) }));
    this.#clearView();
    this.#rebuild();
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
    this.#openName = null;
    this.#clearView();
    this.#rebuild();
  }

  #clearView() {
    this.#selected = null;
    this.#selectedLink = null;
    this.#wireFrom = null;
    this.#pan = { x: 0, y: 0 };
    this.#zoom = 1;
  }

  #design() {
    return {
      parts: this.#parts.map((part) => ({
        id: part.id,
        kind: part.kind,
        x: part.x,
        y: part.y,
        on: part.on ?? false,
        value: part.value ?? 0,
        momentary: part.momentary,
        inputs: part.inputs,
        inverted: part.inverted,
        turn: part.turn,
        flip: part.flip,
      })),
      links: this.#links.map((link) => ({ from: link.from, to: link.to, bend: link.bend })),
    };
  }

  #apply(design) {
    if (!Array.isArray(design?.parts)) throw new Error('That design has no parts.');
    this.#snapshot();
    this.#restore(design);
    this.#inspector();
    this.#fit();
    this.#draw();
  }

  #savedList() {
    const target = this.$('#saved');
    if (!target) return;
    const rows = this.#designs.list();
    if (!rows.length) {
      target.innerHTML = html`<span class="hint">Nothing saved yet. Name a circuit above and save it.</span>`;
      return;
    }
    target.innerHTML = rows
      .map(
        (row) => html`<div class="row">
          <button data-load="${row.name}" data-open="${String(row.name === this.#openName)}" title="${row.name}">${row.name}</button>
          <button class="drop" data-drop="${row.name}" title="Delete ${row.name}">${icon('eraser', 14)}</button>
        </div>`,
      )
      .join('');
    target.querySelectorAll('[data-load]').forEach((node) =>
      node.addEventListener('click', () => {
        const design = this.#designs.get(node.dataset.load);
        if (!design) return;
        this.#apply(design);
        this.#openName = node.dataset.load;
        this.#designs.setOpen(this.#openName);
        this.#nameField();
        this.#savedList();
      }),
    );
    target.querySelectorAll('[data-drop]').forEach((node) =>
      node.addEventListener('click', () => {
        this.#designs.remove(node.dataset.drop);
        if (this.#openName === node.dataset.drop) this.#openName = null;
        this.#savedList();
      }),
    );
  }

  #nameField() {
    const field = this.$('#save-name');
    if (field) field.value = this.#openName ?? '';
  }

  #saveNamed() {
    const field = this.$('#save-name');
    const name = (field?.value ?? '').trim();
    if (!name) {
      field?.focus();
      return;
    }
    this.#openName = this.#designs.save(name, this.#design());
    this.#savedList();
  }

  #exportFile() {
    this.#designs.toFile(this.#openName ?? 'logic-circuit', this.#design());
  }

  async #importFile() {
    try {
      const picked = await this.#designs.fromFile();
      if (!picked) return;
      this.#apply(picked.design);
      this.#openName = picked.name;
      this.#nameField();
      this.#savedList();
    } catch (error) {
      toast(error.message, 'danger');
    }
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">Logic Lab</div>
        <div class="hint">Gates, flip-flops, counters, decoders and LED displays.</div>
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
          <div class="label">Saved</div>
          <div class="save-row">
            <jg-input id="save-name" size="sm" placeholder="Name this circuit"></jg-input>
            <jg-button size="sm" variant="outline" id="save">Save</jg-button>
          </div>
          <div class="saved" id="saved"></div>
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
      { id: 'zoom-out', label: 'Zoom out', icon: 'minus', iconOnly: true, title: 'Zoom out', action: () => this.#step(1 / 1.25) },
      { id: 'zoom-fit', label: 'Fit', icon: 'maximize', iconOnly: true, title: 'Fit the board to the view', action: () => { this.#fit(); this.#draw(); } },
      { id: 'zoom-in', label: 'Zoom in', icon: 'plus', iconOnly: true, title: 'Zoom in', action: () => this.#step(1.25) },
      { id: 'rotate', label: 'Rotate', icon: 'rotate', iconOnly: true, title: 'Rotate 90 degrees (R)', action: () => this.#turn(90) },
      { id: 'flip', label: 'Flip', icon: 'flip', iconOnly: true, title: 'Mirror left to right (F)', action: () => this.#mirror() },
      { id: 'delete', label: 'Delete', icon: 'eraser', iconOnly: true, title: 'Delete the selection', action: () => this.#remove() },
      { spacer: true },
      { id: 'import', label: 'Open file', icon: 'upload', iconOnly: true, title: 'Open a circuit from a file', action: () => this.#importFile() },
      { id: 'export', label: 'Save file', icon: 'download', iconOnly: true, title: 'Save this circuit to a file', action: () => this.#exportFile() },
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
      <div class="group">Blocks</div>
      ${['decoder', 'encoder', 'mux', 'demux'].map((kind) => this.#toolButton(kind))}
      <div class="group">Wiring</div>
      ${['node'].map((kind) => this.#toolButton(kind))}
      <div class="group">Output</div>
      ${['led', 'seven', 'matrix'].map((kind) => this.#toolButton(kind))}
    `;

    this.bind('.tool', 'click', (event) => this.#setTool(event.currentTarget.dataset.tool));
    this.bind('[data-sample]', 'click', (event) => {
      const key = event.currentTarget.dataset.sample;
      this.#load(key);
      this.#designs.setOpen(null);
      this.#nameField();
      this.#savedList();
      this.#inspector();
      this.#draw();
    });
    this.bind('#save', 'click', () => this.#saveNamed());
    this.on(this.$('#save-name'), 'keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.#saveNamed();
    });
    this.#nameField();
    this.#savedList();

    const canvas = this.$('#view');
    this.on(canvas, 'pointerdown', (event) => this.#down(event));
    this.on(canvas, 'pointermove', (event) => this.#move(event));
    this.on(canvas, 'pointerup', (event) => this.#up(event));
    this.on(
      canvas,
      'wheel',
      (event) => {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          this.#zoomAt(Math.exp(-event.deltaY / 240), event.clientX, event.clientY);
          return;
        }
        if (event.shiftKey) {
          this.#pan.x -= event.deltaY || event.deltaX;
          return;
        }
        this.#pan.x -= event.deltaX;
        this.#pan.y -= event.deltaY;
      },
      { passive: false },
    );
    this.on(canvas, 'dblclick', (event) => {
      const wire = this.#wireAt(this.#point(event));
      if (!wire?.run.link.bend) return;
      this.#snapshot();
      delete wire.run.link.bend;
      this.#draw();
    });

    this.hotkeys((event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        this.#undo();
        return;
      }
      if (event.key === 'Escape') {
        if (this.#wireFrom) {
          event.preventDefault();
          this.#wireFrom = null;
          this.#draw();
          return;
        }
        if (this.#tool === 'select') return;
        event.preventDefault();
        this.#setTool('select');
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        this.#remove();
        return;
      }
      if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        this.#turn(event.shiftKey ? -90 : 90);
        return;
      }
      if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        this.#mirror();
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
          ? 'Drag pin to pin to wire, drag a wire to bend it, drag the board to pan, wheel to scroll, pinch to zoom.'
          : tool === 'wire'
            ? 'Drag between two pins, or click one then the other. Esc goes back to Select.'
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

  #step(factor) {
    const canvas = this.$('#view');
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    this.#zoomAt(factor, box.left + box.width / 2, box.top + box.height / 2);
    this.#draw();
  }

  #turn(degrees) {
    const part = this.#parts.find((entry) => entry.id === this.#selected);
    if (!part) return;
    this.#snapshot();
    part.turn = (((part.turn ?? 0) + degrees) % 360 + 360) % 360;
    this.#draw();
  }

  #mirror() {
    const part = this.#parts.find((entry) => entry.id === this.#selected);
    if (!part) return;
    this.#snapshot();
    part.flip = !part.flip;
    this.#draw();
  }

  #remove() {
    if (this.#selectedLink) {
      this.#snapshot();
      this.#links = this.#links.filter((link) => link !== this.#selectedLink);
      this.#selectedLink = null;
      this.#rebuild();
      this.#inspector();
      this.#draw();
      return;
    }
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
        inverted: part.inverted ?? [],
        inputs: Array.from({ length: this.#inputCount(part) }, (item, index) => index),
        outputs: Array.from({ length: KINDS[part.kind]?.outputs ?? 0 }, (item, index) => index),
      })),
      this.#links,
    );
  }

  #footprint(part) {
    const meta = KINDS[part.kind];
    const rows = meta.rows ?? Math.max(this.#inputCount(part), meta.outputs);
    const height = Math.max(meta.height, rows + 1);
    const turned = (part.turn ?? 0) % 180 !== 0;
    return {
      width: turned ? height : meta.width,
      height: turned ? meta.width : height,
      body: { width: meta.width, height },
    };
  }

  #place(part, local) {
    const turn = ((part.turn ?? 0) % 360 + 360) % 360;
    const body = this.#footprint(part).body;
    let { x, y } = local;
    if (part.flip) x = body.width - x;
    if (turn === 90) return { x: body.height - y, y: x };
    if (turn === 180) return { x: body.width - x, y: body.height - y };
    if (turn === 270) return { x: y, y: body.width - x };
    return { x, y };
  }

  #inputCount(part) {
    return GATES[part.kind]?.wide ? Math.max(2, Math.min(8, part.inputs ?? KINDS[part.kind].inputs)) : KINDS[part.kind].inputs;
  }

  #height(part) {
    return this.#footprint(part).body.height;
  }

  #localPins(part) {
    const body = this.#footprint(part).body;
    const spread = (count, index) => Math.round(((body.height - count + 1) / 2 + index) * 2) / 2;

    if (part.kind === 'matrix') {
      const across = (index) => Math.round(((body.width - MATRIX + 1) / 2 + index) * 2) / 2;
      return [
        ...Array.from({ length: MATRIX }, (item, index) => ({
          pin: `in${index}`,
          face: [-1, 0],
          local: { x: 0, y: spread(MATRIX, index) },
        })),
        ...Array.from({ length: MATRIX }, (item, index) => ({
          pin: `in${MATRIX + index}`,
          face: [0, 1],
          local: { x: across(index), y: body.height },
        })),
      ];
    }

    const inputs = Array.from({ length: this.#inputCount(part) }, (item, index) => ({
      pin: `in${index}`,
      face: [-1, 0],
      local: { x: 0, y: spread(this.#inputCount(part), index) },
    }));
    const outputs = Array.from({ length: KINDS[part.kind].outputs }, (item, index) => ({
      pin: `out${index}`,
      face: [1, 0],
      local: { x: body.width, y: spread(KINDS[part.kind].outputs, index) },
    }));
    return [...inputs, ...outputs];
  }

  #face(part, direction) {
    const turn = ((part.turn ?? 0) % 360 + 360) % 360;
    let [dx, dy] = direction;
    if (part.flip) dx = -dx;
    if (turn === 90) return [-dy, dx];
    if (turn === 180) return [-dx, -dy];
    if (turn === 270) return [dy, -dx];
    return [dx, dy];
  }

  #pins(part) {
    return this.#localPins(part).map((pin) => {
      const spot = this.#place(part, pin.local);
      return { pin: pin.pin, x: part.x + spot.x, y: part.y + spot.y, face: this.#face(part, pin.face) };
    });
  }

  #upright(context, part, anchorX, anchorY, draw) {
    const turn = ((part.turn ?? 0) % 360 + 360) % 360;
    if (!turn && !part.flip) {
      draw();
      return;
    }
    context.save();
    context.translate(anchorX, anchorY);
    if (part.flip) context.scale(-1, 1);
    context.rotate((-turn * Math.PI) / 180);
    context.translate(-anchorX, -anchorY);
    draw();
    context.restore();
  }

  #pinAt(point, reach = 0.85 / this.#zoom) {
    let best = null;
    for (const part of this.#parts) {
      for (const pin of this.#pins(part)) {
        const away = Math.hypot(point[0] - pin.x, point[1] - pin.y);
        if (away < reach && (!best || away < best.away)) best = { part, away, ...pin };
      }
    }
    return best;
  }

  #connect(a, b) {
    if (!a || !b || a.part.id === b.part.id) return false;
    const from = a.pin.startsWith('out') ? a : b;
    const to = a.pin.startsWith('out') ? b : a;
    if (!from.pin.startsWith('out') || !to.pin.startsWith('in')) return false;
    this.#snapshot();
    this.#links = this.#links.filter((link) => link.to !== `${to.part.id}:${to.pin}`);
    this.#links.push({ from: `${from.part.id}:${from.pin}`, to: `${to.part.id}:${to.pin}` });
    this.#rebuild();
    return true;
  }

  #partAt(point) {
    return this.#parts.find((part) => {
      const size = this.#footprint(part);
      return point[0] >= part.x && point[0] <= part.x + size.width && point[1] >= part.y && point[1] <= part.y + size.height;
    });
  }

  #point(event) {
    const rect = this.$('#view').getBoundingClientRect();
    const span = GRID * this.#zoom;
    return [(event.clientX - rect.left - this.#pan.x) / span, (event.clientY - rect.top - this.#pan.y) / span];
  }

  #snap(value) {
    return Math.round(value * 2) / 2;
  }

  #zoomAt(factor, clientX, clientY) {
    const rect = this.$('#view').getBoundingClientRect();
    const at = [clientX - rect.left, clientY - rect.top];
    const next = Math.min(2.6, Math.max(0.35, this.#zoom * factor));
    const ratio = next / this.#zoom;
    this.#pan.x = at[0] - (at[0] - this.#pan.x) * ratio;
    this.#pan.y = at[1] - (at[1] - this.#pan.y) * ratio;
    this.#zoom = next;
  }

  #fit() {
    const canvas = this.$('#view');
    if (!canvas || !this.#parts.length) {
      this.#pan = { x: 0, y: 0 };
      this.#zoom = 1;
      return;
    }
    const bounds = this.#parts.reduce(
      (box, part) => {
        const size = this.#footprint(part);
        return {
          left: Math.min(box.left, part.x),
          top: Math.min(box.top, part.y),
          right: Math.max(box.right, part.x + size.width),
          bottom: Math.max(box.bottom, part.y + size.height),
        };
      },
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
    const pad = 40;
    const width = Math.max(1, (bounds.right - bounds.left) * GRID);
    const height = Math.max(1, (bounds.bottom - bounds.top) * GRID);
    this.#zoom = Math.min(2.6, Math.max(0.35, Math.min((canvas.clientWidth - pad * 2) / width, (canvas.clientHeight - pad * 2) / height)));
    this.#pan = {
      x: (canvas.clientWidth - width * this.#zoom) / 2 - bounds.left * GRID * this.#zoom,
      y: (canvas.clientHeight - height * this.#zoom) / 2 - bounds.top * GRID * this.#zoom,
    };
  }

  #down(event) {
    const raw = this.#point(event);
    const point = [this.#snap(raw[0]), this.#snap(raw[1])];
    this.$('#view').setPointerCapture(event.pointerId);

    if (this.#tool === 'select' || this.#tool === 'wire') {
      const pin = this.#pinAt(raw);
      if (pin) {
        if (this.#wireFrom) {
          this.#connect(this.#wireFrom, pin);
          this.#wireFrom = null;
        } else {
          this.#wireFrom = pin;
          this.#wireStart = raw;
        }
        this.#draw();
        return;
      }
      if (this.#wireFrom) {
        this.#wireFrom = null;
        this.#draw();
        if (this.#tool === 'wire') return;
      }
    }

    if (this.#tool === 'wire') return;

    if (this.#tool === 'select') {
      const part = this.#partAt(raw);
      if (part) {
        this.#selected = part.id;
        this.#selectedLink = null;
        this.#snapshot();
        this.#drag = { part, from: point, origin: [part.x, part.y] };
        if (part.kind === 'toggle' && part.momentary) {
          this.#press = part;
          part.on = true;
          this.#rebuild();
        }
        this.#inspector();
        this.#draw();
        return;
      }

      const wire = this.#wireAt(raw);
      if (wire) {
        this.#selected = null;
        this.#selectedLink = wire.run.link;
        if (wire.run.trunk >= 0 && wire.index === wire.run.trunk) {
          this.#snapshot();
          this.#routeDrag = { link: wire.run.link, axis: wire.run.axis };
        }
        this.#inspector();
        this.#draw();
        return;
      }

      this.#selected = null;
      this.#selectedLink = null;
      this.#panDrag = { from: [event.clientX, event.clientY], origin: { ...this.#pan } };
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
    this.#selectedLink = null;
    this.#rebuild();
    this.#setTool('select');
    this.#inspector();
    this.#draw();
  }

  #move(event) {
    if (this.#panDrag) {
      this.#pan = {
        x: this.#panDrag.origin.x + (event.clientX - this.#panDrag.from[0]),
        y: this.#panDrag.origin.y + (event.clientY - this.#panDrag.from[1]),
      };
      return;
    }

    const raw = this.#point(event);
    this.#hover = this.#wireFrom ? raw : [this.#snap(raw[0]), this.#snap(raw[1])];
    this.#hoverPin = this.#drag || this.#routeDrag ? null : this.#pinAt(raw);
    this.$('#view').dataset.pin = String(Boolean(this.#hoverPin));

    if (this.#routeDrag) {
      this.#routeDrag.link.bend = this.#snap(raw[this.#routeDrag.axis === 'x' ? 0 : 1]);
      return;
    }

    if (this.#drag) {
      const { part, from, origin } = this.#drag;
      const at = [this.#snap(raw[0]), this.#snap(raw[1])];
      part.x = origin[0] + (at[0] - from[0]);
      part.y = origin[1] + (at[1] - from[1]);
    }
  }

  #up(event) {
    const drag = this.#drag;
    if (this.#press) {
      this.#press.on = false;
      this.#press = null;
      this.#rebuild();
      this.#inspector();
    } else if (drag?.part.kind === 'toggle' && drag.part.x === drag.origin[0] && drag.part.y === drag.origin[1]) {
      drag.part.on = !drag.part.on;
      this.#rebuild();
      this.#inspector();
    }
    this.#drag = null;
    this.#panDrag = null;
    this.#routeDrag = null;
    if (this.#wireFrom && this.#wireStart) {
      const raw = this.#point(event);
      const moved = Math.hypot(raw[0] - this.#wireStart[0], raw[1] - this.#wireStart[1]) > 0.5;
      if (moved) {
        this.#connect(this.#wireFrom, this.#pinAt(raw));
        this.#wireFrom = null;
      }
    }
    this.#draw();
  }

  #loop() {
    const watch = new MutationObserver(() => {
      this.#paint = null;
      this.#grid = null;
    });
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    this.track(() => watch.disconnect());

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
    if (this.#paint) return this.#paint;
    const styles = getComputedStyle(this);
    this.#paint = {
      line: styles.getPropertyValue('--foreground').trim() || '#111',
      soft: styles.getPropertyValue('--muted-foreground').trim() || '#888',
      border: styles.getPropertyValue('--border').trim() || '#ddd',
      ring: styles.getPropertyValue('--ring').trim() || '#8a1c3b',
      card: styles.getPropertyValue('--card').trim() || '#fff',
      font: styles.getPropertyValue('--font-sans') || 'sans-serif',
      mono: styles.getPropertyValue('--font-mono') || 'monospace',
      live: '#4a9d6b',
    };
    return this.#paint;
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

    this.#gridFill(context, width, height, paint);

    context.translate(this.#pan.x, this.#pan.y);
    context.scale(this.#zoom, this.#zoom);

    this.#drawWires(context, paint);

    this.#parts.forEach((part) => this.#drawPart(context, part, paint));

    if (this.#hoverPin) {
      context.beginPath();
      context.arc(this.#hoverPin.x * GRID, this.#hoverPin.y * GRID, 7, 0, Math.PI * 2);
      context.fillStyle = `color-mix(in srgb, ${paint.ring} 28%, transparent)`;
      context.fill();
      context.strokeStyle = paint.ring;
      context.lineWidth = 1.6;
      context.stroke();
    }

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

  #gridFill(context, width, height, paint) {
    const tone = paint.soft;
    if (this.#grid?.tone !== tone) {
      const tile = (size, radius, alpha) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const brush = canvas.getContext('2d');
        brush.fillStyle = tone;
        brush.globalAlpha = alpha;
        brush.beginPath();
        brush.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
        brush.fill();
        return canvas;
      };
      this.#grid = {
        tone,
        minor: context.createPattern(tile(GRID, 1, 0.45), 'repeat'),
        major: context.createPattern(tile(GRID * 5, 1.8, 0.6), 'repeat'),
      };
    }

    const place = (size) =>
      new DOMMatrix().translateSelf(this.#pan.x - (size * this.#zoom) / 2, this.#pan.y - (size * this.#zoom) / 2).scaleSelf(this.#zoom);

    this.#grid.minor.setTransform(place(GRID));
    context.fillStyle = this.#grid.minor;
    context.fillRect(0, 0, width, height);

    this.#grid.major.setTransform(place(GRID * 5));
    context.fillStyle = this.#grid.major;
    context.fillRect(0, 0, width, height);
  }

  #routes() {
    const runs = [];
    const columns = new Map();

    const drawn = this.#links
      .map((link) => ({ link, from: this.#pinPoint(link.from), to: this.#pinPoint(link.to) }))
      .filter((entry) => entry.from && entry.to);

    drawn.forEach(({ link, from, to }) => {
      const column = Math.round((from.x + to.x) / 2);
      if (!columns.has(column)) columns.set(column, []);
      const sources = columns.get(column);
      if (!sources.includes(link.from)) sources.push(link.from);
    });

    drawn.forEach(({ link, from, to }) => {
      const source = link.from;
      const ax = from.x * GRID;
      const ay = from.y * GRID;
      const bx = to.x * GRID;
      const by = to.y * GRID;

      const column = Math.round((from.x + to.x) / 2);
      const sources = columns.get(column);
      const lane = sources.indexOf(source) - (sources.length - 1) / 2;
      const stub = 12;

      const outFace = from.face ?? [1, 0];
      const inFace = to.face ?? [-1, 0];
      const p1 = [ax + outFace[0] * stub, ay + outFace[1] * stub];
      const p2 = [bx + inFace[0] * stub, by + inFace[1] * stub];
      const flatOut = outFace[1] === 0;
      const flatIn = inFace[1] === 0;

      const path = [[ax, ay], p1];
      let trunk = -1;
      let axis = 'x';

      if (flatOut && flatIn && (p2[0] - p1[0]) * outFace[0] >= 0) {
        const midX = link.bend != null ? link.bend * GRID : column * GRID + lane * 7;
        path.push([midX, p1[1]], [midX, p2[1]]);
        trunk = 2;
        axis = 'x';
      } else if (flatOut !== flatIn) {
        path.push(flatOut ? [p2[0], p1[1]] : [p1[0], p2[1]]);
      } else {
        const midY = link.bend != null ? link.bend * GRID : Math.round((p1[1] + p2[1]) / 2 / GRID) * GRID + lane * 7;
        path.push([p1[0], midY], [p2[0], midY]);
        trunk = 2;
        axis = 'y';
      }

      path.push(p2, [bx, by]);

      const segments = path
        .slice(1)
        .map((point, index) => ({ x1: path[index][0], y1: path[index][1], x2: point[0], y2: point[1] }));

      runs.push({
        link,
        trunk,
        axis,
        live: this.#logic.value(Number(source.split(':')[0]), source.split(':')[1]),
        source,
        segments: segments.filter((part) => part.x1 !== part.x2 || part.y1 !== part.y2),
      });
    });

    return runs;
  }

  #wireAt(point) {
    const px = point[0] * GRID;
    const py = point[1] * GRID;
    const reach = 7 / this.#zoom;
    let best = null;
    this.#routes().forEach((run) => {
      run.segments.forEach((segment, index) => {
        const dx = segment.x2 - segment.x1;
        const dy = segment.y2 - segment.y1;
        const span = dx * dx + dy * dy;
        const along = span ? Math.max(0, Math.min(1, ((px - segment.x1) * dx + (py - segment.y1) * dy) / span)) : 0;
        const away = Math.hypot(px - (segment.x1 + along * dx), py - (segment.y1 + along * dy));
        if (away < reach && (!best || away < best.away)) best = { run, index, away };
      });
    });
    return best;
  }

  #drawWires(context, paint) {
    const runs = this.#routes();

    const horizontals = runs.flatMap((run) => run.segments.filter((part) => part.y1 === part.y2).map((part) => ({ ...part, source: run.source })));
    const verticals = runs.flatMap((run) => run.segments.filter((part) => part.x1 === part.x2).map((part) => ({ ...part, source: run.source })));

    runs.forEach((run) => {
      const picked = run.link === this.#selectedLink;
      context.strokeStyle = picked ? paint.ring : run.live ? paint.live : paint.soft;
      context.lineWidth = picked ? 3 : run.live ? 2.4 : 1.7;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      run.segments.forEach((part) => {
        if (part.y1 !== part.y2) {
          context.beginPath();
          context.moveTo(part.x1, part.y1);
          context.lineTo(part.x2, part.y2);
          context.stroke();
          return;
        }

        const left = Math.min(part.x1, part.x2);
        const right = Math.max(part.x1, part.x2);
        const hops = verticals
          .filter((cross) => cross.source !== part.source)
          .filter((cross) => cross.x1 > left + 6 && cross.x1 < right - 6)
          .filter((cross) => part.y1 > Math.min(cross.y1, cross.y2) + 2 && part.y1 < Math.max(cross.y1, cross.y2) - 2)
          .map((cross) => cross.x1)
          .sort((a, b) => a - b);

        context.beginPath();
        context.moveTo(part.x1, part.y1);
        let cursor = left;
        const forward = part.x2 >= part.x1;
        (forward ? hops : [...hops].reverse()).forEach((at) => {
          if (forward) {
            context.lineTo(at - 5, part.y1);
            context.arc(at, part.y1, 5, Math.PI, 0, true);
            cursor = at + 5;
          } else {
            context.lineTo(at + 5, part.y1);
            context.arc(at, part.y1, 5, 0, Math.PI, true);
            cursor = at - 5;
          }
        });
        void cursor;
        context.lineTo(part.x2, part.y2);
        context.stroke();
      });
    });

    const fanned = new Map();
    this.#links.forEach((link) => fanned.set(link.from, (fanned.get(link.from) ?? 0) + 1));
    fanned.forEach((count, key) => {
      if (count < 2) return;
      const point = this.#pinPoint(key);
      if (!point) return;
      const live = this.#logic.value(Number(key.split(':')[0]), key.split(':')[1]);
      context.beginPath();
      context.arc(point.x * GRID, point.y * GRID, 4, 0, Math.PI * 2);
      context.fillStyle = live ? paint.live : paint.soft;
      context.fill();
    });

    void horizontals;
  }

  #pinPoint(key) {
    const [id, pin] = key.split(':');
    const part = this.#parts.find((entry) => entry.id === Number(id));
    if (!part) return null;
    return this.#pins(part).find((entry) => entry.pin === pin) ?? null;
  }

  #drawPart(context, part, paint) {
    const meta = KINDS[part.kind];
    const size = this.#footprint(part);
    const x = part.x * GRID;
    const y = part.y * GRID;
    const width = size.body.width * GRID;
    const height = size.body.height * GRID;
    const selected = part.id === this.#selected;

    context.save();
    context.lineWidth = selected ? 2.4 : 1.7;
    context.strokeStyle = selected ? paint.ring : paint.line;
    context.fillStyle = paint.card;

    const turn = ((part.turn ?? 0) % 360 + 360) % 360;
    context.translate(x, y);
    if (turn === 90) context.transform(0, 1, -1, 0, size.width * GRID, 0);
    else if (turn === 180) context.transform(-1, 0, 0, -1, size.width * GRID, size.height * GRID);
    else if (turn === 270) context.transform(0, -1, 1, 0, 0, size.height * GRID);
    if (part.flip) context.transform(-1, 0, 0, 1, width, 0);
    context.translate(-x, -y);

    this.#localPins(part).forEach((pin) => {
      const live = this.#logic.value(part.id, pin.pin);
      const inbound = pin.pin.startsWith('in');
      const at = [x + pin.local.x * GRID, y + pin.local.y * GRID];
      context.beginPath();
      context.moveTo(at[0] + (inbound ? 8 : -8), at[1]);
      context.lineTo(at[0], at[1]);
      context.strokeStyle = live ? paint.live : paint.soft;
      context.lineWidth = live ? 2.4 : 1.6;
      context.stroke();
      context.beginPath();
      context.arc(at[0], at[1], 3, 0, Math.PI * 2);
      context.fillStyle = live ? paint.live : paint.soft;
      context.fill();
    });

    context.strokeStyle = selected ? paint.ring : paint.line;
    context.lineWidth = selected ? 2.4 : 1.7;
    context.fillStyle = paint.card;

    if (part.kind === 'node') {
      const live = this.#logic.value(part.id, 'in0');
      const side = 11;
      context.beginPath();
      context.roundRect(x + width / 2 - side / 2, y + height / 2 - side / 2, side, side, 2);
      context.fillStyle = live ? paint.live : paint.soft;
      context.fill();
      if (part.id === this.#selected) {
        context.beginPath();
        context.roundRect(x + width / 2 - side, y + height / 2 - side, side * 2, side * 2, 4);
        context.strokeStyle = paint.ring;
        context.stroke();
      }
    } else if (part.kind === 'led') {
      const on = this.#logic.value(part.id, 'in0');
      context.beginPath();
      context.arc(x + width / 2, y + height / 2, 13, 0, Math.PI * 2);
      context.fillStyle = on ? '#e0483d' : paint.card;
      context.fill();
      context.stroke();
    } else if (part.kind === 'toggle' && part.momentary) {
      context.beginPath();
      context.roundRect(x + 6, y + 8, width - 12, height - 16, 6);
      context.fillStyle = paint.card;
      context.fill();
      context.stroke();
      context.beginPath();
      context.arc(x + width / 2, y + height / 2, part.on ? 8 : 9.5, 0, Math.PI * 2);
      context.fillStyle = part.on ? paint.live : paint.card;
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
    } else if (part.kind === 'matrix') {
      this.#drawMatrix(context, part, x, y, width, height, paint);
    } else if (part.kind === 'seven') {
      this.#drawSeven(context, part, x, y, width, height, paint);
    } else if (GATES[part.kind]) {
      this.#drawGate(context, part.kind, x, y, width, height, paint, part);
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
      const baseline = y + height / 2 - (PIN_NAMES[part.kind] ? 2 : 0);
      this.#upright(context, part, x + width / 2, baseline, () => context.fillText(label, x + width / 2, baseline));
    }

    this.#drawPinNames(context, part, x, y, width, paint);

    context.restore();
  }

  #drawPinNames(context, part, x, y, width, paint) {
    const names = PIN_NAMES[part.kind];
    if (!names) return;
    context.fillStyle = paint.soft;
    context.font = `600 9.5px ${paint.mono}`;
    context.textBaseline = 'middle';

    this.#localPins(part).forEach((pin) => {
      const name = names[pin.pin];
      if (!name) return;
      const inbound = pin.pin.startsWith('in');
      const at = inbound ? x + 10 : x + width - 10;
      const down = y + pin.local.y * GRID;
      this.#upright(context, part, at, down, () => {
        context.textAlign = inbound ? 'left' : 'right';
        context.fillText(name, at, down);
      });
    });

    if (part.kind === 'dff' || part.kind === 'tff' || part.kind === 'counter') {
      const clock = this.#localPins(part).find((pin) => names[pin.pin] === 'CLK');
      if (clock) {
        const down = y + clock.local.y * GRID;
        context.strokeStyle = paint.soft;
        context.lineWidth = 1.4;
        context.beginPath();
        context.moveTo(x + 5, down - 4);
        context.lineTo(x + 9, down);
        context.lineTo(x + 5, down + 4);
        context.stroke();
      }
    }
  }

  #drawGate(context, kind, x, y, width, height, paint, part) {
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

    if (part) {
      this.#localPins(part)
        .filter((pin) => pin.pin.startsWith('in'))
        .forEach((pin, index) => {
          if (!part.inverted?.[index]) return;
          context.beginPath();
          context.arc(left - 4.5, y + pin.local.y * GRID, 4.5, 0, Math.PI * 2);
          context.fillStyle = paint.card;
          context.fill();
          context.stroke();
        });
    }

    context.fillStyle = paint.soft;
    context.font = `500 9px ${paint.mono}`;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    this.#upright(context, part, x + width / 2, bottom + 11, () => context.fillText(GATES[kind].label, x + width / 2, bottom + 11));
  }

  #drawMatrix(context, part, x, y, width, height, paint) {
    context.fillStyle = '#15181d';
    context.beginPath();
    context.roundRect(x + 4, y + 5, width - 8, height - 10, 7);
    context.fill();
    context.strokeStyle = part.id === this.#selected ? paint.ring : '#2a2f38';
    context.stroke();

    const pins = this.#localPins(part);
    const inner = Math.min(width - 24, height - 26);
    const left = x + (width - inner) / 2;
    const top = y + (height - inner) / 2;
    const step = inner / (MATRIX - 1);
    const dot = Math.min(step * 0.34, 6);

    for (let row = 0; row < MATRIX; row += 1) {
      const hot = this.#logic.value(part.id, pins[row].pin);
      for (let column = 0; column < MATRIX; column += 1) {
        const lit = hot && this.#logic.value(part.id, pins[MATRIX + column].pin);
        context.beginPath();
        context.arc(left + column * step, top + row * step, dot, 0, Math.PI * 2);
        context.fillStyle = lit ? '#ff5a4d' : '#23272f';
        context.fill();
      }
    }
  }

  #drawSeven(context, part, x, y, width, height, paint) {
    const bits = [0, 1, 2, 3].reduce((sum, index) => sum + (this.#logic.value(part.id, `in${index}`) ? 1 << index : 0), 0);
    const lit = SEGMENTS[bits] ?? '';

    context.fillStyle = '#15181d';
    context.beginPath();
    context.roundRect(x + 4, y + 6, width - 8, height - 12, 7);
    context.fill();
    context.strokeStyle = part.id === this.#selected ? paint.ring : '#2a2f38';
    context.stroke();

    const padX = 22;
    const padY = 22;
    const left = x + padX;
    const right = x + width - padX;
    const top = y + padY;
    const bottom = y + height - padY - 8;
    const midY = (top + bottom) / 2;
    const thick = Math.max(5, (right - left) * 0.16);
    const gap = 2.4;

    const bar = (name, points) => {
      context.beginPath();
      points.forEach(([px, py], index) => (index ? context.lineTo(px, py) : context.moveTo(px, py)));
      context.closePath();
      context.fillStyle = lit.includes(name) ? '#ff5a4d' : '#23272f';
      context.fill();
    };

    const horizontal = (name, cy) => {
      const half = thick / 2;
      bar(name, [
        [left + half + gap, cy - half],
        [right - half - gap, cy - half],
        [right - gap, cy],
        [right - half - gap, cy + half],
        [left + half + gap, cy + half],
        [left + gap, cy],
      ]);
    };

    const vertical = (name, cx, fromY, toY) => {
      const half = thick / 2;
      bar(name, [
        [cx - half, fromY + half + gap],
        [cx, fromY + gap],
        [cx + half, fromY + half + gap],
        [cx + half, toY - half - gap],
        [cx, toY - gap],
        [cx - half, toY - half - gap],
      ]);
    };

    const centreX = (left + right) / 2;
    context.save();
    context.translate(centreX, midY);
    context.transform(1, 0, -0.09, 1, 0, 0);
    context.translate(-centreX, -midY);
    horizontal('a', top);
    horizontal('g', midY);
    horizontal('d', bottom);
    vertical('f', left, top, midY);
    vertical('b', right, top, midY);
    vertical('e', left, midY, bottom);
    vertical('c', right, midY, bottom);
    context.restore();

    context.fillStyle = paint.soft;
    context.font = `600 10px ${paint.mono}`;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    this.#upright(context, part, x + width / 2, y + height - 10, () =>
      context.fillText(bits.toString(16).toUpperCase(), x + width / 2, y + height - 10));
    this.#drawPinNames(context, part, x, y, width, paint);
  }

  #inspector() {
    const part = this.#parts.find((entry) => entry.id === this.#selected);
    const target = this.$('#inspector');
    if (!target) return;
    if (!part && this.#selectedLink) {
      const link = this.#selectedLink;
      target.innerHTML = html`
        <div class="label">Wire</div>
        <div class="hint">Drag the middle of a wire to move its bend. Double click it to straighten.</div>
        <jg-button size="sm" variant="outline" id="straighten">Straighten</jg-button>
        <jg-button size="sm" variant="outline" id="cut">Remove wire</jg-button>
      `;
      target.querySelector('#straighten')?.addEventListener('click', () => {
        this.#snapshot();
        delete link.bend;
        this.#draw();
      });
      target.querySelector('#cut')?.addEventListener('click', () => this.#remove());
      return;
    }
    if (!part) {
      target.innerHTML = html`<div class="hint">Pick a part to change it, or drop a new one from the palette.</div>`;
      return;
    }
    const gate = GATES[part.kind];
    target.innerHTML = html`
      <div class="label">${KINDS[part.kind]?.label ?? part.kind}</div>
      ${gate?.wide
        ? html`<jg-field label="Inputs">
              <jg-input id="inputs" size="sm" type="number" min="2" max="8" value="${this.#inputCount(part)}"></jg-input>
            </jg-field>
            <div class="stack tight">
              <span class="hint">Invert an input</span>
              ${Array.from({ length: this.#inputCount(part) }, (item, index) => html`<label class="row tight" style="gap:6px">
                <input type="checkbox" data-invert="${index}" ${part.inverted?.[index] ? 'checked' : ''} />
                <span class="hint">input ${String.fromCharCode(65 + index)}</span>
              </label>`)}
            </div>`
        : ''}
      ${part.kind === 'clock'
        ? html`<jg-field label="Rate"><jg-input id="rate" size="sm" type="number" value="${part.value}" min="0.2" max="30" step="0.1"></jg-input></jg-field>`
        : ''}
      ${part.kind === 'toggle'
        ? html`<div class="row"><jg-switch id="on" ${part.on ? 'checked' : ''}></jg-switch><span class="hint">Closed</span></div>
            <label class="row tight" style="gap:6px">
              <input type="checkbox" id="momentary" ${part.momentary ? 'checked' : ''} />
              <span class="hint">Push button, on only while held</span>
            </label>`
        : ''}
      <jg-button size="sm" variant="outline" id="drop">Remove part</jg-button>
    `;
    const inputs = this.$('#inputs');
    if (inputs) {
      this.on(inputs, 'change', () => {
        this.#snapshot();
        part.inputs = Math.max(2, Math.min(8, Number(inputs.value) || 2));
        part.inverted = (part.inverted ?? []).slice(0, part.inputs);
        this.#links = this.#links.filter((link) => {
          const [id, pin] = link.to.split(':');
          if (Number(id) !== part.id || !pin.startsWith('in')) return true;
          return Number(pin.slice(2)) < part.inputs;
        });
        this.#rebuild();
        this.#inspector();
        this.#draw();
      });
    }
    this.$$('[data-invert]').forEach((box) => {
      this.on(box, 'change', () => {
        this.#snapshot();
        part.inverted = part.inverted ?? [];
        part.inverted[Number(box.dataset.invert)] = box.checked;
        this.#rebuild();
        this.#draw();
      });
    });

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
    const momentary = this.$('#momentary');
    if (momentary) {
      this.on(momentary, 'change', () => {
        this.#snapshot();
        part.momentary = momentary.checked;
        if (part.momentary) part.on = false;
        this.#rebuild();
        this.#inspector();
        this.#draw();
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

    const count = this.#inputCount(part);
    if (count > 4) {
      if (target.dataset.kind !== 'wide') {
        target.dataset.kind = 'wide';
        target.innerHTML = html`<div class="hint">${count} inputs is too many rows to show.</div>`;
      }
      return;
    }
    const invert = (bits) => bits.map((bit, index) => bit !== Boolean(part.inverted?.[index]));
    const bits = Array.from({ length: count }, (item, index) => this.#logic.value(part.id, `in${index}`));
    const rows = [];
    for (let value = 0; value < 2 ** count; value += 1) {
      const inputs = Array.from({ length: count }, (item, index) => Boolean((value >> (count - 1 - index)) & 1));
      rows.push({ inputs, out: gate.apply(invert(inputs)) });
    }
    const now = bits.reduce((sum, bit, index) => sum + (bit ? 1 << (count - 1 - index) : 0), 0);

    const signature = `${part.kind}:${count}:${(part.inverted ?? []).join('')}:${now}`;
    if (target.dataset.kind === signature) return;
    target.dataset.kind = signature;
    target.innerHTML = html`<table class="truth">
      <tr>${Array.from({ length: count }, (item, index) => html`<th>${String.fromCharCode(65 + index)}${part.inverted?.[index] ? '̅' : ''}</th>`)}<th>Q</th></tr>
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
