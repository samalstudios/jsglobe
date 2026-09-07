import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { icon } from '../../ui/icons.js';
import { toast } from '../../core/util.js';
import {
  SCRIPTS, scriptById, setById, letterKey, choicesFor, nextLetter, scoreOf, strengthOf, LEARNED_AT,
  lookBands, soundBands,
} from '../../lib/alphabets.js';

const t = await appWords('letters', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const SCRIPT_NAME = {
  greek: () => t('letters.greek', 'Greek'),
  cyrillic: () => t('letters.cyrillic', 'Cyrillic'),
  japanese: () => t('letters.japanese', 'Japanese'),
  korean: () => t('letters.korean', 'Korean'),
  chinese: () => t('letters.chinese', 'Chinese'),
};

class Letters extends JGApp {
  static appId = 'letters';
  static settings = [
    { key: 'ask', label: t('letters.whatToAskFor', 'What the game asks for'), type: 'select', default: 'latin', options: [
      { value: 'latin', label: t('letters.showTheLetter', 'Show the letter, pick the sound') },
      { value: 'glyph', label: t('letters.showTheSound', 'Show the sound, pick the letter') },
      { value: 'both', label: t('letters.mixTheTwo', 'Mix the two') },
    ] },
  ];
  static styles = [...JGApp.styles, sheet];

  #script = 'greek';
  #set = 'greek';
  #view = 'chart';
  #progress = {};
  #asked = null;
  #ask = 'latin';
  #answered = false;
  #run = { right: 0, wrong: 0, streak: 0, best: 0 };
  #size = 34;
  #group = 'order';

  renderApp() {
    const saved = this.store.read();
    this.#script = saved?.script ?? 'greek';
    this.#set = saved?.set ?? scriptById(this.#script).sets[0].id;
    this.#progress = saved?.progress ?? {};
    this.#size = Number(saved?.size) || 34;
    this.#group = saved?.group ?? 'order';

    this.paint(html`<div class="app">
      <div class="bar">
        <div class="scripts">
          ${SCRIPTS.map(
            (script) => html`<button class="script" data-script="${script.id}"
              aria-pressed="${String(script.id === this.#script)}">${SCRIPT_NAME[script.id]?.() ?? script.name}</button>`,
          )}
        </div>
        <span class="grow"></span>
        <div class="views">
          <button class="view" data-view="chart" aria-pressed="true">${t('letters.chart', 'Chart')}</button>
          <button class="view" data-view="practice" aria-pressed="false">${t('letters.practise', 'Practise')}</button>
        </div>
      </div>

      <div class="bar thin">
        <div class="sets" id="sets"></div>
        <span class="grow"></span>
        <div class="groups" id="groups">
          <button class="set" data-group="order">${t('letters.inOrder', 'In order')}</button>
          <button class="set" data-group="look">${t('letters.lookAlike', 'Look alike')}</button>
          <button class="set" data-group="sound">${t('letters.soundAlike', 'Sound alike')}</button>
          <button class="set" data-group="progress">${t('letters.byProgress', 'By progress')}</button>
        </div>
        <label class="sizer" title="${t('letters.letterSize', 'Letter size')}">
          ${icon('type', 13)}
          <input type="range" id="size" min="22" max="90" value="${this.#size}">
        </label>
        <span class="tally" id="tally"></span>
        <button class="tool" id="forget" title="${t('letters.forgetThisSet', 'Forget what this set has learned')}">${icon('eraser', 14)}</button>
      </div>

      <p class="voice" id="voice" hidden></p>

      <div class="chart" id="chart"></div>

      <div class="practice" id="practice" hidden>
        <div class="scoreline">
          <span class="pill">${icon('checkSquare', 13)}<b id="right">0</b></span>
          <span class="pill">${icon('close', 13)}<b id="wrong">0</b></span>
          <span class="grow"></span>
          <span class="pill" id="streakpill">${t('letters.streak', 'Streak')} <b id="streak">0</b></span>
        </div>

        <div class="card" id="card">
          <span class="prompt" id="prompt"></span>
          <span class="promptname" id="promptname"></span>
        </div>

        <div class="choices" id="choices"></div>
        <p class="verdict" id="verdict" role="status" aria-live="polite"></p>
      </div>

      <div class="detail" id="detail" hidden>
        <button class="shut wide" id="wide" title="${t('letters.fillTheApp', 'Fill the app')}">${icon('maximize', 13)}</button>
        <button class="shut" id="shut" title="${t('letters.close', 'Close')}">${icon('close', 14)}</button>
        <div class="crown">
          <span class="big" id="big"></span>
          <button class="say" id="say" title="${t('letters.hearIt', 'Hear it')}">${icon('speaker', 15)}</button>
        </div>
        <div class="facts" id="facts"></div>
      </div>
    </div>`);

    this.on(this.$('.scripts'), 'click', (event) => {
      const button = event.target.closest('[data-script]');
      if (!button) return;
      this.#script = button.dataset.script;
      this.#set = scriptById(this.#script).sets[0].id;
      this.#keep();
      this.#drawScripts();
      this.#drawSets();
      this.#drawChart();
      this.#drawVoiceNote();
      if (this.#view === 'practice') this.#askOne();
    });

    this.on(this.$('.views'), 'click', (event) => {
      const button = event.target.closest('[data-view]');
      if (button) this.#showView(button.dataset.view);
    });

    this.on(this.$('#sets'), 'click', (event) => {
      const button = event.target.closest('[data-set]');
      if (!button) return;
      this.#set = button.dataset.set;
      this.#keep();
      this.#drawSets();
      this.#drawChart();
      if (this.#view === 'practice') this.#askOne();
    });

    this.on(this.$('#chart'), 'click', (event) => {
      const cell = event.target.closest('[data-glyph]');
      if (!cell) return;
      this.#showDetail(cell.dataset.glyph);
      this.#sayLetter(cell.dataset.glyph);
    });

    this.on(this.$('#choices'), 'click', (event) => {
      const button = event.target.closest('[data-answer]');
      if (button) this.#answer(button.dataset.answer);
    });

    this.on(this.$('#shut'), 'click', () => {
      this.$('#detail').hidden = true;
    });

    this.on(this.$('#wide'), 'click', () => this.#widen());

    this.listen(window, 'keydown', (event) => {
      if (event.key !== 'Escape' || this.offsetParent === null) return;
      const detail = this.$('#detail');
      if (detail.hidden) return;
      event.preventDefault();
      if (detail.hasAttribute('data-full')) this.#widen(false);
      else detail.hidden = true;
    });

    this.on(this.$('#forget'), 'click', () => this.#forget());

    this.on(this.$('#groups'), 'click', (event) => {
      const button = event.target.closest('[data-group]');
      if (!button) return;
      this.#group = button.dataset.group;
      this.#keep();
      this.#drawChart();
    });

    this.on(this.$('#size'), 'input', () => {
      this.#size = Number(this.$('#size').value);
      this.$('#chart').style.setProperty('--letter-size', `${this.#size}px`);
      this.#keep();
    });

    this.on(this.$('#say'), 'click', () => this.#speak(this.$('#say').dataset.text));
    this.on(this.$('#chart'), 'click', (event) => {
      const speaker = event.target.closest('[data-say]');
      if (!speaker) return;
      event.stopPropagation();
      this.#speak(speaker.dataset.say);
    });

    this.listen(window, 'keydown', (event) => {
      if (this.#view !== 'practice' || this.offsetParent === null) return;
      const at = Number(event.key);
      if (at >= 1 && at <= 4) {
        const button = this.$$('[data-answer]')[at - 1];
        if (button) {
          event.preventDefault();
          this.#answer(button.dataset.answer);
        }
        return;
      }
      if (event.key === 'Enter' && this.#answered) {
        event.preventDefault();
        this.#askOne();
      }
    });

    this.$('#chart').style.setProperty('--letter-size', `${this.#size}px`);
    this.#drawScripts();
    this.#drawSets();
    this.#drawChart();
    this.#watchVoices();
    this.#drawVoiceNote();
  }

  #letters() {
    return setById(this.#script, this.#set).letters;
  }

  #keep() {
    this.store.write({
      script: this.#script,
      set: this.#set,
      progress: this.#progress,
      size: this.#size,
      group: this.#group,
    });
  }

  // the voices come with the device, so nothing is asked of the network. Asking
  // for a language the device has no voice for reads it in English instead,
  // which teaches the wrong sound, so nothing is said unless a voice matches
  #voiceFor(tag) {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    if (!voices.length || !tag) return null;
    const want = tag.toLowerCase();
    const base = want.split('-')[0];
    const same = (voice) => voice.lang.toLowerCase().replace('_', '-');
    return (
      voices.find((voice) => same(voice) === want && voice.localService) ??
      voices.find((voice) => same(voice) === want) ??
      voices.find((voice) => same(voice).split('-')[0] === base && voice.localService) ??
      voices.find((voice) => same(voice).split('-')[0] === base) ??
      null
    );
  }

  #speak(text) {
    const tag = scriptById(this.#script).speech;
    const voice = this.#voiceFor(tag);
    if (!text || !voice) return;
    const said = new SpeechSynthesisUtterance(text);
    said.voice = voice;
    said.lang = voice.lang;
    said.rate = 0.8;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(said);
  }

  #canSpeak() {
    return Boolean(this.#voiceFor(scriptById(this.#script).speech));
  }

  #watchVoices() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    this.listen(window.speechSynthesis, 'voiceschanged', () => {
      this.#drawChart();
      this.#drawVoiceNote();
    });
  }

  #drawVoiceNote() {
    const note = this.$('#voice');
    if (!note) return;
    const script = scriptById(this.#script);
    const voice = this.#voiceFor(script.speech);
    note.hidden = Boolean(voice);
    note.textContent = voice
      ? ''
      : t('letters.noVoiceHere', 'This device has no {language} voice, so nothing is read aloud', {
          language: SCRIPT_NAME[script.id]?.() ?? script.name,
        });
  }

  // a letter on its own often has no sound a voice can say, so fall back to the
  // word that shows it at work
  #sayLetter(glyph) {
    const letter = this.#letters().find((entry) => entry.glyph === glyph);
    if (!letter) return;
    const set = setById(this.#script, this.#set);
    const alone = set.cased || this.#script === 'japanese' || this.#script === 'korean';
    this.#speak(alone ? letter.glyph : letter.example?.word ?? letter.glyph);
  }

  #drawScripts() {
    for (const button of this.$$('[data-script]')) {
      button.setAttribute('aria-pressed', String(button.dataset.script === this.#script));
    }
  }

  #drawSets() {
    const script = scriptById(this.#script);
    const host = this.$('#sets');
    host.hidden = script.sets.length < 2;
    host.innerHTML = script.sets
      .map(
        (set) =>
          `<button class="set" data-set="${set.id}" aria-pressed="${String(set.id === this.#set)}">${set.name}</button>`,
      )
      .join('');
    this.#drawTally();
  }

  #drawTally() {
    const score = scoreOf(this.#letters(), this.#progress);
    this.$('#tally').textContent = t('letters.learnedOf', '{learned} of {total} learned', {
      learned: score.learned,
      total: score.total,
    });
  }

  #bands() {
    const set = setById(this.#script, this.#set);
    const letters = set.letters;

    if (this.#group === 'look') return lookBands(this.#set, letters);
    if (this.#group === 'sound') return soundBands(letters);
    if (this.#group === 'progress') {
      const bands = [
        { label: t('letters.learned', 'Learned'), letters: [] },
        { label: t('letters.gettingThere', 'Getting there'), letters: [] },
        { label: t('letters.notStarted', 'Not started'), letters: [] },
      ];
      for (const letter of letters) {
        const record = this.#progress[letterKey(letter)];
        const at = !record?.seen ? 2 : (record.streak ?? 0) >= LEARNED_AT ? 0 : 1;
        bands[at].letters.push(letter);
      }
      return bands.filter((band) => band.letters.length);
    }
    return [{ label: '', letters, rest: true }];
  }

  #drawChart() {
    const host = this.$('#chart');
    const script = scriptById(this.#script);
    const set = setById(this.#script, this.#set);

    for (const button of this.$$('[data-group]')) {
      button.setAttribute('aria-pressed', String(button.dataset.group === this.#group));
    }

    const cellFor = (letter) => {
      const strength = strengthOf(this.#progress[letterKey(letter)]);
      return (
            `<button class="cell" data-glyph="${letter.glyph}" style="--strength:${strength}">` +
            `<span class="glyph">${letter.glyph}${set.cased && letter.pair ? `<i>${letter.pair}</i>` : ''}</span>` +
            `<span class="name">${letter.name}</span>` +
            `<span class="latin">${letter.latin || '—'}</span>` +
            (letter.example && this.#canSpeak()
              ? `<span class="hear" data-say="${letter.example.word}" role="button" tabindex="0" title="${letter.example.word}">${icon('speaker', 11)}</span>`
              : '') +
            '<span class="meter"></span>' +
            '</button>'
          );
        };

    host.innerHTML =
      `<p class="note">${script.note}</p>` +
      this.#bands()
        .map((band) => {
          const head = band.label
            ? `<div class="band"><span class="bandname">${band.label}</span><span class="bandline"></span></div>`
            : '';
          return `${head}<div class="grid">${band.letters.map(cellFor).join('')}</div>`;
        })
        .join('');
    this.#drawTally();
  }

  #showView(view) {
    this.#view = view;
    for (const button of this.$$('[data-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.view === view));
    }
    this.$('#chart').hidden = view !== 'chart';
    this.$('#practice').hidden = view !== 'practice';
    this.$('#detail').hidden = true;
    if (view === 'practice') {
      this.#run = { right: 0, wrong: 0, streak: 0, best: 0 };
      this.#drawRun();
      this.#askOne();
    } else {
      this.#drawChart();
    }
  }

  #showDetail(glyph) {
    const letter = this.#letters().find((entry) => entry.glyph === glyph);
    if (!letter) return;
    const set = setById(this.#script, this.#set);
    const record = this.#progress[letterKey(letter)] ?? {};

    this.$('#big').textContent = set.cased && letter.pair ? `${letter.glyph} ${letter.pair}` : letter.glyph;
    const say = this.$('#say');
    say.dataset.text = letter.example?.word ?? letter.glyph;
    say.hidden = !this.#canSpeak();
    const facts = [];
    if (letter.name !== letter.latin) facts.push([t('letters.name', 'Name'), letter.name]);
    facts.push([t('letters.written', 'Written'), letter.latin || t('letters.noSoundOfItsOwn', 'no sound of its own')]);
    facts.push([t('letters.sounds', 'Sounds like'), letter.sound]);
    if (letter.example) {
      facts.push([
        t('letters.example', 'Used in'),
        `${letter.example.word} · ${letter.example.say} · ${letter.example.means}`,
      ]);
    }

    this.$('#facts').innerHTML = [
      ...facts,
      [
        t('letters.yourProgress', 'Your progress'),
        record.seen
          ? t('letters.rightOfSeen', '{right} right of {seen}, {streak} in a row', {
              right: record.right ?? 0,
              seen: record.seen,
              streak: record.streak ?? 0,
            })
          : t('letters.notPractisedYet', 'not practised yet'),
      ],
    ]
      .map(([label, value]) => `<div class="fact"><span>${label}</span><b>${value}</b></div>`)
      .join('');
    this.$('#detail').hidden = false;
  }

  #widen(on) {
    const detail = this.$('#detail');
    const full = on ?? !detail.hasAttribute('data-full');
    detail.toggleAttribute('data-full', full);
    const button = this.$('#wide');
    button.innerHTML = icon(full ? 'minimize' : 'maximize', 13);
    button.title = full ? t('letters.shrinkBack', 'Back to the corner') : t('letters.fillTheApp', 'Fill the app');
  }

  #drawRun() {
    this.$('#right').textContent = String(this.#run.right);
    this.$('#wrong').textContent = String(this.#run.wrong);
    this.$('#streak').textContent = String(this.#run.streak);
    this.$('#streakpill').dataset.hot = String(this.#run.streak >= 5);
  }

  #askOne() {
    const letters = this.#letters();
    const letter = nextLetter(letters, this.#progress, this.#asked ? letterKey(this.#asked) : null);
    const setting = this.config.get('ask', 'latin');
    this.#ask = setting === 'both' ? (Math.random() < 0.5 ? 'latin' : 'glyph') : setting;
    this.#asked = letter;
    this.#answered = false;

    const set = setById(this.#script, this.#set);
    const showGlyph = this.#ask === 'latin';
    this.$('#prompt').textContent = showGlyph ? letter.glyph : letter.latin || letter.name;
    this.$('#prompt').dataset.kind = showGlyph ? 'glyph' : 'latin';
    this.$('#promptname').textContent = showGlyph
      ? t('letters.whatSoundIsThis', 'Which sound is this?')
      : t('letters.whichLetterIsThis', 'Which letter is this?');

    const options = choicesFor(letters, letter, 4);
    this.$('#choices').innerHTML = options
      .map(
        (option, at) =>
          `<button class="choice" data-answer="${option.glyph}">` +
          `<span class="key">${at + 1}</span>` +
          `<span class="face"${showGlyph ? '' : ' data-glyph'}>${showGlyph ? option.latin || option.name : option.glyph}${
            !showGlyph && set.cased && option.pair ? ` ${option.pair}` : ''
          }</span></button>`,
      )
      .join('');
    this.$('#verdict').textContent = '';
    this.$('#verdict').dataset.tone = '';
  }

  #answer(glyph) {
    if (this.#answered || !this.#asked) return;
    this.#answered = true;

    const letter = this.#asked;
    const right = glyph === letter.glyph;
    const key = letterKey(letter);
    const record = this.#progress[key] ?? { seen: 0, right: 0, wrong: 0, streak: 0 };

    record.seen += 1;
    if (right) {
      record.right += 1;
      record.streak += 1;
      this.#run.right += 1;
      this.#run.streak += 1;
      this.#run.best = Math.max(this.#run.best, this.#run.streak);
    } else {
      record.wrong += 1;
      record.streak = 0;
      this.#run.wrong += 1;
      this.#run.streak = 0;
    }
    this.#progress[key] = record;
    this.#keep();

    for (const button of this.$$('[data-answer]')) {
      const own = button.dataset.answer;
      if (own === letter.glyph) button.dataset.state = 'right';
      else if (own === glyph) button.dataset.state = 'wrong';
      button.disabled = true;
    }

    const verdict = this.$('#verdict');
    verdict.dataset.tone = right ? 'right' : 'wrong';
    verdict.textContent = right
      ? record.streak >= LEARNED_AT
        ? t('letters.learnedIt', '{glyph} is {latin} · learned', { glyph: letter.glyph, latin: letter.latin || letter.name })
        : t('letters.thatsRight', '{glyph} is {latin}', { glyph: letter.glyph, latin: letter.latin || letter.name })
      : t('letters.actually', '{glyph} is {latin}, {sound}', {
          glyph: letter.glyph,
          latin: letter.latin || letter.name,
          sound: letter.sound,
        });

    if (right && letter.example) this.#speak(letter.example.word);
    this.#drawRun();
    this.#drawTally();
    setTimeout(() => {
      if (this.#answered && this.#view === 'practice') this.#askOne();
    }, right ? 700 : 1900);
  }

  #forget() {
    for (const letter of this.#letters()) delete this.#progress[letterKey(letter)];
    this.#keep();
    this.#drawChart();
    this.#drawTally();
    toast(t('letters.setForgotten', 'This set starts from nothing again'));
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('letters.letters', 'Letters')}</div>
        <div class="hint">${t('letters.widgetBlurb', 'Learn the Greek, Cyrillic, Japanese and Chinese letters.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-letters', Letters);
