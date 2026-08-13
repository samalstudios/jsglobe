import { JGApp, define, html, css } from '../core/app.js';
import { encodeBytes, decodeBytes, toBase64, fromBase64, randomBytes } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
`;

const ITERATIONS = 250000;

const deriveKey = async (passphrase, salt) => {
  const material = await crypto.subtle.importKey('raw', encodeBytes(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

class Encryption extends JGApp {
  static appId = 'encryption';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-card title="Passphrase" sub="AES-256-GCM with PBKDF2 key derivation (250k iterations)">
        <jg-input id="passphrase" type="password" placeholder="Passphrase"></jg-input>
      </jg-card>

      <div class="split">
        <jg-card title="Encrypt">
          <jg-textarea id="plain" rows="5" sans placeholder="Text to encrypt"></jg-textarea>
          <jg-button id="encrypt">Encrypt</jg-button>
          <jg-output id="cipher" scroll placeholder="Ciphertext appears here"></jg-output>
        </jg-card>

        <jg-card title="Decrypt">
          <jg-textarea id="cipherin" rows="5" placeholder="Paste ciphertext"></jg-textarea>
          <jg-button id="decrypt" variant="secondary">Decrypt</jg-button>
          <jg-output id="plainout" scroll placeholder="Decrypted text appears here"></jg-output>
        </jg-card>
      </div>

      <div class="hint">
        Output is base64 of salt (16 bytes) + IV (12 bytes) + ciphertext. Everything happens in this tab - the passphrase
        is never stored or transmitted.
      </div>
    </div>`);

    this.on(this.$('#encrypt'), 'click', () => this.#encrypt());
    this.on(this.$('#decrypt'), 'click', () => this.#decrypt());
  }

  #passphrase() {
    const value = this.$('#passphrase').value;
    if (!value) throw new Error('Enter a passphrase first');
    return value;
  }

  async #encrypt() {
    const out = this.$('#cipher');
    try {
      const passphrase = this.#passphrase();
      const text = this.$('#plain').value;
      if (!text) throw new Error('Nothing to encrypt');
      const salt = randomBytes(16);
      const iv = randomBytes(12);
      const key = await deriveKey(passphrase, salt);
      const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodeBytes(text)));
      const payload = new Uint8Array(salt.length + iv.length + encrypted.length);
      payload.set(salt);
      payload.set(iv, salt.length);
      payload.set(encrypted, salt.length + iv.length);
      out.removeAttribute('tone');
      out.value = toBase64(payload);
    } catch (error) {
      out.setAttribute('tone', 'danger');
      out.value = error.message;
    }
  }

  async #decrypt() {
    const out = this.$('#plainout');
    try {
      const passphrase = this.#passphrase();
      const payload = fromBase64(this.$('#cipherin').value.trim());
      if (payload.length < 29) throw new Error('Ciphertext is too short');
      const salt = payload.slice(0, 16);
      const iv = payload.slice(16, 28);
      const key = await deriveKey(passphrase, salt);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, payload.slice(28));
      out.removeAttribute('tone');
      out.value = decodeBytes(new Uint8Array(decrypted));
    } catch (error) {
      out.setAttribute('tone', 'danger');
      out.value = error.name === 'OperationError' ? 'Wrong passphrase or corrupted ciphertext' : error.message;
    }
  }
}

define('jg-app-encryption', Encryption);
