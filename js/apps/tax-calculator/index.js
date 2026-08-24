import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { COUNTRIES } from '../../lib/tax-countries.js';
import { rates } from '../../lib/tax.js';

const t = appText(strings);
const sheet = await styleSheet(import.meta.url);

const PERIODS = [
  { id: 'year', label: () => t('tax-calculator.aYear', 'A year'), divide: 1 },
  { id: 'month', label: () => t('tax-calculator.aMonth', 'A month'), divide: 12 },
  { id: 'week', label: () => t('tax-calculator.aWeek', 'A week'), divide: 52 },
];

const START = { uk: 45000, us: 85000, ca: 80000, de: 55000, fr: 45000, nl: 55000, ch: 100000, hu: 9000000, cz: 700000, pl: 100000, se: 500000, no: 700000, dk: 500000, ro: 90000 };

class TaxCalculator extends JGApp {
  static appId = 'tax-calculator';
  static styles = [...JGApp.styles, sheet];

  #country = COUNTRIES.find((entry) => entry.id === 'uk') ?? COUNTRIES[0];
  #gross = 45000;
  #period = 'year';
  #answers = {};

  renderApp() {
    this.#reset(this.#country);

    this.paint(html`<div class="app">
      <div class="banner" role="note">
        ${icon('info', 16)}
        <div>
          <b>${t('tax-calculator.anEstimate', 'These are estimates, not a payslip.')}</b>
          <span>${t('tax-calculator.estimateBody', 'Real tax depends on reliefs, credits, local rates and your own circumstances, and rules change every year. Use this to get a feel for the shape of it, not to file anything. Nothing you type is sent anywhere or saved, not even on this device.')}</span>
        </div>
      </div>

      <div class="body">
        <aside class="ask">
          <jg-field label="${t('tax-calculator.country', 'Country')}">
            <jg-select id="country" value="${this.#country.id}">
              ${COUNTRIES.map((entry) => html`<option value="${entry.id}">${entry.name}</option>`)}
            </jg-select>
          </jg-field>

          <jg-field label="${t('tax-calculator.grossPay', 'Gross pay a year')}" hint="${t('tax-calculator.beforeAnythingIsTaken', 'Before anything is taken off')}">
            <jg-input id="gross" grouped inputmode="decimal" value="${this.#gross}" suffix="${this.#country.currency}"></jg-input>
          </jg-field>

          <div id="extra"></div>

          <div class="sep"></div>
          <div class="label">${t('tax-calculator.show', 'Show')}</div>
          <jg-segment id="period" value="${this.#period}"></jg-segment>

          <div class="sep"></div>
          <div class="label">${t('tax-calculator.whatThisCovers', 'What this covers')}</div>
          <ul class="notes" id="notes"></ul>
        </aside>

        <section class="out" id="out"></section>
      </div>
    </div>`);

    const segment = this.$('#period');
    segment.items = PERIODS.map((entry) => ({ value: entry.id, label: entry.label() }));
    segment.value = this.#period;

    this.on(this.$('#country'), 'change', (event) => {
      const next = COUNTRIES.find((entry) => entry.id === event.detail.value);
      if (!next) return;
      this.#country = next;
      this.#gross = START[next.id] ?? 45000;
      this.#reset(next);
      this.refresh();
    });

    this.on(this.$('#gross'), 'input', (event) => {
      this.#gross = Math.max(0, Number(event.detail.value) || 0);
      this.#paintOut();
    });
    this.on(this.$('#gross'), 'change', (event) => {
      this.#gross = Math.max(0, Number(event.detail.value) || 0);
      this.#paintOut();
    });

    this.on(segment, 'change', (event) => {
      this.#period = event.detail.value;
      this.#paintOut();
    });

    this.#paintFields();
    this.#paintNotes();
    this.#paintOut();
  }

