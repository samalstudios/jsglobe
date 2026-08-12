import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .params { width: 100%; }
  .params td { font-family: var(--font-mono); font-size: 12px; overflow-wrap: anywhere; }
  .params td:first-child { color: var(--ring); width: 32%; }
`;

class UrlParser extends JGApp {
  static appId = 'url-parser';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="URL">
        <jg-input id="input" mono value="https://user:pass@api.example.com:8443/v2/search?q=custom+elements&page=2&sort=desc#results"></jg-input>
      </jg-field>
      <div class="hint" id="status"></div>

      <jg-card title="Components">
        <div class="kv" id="parts"></div>
      </jg-card>

      <jg-card title="Query parameters" id="paramcard">
        <table class="params"><tbody id="params"></tbody></table>
      </jg-card>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 140));
    this.#run();
  }

  #run() {
    const value = this.$('#input').value.trim();
    const status = this.$('#status');
    const parts = this.$('#parts');
    const params = this.$('#params');

    if (!value) {
      status.textContent = 'Paste a URL to break it apart.';
      parts.innerHTML = '';
      params.innerHTML = '';
      return;
    }

    let url;
    try {
      url = new URL(value);
    } catch {
      status.innerHTML = html`<span class="error">Not a valid absolute URL.</span>`;
      parts.innerHTML = '';
      params.innerHTML = '';
      return;
    }

    status.textContent = `${url.protocol.replace(':', '').toUpperCase()} · ${url.host}`;
    const rows = [
      ['Protocol', url.protocol.replace(':', '')],
      ['Username', url.username],
      ['Password', url.password ? '•'.repeat(url.password.length) : ''],
      ['Hostname', url.hostname],
      ['Port', url.port || (url.protocol === 'https:' ? '443 (default)' : url.protocol === 'http:' ? '80 (default)' : '')],
      ['Origin', url.origin],
      ['Path', url.pathname],
      ['Query', url.search],
      ['Fragment', url.hash.replace('#', '')],
      ['Segments', url.pathname.split('/').filter(Boolean).join(' › ')],
    ];

    parts.innerHTML = rows
      .filter(([, text]) => text)
      .map(([label, text]) => html`<div>${label}</div><div class="mono">${text}</div>`)
      .join('');

    const entries = [...url.searchParams.entries()];
    this.$('#paramcard').hidden = !entries.length;
    params.innerHTML = entries
      .map(([key, text]) => html`<tr><td>${key}</td><td>${text}</td></tr>`)
      .join('');
  }
}

define('jg-app-url-parser', UrlParser);
