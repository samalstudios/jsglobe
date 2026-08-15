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
    width: min(940px, 100%);
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: #0b0f14;
    image-rendering: pixelated;
    touch-action: none;
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

const WIDTH = 448;
const HEIGHT = 336;
const UNIT = 2;
const COLUMNS = 9;
const ROWS = 5;

const SPRITES = {
  squid: [
    ['00111100', '01111110', '11011011', '11111111', '01011010', '10100101', '01000010', '10000001'],
    ['00111100', '01111110', '11011011', '11111111', '00100100', '01011010', '10100101', '00100100'],
  ],
  crab: [
    ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
    ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
  ],
  octopus: [
    ['000011110000', '011111111110', '111111111111', '111000111011', '111111111111', '000111111000', '001110011100', '110000000011'],
    ['000011110000', '011111111110', '111111111111', '111000111011', '111111111111', '001110011100', '011010010110', '001100001100'],
  ],
  ship: ['000010000', '000111000', '000111000', '011111110', '111111111', '111111111', '111111111'],
  ufo: ['0000111111000000', '0011111111110000', '0111111111111000', '1101101101101100', '1111111111111110', '0011100110011000'],
  boom: ['00100010001000', '01000100010000', '00010001000100', '10001110001001', '00111111111000', '01110101011100', '11101110111011', '00111111111000', '01001110100100', '10010001001001', '00100010001000'],
};

const TONES = ['#f2c14e', '#68c3a3', '#68c3a3', '#7fb3d5', '#7fb3d5'];

class Invaders extends JGApp {
  static appId = 'game-invaders';
  static styles = [...JGApp.styles, sheet];

  #aliens = [];
  #bunkers = [];
  #bullets = [];
  #bombs = [];
  #booms = [];
  #ufo = null;
  #ship = { x: WIDTH / 2, cooldown: 0, dead: 0 };
  #direction = 1;
  #score = 0;
  #best = 0;
  #lives = 3;
  #wave = 1;
  #beat = 0;
  #state = 'idle';
  #keys = new Set();
  #frame = null;

