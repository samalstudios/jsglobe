import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { encodeBytes, copyText } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const decodeBase32 = (input) => {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
};

const totp = async (secret, { digits = 6, period = 30, algorithm = 'SHA-1', at = Date.now() } = {}) => {
  const counter = Math.floor(at / 1000 / period);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey('raw', decodeBase32(secret), { name: 'HMAC', hash: algorithm }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer));
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
};

const randomSecret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map((byte) => BASE32[byte % 32]).join('');
};

class OtpGenerator extends JGApp {
  static appId = 'otp-generator';
  static styles = [...JGApp.styles, sheet];

  #timer = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  #secret() {
    return this.store.read({ secret: 'JBSWY3DPEHPK3PXP' }).secret;
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <div class="code" id="code">······</div>
        <div class="ring"><i id="bar"></i></div>
        <div class="hint" id="left"></div>
      </div>
    </div>`);
    this.#loop(this.#secret(), 6, 30);
  }

  renderApp() {
    const secret = this.#secret();
    this.paint(html`<div class="app">
      <jg-field label="${t('otp-generator.base32Secret', 'Base32 secret')}" hint="${t('otp-generator.sameFormatAuthenticatorAppsUse', 'Same format authenticator apps use')}">
        <div class="row nowrap">
          <jg-input id="secret" class="grow" mono value="${secret}"></jg-input>
          <jg-button variant="outline" id="random">${t('otp-generator.random', 'Random')}</jg-button>
        </div>
      </jg-field>

      <div class="row">
        <jg-select id="digits" value="6" style="width:120px"><option value="6">${t('otp-generator.6Digits', '6 digits')}</option><option value="8">${t('otp-generator.8Digits', '8 digits')}</option></jg-select>
        <jg-select id="period" value="30" style="width:130px"><option value="30">${t('otp-generator.30Seconds', '30 seconds')}</option><option value="60">${t('otp-generator.60Seconds', '60 seconds')}</option></jg-select>
        <jg-select id="algorithm" value="SHA-1" style="width:140px">
          <option value="SHA-1">${t('otp-generator.sha1', 'SHA-1')}</option><option value="SHA-256">${t('otp-generator.sha256', 'SHA-256')}</option><option value="SHA-512">${t('otp-generator.sha512', 'SHA-512')}</option>
        </jg-select>
      </div>

      <jg-card title="${t('otp-generator.currentCode', 'Current code')}">
        <div class="code" id="code">······</div>
        <div class="ring"><i id="bar"></i></div>
        <div class="spread">
          <span class="hint" id="left"></span>
          <jg-button size="sm" variant="outline" id="copy">${t('otp-generator.copy', 'Copy')}</jg-button>
        </div>
      </jg-card>

      <jg-field label="${t('otp-generator.otpauthUri', 'otpauth URI')}" hint="${t('otp-generator.pasteIntoAnAuthenticatorApp', 'Paste into an authenticator app')}">
        <jg-output id="uri"></jg-output>
      </jg-field>

      <jg-card title="${t('otp-generator.adjacentCodes', 'Adjacent codes')}" sub="${t('otp-generator.usefulWhenAServerAllows', 'Useful when a server allows drift')}">
        <div class="kv" id="drift"></div>
      </jg-card>
    </div>`);

    const update = () => {
      const secretValue = this.$('#secret').value.trim();
      this.store.write({ secret: secretValue });
      this.#loop(secretValue, Number(this.$('#digits').value), Number(this.$('#period').value), this.$('#algorithm').value);
      this.$('#uri').value = `otpauth://totp/JSGlobe:user?secret=${secretValue}&issuer=JSGlobe&digits=${this.$('#digits').value}&period=${this.$('#period').value}&algorithm=${this.$('#algorithm').value.replace('-', '')}`;
    };

    this.on(this.$('#secret'), 'input', update);
    ['#digits', '#period', '#algorithm'].forEach((selector) => this.on(this.$(selector), 'change', update));
    this.on(this.$('#random'), 'click', () => {
      this.$('#secret').value = randomSecret();
      update();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#code').textContent));
    update();
  }

  #loop(secret, digits, period, algorithm = 'SHA-1') {
    clearInterval(this.#timer);
    const tick = async () => {
      const code = this.$('#code');
      if (!code) return;
      try {
        code.textContent = await totp(secret, { digits, period, algorithm });
        const remaining = period - (Math.floor(Date.now() / 1000) % period);
        this.$('#bar').style.width = `${(remaining / period) * 100}%`;
        this.$('#left').textContent = `Refreshes in ${remaining}s`;
        const drift = this.$('#drift');
        if (drift) {
          const previous = await totp(secret, { digits, period, algorithm, at: Date.now() - period * 1000 });
          const next = await totp(secret, { digits, period, algorithm, at: Date.now() + period * 1000 });
          drift.innerHTML = html`<div>${t('otp-generator.previousWindow', 'Previous window')}</div><div class="mono">${previous}</div>
            <div>${t('otp-generator.nextWindow', 'Next window')}</div><div class="mono">${next}</div>`;
        }
      } catch {
        code.textContent = 'invalid';
      }
    };
    tick();
    this.#timer = setInterval(tick, 1000);
    this.track(() => clearInterval(this.#timer));
  }
}

define('jg-app-otp', OtpGenerator);
