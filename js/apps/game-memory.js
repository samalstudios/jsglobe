import { JGApp, define, html, css } from '../core/app.js';
import { toast } from '../core/util.js';

const sheet = css`
  .board {
    display: grid;
    gap: 8px;
    width: min(560px, 100%);
    margin: 0 auto;
  }
  .card {
    position: relative;
    aspect-ratio: 1;
    border: 0;
    background: none;
    padding: 0;
    cursor: pointer;
    perspective: 600px;
  }
  .inner {
    position: absolute;
    inset: 0;
    transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.3, 1.1);
    transform-style: preserve-3d;
  }
  .card[data-face="up"] .inner { transform: rotateY(180deg); }
  .face {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    backface-visibility: hidden;
    font-size: clamp(20px, 5vw, 30px);
  }
  .back {
    background: linear-gradient(160deg, color-mix(in srgb, var(--ring) 85%, #fff 12%), var(--ring));
    box-shadow: var(--shadow-sm);
    color: rgba(255, 255, 255, 0.55);
    font-size: 16px;
  }
  .front {
    transform: rotateY(180deg);
    background: var(--card);
    border: 1px solid var(--border);
  }
  .card[data-done="true"] .front { border-color: color-mix(in srgb, var(--success) 55%, transparent); background: color-mix(in srgb, var(--success) 12%, var(--card)); }
  .card[data-done="true"] { cursor: default; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 8px; }
  .stat { padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-md); text-align: center; }
  .stat .value { font: 650 18px/1.2 var(--font-mono); }
  .stat .name { font-size: 10.5px; color: var(--muted-foreground); }
`;

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
        <jg-button size="sm" variant="outline" id="new">New game</jg-button>
      </div>

      <div class="stats">
        <div class="stat"><div class="value" id="moves">0</div><div class="name">Moves</div></div>
        <div class="stat"><div class="value" id="pairs">0</div><div class="name">Pairs</div></div>
        <div class="stat"><div class="value" id="time">0:00</div><div class="name">Time</div></div>
        <div class="stat"><div class="value" id="best">-</div><div class="name">Best moves</div></div>
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
