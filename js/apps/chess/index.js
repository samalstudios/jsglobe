import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { copyText, download, toast } from '../../core/util.js';
import {
  START_FEN,
  WHITE,
  BLACK,
  parseFen,
  toFen,
  applyMove,
  legalMoves,
  moveToSan,
  sanToMove,
  inCheck,
  isCheckmate,
  isStalemate,
  insufficientMaterial,
  squareName,
  fileOf,
  rankOf,
} from '../../lib/chess.js';
import { pickMove, judgeMove, LEVELS } from '../../lib/chess-ai.js';
import { OPENINGS, FAMILIES, LESSONS } from '../../lib/chess-openings.js';

const t = appText(strings);
const sheet = await styleSheet(import.meta.url);

// The filled glyphs read clearly at any size once they are coloured, where the
// outlined set almost vanishes on a light board.
const GLYPH = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const THEMES = ['paper', 'wood', 'forest', 'ocean', 'slate', 'rose', 'ink'];

const familyName = (id) =>
  ({
    open: t('chess.family.open', 'Open games'),
    'semi-open': t('chess.family.semiOpen', 'Semi-open games'),
    closed: t('chess.family.closed', 'Closed games'),
    indian: t('chess.family.indian', 'Indian defences'),
    flank: t('chess.family.flank', 'Flank openings'),
  })[id] ?? FAMILIES[id] ?? id;

const themeName = (id) =>
  ({
    paper: t('chess.theme.paper', 'Paper'),
    wood: t('chess.theme.wood', 'Wood'),
    forest: t('chess.theme.forest', 'Forest'),
    ocean: t('chess.theme.ocean', 'Ocean'),
    slate: t('chess.theme.slate', 'Slate'),
    rose: t('chess.theme.rose', 'Rose'),
    ink: t('chess.theme.ink', 'Ink'),
  })[id] ?? id;

const levelName = (id) =>
  ({
    gentle: t('chess.level.gentle', 'Gentle'),
    casual: t('chess.level.casual', 'Casual'),
    steady: t('chess.level.steady', 'Steady'),
    sharp: t('chess.level.sharp', 'Sharp'),
    fierce: t('chess.level.fierce', 'Fierce'),
  })[id] ?? id;
