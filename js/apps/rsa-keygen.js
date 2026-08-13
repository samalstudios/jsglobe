import { JGApp, define, html, css } from '../core/app.js';
import { toBase64, download, chunk, toast } from '../core/util.js';

const sheet = css`
  .keys { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 820px) { .keys { grid-template-columns: 1fr; } }
  .pem {
    min-height: 190px;
    max-height: 320px;
    overflow: auto;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 68%, transparent);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: all;
  }
`;

const ALGORITHMS = {
  'rsa-2048': { label: 'RSA 2048', params: { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, uses: ['sign', 'verify'] },
  'rsa-4096': { label: 'RSA 4096', params: { name: 'RSASSA-PKCS1-v1_5', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, uses: ['sign', 'verify'] },
  'rsa-oaep': { label: 'RSA 2048 (encryption)', params: { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, uses: ['encrypt', 'decrypt'] },
  'ec-p256': { label: 'ECDSA P-256', params: { name: 'ECDSA', namedCurve: 'P-256' }, uses: ['sign', 'verify'] },
  'ec-p384': { label: 'ECDSA P-384', params: { name: 'ECDSA', namedCurve: 'P-384' }, uses: ['sign', 'verify'] },
  'ecdh-p256': { label: 'ECDH P-256', params: { name: 'ECDH', namedCurve: 'P-256' }, uses: ['deriveKey'] },
};

const pem = (label, buffer) =>
  `-----BEGIN ${label}-----\n${chunk([...toBase64(buffer)], 64).map((line) => line.join('')).join('\n')}\n-----END ${label}-----`;

class RsaKeygen extends JGApp {
  static appId = 'rsa-keygen';
  static styles = [...JGApp.styles, sheet];

  #pair = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row nowrap">
        <jg-select id="algorithm" value="rsa-2048" class="grow">
          ${Object.entries(ALGORITHMS).map(([key, item]) => html`<option value="${key}">${item.label}</option>`)}
        </jg-select>
        <jg-button id="generate">Generate key pair</jg-button>
      </div>
      <div class="hint" id="status">Keys are created with the Web Crypto API and never leave this tab.</div>

      <div class="keys">
        <jg-card title="Public key" sub="SPKI, PEM encoded">
          <div slot="action" class="row tight">
            <jg-button size="sm" variant="ghost" id="copy-public">Copy</jg-button>
            <jg-button size="sm" variant="ghost" id="save-public">Save</jg-button>
          </div>
          <div class="pem" id="public"></div>
        </jg-card>

        <jg-card title="Private key" sub="PKCS#8, PEM encoded">
          <div slot="action" class="row tight">
            <jg-button size="sm" variant="ghost" id="copy-private">Copy</jg-button>
            <jg-button size="sm" variant="ghost" id="save-private">Save</jg-button>
          </div>
          <div class="pem" id="private"></div>
        </jg-card>
      </div>

      <jg-card title="JSON Web Key">
        <pre class="code scroll" id="jwk" style="max-height:220px"></pre>
      </jg-card>
    </div>`);

    this.on(this.$('#generate'), 'click', () => this.#generate());
    this.on(this.$('#copy-public'), 'click', () => navigator.clipboard.writeText(this.$('#public').textContent));
    this.on(this.$('#copy-private'), 'click', () => navigator.clipboard.writeText(this.$('#private').textContent));
    this.on(this.$('#save-public'), 'click', () => download('public.pem', this.$('#public').textContent));
    this.on(this.$('#save-private'), 'click', () => download('private.pem', this.$('#private').textContent));
  }

  async #generate() {
    const key = this.$('#algorithm').value;
    const algorithm = ALGORITHMS[key];
    const status = this.$('#status');
    status.textContent = 'Generating, this can take a moment for large RSA keys.';

    try {
      const pair = await crypto.subtle.generateKey(algorithm.params, true, algorithm.uses);
      const [spki, pkcs8, publicJwk] = await Promise.all([
        crypto.subtle.exportKey('spki', pair.publicKey),
        crypto.subtle.exportKey('pkcs8', pair.privateKey),
        crypto.subtle.exportKey('jwk', pair.publicKey),
      ]);

      this.#pair = pair;
      this.$('#public').textContent = pem('PUBLIC KEY', spki);
      this.$('#private').textContent = pem('PRIVATE KEY', pkcs8);
      this.$('#jwk').textContent = JSON.stringify(publicJwk, null, 2);
      status.textContent = `${algorithm.label} generated. Usage: ${algorithm.uses.join(', ')}.`;
    } catch (error) {
      status.innerHTML = html`<span class="error">${error.message}</span>`;
      toast('Key generation failed', 'error');
    }
  }
}

define('jg-app-rsa-keygen', RsaKeygen);
