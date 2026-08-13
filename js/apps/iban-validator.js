import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';

const sheet = css`
  .state { display: flex; align-items: center; gap: 10px; }
  .formatted { font-family: var(--font-mono); font-size: 16px; letter-spacing: 0.08em; }
  .samples { display: flex; flex-wrap: wrap; gap: 6px; }
  .sample {
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted-foreground);
    font: 500 12px/1 var(--font-sans);
    padding: 6px 12px;
    cursor: pointer;
  }
  .sample:hover { color: var(--foreground); border-color: var(--border-strong); }
`;

const LENGTHS = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
  BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29,
  ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22,
  MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25,
  QA: 29, RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25,
  SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

const COUNTRIES = {
  AT: 'Austria', BE: 'Belgium', CH: 'Switzerland', DE: 'Germany', DK: 'Denmark',
  ES: 'Spain', FI: 'Finland', FR: 'France', GB: 'United Kingdom', GR: 'Greece',
  IE: 'Ireland', IT: 'Italy', LU: 'Luxembourg', NL: 'Netherlands', NO: 'Norway',
  PL: 'Poland', PT: 'Portugal', SE: 'Sweden', TR: 'Turkey', AE: 'United Arab Emirates',
};

const SAMPLES = [
  'DE89 3704 0044 0532 0130 00',
  'GB33 BUKB 2020 1555 5555 55',
  'FR14 2004 1010 0505 0001 3M02 606',
  'NL91 ABNA 0417 1643 00',
  'CH93 0076 2011 6238 5295 7',
];

const clean = (value) => value.replace(/[\s-]/g, '').toUpperCase();

const mod97 = (value) => {
  let remainder = 0;
  for (const character of value) {
    const digits = /\d/.test(character) ? character : String(character.charCodeAt(0) - 55);
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
};

const validate = (input) => {
  const iban = clean(input);
  if (!iban) return { state: 'empty' };
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) {
    return { state: 'invalid', reason: 'The first four characters must be two letters then two digits.' };
  }

  const country = iban.slice(0, 2);
  const expected = LENGTHS[country];
  if (!expected) return { state: 'invalid', reason: `${country} is not a registered IBAN country code.`, country };
  if (iban.length !== expected) {
    return { state: 'invalid', reason: `${country} uses ${expected} characters, this one has ${iban.length}.`, country };
  }

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  if (mod97(rearranged) !== 1) return { state: 'invalid', reason: 'The check digits do not match the account number.', country };

  return {
    state: 'valid',
    country,
    iban,
    check: iban.slice(2, 4),
    bban: iban.slice(4),
    bank: iban.slice(4, 12),
  };
};

const format = (iban) => clean(iban).replace(/(.{4})/g, '$1 ').trim();

class IbanValidator extends JGApp {
  static appId = 'iban-validator';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="IBAN">
        <jg-input id="input" mono placeholder="DE89 3704 0044 0532 0130 00"></jg-input>
      </jg-field>

      <div class="state">
        <jg-badge id="badge" tone="muted">Waiting</jg-badge>
        <span class="hint" id="reason"></span>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="copy">Copy formatted</jg-button>
      </div>

      <jg-card title="Breakdown">
        <div class="formatted" id="formatted"></div>
        <div class="kv" id="parts"></div>
      </jg-card>

      <jg-card title="Try a sample">
        <div class="samples">
          ${SAMPLES.map((sample) => html`<button class="sample" data-iban="${sample}">${sample.slice(0, 2)} ${sample.slice(2, 9)}...</button>`)}
        </div>
      </jg-card>

      <div class="hint">
        Validation follows ISO 13616: the country length table plus the mod-97 check. It confirms the number is
        well formed, not that the account exists.
      </div>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 120));
    this.on(this.$('#copy'), 'click', () => copyText(format(this.$('#input').value)));
    this.bind('[data-iban]', 'click', (event) => {
      this.$('#input').value = event.currentTarget.dataset.iban;
      this.#run();
    });

    this.$('#input').value = SAMPLES[0];
    this.#run();
  }

  #run() {
    const result = validate(this.$('#input').value);
    const badge = this.$('#badge');
    const tones = { empty: 'muted', invalid: 'danger', valid: 'success' };
    const labels = { empty: 'Waiting', invalid: 'Not valid', valid: 'Valid' };

    badge.setAttribute('tone', tones[result.state]);
    badge.textContent = labels[result.state];
    this.$('#reason').textContent = result.reason ?? '';
    this.$('#formatted').textContent = result.state === 'valid' ? format(result.iban) : '';

    this.$('#parts').innerHTML =
      result.state === 'valid'
        ? html`
            <div>Country</div><div>${COUNTRIES[result.country] ?? result.country} (${result.country})</div>
            <div>Check digits</div><div class="mono">${result.check}</div>
            <div>Bank identifier</div><div class="mono">${result.bank}</div>
            <div>Account part</div><div class="mono">${result.bban}</div>
            <div>Length</div><div class="mono">${result.iban.length} characters</div>
            <div>Electronic format</div><div class="mono">${result.iban}</div>
          `
        : '';
  }
}

define('jg-app-iban-validator', IbanValidator);
