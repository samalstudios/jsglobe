import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, download, toast } from '../core/util.js';

const sheet = css`
  .stage {
    display: grid;
    place-items: center;
    flex: none;
    min-height: 190px;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: #ffffff;
  }
  .stage svg { max-width: 100%; height: auto; }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; }
  .preset {
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted-foreground);
    font: 500 11.5px/1 var(--font-mono);
    padding: 6px 11px;
    cursor: pointer;
  }
  .preset:hover { color: var(--foreground); border-color: var(--border-strong); }
`;

const CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const EAN_LEFT_ODD = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_LEFT_EVEN = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_RIGHT = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN_PARITY = ['OOOOOO', 'OOEOEE', 'OOEEOE', 'OOEEEO', 'OEOOEE', 'OEEOOE', 'OEEEOO', 'OEOEOE', 'OEOEEO', 'OEEOEO'];

const CODE39 = {
  0: '101001101101', 1: '110100101011', 2: '101100101011', 3: '110110010101', 4: '101001101011',
  5: '110100110101', 6: '101100110101', 7: '101001011011', 8: '110100101101', 9: '101100101101',
  A: '110101001011', B: '101101001011', C: '110110100101', D: '101011001011', E: '110101100101',
  F: '101101100101', G: '101010011011', H: '110101001101', I: '101101001101', J: '101011001101',
  K: '110101010011', L: '101101010011', M: '110110101001', N: '101011010011', O: '110101101001',
  P: '101101101001', Q: '101010110011', R: '110101011001', S: '101101011001', T: '101011011001',
  U: '110010101011', V: '100110101011', W: '110011010101', X: '100101101011', Y: '110010110101',
  Z: '100110110101', '-': '100101011011', '.': '110010101101', ' ': '100110101101', $: '100100100101',
  '/': '100100101001', '+': '100101001001', '%': '101001001001', '*': '100101101101',
};

const checksum128 = (values) => values.reduce((total, value, index) => total + value * (index === 0 ? 1 : index), 0) % 103;

const encodeCode128 = (text) => {
  if (/[^\x20-\x7e]/.test(text)) throw new Error('Code 128 here supports printable ASCII only');
  const values = [104];
  [...text].forEach((character) => values.push(character.charCodeAt(0) - 32));
  values.push(checksum128(values));
  values.push(106);
  return values.map((value) => CODE128[value]).join('');
};

const widthsToBits = (widths) => {
  let bits = '';
  let dark = true;
  [...widths].forEach((width) => {
    bits += (dark ? '1' : '0').repeat(Number(width));
    dark = !dark;
  });
  return bits;
};

const eanCheckDigit = (digits) => {
  const total = [...digits].reduce((sum, digit, index) => {
    const weight = digits.length === 12 ? (index % 2 === 0 ? 1 : 3) : index % 2 === 0 ? 3 : 1;
    return sum + Number(digit) * weight;
  }, 0);
  return (10 - (total % 10)) % 10;
};

const encodeEan13 = (input) => {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 12) throw new Error('EAN-13 needs 12 or 13 digits');
  const body = digits.slice(0, 12);
  const check = digits.length >= 13 ? Number(digits[12]) : eanCheckDigit(body);
  if (digits.length >= 13 && check !== eanCheckDigit(body)) throw new Error(`Check digit should be ${eanCheckDigit(body)}`);

  const parity = EAN_PARITY[Number(body[0])];
  let bits = '101';
  for (let index = 1; index <= 6; index += 1) {
    const digit = Number(body[index]);
    bits += parity[index - 1] === 'O' ? EAN_LEFT_ODD[digit] : EAN_LEFT_EVEN[digit];
  }
  bits += '01010';
  for (let index = 7; index < 12; index += 1) bits += EAN_RIGHT[Number(body[index])];
  bits += EAN_RIGHT[check];
  bits += '101';

  return { bits, text: `${body}${check}` };
};

const encodeEan8 = (input) => {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7) throw new Error('EAN-8 needs 7 or 8 digits');
  const body = digits.slice(0, 7);
  const check = digits.length >= 8 ? Number(digits[7]) : eanCheckDigit(body);

  let bits = '101';
  for (let index = 0; index < 4; index += 1) bits += EAN_LEFT_ODD[Number(body[index])];
  bits += '01010';
  for (let index = 4; index < 7; index += 1) bits += EAN_RIGHT[Number(body[index])];
  bits += EAN_RIGHT[check];
  bits += '101';

  return { bits, text: `${body}${check}` };
};

const encodeCode39 = (input) => {
  const text = input.toUpperCase();
  if ([...text].some((character) => !CODE39[character])) throw new Error('Code 39 supports A-Z, 0-9, space and - . $ / + %');
  return { bits: [...`*${text}*`].map((character) => CODE39[character]).join('0'), text };
};

const FORMATS = {
  code128: { label: 'Code 128', hint: 'Any printable ASCII', build: (value) => ({ bits: widthsToBits(encodeCode128(value)), text: value }) },
  ean13: { label: 'EAN-13', hint: '12 or 13 digits', build: encodeEan13 },
  ean8: { label: 'EAN-8', hint: '7 or 8 digits', build: encodeEan8 },
  code39: { label: 'Code 39', hint: 'A-Z, digits and - . $ / + %', build: encodeCode39 },
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
        <jg-field label="Format">
          <jg-select id="format" value="${this.#format}">
            ${Object.entries(FORMATS).map(([key, format]) => html`<option value="${key}">${format.label}</option>`)}
          </jg-select>
        </jg-field>
        <jg-field label="Value"><jg-input id="value" mono value="${saved.value || PRESETS[this.#format][0]}"></jg-input></jg-field>
        <jg-field label="Bar width"><jg-slider id="width" min="1" max="6" value="2"></jg-slider></jg-field>
        <jg-field label="Height"><jg-slider id="height" min="40" max="220" value="120"></jg-slider></jg-field>
      </div>

      <div class="row">
        <jg-switch id="caption" checked></jg-switch><span class="hint">Print the value under the bars</span>
        <span class="grow"></span>
        <jg-badge id="status" tone="muted">Ready</jg-badge>
      </div>

      <div class="presets" id="presets"></div>

      <div class="row">
        <jg-button size="sm" variant="outline" id="copy">Copy SVG</jg-button>
        <jg-button size="sm" variant="ghost" id="save-svg">Download SVG</jg-button>
        <jg-button size="sm" variant="ghost" id="save-png">Download PNG</jg-button>
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
