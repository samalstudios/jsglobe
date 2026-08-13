import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, download, toast } from '../core/util.js';

const sheet = css`
  .drop {
    display: grid;
    place-items: center;
    flex: none;
    min-height: 110px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    color: var(--muted-foreground);
    font-size: 13px;
    cursor: pointer;
    padding: 12px;
    text-align: center;
  }
  .drop[data-over="true"] { border-color: var(--ring); color: var(--foreground); }
  .shell { display: grid; grid-template-columns: 1fr 320px; gap: 14px; }
  @media (max-width: 880px) { .shell { grid-template-columns: 1fr; } }
  .sizes { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
  .tile { display: grid; justify-items: center; gap: 6px; }
  .tile canvas {
    border: 1px solid var(--border);
    border-radius: 6px;
    background:
      repeating-conic-gradient(color-mix(in srgb, var(--muted) 70%, transparent) 0% 25%, transparent 0% 50%) 50% / 12px 12px;
    image-rendering: auto;
  }
  .tile span { font-family: var(--font-mono); font-size: 10.5px; color: var(--muted-foreground); }
  .chrome {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px 7px 8px;
    border: 1px solid var(--border);
    border-radius: 10px 10px 0 0;
    background: color-mix(in srgb, var(--muted) 70%, transparent);
    max-width: 260px;
  }
  .chrome canvas { border-radius: 3px; }
  .chrome .label { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fields { display: grid; gap: 10px; }
`;

const SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 256, 512];

const shapes = {
  square: (context, size) => {
    context.rect(0, 0, size, size);
  },
  rounded: (context, size) => {
    const radius = size * 0.22;
    context.roundRect(0, 0, size, size, radius);
  },
  circle: (context, size) => {
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  },
};

class FaviconGenerator extends JGApp {
  static appId = 'favicon-generator';
  static styles = [...JGApp.styles, sheet];

  #image = null;
  #name = 'icon';

