import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { download, formatBytes, toast } from '../../core/util.js';

const t = await appWords('image-converter', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const FORMATS = [
  { value: 'image/png', label: 'PNG', extension: 'png' },
  { value: 'image/jpeg', label: 'JPEG', extension: 'jpg' },
  { value: 'image/webp', label: t('image-converter.webp', 'WebP'), extension: 'webp' },
];

const supports = (type) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  return canvas.toDataURL(type).startsWith(`data:${type}`);
};

const encode = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const paint = (bitmap, width, height, flatten) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  if (flatten) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
};

class ImageConverter extends JGApp {
  static appId = 'image-converter';
  static styles = [...JGApp.styles, sheet];

  #items = [];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="drop" id="drop">
        <span class="glyph">▤</span>
        <span class="strong">${t('image-converter.dropImagesHereOrClick', 'Drop images here or click to choose')}</span>
        <span class="hint">${t('image-converter.everythingIsConvertedInThis', 'Everything is converted in this tab with canvas. Files never leave the device.')}</span>
      </div>

      <div class="grid3">
        <jg-field label="${t('image-converter.convertTo', 'Convert to')}">
          <jg-select id="format" value="image/webp">
            ${FORMATS.filter((format) => supports(format.value)).map(
              (format) => html`<option value="${format.value}">${format.label}</option>`,
            )}
          </jg-select>
        </jg-field>
        <jg-field label="${t('image-converter.quality', 'Quality')}" hint="${t('image-converter.jpegAndWebpOnly', 'JPEG and WebP only')}">
          <jg-slider id="quality" min="10" max="100" value="82"></jg-slider>
        </jg-field>
        <jg-field label="${t('image-converter.maxWidth', 'Max width')}" hint="${t('image-converter.0KeepsTheOriginal', '0 keeps the original')}">
          <jg-input id="width" type="number" min="0" max="10000" value="0" suffix="${t('image-converter.px', 'px')}"></jg-input>
        </jg-field>
        <jg-field label="${t('image-converter.maxHeight', 'Max height')}" hint="${t('image-converter.0KeepsTheOriginal', '0 keeps the original')}">
          <jg-input id="height" type="number" min="0" max="10000" value="0" suffix="${t('image-converter.px', 'px')}"></jg-input>
        </jg-field>
        <jg-field label="${t('image-converter.targetSize', 'Target file size')}" hint="${t('image-converter.0LeavesQualityAlone', '0 leaves the quality slider in charge')}">
          <jg-input id="target" type="number" min="0" step="10" value="0" grouped suffix="${t('image-converter.kb', 'KB')}"></jg-input>
        </jg-field>
      </div>

      <div class="row">
        <jg-switch id="keepRatio" checked></jg-switch><span class="hint">${t('image-converter.keepAspectRatio', 'Keep aspect ratio')}</span>
        <jg-switch id="background"></jg-switch><span class="hint">${t('image-converter.flattenTransparencyOntoWhite', 'Flatten transparency onto white')}</span>
        <span class="grow"></span>
        <jg-button variant="outline" size="sm" id="clear">${t('image-converter.clear', 'Clear')}</jg-button>
        <jg-button id="convert">${t('image-converter.convertAll', 'Convert all')}</jg-button>
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
      node.innerHTML = html`<jg-empty glyph="▤" title="${t('image-converter.noImagesYet', 'No images yet')}">${t('image-converter.addPngJpegWebpGif', 'Add PNG, JPEG, WebP, GIF, AVIF or SVG files.')}</jg-empty>`;
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
            ${item.result ? html`<jg-button size="sm" variant="outline" data-save="${index}">${t('image-converter.save', 'Save')}</jg-button>` : ''}
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

  async #squeeze(bitmap, type, limit, width, height, flatten) {
    const gradual = type === 'image/jpeg' || type === 'image/webp';
    let scale = 1;
    let last = null;

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const canvas = paint(bitmap, width * scale, height * scale, flatten);

      if (!gradual) {
        const flat = await encode(canvas, type);
        last = flat ?? last;
        if (flat && flat.size <= limit) return flat;
        scale *= 0.75;
        continue;
      }

      let low = 0.05;
      let high = 0.97;
      let best = null;
      for (let step = 0; step < 8; step += 1) {
        const quality = (low + high) / 2;
        const blob = await encode(canvas, type, quality);
        if (!blob) break;
        last = blob;
        if (blob.size <= limit) {
          best = blob;
          low = quality;
        } else {
          high = quality;
        }
      }
      if (best) return best;
      scale *= 0.75;
    }
    return last;
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
    const target = Math.max(0, Number(this.$('#target').value) || 0) * 1024;

    for (const item of this.#items) {
      const bitmap = await createImageBitmap(item.file);
      const bitmap2 = await createImageBitmap(item.file);
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

      const blob = target
        ? await this.#squeeze(bitmap2, type, target, width, height, flatten)
        : await encode(canvas, type, quality);
      if (!blob) {
        toast(`Could not encode ${item.file.name}`, 'error');
        continue;
      }

      bitmap2.close?.();
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
