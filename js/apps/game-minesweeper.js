import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .stat {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 75%, transparent);
    border: 1px solid var(--border);
    font: 600 13px/1 var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .wrap { display: grid; place-items: center; }
  .board {
    display: grid;
    gap: 2px;
    padding: 8px;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 80%, transparent);
    border: 1px solid var(--border);
    user-select: none;
    touch-action: manipulation;
    max-width: 100%;
    overflow: auto;
  }
  .cell {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 5px;
    background: color-mix(in srgb, var(--foreground) 10%, transparent);
    font: 700 15px/1 var(--font-sans);
    color: transparent;
    cursor: pointer;
    padding: 0;
  }
  .cell:hover { background: color-mix(in srgb, var(--foreground) 16%, transparent); }
  .cell[data-open="true"] {
    background: color-mix(in srgb, var(--muted) 55%, transparent);
    cursor: default;
  }
  .cell[data-flag="true"] { color: var(--warning); }
  .cell[data-mine="true"][data-open="true"] { background: color-mix(in srgb, var(--destructive) 45%, transparent); color: #fff; }
  .cell[data-count="1"] { color: #3b82f6; }
  .cell[data-count="2"] { color: #16a34a; }
  .cell[data-count="3"] { color: #ef4444; }
  .cell[data-count="4"] { color: #7c3aed; }
  .cell[data-count="5"] { color: #b45309; }
  .cell[data-count="6"] { color: #0891b2; }
  .cell[data-count="7"] { color: var(--foreground); }
  .cell[data-count="8"] { color: var(--muted-foreground); }
`;

const LEVELS = {
  easy: { cols: 9, rows: 9, mines: 10, label: 'Easy' },
  medium: { cols: 16, rows: 16, mines: 40, label: 'Medium' },
  hard: { cols: 24, rows: 16, mines: 70, label: 'Hard' },
};

class Minesweeper extends JGApp {
  static appId = 'game-minesweeper';
  static styles = [...JGApp.styles, sheet];

  #level = 'easy';
  #cells = [];
  #started = false;
  #over = false;
  #won = false;
  #seconds = 0;
  #timer = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head">
        <jg-segment id="level"></jg-segment>
        <span class="grow"></span>
        <span class="stat" id="mines">0</span>
        <span class="stat" id="clock">0:00</span>
        <jg-button size="sm" variant="outline" id="new">New game</jg-button>
      </div>

      <div class="wrap"><div class="board" id="board"></div></div>
      <div class="center hint" id="status"></div>
    </div>`);

    this.$('#level').items = Object.entries(LEVELS).map(([value, level]) => ({ value, label: level.label }));
    this.$('#level').value = this.#level;
    this.on(this.$('#level'), 'change', (event) => {
      this.#level = event.detail.value;
      this.#reset();
    });
    this.on(this.$('#new'), 'click', () => this.#reset());

    this.#reset();
  }

  #config() {
    return LEVELS[this.#level];
  }

  #reset() {
    const { cols, rows } = this.#config();
    clearInterval(this.#timer);
    this.#cells = Array.from({ length: cols * rows }, () => ({ mine: false, open: false, flag: false, count: 0 }));
    this.#started = false;
    this.#over = false;
    this.#won = false;
    this.#seconds = 0;
    this.#paint();
  }

  #place(safeIndex) {
    const { cols, rows, mines } = this.#config();
    const total = cols * rows;
    const forbidden = new Set([safeIndex, ...this.#neighbours(safeIndex)]);
    let placed = 0;

    while (placed < mines) {
      const index = Math.floor(Math.random() * total);
      if (forbidden.has(index) || this.#cells[index].mine) continue;
      this.#cells[index].mine = true;
      placed += 1;
    }

    this.#cells.forEach((cell, index) => {
      cell.count = this.#neighbours(index).filter((neighbour) => this.#cells[neighbour].mine).length;
    });

    this.#started = true;
    this.#timer = setInterval(() => {
      this.#seconds += 1;
      const clock = this.$('#clock');
      if (clock) clock.textContent = `${Math.floor(this.#seconds / 60)}:${String(this.#seconds % 60).padStart(2, '0')}`;
    }, 1000);
    this.track(() => clearInterval(this.#timer));
  }

  #neighbours(index) {
    const { cols, rows } = this.#config();
    const x = index % cols;
    const y = Math.floor(index / cols);
    const out = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        out.push(ny * cols + nx);
      }
    }
    return out;
  }

  #open(index) {
    const cell = this.#cells[index];
    if (this.#over || cell.open || cell.flag) return;
    if (!this.#started) this.#place(index);

    if (cell.mine) {
      this.#over = true;
      clearInterval(this.#timer);
      this.#cells.forEach((item) => {
        if (item.mine) item.open = true;
      });
      this.#paint();
      return;
    }

    const queue = [index];
    while (queue.length) {
      const current = queue.pop();
      const node = this.#cells[current];
      if (node.open || node.flag) continue;
      node.open = true;
      if (node.count === 0) queue.push(...this.#neighbours(current).filter((next) => !this.#cells[next].open));
    }

    const hidden = this.#cells.filter((item) => !item.open).length;
    if (hidden === this.#config().mines) {
      this.#won = true;
      this.#over = true;
      clearInterval(this.#timer);
    }

    this.#paint();
  }

  #flag(index) {
    const cell = this.#cells[index];
    if (this.#over || cell.open) return;
    cell.flag = !cell.flag;
    this.#paint();
  }

  #paint() {
    const { cols, mines } = this.#config();
    const board = this.$('#board');
    board.style.gridTemplateColumns = `repeat(${cols}, 34px)`;

    board.innerHTML = this.#cells
      .map((cell, index) => {
        const label = cell.flag ? '⚑' : cell.open ? (cell.mine ? '✱' : cell.count || '') : '';
        return `<button class="cell" data-index="${index}" data-open="${cell.open}" data-flag="${cell.flag}" data-mine="${cell.mine}" data-count="${cell.open && !cell.mine ? cell.count : ''}">${label}</button>`;
      })
      .join('');

    this.bind('.cell', 'click', (event) => this.#open(Number(event.currentTarget.dataset.index)));
    this.bind('.cell', 'contextmenu', (event) => {
      event.preventDefault();
      this.#flag(Number(event.currentTarget.dataset.index));
    });

    const flagged = this.#cells.filter((cell) => cell.flag).length;
    this.$('#mines').textContent = `⚑ ${mines - flagged}`;
    this.$('#clock').textContent = `${Math.floor(this.#seconds / 60)}:${String(this.#seconds % 60).padStart(2, '0')}`;
    this.$('#status').textContent = this.#over
      ? this.#won
        ? `Cleared in ${this.#seconds} seconds.`
        : 'You hit a mine.'
      : 'Left click to open, right click or long press to flag.';
  }
}

define('jg-app-game-minesweeper', Minesweeper);
