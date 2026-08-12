import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .table { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px; }
  .entity {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 12px;
    cursor: pointer;
  }
  .entity:hover { border-color: var(--border-strong); }
`;

const NAMED = [
  ['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;'], ['"', '&quot;'], ["'", '&#39;'],
  [' ', '&nbsp;'], ['©', '&copy;'], ['®', '&reg;'], ['™', '&trade;'], ['€', '&euro;'],
  ['£', '&pound;'], ['°', '&deg;'], ['±', '&plusmn;'], ['×', '&times;'], ['÷', '&divide;'],
  ['-', '&mdash;'], ['-', '&ndash;'], ['...', '&hellip;'], ['«', '&laquo;'], ['»', '&raquo;'],
  ['←', '&larr;'], ['→', '&rarr;'], ['↑', '&uarr;'], ['↓', '&darr;'], ['✓', '&check;'],
];

const escapeAll = (text, mode) =>
  [...text]
    .map((char) => {
      const named = NAMED.find((pair) => pair[0] === char && char !== ' ');
      if (mode === 'named' && named) return named[1];
      if (mode === 'all' && char.codePointAt(0) > 127) return `&#${char.codePointAt(0)};`;
      if (named && '&<>"\''.includes(char)) return named[1];
      return char;
    })
    .join('');

class HtmlEntities extends JGApp {
  static appId = 'html-entities';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-segment id="mode"></jg-segment>
      </div>
      <div class="split">
        <div class="pane">
          <div class="spread"><span class="label">Plain</span><jg-copy from="#plain" size="icon"></jg-copy></div>
          <jg-textarea id="plain" grow placeholder="<div class=&quot;box&quot;>café & crème</div>"></jg-textarea>
        </div>
        <div class="pane">
          <div class="spread"><span class="label">Escaped</span><jg-copy from="#escaped" size="icon"></jg-copy></div>
          <jg-textarea id="escaped" grow placeholder="&lt;div&gt;"></jg-textarea>
        </div>
      </div>
      <jg-card title="Common entities" sub="Click to insert">
        <div class="table">
          ${NAMED.map(
            (pair) => html`<button class="entity" data-entity="${pair[1]}"><span>${pair[0]}</span><span class="muted">${pair[1]}</span></button>`,
          )}
        </div>
      </jg-card>
    </div>`);

    this.$('#mode').items = [
      { value: 'minimal', label: 'Minimal' },
      { value: 'named', label: 'Named' },
      { value: 'all', label: 'All non-ASCII' },
    ];

    const plain = this.$('#plain');
    const escaped = this.$('#escaped');

    const encode = debounce(() => {
      escaped.value = escapeAll(plain.value, this.$('#mode').value);
    }, 120);

    const decode = debounce(() => {
      const parser = document.createElement('textarea');
      parser.innerHTML = escaped.value;
      plain.value = parser.value;
    }, 120);

    this.on(plain, 'input', encode);
    this.on(escaped, 'input', decode);
    this.on(this.$('#mode'), 'change', encode);
    this.bind('.entity', 'click', (event) => {
      escaped.value += event.currentTarget.dataset.entity;
      decode();
    });

    plain.value = '<div class="box">café & crème</div>';
    encode();
  }
}

define('jg-app-html-entities', HtmlEntities);
