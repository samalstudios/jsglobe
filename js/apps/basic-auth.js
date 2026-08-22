import { JGApp, define, html } from '../core/app.js';
import { t } from '../core/i18n.js';
import { encodeBytes, decodeBytes, toBase64, fromBase64 } from '../core/util.js';

class BasicAuth extends JGApp {
  static appId = 'basic-auth';
  static styles = JGApp.styles;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="cols equal">
        <jg-field label="${t('basic-auth.username', 'Username')}"><jg-input id="user" placeholder="${t('basic-auth.admin', 'admin')}"></jg-input></jg-field>
        <jg-field label="${t('basic-auth.password', 'Password')}"><jg-input id="pass" type="password" placeholder="${t('basic-auth.hunter2', 'hunter2')}"></jg-input></jg-field>
      </div>

      <jg-field label="${t('basic-auth.authorizationHeader', 'Authorization header')}"><jg-output id="header"></jg-output></jg-field>
      <jg-field label="${t('basic-auth.base64Credentials', 'Base64 credentials')}"><jg-output id="encoded"></jg-output></jg-field>
      <jg-field label="${t('basic-auth.curl', 'curl')}"><jg-output id="curl"></jg-output></jg-field>
      <jg-field label="${t('basic-auth.fetch', 'fetch')}"><jg-output id="fetch" scroll></jg-output></jg-field>

      <jg-card title="${t('basic-auth.decode', 'Decode')}" sub="${t('basic-auth.pasteAnExistingHeaderOr', 'Paste an existing header or base64 pair')}">
        <jg-input id="decode-in" mono placeholder="${t('basic-auth.basicYwrtaw46ahvudgvymg', 'Basic YWRtaW46aHVudGVyMg==')}"></jg-input>
        <jg-output id="decode-out"></jg-output>
      </jg-card>
    </div>`);

    const run = () => {
      const user = this.$('#user').value;
      const pass = this.$('#pass').value;
      const encoded = toBase64(encodeBytes(`${user}:${pass}`));
      this.$('#encoded').value = encoded;
      this.$('#header').value = `Authorization: Basic ${encoded}`;
      this.$('#curl').value = `curl -u '${user}:${pass}' https://example.com`;
      this.$('#fetch').value = `fetch('https://example.com', {\n  headers: { Authorization: 'Basic ${encoded}' },\n})`;
    };

    const decode = () => {
      const value = this.$('#decode-in').value.trim().replace(/^Basic\s+/i, '');
      const out = this.$('#decode-out');
      if (!value) return void (out.value = '');
      try {
        const text = decodeBytes(fromBase64(value));
        const [name, ...rest] = text.split(':');
        out.removeAttribute('tone');
        out.value = `username: ${name}\npassword: ${rest.join(':')}`;
      } catch {
        out.setAttribute('tone', 'danger');
        out.value = 'Not valid base64';
      }
    };

    this.on(this.$('#user'), 'input', run);
    this.on(this.$('#pass'), 'input', run);
    this.on(this.$('#decode-in'), 'input', decode);
    this.$('#user').value = 'admin';
    this.$('#pass').value = 'hunter2';
    run();
  }
}

define('jg-app-basic-auth', BasicAuth);
