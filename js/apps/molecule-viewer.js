import { JGApp, define, html, css } from '../core/app.js';
import { molecules, GROUPS, ATOM, fallbackAtom } from '../lib/molecules.js';
import { createGlRenderer } from '../lib/gl-molecule.js';
import { settings } from '../core/settings.js';
import { download, copyText } from '../core/util.js';

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
  .head jg-toolbar { min-width: 0; flex: 1; }

  .body { flex: 1; min-height: 0; display: flex; }

  .list {
    width: 208px;
    flex: none;
    border-right: 1px solid var(--border);
    overflow: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .group {
    padding: 10px 8px 4px;
    font: 600 10.5px/1 var(--font-sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .entry {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 7px 9px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground);
    font: 500 12.5px/1.2 var(--font-sans);
    text-align: left;
    cursor: pointer;
  }
  .entry:hover { background: var(--accent); }
  .entry[aria-current="true"] { background: color-mix(in srgb, var(--ring) 16%, transparent); font-weight: 600; }
  .entry .fx { font: 400 10.5px/1 var(--font-mono); color: var(--muted-foreground); margin-left: auto; }

  .stage { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .canvas-wrap {
    position: relative;
    flex: 1;
    min-height: 0;
    background:
      radial-gradient(120% 110% at 50% 0%, color-mix(in srgb, var(--foreground) 4%, transparent), transparent 70%),
      var(--muted);
  }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
  canvas[hidden] { display: none; }
  .canvas-wrap { cursor: grab; }
  .canvas-wrap:active { cursor: grabbing; }
  .hud {
    position: absolute;
    left: 14px;
    top: 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    pointer-events: none;
  }
  .hud .name { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
  .hud .fx { font: 500 12px/1 var(--font-mono); color: var(--muted-foreground); }
  .legend {
    position: absolute;
    right: 14px;
    top: 12px;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px 10px;
    max-width: 45%;
    pointer-events: none;
  }
  .legend span { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted-foreground); }
  .legend i { width: 9px; height: 9px; border-radius: 999px; background: var(--tone); }

  .info {
    border-top: 1px solid var(--border);
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .info .note { flex: 1; min-width: 220px; font-size: 12.5px; color: var(--muted-foreground); }
  .stat { display: flex; flex-direction: column; gap: 1px; }
  .stat b { font: 600 13px/1 var(--font-sans); }
  .stat span { font-size: 11px; color: var(--muted-foreground); }

  @container (max-width: 760px) {
    .body { flex-direction: column; }
    .list { width: auto; max-height: 132px; border-right: 0; border-bottom: 1px solid var(--border); flex-direction: row; flex-wrap: wrap; }
    .group { width: 100%; }
    .legend { display: none; }
  }
`;

const STYLES = [
  { value: 'ball', label: 'Ball and stick' },
  { value: 'space', label: 'Space filling' },
  { value: 'stick', label: 'Sticks' },
  { value: 'diagram', label: 'Flat diagram' },
];

const SHAPE = {
  ball: { atomScale: 0.5, bondRadius: 0.1, vdw: false },
  space: { atomScale: 1, bondRadius: 0, vdw: true },
  stick: { atomScale: 0.16, bondRadius: 0.16, vdw: false },
};

const helix = () => {
  const elements = [];
  const coords = [];
  const bonds = [];
  for (let index = 0; index < 26; index += 1) {
    const angle = (index * 100 * Math.PI) / 180;
    elements.push(index % 2 === 0 ? 'C' : 'N');
    coords.push([2.3 * Math.cos(angle), 2.3 * Math.sin(angle), index * 1.5 - 19]);
    if (index) bonds.push([index - 1, index, 1]);
  }
  return {
    key: 'alpha-helix',
    name: 'Alpha helix',
    group: 'Proteins',
    formula: 'backbone model',
    weight: 0,
    shape: { ball: { atomScale: 0.8, bondRadius: 0.35 }, stick: { atomScale: 0.34, bondRadius: 0.34 }, space: { atomScale: 1.7, bondRadius: 0 } },
    view: { yaw: 0, pitch: 1.4 },
    spin: 'roll',
    note: 'An idealised protein backbone: 3.6 residues per turn, rising 1.5 A each step. Hydrogen bonds between every fourth residue hold the coil together.',
    elements,
    coords,
    bonds,
  };
};

const dna = () => {
  const elements = [];
  const coords = [];
  const bonds = [];
  const pairs = 14;
  const radius = 9;
  const rise = 3.4;
  const offset = (132 * Math.PI) / 180;
  const height = ((pairs - 1) * rise) / 2;

  const strand = (turn) => {
    const start = elements.length;
    for (let index = 0; index < pairs; index += 1) {
      const angle = (index * 36 * Math.PI) / 180 + turn;
      elements.push('P');
      coords.push([radius * Math.cos(angle), radius * Math.sin(angle), index * rise - height]);
      if (index) bonds.push([start + index - 1, start + index, 1]);
    }
    return start;
  };

  const first = strand(0);
  const second = strand(offset);

  for (let index = 0; index < pairs; index += 1) {
    const from = coords[first + index];
    const to = coords[second + index];
    const inner = [0.34, 0.66].map((fraction) => {
      const point = [0, 1, 2].map((axis) => from[axis] + (to[axis] - from[axis]) * fraction);
      elements.push(index % 2 ? 'N' : 'O');
      coords.push(point);
      return elements.length - 1;
    });
    bonds.push([first + index, inner[0], 1], [inner[0], inner[1], 2], [inner[1], second + index, 1]);
  }

  return {
    key: 'dna',
    name: 'DNA double helix',
    group: 'Genetics',
    formula: 'B-form model',
    weight: 0,
    shape: { ball: { atomScale: 1.1, bondRadius: 0.55 }, stick: { atomScale: 0.5, bondRadius: 0.5 }, space: { atomScale: 2.4, bondRadius: 0 } },
    view: { yaw: 0, pitch: 1.4 },
    spin: 'roll',
    note: 'The B form geometry Watson, Crick and Franklin worked out: two backbones winding round each other every ten base pairs, with the bases stacked 3.4 A apart.',
    elements,
    coords,
    bonds,
  };
};

const LIBRARY = [...molecules, helix(), dna()];

const atomInfo = (symbol) => ATOM[symbol] ?? fallbackAtom;

const toRgb = (hex) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16) / 255);
};

const principalAxes = (coords) => {
  const covariance = new Array(9).fill(0);
  coords.forEach((point) => {
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) covariance[row * 3 + column] += point[row] * point[column];
    }
  });

  let matrix = covariance.map((value) => value / Math.max(1, coords.length));
  let vectors = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  for (let sweep = 0; sweep < 16; sweep += 1) {
    let p = 0;
    let q = 1;
    let best = Math.abs(matrix[1]);
    [[0, 2], [1, 2]].forEach(([row, column]) => {
      if (Math.abs(matrix[row * 3 + column]) > best) {
        best = Math.abs(matrix[row * 3 + column]);
        p = row;
        q = column;
      }
    });
    if (best < 1e-9) break;

    const theta = 0.5 * Math.atan2(2 * matrix[p * 3 + q], matrix[q * 3 + q] - matrix[p * 3 + p]);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rows = matrix.slice();
    for (let index = 0; index < 3; index += 1) {
      rows[p * 3 + index] = cos * matrix[p * 3 + index] - sin * matrix[q * 3 + index];
      rows[q * 3 + index] = sin * matrix[p * 3 + index] + cos * matrix[q * 3 + index];
    }
    const next = rows.slice();
    const spin = vectors.slice();
    for (let index = 0; index < 3; index += 1) {
      next[index * 3 + p] = cos * rows[index * 3 + p] - sin * rows[index * 3 + q];
      next[index * 3 + q] = sin * rows[index * 3 + p] + cos * rows[index * 3 + q];
      spin[index * 3 + p] = cos * vectors[index * 3 + p] - sin * vectors[index * 3 + q];
      spin[index * 3 + q] = sin * vectors[index * 3 + p] + cos * vectors[index * 3 + q];
    }
    matrix = next;
    vectors = spin;
  }

  return [0, 1, 2]
    .map((index) => ({ value: matrix[index * 3 + index], axis: [vectors[index], vectors[3 + index], vectors[6 + index]] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((entry) => entry.axis);
};

class MoleculeViewer extends JGApp {
  static appId = 'molecule-viewer';
  static settings = [
    { key: 'style', label: 'Default style', type: 'select', default: 'ball', options: STYLES.map((style) => ({ value: style.value, label: style.label })) },
    { key: 'hydrogens', label: 'Show hydrogens', type: 'switch', default: true },
    { key: 'spin', label: 'Spin automatically', type: 'switch', default: true },
  ];
  static styles = [...JGApp.styles, sheet];

  #molecule = LIBRARY[0];
  #style = 'ball';
  #hydrogens = true;
  #spin = true;
  #labels = false;
  #yaw = 0.6;
  #pitch = 0.3;
  #scale = 1;
  #roll = 0;
  #frame = null;
  #gl = null;
  #flat = null;

  connectedCallback() {
    this.#style = this.config.get('style', 'ball');
    this.#hydrogens = this.config.get('hydrogens', true);
    this.#spin = this.config.get('spin', true) && settings.get('appearance.motion');
    const stored = this.store.read();
    if (stored) this.#molecule = LIBRARY.find((entry) => entry.key === stored) ?? LIBRARY[0];
    this.#applyView();
    super.connectedCallback();
  }

  renderWidget() {
    const molecule = LIBRARY[Math.floor(Date.now() / 86400000) % LIBRARY.length];
    this.paint(html`<div class="app" style="padding:12px;gap:10px">
      <div class="stack tight">
        <div class="label">Molecule of the day</div>
        <div class="title">${molecule.name}</div>
        <div class="hint mono">${molecule.formula}</div>
        <div class="hint">${molecule.elements.length} atoms</div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head">
        <jg-toolbar id="bar"></jg-toolbar>
      </div>
      <div class="body">
        <div class="list" id="list"></div>
        <div class="stage">
          <div class="canvas-wrap">
            <canvas id="gl"></canvas>
            <canvas id="flat" hidden></canvas>
            <div class="hud">
              <span class="name" id="hud-name"></span>
              <span class="fx" id="hud-formula"></span>
            </div>
            <div class="legend" id="legend"></div>
          </div>
          <div class="info" id="info"></div>
        </div>
      </div>
    </div>`);

    this.$('#bar').items = [
      ...STYLES.map((style) => ({
        id: style.value,
        label: style.label,
        icon: style.value === 'diagram' ? 'spec' : 'molecule',
        select: true,
        action: () => this.#setStyle(style.value),
      })),
      { separator: true },
      { id: 'hydrogens', label: 'Hydrogens', icon: 'atom', toggle: true, active: this.#hydrogens, action: () => this.#toggle('hydrogens') },
      { id: 'labels', label: 'Labels', icon: 'type', toggle: true, active: this.#labels, action: () => this.#toggle('labels') },
      { id: 'spin', label: 'Spin', icon: 'repeat', toggle: true, active: this.#spin, action: () => this.#toggle('spin') },
      { spacer: true },
      { id: 'copy', label: 'Copy XYZ', icon: 'copy', action: () => copyText(this.#xyz()) },
      { id: 'png', label: 'Save PNG', icon: 'download', action: () => this.#savePng() },
    ];
    this.$('#bar').value = this.#style;

    this.#paintList();
    this.#paintInfo();

    const canvas = this.$('#gl');
    this.#flat = this.$('#flat').getContext('2d');
    this.#gl = createGlRenderer(canvas);
    canvas.hidden = !this.#gl || this.#style === 'diagram';
    this.$('#flat').hidden = Boolean(this.#gl) && this.#style !== 'diagram';

    let dragging = false;
    let last = null;
    const wrap = this.$('.canvas-wrap');
    this.on(wrap, 'pointerdown', (event) => {
      dragging = true;
      last = [event.clientX, event.clientY];
      wrap.setPointerCapture(event.pointerId);
    });
    this.on(wrap, 'pointermove', (event) => {
      if (!dragging) return;
      this.#yaw += (event.clientX - last[0]) * 0.01;
      this.#pitch = Math.max(-1.45, Math.min(1.45, this.#pitch + (event.clientY - last[1]) * 0.01));
      last = [event.clientX, event.clientY];
      this.#draw();
    });
    this.on(wrap, 'pointerup', (event) => {
      dragging = false;
      wrap.releasePointerCapture(event.pointerId);
    });
    this.on(wrap, 'wheel', (event) => {
      event.preventDefault();
      this.#scale = Math.max(0.35, Math.min(3.6, this.#scale - Math.sign(event.deltaY) * 0.12));
      this.#draw();
    });

    const observer = new ResizeObserver(() => {
      this.#resize();
      this.#draw();
    });
    observer.observe(wrap);
    this.track(() => observer.disconnect());
    this.track(() => {
      this.#gl?.dispose();
      this.#gl = null;
    });

    this.#rebuild();
    this.#loop();
  }

  #toggle(key) {
    if (key === 'hydrogens') {
      this.#hydrogens = !this.#hydrogens;
      this.config.set('hydrogens', this.#hydrogens);
      this.#rebuild();
    }
    if (key === 'labels') this.#labels = !this.#labels;
    if (key === 'spin') {
      this.#spin = !this.#spin;
      this.config.set('spin', this.#spin);
    }
    this.#draw();
  }

  #setStyle(style) {
    this.#style = style;
    this.config.set('style', style);
    this.$('#bar').value = style;
    this.$('#gl').hidden = !this.#gl || style === 'diagram';
    this.$('#flat').hidden = Boolean(this.#gl) && style !== 'diagram';
    this.#rebuild();
    this.#draw();
  }

  #select(key) {
    this.#molecule = LIBRARY.find((entry) => entry.key === key) ?? LIBRARY[0];
    this.store.write(this.#molecule.key);
    this.#applyView();
    this.#paintList();
    this.#paintInfo();
    this.#rebuild();
    this.#draw();
  }

  #applyView() {
    const view = this.#molecule.view;
    this.#yaw = view?.yaw ?? 0.6;
    this.#pitch = view?.pitch ?? 0.3;
    this.#roll = 0;
    this.#scale = 1;
  }

  #paintList() {
    this.$('#list').innerHTML = html`${GROUPS.filter((group) => LIBRARY.some((entry) => entry.group === group)).map(
      (group) => html`<div class="group">${group}</div>
        ${LIBRARY.filter((entry) => entry.group === group).map(
          (entry) => html`<button class="entry" data-key="${entry.key}" aria-current="${String(entry.key === this.#molecule.key)}">
            <span>${entry.name}</span>
            <span class="fx">${entry.elements.length}</span>
          </button>`,
        )}`,
    )}`;
    this.bind('.entry', 'click', (event) => this.#select(event.currentTarget.dataset.key));
  }

  #visible() {
    const molecule = this.#molecule;
    const map = new Map();
    const points = [];
    molecule.elements.forEach((symbol, index) => {
      if (!this.#hydrogens && symbol === 'H') return;
      map.set(index, points.length);
      points.push({ symbol, position: molecule.coords[index] });
    });
    const links = molecule.bonds
      .filter(([a, b]) => map.has(a) && map.has(b))
      .map(([a, b, order]) => [map.get(a), map.get(b), order]);
    return { points, links };
  }

  #paintInfo() {
    const molecule = this.#molecule;
    const counts = new Map();
    molecule.elements.forEach((symbol) => counts.set(symbol, (counts.get(symbol) ?? 0) + 1));

    this.$('#hud-name').textContent = molecule.name;
    this.$('#hud-formula').textContent = molecule.formula;
    this.$('#legend').innerHTML = html`${[...counts.entries()].map(
      ([symbol, count]) => html`<span style="--tone:${atomInfo(symbol).color}"><i></i>${symbol} ${count}</span>`,
    )}`;

    this.$('#info').innerHTML = html`
      <div class="stat"><b>${molecule.elements.length}</b><span>atoms</span></div>
      <div class="stat"><b>${molecule.bonds.length}</b><span>bonds</span></div>
      ${molecule.weight ? html`<div class="stat"><b>${molecule.weight}</b><span>g/mol</span></div>` : ''}
      <p class="note">${molecule.note}</p>
      ${molecule.cid ? html`<span class="hint mono tiny">PubChem CID ${molecule.cid}</span>` : ''}
    `;
  }

  #resize() {
    const wrap = this.$('.canvas-wrap');
    if (!wrap) return false;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(wrap.clientWidth * ratio);
    const height = Math.round(wrap.clientHeight * ratio);
    if (!width || !height) return false;
    [this.$('#gl'), this.$('#flat')].forEach((canvas) => {
      if (!canvas) return;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    });
    return true;
  }

  #rebuild() {
    if (!this.#gl || this.#style === 'diagram') return;
    const { points, links } = this.#visible();
    const shape = this.#molecule.shape?.[this.#style] ?? SHAPE[this.#style] ?? SHAPE.ball;
    this.#gl.build(
      points.map((point) => {
        const info = atomInfo(point.symbol);
        return {
          position: point.position,
          radius: shape.vdw ? info.vdw ?? info.radius : info.radius,
          color: toRgb(info.color),
        };
      }),
      links.map(([a, b, order]) => ({ a, b, order })),
      shape,
    );
  }

  #loop() {
    const step = () => {
      if (this.#spin) {
        if (this.#molecule.spin === 'roll') this.#roll += 0.012;
        else this.#yaw += 0.005;
        this.#draw();
      }
      this.#frame = requestAnimationFrame(step);
    };
    this.#frame = requestAnimationFrame(step);
    this.track(() => cancelAnimationFrame(this.#frame));
  }

  #draw() {
    if (!this.#resize()) return;
    if (this.#style === 'diagram' || !this.#gl) this.#drawFlat();
    else this.#gl.draw({ yaw: this.#yaw, pitch: this.#pitch, roll: this.#roll, scale: this.#scale, ambient: 0.26 });
  }

  #drawFlat() {
    const canvas = this.$('#flat');
    const context = this.#flat;
    if (!canvas || !context) return;

    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const { points, links } = this.#visible();
    if (!points.length) return;

    const axes = principalAxes(points.map((point) => point.position));
    const flat = points.map(({ position }) => [
      position[0] * axes[0][0] + position[1] * axes[0][1] + position[2] * axes[0][2],
      position[0] * axes[1][0] + position[1] * axes[1][1] + position[2] * axes[1][2],
    ]);

    let bound = 0.8;
    flat.forEach(([x, y]) => {
      bound = Math.max(bound, Math.hypot(x, y) + 0.7);
    });

    const styles = getComputedStyle(this);
    const muted = styles.getPropertyValue('--muted-foreground').trim() || '#777';
    const surface = styles.getPropertyValue('--muted').trim() || '#fff';

    const zoom = Math.min((Math.min(width, height) / 2 - 20) / bound, 70) * this.#scale;
    const screen = flat.map(([x, y]) => [width / 2 + x * zoom, height / 2 - y * zoom]);

    context.lineCap = 'round';
    context.strokeStyle = muted;
    context.lineWidth = Math.max(1.2, zoom * 0.032);
    links.forEach(([a, b, order]) => {
      const [ax, ay] = screen[a];
      const [bx, by] = screen[b];
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const nx = (-(by - ay) / length) * zoom * 0.055;
      const ny = ((bx - ax) / length) * zoom * 0.055;
      const lanes = order === 2 ? [-1, 1] : order === 3 ? [-1, 0, 1] : [0];
      lanes.forEach((lane) => {
        context.beginPath();
        context.moveTo(ax + nx * lane, ay + ny * lane);
        context.lineTo(bx + nx * lane, by + ny * lane);
        context.stroke();
      });
    });

    const size = Math.max(10, zoom * 0.2);
    context.font = `600 ${size}px ${styles.getPropertyValue('--font-sans') || 'sans-serif'}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    points.forEach((point, index) => {
      if (point.symbol === 'C' && !this.#labels) return;
      const [x, y] = screen[index];
      context.fillStyle = surface;
      context.beginPath();
      context.arc(x, y, size * 0.72, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = point.symbol === 'C' ? muted : atomInfo(point.symbol).color;
      context.fillText(point.symbol, x, y);
    });
  }

  #xyz() {
    const { points } = this.#visible();
    return [
      String(points.length),
      `${this.#molecule.name} ${this.#molecule.formula}`,
      ...points.map(({ symbol, position }) => `${symbol.padEnd(3)}${position.map((value) => value.toFixed(4).padStart(10)).join('')}`),
    ].join('\n');
  }

  #savePng() {
    const source = this.#style === 'diagram' || !this.#gl ? this.$('#flat') : this.$('#gl');
    source.toBlob((blob) => download(`${this.#molecule.key}.png`, blob));
  }
}

define('jg-app-molecule-viewer', MoleculeViewer);
