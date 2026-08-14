import { JGApp, define, html, css } from '../core/app.js';
import { md5 } from '../lib/md5.js';
import { encodeBytes, toHex, toBase64, debounce, formatBytes, pickFile } from '../core/util.js';

const sheet = css`
  .digests { display: flex; flex-direction: column; gap: 8px; }
  .digest { display: grid; grid-template-columns: 88px 1fr auto; align-items: center; gap: 10px; }
  .algo { font: 600 12px/1 var(--font-mono); color: var(--muted-foreground); }
  @media (max-width: 560px) { .digest { grid-template-columns: 1fr; } }
`;

const ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

class HashText extends JGApp {
  static appId = 'hash-text';
  static styles = [...JGApp.styles, sheet];

  #bytes = null;
  #source = 'text';

  async #digest(algorithm, bytes) {
    if (algorithm === 'MD5') return md5(bytes);
    return toHex(await crypto.subtle.digest(algorithm, bytes));
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <jg-input id="input" placeholder="Text to hash" size="sm"></jg-input>
      <div class="stack tight">
        <div class="label">SHA-256</div>
        <jg-output id="out" placeholder="-"></jg-output>
      </div>
    </div>`);
    const run = debounce(async () => {
      const value = this.$('#input').value;
      this.$('#out').value = value ? toHex(await crypto.subtle.digest('SHA-256', encodeBytes(value))) : '';
    }, 160);
    this.on(this.$('#input'), 'input', run);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="source"></jg-tabs>
        <span class="grow"></span>
        <jg-select id="encoding" size="sm" value="hex" style="width:130px">
          <option value="hex">Hexadecimal</option>
          <option value="base64">Base64</option>
        </jg-select>
      </div>

      <jg-field label="Input" hint="Hashed locally - nothing is uploaded">
        <jg-textarea id="input" rows="5" placeholder="Type or paste text to hash"></jg-textarea>
      </jg-field>

      <div class="row" id="filerow" hidden>
        <jg-button variant="outline" size="sm" id="pick">Choose file...</jg-button>
        <span class="hint" id="fileinfo">No file selected</span>
      </div>

      <div class="digests" id="digests">
        ${ALGORITHMS.map(
          (algorithm) => html`<div class="digest">
            <span class="algo">${algorithm}</span>
            <jg-output data-algo="${algorithm}" placeholder="-"></jg-output>
          </div>`,
        )}
      </div>
    </div>`);

    this.$('#source').items = [
      { value: 'text', label: 'Text' },
      { value: 'file', label: 'File' },
    ];

    this.on(this.$('#source'), 'change', (event) => {
      this.#source = event.detail.value;
      this.$('#filerow').hidden = this.#source !== 'file';
      this.$('#input').hidden = this.#source === 'file';
      this.#run();
    });

    this.on(this.$('#pick'), 'click', async () => {
      const file = await pickFile('*/*', false);
      if (!file) return;
      this.#bytes = new Uint8Array(file.data);
      this.$('#fileinfo').textContent = `${file.name} · ${formatBytes(file.size)}`;
      this.#run();
    });

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 140));
    this.on(this.$('#encoding'), 'change', () => this.#run());
    this.#run();
  }

  async #run() {
    const encoding = this.$('#encoding').value;
    const upper = this.config.get('case', 'lower') === 'upper';
    const bytes = this.#source === 'file' ? this.#bytes : encodeBytes(this.$('#input').value);
    if (!bytes || (this.#source === 'text' && !bytes.length)) {
      this.$$('[data-algo]').forEach((node) => {
        node.value = '';
      });
      return;
    }

    await Promise.all(
      ALGORITHMS.map(async (algorithm) => {
        const hex = await this.#digest(algorithm, bytes);
        const node = this.$(`[data-algo="${algorithm}"]`);
        if (!node) return;
        const value =
          encoding === 'base64'
            ? toBase64(Uint8Array.from(hex.match(/../g).map((pair) => parseInt(pair, 16))))
            : upper
              ? hex.toUpperCase()
              : hex;
        node.value = value;
      }),
    );
  }
}

define('jg-app-hash-text', HashText);
