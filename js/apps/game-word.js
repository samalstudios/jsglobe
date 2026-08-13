import { JGApp, define, html, css } from '../core/app.js';
import { toast } from '../core/util.js';

const sheet = css`
  .grid { display: grid; gap: 6px; justify-content: center; }
  .line { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .tile {
    display: grid;
    place-items: center;
    width: clamp(38px, 11vw, 54px);
    aspect-ratio: 1;
    border: 2px solid var(--border);
    border-radius: 6px;
    font: 700 clamp(17px, 4.4vw, 24px)/1 var(--font-sans);
    text-transform: uppercase;
    color: var(--foreground);
    transition: transform 0.14s ease, background 0.2s ease, border-color 0.2s ease;
  }
  .tile[data-filled="true"] { border-color: var(--border-strong); transform: scale(1.02); }
  .tile[data-state="hit"] { background: var(--success); border-color: transparent; color: #06210f; }
  .tile[data-state="near"] { background: var(--warning); border-color: transparent; color: #241a02; }
  .tile[data-state="miss"] { background: color-mix(in srgb, var(--muted-foreground) 45%, transparent); border-color: transparent; }
  .keyboard { display: grid; gap: 5px; justify-content: center; }
  .krow { display: flex; gap: 4px; justify-content: center; }
  .key {
    min-width: clamp(24px, 7.6vw, 36px);
    height: 42px;
    padding: 0 6px;
    border: 0;
    border-radius: 5px;
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    color: var(--foreground);
    font: 600 12px/1 var(--font-sans);
    text-transform: uppercase;
    cursor: pointer;
  }
  .key[data-wide="true"] { min-width: 52px; font-size: 10.5px; }
  .key[data-state="hit"] { background: var(--success); color: #06210f; }
  .key[data-state="near"] { background: var(--warning); color: #241a02; }
  .key[data-state="miss"] { background: color-mix(in srgb, var(--muted-foreground) 30%, transparent); color: var(--muted-foreground); }
  .board-wrap { display: grid; gap: 14px; justify-items: center; }
`;

