import { JGApp, define, html, css } from '../core/app.js';
import { elements, CATEGORIES, categoryOf } from '../lib/elements.js';
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
  .body { flex: 1; min-height: 0; overflow: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }

  .split { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; align-items: start; }
  .side { position: sticky; top: 0; max-height: calc(100cqh - 128px); overflow: auto; }
  .side .detail { padding: 0; }
  .side .facts { grid-template-columns: 1fr; }
  .side .fact { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .side .fact dt { margin: 0; flex: none; }
  .side .fact dd { text-align: right; min-width: 0; overflow-wrap: anywhere; }
  .side .bohr { max-width: 215px; }
  .sheet-body { padding: 14px; }
  @container (max-width: 900px) {
    .split { grid-template-columns: minmax(0, 1fr); }
    .side { display: none; }
  }

  .board {
    display: grid;
    grid-template-columns: repeat(18, var(--cell));
    grid-auto-rows: var(--cell);
    gap: calc(var(--cell) * 0.06);
    width: max-content;
  }
  .viewport {
    position: relative;
    display: flex;
    gap: 8px;
    align-items: stretch;
    min-height: 0;
  }
  .scroller {
    flex: 1;
    min-width: 0;
    overflow: auto;
    overscroll-behavior: contain;
    cursor: grab;
    padding-bottom: 4px;
  }
  .scroller[data-panning="true"] { cursor: grabbing; }
  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex: none;
    padding: 4px 0;
  }
  .rail jg-slider { height: 132px; }
  .rail button {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--muted-foreground);
    cursor: pointer;
    font: 500 13px/1 var(--font-sans);
  }
  .rail button:hover { color: var(--foreground); border-color: var(--border-strong); }
  .rail .amount { font: 500 10px/1 var(--font-mono); color: var(--muted-foreground); }
  .spacer { grid-column: 1 / -1; grid-row: 8; height: calc(var(--cell) * 0.3); }

  .cell {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: calc(var(--cell) * 0.07) calc(var(--cell) * 0.09);
    border-radius: calc(var(--cell) * 0.14);
    border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent);
    background: color-mix(in srgb, var(--tone) 20%, var(--card));
    color: var(--foreground);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    overflow: hidden;
    transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
  }
  .cell:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); z-index: 2; }
  .cell[data-active="true"] {
    border-color: var(--tone);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--tone) 65%, transparent);
    z-index: 3;
  }
  .cell[data-dim="true"] { opacity: 0.22; }
  .cell .z { font: 500 calc(var(--cell) * 0.17)/1 var(--font-mono); color: var(--muted-foreground); }
  .cell .sym { font: 650 calc(var(--cell) * 0.34)/1.05 var(--font-sans); letter-spacing: -0.02em; }
  .cell .nm {
    font-size: calc(var(--cell) * 0.15);
    line-height: 1.15;
    color: var(--muted-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cell .val { font: 500 calc(var(--cell) * 0.15)/1 var(--font-mono); color: var(--muted-foreground); }
  .board[data-compact="true"] .nm,
  .board[data-compact="true"] .val { display: none; }
  .board[data-compact="true"] .cell { justify-content: center; align-items: center; }
  .board[data-compact="true"] .z { display: none; }

  .legend { display: flex; flex-wrap: wrap; gap: 5px 12px; align-items: center; }
  .key { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted-foreground); cursor: pointer; }
  .key .dot { width: 9px; height: 9px; border-radius: 3px; background: var(--tone); flex: none; }
  .key[aria-pressed="true"] { color: var(--foreground); font-weight: 600; }

  .scale { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--muted-foreground); }
  .ramp { width: 130px; height: 8px; border-radius: 999px; }

  .detail { display: grid; gap: 14px; }
  .hero { display: flex; align-items: flex-start; gap: 14px; }
  .tile {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 92px;
    height: 92px;
    flex: none;
    padding: 8px 10px;
    border-radius: var(--radius-lg);
    border: 1px solid color-mix(in srgb, var(--tone) 60%, transparent);
    background: color-mix(in srgb, var(--tone) 24%, var(--card));
  }
  .tile .z { font: 500 11px/1 var(--font-mono); color: var(--muted-foreground); }
  .tile .sym { font: 650 34px/1 var(--font-sans); letter-spacing: -0.03em; }
  .tile .ms { font: 500 10.5px/1 var(--font-mono); color: var(--muted-foreground); }

  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
  .fact { background: var(--card); padding: 9px 11px; }
  .fact dt { font-size: 11px; color: var(--muted-foreground); margin-bottom: 2px; }
  .fact dd { margin: 0; font-size: 13px; font-weight: 500; }
  .fact dd.mono { font-family: var(--font-mono); font-size: 12px; }

  .bohr { display: block; width: 100%; max-width: 320px; margin: 0 auto; overflow: visible; }
  .bohr .ring { fill: none; stroke: var(--border-strong); stroke-width: 0.6; }
  .bohr .nucleus { fill: var(--tone); }
  .bohr .glow { fill: var(--tone); opacity: 0.16; }
  .bohr .e { fill: var(--foreground); }
  .bohr text { fill: var(--muted-foreground); font: 500 4px var(--font-mono); text-anchor: middle; }
  .bohr .shell {
    transform-origin: 50px 50px;
    animation: orbit var(--spin, 16s) linear infinite;
  }
  .bohr .shell[data-reverse="true"] { animation-direction: reverse; }
  @keyframes orbit { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .bohr .shell { animation: none; }
  }

  .detail .hero { flex-direction: column; }
  .detail .bohr { max-width: 260px; }
  .facts { grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); }
