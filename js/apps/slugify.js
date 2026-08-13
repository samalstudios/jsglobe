import { JGApp, define, html } from '../core/app.js';
import { debounce } from '../core/util.js';

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

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Text">
        <jg-textarea id="input" rows="3" sans placeholder="10 Ways to Build a Café Menu - 2024 Edition"></jg-textarea>
      </jg-field>

      <div class="row">
        <jg-select id="separator" value="-" style="width:150px">
          <option value="-">Dash (-)</option>
          <option value="_">Underscore (_)</option>
          <option value=".">Dot (.)</option>
        </jg-select>
        <jg-switch id="lower" checked></jg-switch><span class="hint">Lowercase</span>
        <jg-switch id="strict" checked></jg-switch><span class="hint">Strip symbols</span>
        <jg-input id="max" type="number" min="0" max="200" value="0" suffix="max" style="width:120px"></jg-input>
      </div>

      <jg-field label="Slug"><jg-output id="out"></jg-output></jg-field>

      <jg-card title="Variations">
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
        <div>Kebab</div><div class="mono">${slugify(text, { separator: '-' })}</div>
        <div>Snake</div><div class="mono">${slugify(text, { separator: '_' })}</div>
        <div>Dot</div><div class="mono">${slugify(text, { separator: '.' })}</div>
        <div>Preserved case</div><div class="mono">${slugify(text, { lower: false })}</div>
        <div>Length</div><div class="mono">${slugify(text, options).length} characters</div>
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
