import { JGApp, define, html, css } from '../core/app.js';
import { t } from '../core/i18n.js';
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

      <jg-card title="${t('url-parser.components', 'Components')}">
        <div class="kv" id="parts"></div>
      </jg-card>

      <jg-card title="${t('url-parser.queryParams', 'Query parameters')}" id="paramcard">
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
      status.innerHTML = html`<span class="error">${t('url-parser.invalid', 'Not a valid absolute URL.')}</span>`;
      parts.innerHTML = '';
      params.innerHTML = '';
      return;
    }

    status.textContent = `${url.protocol.replace(':', '').toUpperCase()} · ${url.host}`;
    const rows = [
      [t('url-parser.protocol', 'Protocol'), url.protocol.replace(':', '')],
      [t('url-parser.username', 'Username'), url.username],
      [t('url-parser.password', 'Password'), url.password ? '•'.repeat(url.password.length) : ''],
      [t('url-parser.hostname', 'Hostname'), url.hostname],
      [t('url-parser.port', 'Port'), url.port || (url.protocol === 'https:' ? `443 (${t('url-parser.default', 'default')})` : url.protocol === 'http:' ? `80 (${t('url-parser.default', 'default')})` : '')],
      [t('url-parser.origin', 'Origin'), url.origin],
      [t('url-parser.path', 'Path'), url.pathname],
      [t('url-parser.query', 'Query'), url.search],
      [t('url-parser.fragment', 'Fragment'), url.hash.replace('#', '')],
      [t('url-parser.segments', 'Segments'), url.pathname.split('/').filter(Boolean).join(' › ')],
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
