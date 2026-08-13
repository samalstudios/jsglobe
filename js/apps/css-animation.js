import { JGApp, define, html, css } from '../core/app.js';
import { copyText } from '../core/util.js';

const sheet = css`
  .stage {
    display: grid;
    place-items: center;
    flex: none;
    height: 210px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 55%, transparent);
    overflow: hidden;
  }
  .box {
    width: 74px;
    height: 74px;
    border-radius: 16px;
    background: linear-gradient(160deg, color-mix(in srgb, var(--ring) 80%, #fff 20%), var(--ring));
    box-shadow: var(--shadow-md);
  }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; }
  .preset {
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted-foreground);
    font: 500 12px/1 var(--font-sans);
    padding: 6px 12px;
    cursor: pointer;
  }
  .preset[aria-pressed="true"] {
    color: var(--foreground);
    border-color: color-mix(in srgb, var(--ring) 50%, transparent);
    background: color-mix(in srgb, var(--ring) 14%, transparent);
  }
  .bezier { display: grid; grid-template-columns: 180px 1fr; gap: 14px; align-items: center; }
  @media (max-width: 640px) { .bezier { grid-template-columns: 1fr; } }
  .curve { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--card); touch-action: none; }
`;

const ANIMATIONS = {
  fade: { label: 'Fade in', frames: { '0%': 'opacity: 0', '100%': 'opacity: 1' } },
  'slide-up': { label: 'Slide up', frames: { '0%': 'opacity: 0; transform: translateY(28px)', '100%': 'opacity: 1; transform: translateY(0)' } },
  pop: { label: 'Pop', frames: { '0%': 'transform: scale(0.7)', '60%': 'transform: scale(1.08)', '100%': 'transform: scale(1)' } },
  spin: { label: 'Spin', frames: { '0%': 'transform: rotate(0deg)', '100%': 'transform: rotate(360deg)' } },
  pulse: { label: 'Pulse', frames: { '0%, 100%': 'transform: scale(1)', '50%': 'transform: scale(1.14)' } },
  shake: { label: 'Shake', frames: { '0%, 100%': 'transform: translateX(0)', '25%': 'transform: translateX(-10px)', '75%': 'transform: translateX(10px)' } },
  bounce: { label: 'Bounce', frames: { '0%, 100%': 'transform: translateY(0)', '50%': 'transform: translateY(-30px)' } },
  flip: { label: 'Flip', frames: { '0%': 'transform: rotateY(0deg)', '100%': 'transform: rotateY(360deg)' } },
  swing: { label: 'Swing', frames: { '0%, 100%': 'transform: rotate(-8deg)', '50%': 'transform: rotate(8deg)' } },
  blink: { label: 'Blink', frames: { '0%, 100%': 'opacity: 1', '50%': 'opacity: 0.15' } },
};

const EASINGS = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  'back-out': [0.34, 1.56, 0.64, 1],
  'expo-out': [0.16, 1, 0.3, 1],
  'circ-in-out': [0.85, 0, 0.15, 1],
};

class CssAnimation extends JGApp {
  static appId = 'css-animation';
  static styles = [...JGApp.styles, sheet];

  #name = 'slide-up';
  #bezier = [...EASINGS['ease-out']];
  #dragging = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="stage"><div class="box" id="box"></div></div>

      <div class="presets" id="presets">
        ${Object.entries(ANIMATIONS).map(
          ([key, item]) => html`<button class="preset" data-anim="${key}" aria-pressed="${String(key === this.#name)}">${item.label}</button>`,
        )}
      </div>

      <div class="fields">
        <jg-field label="Duration"><jg-slider id="duration" min="100" max="4000" step="50" value="700"></jg-slider></jg-field>
        <jg-field label="Delay"><jg-slider id="delay" min="0" max="2000" step="50" value="0"></jg-slider></jg-field>
        <jg-field label="Repeat">
          <jg-select id="iteration" value="infinite">
            <option value="1">Once</option><option value="2">Twice</option>
            <option value="3">3 times</option><option value="infinite">Infinite</option>
          </jg-select>
        </jg-field>
        <jg-field label="Direction">
          <jg-select id="direction" value="normal">
            <option value="normal">normal</option><option value="reverse">reverse</option>
            <option value="alternate">alternate</option><option value="alternate-reverse">alternate-reverse</option>
          </jg-select>
        </jg-field>
        <jg-field label="Fill mode">
          <jg-select id="fill" value="both">
            <option value="none">none</option><option value="forwards">forwards</option>
            <option value="backwards">backwards</option><option value="both">both</option>
          </jg-select>
        </jg-field>
        <jg-field label="Easing">
          <jg-select id="easing" value="ease-out">
            ${Object.keys(EASINGS).map((key) => html`<option value="${key}">${key}</option>`)}
            <option value="custom">custom</option>
          </jg-select>
        </jg-field>
      </div>

      <jg-card title="Timing curve" sub="Drag the handles to shape the easing">
        <div class="bezier">
          <canvas class="curve" id="curve" width="360" height="360" style="width:180px;height:180px"></canvas>
          <div class="stack tight">
            <jg-output id="cubic"></jg-output>
            <div class="hint">Values outside 0 to 1 on the vertical axis overshoot, which is what gives a spring feel.</div>
            <div class="row">
              <jg-button size="sm" variant="outline" id="replay">Replay</jg-button>
              <jg-button size="sm" variant="ghost" id="copy-css">Copy CSS</jg-button>
              <jg-button size="sm" variant="ghost" id="copy-tw">Copy Tailwind</jg-button>
            </div>
          </div>
        </div>
      </jg-card>

