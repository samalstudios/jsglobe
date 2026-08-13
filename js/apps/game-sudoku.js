import { JGApp, define, html, css } from '../core/app.js';
import { toast } from '../core/util.js';

const sheet = css`
  .layout { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; justify-content: center; }
  .board {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    width: min(460px, 100%);
    aspect-ratio: 1;
    border: 2px solid var(--foreground);
    border-radius: 6px;
    overflow: hidden;
    background: var(--border-strong);
    gap: 1px;
  }
  .cell {
    position: relative;
    display: grid;
    place-items: center;
    background: var(--card);
    border: 0;
    font-family: var(--font-sans);
    font-size: clamp(15px, 3.4vw, 22px);
    font-weight: 500;
    color: var(--ring);
    cursor: pointer;
    padding: 0;
  }
  .cell[data-given="true"] { color: var(--foreground); font-weight: 650; cursor: default; }
  .cell[data-peer="true"] { background: color-mix(in srgb, var(--foreground) 5%, var(--card)); }
  .cell[data-same="true"] { background: color-mix(in srgb, var(--ring) 16%, var(--card)); }
  .cell[data-selected="true"] { background: color-mix(in srgb, var(--ring) 28%, var(--card)); }
  .cell[data-wrong="true"] { color: var(--destructive); }
  .cell[data-edge-right="true"] { box-shadow: 2px 0 0 var(--foreground); z-index: 1; }
  .cell[data-edge-bottom="true"] { box-shadow: 0 2px 0 var(--foreground); z-index: 1; }
  .cell[data-edge-right="true"][data-edge-bottom="true"] { box-shadow: 2px 0 0 var(--foreground), 0 2px 0 var(--foreground); }
  .notes {
    position: absolute;
    inset: 2px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    font-size: 8px;
    line-height: 1;
    color: var(--muted-foreground);
    pointer-events: none;
  }
  .notes span { display: grid; place-items: center; }
  .side { display: flex; flex-direction: column; gap: 12px; width: min(240px, 100%); }
  .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .pad button {
    aspect-ratio: 1.35;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    color: var(--foreground);
    font: 600 17px/1 var(--font-sans);
    cursor: pointer;
  }
  .pad button:hover { border-color: var(--border-strong); background: var(--accent); }
  .pad button[data-done="true"] { opacity: 0.35; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; }
  .stat { padding: 7px 4px; border: 1px solid var(--border); border-radius: var(--radius-md); }
  .stat .value { font: 650 16px/1.2 var(--font-mono); }
  .stat .name { font-size: 10.5px; color: var(--muted-foreground); }
`;

const LEVELS = { easy: 40, medium: 32, hard: 27, expert: 24 };

const solved = (grid) => grid.every((value) => value !== 0);

const allowed = (grid, index, value) => {
  const row = Math.floor(index / 9);
  const column = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;

  for (let step = 0; step < 9; step += 1) {
    if (grid[row * 9 + step] === value && row * 9 + step !== index) return false;
    if (grid[step * 9 + column] === value && step * 9 + column !== index) return false;
    const cell = (boxRow + Math.floor(step / 3)) * 9 + boxColumn + (step % 3);
    if (grid[cell] === value && cell !== index) return false;
  }
  return true;
};

const fill = (grid) => {
  const index = grid.indexOf(0);
  if (index < 0) return true;
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
  for (const value of values) {
    if (!allowed(grid, index, value)) continue;
    grid[index] = value;
    if (fill(grid)) return true;
    grid[index] = 0;
  }
  return false;
};

const countSolutions = (grid, limit = 2) => {
  const index = grid.indexOf(0);
  if (index < 0) return 1;
  let total = 0;
  for (let value = 1; value <= 9; value += 1) {
    if (!allowed(grid, index, value)) continue;
    grid[index] = value;
    total += countSolutions(grid, limit - total);
    grid[index] = 0;
    if (total >= limit) break;
  }
  return total;
};