const ANSWERS = 'about above actor adobe after again agent agree ahead alarm album alert alike alive allow alone along alter among anger angle angry ankle apart apple apply arena argue arise armor arrow aside asset avoid awake award aware badly baker basic beach beard beast begin being below bench birth black blade blame blank blast blaze bleed blend bless blind block blood board boost booth bound brain brand brave bread break breed brick bride brief bring broad broke brown brush build built burst cabin cable camel candy canoe cargo carry carve catch cause chain chair chalk charm chart chase cheap check cheek cheer chess chest chief child chill china choir chose chunk claim clash class clean clear clerk click cliff climb clock close cloth cloud coach coast color comic coral couch could count court cover crack craft crane crash crawl crazy cream creek crest crime crisp cross crowd crown crude cruel crush curve cycle daily dairy dance dealt death debut decay delay dense depth diary dirty ditch diver dodge doubt draft drain drama drawn dream dress dried drift drink drive drove drown dwell eager eagle early earth eight elbow elder elect elite empty enemy enjoy enter entry equal error essay event every exact exist extra fable faint faith false fancy fatal fault favor feast fence ferry fever field fiery fifth fight final first flame flash fleet flesh flick fling float flock flood floor flour fluid flush focus force forge forth forty forum found frame fraud fresh fried front frost fruit fully funny gauge ghost giant given glass gleam globe glory glove going grace grade grain grand grant grape graph grasp grass grave great greed green greet grief grill grind gross group grove guard guess guest guide guilt habit handy happy harsh haste hatch haunt heard heart heavy hedge hello hence hobby honey honor horse hotel house human humid humor hurry ideal image imply index inner input irony issue ivory jelly jewel joint judge juice knife knock known label labor large laser later laugh layer learn lease least leave legal lemon level lever light limit linen liver lobby local lodge logic loose lorry lower loyal lucky lunar lunch lying magic major maker mango maple march marsh match maybe mayor meant medal media melon mercy merge merit metal meter midst might minor minus mixed model moist money month moral motor mount mouse mouth movie muddy music naked named nasty naval nerve never newly night noble noise north notch noted novel nurse ocean offer often olive onion opera orbit order organ other ought ounce outer owner ozone paint panel panic paper party pasta patch pause peace peach pearl pedal penny perch performer phase phone photo piano piece pilot pinch pitch pivot pixel place plain plane plant plate plaza pluck plumb point polar polio porch pound power press price pride prime print prior prize probe prone proof proud prove pulse punch pupil puppy purse quest queue quick quiet quilt quite quota radar radio raise rally ranch range rapid ratio reach react ready realm rebel refer reign relax relay renew repay reply rider ridge rifle right rigid rinse risky rival river roast robin robot rocky roman rough round route royal rugby ruler rumor rural sadly saint salad salon sandy satin sauce scale scarf scene scent scope score scout scrap screw sense serve seven shade shaft shake shall shame shape share sharp sheep sheet shelf shell shift shine shirt shock shoot shore short shout shown shrub siege sight silly since siren sixth skate skill skirt slate sleep slice slide slope small smart smell smile smoke snack snake sneak solar solid solve sorry sound south space spare spark speak speed spell spend spent spice spike spine spite split spoke spoon sport spray squad stack staff stage stain stair stake stamp stand stare start state steam steel steep steer stern stick stiff still sting stock stone stood stool store storm story stout stove strap straw strip stuck study stuff style sugar suite sunny super surge sweat sweep sweet swift swing sword table taken talent tally taste teach teeth tempo tenor tense tenth thank theft their theme there thick thief thigh thing think third thorn those three threw throw thumb tiger tight timer title toast today token tooth topic torch total touch tough tower toxic trace track trade trail train trait trash treat trend trial tribe trick tried tries troop trout truck truly trunk trust truth tulip tutor twice twist ultra uncle under union unite unity until upper upset urban usage usual valid value valve vapor vault venue verse video vigil villa vinyl viral virus visit vital vivid vocal voice voter wagon waist waste watch water weary weave wedge weigh weird whale wheat wheel where which while white whole whose widow width windy witty woman world worry worse worst worth would wound wrist write wrong yacht yield young youth zebra'.split(' ').filter((word) => word.length === 5);
const ALLOWED = new Set(ANSWERS);

const ROWS = 6;
const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const score = (guess, answer) => {
  const result = new Array(5).fill('miss');
  const pool = {};

  [...answer].forEach((letter, index) => {
    if (guess[index] === letter) result[index] = 'hit';
    else pool[letter] = (pool[letter] ?? 0) + 1;
  });

  [...guess].forEach((letter, index) => {
    if (result[index] === 'hit') return;
    if (pool[letter]) {
      result[index] = 'near';
      pool[letter] -= 1;
    }
  });

  return result;
};

class GameWord extends JGApp {
  static appId = 'game-word';
  static styles = [...JGApp.styles, sheet];

  #answer = '';
  #guesses = [];
  #current = '';
  #state = 'playing';

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-badge id="status" tone="muted">Guess the word</jg-badge>
        <span class="grow"></span>
        <span class="hint" id="streak"></span>
        <jg-button size="sm" variant="outline" id="new">New word</jg-button>
      </div>

      <div class="board-wrap">
        <div class="grid" id="grid"></div>
        <div class="keyboard" id="keyboard"></div>
      </div>

