import { JGApp, define, html } from '../core/app.js';
import { encodeBytes, decodeBytes, toBase64, fromBase64 } from '../core/util.js';

class BasicAuth extends JGApp {
  static appId = 'basic-auth';
  static styles = JGApp.styles;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="cols equal">
        <jg-field label="Username"><jg-input id="user" placeholder="admin"></jg-input></jg-field>
        <jg-field label="Password"><jg-input id="pass" type="password" placeholder="hunter2"></jg-input></jg-field>
      </div>

      <jg-field label="Authorization header"><jg-output id="header"></jg-output></jg-field>
      <jg-field label="Base64 credentials"><jg-output id="encoded"></jg-output></jg-field>
      <jg-field label="curl"><jg-output id="curl"></jg-output></jg-field>
      <jg-field label="fetch"><jg-output id="fetch" scroll></jg-output></jg-field>

      <jg-card title="Decode" sub="Paste an existing header or base64 pair">
        <jg-input id="decode-in" mono placeholder="Basic YWRtaW46aHVudGVyMg=="></jg-input>
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
