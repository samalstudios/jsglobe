import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { escapeHtml } from '../../core/dom.js';
import { debounce } from '../../core/util.js';

const t = await appWords('regex-tester', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const FLAGS = [
  ['g', 'global'],
  ['i', 'ignore case'],
  ['m', 'multiline'],
  ['s', 'dot matches newline'],
  ['u', 'unicode'],
  ['y', 'sticky'],
];

const CHEATS = [
  ['\\d', 'digit'], ['\\w', 'word character'], ['\\s', 'whitespace'], ['.', 'any character'],
  ['^', 'start of input'], ['$', 'end of input'], ['\\b', 'word boundary'], ['[abc]', 'character set'],
  ['a|b', 'alternation'], ['a*', 'zero or more'], ['a+', 'one or more'], ['a?', 'optional'],
  ['a{2,4}', 'quantifier'], ['(x)', 'capture group'], ['(?:x)', 'non-capturing'], ['(?<n>x)', 'named group'],
  ['(?=x)', 'lookahead'], ['(?<=x)', 'lookbehind'],
];

class RegexTester extends JGApp {
  static appId = 'regex-tester';
  static styles = [...JGApp.styles, sheet];

  #flags = new Set(['g']);

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="${t('regex-tester.pattern', 'Pattern')}">
        <div class="row nowrap">
          <span class="mono muted">/</span>
          <jg-input id="pattern" class="grow" mono value="(\\w+)@(\\w+)\\.(com|dev|io)"></jg-input>
          <span class="mono muted">/</span>
          <span class="mono muted" id="flagview">g</span>
        </div>
      </jg-field>

      <div class="flags">
        ${FLAGS.map(
          (flag) => html`<button class="flag" data-flag="${flag[0]}" aria-pressed="${String(this.#flags.has(flag[0]))}" title="${flag[1]}">
            ${flag[0]}
          </button>`,
        )}
      </div>

      <jg-field label="${t('regex-tester.testString', 'Test string')}">
        <jg-textarea id="subject" rows="5">${t('regex-tester.contactAdaExampleComOr', 'Contact ada@example.com or grace@jsglobe.dev for access. Invalid: nobody@localhost')}</jg-textarea>
      </jg-field>

      <div class="spread"><span class="label">${t('regex-tester.highlighted', 'Highlighted')}</span><span class="hint" id="summary"></span></div>
      <div class="subject" id="preview"></div>

      <jg-card title="${t('regex-tester.matches', 'Matches')}">
        <div class="matches" id="matches"></div>
      </jg-card>

      <jg-card title="${t('regex-tester.cheatSheet', 'Cheat sheet')}">
        <div class="cheats">
          ${CHEATS.map((cheat) => html`<div class="cheat"><code>${cheat[0]}</code><span class="muted">${cheat[1]}</span></div>`)}
        </div>
      </jg-card>
    </div>`);

    const run = debounce(() => this.#run(), 130);
    this.on(this.$('#pattern'), 'input', run);
    this.on(this.$('#subject'), 'input', run);
    this.bind('.flag', 'click', (event) => {
      const flag = event.currentTarget.dataset.flag;
      if (this.#flags.has(flag)) this.#flags.delete(flag);
      else this.#flags.add(flag);
      event.currentTarget.setAttribute('aria-pressed', String(this.#flags.has(flag)));
      this.#run();
    });

    this.$('#subject').value = 'Contact ada@example.com or grace@jsglobe.dev for access. Invalid: nobody@localhost';
    this.#run();
  }

  #run() {
    const source = this.$('#pattern').value;
    const subject = this.$('#subject').value;
    const flags = [...this.#flags].join('');
    this.$('#flagview').textContent = flags || '-';

    const summary = this.$('#summary');
    const preview = this.$('#preview');
    const matches = this.$('#matches');

    if (!source) {
      summary.textContent = 'Enter a pattern';
      preview.textContent = subject;
      matches.innerHTML = '';
      return;
    }

    let expression;
    try {
      expression = new RegExp(source, flags.includes('g') ? flags : `${flags}g`);
    } catch (error) {
      summary.innerHTML = html`<span class="error">${error.message}</span>`;
      preview.textContent = subject;
      matches.innerHTML = '';
      return;
    }

    const found = [...subject.matchAll(expression)];
    summary.textContent = `${found.length} match${found.length === 1 ? '' : 'es'}`;

    let cursor = 0;
    let markup = '';
    found.forEach((match) => {
      if (match.index === undefined) return;
      markup += escapeHtml(subject.slice(cursor, match.index));
      markup += `<mark>${escapeHtml(match[0])}</mark>`;
      cursor = match.index + match[0].length;
    });
    markup += escapeHtml(subject.slice(cursor));
    preview.innerHTML = markup || escapeHtml(subject);

    matches.innerHTML = found.length
      ? found
          .map(
            (match, index) => html`<div class="match">
              <div><span class="idx">#${index + 1} at ${match.index}</span> <span class="mono">${match[0]}</span></div>
              <div class="groups">
                ${match.slice(1).map((group, position) => html`<jg-badge mono>$${position + 1}: ${group ?? '-'}</jg-badge>`)}
                ${Object.entries(match.groups ?? {}).map(([name, value]) => html`<jg-badge mono tone="accent">${name}: ${value ?? '-'}</jg-badge>`)}
              </div>
            </div>`,
          )
          .join('')
      : html`<div class="match muted">${t('regex-tester.noMatches', 'No matches')}</div>`;
  }
}

define('jg-app-regex', RegexTester);
