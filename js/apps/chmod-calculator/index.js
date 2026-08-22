import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

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
      <jg-card title="${t('chmod-calculator.permissions', 'Permissions')}">
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

      <jg-card title="${t('chmod-calculator.result', 'Result')}">
        <div class="octal" id="octal">000</div>
        <div class="symbolic" id="symbolic">---------</div>
        <jg-field label="${t('chmod-calculator.command', 'Command')}"><jg-output id="command"></jg-output></jg-field>
      </jg-card>

      <jg-card title="${t('chmod-calculator.fromOctal', 'From octal')}">
        <div class="row nowrap">
          <jg-input id="input" mono placeholder="644" style="width:140px"></jg-input>
          <span class="hint" id="explain"></span>
        </div>
      </jg-card>

      <jg-card title="${t('chmod-calculator.presets', 'Presets')}">
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