`;

const MODES = [
  { value: 'category', label: 'Category' },
  { value: 'state', label: 'State' },
  { value: 'block', label: 'Block' },
  { value: 'electronegativity', label: 'Electronegativity' },
  { value: 'mass', label: 'Atomic mass' },
];

const BLOCKS = { s: '#4a6fa5', p: '#4f7f6b', d: '#b0553f', f: '#96496f' };

const kelvin = (value, unit) => {
  if (!value) return null;
  if (unit === 'C') return value - 273.15;
  if (unit === 'F') return (value - 273.15) * 1.8 + 32;
  return value;
};

const temperature = (value, unit) => {
  const converted = kelvin(value, unit);
  if (converted === null) return 'unknown';
  return `${Math.round(converted * 100) / 100} ${unit === 'K' ? 'K' : `°${unit}`}`;
};

const stateAt = (element, temp) => {
  if (element.melt && temp < element.melt) return 'solid';
  if (element.boil && temp >= element.boil) return 'gas';
  if (element.melt && element.boil) return 'liquid';
  return element.phase || 'unknown';
};

const STATE_TONE = { solid: '#4a6fa5', liquid: '#3f8c8c', gas: '#c2603f', unknown: '#6b7280' };

const mix = (ratio, low, high) => {
  const value = Math.max(0, Math.min(1, ratio));
  const channel = (index) => Math.round(low[index] + (high[index] - low[index]) * value);
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
};

class PeriodicTable extends JGApp {
  static appId = 'periodic-table';
  static settings = [
    { key: 'mode', label: 'Colour by', type: 'select', default: 'category', options: MODES.map((mode) => ({ value: mode.value, label: mode.label })) },
    { key: 'zoom', label: 'Cell size', type: 'number', default: 38, min: 22, max: 84 },
    { key: 'units', label: 'Temperature unit', type: 'select', default: 'K', options: [
      { value: 'K', label: 'Kelvin' },
      { value: 'C', label: 'Celsius' },
      { value: 'F', label: 'Fahrenheit' },
    ] },
  ];
  static styles = [...JGApp.styles, sheet];

  #mode = 'category';
  #filter = null;
  #query = '';
  #temp = 293;
  #selected = 6;
  #zoom = 38;
  #autoFit = true;

  connectedCallback() {
    this.#mode = this.config.get('mode', 'category');
    this.#zoom = Number(this.config.get('zoom', 38));
    super.connectedCallback();
    this.hotkeys((event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -18, ArrowDown: 18 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = elements.find((element) => element.number === this.#selected + Math.sign(step) * (Math.abs(step) === 1 ? 1 : 18));
      if (next) this.#select(next.number);
    });
  }

  get #unit() {
    return this.config.get('units', 'K');
  }

  get #element() {
    return elements.find((element) => element.number === this.#selected) ?? elements[0];
  }

  renderWidget() {
    const element = elements[Math.floor(Date.now() / 86400000) % elements.length];
    const tone = categoryOf(element.category)?.color;
    this.paint(html`<div class="app" style="padding:12px;--tone:${tone}">
      <div class="hero" style="gap:10px">
        <div class="tile" style="width:64px;height:64px">
          <span class="z">${element.number}</span>
          <span class="sym" style="font-size:24px">${element.symbol}</span>
        </div>
        <div class="stack tight">
          <div class="title">${element.name}</div>
          <div class="hint">${categoryOf(element.category)?.name}</div>
          <div class="hint mono">${element.mass} u</div>
        </div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head">
        <jg-toolbar id="bar"></jg-toolbar>
      </div>
      <div class="body">
      <div class="row">
        <jg-input id="search" size="sm" placeholder="Find an element" value="${this.#query}" style="width:180px"></jg-input>
        <span class="grow"></span>
        <div class="scale" id="scale"></div>
      </div>

      <div class="split">
        <div class="stack">
          <div class="viewport">
            <div class="scroller">
              <div class="board" id="board"></div>
            </div>
            <div class="rail">
              <button id="zoom-in" title="Zoom in">+</button>
              <jg-slider id="zoom" min="22" max="84" step="1" value="${this.#zoom}" orient="vertical"></jg-slider>
              <button id="zoom-out" title="Zoom out">-</button>
              <button id="zoom-fit" title="Fit to width">⤢</button>
              <span class="amount" id="zoom-amount">${this.#zoom}</span>
            </div>
          </div>
          <div class="legend" id="legend"></div>
        </div>
        <aside class="panel side" id="side"></aside>
      </div>

      </div>
      <jg-sheet id="sheet" side="right" title-text="Element"><div class="sheet-body" id="sheet-detail"></div></jg-sheet>
    </div>`);

    this.$('#bar').items = [
      ...MODES.map((mode) => ({
        id: mode.value,
        label: mode.label,
        icon: mode.value === 'state' ? 'thermometer' : 'palette',
        select: true,
        action: () => this.#setMode(mode.value),
      })),
      { spacer: true },
      { id: 'zoom-out', label: 'Smaller', icon: 'minus', action: () => this.#setZoom(this.#zoom - 6) },
      { id: 'zoom-in', label: 'Bigger', icon: 'plus', action: () => this.#setZoom(this.#zoom + 6) },
      { id: 'copy', label: 'Copy facts', icon: 'copy', action: () => copyText(this.#facts()) },
    ];
    this.$('#bar').value = this.#mode;

    this.on(this.$('#search'), 'input', (event) => {
      this.#query = event.target.value.trim().toLowerCase();
      this.#paintBoard();
    });

    this.on(this.$('#zoom'), 'input', (event) => this.#setZoom(Number(event.target.value)));
    this.on(this.$('#zoom-in'), 'click', () => this.#setZoom(this.#zoom + 6));
    this.on(this.$('#zoom-out'), 'click', () => this.#setZoom(this.#zoom - 6));
    this.on(this.$('#zoom-fit'), 'click', () => this.#fit());

    const scroller = this.$('.scroller');
    this.on(scroller, 'wheel', (event) => {
      if (event.shiftKey) return;
      event.preventDefault();
      const rect = scroller.getBoundingClientRect();
      const anchor = (scroller.scrollLeft + event.clientX - rect.left) / Math.max(1, this.#zoom);
      const anchorY = (scroller.scrollTop + event.clientY - rect.top) / Math.max(1, this.#zoom);
      const before = this.#zoom;
      this.#setZoom(this.#zoom - Math.sign(event.deltaY) * Math.max(2, Math.round(this.#zoom * 0.12)));
      if (this.#zoom === before) return;
      scroller.scrollLeft = anchor * this.#zoom - (event.clientX - rect.left);
      scroller.scrollTop = anchorY * this.#zoom - (event.clientY - rect.top);
    });

    let pan = null;
    this.on(scroller, 'pointerdown', (event) => {
      if (event.target.closest('.cell')) return;
      pan = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
      scroller.dataset.panning = 'true';
      scroller.setPointerCapture(event.pointerId);
    });
    this.on(scroller, 'pointermove', (event) => {
      if (!pan) return;
      scroller.scrollLeft = pan.left - (event.clientX - pan.x);
      scroller.scrollTop = pan.top - (event.clientY - pan.y);
    });
    this.on(scroller, 'pointerup', () => {
      pan = null;
      scroller.dataset.panning = 'false';
    });

    const fitter = new ResizeObserver(() => {
      if (this.#autoFit) this.#fit();
    });
    fitter.observe(scroller);
    this.track(() => fitter.disconnect());

    this.#paintBoard();
    this.#paintLegend();
    this.#paintDetail();
    requestAnimationFrame(() => {
      if (this.#autoFit) this.#fit();
    });
  }

  #setZoom(value, options = {}) {
    const next = Math.max(22, Math.min(84, Math.round(value)));
    if (options.auto !== true) this.#autoFit = false;
    if (next === this.#zoom) return;
    this.#zoom = next;
    if (options.auto !== true) this.config.set('zoom', next);
    const slider = this.$('#zoom');
    if (slider && Number(slider.value) !== next) slider.value = next;
    const amount = this.$('#zoom-amount');
    if (amount) amount.textContent = String(next);
    this.#applyZoom();
  }

  #fit() {
    const scroller = this.$('.scroller');
    if (!scroller || !scroller.clientWidth) return;
    this.#autoFit = true;
    const cell = Math.floor((scroller.clientWidth - 8) / 18 / 1.06);
    this.#setZoom(cell, { auto: true });
    scroller.scrollLeft = 0;
  }

  #applyZoom() {
    const board = this.$('#board');
    if (!board) return;
    board.style.setProperty('--cell', `${this.#zoom}px`);
    board.dataset.compact = String(this.#zoom < 34);
  }

  #setMode(mode) {
    this.#mode = mode;
    this.config.set('mode', mode);
    this.$('#bar').value = mode;
    this.#paintBoard();
    this.#paintLegend();
  }

  #tone(element) {
    if (this.#mode === 'block') return BLOCKS[element.block] ?? '#6b7280';
    if (this.#mode === 'state') return STATE_TONE[stateAt(element, this.#temp)];
    if (this.#mode === 'electronegativity') {
      return element.electronegativity
        ? mix((element.electronegativity - 0.7) / 3.28, [63, 111, 165], [194, 96, 63])
        : '#6b7280';
    }
    if (this.#mode === 'mass') return mix(Math.log(element.mass) / Math.log(295), [79, 127, 107], [150, 73, 111]);
    return categoryOf(element.category)?.color ?? '#6b7280';
  }

  #dimmed(element) {
    if (this.#query) {
      const hit = `${element.name} ${element.symbol} ${element.number} ${element.category}`.toLowerCase();
      return !hit.includes(this.#query);
    }
    return Boolean(this.#filter) && element.category !== this.#filter;
  }

  #value(element) {
    if (this.#mode === 'electronegativity') return element.electronegativity || '-';
    if (this.#mode === 'mass') return Math.round(element.mass * 100) / 100;
    if (this.#mode === 'state') return stateAt(element, this.#temp);
    if (this.#mode === 'block') return `${element.block}-block`;
    return null;
  }

  #paintBoard() {
    const cells = elements.map((element) => {
      const value = this.#value(element);
      return html`<button
        class="cell"
        data-z="${element.number}"
        data-active="${String(element.number === this.#selected)}"
        data-dim="${String(this.#dimmed(element))}"
        style="--tone:${this.#tone(element)};grid-column:${element.x};grid-row:${element.y}"
        title="${element.name}"
      >
        <span class="z">${element.number}</span>
        <span class="sym">${element.symbol}</span>
        ${value === null ? html`<span class="nm">${element.name}</span>` : html`<span class="val">${value}</span>`}
      </button>`;
    });

    this.$('#board').innerHTML = html`<span class="spacer"></span>${cells}`;
    this.#applyZoom();
    this.bind('.cell', 'click', (event) => this.#select(Number(event.currentTarget.dataset.z)));

    const scale = this.$('#scale');
    scale.innerHTML =
      this.#mode === 'state'
        ? html`<span>Temperature</span>
            <jg-slider id="temp" min="1" max="6000" step="1" value="${this.#temp}" style="width:150px"></jg-slider>
            <span class="mono">${temperature(this.#temp, this.#unit)}</span>`
        : this.#mode === 'electronegativity'
          ? html`<span>0.7</span><span class="ramp" style="background:linear-gradient(90deg,rgb(63,111,165),rgb(194,96,63))"></span><span>3.98</span>`
          : '';
    const slider = this.$('#temp');
    if (slider) {
      this.on(slider, 'input', (event) => {
        this.#temp = Number(event.target.value);
        this.#paintBoard();
      });
    }
  }

  #paintLegend() {
    const legend = this.$('#legend');
    if (this.#mode === 'block') {
      legend.innerHTML = html`${Object.entries(BLOCKS).map(
        ([block, color]) => html`<span class="key" style="--tone:${color}"><span class="dot"></span>${block}-block</span>`,
      )}`;
      return;
    }
    if (this.#mode === 'state') {
      legend.innerHTML = html`${['solid', 'liquid', 'gas'].map(
        (state) => html`<span class="key" style="--tone:${STATE_TONE[state]}"><span class="dot"></span>${state}</span>`,
      )}`;
      return;
    }
    if (this.#mode !== 'category') {
      legend.innerHTML = '';
      return;
    }
    legend.innerHTML = html`${CATEGORIES.map(
      (group) => html`<button class="key" data-cat="${group.id}" aria-pressed="${String(this.#filter === group.id)}" style="--tone:${group.color}">
        <span class="dot"></span>${group.name}
      </button>`,
    )}`;
    this.bind('.key[data-cat]', 'click', (event) => {
      const id = event.currentTarget.dataset.cat;
      this.#filter = this.#filter === id ? null : id;
      this.#paintBoard();
      this.#paintLegend();
    });
  }

  #select(number, options = {}) {
    this.#selected = number;
    this.$$('.cell').forEach((cell) => {
      cell.dataset.active = String(Number(cell.dataset.z) === number);
    });
    this.#paintDetail();
    if (options.open !== false && !this.#sideVisible) {
      const sheet = this.$('#sheet');
      sheet.setAttribute('title-text', this.#element.name);
      sheet.open();
    }
  }

  get #sideVisible() {
    const side = this.$('#side');
    return Boolean(side && side.offsetParent !== null);
  }

  #facts() {
    const element = this.#element;
    const unit = this.#unit;
    return [
      `${element.name} (${element.symbol}), atomic number ${element.number}`,
      `Category: ${categoryOf(element.category)?.name}`,
      `Standard atomic weight: ${element.mass} u`,
      `Electron configuration: ${element.configuration}`,
      `Shells: ${element.shells.join(', ')}`,
      `Melting point: ${temperature(element.melt, unit)}`,
      `Boiling point: ${temperature(element.boil, unit)}`,
      `Density: ${element.density ? `${element.density} g/cm3` : 'unknown'}`,
      `Electronegativity: ${element.electronegativity || 'none'}`,
      `First ionization energy: ${element.ionization ? `${element.ionization} kJ/mol` : 'unknown'}`,
    ].join('\n');
  }

  #bohr(element) {
    const tone = this.#tone(element);
    const shells = element.shells;
    const rings = shells.map((count, index) => {
      const radius = 12 + index * (36 / Math.max(1, shells.length));
      const dots = Array.from({ length: count }, (item, seat) => {
        const angle = (seat / count) * Math.PI * 2 - Math.PI / 2 + index * 0.35;
        return html`<circle class="e" cx="${(50 + radius * Math.cos(angle)).toFixed(2)}" cy="${(50 + radius * Math.sin(angle)).toFixed(2)}" r="1.5"></circle>`;
      });
      return html`<g>
        <circle class="ring" cx="50" cy="50" r="${radius.toFixed(1)}"></circle>
        <g class="shell" data-reverse="${String(index % 2 === 1)}" style="--spin:${(9 + index * 4.5).toFixed(1)}s">${dots}</g>
      </g>`;
    });
    return html`<svg class="bohr" viewBox="0 0 100 100" style="--tone:${tone}" role="img" aria-label="Shell diagram for ${element.name}">
      ${rings}
      <circle class="glow" cx="50" cy="50" r="11"></circle>
      <circle class="nucleus" cx="50" cy="50" r="7"></circle>
      <text x="50" y="51.4" style="fill:#fff">${element.symbol}</text>
    </svg>`;
  }

  #paintDetail() {
    const element = this.#element;
    const tone = this.#tone(element);
    const unit = this.#unit;
    const group = categoryOf(element.category);
    const facts = [
      ['Category', group?.name],
      ['Standard atomic weight', `${element.mass} u`],
      ['Group / period', `${element.group || '-'} / ${element.period}`],
      ['Block', `${element.block}-block`],
      ['Electron configuration', element.configuration, true],
      ['Electrons per shell', element.shells.join(', '), true],
      ['Common oxidation states', element.oxidation, true],
      ['State at ' + temperature(this.#temp, unit), stateAt(element, this.#temp)],
      ['Melting point', temperature(element.melt, unit)],
      ['Boiling point', temperature(element.boil, unit)],
      ['Density', element.density ? `${element.density} g/cm³` : 'unknown'],
      ['Molar heat', element.heat ? `${element.heat} J/(mol·K)` : 'unknown'],
      ['Electronegativity', element.electronegativity || 'none'],
      ['First ionization', element.ionization ? `${element.ionization} kJ/mol` : 'unknown'],
      ['Electron affinity', element.affinity ? `${Math.round(element.affinity * 100) / 100} kJ/mol` : 'none'],
      ['Discovered by', element.discoveredBy || 'unknown'],
      ['Named by', element.namedBy || '-'],
    ];

    const markup = html`
      <div class="hero" style="--tone:${tone}">
        <div class="tile">
          <span class="z">${element.number}</span>
          <span class="sym">${element.symbol}</span>
          <span class="ms">${element.mass}</span>
        </div>
        <div class="stack tight grow">
          <div class="title" style="font-size:18px">${element.name}</div>
          <div class="hint">${group?.name} · ${element.block}-block · period ${element.period}</div>
          <p class="hint" style="margin:4px 0 0;max-width:62ch">${element.note}</p>
        </div>
        ${{ raw: this.#bohr(element) }}
      </div>
      <dl class="facts">
        ${facts
          .filter(([, value]) => value !== undefined && value !== null && value !== '')
          .map(([term, value, mono]) => html`<div class="fact"><dt>${term}</dt><dd class="${mono ? 'mono' : ''}">${value}</dd></div>`)}
      </dl>
    `;

    this.$('#side').innerHTML = html`<div class="detail">${{ raw: markup }}</div>`;
    this.$('#sheet-detail').innerHTML = html`<div class="detail">${{ raw: markup }}</div>`;
    this.$('#sheet')?.setAttribute('title-text', element.name);
  }
}

define('jg-app-periodic-table', PeriodicTable);
