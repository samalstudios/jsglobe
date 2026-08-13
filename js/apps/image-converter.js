import { JGApp, define, html, css } from '../core/app.js';
import { download, formatBytes, toast } from '../core/util.js';

const sheet = css`
  .drop {
    display: grid;
    place-items: center;
    gap: 8px;
    padding: 26px 18px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 40%, transparent);
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .drop[data-over="true"] { border-color: var(--ring); background: color-mix(in srgb, var(--ring) 12%, transparent); }
  .drop .glyph { font-size: 22px; opacity: 0.6; }
  .items { display: flex; flex-direction: column; gap: 8px; }
  .item {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 9px 11px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
  }
  .thumb {
    width: 56px;
    height: 44px;
    border-radius: 6px;
    object-fit: cover;
    background: color-mix(in srgb, var(--muted) 70%, transparent);
  }
  .meta { min-width: 0; }
  .meta .name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta .info { font-size: 11.5px; color: var(--muted-foreground); }
  .saving { color: var(--success); }
  .growth { color: var(--warning); }
  .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
`;

const FORMATS = [
  { value: 'image/png', label: 'PNG', extension: 'png' },
  { value: 'image/jpeg', label: 'JPEG', extension: 'jpg' },
  { value: 'image/webp', label: 'WebP', extension: 'webp' },
];

const supports = (type) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  return canvas.toDataURL(type).startsWith(`data:${type}`);
};

class ImageConverter extends JGApp {
  static appId = 'image-converter';
  static styles = [...JGApp.styles, sheet];

  #items = [];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="drop" id="drop">
        <span class="glyph">▤</span>
        <span class="strong">Drop images here or click to choose</span>
        <span class="hint">Everything is converted in this tab with canvas. Files never leave the device.</span>
      </div>

      <div class="grid3">
        <jg-field label="Convert to">
          <jg-select id="format" value="image/webp">
            ${FORMATS.filter((format) => supports(format.value)).map(
              (format) => html`<option value="${format.value}">${format.label}</option>`,
            )}
          </jg-select>
        </jg-field>
        <jg-field label="Quality" hint="JPEG and WebP only">
          <jg-slider id="quality" min="10" max="100" value="82"></jg-slider>
        </jg-field>
        <jg-field label="Max width" hint="0 keeps the original">
          <jg-input id="width" type="number" min="0" max="10000" value="0" suffix="px"></jg-input>
        </jg-field>
        <jg-field label="Max height" hint="0 keeps the original">
          <jg-input id="height" type="number" min="0" max="10000" value="0" suffix="px"></jg-input>
        </jg-field>
      </div>

      <div class="row">
        <jg-switch id="keepRatio" checked></jg-switch><span class="hint">Keep aspect ratio</span>
        <jg-switch id="background"></jg-switch><span class="hint">Flatten transparency onto white</span>
        <span class="grow"></span>
        <jg-button variant="outline" size="sm" id="clear">Clear</jg-button>
        <jg-button id="convert">Convert all</jg-button>
      </div>

      <div class="items" id="items"></div>
    </div>`);

    const drop = this.$('#drop');
    this.on(drop, 'click', () => this.#pick());
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
      this.#add([...event.dataTransfer.files].filter((file) => file.type.startsWith('image/')));
    });

    this.on(this.$('#convert'), 'click', () => this.#convertAll());
    this.on(this.$('#clear'), 'click', () => {
      this.#items = [];
      this.#paint();
    });

    this.#paint();
  }

  #pick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => this.#add([...input.files]);
    input.click();
  }

  async #add(files) {
    for (const file of files) {
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (!bitmap) continue;
      this.#items.push({
        file,
        width: bitmap.width,
        height: bitmap.height,
        preview: URL.createObjectURL(file),
        result: null,
      });
      bitmap.close?.();
    }
    this.#paint();
  }

  #paint() {
    const node = this.$('#items');
    if (!this.#items.length) {
      node.innerHTML = html`<jg-empty glyph="▤" title="No images yet">Add PNG, JPEG, WebP, GIF, AVIF or SVG files.</jg-empty>`;
      return;
    }

    node.innerHTML = this.#items
      .map((item, index) => {
        const ratio = item.result ? (item.result.size / item.file.size - 1) * 100 : 0;
        return html`<div class="item">
          <img class="thumb" src="${item.result?.url ?? item.preview}" alt="" />
          <span class="meta">
            <span class="name">${item.file.name}</span>
            <span class="info">
              ${item.width}×${item.height} · ${formatBytes(item.file.size)}
              ${item.result
                ? html` → ${item.result.width}×${item.result.height} · ${formatBytes(item.result.size)}
                    <span class="${ratio <= 0 ? 'saving' : 'growth'}">${ratio <= 0 ? '' : '+'}${ratio.toFixed(0)}%</span>`
                : ''}
            </span>
          </span>
          <span class="row tight">
            ${item.result ? html`<jg-button size="sm" variant="outline" data-save="${index}">Save</jg-button>` : ''}
            <jg-button size="icon-sm" variant="ghost" data-remove="${index}">✕</jg-button>
          </span>
        </div>`;
      })
      .join('');

    this.bind('[data-save]', 'click', (event) => {
      const item = this.#items[Number(event.currentTarget.dataset.save)];
      download(item.result.name, item.result.blob, item.result.type);
    });
    this.bind('[data-remove]', 'click', (event) => {
      this.#items.splice(Number(event.currentTarget.dataset.remove), 1);
      this.#paint();
    });
  }

  async #convertAll() {
    if (!this.#items.length) return this.#pick();

    const type = this.$('#format').value;
    const quality = Number(this.$('#quality').value) / 100;
    const maxWidth = Number(this.$('#width').value) || 0;
    const maxHeight = Number(this.$('#height').value) || 0;
    const keepRatio = this.$('#keepRatio').checked;
    const flatten = this.$('#background').checked || type === 'image/jpeg';
    const extension = FORMATS.find((format) => format.value === type)?.extension ?? 'png';

    for (const item of this.#items) {
      const bitmap = await createImageBitmap(item.file);
      let { width, height } = bitmap;

      if (maxWidth || maxHeight) {
        const scaleWidth = maxWidth ? maxWidth / width : Infinity;
        const scaleHeight = maxHeight ? maxHeight / height : Infinity;
        const scale = Math.min(scaleWidth, scaleHeight, 1);
        if (keepRatio) {
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        } else {
          width = maxWidth || width;
          height = maxHeight || height;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      if (flatten) {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
      if (!blob) {
        toast(`Could not encode ${item.file.name}`, 'error');
        continue;
      }

      if (item.result?.url) URL.revokeObjectURL(item.result.url);
      item.result = {
        blob,
        type,
        size: blob.size,
        width,
        height,
        url: URL.createObjectURL(blob),
        name: `${item.file.name.replace(/\.[^.]+$/, '')}.${extension}`,
      };
    }

    this.#paint();
    toast(`Converted ${this.#items.length} image${this.#items.length === 1 ? '' : 's'}`, 'success');
  }
}

define('jg-app-image-converter', ImageConverter);
