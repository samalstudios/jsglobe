import { JGApp, define, html, css } from '../core/app.js';
import { t } from '../core/i18n.js';
import { generate, describe, inspect } from '../lib/ssh-keys.js';
import { copyText, download } from '../core/util.js';

const sheet = css`
  .app { container-type: inline-size; }
  .art {
    font: 12px/1.25 var(--font-mono);
    white-space: pre;
    margin: 0;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 75%, transparent);
    border: 1px solid var(--border);
    overflow-x: auto;
  }
  .marks { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 12.5px; align-items: baseline; }
  .marks dt { color: var(--muted-foreground); }
  .marks dd { margin: 0; font-family: var(--font-mono); overflow-wrap: anywhere; }
  .pair { display: grid; grid-template-columns: minmax(0, 1fr) 128px; gap: 12px; align-items: start; }
  .pair .stack { padding-top: 22px; }
  @container (max-width: 620px) {
    .pair { grid-template-columns: minmax(0, 1fr); }
    .pair .stack { padding-top: 0; flex-direction: row; }
  }
  .warn {
    font-size: 12.5px;
    color: var(--muted-foreground);
    border-left: 2px solid color-mix(in srgb, var(--ring) 60%, transparent);
    padding-left: 10px;
  }
  .opts { display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .opts label { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; }
`;

const TYPES = [
  { value: 'ed25519', label: t('ssh-keys.ed25519Recommended', 'Ed25519 (recommended)') },
  { value: 'ecdsa-256', label: t('ssh-keys.ecdsaNistp256', 'ECDSA nistp256') },
  { value: 'ecdsa-384', label: t('ssh-keys.ecdsaNistp384', 'ECDSA nistp384') },
  { value: 'ecdsa-521', label: t('ssh-keys.ecdsaNistp521', 'ECDSA nistp521') },
  { value: 'rsa-2048', label: t('ssh-keys.rsa2048', 'RSA 2048') },
  { value: 'rsa-3072', label: t('ssh-keys.rsa3072', 'RSA 3072') },
  { value: 'rsa-4096', label: t('ssh-keys.rsa4096', 'RSA 4096') },
];

const RESTRICTIONS = [
  { value: 'restrict', label: t('ssh-keys.restrict', 'restrict') },
  { value: 'no-pty', label: t('ssh-keys.noPty', 'no-pty') },
  { value: 'no-agent-forwarding', label: t('ssh-keys.noAgentForwarding', 'no-agent-forwarding') },
  { value: 'no-port-forwarding', label: t('ssh-keys.noPortForwarding', 'no-port-forwarding') },
  { value: 'no-X11-forwarding', label: t('ssh-keys.noX11Forwarding', 'no-X11-forwarding') },
];

class SshKeys extends JGApp {
  static appId = 'ssh-keys';
  static settings = [
    { key: 'type', label: t('ssh-keys.defaultKeyType', 'Default key type'), type: 'select', default: 'ed25519', options: TYPES },
  ];
  static styles = [...JGApp.styles, sheet];