const generate = (clues) => {
  const solution = new Array(81).fill(0);
  fill(solution);

  const puzzle = [...solution];
  const order = Array.from({ length: 81 }, (item, index) => index).sort(() => Math.random() - 0.5);

  for (const index of order) {
    if (puzzle.filter((value) => value !== 0).length <= clues) break;
    const previous = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions([...puzzle]) !== 1) puzzle[index] = previous;
  }

  return { puzzle, solution };
};

class GameSudoku extends JGApp {
  static appId = 'game-sudoku';
  static styles = [...JGApp.styles, sheet];

  #puzzle = [];
  #solution = [];
  #values = [];
  #notes = [];
  #selected = null;
  #noteMode = false;
  #mistakes = 0;
  #startedAt = 0;
  #timer = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-segment id="level"></jg-segment>
        <span class="grow"></span>
        <jg-button size="sm" variant="outline" id="new">New game</jg-button>
      </div>

      <div class="layout">
        <div class="board" id="board"></div>

        <div class="side">
          <div class="stats">
            <div class="stat"><div class="value" id="time">0:00</div><div class="name">Time</div></div>
            <div class="stat"><div class="value" id="mistakes">0</div><div class="name">Mistakes</div></div>
            <div class="stat"><div class="value" id="left">0</div><div class="name">Empty</div></div>
          </div>

          <div class="pad" id="pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => html`<button data-value="${value}">${value}</button>`)}
          </div>

          <div class="row">
            <jg-button size="sm" variant="outline" id="notes">Notes off</jg-button>
            <jg-button size="sm" variant="ghost" id="erase">Erase</jg-button>
          </div>
          <div class="row">
            <jg-button size="sm" variant="ghost" id="hint">Hint</jg-button>
            <jg-button size="sm" variant="ghost" id="check">Check</jg-button>
          </div>

