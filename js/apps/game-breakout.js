import { JGApp, define, html, css } from '../core/app.js';

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
    width: min(900px, 100%);
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--muted) 80%, transparent);
    touch-action: none;
    cursor: none;
  }
  .overlay { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
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

const WIDTH = 640;
const HEIGHT = 480;
const ROWS = 6;
const COLUMNS = 11;
const TONES = ['#b0553f', '#c78a34', '#847a44', '#4f7f6b', '#3f6b91', '#6f5a9c'];

class Breakout extends JGApp {
  static appId = 'game-breakout';
  static styles = [...JGApp.styles, sheet];

  #bricks = [];
  #paddle = { x: WIDTH / 2, width: 96 };
  #ball = { x: WIDTH / 2, y: HEIGHT - 60, dx: 3.4, dy: -3.4, radius: 6 };
  #score = 0;
  #best = 0;
  #lives = 3;
  #level = 1;
  #state = 'idle';
  #keys = new Set();
  #frame = null;

  renderApp() {
    this.#best = this.store.read({ best: 0 }).best ?? 0;

    this.paint(html`<div class="app">
      <div class="head">
        <span class="title">Breakout</span>
        <span class="grow"></span>
        <span class="stat">Score <span id="score">0</span></span>
        <span class="stat">Best <span id="best">${this.#best}</span></span>
        <span class="stat">Lives <span id="lives">3</span></span>
        <span class="stat">Level <span id="level">1</span></span>
        <jg-button size="sm" variant="outline" id="new">Restart</jg-button>
      </div>
      <div class="wrap">
        <canvas id="view" width="${WIDTH}" height="${HEIGHT}"></canvas>
        <div class="overlay" id="overlay">
          <div class="card">
            <h3 id="title">Break every brick</h3>
            <div class="hint">Move with the mouse or arrow keys. Space serves.</div>
            <jg-button size="sm" id="start">Play</jg-button>
          </div>
        </div>
      </div>
    </div>`);

    this.#reset();
    this.#paint();

    this.on(this.$('#start'), 'click', () => this.#play());
    this.on(this.$('#new'), 'click', () => {
      this.#reset();
      this.#play();
    });

    const canvas = this.$('#view');
    this.on(canvas, 'pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.#paddle.x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      if (this.#state !== 'running') this.#paint();
    });
    this.on(canvas, 'pointerdown', () => {
      if (this.#state !== 'running') this.#play();
    });

    this.hotkeys((event) => {
      if (event.key === ' ') {
        event.preventDefault();
        if (this.#state === 'running') this.#pause();
        else this.#play();
        return;
      }
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        this.#keys.add(event.key);
      }
    });
    this.hotkeys((event) => this.#keys.delete(event.key), { type: 'keyup' });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.#frame);
  }

  #reset() {
    this.#score = 0;
    this.#lives = 3;
    this.#level = 1;
    this.#build();
    this.#serve();
    this.#sync();
  }

  #build() {
    this.#bricks = [];
    const margin = 34;
    const width = (WIDTH - margin * 2) / COLUMNS;
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        this.#bricks.push({
          x: margin + column * width,
          y: 64 + row * 22,
          width: width - 4,
          height: 18,
          tone: TONES[row % TONES.length],
          alive: true,
          points: (ROWS - row) * 10,
        });
      }
    }
  }

  #serve() {
    const speed = 3.4 + this.#level * 0.35;
    this.#ball = { x: WIDTH / 2, y: HEIGHT - 70, dx: speed * (Math.random() > 0.5 ? 1 : -1), dy: -speed, radius: 6 };
    this.#paddle.width = Math.max(58, 96 - this.#level * 5);
  }

  #play() {
    if (this.#state === 'over') this.#reset();
    this.#state = 'running';
    this.$('#overlay').hidden = true;
    cancelAnimationFrame(this.#frame);
    const step = () => {
      this.#tick();
      this.#paint();
      if (this.#state === 'running') this.#frame = requestAnimationFrame(step);
    };
    this.#frame = requestAnimationFrame(step);
    this.track(() => cancelAnimationFrame(this.#frame));
  }

  #pause() {
    this.#state = 'paused';
    this.#show('Paused', 'Press space to carry on.');
  }

  #show(title, hint) {
    const overlay = this.$('#overlay');
    overlay.hidden = false;
    this.$('#title').textContent = title;
    overlay.querySelector('.hint').textContent = hint;
  }

  #sync() {
    this.$('#score').textContent = this.#score;
    this.$('#best').textContent = this.#best;
    this.$('#lives').textContent = this.#lives;
    this.$('#level').textContent = this.#level;
  }

  #tick() {
    if (this.#keys.has('ArrowLeft')) this.#paddle.x -= 7;
    if (this.#keys.has('ArrowRight')) this.#paddle.x += 7;
    this.#paddle.x = Math.max(this.#paddle.width / 2, Math.min(WIDTH - this.#paddle.width / 2, this.#paddle.x));

    const ball = this.#ball;
    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x < ball.radius || ball.x > WIDTH - ball.radius) {
      ball.dx *= -1;
      ball.x = Math.max(ball.radius, Math.min(WIDTH - ball.radius, ball.x));
    }
    if (ball.y < ball.radius) {
      ball.dy *= -1;
      ball.y = ball.radius;
    }

    const paddleTop = HEIGHT - 34;
    if (
      ball.dy > 0 &&
      ball.y + ball.radius >= paddleTop &&
      ball.y - ball.radius <= paddleTop + 12 &&
      Math.abs(ball.x - this.#paddle.x) <= this.#paddle.width / 2 + ball.radius
    ) {
      const offset = (ball.x - this.#paddle.x) / (this.#paddle.width / 2);
      const speed = Math.hypot(ball.dx, ball.dy);
      const angle = offset * 1.05;
      ball.dx = Math.sin(angle) * speed;
      ball.dy = -Math.abs(Math.cos(angle) * speed);
      ball.y = paddleTop - ball.radius;
    }

    this.#bricks.forEach((brick) => {
      if (!brick.alive) return;
      if (
        ball.x + ball.radius < brick.x ||
        ball.x - ball.radius > brick.x + brick.width ||
        ball.y + ball.radius < brick.y ||
        ball.y - ball.radius > brick.y + brick.height
      ) {
        return;
      }
      brick.alive = false;
      this.#score += brick.points;
      const fromSide =
        ball.x < brick.x || ball.x > brick.x + brick.width ? true : false;
      if (fromSide) ball.dx *= -1;
      else ball.dy *= -1;
      this.#sync();
    });

    if (!this.#bricks.some((brick) => brick.alive)) {
      this.#level += 1;
      this.#build();
      this.#serve();
      this.#sync();
      return;
    }

    if (ball.y > HEIGHT + 20) {
      this.#lives -= 1;
      this.#sync();
      if (this.#lives <= 0) {
        this.#state = 'over';
        if (this.#score > this.#best) {
          this.#best = this.#score;
          this.store.write({ best: this.#best });
        }
        this.#sync();
        this.#show('Game over', `You scored ${this.#score}. Play again?`);
        return;
      }
      this.#serve();
    }
  }

  #paint() {
    const canvas = this.$('#view');
    const context = canvas.getContext('2d');
    const styles = getComputedStyle(this);
    const foreground = styles.getPropertyValue('--foreground').trim() || '#111';
    const ring = styles.getPropertyValue('--ring').trim() || '#8a1c3b';

    context.clearRect(0, 0, WIDTH, HEIGHT);

    this.#bricks.forEach((brick) => {
      if (!brick.alive) return;
      context.fillStyle = brick.tone;
      context.beginPath();
      context.roundRect(brick.x, brick.y, brick.width, brick.height, 4);
      context.fill();
    });

    context.fillStyle = foreground;
    context.beginPath();
    context.roundRect(this.#paddle.x - this.#paddle.width / 2, HEIGHT - 34, this.#paddle.width, 11, 6);
    context.fill();

    context.fillStyle = ring;
    context.beginPath();
    context.arc(this.#ball.x, this.#ball.y, this.#ball.radius, 0, Math.PI * 2);
    context.fill();
  }
}

define('jg-app-game-breakout', Breakout);
