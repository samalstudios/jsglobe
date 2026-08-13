import { JGApp, define, html, css } from '../core/app.js';
import { randomInt } from '../core/util.js';

const sheet = css`
  .head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .stat {
    display: inline-flex;
    gap: 6px;
    padding: 5px 11px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 75%, transparent);
    border: 1px solid var(--border);
    font: 600 13px/1 var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .wrap { position: relative; display: grid; place-items: center; }
  canvas {
    width: min(580px, 100%, 68vh);
    aspect-ratio: 1;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--muted) 80%, transparent);
    touch-action: none;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    gap: 10px;
    text-align: center;
  }
  .overlay .card {
    padding: 18px 22px;
    border-radius: var(--radius-lg);
    background: var(--glass-strong);
    border: 1px solid var(--glass-border);
    backdrop-filter: var(--glass-blur);
    display: grid;
    gap: 10px;
    justify-items: center;
  }
  .overlay h3 { margin: 0; font-size: 19px; }
`;

const SIZE = 20;
const SPEEDS = { calm: 150, normal: 105, fast: 70 };

class Snake extends JGApp {
  static appId = 'game-snake';
  static styles = [...JGApp.styles, sheet];

  #snake = [];
  #direction = { x: 1, y: 0 };
  #queued = [];
  #food = { x: 10, y: 10 };
  #score = 0;
  #best = 0;
  #state = 'idle';
  #timer = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  renderApp() {
    this.#best = this.store.read({ best: 0 }).best ?? 0;

    this.paint(html`<div class="app">
      <div class="head">
        <span class="title">Snake</span>
        <span class="grow"></span>
        <span class="stat">Score <span id="score">0</span></span>
        <span class="stat">Best <span id="best">0</span></span>
        <jg-select id="speed" value="normal" size="sm" style="width:120px">
          <option value="calm">Calm</option><option value="normal">Normal</option><option value="fast">Fast</option>
        </jg-select>
        <jg-button size="sm" variant="outline" id="new">Restart</jg-button>
      </div>

      <div class="wrap">
        <canvas id="canvas" width="600" height="600"></canvas>
        <div class="overlay" id="overlay"></div>
      </div>

      <div class="center hint">Arrow keys or WASD to steer, space to pause. Swipe on touch screens.</div>
    </div>`);

    this.on(this.$('#new'), 'click', () => this.#start());
    this.on(this.$('#speed'), 'change', () => {
      if (this.#state === 'running') this.#loop();
    });

    this.hotkeys((event) => {
      const key = event.key.toLowerCase();
      const map = {
        arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      };
      if (key === ' ') {
        event.preventDefault();
        this.#toggle();
        return;
      }
      const next = map[key];
      if (!next) return;
      event.preventDefault();
      if (this.#state === 'idle') this.#start();
      this.#queue(next);
    });

    let start = null;
    const canvas = this.$('#canvas');
    this.on(canvas, 'pointerdown', (event) => {
      start = { x: event.clientX, y: event.clientY };
      if (this.#state === 'idle') this.#start();
    });
    this.on(canvas, 'pointerup', (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.hypot(dx, dy) < 20) return;
      this.#queue(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
    });

    this.#reset();
    this.#paint();
  }

  #reset() {
    this.#snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    this.#direction = { x: 1, y: 0 };
    this.#queued = [];
    this.#score = 0;
    this.#state = 'idle';
    this.#dropFood();
  }

  #start() {
    clearInterval(this.#timer);
    this.#reset();
    this.#state = 'running';
    this.#loop();
  }

  #toggle() {
    if (this.#state === 'running') {
      this.#state = 'paused';
      clearInterval(this.#timer);
    } else if (this.#state === 'paused') {
      this.#state = 'running';
      this.#loop();
    }
    this.#paint();
  }

  #loop() {
    clearInterval(this.#timer);
    this.#timer = setInterval(() => this.#tick(), SPEEDS[this.$('#speed').value]);
    this.track(() => clearInterval(this.#timer));
  }

  #queue(direction) {
    const last = this.#queued.at(-1) ?? this.#direction;
    if (last.x === -direction.x && last.y === -direction.y) return;
    if (last.x === direction.x && last.y === direction.y) return;
    this.#queued.push(direction);
  }

  #dropFood() {
    const taken = new Set(this.#snake.map((part) => `${part.x}-${part.y}`));
    let spot;
    do {
      spot = { x: randomInt(SIZE), y: randomInt(SIZE) };
    } while (taken.has(`${spot.x}-${spot.y}`));
    this.#food = spot;
  }

  #tick() {
    if (this.#queued.length) this.#direction = this.#queued.shift();
    const head = {
      x: this.#snake[0].x + this.#direction.x,
      y: this.#snake[0].y + this.#direction.y,
    };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE;
    const hitSelf = this.#snake.some((part) => part.x === head.x && part.y === head.y);

    if (hitWall || hitSelf) {
      this.#state = 'over';
      clearInterval(this.#timer);
      if (this.#score > this.#best) {
        this.#best = this.#score;
        this.store.write({ best: this.#best });
      }
      this.#paint();
      return;
    }

    this.#snake.unshift(head);
    if (head.x === this.#food.x && head.y === this.#food.y) {
      this.#score += 10;
      this.#dropFood();
    } else {
      this.#snake.pop();
    }

    this.#paint();
  }

  #paint() {
    const canvas = this.$('#canvas');
    const context = canvas.getContext('2d');
    const unit = canvas.width / SIZE;
    const styles = getComputedStyle(this);
    const accent = styles.getPropertyValue('--ring').trim() || '#8a1c3b';
    const foreground = styles.getPropertyValue('--foreground').trim() || '#111';

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = accent;
    context.beginPath();
    context.roundRect(this.#food.x * unit + 5, this.#food.y * unit + 5, unit - 10, unit - 10, 8);
    context.fill();

    this.#snake.forEach((part, index) => {
      context.fillStyle = index === 0 ? foreground : `color-mix(in srgb, ${foreground} ${Math.max(25, 90 - index * 3)}%, transparent)`;
      context.globalAlpha = index === 0 ? 1 : Math.max(0.35, 1 - index * 0.03);
      context.beginPath();
      context.roundRect(part.x * unit + 2, part.y * unit + 2, unit - 4, unit - 4, index === 0 ? 9 : 6);
      context.fill();
    });
    context.globalAlpha = 1;

    this.$('#score').textContent = this.#score;
    this.$('#best').textContent = this.#best;

    const overlay = this.$('#overlay');
    if (this.#state === 'running') {
      overlay.innerHTML = '';
      return;
    }

    const titles = { idle: 'Ready when you are', paused: 'Paused', over: 'Game over' };
    overlay.innerHTML = html`<div class="card">
      <h3>${titles[this.#state]}</h3>
      ${this.#state === 'over' ? html`<div class="hint">You scored ${this.#score}</div>` : ''}
      <jg-button id="play">${this.#state === 'paused' ? 'Resume' : 'Play'}</jg-button>
    </div>`;
    this.on(this.$('#play'), 'click', () => (this.#state === 'paused' ? this.#toggle() : this.#start()));
  }
}

define('jg-app-game-snake', Snake);
