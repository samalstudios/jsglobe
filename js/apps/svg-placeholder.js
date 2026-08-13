import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, download } from '../core/util.js';

const sheet = css`
  .stage {
    display: grid;
    place-items: center;
    flex: none;
    min-height: 240px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background:
      repeating-conic-gradient(color-mix(in srgb, var(--muted) 70%, transparent) 0% 25%, transparent 0% 50%) 50% / 18px 18px;
    overflow: auto;
  }
  .stage svg { max-width: 100%; height: auto; box-shadow: var(--shadow-md); border-radius: 4px; }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
  .swatches { display: flex; flex-wrap: wrap; gap: 6px; }
  .swatch {
    width: 30px;
    height: 30px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    cursor: pointer;
    padding: 0;
  }
`;

const THEMES = [
  { id: 'slate', background: '#e2e8f0', foreground: '#64748b' },
  { id: 'dark', background: '#18181b', foreground: '#a1a1aa' },
  { id: 'maroon', background: '#f5e6ea', foreground: '#8a1c3b' },
  { id: 'sky', background: '#e0f2fe', foreground: '#0369a1' },
  { id: 'sand', background: '#f5efe4', foreground: '#8a6d3b' },
  { id: 'mint', background: '#e6f5ec', foreground: '#2f6f4e' },
];

const build = ({ width, height, background, foreground, text, font, pattern, radius }) => {
  const label = text || `${width} x ${height}`;
  const size = font || Math.max(12, Math.round(Math.min(width, height) / 6));
  const grid =
    pattern === 'grid'
      ? `<defs><pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="${foreground}" stroke-opacity="0.25"/></pattern></defs><rect width="${width}" height="${height}" rx="${radius}" fill="url(#p)"/>`
      : '';
  const cross =
    pattern === 'cross'
      ? `<path d="M0 0 ${width} ${height} M${width} 0 0 ${height}" stroke="${foreground}" stroke-opacity="0.3" fill="none"/>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
  <rect width="${width}" height="${height}" rx="${radius}" fill="${background}"/>
  ${grid}${cross}
  <text x="50%" y="50%" fill="${foreground}" font-family="system-ui, sans-serif" font-size="${size}" font-weight="600" text-anchor="middle" dominant-baseline="central">${label}</text>
</svg>`;
};

class SvgPlaceholder extends JGApp {
  static appId = 'svg-placeholder';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="stage" id="stage"></div>

      <div class="fields">
        <jg-field label="Width"><jg-input id="w" type="number" min="8" max="4000" value="600"></jg-input></jg-field>
        <jg-field label="Height"><jg-input id="h" type="number" min="8" max="4000" value="400"></jg-input></jg-field>
        <jg-field label="Corner radius"><jg-input id="radius" type="number" min="0" max="200" value="0"></jg-input></jg-field>
        <jg-field label="Font size"><jg-input id="font" type="number" min="0" max="400" value="0" placeholder="auto"></jg-input></jg-field>
        <jg-field label="Pattern">
          <jg-select id="pattern" value="none">
            <option value="none">Plain</option>
            <option value="grid">Grid</option>
            <option value="cross">Diagonals</option>
          </jg-select>
        </jg-field>
        <jg-field label="Label"><jg-input id="text" placeholder="600 x 400"></jg-input></jg-field>
      </div>

      <div class="row">
        <jg-field label="Background" row><input type="color" id="bg" value="#e2e8f0" /></jg-field>
        <jg-field label="Text" row><input type="color" id="fg" value="#64748b" /></jg-field>
        <span class="grow"></span>
        <div class="swatches">
          ${THEMES.map(
            (theme) => html`<button
              class="swatch"
              data-theme="${theme.id}"
              title="${theme.id}"
              style="background:${theme.background};color:${theme.foreground};border-color:${theme.foreground}"
            ></button>`,
          )}
        </div>
      </div>

      <jg-field label="Markup"><jg-code id="out" rows="9" language="svg" readonly></jg-code></jg-field>

      <div class="row">
        <jg-button size="sm" variant="outline" id="copy">Copy SVG</jg-button>
        <jg-button size="sm" variant="outline" id="copy-url">Copy data URI</jg-button>
        <jg-button size="sm" variant="ghost" id="copy-img">Copy img tag</jg-button>
        <jg-button size="sm" variant="ghost" id="download">Download</jg-button>
      </div>
    </div>`);

    const run = debounce(() => this.#paint(), 120);
    ['#w', '#h', '#radius', '#font', '#text'].forEach((selector) => this.on(this.$(selector), 'input', run));
    this.on(this.$('#pattern'), 'change', run);
    this.on(this.$('#bg'), 'input', run);
    this.on(this.$('#fg'), 'input', run);

    this.bind('[data-theme]', 'click', (event) => {
      const theme = THEMES.find((item) => item.id === event.currentTarget.dataset.theme);
      this.$('#bg').value = theme.background;
      this.$('#fg').value = theme.foreground;
      this.#paint();
    });

    this.on(this.$('#copy'), 'click', () => copyText(this.#markup()));
    this.on(this.$('#copy-url'), 'click', () => copyText(this.#dataUri()));
    this.on(this.$('#copy-img'), 'click', () => {
      const options = this.#options();
      copyText(`<img src="${this.#dataUri()}" width="${options.width}" height="${options.height}" alt="${options.text || 'placeholder'}">`);
    });
    this.on(this.$('#download'), 'click', () => {
      const options = this.#options();
      download(`placeholder-${options.width}x${options.height}.svg`, this.#markup(), 'image/svg+xml');
    });

    this.#paint();
  }

  #options() {
    const clamp = (value, min, max, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
    };
    return {
      width: clamp(this.$('#w').value, 8, 4000, 600),
      height: clamp(this.$('#h').value, 8, 4000, 400),
      radius: Math.max(0, Number(this.$('#radius').value) || 0),
      font: Math.max(0, Number(this.$('#font').value) || 0),
      pattern: this.$('#pattern').value,
      text: this.$('#text').value.trim(),
      background: this.$('#bg').value,
      foreground: this.$('#fg').value,
    };
  }

  #markup() {
    return build(this.#options());
  }

  #dataUri() {
    return `data:image/svg+xml,${encodeURIComponent(this.#markup().replace(/\n\s*/g, ' '))}`;
  }

  #paint() {
    const markup = this.#markup();
    this.$('#stage').innerHTML = markup;
    this.$('#out').value = markup;
  }
}

define('jg-app-svg-placeholder', SvgPlaceholder);
