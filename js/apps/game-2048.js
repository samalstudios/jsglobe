import { JGApp, define, html, css } from '../core/app.js';
import { randomInt } from '../core/util.js';

const sheet = css`
  .head { display: flex; align-items: center; gap: 10px; }
  .score {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 78px;
    padding: 6px 12px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 75%, transparent);
    border: 1px solid var(--border);
  }
  .score .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-foreground); }
  .score .value { font: 700 18px/1.2 var(--font-sans); font-variant-numeric: tabular-nums; }
  .board {
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 8px;
    width: min(560px, 100%, 68vh);
    aspect-ratio: 1;
    margin: 0 auto;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 80%, transparent);
    border: 1px solid var(--border);
    touch-action: none;
    user-select: none;
  }
  .tile {
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--foreground) 5%, transparent);
    font: 700 clamp(18px, 6vw, 34px)/1 var(--font-sans);
    color: var(--foreground);
    transition: transform 0.1s ease;
  }
  .tile[data-value="0"] { color: transparent; }
  .tile[data-new="true"] { animation: pop 0.16s ease; }
  @keyframes pop { from { transform: scale(0.6); } to { transform: none; } }
  .tile[data-value="2"] { background: #eee4da; color: #6b6154; }
  .tile[data-value="4"] { background: #ede0c8; color: #6b6154; }
  .tile[data-value="8"] { background: #f2b179; color: #fff; }
  .tile[data-value="16"] { background: #f59563; color: #fff; }
  .tile[data-value="32"] { background: #f67c5f; color: #fff; }
  .tile[data-value="64"] { background: #f65e3b; color: #fff; }
  .tile[data-value="128"] { background: #edcf72; color: #fff; font-size: clamp(16px, 5vw, 29px); }
  .tile[data-value="256"] { background: #edcc61; color: #fff; font-size: clamp(16px, 5vw, 29px); }
  .tile[data-value="512"] { background: #edc850; color: #fff; font-size: clamp(16px, 5vw, 29px); }
  .tile[data-value="1024"] { background: #edc53f; color: #fff; font-size: clamp(14px, 4.2vw, 24px); }
  .tile[data-value="2048"] { background: #edc22e; color: #fff; font-size: clamp(14px, 4.2vw, 24px); }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    gap: 10px;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--background) 72%, transparent);
    backdrop-filter: blur(3px);
    text-align: center;
  }
  .overlay h3 { margin: 0; font-size: 22px; }
`;

const EMPTY = () => Array.from({ length: 4 }, () => [0, 0, 0, 0]);

const rotate = (grid) => grid[0].map((unused, index) => grid.map((row) => row[index]).reverse());

const slide = (row) => {
  const values = row.filter(Boolean);
  const merged = [];
  let gained = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === values[i + 1]) {
      merged.push(values[i] * 2);
      gained += values[i] * 2;
      i += 1;
    } else {
      merged.push(values[i]);
    }
  }
  while (merged.length < 4) merged.push(0);
  return { row: merged, gained };
};

class Game2048 extends JGApp {
  static appId = 'game-2048';
  static styles = [...JGApp.styles, sheet];

  #grid = EMPTY();
  #score = 0;
  #best = 0;
  #over = false;
  #won = false;
  #kept = false;
  #fresh = new Set();

