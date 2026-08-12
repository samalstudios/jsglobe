import { JGApp, define, html, css } from '../core/app.js';
import { clamp, debounce } from '../core/util.js';

const sheet = css`
  .swatch {
    height: 92px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
  }
  .formats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
  .format { display: flex; flex-direction: column; gap: 4px; }
  .ramp { display: grid; grid-template-columns: repeat(11, 1fr); gap: 4px; }
  .step { aspect-ratio: 1; border-radius: 7px; border: 1px solid var(--border); cursor: pointer; }
  .contrast { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .chip { padding: 12px; border-radius: var(--radius-md); text-align: center; font-size: 13px; font-weight: 600; }
  .widget { display: flex; flex-direction: column; gap: 6px; height: 100%; padding: 0 12px 12px; }
  .widget .box { flex: 1; border-radius: var(--radius-md); border: 1px solid var(--border); }
`;

const clamp255 = (value) => clamp(Math.round(value), 0, 255);

const parseColor = (input) => {
  const value = input.trim().toLowerCase();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value);
  if (hex) {
    const raw = hex[1];
    const expand = raw.length <= 4 ? raw.split('').map((char) => char + char).join('') : raw;
    return {
      r: parseInt(expand.slice(0, 2), 16),
      g: parseInt(expand.slice(2, 4), 16),
      b: parseInt(expand.slice(4, 6), 16),
      a: expand.length === 8 ? parseInt(expand.slice(6, 8), 16) / 255 : 1,
    };
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: clamp255(parts[0]), g: clamp255(parts[1]), b: clamp255(parts[2]), a: parts[3] ?? 1 };
  }
  const hsl = /^hsla?\(([^)]+)\)$/.exec(value);
  if (hsl) {
    const parts = hsl[1].split(/[\s,/]+/).filter(Boolean);
    return hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]) / 100, parseFloat(parts[2]) / 100, parseFloat(parts[3] ?? '1'));
  }
  const probe = new Option().style;
  probe.color = value;
  if (probe.color) {
    const parts = /rgba?\(([^)]+)\)/.exec(probe.color);
    if (parts) {
      const numbers = parts[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: numbers[0], g: numbers[1], b: numbers[2], a: numbers[3] ?? 1 };
    }
  }
  return null;
};

function hslToRgb(h, s, l, a = 1) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;
  const [r, g, b] = (
    h < 60 ? [chroma, secondary, 0]
    : h < 120 ? [secondary, chroma, 0]
    : h < 180 ? [0, chroma, secondary]
    : h < 240 ? [0, secondary, chroma]
    : h < 300 ? [secondary, 0, chroma]
    : [chroma, 0, secondary]
  );
  return { r: clamp255((r + match) * 255), g: clamp255((g + match) * 255), b: clamp255((b + match) * 255), a };
}

const rgbToHsl = ({ r, g, b }) => {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s, l };
};

const toLinear = (channel) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

