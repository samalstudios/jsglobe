import { JGApp, define, html, css } from '../core/app.js';
import { copyText, randomInt } from '../core/util.js';

const sheet = css`
  .out { line-height: 1.75; white-space: pre-wrap; }
`;

const WORDS = `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna
aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure
in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt
culpa qui officia deserunt mollit anim id est laborum perspiciatis unde omnis iste natus error voluptatem accusantium
doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis quasi architecto beatae vitae dicta`
  .split(/\s+/)
  .filter(Boolean);

const sentence = (min = 6, max = 16) => {
  const length = min + randomInt(max - min + 1);
  const words = Array.from({ length }, () => WORDS[randomInt(WORDS.length)]);
  const text = words.join(' ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
};

const paragraph = (sentences = 5) => Array.from({ length: sentences }, () => sentence()).join(' ');

class LoremIpsum extends JGApp {
  static appId = 'lorem-ipsum';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="kind"></jg-tabs>
        <span class="grow"></span>
        <jg-input id="count" type="number" min="1" max="100" value="3" suffix="qty" style="width:120px"></jg-input>
        <jg-button id="generate">Generate</jg-button>
      </div>

      <div class="row">
        <jg-switch id="classic" checked></jg-switch><span class="hint">Start with "Lorem ipsum dolor sit amet"</span>
        <jg-switch id="html"></jg-switch><span class="hint">Wrap in HTML tags</span>
      </div>

      <jg-field label="Output" grow>
        <div slot="action" class="row tight">
          <span class="hint" id="stats"></span>
          <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
        </div>
        <jg-textarea id="out" grow sans class="out"></jg-textarea>
      </jg-field>
    </div>`);

    this.$('#kind').items = [
      { value: 'paragraphs', label: 'Paragraphs' },
      { value: 'sentences', label: 'Sentences' },
      { value: 'words', label: 'Words' },
      { value: 'list', label: 'List items' },
    ];

    this.on(this.$('#generate'), 'click', () => this.#run());
    ['#kind', '#classic', '#html'].forEach((selector) => this.on(this.$(selector), 'change', () => this.#run()));
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#out').value));
    this.#run();
  }

  #run() {
    const kind = this.$('#kind').value;
    const count = Math.min(100, Math.max(1, Number(this.$('#count').value) || 1));
    const wrap = this.$('#html').checked;
    let blocks = [];

    if (kind === 'paragraphs') blocks = Array.from({ length: count }, () => paragraph(4 + randomInt(3)));
    if (kind === 'sentences') blocks = Array.from({ length: count }, () => sentence());
    if (kind === 'words') blocks = [Array.from({ length: count }, () => WORDS[randomInt(WORDS.length)]).join(' ')];
    if (kind === 'list') blocks = Array.from({ length: count }, () => sentence(3, 8).replace(/\.$/, ''));

    if (this.$('#classic').checked && blocks.length) {
      blocks[0] = `Lorem ipsum dolor sit amet, ${blocks[0][0].toLowerCase()}${blocks[0].slice(1)}`;
    }

    let text;
    if (!wrap) {
      text = blocks.join(kind === 'paragraphs' ? '\n\n' : kind === 'list' ? '\n' : ' ');
    } else if (kind === 'list') {
      text = `<ul>\n${blocks.map((item) => `  <li>${item}</li>`).join('\n')}\n</ul>`;
    } else {
      text = blocks.map((block) => `<p>${block}</p>`).join('\n');
    }

    this.$('#out').value = text;
    this.$('#stats').textContent = `${text.split(/\s+/).filter(Boolean).length} words · ${text.length} characters`;
  }
}

define('jg-app-lorem', LoremIpsum);
