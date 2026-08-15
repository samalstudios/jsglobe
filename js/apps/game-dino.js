import { JGApp, define, html, css } from '../core/app.js';
import { settings } from '../core/settings.js';

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
  .app { min-height: 0; }
  .wrap { position: relative; display: grid; place-items: center; width: 100%; flex: 1; min-height: 0; }
  canvas {
    width: 100%;
    max-height: 100%;
    aspect-ratio: 900 / 260;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: #f7f7f4;
    image-rendering: pixelated;
    touch-action: none;
    cursor: pointer;
    outline: none;
  }
  canvas[data-night="true"] { background: #10151b; }
  canvas:focus-visible { border-color: color-mix(in srgb, var(--ring) 55%, transparent); }

  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    text-align: center;
    pointer-events: none;
  }
  .overlay[hidden] { display: none; }
  .panel {
    padding: 16px 22px;
    border-radius: var(--radius-lg);
    background: var(--glass-strong);
    border: 1px solid var(--glass-border);
    backdrop-filter: var(--glass-blur);
    display: grid;
    gap: 9px;
    justify-items: center;
    pointer-events: auto;
  }
  .panel h3 { margin: 0; font-size: 18px; }
  .keys { font-size: 12px; color: var(--muted-foreground); }
  kbd {
    font-family: var(--font-mono);
    font-size: 10.5px;
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 2px 6px;
    background: color-mix(in srgb, var(--muted) 60%, transparent);
  }