const hex = ({ r, g, b, a }) =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}${a < 1 ? Math.round(a * 255).toString(16).padStart(2, '0') : ''}`;

const rgbToOklch = ({ r, g, b }) => {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: okL,
    c: Math.hypot(okA, okB),
    h: (Math.atan2(okB, okA) * (180 / Math.PI) + 360) % 360,
  };
};

class ColorConverter extends JGApp {
  static appId = 'color-converter';
  static styles = [...JGApp.styles, sheet];

  #color = { r: 111, g: 124, b: 255, a: 1 };

  renderWidget() {
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <div class="box" id="box"></div>
        <jg-output id="out" no-copy></jg-output>
        <jg-input id="pick" type="color" size="sm"></jg-input>
      </div>
    </div>`);
    const apply = (value) => {
      this.$('#box').style.background = value;
      this.$('#out').value = value;
    };
    apply(hex(this.#color));
    this.$('#pick').value = hex(this.#color);
    this.on(this.$('#pick'), 'input', (event) => apply(event.target.value));
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row nowrap">
        <jg-input id="input" class="grow" placeholder="#6f7cff, rgb(111 124 255), hsl(235 100% 72%), rebeccapurple"></jg-input>
        <jg-input id="picker" type="color" style="width:56px"></jg-input>
        <jg-button variant="outline" id="random">Random</jg-button>
      </div>

      <div class="swatch" id="swatch"></div>

      <div class="formats">
        <div class="format"><span class="label">HEX</span><jg-output data-out="hex"></jg-output></div>
        <div class="format"><span class="label">RGB</span><jg-output data-out="rgb"></jg-output></div>
        <div class="format"><span class="label">HSL</span><jg-output data-out="hsl"></jg-output></div>
        <div class="format"><span class="label">OKLCH</span><jg-output data-out="oklch"></jg-output></div>
        <div class="format"><span class="label">CSS variable</span><jg-output data-out="var"></jg-output></div>
        <div class="format"><span class="label">Swift / Android</span><jg-output data-out="platform"></jg-output></div>
      </div>

      <jg-card title="Tints and shades" sub="Click any step to load it">
        <div class="ramp" id="ramp"></div>
      </jg-card>

      <jg-card title="Contrast" sub="WCAG 2.1 ratio against black and white">
        <div class="contrast">
          <div class="chip" id="onwhite"></div>
          <div class="chip" id="onblack"></div>
        </div>
        <div class="hint" id="verdict"></div>
      </jg-card>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#parse(this.$('#input').value), 140));
    this.on(this.$('#picker'), 'input', (event) => this.#parse(event.target.value));
    this.on(this.$('#random'), 'click', () => {
      const random = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
      this.$('#input').value = random;
      this.#parse(random);
    });

    this.$('#input').value = hex(this.#color);
    this.#apply();
  }

  #parse(value) {
    const parsed = parseColor(value);
    if (!parsed) return;
    this.#color = parsed;
    this.#apply();
  }

  #apply() {
    const color = this.#color;
    const css = `rgb(${color.r} ${color.g} ${color.b}${color.a < 1 ? ` / ${color.a}` : ''})`;
    const hsl = rgbToHsl(color);
    const oklch = rgbToOklch(color);
    const light = luminance(color) > 0.35;

    const swatch = this.$('#swatch');
    swatch.style.background = css;
    swatch.style.color = light ? '#111' : '#fff';
    swatch.textContent = hex(color).toUpperCase();
    this.$('#picker').value = hex({ ...color, a: 1 });

    const set = (key, value) => {
      const node = this.$(`[data-out="${key}"]`);
      if (node) node.value = value;
    };
    set('hex', hex(color).toUpperCase());
    set('rgb', css);
    set('hsl', `hsl(${hsl.h.toFixed(1)} ${(hsl.s * 100).toFixed(1)}% ${(hsl.l * 100).toFixed(1)}%)`);
    set('oklch', `oklch(${(oklch.l * 100).toFixed(1)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`);
    set('var', `--color: ${hex(color)};`);
    set('platform', `UIColor(red: ${(color.r / 255).toFixed(3)}, green: ${(color.g / 255).toFixed(3)}, blue: ${(color.b / 255).toFixed(3)}, alpha: 1)  ·  0xFF${hex(color).slice(1).toUpperCase()}`);

    const ramp = this.$('#ramp');
    ramp.innerHTML = '';
    for (let step = 0; step <= 10; step += 1) {
      const lightness = clamp(0.05 + step * 0.09, 0, 1);
      const shade = hslToRgb(hsl.h, hsl.s, lightness);
      const node = document.createElement('button');
      node.className = 'step';
      node.style.background = hex(shade);
      node.title = hex(shade);
      node.addEventListener('click', () => {
        this.$('#input').value = hex(shade);
        this.#parse(hex(shade));
      });
      ramp.append(node);
    }

    const white = contrast(color, { r: 255, g: 255, b: 255 });
    const black = contrast(color, { r: 0, g: 0, b: 0 });
    const onWhite = this.$('#onwhite');
    onWhite.style.background = '#fff';
    onWhite.style.color = css;
    onWhite.textContent = `On white - ${white.toFixed(2)}:1`;
    const onBlack = this.$('#onblack');
    onBlack.style.background = '#000';
    onBlack.style.color = css;
    onBlack.textContent = `On black - ${black.toFixed(2)}:1`;
    const best = Math.max(white, black);
    this.$('#verdict').textContent =
      best >= 7 ? 'Passes AAA for body text on the better background.'
      : best >= 4.5 ? 'Passes AA for body text on the better background.'
      : best >= 3 ? 'Only passes AA for large text (18pt+).'
      : 'Fails WCAG contrast on both backgrounds.';
  }
}

define('jg-app-color', ColorConverter);