      <div class="hint">
        Six tries to find a five letter word. Green means the letter is in the right place, amber means it is in
        the word somewhere else.
      </div>
    </div>`);

    this.on(this.$('#new'), 'click', () => this.#start());
    this.hotkeys((event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.#submit();
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        this.#current = this.#current.slice(0, -1);
        this.#paint();
        return;
      }
      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        this.#type(event.key.toLowerCase());
      }
    });

    this.#start();
  }

  #start() {
    this.#answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    this.#guesses = [];
    this.#current = '';
    this.#state = 'playing';
    this.#status('muted', 'Guess the word');
    this.#paint();
  }

  #status(tone, text) {
    const status = this.$('#status');
    status.setAttribute('tone', tone);
    status.textContent = text;
  }

  #type(letter) {
    if (this.#state !== 'playing' || this.#current.length >= 5) return;
    this.#current += letter;
    this.#paint();
  }

  #submit() {
    if (this.#state !== 'playing') return this.#start();
    if (this.#current.length < 5) {
      toast('Five letters are needed', 'error');
      return undefined;
    }
    if (!ALLOWED.has(this.#current)) {
      toast(`"${this.#current}" is not in the word list`, 'error');
      return undefined;
    }

    this.#guesses.push(this.#current);
    const won = this.#current === this.#answer;
    this.#current = '';

    if (won) {
      this.#state = 'won';
      this.#status('success', `Solved in ${this.#guesses.length}`);
      this.#record(true);
    } else if (this.#guesses.length >= ROWS) {
      this.#state = 'lost';
      this.#status('danger', `The word was ${this.#answer}`);
      this.#record(false);
    }

    this.#paint();
    return undefined;
  }

  #record(won) {
    const data = this.store.read({ played: 0, won: 0, streak: 0, best: 0 });
    data.played = (data.played ?? 0) + 1;
    data.won = (data.won ?? 0) + (won ? 1 : 0);
    data.streak = won ? (data.streak ?? 0) + 1 : 0;
    data.best = Math.max(data.best ?? 0, data.streak);
    this.store.write(data);
  }

  #paint() {
    const rows = Array.from({ length: ROWS }, (item, index) => {
      if (index < this.#guesses.length) {
        const guess = this.#guesses[index];
        const states = score(guess, this.#answer);
        return [...guess].map((letter, position) => ({ letter, state: states[position] }));
      }
      if (index === this.#guesses.length && this.#state === 'playing') {
        return Array.from({ length: 5 }, (entry, position) => ({ letter: this.#current[position] ?? '', state: null }));
      }
      return Array.from({ length: 5 }, () => ({ letter: '', state: null }));
    });

    this.$('#grid').innerHTML = rows
      .map(
        (row) => html`<div class="line">
          ${row.map(
            (cell) => html`<div class="tile" data-state="${cell.state ?? ''}" data-filled="${String(Boolean(cell.letter))}">${cell.letter}</div>`,
          )}
        </div>`,
      )
      .join('');

    const best = {};
    const rank = { miss: 0, near: 1, hit: 2 };
    this.#guesses.forEach((guess) => {
      const states = score(guess, this.#answer);
      [...guess].forEach((letter, index) => {
        if (!best[letter] || rank[states[index]] > rank[best[letter]]) best[letter] = states[index];
      });
    });

    this.$('#keyboard').innerHTML = KEYS.map(
      (row, index) => html`<div class="krow">
        ${index === 2 ? html`<button class="key" data-wide="true" data-key="enter">enter</button>` : ''}
        ${[...row].map((letter) => html`<button class="key" data-key="${letter}" data-state="${best[letter] ?? ''}">${letter}</button>`)}
        ${index === 2 ? html`<button class="key" data-wide="true" data-key="back">delete</button>` : ''}
      </div>`,
    ).join('');

    this.bind('[data-key]', 'click', (event) => {
      const key = event.currentTarget.dataset.key;
      if (key === 'enter') return this.#submit();
      if (key === 'back') {
        this.#current = this.#current.slice(0, -1);
        this.#paint();
        return undefined;
      }
      this.#type(key);
      return undefined;
    });

    const stats = this.store.read({ played: 0, won: 0, streak: 0, best: 0 });
    this.$('#streak').textContent = stats.played
      ? `${stats.won}/${stats.played} solved - streak ${stats.streak}, best ${stats.best}`
      : '';
  }
}

define('jg-app-game-word', GameWord);