  #reset(country) {
    this.#answers = {};
    for (const field of country.fields) this.#answers[field.key] = field.default;
  }

  #paintFields() {
    const host = this.$('#extra');
    if (!host) return;
    const shown = this.#country.fields.filter((field) => !field.when || field.when(this.#answers));
    host.innerHTML = html`${shown.map((field) => {
      if (field.type === 'select') {
        return html`<jg-field label="${field.label}" hint="${field.hint ?? ''}">
          <jg-select data-key="${field.key}" value="${String(this.#answers[field.key])}">
            ${field.options.map((option) => html`<option value="${option.value}">${option.label}</option>`)}
          </jg-select>
        </jg-field>`;
      }
      const money = field.type === 'money';
      return html`<jg-field label="${field.label}" hint="${field.hint ?? ''}">
        <jg-input data-key="${field.key}" ${money ? 'grouped' : `type="number" min="0" step="${field.type === 'percent' ? '0.5' : '1'}"`}
          value="${String(this.#answers[field.key])}" suffix="${field.type === 'percent' ? '%' : money ? this.#country.currency : ''}"></jg-input>
      </jg-field>`;
    })}`;

    if (!host.dataset.wired) {
      host.dataset.wired = 'true';
      const take = (event) => {
        const key = event.target.dataset?.key;
        if (!key) return;
        const raw = event.detail?.value ?? event.target.value;
        const field = this.#country.fields.find((entry) => entry.key === key);
        const wasSelect = field && field.type === 'select';
        this.#answers[key] = wasSelect ? raw : Number(raw) || 0;
        if (wasSelect && this.#country.fields.some((entry) => entry.when)) this.#paintFields();
        this.#paintOut();
      };
      this.on(host, 'change', take);
      this.on(host, 'input', take);
    }
  }

  #paintNotes() {
    const list = this.$('#notes');
    if (!list) return;
    list.innerHTML = html`${this.#country.notes.map((note) => html`<li>${note}</li>`)}
      <li>${t('tax-calculator.taxYear', 'Figures are for the {year} tax year.', { year: String(this.#country.year) })}</li>`;
  }

  #money(amount) {
    const period = PERIODS.find((entry) => entry.id === this.#period) ?? PERIODS[0];
    const value = amount / period.divide;
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.#country.currency,
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  }

  #paintOut() {
    const host = this.$('#out');
    if (!host) return;
    const result = rates(this.#country, { gross: this.#gross, ...this.#answers });
    const share = (amount) => (result.gross > 0 ? (amount / result.gross) * 100 : 0);

    host.innerHTML = html`
      <div class="headline">
        <div class="take">
          <span class="cap">${t('tax-calculator.youKeep', 'You keep')}</span>
          <strong>${this.#money(result.net)}</strong>
          <span class="sub">${t('tax-calculator.ofGross', 'of {gross}', { gross: this.#money(result.gross) })}</span>
        </div>
        <div class="figures">
          <div><span>${t('tax-calculator.taken', 'Taken')}</span><b>${this.#money(result.taken)}</b></div>
          <div><span>${t('tax-calculator.averageRate', 'Average rate')}</span><b>${(result.average * 100).toFixed(1)}%</b></div>
          <div><span>${t('tax-calculator.onTheNextPound', 'On the next unit')}</span><b>${(result.marginal * 100).toFixed(1)}%</b></div>
        </div>
      </div>

      <div class="bar" role="img" aria-label="${t('tax-calculator.howTheGrossSplits', 'How the gross splits')}">
        <span class="net" style="width:${share(result.net)}%"></span>
        <span class="tax" style="width:${share(result.tax)}%"></span>
        <span class="social" style="width:${share(result.social)}%"></span>
        <span class="other" style="width:${share(result.other)}%"></span>
      </div>
      <div class="key">
        <span><i class="net"></i>${t('tax-calculator.netPay', 'Net pay')}</span>
        ${result.tax > 0 ? html`<span><i class="tax"></i>${t('tax-calculator.tax', 'Tax')}</span>` : ''}
        ${result.social > 0 ? html`<span><i class="social"></i>${t('tax-calculator.socialContributions', 'Social contributions')}</span>` : ''}
        ${result.other > 0 ? html`<span><i class="other"></i>${t('tax-calculator.otherDeductions', 'Other')}</span>` : ''}
      </div>

      <table class="rows">
        <tbody>
          ${result.lines.map((line) => html`<tr class="${line.kind}">
            <td>${line.label}</td>
            <td class="num">${this.#money(line.amount)}</td>
            <td class="num pct">${share(line.amount).toFixed(1)}%</td>
          </tr>`)}
          <tr class="total">
            <td>${t('tax-calculator.takeHome', 'Take-home')}</td>
            <td class="num">${this.#money(result.net)}</td>
            <td class="num pct">${share(result.net).toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('tax-calculator.taxCalculator', 'Tax Calculator')}</div>
        <div class="hint">${t('tax-calculator.widgetBlurb', 'Net pay after tax in 23 countries, worked out on your device.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-tax-calculator', TaxCalculator);
