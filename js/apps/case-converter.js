import { JGApp, define, html, css } from '../core/app.js';
import { words, titleCase, debounce } from '../core/util.js';

const sheet = css`
  .cases { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; }
  .case { display: flex; flex-direction: column; gap: 4px; }
`;

const CASES = [
  { id: 'camel', label: 'camelCase', fn: (parts) => parts.map((word, index) => (index ? titleCase(word) : word.toLowerCase())).join('') },
  { id: 'pascal', label: 'PascalCase', fn: (parts) => parts.map((word) => titleCase(word)).join('') },
  { id: 'snake', label: 'snake_case', fn: (parts) => parts.map((word) => word.toLowerCase()).join('_') },
  { id: 'constant', label: 'CONSTANT_CASE', fn: (parts) => parts.map((word) => word.toUpperCase()).join('_') },
  { id: 'kebab', label: 'kebab-case', fn: (parts) => parts.map((word) => word.toLowerCase()).join('-') },
  { id: 'train', label: 'Train-Case', fn: (parts) => parts.map((word) => titleCase(word)).join('-') },
  { id: 'dot', label: 'dot.case', fn: (parts) => parts.map((word) => word.toLowerCase()).join('.') },
  { id: 'path', label: 'path/case', fn: (parts) => parts.map((word) => word.toLowerCase()).join('/') },
  { id: 'sentence', label: 'Sentence case', fn: (parts) => {
    const joined = parts.map((word) => word.toLowerCase()).join(' ');
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  } },
  { id: 'title', label: 'Title Case', fn: (parts) => parts.map((word) => titleCase(word)).join(' ') },
  { id: 'lower', label: 'lower case', fn: (parts) => parts.map((word) => word.toLowerCase()).join(' ') },
  { id: 'upper', label: 'UPPER CASE', fn: (parts) => parts.map((word) => word.toUpperCase()).join(' ') },
];

class CaseConverter extends JGApp {
  static appId = 'case-converter';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Input" hint="Any separator works - spaces, dashes, underscores or camel humps">
        <jg-textarea id="input" rows="3" sans placeholder="hello world example"></jg-textarea>
      </jg-field>
      <div class="cases">
        ${CASES.map(
          (item) => html`<div class="case">
            <span class="label">${item.label}</span>
            <jg-output data-case="${item.id}" placeholder="-"></jg-output>
          </div>`,
        )}
      </div>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 120));
    this.$('#input').value = 'hello world example';
    this.#run();
  }

  #run() {
    const parts = words(this.$('#input').value);
    CASES.forEach((item) => {
      const node = this.$(`[data-case="${item.id}"]`);
      node.value = parts.length ? item.fn(parts) : '';
    });
  }
}

define('jg-app-case', CaseConverter);
