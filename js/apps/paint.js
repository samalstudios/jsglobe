import { JGApp, define, html, css } from '../core/app.js';
import { download, pickFile } from '../core/util.js';
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
  .head jg-toolbar,
  .tools { --icon-accent: currentColor; }

  .body { flex: 1; min-height: 0; display: flex; }

  .tools {
    display: grid;
    grid-template-columns: repeat(2, 34px);
    gap: 4px;
    align-content: start;
    padding: 10px;
    border-right: 1px solid var(--border);
    flex: none;
  }
  .tool {
    width: 34px;
    height: 32px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--muted-foreground);
    cursor: pointer;
  }
  .tool:hover { color: var(--foreground); border-color: var(--border-strong); }
  .tool[aria-pressed="true"] {
    color: var(--foreground);
    background: color-mix(in srgb, var(--ring) 18%, var(--card));
    border-color: color-mix(in srgb, var(--ring) 60%, transparent);
    box-shadow: var(--shadow-well);
  }

  .stage {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .surface {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    padding: 16px;
    overflow: auto;
    background:
      repeating-conic-gradient(color-mix(in srgb, var(--foreground) 4%, transparent) 0% 25%, transparent 0% 50%)
      50% / 18px 18px;
  }
  .paper {
    position: relative;
    box-shadow: var(--shadow-lg);
    background: #fff;
    line-height: 0;
  }
  canvas { display: block; touch-action: none; cursor: crosshair; }
  #overlay { position: absolute; inset: 0; pointer-events: none; }

  .swatches {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-top: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .current {
    display: grid;
    grid-template-columns: repeat(2, 18px);
    grid-template-rows: repeat(2, 18px);
    flex: none;
  }
  .current i { border: 1px solid var(--border); border-radius: 3px; }
  .current .fore { grid-area: 1 / 1 / 2 / 2; background: var(--fore); z-index: 2; }
  .current .back { grid-area: 2 / 2 / 3 / 3; background: var(--back); }
  .grid-colors { display: grid; grid-template-rows: repeat(2, 16px); grid-auto-flow: column; gap: 3px; }
  .chip {
    width: 16px;
    height: 16px;
    border: 1px solid color-mix(in srgb, var(--foreground) 20%, transparent);
    border-radius: 3px;
    cursor: pointer;
    padding: 0;
  }
  .size-row { display: flex; align-items: center; gap: 6px; }
  .size {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    cursor: pointer;
  }
  .size[aria-pressed="true"] { border-color: var(--ring); background: color-mix(in srgb, var(--ring) 14%, var(--card)); }
  .size i { display: block; border-radius: 999px; background: var(--foreground); }

  .status { margin-left: auto; font: 500 11.5px/1 var(--font-mono); color: var(--muted-foreground); }

  @container (max-width: 640px) {
    .tools { grid-template-columns: repeat(6, 34px); border-right: 0; border-bottom: 1px solid var(--border); }
    .body { flex-direction: column; }
  }
`;

const TOOLS = [
  { id: 'select', label: 'Select an area', icon: 'marquee' },
  { id: 'pencil', label: 'Pencil', icon: 'pencil' },
  { id: 'brush', label: 'Brush', icon: 'brush' },
  { id: 'eraser', label: 'Eraser', icon: 'eraser' },
  { id: 'fill', label: 'Fill with colour', icon: 'bucket' },
  { id: 'picker', label: 'Pick a colour', icon: 'eyedropper' },
  { id: 'spray', label: 'Spray can', icon: 'spray' },
  { id: 'line', label: 'Line', icon: 'line' },
  { id: 'rect', label: 'Rectangle', icon: 'square' },
  { id: 'ellipse', label: 'Ellipse', icon: 'circle' },
  { id: 'text', label: 'Text', icon: 'type' },
];

const PALETTE = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8',
  '#3f48cc', '#a349a4', '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0',
  '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
];

const SIZES = [1, 3, 6, 12];

class Paint extends JGApp {
  static appId = 'paint';
  static settings = [
    { key: 'width', label: 'Canvas width', type: 'number', default: 900, min: 64, max: 4000 },
    { key: 'height', label: 'Canvas height', type: 'number', default: 600, min: 64, max: 4000 },
  ];
  static styles = [...JGApp.styles, sheet];

  #tool = 'pencil';
  #fore = '#000000';
  #back = '#ffffff';
  #size = 3;
  #drawing = false;
  #start = null;
  #last = null;
  #undo = [];
  #redo = [];
  #context = null;
  #preview = null;
  #pending = null;
  #selection = null;

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">Paint</div>
        <div class="hint">Pencil, shapes, fill and spray on a plain canvas.</div>
      </div>
    </div>`);
  }

  renderApp() {
    const width = Number(this.config.get('width', 900));
    const height = Number(this.config.get('height', 600));

    this.paint(html`<div class="app" style="--fore:${this.#fore};--back:${this.#back}">
      <div class="head">
        <jg-toolbar id="bar"></jg-toolbar>
      </div>
      <div class="body">
        <div class="tools" id="tools">
          ${TOOLS.map(
            (tool) => html`<button class="tool" data-tool="${tool.id}" title="${tool.label}" aria-pressed="${String(tool.id === this.#tool)}">
              ${icon(tool.icon, 16)}
            </button>`,
          )}
        </div>
        <div class="stage">
          <div class="surface">
            <div class="paper" id="paper">
              <canvas id="board" width="${width}" height="${height}"></canvas>
              <canvas id="overlay" width="${width}" height="${height}"></canvas>
            </div>
          </div>
          <div class="swatches">
            <div class="current"><i class="fore"></i><i class="back"></i></div>
            <div class="grid-colors">
              ${PALETTE.map((color) => html`<button class="chip" data-color="${color}" style="background:${color}" title="${color}"></button>`)}
            </div>
            <input type="color" id="custom" value="${this.#fore}" title="Custom colour" style="width:28px;height:26px;border:0;background:none" />
            <div class="size-row">
              ${SIZES.map(
                (size) => html`<button class="size" data-size="${size}" aria-pressed="${String(size === this.#size)}" title="${size} px">
                  <i style="width:${Math.min(16, size + 1)}px;height:${Math.min(16, size + 1)}px"></i>
                </button>`,
              )}
            </div>
            <span class="status" id="status">${width} × ${height}</span>
          </div>
        </div>
      </div>

      <jg-sheet id="adjust" side="right" title-text="Adjust image">
        <div class="stack" style="padding:14px;gap:14px">
          <jg-field label="Brightness"><jg-slider id="brightness" min="0" max="200" step="1" value="100"></jg-slider></jg-field>
          <jg-field label="Contrast"><jg-slider id="contrast" min="0" max="200" step="1" value="100"></jg-slider></jg-field>
          <jg-field label="Saturation"><jg-slider id="saturate" min="0" max="200" step="1" value="100"></jg-slider></jg-field>
          <jg-field label="Blur"><jg-slider id="blur" min="0" max="12" step="1" value="0"></jg-slider></jg-field>
          <div class="row">
            <jg-button size="sm" id="apply-adjust">Apply</jg-button>
            <jg-button size="sm" variant="ghost" id="reset-adjust">Reset</jg-button>
            <span class="grow"></span>
            <jg-button size="sm" variant="ghost" id="grayscale">Black and white</jg-button>
          </div>
          <div class="hint">Adjustments preview live and only touch the canvas when you apply them.</div>
        </div>
      </jg-sheet>

      <jg-dialog id="resize" title-text="Resize canvas">
        <div class="stack" style="gap:12px">
          <div class="row">
            <jg-field label="Width"><jg-input id="new-width" type="number" size="sm" value="${width}"></jg-input></jg-field>
            <jg-field label="Height"><jg-input id="new-height" type="number" size="sm" value="${height}"></jg-input></jg-field>
          </div>
          <div class="row"><jg-switch id="keep-ratio" checked></jg-switch><span class="hint">Keep proportions</span></div>
        </div>
        <div slot="actions" class="row">
          <span class="grow"></span>
          <jg-button size="sm" variant="ghost" id="cancel-resize">Cancel</jg-button>
          <jg-button size="sm" id="do-resize">Resize</jg-button>
        </div>
      </jg-dialog>
    </div>`);

    this.$('#bar').items = [
      { id: 'new', label: 'New', icon: 'file', iconOnly: true, title: 'New canvas', action: () => this.#clear() },
      { id: 'open', label: 'Open', icon: 'folder', iconOnly: true, title: 'Open an image', action: () => this.#open() },
      { id: 'insert', label: 'Insert', icon: 'image', iconOnly: true, title: 'Insert an image', action: () => this.#insert() },
      { id: 'save', label: 'Save', icon: 'download', iconOnly: true, title: 'Save as PNG', action: () => this.#save() },
      { separator: true },
      { id: 'undo', label: 'Undo', icon: 'undo', iconOnly: true, title: 'Undo', action: () => this.#step(this.#undo, this.#redo) },
      { id: 'redo', label: 'Redo', icon: 'redo', iconOnly: true, title: 'Redo', action: () => this.#step(this.#redo, this.#undo) },
      { separator: true },
      { id: 'crop', label: 'Crop', icon: 'crop', title: 'Crop to selection', action: () => this.#crop() },
      { id: 'rotate', label: 'Rotate', icon: 'rotate', iconOnly: true, title: 'Rotate right', action: () => this.#rotate(1) },
      { id: 'flip-h', label: 'Flip across', icon: 'flip', iconOnly: true, title: 'Flip horizontally', action: () => this.#flip('h') },
      { id: 'flip-v', label: 'Flip down', icon: 'flip-v', iconOnly: true, title: 'Flip vertically', action: () => this.#flip('v') },
      { id: 'resize', label: 'Resize', icon: 'scale', title: 'Resize the canvas', action: () => this.$('#resize').open() },
      { id: 'adjust', label: 'Adjust', icon: 'gauge', title: 'Brightness, contrast and colour', action: () => this.$('#adjust').open() },
      { spacer: true },
      { id: 'swap', label: 'Swap', icon: 'transform', iconOnly: true, title: 'Swap the two colours', action: () => this.#swap() },
    ];

    const board = this.$('#board');
    this.#context = board.getContext('2d', { willReadFrequently: true });
    this.#preview = this.$('#overlay').getContext('2d');
    this.#context.fillStyle = this.#back;
    this.#context.fillRect(0, 0, width, height);
    this.#fit();

    this.bind('.tool', 'click', (event) => {
      this.#tool = event.currentTarget.dataset.tool;
      this.$$('.tool').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.tool === this.#tool)));
    });
    this.bind('.chip', 'click', (event) => this.#setColor(event.currentTarget.dataset.color));
    this.bind('.chip', 'contextmenu', (event) => {
      event.preventDefault();
      this.#setColor(event.currentTarget.dataset.color, true);
    });
    this.bind('.size', 'click', (event) => {
      this.#size = Number(event.currentTarget.dataset.size);
      this.$$('.size').forEach((node) => node.setAttribute('aria-pressed', String(Number(node.dataset.size) === this.#size)));
    });
    this.on(this.$('#custom'), 'input', (event) => this.#setColor(event.target.value));

    this.on(board, 'pointerdown', (event) => this.#down(event));
    this.on(board, 'pointermove', (event) => this.#move(event));
    this.on(board, 'pointerup', (event) => this.#up(event));
    this.on(board, 'pointerleave', () => {
      if (this.#drawing) this.#up();
    });
    this.on(board, 'contextmenu', (event) => event.preventDefault());
    this.on(board, 'wheel', (event) => {
      if (!this.#pending) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.08 : 0.93;
      const centreX = this.#pending.x + this.#pending.width / 2;
      const centreY = this.#pending.y + this.#pending.height / 2;
      this.#pending.width = Math.max(16, this.#pending.width * factor);
      this.#pending.height = Math.max(16, this.#pending.height * factor);
      this.#pending.x = centreX - this.#pending.width / 2;
      this.#pending.y = centreY - this.#pending.height / 2;
      this.#drawPending();
    });

    this.hotkeys((event) => {
      const key = event.key.toLowerCase();
      if (this.#pending && (event.key === 'Enter' || event.key === 'Escape')) {
        event.preventDefault();
        if (event.key === 'Enter') this.#commit();
        else {
          this.#pending = null;
          this.#preview.clearRect(0, 0, this.$('#overlay').width, this.$('#overlay').height);
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.#step(this.#redo, this.#undo);
        else this.#step(this.#undo, this.#redo);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 's') {
        event.preventDefault();
        this.#save();
        return;
      }
      const shortcut = { p: 'pencil', b: 'brush', e: 'eraser', f: 'fill', l: 'line', r: 'rect', o: 'ellipse', t: 'text', i: 'picker' }[key];
      if (shortcut && !event.metaKey && !event.ctrlKey) {
        this.#tool = shortcut;
        this.$$('.tool').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.tool === this.#tool)));
      }
    });

    const preview = () => {
      this.$('#board').style.filter = this.#filters();
    };
    ['brightness', 'contrast', 'saturate', 'blur'].forEach((id) => this.on(this.$(`#${id}`), 'input', preview));
    this.on(this.$('#grayscale'), 'click', () => {
      this.$('#saturate').value = 0;
      preview();
    });
    this.on(this.$('#reset-adjust'), 'click', () => {
      ['brightness', 'contrast', 'saturate'].forEach((id) => {
        this.$(`#${id}`).value = 100;
      });
      this.$('#blur').value = 0;
      preview();
    });
    this.on(this.$('#apply-adjust'), 'click', () => {
      const board = this.$('#board');
      const filter = this.#filters();
      this.#replace(board.width, board.height, (context) => {
        context.filter = filter;
        context.drawImage(board, 0, 0);
      });
      board.style.filter = '';
      this.$('#reset-adjust').click();
      this.$('#adjust').close();
    });

    this.on(this.$('#new-width'), 'input', () => {
      if (!this.$('#keep-ratio').checked) return;
      const board = this.$('#board');
      this.$('#new-height').value = Math.round(Number(this.$('#new-width').value) * (board.height / board.width));
    });
    this.on(this.$('#cancel-resize'), 'click', () => this.$('#resize').close());
    this.on(this.$('#do-resize'), 'click', () => {
      const board = this.$('#board');
      const next = { width: Number(this.$('#new-width').value), height: Number(this.$('#new-height').value) };
      if (!next.width || !next.height) return;
      this.#replace(next.width, next.height, (context) => {
        context.imageSmoothingQuality = 'high';
        context.drawImage(board, 0, 0, next.width, next.height);
      });
      this.$('#resize').close();
    });

    const observer = new ResizeObserver(() => this.#fit());
    observer.observe(this.$('.surface'));
    this.track(() => observer.disconnect());
  }

  #fit() {
    const surface = this.$('.surface');
    const board = this.$('#board');
    if (!surface || !board) return;
    const scale = Math.min(1, (surface.clientWidth - 32) / board.width, (surface.clientHeight - 32) / board.height);
    const paper = this.$('#paper');
    const width = Math.max(40, Math.round(board.width * scale));
    const height = Math.max(40, Math.round(board.height * scale));
    paper.style.width = `${width}px`;
    paper.style.height = `${height}px`;
    [board, this.$('#overlay')].forEach((canvas) => {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    });
  }

  #setColor(color, secondary = false) {
    if (secondary) this.#back = color;
    else this.#fore = color;
    this.$('.app').style.setProperty(secondary ? '--back' : '--fore', color);
  }

  #swap() {
    const fore = this.#fore;
    this.#setColor(this.#back);
    this.#setColor(fore, true);
  }

  #point(event) {
    const board = this.$('#board');
    const rect = board.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * board.width,
      y: ((event.clientY - rect.top) / rect.height) * board.height,
    };
  }

  #snapshot() {
    const board = this.$('#board');
    this.#undo.push(this.#context.getImageData(0, 0, board.width, board.height));
    if (this.#undo.length > 24) this.#undo.shift();
    this.#redo = [];
  }

  #step(from, to) {
    if (!from.length) return;
    const board = this.$('#board');
    to.push(this.#context.getImageData(0, 0, board.width, board.height));
    this.#context.putImageData(from.pop(), 0, 0);
  }

  #stroke(color) {
    const context = this.#context;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = this.#size;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }

  #down(event) {
    const point = this.#point(event);
    const secondary = event.button === 2;

    if (this.#pending) {
      const { x, y, width, height } = this.#pending;
      if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
        this.#pending.grab = { x: point.x - x, y: point.y - y };
        this.$('#board').setPointerCapture(event.pointerId);
        return;
      }
      this.#commit();
      return;
    }
    const color = secondary ? this.#back : this.#fore;

    if (this.#tool === 'picker') {
      const data = this.#context.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data;
      const hex = `#${[data[0], data[1], data[2]].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
      this.#setColor(hex, secondary);
      return;
    }

    if (this.#tool === 'select') {
      this.#drawing = true;
      this.#start = point;
      this.#last = point;
      this.#selection = { x: point.x, y: point.y, width: 0, height: 0 };
      this.$('#board').setPointerCapture(event.pointerId);
      return;
    }

    this.#snapshot();

    if (this.#tool === 'fill') {
      this.#fill(Math.floor(point.x), Math.floor(point.y), color);
      return;
    }

    if (this.#tool === 'text') {
      const value = prompt('Text to draw');
      if (!value) return;
      this.#context.fillStyle = color;
      this.#context.font = `${Math.max(12, this.#size * 7)}px ${getComputedStyle(this).getPropertyValue('--font-sans') || 'sans-serif'}`;
      this.#context.textBaseline = 'top';
      this.#context.fillText(value, point.x, point.y);
      return;
    }

    this.#drawing = true;
    this.#start = point;
    this.#last = point;
    this.$('#board').setPointerCapture(event.pointerId);

    if (this.#tool === 'pencil' || this.#tool === 'brush' || this.#tool === 'eraser' || this.#tool === 'spray') {
      this.#paintAt(point, point, secondary);
    }
  }

  #move(event) {
    const point = this.#point(event);
    this.$('#status').textContent = `${Math.round(point.x)}, ${Math.round(point.y)}`;

    if (this.#pending?.grab) {
      this.#pending.x = point.x - this.#pending.grab.x;
      this.#pending.y = point.y - this.#pending.grab.y;
      this.#drawPending();
      return;
    }
    if (!this.#drawing) return;
    const secondary = event.buttons === 2;

    if (this.#tool === 'select') {
      this.#selection = {
        x: Math.min(this.#start.x, point.x),
        y: Math.min(this.#start.y, point.y),
        width: Math.abs(point.x - this.#start.x),
        height: Math.abs(point.y - this.#start.y),
      };
      this.#drawSelection();
      return;
    }

    if (this.#tool === 'line' || this.#tool === 'rect' || this.#tool === 'ellipse') {
      this.#drawShape(this.#preview, this.#start, point, secondary, true);
      return;
    }
    this.#paintAt(this.#last, point, secondary);
    this.#last = point;
  }

  #up(event) {
    if (this.#pending?.grab) {
      this.#pending.grab = null;
      return;
    }
    if (!this.#drawing) return;
    this.#drawing = false;
    if (this.#tool === 'select') {
      this.$('#status').textContent = this.#selection?.width
        ? `${Math.round(this.#selection.width)} × ${Math.round(this.#selection.height)} selected`
        : 'no selection';
      return;
    }
    const point = event ? this.#point(event) : this.#last;
    if (this.#tool === 'line' || this.#tool === 'rect' || this.#tool === 'ellipse') {
      this.#preview.clearRect(0, 0, this.$('#overlay').width, this.$('#overlay').height);
      this.#drawShape(this.#context, this.#start, point, false, false);
    }
  }

  #paintAt(from, to, secondary) {
    const context = this.#context;
    const color = this.#tool === 'eraser' ? this.#back : secondary ? this.#back : this.#fore;

    if (this.#tool === 'spray') {
      context.fillStyle = color;
      const radius = this.#size * 3;
      for (let index = 0; index < 26; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        context.fillRect(to.x + Math.cos(angle) * distance, to.y + Math.sin(angle) * distance, 1, 1);
      }
      return;
    }

    this.#stroke(color);
    if (this.#tool === 'brush') context.lineWidth = this.#size * 2.4;
    if (this.#tool === 'eraser') context.lineWidth = this.#size * 3;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  #drawShape(context, from, to, secondary, isPreview) {
    if (!from || !to) return;
    const color = secondary ? this.#back : this.#fore;
    if (isPreview) context.clearRect(0, 0, this.$('#overlay').width, this.$('#overlay').height);
    context.strokeStyle = color;
    context.lineWidth = this.#size;
    context.lineCap = 'round';
    context.beginPath();
    if (this.#tool === 'line') {
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
    } else if (this.#tool === 'rect') {
      context.rect(from.x, from.y, to.x - from.x, to.y - from.y);
    } else {
      context.ellipse(
        (from.x + to.x) / 2,
        (from.y + to.y) / 2,
        Math.abs(to.x - from.x) / 2,
        Math.abs(to.y - from.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
    }
    context.stroke();
  }

  #fill(x, y, color) {
    const board = this.$('#board');
    const image = this.#context.getImageData(0, 0, board.width, board.height);
    const data = image.data;
    const width = board.width;
    const height = board.height;
    const at = (px, py) => (py * width + px) * 4;
    const start = at(x, y);
    const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];

    const parsed = color.replace('#', '');
    const fill = [
      parseInt(parsed.slice(0, 2), 16),
      parseInt(parsed.slice(2, 4), 16),
      parseInt(parsed.slice(4, 6), 16),
      255,
    ];
    if (target.every((value, index) => value === fill[index])) return;

    const matches = (index) =>
      Math.abs(data[index] - target[0]) < 10 &&
      Math.abs(data[index + 1] - target[1]) < 10 &&
      Math.abs(data[index + 2] - target[2]) < 10 &&
      Math.abs(data[index + 3] - target[3]) < 10;

    const stack = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop();
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      let top = py;
      while (top >= 0 && matches(at(px, top))) top -= 1;
      top += 1;
      let spanLeft = false;
      let spanRight = false;
      for (let row = top; row < height && matches(at(px, row)); row += 1) {
        const index = at(px, row);
        data[index] = fill[0];
        data[index + 1] = fill[1];
        data[index + 2] = fill[2];
        data[index + 3] = fill[3];

        if (px > 0 && matches(at(px - 1, row))) {
          if (!spanLeft) {
            stack.push([px - 1, row]);
            spanLeft = true;
          }
        } else spanLeft = false;

        if (px < width - 1 && matches(at(px + 1, row))) {
          if (!spanRight) {
            stack.push([px + 1, row]);
            spanRight = true;
          }
        } else spanRight = false;
      }
    }

    this.#context.putImageData(image, 0, 0);
  }

  #clear() {
    const board = this.$('#board');
    this.#snapshot();
    this.#context.fillStyle = this.#back;
    this.#context.fillRect(0, 0, board.width, board.height);
  }

  async #open() {
    const picked = await pickFile('image/*', false);
    if (!picked?.file) return;
    const bitmap = await createImageBitmap(picked.file);
    const board = this.$('#board');
    this.#snapshot();
    const scale = Math.min(board.width / bitmap.width, board.height / bitmap.height, 1);
    this.#context.drawImage(bitmap, 0, 0, bitmap.width * scale, bitmap.height * scale);
  }

  async #insert() {
    const picked = await pickFile('image/*', false);
    if (!picked?.file) return;
    const bitmap = await createImageBitmap(picked.file);
    const board = this.$('#board');
    const scale = Math.min(1, (board.width * 0.6) / bitmap.width, (board.height * 0.6) / bitmap.height);
    this.#pending = {
      bitmap,
      width: bitmap.width * scale,
      height: bitmap.height * scale,
      x: (board.width - bitmap.width * scale) / 2,
      y: (board.height - bitmap.height * scale) / 2,
      grab: null,
    };
    this.$('#status').textContent = 'Drag to place, scroll to resize, Enter to drop';
    this.#drawPending();
  }

  #drawPending() {
    const overlay = this.$('#overlay');
    this.#preview.clearRect(0, 0, overlay.width, overlay.height);
    if (!this.#pending) return;
    const { bitmap, x, y, width, height } = this.#pending;
    this.#preview.drawImage(bitmap, x, y, width, height);
    this.#preview.strokeStyle = getComputedStyle(this).getPropertyValue('--ring').trim() || '#8a1c3b';
    this.#preview.setLineDash([6, 5]);
    this.#preview.lineWidth = 2;
    this.#preview.strokeRect(x, y, width, height);
    this.#preview.setLineDash([]);
  }

  #commit() {
    if (!this.#pending) return;
    const { bitmap, x, y, width, height } = this.#pending;
    this.#snapshot();
    this.#context.drawImage(bitmap, x, y, width, height);
    this.#pending = null;
    const overlay = this.$('#overlay');
    this.#preview.clearRect(0, 0, overlay.width, overlay.height);
  }

  #drawSelection() {
    const overlay = this.$('#overlay');
    this.#preview.clearRect(0, 0, overlay.width, overlay.height);
    if (!this.#selection) return;
    const { x, y, width, height } = this.#selection;
    this.#preview.fillStyle = 'rgba(0,0,0,0.28)';
    this.#preview.fillRect(0, 0, overlay.width, overlay.height);
    this.#preview.clearRect(x, y, width, height);
    this.#preview.strokeStyle = getComputedStyle(this).getPropertyValue('--ring').trim() || '#8a1c3b';
    this.#preview.setLineDash([6, 4]);
    this.#preview.lineWidth = 1.6;
    this.#preview.strokeRect(x, y, width, height);
    this.#preview.setLineDash([]);
  }

  #replace(width, height, paint) {
    const board = this.$('#board');
    const overlay = this.$('#overlay');
    const buffer = document.createElement('canvas');
    buffer.width = Math.max(1, Math.round(width));
    buffer.height = Math.max(1, Math.round(height));
    paint(buffer.getContext('2d'), buffer);

    this.#snapshot();
    board.width = buffer.width;
    board.height = buffer.height;
    overlay.width = buffer.width;
    overlay.height = buffer.height;
    this.#context = board.getContext('2d', { willReadFrequently: true });
    this.#preview = overlay.getContext('2d');
    this.#context.drawImage(buffer, 0, 0);
    this.#undo = [];
    this.#redo = [];
    this.#selection = null;
    this.#fit();
    this.$('#status').textContent = `${board.width} × ${board.height}`;
  }

  #crop() {
    const area = this.#selection;
    if (!area || area.width < 4 || area.height < 4) {
      this.$('#status').textContent = 'Select an area first';
      return;
    }
    const board = this.$('#board');
    this.#replace(area.width, area.height, (context) => {
      context.drawImage(board, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
    });
  }

  #rotate(turns) {
    const board = this.$('#board');
    const width = board.height;
    const height = board.width;
    this.#replace(width, height, (context) => {
      context.translate(width / 2, height / 2);
      context.rotate((Math.PI / 2) * turns);
      context.drawImage(board, -board.width / 2, -board.height / 2);
    });
  }

  #flip(axis) {
    const board = this.$('#board');
    this.#replace(board.width, board.height, (context) => {
      context.translate(axis === 'h' ? board.width : 0, axis === 'v' ? board.height : 0);
      context.scale(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1);
      context.drawImage(board, 0, 0);
    });
  }

  #filters() {
    const value = (id) => Number(this.$(`#${id}`)?.value ?? 100);
    return `brightness(${value('brightness')}%) contrast(${value('contrast')}%) saturate(${value('saturate')}%) blur(${Number(this.$('#blur')?.value ?? 0)}px)`;
  }

  #save() {
    this.$('#board').toBlob((blob) => download('painting.png', blob));
  }
}

define('jg-app-paint', Paint);
