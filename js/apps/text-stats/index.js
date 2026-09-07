import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { debounce } from '../../core/util.js';

const t = await appWords('text-stats', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const analyse = (text) => {
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((part) => part.trim());
  const paragraphs = text.split(/\n\s*\n/).filter((part) => part.trim());
  const lines = text ? text.split('\n') : [];
  const letters = text.replace(/[^\p{L}]/gu, '').length;
  const syllables = words.reduce((total, word) => {
    const groups = word.toLowerCase().match(/[aeiouy]+/g);
    return total + Math.max(1, groups ? groups.length : 1);
  }, 0);

  const readingEase =
    words.length && sentences.length
      ? 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)
      : 0;

  return {
    characters: [...text].length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words: words.length,
    unique: new Set(words.map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))).size,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    lines: lines.length,
    letters,
    bytes: new TextEncoder().encode(text).length,
    readingTime: Math.max(words.length ? 1 : 0, Math.round(words.length / 200)),
    speakingTime: Math.max(words.length ? 1 : 0, Math.round(words.length / 130)),
    longest: words.reduce((best, word) => (word.length > best.length ? word : best), ''),
    averageWord: words.length ? (letters / words.length).toFixed(1) : '0',
    readingEase: Math.max(0, Math.min(100, Math.round(readingEase))),
    frequency: Object.entries(
      words.reduce((map, word) => {
        const key = word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');
        if (key.length > 2) map[key] = (map[key] ?? 0) + 1;
        return map;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
  };
};

class TextStats extends JGApp {
  static appId = 'text-stats';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="${t('text-stats.text', 'Text')}">
        <jg-textarea id="input" rows="7" sans placeholder="${t('text-stats.pasteOrWriteTextTo', 'Paste or write text to analyse')}"></jg-textarea>
      </jg-field>

      <div class="tiles" id="tiles"></div>

      <jg-card title="${t('text-stats.readability', 'Readability')}">
        <div class="kv" id="readability"></div>
      </jg-card>

      <jg-card title="${t('text-stats.mostFrequentWords', 'Most frequent words')}">
        <div class="bars" id="frequency"></div>
      </jg-card>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 160));
    this.#run();
  }

  #run() {
    const stats = analyse(this.$('#input').value);
    const tiles = [
      ['Characters', stats.characters],
      ['Without spaces', stats.charactersNoSpaces],
      ['Words', stats.words],
      ['Unique words', stats.unique],
      ['Sentences', stats.sentences],
      ['Paragraphs', stats.paragraphs],
      ['Lines', stats.lines],
      ['Bytes (UTF-8)', stats.bytes],
    ];

    this.$('#tiles').innerHTML = tiles
      .map(([name, value]) => html`<div class="tile"><span class="value">${value.toLocaleString()}</span><span class="name">${name}</span></div>`)
      .join('');

    const grade =
      stats.readingEase >= 80 ? 'Very easy' : stats.readingEase >= 60 ? 'Plain English' : stats.readingEase >= 40 ? 'Fairly difficult' : 'Difficult';

    this.$('#readability').innerHTML = html`
      <div>${t('text-stats.readingTime', 'Reading time')}</div><div>${stats.readingTime} min at 200 wpm</div>
      <div>${t('text-stats.speakingTime', 'Speaking time')}</div><div>${stats.speakingTime} min at 130 wpm</div>
      <div>${t('text-stats.fleschReadingEase', 'Flesch reading ease')}</div><div>${stats.readingEase} - ${grade}</div>
      <div>${t('text-stats.averageWordLength', 'Average word length')}</div><div>${stats.averageWord} letters</div>
      <div>${t('text-stats.longestWord', 'Longest word')}</div><div class="mono">${stats.longest || '-'}</div>
    `;

    const top = stats.frequency[0]?.[1] ?? 1;
    this.$('#frequency').innerHTML = stats.frequency.length
      ? stats.frequency
          .map(
            ([word, count]) => html`<div class="bar">
              <span class="mono">${word}</span>
              <span class="track"><i style="width:${(count / top) * 100}%"></i></span>
              <span class="num">${count}</span>
            </div>`,
          )
          .join('')
      : html`<span class="hint">${t('text-stats.notEnoughTextYet', 'Not enough text yet.')}</span>`;
  }
}

define('jg-app-text-stats', TextStats);
