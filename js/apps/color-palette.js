import { JGApp, define, html, css } from '../core/app.js';
import { palette, scaleFromHex, rgbToOklch, oklchToHex, SHADES } from '../lib/palette.js';
import { copyText, download } from '../core/util.js';

const sheet = css`
  .app { gap: 12px; }
  .grid { display: grid; grid-template-columns: 88px repeat(11, minmax(0, 1fr)); gap: 6px 5px; align-items: center; }
  .head {
    font-size: 10.5px;
    color: var(--muted-foreground);
    text-align: center;
    font-variant-numeric: tabular-nums;
    padding-bottom: 2px;
  }
  .row-name {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--foreground);
    text-align: left;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: -0.01em;
  }
  .row-name:hover { color: var(--ring); }
  .swatch {
    height: 42px;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    padding: 0;
    position: relative;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .swatch::after {
    content: attr(data-hex);
    position: absolute;
    inset: auto 0 -15px 0;
    font: 500 9px/1 var(--font-mono);
    color: var(--muted-foreground);
    opacity: 0;
    transition: opacity 0.12s ease;
    pointer-events: none;
  }
  .swatch:hover { transform: translateY(-2px); z-index: 2; box-shadow: var(--shadow-md); }
  .swatch:hover::after { opacity: 1; }
  .swatch[data-selected="true"] { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--ring); z-index: 3; }
  @media (max-width: 720px) {
    .grid { grid-template-columns: 62px repeat(11, minmax(0, 1fr)); gap: 4px 3px; }
    .swatch { height: 30px; border-radius: 6px; }
    .swatch::after { display: none; }
  }

  .wheel-wrap { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; }
  @media (max-width: 700px) { .wheel-wrap { grid-template-columns: 1fr; justify-items: center; } }
  .wheel { position: relative; width: 240px; height: 240px; touch-action: none; }
  .wheel canvas { width: 100%; height: 100%; border-radius: 999px; display: block; cursor: crosshair; }
  .knob {
    position: absolute;
    width: 18px;
    height: 18px;
    margin: -9px 0 0 -9px;
    border-radius: 999px;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }

  .preview {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 14px;
    align-items: center;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--card);
  }
  .chip { height: 84px; border-radius: var(--radius-md); border: 1px solid var(--border); }
  .values { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px; }
  .value {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: inherit;
    font-family: var(--font-mono);
    font-size: 11.5px;
    cursor: pointer;
  }
  .value:hover { border-color: var(--border-strong); }
  .value span:first-child { color: var(--muted-foreground); }

  .ramp { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); gap: 3px; }
  .ramp .cell { aspect-ratio: 1 / 1.15; border-radius: 6px; display: grid; align-content: end; justify-items: center; padding-bottom: 4px; font-size: 9px; cursor: pointer; }

  .harmony { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
  .harmony .item { display: grid; gap: 4px; cursor: pointer; }
  .harmony .item .box { height: 54px; border-radius: var(--radius-sm); border: 1px solid var(--border); }
  .harmony .item .label { font-size: 10.5px; color: var(--muted-foreground); text-align: center; }

  .saved { display: flex; flex-wrap: wrap; gap: 6px; }
  .saved .dot { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--border); cursor: pointer; }
`;

const HARMONIES = [
  ['Complement', 180],
  ['Analogous −30', -30],
  ['Analogous +30', 30],
  ['Triad −120', -120],
  ['Triad +120', 120],
  ['Split −150', -150],
  ['Split +150', 150],
];

const hexToRgb = (hex) => {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const toHsl = ({ r, g, b }) => {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (delta) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s, l };
};

