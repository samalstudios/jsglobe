import { JGElement, define, css, html } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { base } from './styles.js';
import './jg-lookup.js';

export const FONT_STACKS = [
  { label: 'Helvetica', value: 'Helvetica Neue, Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet', value: 'Trebuchet MS, Helvetica, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Candara, Segoe UI, sans-serif' },
  { label: 'Segoe UI', value: 'Segoe UI, system-ui, sans-serif' },
  { label: 'Optima', value: 'Optima, Candara, sans-serif' },
  { label: 'Futura', value: 'Futura, Avenir, sans-serif' },
  { label: 'Avenir', value: 'Avenir Next, Avenir, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, Times, serif' },
  { label: 'Georgia', value: 'Georgia, Times New Roman, serif' },
  { label: 'Garamond', value: 'Garamond, Baskerville, serif' },
  { label: 'Baskerville', value: 'Baskerville, Georgia, serif' },
  { label: 'Palatino', value: 'Palatino, Palatino Linotype, Book Antiqua, serif' },
  { label: 'Cambria', value: 'Cambria, Georgia, serif' },
  { label: 'Didot', value: 'Didot, Georgia, serif' },
  { label: 'Courier New', value: 'Courier New, Courier, monospace' },
  { label: 'Consolas', value: 'Consolas, Menlo, monospace' },
  { label: 'Menlo', value: 'Menlo, Monaco, monospace' },
  { label: 'Comic Sans', value: 'Comic Sans MS, cursive' },
  { label: 'Brush Script', value: 'Brush Script MT, cursive' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' },
];

const KIND = (value) =>
  /monospace/.test(value) ? 'mono' : /serif/.test(value) && !/sans-serif/.test(value) ? 'serif' : 'sans';

const sheet = css`
  :host { display: inline-block; }
  jg-lookup { width: 100%; }
`;

class JGFontSelector extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['value'];

  get value() {
    return this.getAttribute('value') ?? FONT_STACKS[0].value;
  }

  set value(next) {
    this.setAttribute('value', next ?? FONT_STACKS[0].value);
  }

  render() {
    this.paint(html`<jg-lookup id="pick" hunt="${t('font.search', 'Search fonts')}"></jg-lookup>`);
    const pick = this.$('#pick');
    pick.items = FONT_STACKS.map((font) => ({
      value: font.value,
      label: font.label,
      hint: KIND(font.value),
      style: `font-family:${font.value}`,
    }));
    pick.value = this.value;
    this.on(pick, 'change', (event) => {
      event.stopPropagation();
      this.setAttribute('value', event.detail.value);
      this.emit('change', { value: event.detail.value });
    });
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'value' && previous !== next) {
      const pick = this.$('#pick');
      if (pick) pick.value = next;
    }
  }
}

define('jg-font-selector', JGFontSelector);
