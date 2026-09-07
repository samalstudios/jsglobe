import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { toast } from '../../core/util.js';

const t = await appWords('game-memory', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const DECKS = {
  faces: '😀 😎 🥳 🤔 😴 🤖 👻 🐙 🦊 🐼 🦉 🐝 🦋 🐢 🦖 🐳'.split(' '),
  fruit: '🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🥝 🍍 🥥 🍑 🍒 🥑 🌽 🥕'.split(' '),
  symbols: '★ ◆ ▲ ● ✚ ❖ ✿ ☂ ☾ ☀ ⚑ ✈ ⚓ ⌘ ♞ ⚡'.split(' '),
  letters: 'A B C D E F G H J K L M N P Q R'.split(' '),
};

const SIZES = { '4x3': [4, 3], '4x4': [4, 4], '6x4': [6, 4], '6x6': [6, 6] };

class GameMemory extends JGApp {
  static appId = 'game-memory';
  static styles = [...JGApp.styles, sheet];

  #cards = [];
  #flipped = [];
  #moves = 0;
  #matched = 0;
  #startedAt = 0;
  #timer = null;
  #locked = false;

  renderApp() {
    const saved = this.store.read({ deck: 'faces', size: '4x4' });

    this.paint(html`<div class="app">
      <div class="row">
        <jg-segment id="size"></jg-segment>
        <jg-select id="deck" size="sm" style="width:140px" value="${saved.deck}">
          ${Object.keys(DECKS).map((key) => html`<option value="${key}">${key}</option>`)}
        </jg-select>
        <span class="grow"></span>
        <jg-button size="sm" variant="outline" id="new">${t('game-memory.newGame', 'New game')}</jg-button>
      </div>

      <div class="stats">
        <div class="stat"><div class="value" id="moves">0</div><div class="name">${t('game-memory.moves', 'Moves')}</div></div>
        <div class="stat"><div class="value" id="pairs">0</div><div class="name">${t('game-memory.pairs', 'Pairs')}</div></div>
        <div class="stat"><div class="value" id="time">0:00</div><div class="name">${t('game-memory.time', 'Time')}</div></div>
        <div class="stat"><div class="value" id="best">-</div><div class="name">${t('game-memory.bestMoves', 'Best moves')}</div></div>
      </div>

      <div class="board" id="board"></div>
    </div>`);

    const size = this.$('#size');
    size.items = Object.keys(SIZES).map((key) => ({ value: key, label: key }));
    size.value = saved.size ?? '4x4';

    this.on(size, 'change', () => this.#start());
    this.on(this.$('#deck'), 'change', () => this.#start());
    this.on(this.$('#new'), 'click', () => this.#start());

    this.#start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  #key() {
    return `${this.$('#size').value}-${this.$('#deck').value}`;
  }

  #start() {
    const [columns, rows] = SIZES[this.$('#size').value] ?? SIZES['4x4'];
    const deck = DECKS[this.$('#deck').value] ?? DECKS.faces;
    const pairs = (columns * rows) / 2;

    this.#cards = deck
      .slice(0, pairs)
      .flatMap((symbol, index) => [{ id: `${index}a`, symbol, face: 'down', done: false }, { id: `${index}b`, symbol, face: 'down', done: false }])
      .sort(() => Math.random() - 0.5);

    this.#flipped = [];
    this.#moves = 0;
    this.#matched = 0;
    this.#locked = false;
    this.#startedAt = 0;

    clearInterval(this.#timer);
    this.$('#board').style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    this.store.write({ ...this.store.read({}), deck: this.$('#deck').value, size: this.$('#size').value });

    const bests = this.store.read({ bests: {} }).bests ?? {};
    this.$('#best').textContent = bests[this.#key()] ? String(bests[this.#key()]) : '-';
    this.$('#time').textContent = '0:00';

    this.#paint();
  }

  #tick() {
    if (!this.#startedAt) return;
    const seconds = Math.floor((Date.now() - this.#startedAt) / 1000);
    this.$('#time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  #flip(id) {
    if (this.#locked) return;
    const card = this.#cards.find((entry) => entry.id === id);
    if (!card || card.done || card.face === 'up') return;

    if (!this.#startedAt) {
      this.#startedAt = Date.now();
      this.#timer = setInterval(() => this.#tick(), 500);
    }

    card.face = 'up';
    this.#flipped.push(card);
    this.#paint();

    if (this.#flipped.length < 2) return;

    this.#moves += 1;
    const [first, second] = this.#flipped;

    if (first.symbol === second.symbol) {
      first.done = true;
      second.done = true;
      this.#flipped = [];
      this.#matched += 1;
      this.#paint();
      if (this.#matched === this.#cards.length / 2) this.#finish();
      return;
    }

    this.#locked = true;
    setTimeout(() => {
      first.face = 'down';
      second.face = 'down';
      this.#flipped = [];
      this.#locked = false;
      this.#paint();
    }, 700);
  }

  #finish() {
    clearInterval(this.#timer);
    const seconds = Math.floor((Date.now() - this.#startedAt) / 1000);
    const data = this.store.read({ bests: {} });
    const bests = data.bests ?? {};
    const key = this.#key();

    if (!bests[key] || this.#moves < bests[key]) {
      bests[key] = this.#moves;
      this.store.write({ ...data, bests });
      this.$('#best').textContent = String(this.#moves);
      toast(`New best: ${this.#moves} moves`, 'success');
    } else {
      toast(`Cleared in ${this.#moves} moves and ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, 'success');
    }
  }

  #paint() {
    this.$('#board').innerHTML = this.#cards
      .map(
        (card) => html`<button class="card" data-card="${card.id}" data-face="${card.done ? 'up' : card.face}" data-done="${String(card.done)}">
          <span class="inner">
            <span class="face back">?</span>
            <span class="face front">${card.symbol}</span>
          </span>
        </button>`,
      )
      .join('');

    this.bind('[data-card]', 'click', (event) => this.#flip(event.currentTarget.dataset.card));

    this.$('#moves').textContent = String(this.#moves);
    this.$('#pairs').textContent = `${this.#matched}/${this.#cards.length / 2}`;
  }
}

define('jg-app-game-memory', GameMemory);