  renderApp() {
    const saved = this.store.read({ best: 0 });
    this.#best = saved.best ?? 0;
    if (!this.#grid.flat().some(Boolean)) this.#reset();

    this.paint(html`<div class="app">
      <div class="head">
        <span class="title">2048</span>
        <span class="grow"></span>
        <span class="score"><span class="label">Score</span><span class="value" id="score">0</span></span>
        <span class="score"><span class="label">Best</span><span class="value" id="best">0</span></span>
        <jg-button size="sm" variant="outline" id="new">New game</jg-button>
      </div>

      <div class="board" id="board"></div>

      <div class="hint" style="text-align:center">
        Join the tiles to reach 2048. Use the arrow keys or WASD, or swipe on a touch screen.
      </div>
    </div>`);

    this.on(this.$('#new'), 'click', () => {
      this.#reset();
      this.#paint();
    });

    this.hotkeys((event) => {
      const moves = {
        ArrowLeft: 'left', a: 'left',
        ArrowRight: 'right', d: 'right',
        ArrowUp: 'up', w: 'up',
        ArrowDown: 'down', s: 'down',
      };
      const direction = moves[event.key] ?? moves[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault();
      this.#move(direction);
    });

    let start = null;
    const board = this.$('#board');
    this.on(board, 'pointerdown', (event) => {
      start = { x: event.clientX, y: event.clientY };
    });
    this.on(board, 'pointerup', (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.hypot(dx, dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) this.#move(dx > 0 ? 'right' : 'left');
      else this.#move(dy > 0 ? 'down' : 'up');
    });

    this.#paint();
  }

  #reset() {
    this.#grid = EMPTY();
    this.#score = 0;
    this.#over = false;
    this.#won = false;
    this.#kept = false;
    this.#spawn();
    this.#spawn();
  }

  #spawn() {
    const free = [];
    this.#grid.forEach((row, y) => row.forEach((value, x) => !value && free.push([x, y])));
    if (!free.length) return;
    const [x, y] = free[randomInt(free.length)];
    this.#grid[y][x] = randomInt(10) === 0 ? 4 : 2;
    this.#fresh.add(`${x}-${y}`);
  }

  #move(direction) {
    if (this.#over) return;
    const turns = { left: 0, down: 1, right: 2, up: 3 }[direction];
    let grid = this.#grid.map((row) => [...row]);
    for (let i = 0; i < turns; i += 1) grid = rotate(grid);

    let gained = 0;
    const moved = grid.map((row) => {
      const result = slide(row);
      gained += result.gained;
      return result.row;
    });

    let restored = moved;
    for (let i = 0; i < (4 - turns) % 4; i += 1) restored = rotate(restored);

    if (JSON.stringify(restored) === JSON.stringify(this.#grid)) return;

    this.#grid = restored;
    this.#score += gained;
    this.#fresh.clear();
    this.#spawn();

    if (this.#score > this.#best) {
      this.#best = this.#score;
      this.store.write({ best: this.#best });
    }
    if (!this.#kept && this.#grid.flat().includes(2048)) this.#won = true;
    if (!this.#canMove()) this.#over = true;

    this.#paint();
  }

  #canMove() {
    if (this.#grid.flat().includes(0)) return true;
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) {
        if (x < 3 && this.#grid[y][x] === this.#grid[y][x + 1]) return true;
        if (y < 3 && this.#grid[y][x] === this.#grid[y + 1][x]) return true;
      }
    }
    return false;
  }

  #paint() {
    this.$('#score').textContent = this.#score;
    this.$('#best').textContent = this.#best;
    const board = this.$('#board');

    board.innerHTML =
      this.#grid
        .map((row, y) =>
          row
            .map(
              (value, x) =>
                `<div class="tile" data-value="${value}" data-new="${this.#fresh.has(`${x}-${y}`)}">${value || ''}</div>`,
            )
            .join(''),
        )
        .join('') +
      (this.#over || (this.#won && !this.#kept)
        ? `<div class="overlay">
            <div>
              <h3>${this.#over ? 'No moves left' : 'You reached 2048'}</h3>
              <div class="hint">Score ${this.#score}</div>
            </div>
            <jg-button id="again">${this.#over ? 'Try again' : 'Keep going'}</jg-button>
          </div>`
        : '');

    const again = this.$('#again');
    if (again) {
      this.on(again, 'click', () => {
        if (this.#over) this.#reset();
        else {
          this.#kept = true;
          this.#won = false;
        }
        this.#paint();
      });
    }
  }
}

define('jg-app-game-2048', Game2048);
