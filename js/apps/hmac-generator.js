import { JGApp, define, html, css } from '../core/app.js';
import { encodeBytes, toHex, toBase64, fromHex, debounce } from '../core/util.js';

const sheet = css`
  .out { font-family: var(--font-mono); }
`;

const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

class HmacGenerator extends JGApp {
  static appId = 'hmac-generator';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Secret key">
        <div class="row nowrap">
          <jg-input id="key" class="grow" placeholder="shared secret" value="secret"></jg-input>
          <jg-select id="keyfmt" value="utf8" style="width:130px">
            <option value="utf8">UTF-8</option>
            <option value="hex">Hex</option>
          </jg-select>
        </div>
      </jg-field>

      <jg-field label="Message">
        <jg-textarea id="message" rows="5" placeholder="Message to sign">hello world</jg-textarea>
      </jg-field>

      <div class="row">
        <jg-select id="algorithm" value="SHA-256" style="width:170px">
          ${ALGORITHMS.map((algorithm) => html`<option value="${algorithm}">HMAC-${algorithm}</option>`)}
        </jg-select>
        <jg-select id="encoding" value="hex" style="width:150px">
          <option value="hex">Hexadecimal</option>
          <option value="base64">Base64</option>
        </jg-select>
      </div>

      <jg-field label="Signature">
        <jg-output id="out" placeholder="-"></jg-output>
      </jg-field>

      <jg-card title="Verify" sub="Paste a signature to compare in constant view">
        <div class="row nowrap">
          <jg-input id="expected" class="grow" mono placeholder="Expected signature"></jg-input>
          <jg-badge id="verdict">-</jg-badge>
        </div>
      </jg-card>
    </div>`);

    const run = debounce(() => this.#run(), 140);
    ['#key', '#message', '#expected'].forEach((selector) => this.on(this.$(selector), 'input', run));
    ['#keyfmt', '#algorithm', '#encoding'].forEach((selector) => this.on(this.$(selector), 'change', run));
    this.$('#message').value = 'hello world';
    this.#run();
  }

  async #run() {
    const secret = this.$('#key').value;
    const message = this.$('#message').value;
    const algorithm = this.$('#algorithm').value;
    const out = this.$('#out');

    if (!secret || !message) {
      out.value = '';
      return;
    }

    try {
      const keyData = this.$('#keyfmt').value === 'hex' ? fromHex(secret) : encodeBytes(secret);
      const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: algorithm }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', key, encodeBytes(message));
      const value = this.$('#encoding').value === 'base64' ? toBase64(signature) : toHex(signature);
      out.value = value;

      const expected = this.$('#expected').value.trim();
      const verdict = this.$('#verdict');
      if (!expected) {
        verdict.textContent = '-';
        verdict.removeAttribute('tone');
      } else {
        const matches = expected.toLowerCase() === value.toLowerCase();
        verdict.textContent = matches ? 'Match' : 'No match';
        verdict.setAttribute('tone', matches ? 'success' : 'danger');
      }
    } catch (error) {
      out.value = error.message;
    }
  }
}

define('jg-app-hmac', HmacGenerator);
