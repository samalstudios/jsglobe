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
    width: min(1040px, 100%);
    aspect-ratio: 600 / 190;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: #f7f7f4;
    image-rendering: pixelated;
    touch-action: none;
    cursor: pointer;
  }
  canvas[data-night="true"] { background: #10151b; }
  .overlay { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; pointer-events: none; }
  .overlay .card {
    padding: 16px 20px;
    border-radius: var(--radius-lg);
    background: var(--glass-strong);
    border: 1px solid var(--glass-border);
    backdrop-filter: var(--glass-blur);
    display: grid;
    gap: 8px;
    justify-items: center;
    pointer-events: auto;
  }
  .overlay h3 { margin: 0; font-size: 18px; }
  .keys { font-size: 12px; color: var(--muted-foreground); }
`;

const WIDTH = 600;
const HEIGHT = 190;
const GROUND = 146;

class Dino extends JGApp {
  static appId = 'game-dino';
  static styles = [...JGApp.styles, sheet];

  #dino = { y: GROUND, dy: 0, ducking: false, dead: false };
  #obstacles = [];
  #clouds = [];
  #bumps = [];
  #speed = 6;
  #distance = 0;
  #score = 0;
  #best = 0;
  #night = false;
  #flash = 0;
  #beat = 0;
  #state = 'idle';
  #frame = null;

  renderApp() {
    this.#best = this.store.read({ best: 0 }).best ?? 0;

    this.paint(html`<div class="app">
      <div class="head">
        <span class="title">T-Rex Run</span>
        <span class="grow"></span>
        <span class="stat">Score <span id="score">0</span></span>
        <span class="stat">Best <span id="best">${this.#best}</span></span>
        <jg-button size="sm" variant="outline" id="new">Restart</jg-button>
      </div>
      <div class="wrap">
        <canvas id="view" width="${WIDTH}" height="${HEIGHT}"></canvas>
        <div class="overlay" id="overlay">
          <div class="card">
            <h3 id="title">Jump the cacti</h3>
            <div class="keys">Space or up to jump, down to duck.</div>
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
    this.on(this.$('#view'), 'pointerdown', () => {
      if (this.#state === 'running') this.#jump();
      else this.#play();
    });

    this.hotkeys((event) => {
      if (event.key === ' ' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (this.#state === 'running') this.#jump();
        else this.#play();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.#dino.ducking = true;
      }
    });
    this.hotkeys((event) => {
      if (event.key === 'ArrowDown') this.#dino.ducking = false;
    }, { type: 'keyup' });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.#frame);
  }

  #reset() {
    this.#dino = { y: GROUND, dy: 0, ducking: false, dead: false };
    this.#obstacles = [];
    this.#clouds = [{ x: 420, y: 42 }, { x: 640, y: 66 }];
    this.#bumps = Array.from({ length: 26 }, () => ({ x: Math.random() * WIDTH, size: Math.random() > 0.5 ? 2 : 1 }));
    this.#speed = 6;
    this.#distance = 0;
    this.#score = 0;
    this.#night = false;
    this.#flash = 0;
    this.#beat = 0;
    this.#sync();
  }

  #sync() {
    this.$('#score').textContent = String(this.#score).padStart(5, '0');
    this.$('#best').textContent = String(this.#best).padStart(5, '0');
  }

  #show(title, hint) {
    const overlay = this.$('#overlay');
    overlay.hidden = false;
    this.$('#title').textContent = title;
    overlay.querySelector('.keys').textContent = hint;
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

  #jump() {
    if (this.#dino.y < GROUND) return;
    this.#dino.dy = -13.6;
    this.#dino.ducking = false;
  }

  #spawn() {
    const last = this.#obstacles[this.#obstacles.length - 1];
    const gap = 150 + Math.random() * 180 + (13 - this.#speed) * 12;
    if (last && WIDTH - last.x < gap) return;

    const flying = this.#score > 420 && Math.random() < 0.22;
    if (flying) {
      const heights = [GROUND - 74, GROUND - 48, GROUND - 12];
      this.#obstacles.push({ kind: 'bird', x: WIDTH + 30, y: heights[Math.floor(Math.random() * heights.length)], width: 42, height: 26 });
      return;
    }

    const cluster = 1 + Math.floor(Math.random() * 3);
    const tall = Math.random() > 0.6;
    this.#obstacles.push({
      kind: 'cactus',
      x: WIDTH + 20,
      y: GROUND,
      cluster,
      tall,
      width: cluster * (tall ? 19 : 16),
      height: tall ? 60 : 42,
    });
  }

  #tick() {
    this.#beat += 1;
    this.#speed = Math.min(13.4, 6 + this.#distance / 900);
    this.#distance += this.#speed;
    const next = Math.floor(this.#distance / 10);
    if (next !== this.#score) {
      this.#score = next;
      this.#sync();
      if (this.#score > 0 && this.#score % 700 === 0) {
        this.#night = !this.#night;
        this.#flash = 26;
      }
    }
    if (this.#flash > 0) this.#flash -= 1;

    const dino = this.#dino;
    dino.dy += dino.ducking && dino.y < GROUND ? 1.4 : 0.82;
    dino.y = Math.min(GROUND, dino.y + dino.dy);
    if (dino.y >= GROUND) dino.dy = 0;

    this.#spawn();
    this.#obstacles = this.#obstacles.filter((item) => {
      item.x -= this.#speed;
      return item.x + item.width > -10;
    });

    this.#clouds = this.#clouds.filter((cloud) => {
      cloud.x -= this.#speed * 0.22;
      return cloud.x > -70;
    });
    if (this.#clouds.length < 3 && Math.random() < 0.006) {
      this.#clouds.push({ x: WIDTH + 40, y: 26 + Math.random() * 46 });
    }

    this.#bumps.forEach((bump) => {
      bump.x -= this.#speed;
      if (bump.x < -4) {
        bump.x = WIDTH + Math.random() * 40;
        bump.size = Math.random() > 0.5 ? 2 : 1;
      }
    });

    const box = this.#hitbox();
    const crash = this.#obstacles.some((item) => {
      const left = item.kind === 'bird' ? item.x : item.x;
      const top = item.kind === 'bird' ? item.y : item.y - item.height;
      return (
        box.x < left + item.width - 4 &&
        box.x + box.width - 4 > left &&
        box.y < top + item.height - 3 &&
        box.y + box.height - 3 > top
      );
    });

    if (crash) {
      this.#state = 'over';
      this.#dino.dead = true;
      if (this.#score > this.#best) {
        this.#best = this.#score;
        this.store.write({ best: this.#best });
      }
      this.#sync();
      this.#show('Game over', `You ran ${this.#score} metres. Space to run again.`);
    }
  }

  #hitbox() {
    const dino = this.#dino;
    if (dino.ducking && dino.y >= GROUND) {
      return { x: 44, y: dino.y - 30, width: 60, height: 30 };
    }
    return { x: 50, y: dino.y - 60, width: 40, height: 60 };
  }

  #paint() {
    const canvas = this.$('#view');
    canvas.dataset.night = String(this.#night);
    const context = canvas.getContext('2d');
    const ink = this.#night ? '#e6e9ee' : '#3a3f46';
    const faint = this.#night ? '#39414c' : '#c4c8cd';

    context.fillStyle = this.#flash > 0 ? (this.#night ? '#1c232c' : '#e8e8e2') : this.#night ? '#10151b' : '#f7f7f4';
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.fillStyle = faint;
    this.#clouds.forEach((cloud) => {
      context.fillRect(cloud.x, cloud.y, 26, 5);
      context.fillRect(cloud.x + 5, cloud.y - 4, 16, 4);
      context.fillRect(cloud.x + 3, cloud.y + 5, 20, 3);
    });

    if (this.#night) {
      context.fillStyle = '#8d97a5';
      context.fillRect(WIDTH - 96, 30, 4, 4);
      context.fillRect(WIDTH - 150, 52, 3, 3);
      context.fillRect(WIDTH - 210, 24, 3, 3);
      context.fillStyle = '#e6e9ee';
      context.fillRect(WIDTH - 70, 26, 14, 20);
      context.fillStyle = '#10151b';
      context.fillRect(WIDTH - 64, 26, 10, 20);
    }

    context.fillStyle = ink;
    context.fillRect(0, GROUND + 2, WIDTH, 2);
    this.#bumps.forEach((bump) => context.fillRect(bump.x, GROUND + 6, bump.size * 2, 2));

    this.#obstacles.forEach((item) => {
      if (item.kind === 'bird') {
        const up = Math.floor(this.#beat / 9) % 2 === 0;
        context.fillRect(item.x + 11, item.y + 9, 22, 7);
        context.fillRect(item.x + 31, item.y + 4, 11, 6);
        context.fillRect(item.x + 39, item.y + 9, 6, 3);
        if (up) {
          context.fillRect(item.x + 6, item.y - 6, 20, 6);
          context.fillRect(item.x, item.y - 12, 11, 6);
        } else {
          context.fillRect(item.x + 6, item.y + 16, 20, 6);
          context.fillRect(item.x, item.y + 22, 11, 6);
        }
        return;
      }

      for (let index = 0; index < item.cluster; index += 1) {
        const x = item.x + index * (item.tall ? 19 : 16);
        const height = item.tall ? 60 : 42;
        const width = item.tall ? 11 : 10;
        context.fillRect(x, item.y - height, width, height);
        context.fillRect(x - 7, item.y - height + (item.tall ? 23 : 16), 7, 6);
        context.fillRect(x - 7, item.y - height + (item.tall ? 23 : 16), 4, 16);
        context.fillRect(x + width, item.y - height + (item.tall ? 31 : 21), 7, 6);
        context.fillRect(x + width + 3, item.y - height + (item.tall ? 17 : 11), 4, 16);
      }
    });

    this.#drawDino(context, ink);

    context.fillStyle = faint;
    context.font = '11px ui-monospace, monospace';
    context.textAlign = 'right';
    context.fillText(`HI ${String(this.#best).padStart(5, '0')}  ${String(this.#score).padStart(5, '0')}`, WIDTH - 12, 22);
  }

  #drawDino(context, ink) {
    const dino = this.#dino;
    const airborne = dino.y < GROUND;
    const ducking = dino.ducking && !airborne;
    const step = Math.floor(this.#beat / 6) % 2;
    const paper = this.#night ? '#10151b' : '#f7f7f4';
    const running = this.#state === 'running' && !dino.dead && !airborne;
    context.fillStyle = ink;

    if (ducking) {
      const top = dino.y - 30;
      context.fillRect(22, top + 4, 16, 8);
      context.fillRect(32, top + 9, 14, 12);
      context.fillRect(40, top + 8, 44, 22);
      context.fillRect(78, top + 2, 34, 18);
      context.fillRect(92, top + 18, 22, 6);
      context.fillStyle = paper;
      context.fillRect(100, top + 7, 5, 5);
      context.fillStyle = ink;
      context.fillRect(74, top + 22, 10, 5);
      context.fillRect(step && running ? 50 : 62, top + 30, 14, 6);
      context.fillRect(step && running ? 68 : 56, top + 30, 14, 6);
      return;
    }

    const top = dino.y - 60;

    context.fillRect(22, top + 20, 16, 9);
    context.fillRect(30, top + 26, 14, 10);
    context.fillRect(40, top + 22, 38, 26);
    context.fillRect(52, top + 42, 32, 12);
    context.fillRect(70, top + 8, 20, 22);
    context.fillRect(82, top, 34, 22);
    context.fillRect(94, top + 20, 22, 6);
    context.fillStyle = paper;
    context.fillRect(102, top + 6, 5, 5);
    context.fillStyle = ink;
    context.fillRect(76, top + 30, 11, 5);

    if (!running) {
      context.fillRect(54, top + 52, 13, 8);
      context.fillRect(72, top + 52, 13, 8);
      return;
    }

    if (step) {
      context.fillRect(54, top + 52, 13, 8);
      context.fillRect(70, top + 48, 13, 12);
      context.fillRect(70, top + 56, 18, 4);
    } else {
      context.fillRect(52, top + 48, 13, 12);
      context.fillRect(50, top + 56, 18, 4);
      context.fillRect(72, top + 52, 13, 8);
    }
  }
}

define('jg-app-game-dino', Dino);
