import { JGApp, define, html } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { debounce } from '../../core/util.js';

const t = appText(strings);

const slugify = (text, { separator = '-', lower = true, strict = true, maxLength = 0 } = {}) => {
  let out = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[đĐ]/g, 'd')
    .replace(/[ß]/g, 'ss')
    .trim();

  out = strict ? out.replace(/[^a-zA-Z0-9\s-_]/g, '') : out.replace(/[\s]+/g, ' ');
  out = out.replace(/[\s_-]+/g, separator).replace(new RegExp(`^\\${separator}+|\\${separator}+$`, 'g'), '');
  if (lower) out = out.toLowerCase();
  if (maxLength > 0) out = out.slice(0, maxLength).replace(new RegExp(`\\${separator}+$`), '');
  return out;
};

class Slugify extends JGApp {
  static appId = 'slugify';
  static styles = JGApp.styles;

  tools() {
    return [
      {
        name: 'slugify_text',
        description: 'Turn a line of text into a clean URL slug',
        params: {
          text: { type: 'string', description: 'The text to turn into a slug', required: true },
          separator: { type: 'string', description: 'What goes between words: - or _ or .' },
          lower: { type: 'boolean', description: 'Fold the slug to lower case' },
        },
        run: ({ text, separator = '-', lower = true }) => slugify(text, { separator, lower, strict: true }),
      },
    ];
  }

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="${t('slugify.text', 'Text')}">
        <jg-textarea id="input" rows="3" sans placeholder="${t('slugify.10WaysToBuildA', '10 Ways to Build a Café Menu - 2024 Edition')}"></jg-textarea>
      </jg-field>

      <div class="row">
        <jg-select id="separator" value="-" style="width:150px">
          <option value="-">${t('slugify.dash', 'Dash (-)')}</option>
          <option value="_">${t('slugify.underscore', 'Underscore (_)')}</option>
          <option value=".">${t('slugify.dot', 'Dot (.)')}</option>
        </jg-select>
        <jg-switch id="lower" checked></jg-switch><span class="hint">${t('slugify.lowercase', 'Lowercase')}</span>
        <jg-switch id="strict" checked></jg-switch><span class="hint">${t('slugify.stripSymbols', 'Strip symbols')}</span>
        <jg-input id="max" type="number" min="0" max="200" value="0" suffix="${t('slugify.max', 'max')}" style="width:120px"></jg-input>
      </div>

      <jg-field label="${t('slugify.slug', 'Slug')}"><jg-output id="out"></jg-output></jg-field>

      <jg-card title="${t('slugify.variations', 'Variations')}">
        <div class="kv" id="variations"></div>
      </jg-card>
    </div>`);

    const run = debounce(() => {
      const text = this.$('#input').value;
      const options = {
        separator: this.$('#separator').value,
        lower: this.$('#lower').checked,
        strict: this.$('#strict').checked,
        maxLength: Number(this.$('#max').value),
      };
      this.$('#out').value = slugify(text, options);
      this.$('#variations').innerHTML = html`
        <div>${t('slugify.kebab', 'Kebab')}</div><div class="mono">${slugify(text, { separator: '-' })}</div>
        <div>${t('slugify.snake', 'Snake')}</div><div class="mono">${slugify(text, { separator: '_' })}</div>
        <div>${t('slugify.dot2', 'Dot')}</div><div class="mono">${slugify(text, { separator: '.' })}</div>
        <div>${t('slugify.preservedCase', 'Preserved case')}</div><div class="mono">${slugify(text, { lower: false })}</div>
        <div>${t('slugify.length', 'Length')}</div><div class="mono">${slugify(text, options).length} characters</div>
      `;
    }, 130);

    this.on(this.$('#input'), 'input', run);
    ['#separator', '#lower', '#strict'].forEach((selector) => this.on(this.$(selector), 'change', run));
    this.on(this.$('#max'), 'input', run);
    this.$('#input').value = '10 Ways to Build a Café Menu - 2024 Edition';
    run();
  }
}

define('jg-app-slugify', Slugify);
