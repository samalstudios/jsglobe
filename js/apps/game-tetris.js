import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .layout { display: flex; gap: 16px; justify-content: center; align-items: flex-start; flex-wrap: wrap; }
  .well {
    position: relative;
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    grid-template-rows: repeat(20, 1fr);
    gap: 1px;
    width: min(320px, 74vw);
    aspect-ratio: 1 / 2;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 55%, transparent);
  }
  .brick { border-radius: 2px; background: color-mix(in srgb, var(--foreground) 6%, transparent); }
  .brick[data-fill] { background: var(--brick); box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.25); }
  .brick[data-ghost="true"] { background: color-mix(in srgb, var(--brick) 26%, transparent); }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    gap: 8px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--background) 74%, transparent);
    backdrop-filter: blur(3px);
    font-weight: 600;
    text-align: center;
    padding: 16px;
  }
  .side { display: flex; flex-direction: column; gap: 12px; width: min(200px, 100%); }
  .preview {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 2px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    aspect-ratio: 2;
  }
  .stats { display: grid; gap: 6px; }
  .stat { display: flex; justify-content: space-between; font-size: 12.5px; }
  .stat b { font-family: var(--font-mono); font-weight: 600; }
`;

const SHAPES = {
  I: { colour: '#3f7a75', cells: [[0, 1], [1, 1], [2, 1], [3, 1]], size: 4 },
  J: { colour: '#3f6b91', cells: [[0, 0], [0, 1], [1, 1], [2, 1]], size: 3 },
  L: { colour: '#96703f', cells: [[2, 0], [0, 1], [1, 1], [2, 1]], size: 3 },
  O: { colour: '#847a44', cells: [[1, 0], [2, 0], [1, 1], [2, 1]], size: 4 },
  S: { colour: '#4a7a58', cells: [[1, 0], [2, 0], [0, 1], [1, 1]], size: 3 },
  T: { colour: '#6a5a8c', cells: [[1, 0], [0, 1], [1, 1], [2, 1]], size: 3 },
  Z: { colour: '#8a1c3b', cells: [[0, 0], [1, 0], [1, 1], [2, 1]], size: 3 },
};

const WIDTH = 10;
const HEIGHT = 20;
const SPEEDS = [800, 720, 630, 550, 470, 380, 300, 220, 160, 120, 90];

const rotate = (cells, size) => cells.map(([x, y]) => [size - 1 - y, x]);

const bag = () => Object.keys(SHAPES).sort(() => Math.random() - 0.5);

class GameTetris extends JGApp {
  static appId = 'game-tetris';
  static styles = [...JGApp.styles, sheet];

  #grid = [];
  #piece = null;
  #next = [];
  #queue = [];
  #timer = null;
  #state = 'idle';
  #score = 0;
  #lines = 0;
  #level = 1;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="layout">
        <div class="well" id="well"></div>

        <div class="side">
          <span class="label">Next</span>
          <div class="preview" id="preview"></div>

          <div class="stats">
            <div class="stat"><span>Score</span><b id="score">0</b></div>
            <div class="stat"><span>Lines</span><b id="lines">0</b></div>
            <div class="stat"><span>Level</span><b id="level">1</b></div>
            <div class="stat"><span>Best</span><b id="best">0</b></div>
          </div>

          <div class="row">
            <jg-button size="sm" id="play">Play</jg-button>
            <jg-button size="sm" variant="outline" id="pause">Pause</jg-button>
          </div>

          <div class="hint">
            Arrow keys move and rotate, space drops the piece, and P pauses. Clearing four rows at once scores
            the most.
          </div>
        </div>
      </div>
    </div>`);

    this.#grid = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => null));
    this.$('#best').textContent = String(this.store.read({ best: 0 }).best ?? 0);

    this.on(this.$('#play'), 'click', () => this.#start());
    this.on(this.$('#pause'), 'click', () => this.#pause());

    this.hotkeys((event) => {
      const key = event.key.toLowerCase();
      if (key === 'p') return this.#pause();
      if (this.#state !== 'running') {
        if (key === ' ' || key === 'enter') {
          event.preventDefault();
          this.#start();
        }
        return undefined;
      }
      if (event.key === 'ArrowLeft' || key === 'a') {
        event.preventDefault();
        this.#move(-1, 0);
      } else if (event.key === 'ArrowRight' || key === 'd') {
        event.preventDefault();
        this.#move(1, 0);
      } else if (event.key === 'ArrowDown' || key === 's') {
        event.preventDefault();
        if (this.#move(0, 1)) this.#score += 1;
      } else if (event.key === 'ArrowUp' || key === 'w') {
        event.preventDefault();
        this.#rotate();
      } else if (key === ' ') {
        event.preventDefault();
        this.#drop();
      }
      return undefined;
    });

    this.#paint();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  #start() {
    clearInterval(this.#timer);
    this.#grid = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => null));
    this.#queue = [...bag(), ...bag()];
    this.#score = 0;
    this.#lines = 0;
    this.#level = 1;
    this.#state = 'running';
    this.#spawn();
    this.#tickRate();
  }

  #tickRate() {
    clearInterval(this.#timer);
    const speed = SPEEDS[Math.min(SPEEDS.length - 1, this.#level - 1)];
    this.#timer = setInterval(() => this.#fall(), speed);
  }

  #pause() {
    if (this.#state === 'running') {
      this.#state = 'paused';
      clearInterval(this.#timer);
    } else if (this.#state === 'paused') {
      this.#state = 'running';
      this.#tickRate();
    }
    this.#paint();
  }

  #spawn() {
    if (this.#queue.length < 7) this.#queue.push(...bag());
    const name = this.#queue.shift();
    const shape = SHAPES[name];
    this.#piece = { name, cells: shape.cells.map(([x, y]) => [x, y]), size: shape.size, colour: shape.colour, x: 3, y: -1 };
    this.#next = this.#queue.slice(0, 1);

    if (this.#collides(this.#piece.cells, this.#piece.x, this.#piece.y)) {
      this.#state = 'over';
      clearInterval(this.#timer);
      const best = Math.max(this.#score, this.store.read({ best: 0 }).best ?? 0);
      this.store.write({ best });
      this.$('#best').textContent = String(best);
    }
    this.#paint();
  }

  #collides(cells, offsetX, offsetY) {
    return cells.some(([x, y]) => {
      const column = offsetX + x;
      const row = offsetY + y;
      if (column < 0 || column >= WIDTH || row >= HEIGHT) return true;
      if (row < 0) return false;
      return Boolean(this.#grid[row][column]);
    });
  }

  #move(dx, dy) {
    if (!this.#piece || this.#state !== 'running') return false;
    if (this.#collides(this.#piece.cells, this.#piece.x + dx, this.#piece.y + dy)) return false;
    this.#piece.x += dx;
    this.#piece.y += dy;
    this.#paint();
    return true;
  }

  #rotate() {
    if (!this.#piece) return;
    const rotated = rotate(this.#piece.cells, this.#piece.size);
    for (const shift of [0, -1, 1, -2, 2]) {
      if (!this.#collides(rotated, this.#piece.x + shift, this.#piece.y)) {
        this.#piece.cells = rotated;
        this.#piece.x += shift;
        this.#paint();
        return;
      }
    }
  }

  #drop() {
    if (!this.#piece) return;
    let distance = 0;
    while (!this.#collides(this.#piece.cells, this.#piece.x, this.#piece.y + 1)) {
      this.#piece.y += 1;
      distance += 1;
    }
    this.#score += distance * 2;
    this.#lock();
  }

  #fall() {
    if (!this.#move(0, 1)) this.#lock();
  }

  #lock() {
    if (!this.#piece) return;
    this.#piece.cells.forEach(([x, y]) => {
      const row = this.#piece.y + y;
      const column = this.#piece.x + x;
      if (row >= 0) this.#grid[row][column] = this.#piece.colour;
    });

    const kept = this.#grid.filter((row) => row.some((cell) => !cell));
    const cleared = HEIGHT - kept.length;

    if (cleared) {
      this.#grid = [
        ...Array.from({ length: cleared }, () => Array.from({ length: WIDTH }, () => null)),
        ...kept,
      ];
      this.#lines += cleared;
      this.#score += [0, 100, 300, 500, 800][cleared] * this.#level;
      const level = Math.floor(this.#lines / 10) + 1;
      if (level !== this.#level) {
        this.#level = level;
        this.#tickRate();
      }
    }

    this.#spawn();
  }

  #paint() {
    const cells = Array.from({ length: HEIGHT }, (row, y) => this.#grid[y].map((colour) => ({ colour, ghost: false })));

    if (this.#piece && this.#state !== 'over') {
      let ghostY = this.#piece.y;
      while (!this.#collides(this.#piece.cells, this.#piece.x, ghostY + 1)) ghostY += 1;

      this.#piece.cells.forEach(([x, y]) => {
        const row = ghostY + y;
        const column = this.#piece.x + x;
        if (row >= 0 && row < HEIGHT && !cells[row][column].colour) cells[row][column] = { colour: this.#piece.colour, ghost: true };
      });

      this.#piece.cells.forEach(([x, y]) => {
        const row = this.#piece.y + y;
        const column = this.#piece.x + x;
        if (row >= 0 && row < HEIGHT) cells[row][column] = { colour: this.#piece.colour, ghost: false };
      });
    }

    const overlay =
      this.#state === 'over'
        ? html`<div class="overlay"><div>Game over<br /><span class="hint">Score ${this.#score}. Press space to play again.</span></div></div>`
        : this.#state === 'paused'
          ? html`<div class="overlay">Paused</div>`
          : this.#state === 'idle'
            ? html`<div class="overlay"><div>Press play<br /><span class="hint">or hit space</span></div></div>`
            : '';

    this.$('#well').innerHTML =
      cells
        .flat()
        .map((cell) =>
          cell.colour
            ? html`<span class="brick" data-fill data-ghost="${String(cell.ghost)}" style="--brick:${cell.colour}"></span>`
            : html`<span class="brick"></span>`,
        )
        .join('') + String(overlay);

    const next = SHAPES[this.#next[0]] ?? null;
    this.$('#preview').innerHTML = next
      ? Array.from({ length: 8 }, (item, index) => {
          const x = index % 4;
          const y = Math.floor(index / 4);
          const filled = next.cells.some(([cellX, cellY]) => cellX === x && cellY === y);
          return filled
            ? html`<span class="brick" data-fill style="--brick:${next.colour}"></span>`
            : html`<span class="brick"></span>`;
        }).join('')
      : '';

    this.$('#score').textContent = String(this.#score);
    this.$('#lines').textContent = String(this.#lines);
    this.$('#level').textContent = String(this.#level);
  }
}

define('jg-app-game-tetris', GameTetris);
