import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { debounce } from '../../core/util.js';

const t = await appWords('list-converter', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const SORTS = {
  none: 'Keep order',
  asc: 'A to Z',
  desc: 'Z to A',
  length: 'Shortest first',
  numeric: 'Numeric',
  reverse: 'Reverse',
  shuffle: 'Shuffle',
};

class ListConverter extends JGApp {
  static appId = 'list-converter';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="grid3">
        <jg-field label="${t('list-converter.separator', 'Separator')}" hint="${t('list-converter.howTheOutputIsJoined', 'How the output is joined')}">
          <jg-select id="separator" value="\n">
            <option value="\n">${t('list-converter.newLine', 'New line')}</option>
            <option value=", ">${t('list-converter.commaAndSpace', 'Comma and space')}</option>
            <option value=",">${t('list-converter.comma', 'Comma')}</option>
            <option value=" ">${t('list-converter.space', 'Space')}</option>
            <option value=" | ">${t('list-converter.pipe', 'Pipe')}</option>
            <option value="; ">${t('list-converter.semicolon', 'Semicolon')}</option>
          </jg-select>
        </jg-field>
        <jg-field label="${t('list-converter.sort', 'Sort')}">
          <jg-select id="sort" value="none">
            ${Object.entries(SORTS).map(([key, label]) => html`<option value="${key}">${label}</option>`)}
          </jg-select>
        </jg-field>
        <jg-field label="${t('list-converter.wrapEachItem', 'Wrap each item')}" hint="Use {} for the value">
          <jg-input id="wrap" placeholder="'{}'"></jg-input>
        </jg-field>
        <jg-field label="${t('list-converter.prefix', 'Prefix')}"><jg-input id="prefix"></jg-input></jg-field>
        <jg-field label="${t('list-converter.suffix', 'Suffix')}"><jg-input id="suffix"></jg-input></jg-field>
        <jg-field label="${t('list-converter.splitInputOn', 'Split input on')}">
          <jg-select id="split" value="lines">
            <option value="lines">${t('list-converter.newLines', 'New lines')}</option>
            <option value="comma">${t('list-converter.commas', 'Commas')}</option>
            <option value="space">${t('list-converter.whitespace', 'Whitespace')}</option>
            <option value="semicolon">${t('list-converter.semicolons', 'Semicolons')}</option>
          </jg-select>
        </jg-field>
      </div>

      <div class="row">
        <jg-switch id="trim" checked></jg-switch><span class="hint">${t('list-converter.trim', 'Trim')}</span>
        <jg-switch id="dedupe"></jg-switch><span class="hint">${t('list-converter.removeDuplicates', 'Remove duplicates')}</span>
        <jg-switch id="empty" checked></jg-switch><span class="hint">${t('list-converter.dropEmptyItems', 'Drop empty items')}</span>
        <jg-switch id="lower"></jg-switch><span class="hint">${t('list-converter.lowercase', 'Lowercase')}</span>
        <jg-switch id="numbered"></jg-switch><span class="hint">${t('list-converter.numberTheItems', 'Number the items')}</span>
      </div>

      <div class="split">
        <div class="pane">
          <div class="spread"><span class="label">${t('list-converter.input', 'Input')}</span><span class="hint" id="incount"></span></div>
          <jg-textarea id="input" grow sans placeholder="${t('list-converter.oneItemPerLine', 'One item per line')}"></jg-textarea>
        </div>
        <div class="pane">
          <div class="spread">
            <span class="label">${t('list-converter.output', 'Output')}</span>
            <span class="row tight"><span class="hint" id="outcount"></span><jg-copy from="#output" size="icon"></jg-copy></span>
          </div>
          <jg-textarea id="output" grow sans></jg-textarea>
        </div>
      </div>
    </div>`);

    const run = debounce(() => this.#run(), 130);
    this.on(this.$('#input'), 'input', run);
    ['#separator', '#sort', '#split', '#trim', '#dedupe', '#empty', '#lower', '#numbered'].forEach((selector) =>
      this.on(this.$(selector), 'change', () => this.#run()),
    );
    ['#wrap', '#prefix', '#suffix'].forEach((selector) => this.on(this.$(selector), 'input', run));

    this.$('#input').value = 'banana\napple\ncherry\napple\n\ndate';
    this.#run();
  }

  #run() {
    const patterns = { lines: /\r?\n/, comma: /\s*,\s*/, space: /\s+/, semicolon: /\s*;\s*/ };
    let items = this.$('#input').value.split(patterns[this.$('#split').value]);

    if (this.$('#trim').checked) items = items.map((item) => item.trim());
    if (this.$('#empty').checked) items = items.filter((item) => item.length);
    if (this.$('#lower').checked) items = items.map((item) => item.toLowerCase());
    if (this.$('#dedupe').checked) items = [...new Set(items)];

    const sort = this.$('#sort').value;
    if (sort === 'asc') items.sort((a, b) => a.localeCompare(b));
    if (sort === 'desc') items.sort((a, b) => b.localeCompare(a));
    if (sort === 'length') items.sort((a, b) => a.length - b.length);
    if (sort === 'numeric') items.sort((a, b) => Number(a) - Number(b));
    if (sort === 'reverse') items.reverse();
    if (sort === 'shuffle') items.sort(() => Math.random() - 0.5);

    const wrap = this.$('#wrap').value;
    const prefix = this.$('#prefix').value;
    const suffix = this.$('#suffix').value;

    const formatted = items.map((item, index) => {
      let value = wrap.includes('{}') ? wrap.replace('{}', item) : `${wrap}${item}${wrap}`;
      if (!wrap) value = item;
      value = `${prefix}${value}${suffix}`;
      return this.$('#numbered').checked ? `${index + 1}. ${value}` : value;
    });

    this.$('#output').value = formatted.join(this.$('#separator').value);
    this.$('#incount').textContent = `${this.$('#input').value.split(patterns[this.$('#split').value]).length} items`;
    this.$('#outcount').textContent = `${items.length} items`;
  }
}

define('jg-app-list-converter', ListConverter);
