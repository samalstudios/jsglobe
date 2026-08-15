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
    width: min(960px, 100%);
    aspect-ratio: 16 / 10;
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
const HEIGHT = 400;
const PADDLE = { width: 10, height: 74 };
const TARGET = 11;

const SKILL = { easy: 0.055, normal: 0.085, hard: 0.13 };

class Pong extends JGApp {
  static appId = 'game-pong';
  static settings = [
    { key: 'skill', label: 'Opponent skill', type: 'select', default: 'normal', options: [
      { value: 'easy', label: 'Easy' },
      { value: 'normal', label: 'Normal' },
      { value: 'hard', label: 'Hard' },
    ] },
  ];
  static styles = [...JGApp.styles, sheet];

  #player = HEIGHT / 2;
  #rival = HEIGHT / 2;
  #ball = { x: WIDTH / 2, y: HEIGHT / 2, dx: 4, dy: 2 };
  #score = { player: 0, rival: 0 };
  #state = 'idle';
  #keys = new Set();
  #frame = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head">
        <span class="title">Pong</span>
        <span class="grow"></span>
        <span class="stat">You <span id="you">0</span></span>
        <span class="stat">CPU <span id="cpu">0</span></span>
        <jg-select id="skill" size="sm" value="${this.config.get('skill', 'normal')}" style="width:120px">
          <option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option>
        </jg-select>
        <jg-button size="sm" variant="outline" id="new">Restart</jg-button>
      </div>
      <div class="wrap">
        <canvas id="view" width="${WIDTH}" height="${HEIGHT}"></canvas>
        <div class="overlay" id="overlay">
          <div class="card">
            <h3 id="title">First to ${TARGET}</h3>
            <div class="hint">Move with the mouse or the up and down arrows.</div>
            <jg-button size="sm" id="start">Play</jg-button>
          </div>
        </div>
      </div>
    </div>`);

    this.#paint();

    this.on(this.$('#start'), 'click', () => this.#play());
    this.on(this.$('#new'), 'click', () => {
      this.#score = { player: 0, rival: 0 };
      this.#sync();
      this.#serve(1);
      this.#play();
    });
    this.on(this.$('#skill'), 'change', (event) => this.config.set('skill', event.detail.value));

    const canvas = this.$('#view');
    this.on(canvas, 'pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.#player = ((event.clientY - rect.top) / rect.height) * HEIGHT;
      if (this.#state !== 'running') this.#paint();
    });
    this.on(canvas, 'pointerdown', () => {
      if (this.#state !== 'running') this.#play();
    });

    this.hotkeys((event) => {
      if (event.key === ' ') {
        event.preventDefault();
        if (this.#state === 'running') this.#state = 'paused';
        else this.#play();
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
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

  #serve(direction) {
    this.#ball = {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      dx: 4.2 * direction,
      dy: (Math.random() * 2 - 1) * 2.6,
    };
  }

  #play() {
    if (this.#score.player >= TARGET || this.#score.rival >= TARGET) {
      this.#score = { player: 0, rival: 0 };
      this.#sync();
      this.#serve(1);
    }
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

  #sync() {
    this.$('#you').textContent = this.#score.player;
    this.$('#cpu').textContent = this.#score.rival;
  }

  #tick() {
    if (this.#keys.has('ArrowUp')) this.#player -= 7;
    if (this.#keys.has('ArrowDown')) this.#player += 7;
    this.#player = Math.max(PADDLE.height / 2, Math.min(HEIGHT - PADDLE.height / 2, this.#player));

    const skill = SKILL[this.config.get('skill', 'normal')] ?? SKILL.normal;
    this.#rival += (this.#ball.y - this.#rival) * skill;
    this.#rival = Math.max(PADDLE.height / 2, Math.min(HEIGHT - PADDLE.height / 2, this.#rival));

    const ball = this.#ball;
    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.y < 6 || ball.y > HEIGHT - 6) {
      ball.dy *= -1;
      ball.y = Math.max(6, Math.min(HEIGHT - 6, ball.y));
    }

    const hit = (paddleY, x, direction) => {
      if (Math.abs(ball.x - x) > 8) return false;
      if (Math.abs(ball.y - paddleY) > PADDLE.height / 2 + 6) return false;
      const offset = (ball.y - paddleY) / (PADDLE.height / 2);
      const speed = Math.min(11, Math.hypot(ball.dx, ball.dy) * 1.06);
      ball.dx = direction * Math.abs(Math.cos(offset * 0.9) * speed);
      ball.dy = Math.sin(offset * 0.9) * speed;
      ball.x = x + direction * 9;
      return true;
    };

    hit(this.#player, 26, 1);
    hit(this.#rival, WIDTH - 26, -1);

    if (ball.x < -10) {
      this.#score.rival += 1;
      this.#sync();
      this.#point();
    } else if (ball.x > WIDTH + 10) {
      this.#score.player += 1;
      this.#sync();
      this.#point();
    }
  }

  #point() {
    if (this.#score.player >= TARGET || this.#score.rival >= TARGET) {
      this.#state = 'over';
      const won = this.#score.player > this.#score.rival;
      this.$('#overlay').hidden = false;
      this.$('#title').textContent = won ? 'You win' : 'CPU wins';
      this.$('#overlay').querySelector('.hint').textContent = `${this.#score.player} - ${this.#score.rival}`;
      return;
    }
    this.#serve(this.#score.player > this.#score.rival ? 1 : -1);
  }

  #paint() {
    const context = this.$('#view').getContext('2d');
    const styles = getComputedStyle(this);
    const foreground = styles.getPropertyValue('--foreground').trim() || '#111';
    const soft = styles.getPropertyValue('--muted-foreground').trim() || '#888';
    const ring = styles.getPropertyValue('--ring').trim() || '#8a1c3b';

    context.clearRect(0, 0, WIDTH, HEIGHT);

    context.strokeStyle = soft;
    context.globalAlpha = 0.4;
    context.setLineDash([7, 11]);
    context.beginPath();
    context.moveTo(WIDTH / 2, 0);
    context.lineTo(WIDTH / 2, HEIGHT);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;

    context.fillStyle = foreground;
    context.beginPath();
    context.roundRect(20, this.#player - PADDLE.height / 2, PADDLE.width, PADDLE.height, 5);
    context.roundRect(WIDTH - 30, this.#rival - PADDLE.height / 2, PADDLE.width, PADDLE.height, 5);
    context.fill();

    context.fillStyle = ring;
    context.beginPath();
    context.arc(this.#ball.x, this.#ball.y, 6, 0, Math.PI * 2);
    context.fill();
  }
}

define('jg-app-game-pong', Pong);
