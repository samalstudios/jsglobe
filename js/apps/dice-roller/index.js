import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { copyText, toast } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const KINDS = [4, 6, 8, 10, 12, 20, 100];

// the pips a six sided die shows, as a grid of nine places
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const roll = (sides) => {
  const spread = new Uint32Array(1);
  const ceiling = Math.floor(0xffffffff / sides) * sides;
  let drawn = 0;
  do {
    crypto.getRandomValues(spread);
    [drawn] = spread;
  } while (drawn >= ceiling);
  return (drawn % sides) + 1;
};

class DiceRoller extends JGApp {
  static appId = 'dice-roller';
  static settings = [
    { key: 'sound', label: t('dice-roller.rollWithASound', 'Roll with a sound'), type: 'switch', default: false },
  ];
  static styles = [...JGApp.styles, sheet];

  #sides = 20;
  #count = 1;
  #bonus = 0;
  #last = [];
  #history = [];
  #tally = new Map();
  #rolling = false;

  renderApp() {
    const saved = this.store.read();
    this.#sides = Number(saved?.sides) || 20;
    this.#count = Number(saved?.count) || 1;
    this.#bonus = Number(saved?.bonus) || 0;

    this.paint(html`<div class="app">
      <div class="picker">
        ${KINDS.map(
          (sides) => html`<button class="kind" data-sides="${sides}" aria-pressed="${String(sides === this.#sides)}">
            <span class="shape" data-faces="${sides}">${sides}</span>
            <span class="tag">d${sides}</span>
          </button>`,
        )}
      </div>

      <div class="row wrap">
        <jg-field label="${t('dice-roller.howMany', 'How many')}">
          <jg-slider id="count" min="1" max="12" value="${this.#count}"></jg-slider>
        </jg-field>
        <jg-field label="${t('dice-roller.addToTheTotal', 'Add to the total')}">
          <jg-slider id="bonus" min="-10" max="20" value="${this.#bonus}"></jg-slider>
        </jg-field>
        <span class="grow"></span>
        <jg-button id="roll" size="lg">${t('dice-roller.roll', 'Roll')}</jg-button>
      </div>

      <div class="table" id="table"></div>

      <div class="result" id="result" role="status" aria-live="polite"></div>

      <div class="foot">
        <div class="panel">
          <div class="head">
            <span class="label">${t('dice-roller.howOftenEachFaceCame', 'How often each face came up')}</span>
            <span class="grow"></span>
            <span class="hint" id="rolls"></span>
          </div>
          <div class="bars" id="bars"></div>
        </div>
        <div class="panel">
          <div class="head">
            <span class="label">${t('dice-roller.recentRolls', 'Recent rolls')}</span>
            <span class="grow"></span>
            <button class="tool" id="copy" title="${t('dice-roller.copyTheLog', 'Copy the log')}">${icon('copy', 14)}</button>
            <button class="tool" id="clear" title="${t('dice-roller.clearTheLog', 'Clear the log')}">${icon('eraser', 14)}</button>
          </div>
          <div class="log" id="log"></div>
        </div>
      </div>
    </div>`);

    this.on(this.$('.picker'), 'click', (event) => {
      const button = event.target.closest('[data-sides]');
      if (!button) return;
      this.#sides = Number(button.dataset.sides);
      this.#tally.clear();
      this.#keep();
      this.#mark();
      this.#drawBars();
      this.#drawTable();
    });

    this.on(this.$('#roll'), 'click', () => this.#throw());
    this.on(this.$('#count'), 'input', () => {
      this.#count = Number(this.$('#count').value);
      this.#keep();
      this.#drawTable();
    });
    this.on(this.$('#bonus'), 'input', () => {
      this.#bonus = Number(this.$('#bonus').value);
      this.#keep();
    });
    this.on(this.$('#copy'), 'click', () => {
      copyText(this.#history.map((entry) => entry.line).join('\n'));
      toast(t('dice-roller.copiedTheLog', 'Copied the log'));
    });
    this.on(this.$('#clear'), 'click', () => {
      this.#history = [];
      this.#tally.clear();
      this.#drawLog();
      this.#drawBars();
    });

    this.listen(window, 'keydown', (event) => {
      if (event.key !== ' ' || this.offsetParent === null) return;
      if (event.target.closest?.('input, textarea')) return;
      event.preventDefault();
      this.#throw();
    });

    this.#drawTable();
    this.#drawBars();
    this.#drawLog();
  }

  #keep() {
    this.store.write({ sides: this.#sides, count: this.#count, bonus: this.#bonus });
  }

  #mark() {
    for (const button of this.$$('[data-sides]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.sides) === this.#sides));
    }
  }

  #face(value) {
    if (this.#sides !== 6) return `<span class="value">${value}</span>`;
    const on = PIPS[value] ?? [];
    return `<span class="pips">${Array.from({ length: 9 }, (item, at) => `<i${on.includes(at) ? ' data-on' : ''}></i>`).join('')}</span>`;
  }

  #drawTable() {
    const host = this.$('#table');
    const values = this.#last.length ? this.#last : Array.from({ length: this.#count }, () => null);
    host.dataset.sides = String(this.#sides);
    host.innerHTML = values
      .slice(0, this.#count)
      .map(
        (value, at) =>
          `<span class="die" data-at="${at}" data-faces="${this.#sides}">${value === null ? '<span class="value">?</span>' : this.#face(value)}</span>`,
      )
      .join('');
  }

  async #throw() {
    if (this.#rolling) return;
    this.#rolling = true;

    const host = this.$('#table');
    this.#last = Array.from({ length: this.#count }, () => roll(this.#sides));
    this.#drawTable();
    for (const die of host.children) die.dataset.rolling = 'true';

    // a few false faces first, so the die looks like it is being thrown
    for (let pass = 0; pass < 6; pass += 1) {
      for (const die of host.children) {
        die.innerHTML = this.#face(roll(this.#sides));
      }
      await new Promise((wait) => setTimeout(wait, 55));
    }

    [...host.children].forEach((die, at) => {
      delete die.dataset.rolling;
      die.innerHTML = this.#face(this.#last[at]);
    });

    const sum = this.#last.reduce((total, value) => total + value, 0);
    const total = sum + this.#bonus;
    const label = `${this.#count}d${this.#sides}${this.#bonus ? (this.#bonus > 0 ? `+${this.#bonus}` : this.#bonus) : ''}`;

    this.$('#result').innerHTML =
      `<span class="total">${total}</span>` +
      `<span class="sum">${label} · ${this.#last.join(' + ')}${this.#bonus ? ` ${this.#bonus > 0 ? '+' : '−'} ${Math.abs(this.#bonus)}` : ''}</span>`;

    for (const value of this.#last) this.#tally.set(value, (this.#tally.get(value) ?? 0) + 1);
    this.#history.unshift({ line: `${label} = ${total}  (${this.#last.join(', ')})`, total });
    this.#history = this.#history.slice(0, 40);

    this.#drawBars();
    this.#drawLog();
    this.#rolling = false;
  }

  #drawBars() {
    const host = this.$('#bars');
    const rolls = [...this.#tally.values()].reduce((sum, count) => sum + count, 0);
    this.$('#rolls').textContent = rolls
      ? t('dice-roller.diceThrown', '{count} dice thrown', { count: rolls })
      : '';

    if (!rolls) {
      host.innerHTML = `<p class="hint">${t('dice-roller.rollToSeeTheSpread', 'Roll to see the spread build up')}</p>`;
      return;
    }
    const most = Math.max(...this.#tally.values());
    host.innerHTML = Array.from({ length: this.#sides }, (item, at) => {
      const face = at + 1;
      const count = this.#tally.get(face) ?? 0;
      const share = most ? (count / most) * 100 : 0;
      return (
        `<span class="bar" title="${face}: ${count}">` +
        `<span class="fill" style="height:${share.toFixed(1)}%"></span>` +
        `<b>${face}</b></span>`
      );
    }).join('');
  }

  #drawLog() {
    const host = this.$('#log');
    host.innerHTML = this.#history.length
      ? this.#history.map((entry) => `<span class="line">${entry.line}</span>`).join('')
      : `<p class="hint">${t('dice-roller.nothingThrownYet', 'Nothing thrown yet')}</p>`;
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('dice-roller.diceRoller', 'Dice Roller')}</div>
        <div class="hint">${t('dice-roller.widgetBlurb', 'Roll any dice and watch the spread.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-dice-roller', DiceRoller);