          <div class="hint">
            Click a cell then type a number. Notes mode writes small candidates, and the arrow keys move around
            the grid.
          </div>
        </div>
      </div>
    </div>`);

    const level = this.$('#level');
    level.items = Object.keys(LEVELS).map((key) => ({ value: key, label: key[0].toUpperCase() + key.slice(1) }));
    level.value = this.store.read({ level: 'easy' }).level ?? 'easy';
    this.on(level, 'change', () => this.#start());

    this.on(this.$('#new'), 'click', () => this.#start());
    this.on(this.$('#notes'), 'click', () => {
      this.#noteMode = !this.#noteMode;
      this.$('#notes').textContent = this.#noteMode ? 'Notes on' : 'Notes off';
    });
    this.on(this.$('#erase'), 'click', () => this.#place(0));
    this.on(this.$('#hint'), 'click', () => this.#hint());
    this.on(this.$('#check'), 'click', () => this.#check());
    this.bind('[data-value]', 'click', (event) => this.#place(Number(event.currentTarget.dataset.value)));

    this.hotkeys((event) => {
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        this.#place(Number(event.key));
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
        event.preventDefault();
        this.#place(0);
        return;
      }
      if (event.key === 'n') {
        this.#noteMode = !this.#noteMode;
        this.$('#notes').textContent = this.#noteMode ? 'Notes on' : 'Notes off';
        return;
      }
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
      if (moves[event.key] && this.#selected !== null) {
        event.preventDefault();
        const next = this.#selected + moves[event.key];
        if (next >= 0 && next < 81) {
          if (moves[event.key] === -1 && this.#selected % 9 === 0) return;
          if (moves[event.key] === 1 && this.#selected % 9 === 8) return;
          this.#selected = next;
          this.#paint();
        }
      }
    });

    this.#start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  #start() {
    const level = this.$('#level').value;
    this.store.write({ level });

    const { puzzle, solution } = generate(LEVELS[level] ?? 40);
    this.#puzzle = puzzle;
    this.#solution = solution;
    this.#values = [...puzzle];
    this.#notes = Array.from({ length: 81 }, () => new Set());
    this.#selected = this.#values.indexOf(0);
    this.#mistakes = 0;
    this.#startedAt = Date.now();

    clearInterval(this.#timer);
    this.#timer = setInterval(() => this.#tick(), 500);
    this.#paint();
  }

  #tick() {
    const seconds = Math.floor((Date.now() - this.#startedAt) / 1000);
    this.$('#time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  #place(value) {
    if (this.#selected === null) return;
    const index = this.#selected;
    if (this.#puzzle[index] !== 0) return;

    if (value === 0) {
      this.#values[index] = 0;
      this.#notes[index].clear();
      this.#paint();
      return;
    }

    if (this.#noteMode) {
      if (this.#notes[index].has(value)) this.#notes[index].delete(value);
      else this.#notes[index].add(value);
      this.#values[index] = 0;
      this.#paint();
      return;
    }

    this.#values[index] = value;
    this.#notes[index].clear();
    if (value !== this.#solution[index]) this.#mistakes += 1;
    this.#paint();

    if (solved(this.#values) && this.#values.every((entry, position) => entry === this.#solution[position])) {
      clearInterval(this.#timer);
      const seconds = Math.floor((Date.now() - this.#startedAt) / 1000);
      toast(`Solved in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} with ${this.#mistakes} mistakes`, 'success');
    }
  }

  #hint() {
    const empties = this.#values.map((value, index) => (value === 0 ? index : -1)).filter((index) => index >= 0);
    if (!empties.length) return;
    const index = empties[Math.floor(Math.random() * empties.length)];
    this.#values[index] = this.#solution[index];
    this.#notes[index].clear();
    this.#selected = index;
    this.#paint();
  }

  #check() {
    const wrong = this.#values.filter((value, index) => value !== 0 && value !== this.#solution[index]).length;
    toast(wrong ? `${wrong} cell${wrong === 1 ? '' : 's'} do not match the solution` : 'Everything filled in so far is correct', wrong ? 'error' : 'success');
  }

  #paint() {
    const selectedValue = this.#selected === null ? 0 : this.#values[this.#selected];
    const selectedRow = this.#selected === null ? -1 : Math.floor(this.#selected / 9);
    const selectedColumn = this.#selected === null ? -1 : this.#selected % 9;

    this.$('#board').innerHTML = this.#values
      .map((value, index) => {
        const row = Math.floor(index / 9);
        const column = index % 9;
        const given = this.#puzzle[index] !== 0;
        const notes = this.#notes[index];

        return html`<button
          class="cell"
          data-index="${index}"
          data-given="${String(given)}"
          data-selected="${String(index === this.#selected)}"
          data-same="${String(value !== 0 && value === selectedValue && index !== this.#selected)}"
          data-peer="${String(index !== this.#selected && (row === selectedRow || column === selectedColumn))}"
          data-wrong="${String(value !== 0 && !given && value !== this.#solution[index])}"
          data-edge-right="${String(column === 2 || column === 5)}"
          data-edge-bottom="${String(row === 2 || row === 5)}"
        >${
          value
            ? value
            : notes.size
              ? html`<span class="notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((entry) => html`<span>${notes.has(entry) ? entry : ''}</span>`)}</span>`
              : ''
        }</button>`;
      })
      .join('');

    this.bind('[data-index]', 'click', (event) => {
      this.#selected = Number(event.currentTarget.dataset.index);
      this.#paint();
    });

    const counts = new Map();
    this.#values.forEach((value) => value && counts.set(value, (counts.get(value) ?? 0) + 1));
    this.$$('[data-value]').forEach((node) => {
      node.dataset.done = String((counts.get(Number(node.dataset.value)) ?? 0) >= 9);
    });

    this.$('#mistakes').textContent = String(this.#mistakes);
    this.$('#left').textContent = String(this.#values.filter((value) => value === 0).length);
    this.#tick();
  }
}

define('jg-app-game-sudoku', GameSudoku);
