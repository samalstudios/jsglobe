import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { words, titleCase, debounce } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const CASES = [
  { id: 'camel', label: t('case-converter.camelcase', 'camelCase'), fn: (parts) => parts.map((word, index) => (index ? titleCase(word) : word.toLowerCase())).join('') },
  { id: 'pascal', label: t('case-converter.pascalcase', 'PascalCase'), fn: (parts) => parts.map((word) => titleCase(word)).join('') },
  { id: 'snake', label: t('case-converter.snakeCase', 'snake_case'), fn: (parts) => parts.map((word) => word.toLowerCase()).join('_') },
  { id: 'constant', label: t('case-converter.constantCase', 'CONSTANT_CASE'), fn: (parts) => parts.map((word) => word.toUpperCase()).join('_') },
  { id: 'kebab', label: t('case-converter.kebabCase', 'kebab-case'), fn: (parts) => parts.map((word) => word.toLowerCase()).join('-') },
  { id: 'train', label: t('case-converter.trainCase', 'Train-Case'), fn: (parts) => parts.map((word) => titleCase(word)).join('-') },
  { id: 'dot', label: t('case-converter.dotCase', 'dot.case'), fn: (parts) => parts.map((word) => word.toLowerCase()).join('.') },
  { id: 'path', label: t('case-converter.pathCase', 'path/case'), fn: (parts) => parts.map((word) => word.toLowerCase()).join('/') },
  { id: 'sentence', label: t('case-converter.sentenceCase', 'Sentence case'), fn: (parts) => {
    const joined = parts.map((word) => word.toLowerCase()).join(' ');
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  } },
  { id: 'title', label: t('case-converter.titleCase', 'Title Case'), fn: (parts) => parts.map((word) => titleCase(word)).join(' ') },
  { id: 'lower', label: t('case-converter.lowerCase', 'lower case'), fn: (parts) => parts.map((word) => word.toLowerCase()).join(' ') },
  { id: 'upper', label: t('case-converter.upperCase', 'UPPER CASE'), fn: (parts) => parts.map((word) => word.toUpperCase()).join(' ') },
];

class CaseConverter extends JGApp {
  static appId = 'case-converter';
  static styles = [...JGApp.styles, sheet];

  tools() {
    return [
      {
        name: 'convert_case',
        description: `Rewrite text in another case: ${CASES.map((entry) => entry.id).join(', ')}`,
        params: {
          text: { type: 'string', description: 'The text to rewrite', required: true },
          style: { type: 'string', description: 'Which case to use, such as camel, snake, kebab or title', required: true },
        },
        run: ({ text, style }) => {
          const wanted = CASES.find((entry) => entry.id === String(style).toLowerCase());
          if (!wanted) return `Unknown case. Try one of: ${CASES.map((entry) => entry.id).join(', ')}`;
          return wanted.fn(words(text));
        },
      },
    ];
  }

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="${t('case-converter.input', 'Input')}" hint="${t('case-converter.anySeparatorWorksSpacesDashes', 'Any separator works - spaces, dashes, underscores or camel humps')}">
        <jg-textarea id="input" rows="3" sans placeholder="${t('case-converter.helloWorldExample', 'hello world example')}"></jg-textarea>
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
