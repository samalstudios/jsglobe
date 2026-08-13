import { JGApp, define, html, css } from '../core/app.js';
import { fromBase64Url, decodeBytes, debounce } from '../core/util.js';

const sheet = css`
  .token { font-family: var(--font-mono); font-size: 12.5px; overflow-wrap: anywhere; line-height: 1.7; }
  .part-0 { color: #f472b6; }
  .part-1 { color: #a78bfa; }
  .part-2 { color: #38bdf8; }
  .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 760px) { .cols2 { grid-template-columns: 1fr; } }
`;

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImFkbWluIjp0cnVlLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTg5MzQ1NjAwMH0.4pcPyMD09olPSyXnrXCjTwXyr4BsezdI1AVTmud2fU4';

const CLAIMS = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expires at',
  nbf: 'Not before',
  iat: 'Issued at',
  jti: 'JWT ID',
  scope: 'Scope',
  azp: 'Authorized party',
  email: 'Email',
  name: 'Name',
};

class JwtParser extends JGApp {
  static appId = 'jwt-parser';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Token">
        <div slot="action"><jg-button size="sm" variant="outline" id="sample">Sample</jg-button></div>
        <jg-textarea id="input" rows="4" placeholder="eyJhbGciOi..."></jg-textarea>
      </jg-field>

      <div class="panel token" id="colored"></div>
      <div class="row" id="badges"></div>

      <div class="cols2">
        <jg-card title="Header"><pre class="code scroll" id="header" style="max-height:220px"></pre></jg-card>
        <jg-card title="Payload"><pre class="code scroll" id="payload" style="max-height:220px"></pre></jg-card>
      </div>

      <jg-card title="Claims">
        <div class="kv" id="claims"></div>
      </jg-card>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 150));
    this.on(this.$('#sample'), 'click', () => {
      this.$('#input').value = SAMPLE;
      this.#run();
    });
    this.$('#input').value = SAMPLE;
    this.#run();
  }

  #run() {
    const value = this.$('#input').value.trim();
    const colored = this.$('#colored');
    const badges = this.$('#badges');
    const header = this.$('#header');
    const payload = this.$('#payload');
    const claims = this.$('#claims');

    if (!value) {
      [colored, badges, header, payload, claims].forEach((node) => {
        node.innerHTML = '';
      });
      return;
    }

    const parts = value.split('.');
    colored.innerHTML = parts.map((part, index) => html`<span class="part-${index}">${part}</span>`).join('<span class="muted">.</span>');

    if (parts.length !== 3) {
      badges.innerHTML = html`<jg-badge tone="danger">A JWT needs three dot-separated parts</jg-badge>`;
      header.textContent = payload.textContent = '';
      claims.innerHTML = '';
      return;
    }

    const decode = (part) => JSON.parse(decodeBytes(fromBase64Url(part)));

    let head;
    let body;
    try {
      head = decode(parts[0]);
      body = decode(parts[1]);
    } catch {
      badges.innerHTML = html`<jg-badge tone="danger">Header or payload is not valid base64url JSON</jg-badge>`;
      return;
    }

    header.textContent = JSON.stringify(head, null, 2);
    payload.textContent = JSON.stringify(body, null, 2);

    const now = Math.floor(Date.now() / 1000);
    const expired = body.exp && body.exp < now;
    const early = body.nbf && body.nbf > now;

    badges.innerHTML = [
      html`<jg-badge tone="accent">${head.alg ?? 'unknown alg'}</jg-badge>`,
      head.typ ? html`<jg-badge>${head.typ}</jg-badge>` : '',
      head.kid ? html`<jg-badge mono>kid ${head.kid}</jg-badge>` : '',
      body.exp
        ? html`<jg-badge tone="${expired ? 'danger' : 'success'}">${expired ? 'Expired' : 'Valid window'}</jg-badge>`
        : '',
      early ? html`<jg-badge tone="warning">Not yet valid</jg-badge>` : '',
      html`<jg-badge>Signature not verified</jg-badge>`,
    ].join('');

    claims.innerHTML = Object.entries(body)
      .map(([key, raw]) => {
        const label = CLAIMS[key] ?? key;
        const isTime = ['exp', 'iat', 'nbf', 'auth_time'].includes(key) && typeof raw === 'number';
        const text = isTime ? `${new Date(raw * 1000).toLocaleString()} (${raw})` : typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
        return html`<div>${label}</div><div class="mono">${text}</div>`;
      })
      .join('');
  }
}

define('jg-app-jwt', JwtParser);
