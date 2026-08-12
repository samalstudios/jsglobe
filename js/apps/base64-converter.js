import { JGApp, define, html, css } from '../core/app.js';
import { toBase64, fromBase64, base64Url, fromBase64Url, encodeBytes, decodeBytes, pickFile, formatBytes, copyText, debounce } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .preview { max-height: 160px; border-radius: var(--radius-md); border: 1px solid var(--border); object-fit: contain; }
`;

class Base64Converter extends JGApp {
  static appId = 'base64-converter';
  static styles = [...JGApp.styles, sheet];

  #tab = 'text';

  renderApp() {
    this.paint(html`<div class="app">
      <jg-tabs id="tab"></jg-tabs>
      <div id="body" class="fill"></div>
    </div>`);
    this.$('#tab').items = [
      { value: 'text', label: 'Text' },
      { value: 'file', label: 'File → Base64' },
    ];
    this.$('#tab').value = this.#tab;
    this.on(this.$('#tab'), 'change', (event) => {
      this.#tab = event.detail.value;
      this.#renderTab();
    });
    this.#renderTab();
  }

  #renderTab() {
    const body = this.$('#body');
    if (this.#tab === 'text') this.#text(body);
    else this.#file(body);
  }

  #text(body) {
    body.innerHTML = html`
      <div class="row">
        <jg-switch id="urlsafe"></jg-switch><span class="hint">URL-safe alphabet</span>
        <span class="grow"></span>
        <jg-button size="sm" variant="outline" id="swap">Swap ⇅</jg-button>
      </div>
      <div class="split">
        <div class="pane">
          <div class="spread"><span class="label">Plain text</span><jg-copy from="#plain" size="icon"></jg-copy></div>
          <jg-textarea id="plain" grow placeholder="Text to encode"></jg-textarea>
        </div>
        <div class="pane">
          <div class="spread"><span class="label">Base64</span><jg-copy from="#encoded" size="icon"></jg-copy></div>
          <jg-textarea id="encoded" grow placeholder="Base64 to decode"></jg-textarea>
        </div>
      </div>
      <div class="hint" id="status">Type in either side.</div>
    `;

    const plain = body.querySelector('#plain');
    const encoded = body.querySelector('#encoded');
    const status = body.querySelector('#status');
    const urlsafe = () => body.querySelector('#urlsafe').checked;

    const encode = debounce(() => {
      try {
        const value = toBase64(encodeBytes(plain.value));
        encoded.value = urlsafe() ? base64Url(value) : value;
        status.textContent = `${plain.value.length} chars in · ${encoded.value.length} chars out`;
      } catch (error) {
        status.textContent = error.message;
      }
    }, 120);

    const decode = debounce(() => {
      try {
        const bytes = urlsafe() ? fromBase64Url(encoded.value) : fromBase64(encoded.value);
        plain.value = decodeBytes(bytes);
        status.textContent = `Decoded ${bytes.length} bytes`;
      } catch {
        status.textContent = 'That is not valid Base64.';
      }
    }, 120);

    this.on(plain, 'input', encode);
    this.on(encoded, 'input', decode);
    this.on(body.querySelector('#urlsafe'), 'change', encode);
    this.on(body.querySelector('#swap'), 'click', () => {
      const value = plain.value;
      plain.value = encoded.value;
      encoded.value = value;
    });
  }

  #file(body) {
    body.innerHTML = html`
      <div class="row">
        <jg-button variant="outline" id="pick">Choose a file...</jg-button>
        <span class="hint" id="info">Files never leave your browser.</span>
      </div>
      <img id="preview" class="preview" hidden alt="" />
      <jg-field label="Data URI" grow>
        <div slot="action"><jg-copy from="#out" size="icon"></jg-copy></div>
        <jg-textarea id="out" grow placeholder="Base64 output appears here"></jg-textarea>
      </jg-field>
      <div class="row">
        <jg-button size="sm" variant="ghost" id="copyraw">Copy without data URI prefix</jg-button>
      </div>
    `;

    this.on(body.querySelector('#pick'), 'click', async () => {
      const file = await pickFile('*/*', false);
      if (!file) return;
      const base64 = toBase64(new Uint8Array(file.data));
      const type = file.file.type || 'application/octet-stream';
      body.querySelector('#out').value = `data:${type};base64,${base64}`;
      body.querySelector('#info').textContent = `${file.name} · ${formatBytes(file.size)} · ${type}`;
      const preview = body.querySelector('#preview');
      preview.hidden = !type.startsWith('image/');
      if (!preview.hidden) preview.src = `data:${type};base64,${base64}`;
    });

    this.on(body.querySelector('#copyraw'), 'click', () =>
      copyText(body.querySelector('#out').value.replace(/^data:[^;]*;base64,/, '')),
    );
  }
}

define('jg-app-base64', Base64Converter);
