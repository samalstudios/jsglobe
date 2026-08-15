import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .app { padding: 0; gap: 0; container-type: inline-size; overflow: hidden; }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex: none;
    flex-wrap: wrap;
  }
  .stat {
    display: inline-flex;
    gap: 6px;
    padding: 5px 11px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 75%, transparent);
    border: 1px solid var(--border);
    font: 600 12.5px/1 var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  .table {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px;
    background:
      radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--foreground) 5%, transparent), transparent 70%),
      var(--muted);
    user-select: none;
  }
  .board { position: relative; width: 100%; min-width: 660px; height: 100%; min-height: 520px; }

  .slot {
    position: absolute;
    width: var(--card-w);
    height: var(--card-h);
    border-radius: 7px;
    border: 1px dashed color-mix(in srgb, var(--foreground) 22%, transparent);
  }
  .slot[data-hint="true"] { border-color: var(--ring); }

  .card {
    position: absolute;
    width: var(--card-w);
    height: var(--card-h);
    border-radius: 7px;
    border: 1px solid color-mix(in srgb, var(--foreground) 18%, transparent);
    background: #fdfdfb;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    color: #1f2933;
    font: 600 13px/1 var(--font-sans);
    padding: 5px 6px;
    cursor: pointer;
    transition: transform 0.08s ease;
  }
  .card[data-red="true"] { color: #b5473f; }
  .card[data-face="false"] {
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-opacity='0.62' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20.83 8.83a4 4 0 0 0-5.66-5.66l-12 12a4 4 0 1 0 5.66 5.66Z'/%3E%3Cpath d='M18 11.66V22a4 4 0 0 0 4-4V6'/%3E%3Cpath d='M3 2v1c0 1 2 1 2 2S3 6 3 7s2 1 2 2-2 1-2 2 2 1 2 2'/%3E%3C/svg%3E") center / 34px no-repeat,
      linear-gradient(150deg, #a52348, #8a1c3b 55%, #6b1430);
    border-color: #59102a;
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.14), 0 1px 2px rgba(0, 0, 0, 0.25);
    color: transparent;
  }
  .card[data-drag="true"] { box-shadow: 0 10px 22px rgba(0, 0, 0, 0.32); transform: scale(1.02); }
  .card .rank { display: block; }
  .card .suit { display: block; font-size: 14px; margin-top: 1px; }
  .card .big {
    position: absolute;
    right: 5px;
    bottom: 4px;
    font-size: 17px;
    opacity: 0.85;
  }
  .card[data-face="false"] .rank,
  .card[data-face="false"] .suit,
  .card[data-face="false"] .big { visibility: hidden; }

  .win {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--background) 60%, transparent);
    backdrop-filter: blur(4px);
  }
  .win .card-panel {
    padding: 18px 22px;
    border-radius: var(--radius-lg);
    background: var(--glass-strong);
    border: 1px solid var(--glass-border);
    display: grid;
    gap: 10px;
    justify-items: center;
    text-align: center;
  }