`;

const WIDTH = 900;
const HEIGHT = 260;
const GROUND = 200;
const UNIT = 2.5;
const DINO_X = 62;
const STEP = 1 / 60;

const BODY = [
  '000000000000000000111111',
  '000000000000000001111111',
  '000000000000000011111111',
  '000000000000000011111111',
  '000000000000000011211111',
  '000000000000000011111111',
  '000000000000000011111000',
  '000000000000000111111111',
  '000000000000001111111000',
  '100000000000011111100000',
  '110000000000111111000000',
  '111000000001111111000000',
  '111100000111111111100000',
  '111110011111111111000000',
  '011111111111111110000000',
  '001111111111111100000000',
  '000111111111111000000000',
  '000011111111111000000000',
  '000001111111110000000000',
  '000001111111100000000000',
];

const LEGS = [
  [
    '000001110011100000000000',
    '000001110011100000000000',
    '000001100011100000000000',
    '000001100011000000000000',
    '000011100011000000000000',
  ],
  [
    '000001110011100000000000',
    '000001100011110000000000',
    '000001100001110000000000',
    '000001100001100000000000',
    '000001110011100000000000',
  ],
];

const STAND = [
  '000001110011100000000000',
  '000001110011100000000000',
  '000001100011000000000000',
  '000001100011000000000000',
  '000011100011100000000000',
];

const DUCK = [
  '000000000000000000011111100',
  '000000000000000000111111110',
  '110000000000000001111121110',
  '111000000000000011111111110',
  '111110000000001111111111100',
  '011111111111111111111111000',
  '001111111111111111111000000',
  '000111111111111111100000000',
  '000011111111111110000000000',
];

const DUCK_LEGS = [
  ['000011110011110000000000000', '000011100011100000000000000'],
  ['000011110001111000000000000', '000011100001110000000000000'],
];

const CACTUS_SMALL = [
  '0011100',
  '0011100',
  '0011100',
  '1011100',
  '1011101',
  '1011101',
  '1111101',
  '1111111',
  '0111111',
  '0011100',
  '0011100',
  '0011100',
  '0011100',
  '0011100',
];

const CACTUS_LARGE = [
  '000111000',
  '000111000',
  '000111000',
  '100111000',
  '100111001',
  '100111001',
  '110111001',
  '111111011',
  '011111111',
  '001111111',
  '000111111',
  '000111011',
  '000111000',
  '000111000',
  '000111000',
  '000111000',
  '000111000',
  '000111000',
  '000111000',
  '000111000',
];

const BIRD = [
  [
    '00000000011100',
    '00000000111110',
    '00000001112011',
    '00111111111100',
    '01111111110000',
    '11111111000000',
    '01111000000000',
    '00000000000000',
  ],
  [
    '00000000011100',
    '00000000111110',
    '00000001112011',
    '00111111111100',
    '01111111110000',
    '00011111000000',
    '00011110000000',
    '00111100000000',
  ],
];

const CLOUD = [
  '0001111000',
  '0111111110',
  '1111111111',
  '0011111100',
];

const HILL = [
  '000000111111000000',
  '000011111111110000',
  '001111111111111100',
  '011111111111111110',
  '111111111111111111',
];

const SPEED_START = 6;
const SPEED_MAX = 13.4;
const GRAVITY = 0.82;
const DUCK_GRAVITY = 1.4;
const JUMP = -13.6;

class Dino extends JGApp {
  static appId = 'game-dino';
  static settings = [
    { key: 'sound', label: 'Sound effects', type: 'switch', default: true },
  ];
  static styles = [...JGApp.styles, sheet];

  #dino = { y: GROUND, dy: 0, ducking: false, dead: false };
  #obstacles = [];
  #clouds = [];
  #hills = [];
  #bumps = [];
  #notches = [];
  #speed = SPEED_START;
  #distance = 0;
  #score = 0;
  #best = 0;
  #night = false;
  #flash = 0;
  #blink = 0;
  #beat = 0;
  #state = 'idle';
  #frame = null;
  #clock = 0;
  #carry = 0;
  #audio = null;
  #jumpHeld = false;

  connectedCallback() {
    this.#best = this.store.read({ best: 0 }).best ?? 0;
    super.connectedCallback();
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head">
        <span class="title">T-Rex Run</span>
        <span class="grow"></span>
        <span class="stat">Score <span id="score">00000</span></span>
        <span class="stat">Best <span id="best">${String(this.#best).padStart(5, '0')}</span></span>
        <jg-button size="sm" variant="ghost" id="sound">${this.config.get('sound', true) ? 'Sound on' : 'Sound off'}</jg-button>
        <jg-button size="sm" variant="outline" id="new">Restart</jg-button>
      </div>
      <div class="wrap">
        <canvas id="view" width="${WIDTH}" height="${HEIGHT}" tabindex="0" aria-label="T-Rex runner"></canvas>
        <div class="overlay" id="overlay">
          <div class="panel">
            <h3 id="title">Jump the cacti</h3>
            <div class="keys" id="hint"><kbd>space</kbd> jump &nbsp; <kbd>↓</kbd> duck</div>
            <jg-button size="sm" id="start">Play</jg-button>
          </div>
        </div>
      </div>
    </div>`);

    this.#reset();
    this.#paint();
    this.#idle();

    this.on(this.$('#start'), 'click', () => this.#play());
    this.on(this.$('#new'), 'click', () => {
      this.#reset();
      this.#play();
    });
    this.on(this.$('#sound'), 'click', () => {
      const next = !this.config.get('sound', true);
      this.config.set('sound', next);
      this.$('#sound').textContent = next ? 'Sound on' : 'Sound off';
    });

    const canvas = this.$('#view');
    this.on(canvas, 'pointerdown', (event) => {
      canvas.focus({ preventScroll: true });
      const rect = canvas.getBoundingClientRect();
      const low = (event.clientY - rect.top) / rect.height > 0.62;
      if (this.#state !== 'running') {
        this.#play();
        return;
      }
      if (low) this.#dino.ducking = true;
      else this.#jump();
    });
    this.on(canvas, 'pointerup', () => {
      this.#dino.ducking = false;
      this.#release();
    });
    this.on(canvas, 'pointerleave', () => {
      this.#dino.ducking = false;
    });

    this.hotkeys((event) => {
      if (event.key === ' ' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (this.#state === 'running') this.#jump();
        else if (!event.repeat) this.#play();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.#dino.ducking = true;
      }
    });
    this.hotkeys(
      (event) => {
        if (event.key === 'ArrowDown') this.#dino.ducking = false;
        if (event.key === ' ' || event.key === 'ArrowUp') this.#release();
      },
      { type: 'keyup' },
    );

    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.#pause();
    });
    this.listen(window, 'blur', () => this.#pause());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.#frame);
    this.#audio?.close();
    this.#audio = null;
  }

  #beep(type) {
    if (!this.config.get('sound', true) || !settings.get('appearance.motion')) return;
    try {
      this.#audio ??= new (window.AudioContext ?? window.webkitAudioContext)();
      const context = this.#audio;
      if (context.state === 'suspended') context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      const tone = { jump: 620, point: 880, over: 240 }[type] ?? 500;
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(tone, now);
      if (type === 'over') oscillator.frequency.exponentialRampToValueAtTime(90, now + 0.32);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === 'over' ? 0.34 : 0.09));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + (type === 'over' ? 0.35 : 0.1));
    } catch {
      this.#audio = null;
    }
  }

  #reset() {
    this.#dino = { y: GROUND, dy: 0, ducking: false, dead: false };
    this.#obstacles = [];
    this.#clouds = [{ x: 520, y: 62 }, { x: 800, y: 96 }];
    this.#hills = [
      { x: 90, scale: 2.6 },
      { x: 470, scale: 3.4 },
      { x: 760, scale: 2.2 },
    ];
    this.#notches = Array.from({ length: 9 }, () => ({ x: Math.random() * WIDTH, width: 4 + Math.random() * 7 }));
    this.#bumps = Array.from({ length: 44 }, () => ({ x: Math.random() * WIDTH, size: Math.random() > 0.5 ? 2 : 1 }));
    this.#speed = SPEED_START;
    this.#distance = 0;
    this.#score = 0;
    this.#night = false;
    this.#flash = 0;
    this.#blink = 0;
    this.#beat = 0;
    this.#carry = 0;
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
    this.$('#hint').innerHTML = hint;
    this.$('#start').textContent = this.#state === 'over' ? 'Run again' : 'Play';
  }

  #play() {
    if (this.#state === 'over') this.#reset();
    if (this.#state === 'running') return;
    this.#state = 'running';
    this.$('#overlay').hidden = true;
    this.$('#view').focus({ preventScroll: true });
    this.#clock = performance.now();
    this.#carry = 0;
    cancelAnimationFrame(this.#frame);
    const loop = (now) => {
      const delta = Math.min(0.12, (now - this.#clock) / 1000);
      this.#clock = now;
      this.#carry = Math.min(this.#carry + delta, STEP * 3);
      let guard = 0;
      while (this.#carry >= STEP && guard < 3) {
        this.#tick();
        this.#carry -= STEP;
        guard += 1;
        if (this.#state !== 'running') break;
      }
      this.#paint();
      if (this.#state === 'running') this.#frame = requestAnimationFrame(loop);
    };
    this.#frame = requestAnimationFrame(loop);
    this.track(() => cancelAnimationFrame(this.#frame));
  }

  #pause() {
    if (this.#state !== 'running') return;
    this.#state = 'paused';
    this.#show('Paused', '<kbd>space</kbd> to carry on');
    this.#idle();
  }

  #jump() {
    if (this.#dino.y < GROUND || this.#jumpHeld) return;
    this.#dino.dy = JUMP;
    this.#dino.ducking = false;
    this.#jumpHeld = true;
    this.#beep('jump');
  }

  #release() {
    this.#jumpHeld = false;
    if (this.#dino.dy < -5) this.#dino.dy *= 0.55;
  }

  #spawn() {
    if (this.#distance < 900) return;
    const last = this.#obstacles[this.#obstacles.length - 1];
    const gap = 240 + Math.random() * 190 + (SPEED_MAX - this.#speed) * 16;
    if (last && WIDTH - last.x < gap) return;

    if (this.#score > 420 && Math.random() < 0.22) {
      const heights = [GROUND - 78, GROUND - 48, GROUND - 16];
      this.#obstacles.push({
        kind: 'bird',
        x: WIDTH + 30,
        y: heights[Math.floor(Math.random() * heights.length)],
        width: BIRD[0][0].length * UNIT,
        height: BIRD[0].length * UNIT,
      });
      return;
    }

    const tall = Math.random() > 0.58;
    const sprite = tall ? CACTUS_LARGE : CACTUS_SMALL;
    const cluster = 1 + Math.floor(Math.random() * (this.#speed > 9.5 ? 3 : 2));
    const pitch = (sprite[0].length - 1) * UNIT;
    this.#obstacles.push({
      kind: 'cactus',
      x: WIDTH + 20,
      y: GROUND,
      cluster,
      tall,
      pitch,
      width: pitch * (cluster - 1) + sprite[0].length * UNIT,
      height: sprite.length * UNIT,
    });
  }

  #tick() {
    this.#beat += 1;
    this.#speed = Math.min(SPEED_MAX, SPEED_START + this.#distance / 900);
    this.#distance += this.#speed;

    const next = Math.floor(this.#distance / 10);
    if (next !== this.#score) {
      const passed = Math.floor(this.#score / 100) !== Math.floor(next / 100);
      this.#score = next;
      this.#sync();
      if (passed && this.#score >= 100) {
        this.#blink = 42;
        this.#beep('point');
      }
      if (this.#score > 0 && this.#score % 700 === 0) {
        this.#night = !this.#night;
        this.#flash = 26;
      }
    }
    if (this.#flash > 0) this.#flash -= 1;
    if (this.#blink > 0) this.#blink -= 1;

    const dino = this.#dino;
    dino.dy += dino.ducking && dino.y < GROUND ? DUCK_GRAVITY : GRAVITY;
    dino.y = Math.min(GROUND, dino.y + dino.dy);
    if (dino.y >= GROUND) dino.dy = 0;

    this.#spawn();
    this.#obstacles = this.#obstacles.filter((item) => {
      item.x -= this.#speed;
      return item.x + item.width > -20;
    });

    this.#clouds = this.#clouds.filter((cloud) => {
      cloud.x -= this.#speed * 0.22;
      return cloud.x > -70;
    });
    if (this.#clouds.length < 4 && Math.random() < 0.006) {
      this.#clouds.push({ x: WIDTH + 40, y: 40 + Math.random() * 66 });
    }

    this.#hills = this.#hills.filter((hill) => {
      hill.x -= this.#speed * 0.09;
      return hill.x > -HILL[0].length * UNIT * hill.scale;
    });
    if (this.#hills.length < 3 && Math.random() < 0.012) {
      this.#hills.push({ x: WIDTH + 60, scale: 2 + Math.random() * 1.6 });
    }

    this.#bumps.forEach((bump) => {
      bump.x -= this.#speed;
      if (bump.x < -4) {
        bump.x = WIDTH + Math.random() * 40;
        bump.size = Math.random() > 0.5 ? 2 : 1;
      }
    });

    this.#notches.forEach((notch) => {
      notch.x -= this.#speed;
      if (notch.x < -notch.width) {
        notch.x = WIDTH + Math.random() * 260;
        notch.width = 4 + Math.random() * 7;
      }
    });

    if (this.#obstacles.some((item) => this.#collides(item))) this.#end();
  }

  #boxes() {
    const dino = this.#dino;
    if (dino.ducking && dino.y >= GROUND) {
      return [
        { x: DINO_X - 2, y: dino.y - 26, width: 46, height: 24 },
        { x: DINO_X + 40, y: dino.y - 30, width: 26, height: 20 },
      ];
    }
    return [
      { x: DINO_X + 8, y: dino.y - 34, width: 26, height: 32 },
      { x: DINO_X + 36, y: dino.y - 58, width: 24, height: 26 },
    ];
  }

  #collides(item) {
    const left = item.x + 2;
    const top = item.kind === 'bird' ? item.y + 3 : item.y - item.height;
    const right = item.x + item.width - 2;
    const bottom = item.kind === 'bird' ? item.y + item.height - 3 : item.y;
    return this.#boxes().some(
      (box) => box.x < right && box.x + box.width > left && box.y < bottom && box.y + box.height > top,
    );
  }

  #end() {
    this.#state = 'over';
    this.#dino.dead = true;
    this.#dino.ducking = false;
    this.#beep('over');
    if (this.#score > this.#best) {
      this.#best = this.#score;
      this.store.write({ best: this.#best });
    }
    this.#sync();
    this.#show('Game over', `You ran <strong>${this.#score}</strong> metres &nbsp; <kbd>space</kbd> to run again`);
    this.#idle();
  }

  #idle() {
    cancelAnimationFrame(this.#frame);
    const loop = () => {
      if (this.#state === 'running') return;
      this.#beat += 1;
      this.#paint();
      this.#frame = requestAnimationFrame(loop);
    };
    this.#frame = requestAnimationFrame(loop);
    this.track(() => cancelAnimationFrame(this.#frame));
  }

  #paint() {
    const canvas = this.$('#view');
    if (!canvas) return;
    canvas.dataset.night = String(this.#night);
    const context = canvas.getContext('2d');
    const ink = this.#night ? '#e6e9ee' : '#3a3f46';
    const faint = this.#night ? '#39414c' : '#c4c8cd';
    const paper = this.#night ? '#10151b' : '#f7f7f4';

    context.fillStyle = this.#flash > 0 ? (this.#night ? '#1c232c' : '#e8e8e2') : paper;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    this.#hills.forEach((hill) => {
      this.#sprite(context, HILL, hill.x, GROUND + 3, this.#night ? '#212a34' : '#e0e3df', paper, UNIT * hill.scale);
    });

    this.#clouds.forEach((cloud) => {
      this.#sprite(context, CLOUD, cloud.x, cloud.y, faint, paper);
    });

    if (this.#night) {
      context.fillStyle = '#8d97a5';
      context.fillRect(WIDTH - 140, 40, 4, 4);
      context.fillRect(WIDTH - 220, 68, 3, 3);
      context.fillRect(WIDTH - 320, 32, 3, 3);
      context.fillStyle = '#e6e9ee';
      context.fillRect(WIDTH - 96, 34, 16, 24);
      context.fillStyle = paper;
      context.fillRect(WIDTH - 89, 34, 12, 24);
    }

    context.fillStyle = ink;
    context.fillRect(0, GROUND + 2, WIDTH, 2);
    context.fillStyle = paper;
    this.#notches.forEach((notch) => context.fillRect(notch.x, GROUND + 2, notch.width, 2));
    context.fillStyle = faint;
    this.#bumps.forEach((bump) => context.fillRect(bump.x, GROUND + 7, bump.size * 2, 2));

    this.#obstacles.forEach((item) => this.#drawObstacle(context, item, ink, paper));
    this.#drawDino(context, ink, paper);

    context.fillStyle = faint;
    context.font = '11px ui-monospace, monospace';
    context.textAlign = 'right';
    const showScore = this.#blink === 0 || Math.floor(this.#blink / 7) % 2 === 0;
    context.fillText(`HI ${String(this.#best).padStart(5, '0')}`, WIDTH - 96, 26);
    if (showScore) {
      context.fillStyle = ink;
      context.fillText(String(this.#score).padStart(5, '0'), WIDTH - 14, 26);
    }
  }

  #drawObstacle(context, item, ink, paper) {
    if (item.kind === 'bird') {
      const frame = BIRD[Math.floor(this.#beat / 8) % 2];
      this.#sprite(context, frame, item.x, item.y + frame.length * UNIT, ink, paper);
      return;
    }

    const sprite = item.tall ? CACTUS_LARGE : CACTUS_SMALL;
    for (let index = 0; index < item.cluster; index += 1) {
      this.#sprite(context, sprite, item.x + index * item.pitch, item.y, ink, paper);
    }
  }

  #sprite(context, rows, x, bottom, ink, paper, scale = UNIT) {
    rows.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell === '0') return;
        context.fillStyle = cell === '2' ? paper : ink;
        context.fillRect(
          Math.round(x + rx * scale),
          Math.round(bottom - (rows.length - ry) * scale),
          Math.ceil(scale),
          Math.ceil(scale),
        );
      });
    });
  }

  #drawDino(context, ink, paper) {
    const dino = this.#dino;
    const airborne = dino.y < GROUND;
    const ducking = dino.ducking && !airborne;
    const running = this.#state === 'running' && !dino.dead && !airborne;
    const step = Math.floor(this.#beat / 6) % 2;

    if (ducking) {
      const legs = running ? DUCK_LEGS[step] : DUCK_LEGS[0];
      this.#sprite(context, DUCK, DINO_X - 6, dino.y - legs.length * UNIT, ink, paper);
      this.#sprite(context, legs, DINO_X - 6, dino.y, ink, paper);
      return;
    }

    const legs = dino.dead || !running ? STAND : LEGS[step];
    this.#sprite(context, BODY, DINO_X, dino.y - legs.length * UNIT, ink, paper);
    this.#sprite(context, legs, DINO_X, dino.y, ink, paper);

    const blinking = !running && !dino.dead && this.#beat % 190 < 9;
    if (blinking) {
      context.fillStyle = ink;
      context.fillRect(
        Math.round(DINO_X + 18 * UNIT),
        Math.round(dino.y - (BODY.length + legs.length - 4) * UNIT),
        Math.ceil(UNIT),
        Math.ceil(UNIT),
      );
    }

    if (dino.dead) {
      context.fillStyle = ink;
      context.fillRect(
        Math.round(DINO_X + 18 * UNIT),
        Math.round(dino.y - (BODY.length + legs.length - 4) * UNIT),
        Math.ceil(UNIT),
        Math.ceil(UNIT * 0.5),
      );
    }
  }
}

define('jg-app-game-dino', Dino);
