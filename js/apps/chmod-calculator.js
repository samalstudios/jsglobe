import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .matrix { display: grid; grid-template-columns: 110px repeat(3, 1fr); gap: 6px; align-items: center; }
  .head { font-size: 11.5px; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.04em; }
  .cell { display: flex; align-items: center; gap: 7px; justify-content: center; }
  .octal { font: 600 clamp(30px, 8vw, 46px)/1 var(--font-mono); text-align: center; letter-spacing: 0.1em; }
  .symbolic { font: 500 18px/1 var(--font-mono); text-align: center; color: var(--muted-foreground); letter-spacing: 0.14em; }
  .presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 6px; }
  .preset {
    display: flex;
    justify-content: space-between;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: inherit;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .preset:hover { border-color: var(--border-strong); }
`;

const GROUPS = ['owner', 'group', 'others'];
const PERMS = [
  ['read', 4, 'r'],
  ['write', 2, 'w'],
  ['execute', 1, 'x'],
];

const PRESETS = [
  ['644 - files', 644],
  ['755 - scripts', 755],
  ['600 - secrets', 600],
  ['700 - private dir', 700],
  ['664 - group write', 664],
  ['777 - everyone', 777],
];

class ChmodCalculator extends JGApp {
  static appId = 'chmod-calculator';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-card title="Permissions">
        <div class="matrix">
          <span></span>
          ${GROUPS.map((group) => html`<span class="head" style="text-align:center">${group}</span>`)}
          ${PERMS.map(
            (perm) => html`
              <span class="head">${perm[0]} (${perm[1]})</span>
              ${GROUPS.map(
                (group) => html`<span class="cell"><jg-switch data-group="${group}" data-bit="${perm[1]}"></jg-switch></span>`,
              )}
            `,
          )}
        </div>
      </jg-card>

      <jg-card title="Result">
        <div class="octal" id="octal">000</div>
        <div class="symbolic" id="symbolic">---------</div>
        <jg-field label="Command"><jg-output id="command"></jg-output></jg-field>
      </jg-card>

      <jg-card title="From octal">
        <div class="row nowrap">
          <jg-input id="input" mono placeholder="644" style="width:140px"></jg-input>
          <span class="hint" id="explain"></span>
        </div>
      </jg-card>

      <jg-card title="Presets">
        <div class="presets">
          ${PRESETS.map((preset) => html`<button class="preset" data-mode="${preset[1]}"><span>${preset[0]}</span></button>`)}
        </div>
      </jg-card>
    </div>`);

    this.bind('jg-switch', 'change', () => this.#fromSwitches());
    this.on(this.$('#input'), 'input', () => this.#fromOctal(this.$('#input').value));
    this.bind('[data-mode]', 'click', (event) => this.#fromOctal(event.currentTarget.dataset.mode));
    this.#fromOctal('644');
  }

  #values() {
    return GROUPS.map((group) =>
      this.$$(`[data-group="${group}"]`).reduce((total, node) => total + (node.checked ? Number(node.dataset.bit) : 0), 0),
    );
  }

  #fromSwitches() {
    const values = this.#values();
    this.#paint(values);
    this.$('#input').value = values.join('');
  }

  #fromOctal(text) {
    const clean = String(text).replace(/\D/g, '').slice(-3).padStart(3, '0');
    const values = [...clean].map(Number).map((value) => Math.min(7, value));
    GROUPS.forEach((group, index) => {
      this.$$(`[data-group="${group}"]`).forEach((node) => {
        node.checked = (values[index] & Number(node.dataset.bit)) !== 0;
      });
    });
    this.$('#input').value = clean;
    this.#paint(values);
  }

  #paint(values) {
    const octal = values.join('');
    this.$('#octal').textContent = octal;
    const symbolic = values
      .map((value) => PERMS.map((perm) => ((value & perm[1]) !== 0 ? perm[2] : '-')).join(''))
      .join('');
    this.$('#symbolic').textContent = symbolic;
    this.$('#command').value = `chmod ${octal} path/to/file`;
    this.$('#explain').textContent = GROUPS.map(
      (group, index) => `${group}: ${PERMS.filter((perm) => (values[index] & perm[1]) !== 0).map((perm) => perm[0]).join('+') || 'none'}`,
    ).join(' · ');
  }
}

define('jg-app-chmod', ChmodCalculator);