`;

const SUITS = [
  { id: 'spades', glyph: '♠', red: false },
  { id: 'hearts', glyph: '♥', red: true },
  { id: 'clubs', glyph: '♣', red: false },
  { id: 'diamonds', glyph: '♦', red: true },
];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const CARD = { width: 74, height: 104, gapX: 90, stack: 26, closed: 8 };

class Solitaire extends JGApp {
  static appId = 'game-solitaire';
  static settings = [
    { key: 'draw', label: 'Cards per deal', type: 'select', default: '1', options: [
      { value: '1', label: 'Draw one' },
      { value: '3', label: 'Draw three' },
    ] },
  ];
  static styles = [...JGApp.styles, sheet];

  #stock = [];
  #waste = [];
  #foundations = [[], [], [], []];
  #columns = [[], [], [], [], [], [], []];
  #moves = 0;
  #score = 0;
  #best = null;
  #started = 0;
  #timer = null;
  #drag = null;
  #history = [];

  renderApp() {
    this.#best = this.store.read({ best: null }).best ?? null;

    this.paint(html`<div class="app">
      <div class="head">
        <span class="title">Solitaire</span>
        <span class="grow"></span>
        <span class="stat">Moves <span id="moves">0</span></span>
        <span class="stat">Time <span id="time">0:00</span></span>
        <span class="stat">Best <span id="best">${this.#best ? this.#clock(this.#best) : '-'}</span></span>
        <jg-select id="draw" size="sm" value="${this.config.get('draw', '1')}" style="width:130px">
          <option value="1">Draw one</option><option value="3">Draw three</option>
        </jg-select>
        <jg-button size="sm" variant="ghost" id="undo">Undo</jg-button>
        <jg-button size="sm" variant="outline" id="new">New game</jg-button>
      </div>
      <div class="table">
        <div class="board" id="board" style="--card-w:${CARD.width}px;--card-h:${CARD.height}px"></div>
      </div>
    </div>`);

    this.on(this.$('#new'), 'click', () => this.#deal());
    this.on(this.$('#undo'), 'click', () => this.#undo());
    this.on(this.$('#draw'), 'change', (event) => {
      this.config.set('draw', event.detail.value);
      this.#deal();
    });

    this.#deal();
    this.#timer = setInterval(() => this.#tickClock(), 500);
    this.track(() => clearInterval(this.#timer));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  #clock(seconds) {
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  #tickClock() {
    if (!this.#started) return;
    const seconds = Math.floor((Date.now() - this.#started) / 1000);
    const label = this.$('#time');
    if (label) label.textContent = this.#clock(seconds);
  }

  #deal() {
    const deck = [];
    SUITS.forEach((suit, suitIndex) => {
      RANKS.forEach((rank, rankIndex) => {
        deck.push({ id: `${suit.id}-${rank}`, suit: suitIndex, rank: rankIndex, face: false });
      });
    });
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[swap]] = [deck[swap], deck[index]];
    }

    this.#columns = [[], [], [], [], [], [], []];
    this.#foundations = [[], [], [], []];
    this.#waste = [];
    this.#history = [];
    this.#moves = 0;
    this.#started = 0;

    for (let column = 0; column < 7; column += 1) {
      for (let index = 0; index <= column; index += 1) {
        const card = deck.pop();
        card.face = index === column;
        this.#columns[column].push(card);
      }
    }
    this.#stock = deck;
    this.#paint();
  }

  #snapshot() {
    this.#history.push(
      JSON.stringify({
        stock: this.#stock,
        waste: this.#waste,
        foundations: this.#foundations,
        columns: this.#columns,
        moves: this.#moves,
      }),
    );
    if (this.#history.length > 60) this.#history.shift();
  }

  #undo() {
    const previous = this.#history.pop();
    if (!previous) return;
    const state = JSON.parse(previous);
    this.#stock = state.stock;
    this.#waste = state.waste;
    this.#foundations = state.foundations;
    this.#columns = state.columns;
    this.#moves = state.moves;
    this.#paint();
  }

  #position(pile, index, count) {
    if (pile.kind === 'stock') return { x: 0, y: 0 };
    if (pile.kind === 'waste') return { x: CARD.gapX + Math.min(index, 2) * 18, y: 0 };
    if (pile.kind === 'foundation') return { x: CARD.gapX * (3 + pile.index), y: 0 };
    const cards = this.#columns[pile.index];
    let offset = 0;
    for (let step = 0; step < index; step += 1) offset += cards[step].face ? CARD.stack : CARD.closed;
    return { x: CARD.gapX * pile.index, y: CARD.height + 26 + offset };
  }

  #paint() {
    const board = this.$('#board');
    if (!board) return;

    const slots = [
      { kind: 'stock', index: 0 },
      { kind: 'waste', index: 0 },
      ...this.#foundations.map((pile, index) => ({ kind: 'foundation', index })),
      ...this.#columns.map((pile, index) => ({ kind: 'column', index })),
    ];

    board.innerHTML = html`${slots.map((slot) => {
      const spot = this.#position(slot, 0, 0);
      return html`<div class="slot" data-slot="${slot.kind}:${slot.index}" style="left:${spot.x}px;top:${spot.y}px"></div>`;
    })}`;

    const render = (card, pile, index, count) => {
      const spot = this.#position(pile, index, count);
      const suit = SUITS[card.suit];
      return html`<div
        class="card"
        data-id="${card.id}"
        data-pile="${pile.kind}:${pile.index}"
        data-index="${index}"
        data-face="${String(card.face)}"
        data-red="${String(suit.red)}"
        style="left:${spot.x}px;top:${spot.y}px;z-index:${index + 1}"
      >
        <span class="rank">${RANKS[card.rank]}</span>
        <span class="suit">${suit.glyph}</span>
        <span class="big">${suit.glyph}</span>
      </div>`;
    };

    const parts = [];
    if (this.#stock.length) {
      const top = this.#stock[this.#stock.length - 1];
      parts.push(render({ ...top, face: false }, { kind: 'stock', index: 0 }, 0, 1));
    }
    const drawn = Number(this.config.get('draw', '1')) === 3 ? this.#waste.slice(-3) : this.#waste.slice(-1);
    drawn.forEach((card, index) => parts.push(render(card, { kind: 'waste', index: 0 }, index, drawn.length)));
    this.#foundations.forEach((pile, index) => {
      if (!pile.length) return;
      parts.push(render(pile[pile.length - 1], { kind: 'foundation', index }, 0, 1));
    });
    this.#columns.forEach((pile, index) => {
      pile.forEach((card, position) => parts.push(render(card, { kind: 'column', index }, position, pile.length)));
    });

    board.insertAdjacentHTML('beforeend', html`${parts}`);

    this.$('#moves').textContent = this.#moves;
    if (this.#foundations.every((pile) => pile.length === 13)) this.#win();

    this.bind('.card', 'pointerdown', (event) => this.#grab(event));
    this.bind('.card', 'dblclick', (event) => this.#sendUp(event));
    this.bind('.slot[data-slot="stock:0"]', 'click', () => this.#draw());
    const stockCard = this.$('.card[data-pile="stock:0"]');
    if (stockCard) this.on(stockCard, 'click', () => this.#draw());
  }

  #win() {
    const seconds = this.#started ? Math.floor((Date.now() - this.#started) / 1000) : 0;
    if (!this.#best || seconds < this.#best) {
      this.#best = seconds;
      this.store.write({ best: seconds });
      this.$('#best').textContent = this.#clock(seconds);
    }
    this.#started = 0;
    this.$('#board').insertAdjacentHTML(
      'beforeend',
      html`<div class="win"><div class="card-panel">
        <h3 style="margin:0">You cleared the table</h3>
        <div class="hint">${this.#moves} moves in ${this.#clock(seconds)}</div>
        <jg-button size="sm" id="again">New game</jg-button>
      </div></div>`,
    );
    const again = this.$('#again');
    if (again) this.on(again, 'click', () => this.#deal());
  }

  #draw() {
    if (!this.#started) this.#started = Date.now();
    this.#snapshot();
    const count = Number(this.config.get('draw', '1'));
    if (!this.#stock.length) {
      this.#stock = this.#waste.reverse().map((card) => ({ ...card, face: false }));
      this.#waste = [];
    } else {
      for (let index = 0; index < count && this.#stock.length; index += 1) {
        const card = this.#stock.pop();
        card.face = true;
        this.#waste.push(card);
      }
    }
    this.#moves += 1;
    this.#paint();
  }

  #pileOf(name) {
    const [kind, index] = name.split(':');
    return { kind, index: Number(index) };
  }

  #cardsFrom(pile, index) {
    if (pile.kind === 'column') return this.#columns[pile.index].slice(index);
    if (pile.kind === 'waste') return this.#waste.slice(-1);
    if (pile.kind === 'foundation') return this.#foundations[pile.index].slice(-1);
    return [];
  }

  #canStack(card, target) {
    if (target.kind === 'foundation') {
      const pile = this.#foundations[target.index];
      if (!pile.length) return card.rank === 0;
      const top = pile[pile.length - 1];
      return top.suit === card.suit && card.rank === top.rank + 1;
    }
    if (target.kind === 'column') {
      const pile = this.#columns[target.index];
      if (!pile.length) return card.rank === 12;
      const top = pile[pile.length - 1];
      if (!top.face) return false;
      return SUITS[top.suit].red !== SUITS[card.suit].red && card.rank === top.rank - 1;
    }
    return false;
  }

  #remove(pile, count) {
    if (pile.kind === 'column') return this.#columns[pile.index].splice(this.#columns[pile.index].length - count, count);
    if (pile.kind === 'waste') return this.#waste.splice(this.#waste.length - count, count);
    if (pile.kind === 'foundation') return this.#foundations[pile.index].splice(this.#foundations[pile.index].length - count, count);
    return [];
  }

  #place(pile, cards) {
    if (pile.kind === 'column') this.#columns[pile.index].push(...cards);
    if (pile.kind === 'foundation') this.#foundations[pile.index].push(...cards);
    if (pile.kind === 'waste') this.#waste.push(...cards);
  }

  #flipTop(pile) {
    if (pile.kind !== 'column') return;
    const cards = this.#columns[pile.index];
    const top = cards[cards.length - 1];
    if (top && !top.face) top.face = true;
  }

  #move(from, index, to) {
    const cards = this.#cardsFrom(from, index);
    if (!cards.length || !this.#canStack(cards[0], to)) return false;
    if (to.kind === 'foundation' && cards.length > 1) return false;
    this.#snapshot();
    if (!this.#started) this.#started = Date.now();
    this.#remove(from, cards.length);
    this.#place(to, cards);
    this.#flipTop(from);
    this.#moves += 1;
    this.#paint();
    return true;
  }

  #sendUp(event) {
    const node = event.currentTarget;
    if (node.dataset.face !== 'true' || node.dataset.pile === 'stock:0') return;
    event.preventDefault();
    const from = this.#pileOf(node.dataset.pile);
    if (from.kind === 'foundation') return;
    const index = from.kind === 'column' ? this.#columns[from.index].length - 1 : Number(node.dataset.index);
    const cards = this.#cardsFrom(from, index);
    if (cards.length !== 1) return;
    const target = this.#foundations.findIndex((pile, foundation) => this.#canStack(cards[0], { kind: 'foundation', index: foundation }));
    if (target >= 0) this.#move(from, index, { kind: 'foundation', index: target });
  }

  #grab(event) {
    const node = event.currentTarget;
    if (node.dataset.face !== 'true' || node.dataset.pile === 'stock:0') return;
    const from = this.#pileOf(node.dataset.pile);
    const index = Number(node.dataset.index);
    const cards = this.#cardsFrom(from, index);
    if (!cards.length) return;
    if (from.kind === 'column' && cards.some((card) => !card.face)) return;

    const nodes = cards.map((card) => this.$(`.card[data-id="${card.id}"]`)).filter(Boolean);
    const origin = { x: event.clientX, y: event.clientY };
    const home = nodes.map((item) => ({ left: item.offsetLeft, top: item.offsetTop, z: item.style.zIndex }));
    let moved = false;
    node.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      const dx = moveEvent.clientX - origin.x;
      const dy = moveEvent.clientY - origin.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) {
        moved = true;
        nodes.forEach((item, position) => {
          item.setAttribute('data-drag', 'true');
          item.style.zIndex = String(200 + position);
        });
      }
      nodes.forEach((item, position) => {
        item.style.left = `${home[position].left + dx}px`;
        item.style.top = `${home[position].top + dy}px`;
      });
    };

    const drop = (upEvent) => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', drop);
      node.removeEventListener('pointercancel', drop);

      if (!moved) {
        nodes.forEach((item) => item.removeAttribute('data-drag'));
        return;
      }

      const board = this.$('#board');
      const rect = board.getBoundingClientRect();
      const x = upEvent.clientX - rect.left;
      const y = upEvent.clientY - rect.top;

      const targets = [
        ...this.#foundations.map((pile, foundation) => ({ kind: 'foundation', index: foundation })),
        ...this.#columns.map((pile, column) => ({ kind: 'column', index: column })),
      ];
      const hit = targets.find((target) => {
        const depth = target.kind === 'column' ? Math.max(0, this.#columns[target.index].length - 1) : 0;
        const spot = this.#position(target, depth, 1);
        const height = target.kind === 'column' ? CARD.height + 40 : CARD.height;
        return x >= spot.x - 14 && x <= spot.x + CARD.width + 14 && y >= spot.y - 26 && y <= spot.y + height;
      });

      if (!hit || !this.#move(from, index, hit)) {
        nodes.forEach((item, position) => {
          item.removeAttribute('data-drag');
          item.style.left = `${home[position].left}px`;
          item.style.top = `${home[position].top}px`;
          item.style.zIndex = home[position].z;
        });
      }
    };

    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', drop);
    node.addEventListener('pointercancel', drop);
  }
}

define('jg-app-game-solitaire', Solitaire);