  renderApp() {
    this.#best = this.store.read({ best: 0 }).best ?? 0;

    this.paint(html`<div class="app">
      <div class="head">
        <span class="title">Invaders</span>
        <span class="grow"></span>
        <span class="stat">Score <span id="score">0</span></span>
        <span class="stat">Best <span id="best">${this.#best}</span></span>
        <span class="stat">Lives <span id="lives">3</span></span>
        <span class="stat">Wave <span id="wave">1</span></span>
        <jg-button size="sm" variant="outline" id="new">Restart</jg-button>
      </div>
      <div class="wrap">
        <canvas id="view" width="${WIDTH}" height="${HEIGHT}"></canvas>
        <div class="overlay" id="overlay">
          <div class="card">
            <h3 id="title">Hold the line</h3>
            <div class="hint">Arrows move, space fires.</div>
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

    this.hotkeys((event) => {
      if (event.key === ' ') {
        event.preventDefault();
        if (this.#state !== 'running') this.#play();
        else this.#fire();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.#keys.add(event.key);
      }
      if (event.key.toLowerCase() === 'p') {
        if (this.#state === 'running') {
          this.#state = 'paused';
          this.#show('Paused', 'Press P to carry on.');
        } else this.#play();
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
    this.#wave = 1;
    this.#build();
    this.#sync();
  }

  #build() {
    this.#aliens = [];
    const kinds = ['squid', 'crab', 'crab', 'octopus', 'octopus'];
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        this.#aliens.push({
          x: 58 + column * 38,
          y: 52 + row * 26,
          kind: kinds[row],
          tone: TONES[row],
          points: [30, 20, 20, 10, 10][row],
          alive: true,
        });
      }
    }

    this.#bunkers = [0, 1, 2, 3].map((index) => {
      const blocks = [];
      for (let y = 0; y < 6; y += 1) {
        for (let x = 0; x < 11; x += 1) {
          const arch = y > 3 && x > 3 && x < 7;
          const corner = (y < 2 && (x < 2 - y || x > 8 + y));
          blocks.push(arch || corner ? 0 : 1);
        }
      }
      return { x: 52 + index * 116, y: HEIGHT - 92, blocks };
    });

    this.#bullets = [];
    this.#bombs = [];
    this.#booms = [];
    this.#ufo = null;
    this.#direction = 1;
    this.#ship = { x: WIDTH / 2, cooldown: 0, dead: 0 };
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
    this.$('#wave').textContent = this.#wave;
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

  #fire() {
    if (this.#ship.cooldown > 0 || this.#ship.dead > 0 || this.#bullets.length > 1) return;
    this.#bullets.push({ x: this.#ship.x, y: HEIGHT - 46 });
    this.#ship.cooldown = 14;
  }

  #hitBunker(x, y) {
    return this.#bunkers.some((bunker) => {
      const localX = Math.floor((x - bunker.x) / 5);
      const localY = Math.floor((y - bunker.y) / 5);
      if (localX < 0 || localX > 10 || localY < 0 || localY > 5) return false;
      if (!bunker.blocks[localY * 11 + localX]) return false;
      [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].forEach(([dx, dy]) => {
        const nx = localX + dx;
        const ny = localY + dy;
        if (nx < 0 || nx > 10 || ny < 0 || ny > 5) return;
        if (Math.random() > 0.35) bunker.blocks[ny * 11 + nx] = 0;
      });
      return true;
    });
  }

  #tick() {
    this.#beat += 1;
    if (this.#ship.dead > 0) {
      this.#ship.dead -= 1;
      if (this.#ship.dead === 0 && this.#lives <= 0) this.#end();
    } else {
      if (this.#keys.has('ArrowLeft')) this.#ship.x -= 3.4;
      if (this.#keys.has('ArrowRight')) this.#ship.x += 3.4;
      this.#ship.x = Math.max(20, Math.min(WIDTH - 20, this.#ship.x));
    }
    if (this.#ship.cooldown > 0) this.#ship.cooldown -= 1;

    const living = this.#aliens.filter((alien) => alien.alive);
    const cleared = ROWS * COLUMNS - living.length;
    const cadence = Math.max(3, 30 - Math.floor(cleared / 3) - this.#wave * 2);
    if (this.#beat % cadence === 0) {
      let bounce = false;
      living.forEach((alien) => {
        alien.x += this.#direction * 5;
        if (alien.x < 20 || alien.x > WIDTH - 20) bounce = true;
      });
      if (bounce) {
        this.#direction *= -1;
        living.forEach((alien) => {
          alien.x += this.#direction * 5;
          alien.y += 12;
        });
      }
    }

    if (!this.#ufo && Math.random() < 0.0016) {
      const fromLeft = Math.random() > 0.5;
      this.#ufo = { x: fromLeft ? -20 : WIDTH + 20, dx: fromLeft ? 1.1 : -1.1 };
    }
    if (this.#ufo) {
      this.#ufo.x += this.#ufo.dx;
      if (this.#ufo.x < -40 || this.#ufo.x > WIDTH + 40) this.#ufo = null;
    }

    if (this.#beat % Math.max(22, 80 - this.#wave * 8) === 0 && living.length) {
      const shooter = living[Math.floor(Math.random() * living.length)];
      this.#bombs.push({ x: shooter.x, y: shooter.y + 8, wiggle: Math.random() * Math.PI });
    }

    this.#bullets = this.#bullets.filter((bullet) => {
      bullet.y -= 6;
      if (bullet.y < 4) return false;
      if (this.#ufo && Math.abs(this.#ufo.x - bullet.x) < 16 && bullet.y < 40) {
        this.#score += 150;
        this.#booms.push({ x: this.#ufo.x, y: 28, life: 18 });
        this.#ufo = null;
        this.#sync();
        return false;
      }
      const hit = living.find((alien) => Math.abs(alien.x - bullet.x) < 13 && Math.abs(alien.y - bullet.y) < 9);
      if (hit) {
        hit.alive = false;
        this.#score += hit.points;
        this.#booms.push({ x: hit.x, y: hit.y, life: 14 });
        this.#sync();
        return false;
      }
      return !this.#hitBunker(bullet.x, bullet.y);
    });

    this.#bombs = this.#bombs.filter((bomb) => {
      bomb.y += 2.6;
      if (bomb.y > HEIGHT - 8) return false;
      if (this.#hitBunker(bomb.x, bomb.y)) return false;
      if (this.#ship.dead === 0 && Math.abs(bomb.x - this.#ship.x) < 12 && bomb.y > HEIGHT - 42) {
        this.#lives -= 1;
        this.#ship.dead = 60;
        this.#booms.push({ x: this.#ship.x, y: HEIGHT - 34, life: 30 });
        this.#sync();
        return false;
      }
      return true;
    });

    this.#booms = this.#booms.filter((boom) => {
      boom.life -= 1;
      return boom.life > 0;
    });

    if (!living.length) {
      this.#wave += 1;
      this.#build();
      this.#sync();
      return;
    }

    if (living.some((alien) => alien.y > HEIGHT - 76)) {
      this.#lives = 0;
      this.#end();
    }
  }

  #end() {
    this.#state = 'over';
    if (this.#score > this.#best) {
      this.#best = this.#score;
      this.store.write({ best: this.#best });
    }
    this.#sync();
    this.#show('Game over', `You scored ${this.#score}. Play again?`);
  }

  #sprite(context, rows, x, y, color, unit = UNIT) {
    context.fillStyle = color;
    const width = rows[0].length * unit;
    const height = rows.length * unit;
    rows.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell !== '1') return;
        context.fillRect(Math.round(x - width / 2 + rx * unit), Math.round(y - height / 2 + ry * unit), unit, unit);
      });
    });
  }

  #paint() {
    const context = this.$('#view').getContext('2d');
    context.fillStyle = '#0b0f14';
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const frame = Math.floor(this.#beat / 22) % 2;

    if (this.#ufo) this.#sprite(context, SPRITES.ufo, this.#ufo.x, 28, '#d9534f');

    this.#aliens.forEach((alien) => {
      if (!alien.alive) return;
      this.#sprite(context, SPRITES[alien.kind][frame], alien.x, alien.y, alien.tone);
    });

    context.fillStyle = '#4f9d69';
    this.#bunkers.forEach((bunker) => {
      bunker.blocks.forEach((alive, index) => {
        if (!alive) return;
        const x = bunker.x + (index % 11) * 5;
        const y = bunker.y + Math.floor(index / 11) * 5;
        context.fillRect(x, y, 5, 5);
      });
    });

    if (this.#ship.dead === 0) {
      this.#sprite(context, SPRITES.ship, this.#ship.x, HEIGHT - 34, '#e8e8ec', 3);
    }

    context.fillStyle = '#f5f5f7';
    this.#bullets.forEach((bullet) => context.fillRect(bullet.x - 1, bullet.y, 2, 8));

    context.fillStyle = '#f2c14e';
    this.#bombs.forEach((bomb) => {
      const offset = Math.sin(bomb.y / 6 + bomb.wiggle) * 2;
      context.fillRect(bomb.x - 1 + offset, bomb.y, 2, 7);
    });

    this.#booms.forEach((boom) => {
      this.#sprite(context, SPRITES.boom, boom.x, boom.y, boom.life > 8 ? '#f2c14e' : '#d9534f');
    });

    context.fillStyle = '#4f9d69';
    context.fillRect(0, HEIGHT - 14, WIDTH, 2);

    context.fillStyle = '#6f7b87';
    context.font = '9px ui-monospace, monospace';
    context.textAlign = 'left';
    context.fillText(`SCORE ${String(this.#score).padStart(4, '0')}`, 8, 14);
    context.textAlign = 'right';
    context.fillText(`WAVE ${this.#wave}`, WIDTH - 8, 14);

    for (let index = 0; index < this.#lives; index += 1) {
      this.#sprite(context, SPRITES.ship, 18 + index * 24, HEIGHT - 7, '#4f9d69', 1.6);
    }
  }
}

define('jg-app-game-invaders', Invaders);