const bare = (san) => san.replace(/[+#!?]/g, '');

class Chess extends JGApp {
  static appId = 'chess';
  static settings = [
    {
      key: 'level',
      label: t('chess.level', 'Computer strength'),
      type: 'select',
      default: 'casual',
      options: Object.keys(LEVELS).map((id) => ({ value: id, label: levelName(id) })),
    },
    {
      key: 'theme',
      label: t('chess.boardTheme', 'Board colours'),
      type: 'select',
      default: 'wood',
      options: THEMES.map((id) => ({ value: id, label: themeName(id) })),
    },
    { key: 'coach', label: t('chess.coachEveryMove', 'Comment on every move'), type: 'switch', default: true },
    { key: 'hints', label: t('chess.showLegalMoves', 'Show where a piece can go'), type: 'switch', default: true },
  ];
  static styles = [...JGApp.styles, sheet];

  #state = parseFen(START_FEN);
  #history = [];
  #pick = null;
  #last = null;
  #slide = null;
  #side = WHITE;
  #view = 'play';
  #thinking = false;
  #over = null;
  #notes = [];
  #opening = null;
  #lesson = 0;
  #lessonState = null;
  #lessonDone = new Set();

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head">
        <jg-toolbar id="bar"></jg-toolbar>
      </div>
      <div class="body">
        <div class="boardside">
          <div class="taken" id="takenTop"></div>
          <div class="board" id="board"></div>
          <div class="taken" id="takenBottom"></div>
          <div class="statusbar" id="status"></div>
        </div>
        <aside class="side">
          <jg-tabs id="view"></jg-tabs>
          <div class="pane" id="pane"></div>
        </aside>
      </div>
    </div>`);

    this.$('#view').items = [
      { value: 'play', label: t('chess.play', 'Play') },
      { value: 'openings', label: t('chess.openings', 'Openings') },
      { value: 'train', label: t('chess.train', 'Train') },
    ];
    this.$('#view').value = this.#view;
    this.on(this.$('#view'), 'change', (event) => {
      this.#view = event.detail.value;
      if (this.#view === 'train') this.#openLesson(this.#lesson);
      this.#pane();
      this.#draw();
    });

    this.#toolbar();
    this.#draw();
    this.#pane();
    this.#watchSize();
  }

  // Give every square the same whole number of pixels. Fractional track sizes
  // round unevenly, which shows up as a board with a few fatter squares.
  #fitBoard() {
    const side = this.$('.boardside');
    const board = this.$('#board');
    if (!side || !board) return;

    const style = getComputedStyle(side);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const gaps = parseFloat(style.rowGap) || 0;

    const spare = [...side.children].reduce(
      (total, child) => (child === board ? total : total + child.getBoundingClientRect().height),
      0,
    );

    const across = side.clientWidth - padX - 2;
    const down = side.clientHeight - padY - spare - gaps * 3 - 2;
    const cell = Math.max(24, Math.floor(Math.min(across, down, 560) / 8));
    side.style.setProperty('--cell', `${cell}px`);
  }

  #watchSize() {
    const side = this.$('.boardside');
    if (!side) return;
    this.#fitBoard();
    const watcher = new ResizeObserver(() => this.#fitBoard());
    watcher.observe(side);
    this.track(() => watcher.disconnect());
  }

  #toolbar() {
    this.$('#bar').items = [
      { id: 'new', label: t('chess.newGame', 'New game'), icon: 'file', action: () => this.#newGame() },
      { id: 'flip', label: t('chess.flip', 'Flip'), icon: 'repeat', iconOnly: true, title: t('chess.flipTheBoard', 'Turn the board around'), action: () => this.#flip() },
      { id: 'undo', label: t('chess.undo', 'Undo'), icon: 'undo', iconOnly: true, title: t('chess.takeBackAMove', 'Take back your move'), action: () => this.#undo() },
      { separator: true },
      { id: 'hint', label: t('chess.hint', 'Hint'), icon: 'sparkles', action: () => this.#hint() },
      { separator: true },
      { id: 'copy', label: t('chess.copyMoves', 'Copy moves'), icon: 'copy', iconOnly: true, title: t('chess.copyTheMoveList', 'Copy the move list'), action: () => this.#copyPgn() },
      { id: 'save', label: t('chess.saveGame', 'Save game'), icon: 'download', iconOnly: true, title: t('chess.saveTheGame', 'Save the game as a file'), action: () => this.#savePgn() },
    ];
  }

  // ---- board ----------------------------------------------------------

  #squares() {
    const out = [];
    for (let rank = 0; rank < 8; rank += 1) {
      for (let file = 0; file < 8; file += 1) out.push(rank * 16 + file);
    }
    return this.#side === WHITE ? out : out.reverse();
  }

  #draw() {
    const board = this.$('#board');
    if (!board) return;
    board.dataset.theme = this.config.get('theme', 'wood');
    const state = this.#lessonState ?? this.#state;
    const showHints = this.config.get('hints', true);
    const targets = new Set();
    if (this.#pick != null && showHints) {
      legalMoves(state)
        .filter((move) => move.from === this.#pick)
        .forEach((move) => targets.add(move.to));
    }
    const checked = inCheck(state) ? this.#kingAt(state, state.turn) : -1;

    board.innerHTML = html`${this.#squares().map((square) => {
      const piece = state.board[square];
      const dark = (fileOf(square) + rankOf(square)) % 2 === 1;
      const marks = [
        dark ? 'dark' : 'light',
        this.#pick === square ? 'picked' : '',
        targets.has(square) ? (piece ? 'take' : 'go') : '',
        this.#last && (this.#last.from === square || this.#last.to === square) ? 'trail' : '',
        checked === square ? 'check' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return html`<button class="cell ${marks}" data-square="${square}" aria-label="${squareName(square)}">
        ${piece ? html`<span class="man ${piece === piece.toUpperCase() ? 'white' : 'black'}">${GLYPH[piece]}</span>` : ''}
      </button>`;
    })}`;

    this.bind('.cell', 'click', (event) => this.#tap(Number(event.currentTarget.dataset.square)));
    this.#status();
    this.#taken();
    this.#animate();
  }

  #kingAt(state, colour) {
    const wanted = colour === WHITE ? 'K' : 'k';
    for (let square = 0; square < 128; square += 1) {
      if (square & 0x88) continue;
      if (state.board[square] === wanted) return square;
    }
    return -1;
  }

  #tap(square) {
    if (this.#view === 'train') return this.#lessonTap(square);
    if (this.#thinking || this.#over) return;
    if (this.#state.turn !== this.#side) return;

    const piece = this.#state.board[square];
    const mine = piece && (piece === piece.toUpperCase() ? WHITE : BLACK) === this.#side;

    if (this.#pick == null) {
      if (mine) this.#pick = square;
      this.#draw();
      return;
    }
    if (square === this.#pick) {
      this.#pick = null;
      this.#draw();
      return;
    }
    if (mine) {
      this.#pick = square;
      this.#draw();
      return;
    }

    const move = legalMoves(this.#state).find(
      (entry) => entry.from === this.#pick && entry.to === square && (!entry.promotion || entry.promotion === 'q'),
    );
    if (!move) {
      this.#pick = null;
      this.#draw();
      return;
    }
    this.#pick = null;
    this.#playHuman(move);
  }

  async #playHuman(move) {
    const before = this.#state;
    const san = moveToSan(before, move);
    if (this.config.get('coach', true)) {
      const verdict = judgeMove(before, move, 2);
      this.#notes.push({ ply: this.#history.length + 1, san, ...verdict });
    }
    this.#commit(move, san);
    if (this.#finish()) return;
    await this.#playComputer();
  }

  async #playComputer() {
    this.#thinking = true;
    this.#status();
    await new Promise((resolve) => setTimeout(resolve, 40));
    const level = this.config.get('level', 'casual');
    const move = pickMove(this.#state, level);
    this.#thinking = false;
    if (!move) {
      this.#finish();
      return;
    }
    this.#commit(move, moveToSan(this.#state, move));
    this.#finish();
  }

  #commit(move, san) {
    const before = this.#state;
    this.#history.push({ fen: toFen(before), move, san });
    const { state, captured } = applyMove(before, move);
    this.#state = state;
    this.#last = move;
    this.#slide = { move, captured, board: before.board };
    this.#opening = this.#matchOpening();
    this.#draw();
    this.#pane();
  }

  #squareIndex(square) {
    return this.#squares().indexOf(square);
  }

  // Slide the arriving piece in from where it came, and fade out whatever it
  // took. The board is rebuilt on every change, so the piece is already in
  // place: it is pushed back and released.
  #animate() {
    const slide = this.#slide;
    this.#slide = null;
    if (!slide) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const board = this.$('#board');
    if (!board) return;
    const cell = board.getBoundingClientRect().width / 8;
    if (!cell) return;

    const offset = (from, to) => {
      const a = this.#squareIndex(from);
      const b = this.#squareIndex(to);
      if (a < 0 || b < 0) return null;
      return { x: ((b % 8) - (a % 8)) * cell, y: (Math.floor(b / 8) - Math.floor(a / 8)) * cell };
    };

    const glide = (from, to) => {
      const shift = offset(from, to);
      const cellNode = board.querySelector(`[data-square="${to}"]`);
      const man = cellNode?.querySelector('.man');
      if (!shift || !man) return;
      man.animate(
        [{ transform: `translate(${-shift.x}px, ${-shift.y}px)` }, { transform: 'none' }],
        { duration: 190, easing: 'cubic-bezier(0.22, 0.7, 0.28, 1)' },
      );
    };

    glide(slide.move.from, slide.move.to);

    // a castling rook travels with the king
    if (slide.move.castle) {
      const home = rankOf(slide.move.from) * 16;
      const short = slide.move.castle === 'k';
      glide(home + (short ? 7 : 0), home + (short ? 5 : 3));
    }

    if (!slide.captured) return;
    const takenAt = slide.move.enPassant ? (rankOf(slide.move.from) << 4) | fileOf(slide.move.to) : slide.move.to;
    const host = board.querySelector(`[data-square="${takenAt}"]`);
    if (!host) return;
    const ghost = document.createElement('span');
    ghost.className = `man ghost ${slide.captured === slide.captured.toUpperCase() ? 'white' : 'black'}`;
    ghost.textContent = GLYPH[slide.captured];
    host.appendChild(ghost);
    const fade = ghost.animate([{ opacity: 0.85, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.6)' }], {
      duration: 200,
      easing: 'ease-out',
    });
    fade.finished.then(() => ghost.remove()).catch(() => ghost.remove());
  }

  #finish() {
    if (isCheckmate(this.#state)) {
      this.#over = this.#state.turn === this.#side ? 'lost' : 'won';
    } else if (isStalemate(this.#state)) {
      this.#over = 'stalemate';
    } else if (insufficientMaterial(this.#state)) {
      this.#over = 'material';
    } else if (this.#state.half >= 100) {
      this.#over = 'fifty';
    } else {
      this.#over = null;
    }
    this.#status();
    this.#pane();
    return Boolean(this.#over);
  }

  #status() {
    const target = this.$('#status');
    if (!target) return;
    const state = this.#lessonState ?? this.#state;

    if (this.#view === 'train') {
      const lesson = LESSONS[this.#lesson];
      target.innerHTML = html`<span class="turn">${lesson.ask}</span>`;
      return;
    }

    if (this.#over) {
      const said = {
        won: t('chess.youWon', 'Checkmate. You won.'),
        lost: t('chess.youLost', 'Checkmate. The computer won.'),
        stalemate: t('chess.stalemate', 'Stalemate. The game is drawn.'),
        material: t('chess.notEnoughMaterial', 'Neither side has enough to mate. Drawn.'),
        fifty: t('chess.fiftyMoves', 'Fifty moves without a capture or a pawn move. Drawn.'),
      }[this.#over];
      target.innerHTML = html`<span class="over">${said}</span>`;
      return;
    }

    const turn = state.turn === this.#side ? t('chess.yourMove', 'Your move') : t('chess.computerThinking', 'The computer is thinking');
    const warn = inCheck(state) ? html`<span class="warn">${t('chess.check', 'Check')}</span>` : '';
    target.innerHTML = html`<span class="turn">${this.#thinking ? t('chess.computerThinking', 'The computer is thinking') : turn}</span>${warn}`;
  }

  #taken() {
    const state = this.#lessonState ?? this.#state;
    const left = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const alive = { w: { ...left }, b: { ...left } };
    for (let square = 0; square < 128; square += 1) {
      if (square & 0x88) continue;
      const piece = state.board[square];
      if (!piece) continue;
      const kind = piece.toLowerCase();
      if (kind === 'k') continue;
      const colour = piece === piece.toUpperCase() ? 'w' : 'b';
      if (alive[colour][kind] !== undefined) alive[colour][kind] -= 1;
    }

    const strip = (colour) => {
      const gone = [];
      Object.entries(alive[colour]).forEach(([kind, count]) => {
        for (let index = 0; index < count; index += 1) gone.push(colour === 'w' ? kind.toUpperCase() : kind);
      });
      const score = gone.reduce((total, piece) => total + VALUE[piece.toLowerCase()], 0);
      return { gone, score };
    };

    const mine = strip(this.#side === WHITE ? 'w' : 'b');
    const theirs = strip(this.#side === WHITE ? 'b' : 'w');
    const edge = theirs.score - mine.score;

    const row = (taken, lead) => html`${taken.gone.map((piece) => html`<span class="gone">${GLYPH[piece]}</span>`)}${
      lead > 0 ? html`<span class="lead">+${lead}</span>` : ''
    }`;

    const top = this.$('#takenTop');
    const bottom = this.$('#takenBottom');
    if (top) top.innerHTML = row(mine, -edge);
    if (bottom) bottom.innerHTML = row(theirs, edge);
  }

  // ---- side panel -----------------------------------------------------

  #pane() {
    const target = this.$('#pane');
    if (!target) return;
    if (this.#view === 'openings') return this.#openingsPane(target);
    if (this.#view === 'train') return this.#trainPane(target);
    return this.#playPane(target);
  }

  #playPane(target) {
    const rows = [];
    for (let index = 0; index < this.#history.length; index += 2) {
      rows.push({
        number: index / 2 + 1,
        white: this.#history[index]?.san ?? '',
        black: this.#history[index + 1]?.san ?? '',
      });
    }

    const notes = [...this.#notes].reverse().slice(0, 6);

    target.innerHTML = html`
      <jg-field label="${t('chess.level', 'Computer strength')}">
        <jg-select id="level" size="sm" value="${this.config.get('level', 'casual')}">
          ${Object.keys(LEVELS).map((id) => html`<option value="${id}">${levelName(id)}</option>`)}
        </jg-select>
      </jg-field>

      <jg-field label="${t('chess.boardTheme', 'Board colours')}">
        <div class="swatches">
          ${THEMES.map(
            (id) => html`<button
              class="swatch ${this.config.get('theme', 'wood') === id ? 'on' : ''}"
              data-theme="${id}"
              data-board="${id}"
              title="${themeName(id)}"
              aria-label="${themeName(id)}"
            ></button>`,
          )}
        </div>
      </jg-field>

      ${this.#opening
        ? html`<div class="card opening">
            <div class="eco">${this.#opening.eco}</div>
            <div class="name">${this.#opening.name}</div>
            <p>${this.#opening.idea}</p>
          </div>`
        : ''}

      <div class="label">${t('chess.moves', 'Moves')}</div>
      ${rows.length
        ? html`<ol class="moves">${rows.map(
            (row) => html`<li><span class="no">${row.number}.</span><span>${row.white}</span><span>${row.black}</span></li>`,
          )}</ol>`
        : html`<p class="hint">${t('chess.noMovesYet', 'No moves yet. White starts.')}</p>`}

      ${notes.length
        ? html`<div class="label">${t('chess.coach', 'Coach')}</div>
            <ul class="notes">${notes.map(
              (note) => html`<li class="verdict ${note.verdict}">
                <b>${note.san}</b>
                <span>${this.#verdictWords(note)}</span>
              </li>`,
            )}</ul>`
        : ''}
    `;

    const level = this.$('#level');
    if (level) {
      this.on(level, 'change', () => {
        this.config.set('level', level.value);
        this.#pane();
      });
    }

    this.bind('[data-theme]', 'click', (event) => {
      this.config.set('theme', event.currentTarget.dataset.theme);
      this.#draw();
      this.#pane();
    });
  }

  #verdictWords(note) {
    const words = {
      good: t('chess.verdictGood', 'A good move.'),
      fine: t('chess.verdictFine', 'Reasonable.'),
      loose: t('chess.verdictLoose', 'Loose. There was more in the position.'),
      weak: t('chess.verdictWeak', 'This gives ground away.'),
      blunder: t('chess.verdictBlunder', 'A blunder. Something was hanging.'),
      forced: t('chess.verdictForced', 'Forced.'),
      unclear: t('chess.verdictUnclear', 'Playable.'),
    };
    const said = words[note.verdict] ?? '';
    if (note.best && (note.verdict === 'weak' || note.verdict === 'blunder')) {
      const before = parseFen(this.#history[note.ply - 1]?.fen ?? START_FEN);
      const better = moveToSan(before, note.best);
      return `${said} ${t('chess.betterWas', '{move} was stronger.', { move: better })}`;
    }
    return said;
  }

  #openingsPane(target) {
    const bands = new Map();
    OPENINGS.forEach((opening) => {
      if (!bands.has(opening.family)) bands.set(opening.family, []);
      bands.get(opening.family).push(opening);
    });

    target.innerHTML = html`
      <p class="hint">${t('chess.openingsBlurb', 'Pick a line to play it out on the board, one move at a time.')}</p>
      ${[...bands.entries()].map(
        ([family, list]) => html`<section class="band">
          <h4>${familyName(family)}</h4>
          ${list.map(
            (opening) => html`<button class="line" data-opening="${opening.id}">
              <span class="eco">${opening.eco}</span>
              <span class="name">${opening.name}</span>
              <span class="sanline">${opening.moves.join(' ')}</span>
            </button>`,
          )}
        </section>`,
      )}
    `;

    this.bind('[data-opening]', 'click', (event) => this.#showOpening(event.currentTarget.dataset.opening));
  }

  #showOpening(id) {
    const opening = OPENINGS.find((entry) => entry.id === id);
    if (!opening) return;
    this.#newGame({ quiet: true });
    this.#side = opening.side === 'b' ? BLACK : WHITE;
    for (const san of opening.moves) {
      const move = sanToMove(this.#state, san);
      if (!move) break;
      this.#commit(move, san);
    }
    this.#opening = opening;
    this.#view = 'play';
    this.$('#view').value = 'play';
    this.#draw();
    this.#pane();
    toast(t('chess.openingLoaded', '{name} is on the board. Play on from here.', { name: opening.name }));
    // the line may end on the computer's turn, so let it answer
    if (!this.#over && this.#state.turn !== this.#side) this.#playComputer();
  }

  #matchOpening() {
    const played = this.#history.map((entry) => bare(entry.san));
    let best = null;
    for (const opening of OPENINGS) {
      if (opening.moves.length > played.length) continue;
      const same = opening.moves.every((san, index) => bare(san) === played[index]);
      if (same && (!best || opening.moves.length > best.moves.length)) best = opening;
    }
    return best;
  }

  // ---- training -------------------------------------------------------

  #trainPane(target) {
    const lesson = LESSONS[this.#lesson];
    target.innerHTML = html`
      <div class="progress">
        <span>${t('chess.step', 'Step {n} of {total}', { n: this.#lesson + 1, total: LESSONS.length })}</span>
        <span class="done">${this.#lessonDone.size}/${LESSONS.length}</span>
      </div>

      <div class="card lesson">
        <div class="name">${lesson.title}</div>
        <p>${lesson.blurb}</p>
        <p class="ask"><b>${lesson.ask}</b></p>
        <div class="answer" id="answer"></div>
      </div>

      <div class="row tight">
        <jg-button size="sm" variant="outline" id="prev" ${this.#lesson === 0 ? 'disabled' : ''}>${t('chess.back', 'Back')}</jg-button>
        <jg-button size="sm" variant="outline" id="next" ${this.#lesson >= LESSONS.length - 1 ? 'disabled' : ''}>${t('chess.next', 'Next')}</jg-button>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="reveal">${t('chess.showMe', 'Show me')}</jg-button>
      </div>

      <ol class="steps">
        ${LESSONS.map(
          (entry, index) => html`<li class="${index === this.#lesson ? 'here' : ''} ${this.#lessonDone.has(entry.id) ? 'ticked' : ''}">
            <button data-lesson="${index}">${entry.title}</button>
          </li>`,
        )}
      </ol>
    `;

    this.on(this.$('#prev'), 'click', () => this.#openLesson(this.#lesson - 1));
    this.on(this.$('#next'), 'click', () => this.#openLesson(this.#lesson + 1));
    this.on(this.$('#reveal'), 'click', () => this.#revealLesson());
    this.bind('[data-lesson]', 'click', (event) => this.#openLesson(Number(event.currentTarget.dataset.lesson)));
  }

  #openLesson(index) {
    this.#lesson = Math.max(0, Math.min(LESSONS.length - 1, index));
    this.#lessonState = parseFen(LESSONS[this.#lesson].fen);
    this.#pick = null;
    this.#last = null;
    this.#side = this.#lessonState.turn;
    this.#draw();
    this.#pane();
  }

  #lessonTap(square) {
    const lesson = LESSONS[this.#lesson];
    const state = this.#lessonState;
    const piece = state.board[square];
    const mine = piece && (piece === piece.toUpperCase() ? WHITE : BLACK) === state.turn;

    if (this.#pick == null) {
      if (mine) this.#pick = square;
      this.#draw();
      return;
    }
    if (mine) {
      this.#pick = square;
      this.#draw();
      return;
    }

    const move = legalMoves(state).find(
      (entry) => entry.from === this.#pick && entry.to === square && (!entry.promotion || entry.promotion === 'q'),
    );
    this.#pick = null;
    if (!move) {
      this.#draw();
      return;
    }

    const san = bare(moveToSan(state, move));
    const right = lesson.accept.some((answer) => bare(answer) === san);
    this.#last = move;
    if (right) {
      this.#lessonDone.add(lesson.id);
      this.#lessonState = applyMove(state, move).state;
    }
    this.#draw();
    this.#pane();

    const answer = this.$('#answer');
    if (answer) {
      answer.innerHTML = right
        ? html`<p class="right">${t('chess.thatIsIt', 'That is it. {san}', { san })} ${lesson.note}</p>`
        : html`<p class="wrong">${t('chess.notQuite', '{san} is not the point here. Try again.', { san })}</p>`;
    }
  }

  #revealLesson() {
    const lesson = LESSONS[this.#lesson];
    const state = this.#lessonState ?? parseFen(lesson.fen);
    const move = sanToMove(state, lesson.accept[0]);
    if (move) {
      this.#last = move;
      this.#lessonState = applyMove(state, move).state;
      this.#lessonDone.add(lesson.id);
      this.#draw();
    }
    const answer = this.$('#answer');
    if (answer) answer.innerHTML = html`<p class="right">${lesson.accept[0]}. ${lesson.note}</p>`;
  }

  // ---- game actions ---------------------------------------------------

  #newGame(options = {}) {
    this.#state = parseFen(START_FEN);
    this.#history = [];
    this.#notes = [];
    this.#pick = null;
    this.#last = null;
    this.#over = null;
    this.#opening = null;
    this.#lessonState = null;
    this.#thinking = false;
    if (!options.quiet) {
      this.#draw();
      this.#pane();
    }
  }

  #flip() {
    this.#side = this.#side === WHITE ? BLACK : WHITE;
    this.#draw();
    if (!this.#over && this.#view === 'play' && this.#state.turn !== this.#side) this.#playComputer();
  }

  #undo() {
    if (this.#view === 'train') return this.#openLesson(this.#lesson);
    if (!this.#history.length) return;
    // step back over the computer's reply and your own move
    const back = this.#history.length >= 2 ? 2 : 1;
    for (let index = 0; index < back; index += 1) {
      const entry = this.#history.pop();
      if (entry) this.#state = parseFen(entry.fen);
    }
    this.#notes = this.#notes.filter((note) => note.ply <= this.#history.length);
    this.#over = null;
    this.#last = null;
    this.#pick = null;
    this.#opening = this.#matchOpening();
    this.#draw();
    this.#pane();
  }

  #hint() {
    const state = this.#lessonState ?? this.#state;
    if (this.#view === 'train') {
      const lesson = LESSONS[this.#lesson];
      const move = sanToMove(state, lesson.accept[0]);
      if (move) {
        this.#pick = move.from;
        this.#draw();
      }
      return;
    }
    if (this.#over || this.#state.turn !== this.#side) return;
    const move = pickMove(state, 'steady');
    if (!move) return;
    this.#pick = move.from;
    this.#draw();
    toast(t('chess.tryThisPiece', 'Try the piece on {square}.', { square: squareName(move.from) }));
  }

  #pgn() {
    const rows = [];
    for (let index = 0; index < this.#history.length; index += 2) {
      const white = this.#history[index]?.san ?? '';
      const black = this.#history[index + 1]?.san ?? '';
      rows.push(`${index / 2 + 1}. ${white}${black ? ` ${black}` : ''}`);
    }
    return rows.join(' ');
  }

  #copyPgn() {
    const text = this.#pgn();
    if (!text) return;
    copyText(text);
  }

  #savePgn() {
    const text = this.#pgn();
    if (!text) return;
    download('game.pgn', `${text}\n`, 'application/x-chess-pgn');
  }
}

define('jg-app-chess', Chess);