  renderApp() {
    this.paint(html`<div class="app">
      <div class="drop" id="drop">Drop a PNG, JPEG or SVG here, or click to choose one</div>

      <div class="shell" id="body" hidden>
        <div class="stack tight">
          <jg-card title="Generated sizes" sub="Rendered from your image on this device">
            <div class="sizes" id="sizes"></div>
          </jg-card>

          <jg-card title="Browser tab preview">
            <div class="chrome">
              <canvas id="tab" width="16" height="16" style="width:16px;height:16px"></canvas>
              <span class="label" id="tab-label">Your site</span>
            </div>
          </jg-card>
        </div>

        <div class="stack tight">
          <div class="fields">
            <jg-field label="Shape">
              <jg-select id="shape" value="rounded">
                <option value="square">Square</option>
                <option value="rounded">Rounded square</option>
                <option value="circle">Circle</option>
              </jg-select>
            </jg-field>
            <jg-field label="Background">
              <div class="row">
                <input type="color" id="bg" value="#8a1c3b" />
                <jg-switch id="transparent" checked></jg-switch><span class="hint">Transparent</span>
              </div>
            </jg-field>
            <jg-field label="Padding"><jg-slider id="padding" min="0" max="30" value="0"></jg-slider></jg-field>
            <jg-field label="Site name"><jg-input id="site" value="Your site"></jg-input></jg-field>
            <jg-field label="Theme colour"><input type="color" id="theme" value="#8a1c3b" /></jg-field>
          </div>

          <div class="row">
            <jg-button size="sm" id="save-all">Download all</jg-button>
            <jg-button size="sm" variant="outline" id="save-ico">Download .ico</jg-button>
          </div>

          <jg-field label="HTML"><jg-code id="html-out" rows="7" language="html" readonly></jg-code></jg-field>
          <jg-field label="manifest.webmanifest"><jg-code id="manifest-out" rows="9" language="json" readonly></jg-code></jg-field>
          <div class="row">
            <jg-button size="sm" variant="ghost" id="copy-html">Copy HTML</jg-button>
            <jg-button size="sm" variant="ghost" id="copy-manifest">Copy manifest</jg-button>
            <jg-button size="sm" variant="ghost" id="save-manifest">Save manifest</jg-button>
          </div>
        </div>
      </div>

      <div class="hint">
        Everything is drawn with a canvas in this browser, so your artwork is never uploaded. The .ico bundles the
        16, 32 and 48 pixel versions in one file.
      </div>

      <input type="file" id="picker" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden />
    </div>`);

    const picker = this.$('#picker');
    const drop = this.$('#drop');

    this.on(drop, 'click', () => picker.click());
    this.on(picker, 'change', () => this.#load(picker.files[0]));
    this.on(drop, 'dragover', (event) => {
      event.preventDefault();
      drop.dataset.over = 'true';
    });
    this.on(drop, 'dragleave', () => {
      drop.dataset.over = 'false';
    });
    this.on(drop, 'drop', (event) => {
      event.preventDefault();
      drop.dataset.over = 'false';
      this.#load(event.dataTransfer.files[0]);
    });

    const run = debounce(() => this.#paint(), 140);
    ['#shape'].forEach((selector) => this.on(this.$(selector), 'change', run));
    this.on(this.$('#bg'), 'input', run);
    this.on(this.$('#transparent'), 'change', run);
    this.on(this.$('#padding'), 'input', run);
    this.on(this.$('#site'), 'input', run);
    this.on(this.$('#theme'), 'input', run);

    this.on(this.$('#save-all'), 'click', () => this.#saveAll());
    this.on(this.$('#save-ico'), 'click', () => this.#saveIco());
    this.on(this.$('#copy-html'), 'click', () => copyText(this.$('#html-out').value));
    this.on(this.$('#copy-manifest'), 'click', () => copyText(this.$('#manifest-out').value));
    this.on(this.$('#save-manifest'), 'click', () => download('manifest.webmanifest', this.$('#manifest-out').value, 'application/manifest+json'));
  }

  async #load(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('Choose a PNG, JPEG, WebP or SVG image', 'error');
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'sync';

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    }).catch(() => toast('That image could not be read', 'error'));

    URL.revokeObjectURL(url);
    if (!image.width) return;

    this.#image = image;
    this.#name = file.name.replace(/\.[^.]+$/, '') || 'icon';
    this.$('#body').hidden = false;
    this.$('#drop').textContent = `${file.name} - ${image.width} x ${image.height}`;
    this.#paint();
  }

  #draw(canvas, size) {
    const context = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size;
    context.clearRect(0, 0, size, size);

    context.save();
    context.beginPath();
    (shapes[this.$('#shape').value] ?? shapes.square)(context, size);
    context.clip();

    if (!this.$('#transparent').checked) {
      context.fillStyle = this.$('#bg').value;
      context.fillRect(0, 0, size, size);
    }

    const pad = (Number(this.$('#padding').value) / 100) * size;
    const box = size - pad * 2;
    const scale = Math.min(box / this.#image.width, box / this.#image.height);
    const width = this.#image.width * scale;
    const height = this.#image.height * scale;

    context.imageSmoothingQuality = 'high';
    context.drawImage(this.#image, (size - width) / 2, (size - height) / 2, width, height);
    context.restore();
  }

  #paint() {
    if (!this.#image) return;

    this.$('#sizes').innerHTML = SIZES.map(
      (size) => html`<div class="tile">
        <canvas data-size="${size}" style="width:${Math.min(64, size)}px;height:${Math.min(64, size)}px"></canvas>
        <span>${size}x${size}</span>
      </div>`,
    ).join('');

    this.$$('[data-size]').forEach((canvas) => this.#draw(canvas, Number(canvas.dataset.size)));
    this.#draw(this.$('#tab'), 16);
    this.$('#tab-label').textContent = this.$('#site').value || 'Your site';

    const theme = this.$('#theme').value;
    this.$('#html-out').value = `<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="${theme}">`;

    this.$('#manifest-out').value = JSON.stringify(
      {
        name: this.$('#site').value || 'Your site',
        short_name: (this.$('#site').value || 'Site').slice(0, 12),
        start_url: '/',
        display: 'standalone',
        theme_color: theme,
        background_color: this.$('#transparent').checked ? '#ffffff' : this.$('#bg').value,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      null,
      2,
    );
  }

  #blob(size) {
    const canvas = document.createElement('canvas');
    this.#draw(canvas, size);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  async #saveAll() {
    for (const [index, size] of SIZES.entries()) {
      const blob = await this.#blob(size);
      const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
      download(name, blob, 'image/png');
      if (index < SIZES.length - 1) await new Promise((resolve) => setTimeout(resolve, 320));
    }
    toast(`Saved ${SIZES.length} PNG files`);
  }

  async #saveIco() {
    const sizes = [16, 32, 48];
    const images = await Promise.all(
      sizes.map(async (size) => new Uint8Array(await (await this.#blob(size)).arrayBuffer())),
    );

    const header = 6 + images.length * 16;
    const total = header + images.reduce((sum, image) => sum + image.length, 0);
    const bytes = new Uint8Array(total);
    const view = new DataView(bytes.buffer);

    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, images.length, true);

    let offset = header;
    images.forEach((image, index) => {
      const entry = 6 + index * 16;
      const size = sizes[index];
      bytes[entry] = size === 256 ? 0 : size;
      bytes[entry + 1] = size === 256 ? 0 : size;
      bytes[entry + 2] = 0;
      bytes[entry + 3] = 0;
      view.setUint16(entry + 4, 1, true);
      view.setUint16(entry + 6, 32, true);
      view.setUint32(entry + 8, image.length, true);
      view.setUint32(entry + 12, offset, true);
      bytes.set(image, offset);
      offset += image.length;
    });

    download('favicon.ico', bytes, 'image/x-icon');
    toast('favicon.ico saved with 16, 32 and 48 pixel frames');
  }
}

define('jg-app-favicon-generator', FaviconGenerator);
