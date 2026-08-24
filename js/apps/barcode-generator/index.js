import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { debounce, copyText, download, toast } from '../../core/util.js';
import { encodeCode128, encodeEan13, encodeEan8, encodeCode39 } from '../../lib/barcode.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const FORMATS = {
  code128: { label: t('barcode-generator.code128', 'Code 128'), hint: 'Any printable ASCII', build: encodeCode128 },
  ean13: { label: t('barcode-generator.ean13', 'EAN-13'), hint: '12 or 13 digits', build: encodeEan13 },
  ean8: { label: t('barcode-generator.ean8', 'EAN-8'), hint: '7 or 8 digits', build: encodeEan8 },
  code39: { label: t('barcode-generator.code39', 'Code 39'), hint: 'A-Z, digits and - . $ / + %', build: encodeCode39 },
};

const PRESETS = {
  code128: ['TOOLBOX-2026', 'SKU-00184', 'https://jsglobe.com'],
  ean13: ['4006381333931', '5901234123457'],
  ean8: ['96385074'],
  code39: ['TOOLBOX', 'PART 42-A'],
};

class BarcodeGenerator extends JGApp {
  static appId = 'barcode-generator';
  static styles = [...JGApp.styles, sheet];

  #format = 'code128';

  renderApp() {
    const saved = this.store.read({ format: 'code128', value: '' });
    this.#format = saved.format ?? 'code128';

    this.paint(html`<div class="app">
      <div class="stage" id="stage"></div>

      <div class="fields">
        <jg-field label="${t('barcode-generator.format', 'Format')}">
          <jg-select id="format" value="${this.#format}">
            ${Object.entries(FORMATS).map(([key, format]) => html`<option value="${key}">${format.label}</option>`)}
          </jg-select>
        </jg-field>
        <jg-field label="${t('barcode-generator.value', 'Value')}"><jg-input id="value" mono value="${saved.value || PRESETS[this.#format][0]}"></jg-input></jg-field>
        <jg-field label="${t('barcode-generator.barWidth', 'Bar width')}"><jg-slider id="width" min="1" max="6" value="2"></jg-slider></jg-field>
        <jg-field label="${t('barcode-generator.height', 'Height')}"><jg-slider id="height" min="40" max="220" value="120"></jg-slider></jg-field>
      </div>

      <div class="row">
        <jg-switch id="caption" checked></jg-switch><span class="hint">${t('barcode-generator.printTheValueUnderThe', 'Print the value under the bars')}</span>
        <span class="grow"></span>
        <jg-badge id="status" tone="muted">${t('barcode-generator.ready', 'Ready')}</jg-badge>
      </div>

      <div class="presets" id="presets"></div>

      <div class="row">
        <jg-button size="sm" variant="outline" id="copy">${t('barcode-generator.copySvg', 'Copy SVG')}</jg-button>
        <jg-button size="sm" variant="ghost" id="save-svg">${t('barcode-generator.downloadSvg', 'Download SVG')}</jg-button>
        <jg-button size="sm" variant="ghost" id="save-png">${t('barcode-generator.downloadPng', 'Download PNG')}</jg-button>
      </div>

      <div class="hint" id="hint"></div>
    </div>`);

    const run = debounce(() => this.#paint(), 140);
    this.on(this.$('#format'), 'change', (event) => {
      this.#format = event.detail.value;
      this.$('#value').value = PRESETS[this.#format][0];
      this.#paintPresets();
      this.#paint();
    });
    this.on(this.$('#value'), 'input', run);
    ['#width', '#height'].forEach((selector) => this.on(this.$(selector), 'input', run));
    this.on(this.$('#caption'), 'change', run);

    this.on(this.$('#copy'), 'click', () => copyText(this.#svg()));
    this.on(this.$('#save-svg'), 'click', () => download(`barcode-${this.#format}.svg`, this.#svg(), 'image/svg+xml'));
    this.on(this.$('#save-png'), 'click', () => this.#png());

    this.#paintPresets();
    this.#paint();
  }

  #paintPresets() {
    this.$('#presets').innerHTML = (PRESETS[this.#format] ?? [])
      .map((preset) => html`<button class="preset" data-preset="${preset}">${preset}</button>`)
      .join('');

    this.bind('[data-preset]', 'click', (event) => {
      this.$('#value').value = event.currentTarget.dataset.preset;
      this.#paint();
    });
  }

  #svg() {
    const format = FORMATS[this.#format];
    const value = this.$('#value').value;
    const { bits, text } = format.build(value);

    const unit = Number(this.$('#width').value);
    const height = Number(this.$('#height').value);
    const caption = this.$('#caption').checked;
    const margin = unit * 10;
    const width = bits.length * unit + margin * 2;
    const total = height + margin * 2 + (caption ? 22 : 0);

    let bars = '';
    let index = 0;
    while (index < bits.length) {
      if (bits[index] === '1') {
        let run = 1;
        while (bits[index + run] === '1') run += 1;
        bars += `<rect x="${margin + index * unit}" y="${margin}" width="${run * unit}" height="${height}" fill="#000000"/>`;
        index += run;
      } else {
        index += 1;
      }
    }

    const label = caption
      ? `<text x="${width / 2}" y="${margin + height + 17}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="15" letter-spacing="2" fill="#000000">${text}</text>`
      : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${total}" viewBox="0 0 ${width} ${total}" role="img" aria-label="${format.label} barcode for ${text}">
  <rect width="${width}" height="${total}" fill="#ffffff"/>
  ${bars}
  ${label}
</svg>`;
  }

  #paint() {
    const status = this.$('#status');
    this.$('#hint').textContent = FORMATS[this.#format].hint;
    this.store.write({ format: this.#format, value: this.$('#value').value });

    try {
      const markup = this.#svg();
      this.$('#stage').innerHTML = markup;
      status.setAttribute('tone', 'success');
      status.textContent = 'Scannable';
    } catch (error) {
      this.$('#stage').innerHTML = html`<span class="hint" style="color:var(--destructive)">${error.message}</span>`;
      status.setAttribute('tone', 'danger');
      status.textContent = 'Cannot encode';
    }
  }

  #png() {
    let markup = '';
    try {
      markup = this.#svg();
    } catch (error) {
      toast(error.message, 'error');
      return;
    }

    const image = new Image();
    const blob = new Blob([markup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width * 2;
      canvas.height = image.height * 2;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((png) => download(`barcode-${this.#format}.png`, png, 'image/png'), 'image/png');
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }
}

define('jg-app-barcode-generator', BarcodeGenerator);