  #mode = 'generate';
  #key = null;

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('ssh-keys.sshKeys', 'SSH Keys')}</div>
        <div class="hint">${t('ssh-keys.generateAndInspectOpensshKeys', 'Generate and inspect OpenSSH keys without leaving the browser.')}</div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <jg-tabs id="mode"></jg-tabs>

      <div id="generate">
        <div class="row">
          <jg-field label="${t('ssh-keys.keyType', 'Key type')}">
            <jg-select id="type" size="sm" value="${this.config.get('type', 'ed25519')}" style="width:200px">
              ${TYPES.map((type) => html`<option value="${type.value}">${type.label}</option>`)}
            </jg-select>
          </jg-field>
          <jg-field label="${t('ssh-keys.comment', 'Comment')}" class="grow">
            <jg-input id="comment" size="sm" placeholder="${t('ssh-keys.youMachine', 'you@machine')}"></jg-input>
          </jg-field>
          <jg-button id="make" size="sm">${t('ssh-keys.generate', 'Generate')}</jg-button>
        </div>

        <div id="result" hidden>
          <div class="pair">
            <jg-field label="${t('ssh-keys.publicKey', 'Public key')}" hint="${t('ssh-keys.appendThisToSshAuthorized', 'Append this to ~/.ssh/authorized_keys on the server')}">
              <jg-textarea id="pub" rows="3" mono readonly></jg-textarea>
            </jg-field>
            <div class="stack tight">
              <jg-button size="sm" variant="outline" id="copy-pub">${t('ssh-keys.copy', 'Copy')}</jg-button>
              <jg-button size="sm" variant="ghost" id="save-pub">${t('ssh-keys.savePub', 'Save .pub')}</jg-button>
            </div>
          </div>

          <div class="pair">
            <jg-field label="${t('ssh-keys.privateKey', 'Private key')}" hint="${t('ssh-keys.keepThisFileAtChmod', 'Keep this file at chmod 600 and never share it')}">
              <jg-textarea id="priv" rows="8" mono readonly></jg-textarea>
            </jg-field>
            <div class="stack tight">
              <jg-button size="sm" variant="outline" id="copy-priv">${t('ssh-keys.copy', 'Copy')}</jg-button>
              <jg-button size="sm" variant="ghost" id="save-priv">${t('ssh-keys.saveKey', 'Save key')}</jg-button>
            </div>
          </div>

          <p class="warn">
            The key is generated by your browser with WebCrypto and never leaves this tab. It is written without a
            passphrase, so add one locally with <code>${t('ssh-keys.sshKeygenPFLt', 'ssh-keygen -p -f &lt;file&gt;')}</code> before you store it anywhere.
          </p>

          <div class="cols">
            <div class="stack tight">
              <div class="label">${t('ssh-keys.fingerprints', 'Fingerprints')}</div>
              <dl class="marks" id="marks"></dl>
            </div>
            <pre class="art" id="art"></pre>
          </div>

          <jg-field label="${t('ssh-keys.authorizedKeysLine', 'authorized_keys line')}" hint="${t('ssh-keys.tickTheLimitsYouWant', 'Tick the limits you want in front of the key')}">
            <div class="opts" id="opts">
              ${RESTRICTIONS.map(
                (item) => html`<label><input type="checkbox" value="${item.value}" /> ${item.label}</label>`,
              )}
              <label>${t('ssh-keys.from', 'from=')} <jg-input id="from" size="sm" placeholder="10.0.0.0/8" style="width:150px"></jg-input></label>
              <label>${t('ssh-keys.command', 'command=')} <jg-input id="command" size="sm" placeholder="${t('ssh-keys.usrBinBackup', '/usr/bin/backup')}" style="width:170px"></jg-input></label>
            </div>
            <jg-textarea id="authorized" rows="3" mono readonly></jg-textarea>
          </jg-field>
        </div>
      </div>

      <div id="inspect" hidden>
        <jg-field label="${t('ssh-keys.publicKeyLine', 'Public key line')}" hint="${t('ssh-keys.pasteAnAuthorizedKeysOr', 'Paste an authorized_keys or known_hosts entry')}">
          <jg-textarea id="line" rows="4" mono placeholder="${t('ssh-keys.sshEd25519Aaaac3nzaYouMachine', 'ssh-ed25519 AAAAC3Nza... you@machine')}"></jg-textarea>
        </jg-field>
        <div class="row">
          <jg-button size="sm" id="check">${t('ssh-keys.inspect', 'Inspect')}</jg-button>
          <span class="error" id="error"></span>
        </div>
        <div class="cols" id="found" hidden>
          <dl class="marks" id="found-marks"></dl>
          <pre class="art" id="found-art"></pre>
        </div>
      </div>
    </div>`);

    this.$('#mode').items = [
      { value: 'generate', label: t('ssh-keys.generate', 'Generate') },
      { value: 'inspect', label: t('ssh-keys.inspect', 'Inspect') },
    ];
    this.$('#mode').value = this.#mode;
    this.on(this.$('#mode'), 'change', (event) => {
      this.#mode = event.detail.value;
      this.$('#generate').hidden = this.#mode !== 'generate';
      this.$('#inspect').hidden = this.#mode !== 'inspect';
    });

    this.on(this.$('#type'), 'change', (event) => this.config.set('type', event.detail.value));
    this.on(this.$('#make'), 'click', () => this.#generate());
    this.on(this.$('#check'), 'click', () => this.#inspect());
    this.on(this.$('#copy-pub'), 'click', () => copyText(this.$('#pub').value));
    this.on(this.$('#copy-priv'), 'click', () => copyText(this.$('#priv').value));
    this.on(this.$('#save-pub'), 'click', () => download(`id_${this.#stem()}.pub`, this.$('#pub').value));
    this.on(this.$('#save-priv'), 'click', () => download(`id_${this.#stem()}`, this.$('#priv').value));
    this.bind('#opts input[type="checkbox"]', 'change', () => this.#authorized());
    this.on(this.$('#from'), 'input', () => this.#authorized());
    this.on(this.$('#command'), 'input', () => this.#authorized());
  }

  #stem() {
    const type = this.$('#type').value;
    return type.startsWith('rsa') ? 'rsa' : type.startsWith('ecdsa') ? 'ecdsa' : 'ed25519';
  }

  async #generate() {
    const button = this.$('#make');
    button.setAttribute('loading', '');
    try {
      const jwk = await generate(this.$('#type').value);
      this.#key = await describe(jwk, this.$('#comment').value.trim());
      this.$('#result').hidden = false;
      this.$('#pub').value = this.#key.publicKey;
      this.$('#priv').value = this.#key.privateKey;
      this.$('#art').textContent = this.#key.art;
      this.$('#marks').innerHTML = html`
        <dt>${t('ssh-keys.type', 'Type')}</dt><dd>${this.#key.type} · ${this.#key.bits} bit</dd>
        <dt>${t('ssh-keys.sha256', 'SHA256')}</dt><dd>${this.#key.sha256}</dd>
        <dt>MD5</dt><dd>${this.#key.md5}</dd>
      `;
      this.#authorized();
    } finally {
      button.removeAttribute('loading');
    }
  }

  #authorized() {
    if (!this.#key) return;
    const flags = this.$$('#opts input[type="checkbox"]')
      .filter((box) => box.checked)
      .map((box) => box.value);
    const from = this.$('#from').value.trim();
    const command = this.$('#command').value.trim();
    if (from) flags.unshift(`from="${from}"`);
    if (command) flags.unshift(`command="${command}"`);
    this.$('#authorized').value = `${flags.length ? `${flags.join(',')} ` : ''}${this.#key.publicKey}`;
  }

  async #inspect() {
    const error = this.$('#error');
    error.textContent = '';
    try {
      const found = await inspect(this.$('#line').value);
      if (!found) return;
      this.$('#found').hidden = false;
      this.$('#found-art').textContent = found.art;
      this.$('#found-marks').innerHTML = html`
        <dt>${t('ssh-keys.type', 'Type')}</dt><dd>${found.type}${found.bits ? ` · ${found.bits} bit` : ''}</dd>
        <dt>${t('ssh-keys.sha256', 'SHA256')}</dt><dd>${found.sha256}</dd>
        <dt>MD5</dt><dd>${found.md5}</dd>
        ${found.comment ? html`<dt>${t('ssh-keys.comment', 'Comment')}</dt><dd>${found.comment}</dd>` : ''}
        ${found.options ? html`<dt>${t('ssh-keys.options', 'Options')}</dt><dd>${found.options}</dd>` : ''}
      `;
    } catch (failure) {
      this.$('#found').hidden = true;
      error.textContent = failure.message;
    }
  }
}

define('jg-app-ssh-keys', SshKeys);