const luminance = ({ r, g, b }) => {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (hex, against) => {
  const [high, low] = [luminance(hexToRgb(hex)), luminance(hexToRgb(against))].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
};

class ColorPalette extends JGApp {
  static appId = 'color-palette';
  static styles = [...JGApp.styles, sheet];

  #tab = 'palette';
  #selected = '#8a1c3b';
  #wheelLightness = 0.62;

  #saved() {
    return this.store.read([]);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="tab"></jg-tabs>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="save">Save colour</jg-button>
        <jg-select id="exportAs" size="sm" style="width:160px">
          <option value="css">CSS variables</option>
          <option value="tailwind">Tailwind config</option>
          <option value="json">JSON</option>
          <option value="scss">SCSS</option>
        </jg-select>
        <jg-button size="sm" variant="outline" id="export">Export scale</jg-button>
      </div>

      <div class="preview">
        <div class="chip" id="chip"></div>
        <div class="stack tight">
          <div class="values" id="values"></div>
          <div class="hint" id="contrast"></div>
        </div>
      </div>

      <div id="body"></div>

      <div class="stack tight">
        <span class="label">Saved</span>
        <div class="saved" id="savedList"></div>
      </div>
    </div>`);

    this.$('#tab').items = [
      { value: 'palette', label: 'Palette' },
      { value: 'wheel', label: 'Wheel' },
      { value: 'scale', label: 'Scale' },
      { value: 'harmony', label: 'Harmony' },
    ];
    this.$('#tab').value = this.#tab;
    this.on(this.$('#tab'), 'change', (event) => {
      this.#tab = event.detail.value;
      this.#renderTab();
    });

    this.on(this.$('#save'), 'click', () => {
      const saved = [...new Set([this.#selected, ...this.#saved()])].slice(0, 24);
      this.store.write(saved);
      this.#paintSaved();
    });
    this.on(this.$('#export'), 'click', () => this.#export());

    this.#renderTab();
    this.#paintSelected();
    this.#paintSaved();
  }

  #select(hex) {
    this.#selected = hex.toLowerCase();
    this.#paintSelected();
    if (this.#tab === 'palette') {
      this.$$('.swatch').forEach((node) => {
        node.dataset.selected = String(node.dataset.hex === this.#selected);
      });
    }
    if (this.#tab === 'scale' || this.#tab === 'harmony') this.#renderTab();
  }

  #paintSelected() {
    const hex = this.#selected;
    const rgb = hexToRgb(hex);
    const hsl = toHsl(rgb);
    const oklch = rgbToOklch(rgb);

    this.$('#chip').style.background = hex;

    const values = [
      ['HEX', hex.toUpperCase()],
      ['RGB', `rgb(${rgb.r} ${rgb.g} ${rgb.b})`],
      ['HSL', `hsl(${hsl.h.toFixed(0)} ${(hsl.s * 100).toFixed(0)}% ${(hsl.l * 100).toFixed(0)}%)`],
      ['OKLCH', `oklch(${(oklch.l * 100).toFixed(1)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`],
    ];

    this.$('#values').innerHTML = values
      .map(([label, value]) => html`<button class="value" data-copy="${value}"><span>${label}</span><span>${value}</span></button>`)
      .join('');
    this.bind('[data-copy]', 'click', (event) => copyText(event.currentTarget.dataset.copy));

    const white = contrast(hex, '#ffffff');
    const black = contrast(hex, '#000000');
    this.$('#contrast').textContent = `Contrast ${white.toFixed(2)}:1 on white, ${black.toFixed(2)}:1 on black. ${
      Math.max(white, black) >= 4.5 ? 'Passes AA for body text.' : 'Large text only.'
    }`;
  }

  #paintSaved() {
    const saved = this.#saved();
    const list = this.$('#savedList');
    list.innerHTML = saved.length
      ? saved.map((hex) => html`<button class="dot" data-pick="${hex}" style="background:${hex}" title="${hex}"></button>`).join('')
      : html`<span class="hint">Nothing saved yet.</span>`;
    this.bind('[data-pick]', 'click', (event) => this.#select(event.currentTarget.dataset.pick));
    this.bind('[data-pick]', 'contextmenu', (event) => {
      event.preventDefault();
      this.store.write(this.#saved().filter((hex) => hex !== event.currentTarget.dataset.pick));
      this.#paintSaved();
    });
  }

  #renderTab() {
    const body = this.$('#body');
    if (this.#tab === 'palette') this.#palette(body);
    if (this.#tab === 'wheel') this.#wheel(body);
    if (this.#tab === 'scale') this.#scale(body);
    if (this.#tab === 'harmony') this.#harmony(body);
  }

  #palette(body) {
    body.innerHTML = html`
      <div class="grid">
        <span></span>
        ${SHADES.map((shade) => html`<span class="head">${shade}</span>`)}
        ${palette.map(
          (entry) => html`
            <button class="row-name" data-row="${entry.id}" title="Copy the whole ${entry.name} scale">${entry.name}</button>
            ${entry.shades.map(
              (item) => html`<button
                class="swatch"
                data-hex="${item.hex}"
                data-selected="${String(item.hex === this.#selected)}"
                style="background:${item.hex}"
                title="${entry.name} ${item.shade} ${item.hex}"
              ></button>`,
            )}
          `,
        )}
      </div>
      <div class="hint" style="margin-top:8px">Click a swatch to select it, click a name to copy the whole scale.</div>
    `;

    this.bind('.swatch', 'click', (event) => this.#select(event.currentTarget.dataset.hex));
    this.bind('.row-name', 'click', (event) => {
      const entry = palette.find((item) => item.id === event.currentTarget.dataset.row);
      copyText(entry.shades.map((item) => `--${entry.id}-${item.shade}: ${item.hex};`).join('\n'));
    });
  }

  #wheel(body) {
    body.innerHTML = html`
      <div class="wheel-wrap">
        <div class="wheel" id="wheel">
          <canvas id="canvas" width="480" height="480"></canvas>
          <span class="knob" id="knob"></span>
        </div>
        <div class="stack">
          <jg-field label="Lightness">
            <jg-slider id="lightness" min="8" max="98" value="${Math.round(this.#wheelLightness * 100)}"></jg-slider>
          </jg-field>
          <jg-field label="Hex">
            <jg-input id="hex" mono value="${this.#selected}"></jg-input>
          </jg-field>
          <jg-field label="Native picker">
            <jg-input id="native" type="color" value="${this.#selected}"></jg-input>
          </jg-field>
          <div class="hint">The wheel maps hue around the circle and chroma from the centre outwards in OKLCH, so
            lightness stays even as you move around it.</div>
        </div>
      </div>
    `;

    const canvas = this.$('#canvas');
    this.#drawWheel(canvas);

    const pick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      const radius = Math.min(1, Math.hypot(x, y));
      const hue = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
      const hex = oklchToHex(this.#wheelLightness, radius * 0.33, hue);
      this.#select(hex);
      this.$('#hex').value = hex;
      this.$('#native').value = hex;
      this.#placeKnob(radius, hue);
    };

    this.on(canvas, 'pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      pick(event);
    });
    this.on(canvas, 'pointermove', (event) => {
      if (event.buttons) pick(event);
    });

    this.on(this.$('#lightness'), 'input', () => {
      this.#wheelLightness = Number(this.$('#lightness').value) / 100;
      this.#drawWheel(canvas);
    });
    this.on(this.$('#hex'), 'change', (event) => {
      if (/^#?[0-9a-f]{6}$/i.test(event.detail.value)) this.#select(`#${event.detail.value.replace('#', '')}`);
    });
    this.on(this.$('#native'), 'input', (event) => this.#select(event.target.value));

    const { c, h } = rgbToOklch(hexToRgb(this.#selected));
    this.#placeKnob(Math.min(1, c / 0.33), h);
  }

  #placeKnob(radius, hue) {
    const knob = this.$('#knob');
    if (!knob) return;
    const angle = (hue * Math.PI) / 180;
    knob.style.left = `${50 + Math.cos(angle) * radius * 50}%`;
    knob.style.top = `${50 + Math.sin(angle) * radius * 50}%`;
    knob.style.background = this.#selected;
  }

  #drawWheel(canvas) {
    const context = canvas.getContext('2d');
    const size = canvas.width;
    const centre = size / 2;
    const image = context.createImageData(size, size);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = (x - centre) / centre;
        const dy = (y - centre) / centre;
        const radius = Math.hypot(dx, dy);
        const index = (y * size + x) * 4;
        if (radius > 1) {
          image.data[index + 3] = 0;
          continue;
        }
        const hue = (Math.atan2(dy, dx) * (180 / Math.PI) + 360) % 360;
        const hex = oklchToHex(this.#wheelLightness, radius * 0.33, hue);
        image.data[index] = parseInt(hex.slice(1, 3), 16);
        image.data[index + 1] = parseInt(hex.slice(3, 5), 16);
        image.data[index + 2] = parseInt(hex.slice(5, 7), 16);
        image.data[index + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
  }

  #scale(body) {
    const scale = scaleFromHex(this.#selected);
    body.innerHTML = html`
      <div class="stack">
        <span class="label">Generated scale from ${this.#selected.toUpperCase()}</span>
        <div class="ramp">
          ${scale.map(
            (item) => html`<div
              class="cell"
              data-hex="${item.hex}"
              style="background:${item.hex};color:${contrast(item.hex, '#ffffff') > 3 ? '#fff' : '#111'}"
              title="${item.hex}"
            >${item.shade}</div>`,
          )}
        </div>
        <pre class="code scroll" style="max-height:190px">${scale.map((item) => `--brand-${item.shade}: ${item.hex};`).join('\n')}</pre>
      </div>
    `;
    this.bind('.cell', 'click', (event) => this.#select(event.currentTarget.dataset.hex));
  }

  #harmony(body) {
    const { l, c, h } = rgbToOklch(hexToRgb(this.#selected));
    const items = [['Base', 0], ...HARMONIES].map(([label, offset]) => ({
      label,
      hex: offset === 0 ? this.#selected : oklchToHex(l, c, (h + offset + 360) % 360),
    }));

    body.innerHTML = html`
      <div class="harmony">
        ${items.map(
          (item) => html`<div class="item" data-hex="${item.hex}">
            <span class="box" style="background:${item.hex}"></span>
            <span class="label" style="text-align:center">${item.label}</span>
            <span class="label mono" style="text-align:center">${item.hex.toUpperCase()}</span>
          </div>`,
        )}
      </div>
      <div class="hint" style="margin-top:10px">
        Rotations keep lightness and chroma fixed in OKLCH, so every colour in the set carries the same visual weight.
      </div>
    `;
    this.bind('.item', 'click', (event) => this.#select(event.currentTarget.dataset.hex));
  }

  #export() {
    const scale = scaleFromHex(this.#selected);
    const format = this.$('#exportAs').value;

    const output = {
      css: `:root {\n${scale.map((item) => `  --brand-${item.shade}: ${item.hex};`).join('\n')}\n}`,
      scss: scale.map((item) => `$brand-${item.shade}: ${item.hex};`).join('\n'),
      json: JSON.stringify(Object.fromEntries(scale.map((item) => [item.shade, item.hex])), null, 2),
      tailwind: `colors: {\n  brand: {\n${scale.map((item) => `    ${item.shade}: '${item.hex}',`).join('\n')}\n  },\n}`,
    }[format];

    const extension = { css: 'css', scss: 'scss', json: 'json', tailwind: 'js' }[format];
    download(`palette.${extension}`, output, 'text/plain');
    copyText(output);
  }
}

define('jg-app-color-palette', ColorPalette);
