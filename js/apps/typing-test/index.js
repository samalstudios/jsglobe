import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';

const t = await appWords('typing-test', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const COMMON = 'the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been has had said each she which their time will about if up out many then them can only other new some what would make like him into has two more her go see no way could my than first been call who oil sit now find down day did get come made may part'.split(' ');

const QUOTES = [
  'A user interface is well designed when the program behaves exactly how the user thought it would.',
  'Simplicity is prerequisite for reliability, and complexity is what kills software projects.',
  'Programs must be written for people to read, and only incidentally for machines to execute.',
  'The best way to get a project done faster is to start sooner, not to add more people to it.',
  'Any sufficiently advanced technology is indistinguishable from magic to the people who use it.',
];

const DURATIONS = [15, 30, 60, 120];

class TypingTest extends JGApp {
  static appId = 'typing-test';
  static styles = [...JGApp.styles, sheet];

  #words = [];
  #typed = [];
  #index = 0;
  #buffer = '';
  #startedAt = null;
  #timer = null;
  #duration = 30;
  #mode = 'words';
  #mistakes = new Map();

  renderApp() {
    const saved = this.store.read({ duration: 30, mode: 'words' });
    this.#duration = saved.duration ?? 30;
    this.#mode = saved.mode ?? 'words';

    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="mode"></jg-tabs>
        <jg-segment id="duration"></jg-segment>
        <span class="grow"></span>
        <jg-button size="sm" variant="outline" id="restart">${t('typing-test.restart', 'Restart')}</jg-button>
      </div>

      <div class="stage" id="stage" tabindex="0">
        <div id="text"></div>
        <input class="hidden-input" id="capture" autocomplete="off" autocapitalize="off" spellcheck="false" />
      </div>

      <div class="stats" id="stats"></div>

      <jg-card title="${t('typing-test.troubleKeys', 'Trouble keys')}" sub="${t('typing-test.whereTheMistakesLanded', 'Where the mistakes landed')}">
        <div class="keys" id="keys"></div>
      </jg-card>

      <jg-card title="${t('typing-test.personalBests', 'Personal bests')}" sub="${t('typing-test.savedInThisWorkspace', 'Saved in this workspace')}">
        <div class="bests" id="bests"></div>
      </jg-card>
    </div>`);

    const modes = this.$('#mode');
    modes.items = [
      { value: 'words', label: t('typing-test.words', 'Words') },
      { value: 'quote', label: t('typing-test.quote', 'Quote') },
    ];
    modes.value = this.#mode;
    this.on(modes, 'change', (event) => {
      this.#mode = event.detail.value;
      this.#reset();
    });

    const durations = this.$('#duration');
    durations.items = DURATIONS.map((seconds) => ({ value: String(seconds), label: `${seconds}s` }));
    durations.value = String(this.#duration);
    this.on(durations, 'change', (event) => {
      this.#duration = Number(event.detail.value);
      this.#reset();
    });

    this.on(this.$('#restart'), 'click', () => this.#reset());
    this.on(this.$('#stage'), 'click', () => this.$('#capture').focus());
    this.on(this.$('#capture'), 'keydown', (event) => this.#key(event));
    this.on(this.$('#capture'), 'input', (event) => {
      event.target.value = '';
    });

    this.#reset();
    this.#paintBests();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  #reset() {
    clearInterval(this.#timer);
    this.#timer = null;
    this.#startedAt = null;
    this.#index = 0;
    this.#buffer = '';
    this.#typed = [];
    this.#mistakes = new Map();

    this.#words =
      this.#mode === 'quote'
        ? QUOTES[Math.floor(Math.random() * QUOTES.length)].split(' ')
        : Array.from({ length: 120 }, () => COMMON[Math.floor(Math.random() * COMMON.length)]);

    this.store.write({ ...this.store.read({}), duration: this.#duration, mode: this.#mode });
    this.#paintText();
    this.#paintStats(0);
    this.#paintKeys();
    this.$('#capture').focus();
  }

  #key(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;

    if (key === 'Tab') {
      event.preventDefault();
      this.#reset();
      return;
    }
    if (key.length > 1 && key !== 'Backspace') return;
    event.preventDefault();

    if (!this.#startedAt && (key === ' ' ? false : true)) this.#start();

    if (key === 'Backspace') {
      if (this.#buffer) this.#buffer = this.#buffer.slice(0, -1);
      else if (this.#index > 0) {
        this.#index -= 1;
        this.#buffer = this.#typed[this.#index] ?? '';
        this.#typed[this.#index] = undefined;
      }
    } else if (key === ' ') {
      if (!this.#buffer) return;
      this.#typed[this.#index] = this.#buffer;
      this.#index += 1;
      this.#buffer = '';
      if (this.#index >= this.#words.length) return this.#finish();
    } else {
      const expected = this.#words[this.#index]?.[this.#buffer.length];
      if (expected && key !== expected) {
        this.#mistakes.set(expected, (this.#mistakes.get(expected) ?? 0) + 1);
      }
      this.#buffer += key;
    }

    this.#paintText();
    this.#paintKeys();
    return undefined;
  }

  #start() {
    if (this.#startedAt) return;
    this.#startedAt = performance.now();
    this.#timer = setInterval(() => {
      const elapsed = (performance.now() - this.#startedAt) / 1000;
      if (elapsed >= this.#duration && this.#mode === 'words') {
        this.#finish();
        return;
      }
      this.#paintStats(elapsed);
    }, 200);
  }

  #finish() {
    clearInterval(this.#timer);
    this.#timer = null;
    const elapsed = this.#startedAt ? (performance.now() - this.#startedAt) / 1000 : 0;
    if (this.#buffer) {
      this.#typed[this.#index] = this.#buffer;
      this.#buffer = '';
    }
    const result = this.#score(elapsed);
    this.#paintStats(elapsed);
    this.#paintKeys();
    this.#remember(result);
    this.#startedAt = null;
  }

  #score(elapsed) {
    let correctChars = 0;
    let typedChars = 0;
    let correctWords = 0;

    this.#typed.forEach((word, index) => {
      if (word === undefined) return;
      const target = this.#words[index] ?? '';
      typedChars += word.length + 1;
      if (word === target) {
        correctWords += 1;
        correctChars += word.length + 1;
      } else {
        [...word].forEach((character, position) => {
          if (character === target[position]) correctChars += 1;
        });
      }
    });

    const minutes = Math.max(elapsed, 0.001) / 60;
    return {
      wpm: Math.round(correctChars / 5 / minutes) || 0,
      raw: Math.round(typedChars / 5 / minutes) || 0,
      accuracy: typedChars ? Math.round((correctChars / typedChars) * 100) : 100,
      words: correctWords,
      elapsed,
    };
  }

  #paintText() {
    const start = Math.max(0, this.#index - 12);
    const slice = this.#words.slice(start, start + 60);

    this.$('#text').innerHTML = slice
      .map((word, offset) => {
        const index = start + offset;
        const typed = index === this.#index ? this.#buffer : this.#typed[index];

        if (typed === undefined) {
          return html`<span class="word">${index === this.#index ? html`<span class="caret"></span>` : ''}${[...word].map(
            (character) => html`<span class="ch">${character}</span>`,
          )}</span>`;
        }

        const characters = [...word].map((character, position) => {
          const entered = typed[position];
          const state = entered === undefined ? 'pending' : entered === character ? 'good' : 'bad';
          return html`${index === this.#index && position === typed.length ? html`<span class="caret"></span>` : ''}<span class="ch" data-state="${state}">${character}</span>`;
        });

        const extra = typed.length > word.length ? [...typed.slice(word.length)].map((character) => html`<span class="ch" data-state="extra">${character}</span>`) : [];
        const caretAtEnd = index === this.#index && typed.length >= word.length;

        return html`<span class="word">${characters}${extra}${caretAtEnd ? html`<span class="caret"></span>` : ''}</span>`;
      })
      .join('');
  }

  #paintStats(elapsed) {
    const result = this.#score(elapsed || 0.001);
    const remaining = this.#mode === 'quote'
      ? Math.round(elapsed)
      : Math.max(0, Math.ceil(this.#duration - elapsed));

    this.$('#stats').innerHTML = [
      [this.#mode === 'quote' ? 'Seconds' : 'Time left', remaining],
      ['WPM', this.#startedAt || elapsed ? result.wpm : 0],
      ['Raw', this.#startedAt || elapsed ? result.raw : 0],
      ['Accuracy', `${result.accuracy}%`],
      ['Words', result.words],
    ]
      .map(([name, value]) => html`<div class="stat"><span class="value">${value}</span><span class="name">${name}</span></div>`)
      .join('');
  }

  #paintKeys() {
    const entries = [...this.#mistakes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
    const peak = entries.length ? entries[0][1] : 1;

    this.$('#keys').innerHTML = entries.length
      ? entries
          .map(([key, count]) => html`<span class="key" style="--heat:${(count / peak).toFixed(2)}" title="${count} misses">${key === ' ' ? '␣' : key}</span>`)
          .join('')
      : html`<span class="hint">${t('typing-test.noMistakesRecordedYet', 'No mistakes recorded yet.')}</span>`;
  }

  #remember(result) {
    if (!result.wpm) return;
    const data = this.store.read({ bests: [] });
    const bests = [...(data.bests ?? []), { ...result, mode: this.#mode, duration: this.#duration, at: new Date().toISOString() }]
      .sort((a, b) => b.wpm - a.wpm)
      .slice(0, 5);
    this.store.write({ ...data, bests });
    this.#paintBests();
  }

  #paintBests() {
    const bests = this.store.read({ bests: [] }).bests ?? [];
    this.$('#bests').innerHTML = bests.length
      ? bests
          .map(
            (best) => html`<div class="best">
              <span>${best.wpm} WPM at ${best.accuracy}%</span>
              <span>${best.mode} ${best.duration}s</span>
              <span>${best.at.slice(0, 10)}</span>
            </div>`,
          )
          .join('')
      : html`<span class="hint">${t('typing-test.finishARunToRecord', 'Finish a run to record a best.')}</span>`;
  }
}

define('jg-app-typing-test', TypingTest);