      <jg-field label="Generated CSS">
        <jg-textarea id="out" rows="9" readonly></jg-textarea>
      </jg-field>
    </div>`);

    this.bind('[data-anim]', 'click', (event) => {
      this.#name = event.currentTarget.dataset.anim;
      this.$$('[data-anim]').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.anim === this.#name)));
      this.#paint();
    });

    ['#duration', '#delay'].forEach((selector) => this.on(this.$(selector), 'input', () => this.#paint()));
    ['#iteration', '#direction', '#fill'].forEach((selector) => this.on(this.$(selector), 'change', () => this.#paint()));
    this.on(this.$('#easing'), 'change', (event) => {
      if (EASINGS[event.detail.value]) this.#bezier = [...EASINGS[event.detail.value]];
      this.#paint();
    });
    this.on(this.$('#replay'), 'click', () => this.#paint());
    this.on(this.$('#copy-css'), 'click', () => copyText(this.$('#out').value));
    this.on(this.$('#copy-tw'), 'click', () =>
      copyText(`animate-[${this.#name}_${Number(this.$('#duration').value)}ms_cubic-bezier(${this.#bezier.join(',')})_${this.$('#iteration').value}]`),
    );

    const curve = this.$('#curve');
    this.on(curve, 'pointerdown', (event) => this.#grab(event));
    this.on(curve, 'pointermove', (event) => this.#move(event));
    this.on(curve, 'pointerup', () => {
      this.#dragging = null;
    });

    this.#paint();
  }

  #timing() {
    return `cubic-bezier(${this.#bezier.map((value) => Number(value.toFixed(2))).join(', ')})`;
  }

  #cssText() {
    const frames = ANIMATIONS[this.#name].frames;
    const keyframes = Object.entries(frames)
      .map(([stop, rules]) => `  ${stop} { ${rules}; }`)
      .join('\n');

    return `@keyframes ${this.#name} {\n${keyframes}\n}\n\n.element {\n  animation: ${this.#name} ${Number(this.$('#duration').value)}ms ${this.#timing()} ${Number(this.$('#delay').value)}ms ${this.$('#iteration').value} ${this.$('#direction').value} ${this.$('#fill').value};\n}`;
  }

  #paint() {
    const box = this.$('#box');
    const frames = ANIMATIONS[this.#name].frames;
    const keyframes = Object.entries(frames).map(([stop, rules]) => `${stop} { ${rules}; }`).join(' ');

    let style = this.shadowRoot.querySelector('#live');
    if (!style) {
      style = document.createElement('style');
      style.id = 'live';
      this.shadowRoot.append(style);
    }
    style.textContent = `@keyframes ${this.#name} { ${keyframes} }`;

    box.style.animation = 'none';
    void box.offsetWidth;
    box.style.animation = `${this.#name} ${Number(this.$('#duration').value)}ms ${this.#timing()} ${Number(this.$('#delay').value)}ms ${this.$('#iteration').value} ${this.$('#direction').value} ${this.$('#fill').value}`;

    this.$('#cubic').value = this.#timing();
    this.$('#out').value = this.#cssText();
    this.#drawCurve();
  }

  #point(event) {
    const canvas = this.$('#curve');
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
    };
  }

  #grab(event) {
    const point = this.#point(event);
    const first = Math.hypot(point.x - this.#bezier[0], point.y - this.#bezier[1]);
    const second = Math.hypot(point.x - this.#bezier[2], point.y - this.#bezier[3]);
    this.#dragging = first < second ? 0 : 1;
    this.$('#curve').setPointerCapture(event.pointerId);
    this.#move(event);
  }

  #move(event) {
    if (this.#dragging === null) return;
    const point = this.#point(event);
    const index = this.#dragging * 2;
    this.#bezier[index] = Math.min(1, Math.max(0, point.x));
    this.#bezier[index + 1] = Math.min(1.8, Math.max(-0.8, point.y));
    this.$('#easing').value = 'custom';
    this.#paint();
  }

  #drawCurve() {
    const canvas = this.$('#curve');
    const context = canvas.getContext('2d');
    const size = canvas.width;
    const pad = 40;
    const span = size - pad * 2;
    const styles = getComputedStyle(this);
    const accent = styles.getPropertyValue('--ring').trim() || '#8a1c3b';
    const line = styles.getPropertyValue('--border-strong').trim() || '#8886';

    const toX = (value) => pad + value * span;
    const toY = (value) => size - pad - value * span;

    context.clearRect(0, 0, size, size);
    context.strokeStyle = line;
    context.lineWidth = 2;
    context.strokeRect(pad, pad, span, span);

    context.strokeStyle = accent;
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(toX(0), toY(0));
    context.bezierCurveTo(
      toX(this.#bezier[0]), toY(this.#bezier[1]),
      toX(this.#bezier[2]), toY(this.#bezier[3]),
      toX(1), toY(1),
    );
    context.stroke();

    [[0, this.#bezier[0], this.#bezier[1]], [1, this.#bezier[2], this.#bezier[3]]].forEach(([index, x, y]) => {
      context.strokeStyle = line;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(toX(index), toY(index));
      context.lineTo(toX(x), toY(y));
      context.stroke();

      context.fillStyle = accent;
      context.beginPath();
      context.arc(toX(x), toY(y), 12, 0, Math.PI * 2);
      context.fill();
    });
  }
}

define('jg-app-css-animation', CssAnimation);
