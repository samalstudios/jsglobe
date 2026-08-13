import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, toast } from '../core/util.js';

const sheet = css`
  .shell { display: grid; grid-template-columns: 186px 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 760px) { .shell { grid-template-columns: 1fr; } }
  .main { display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: 0; }
  .grid {
    flex: 1;
    min-height: 220px;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(58px, 1fr));
    gap: 4px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 40%, transparent);
    align-content: start;
    scrollbar-width: thin;
  }
  .cell {
    appearance: none;
    display: grid;
    gap: 1px;
    padding: 5px 2px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    color: var(--foreground);
  }
  .cell:hover { background: var(--card); border-color: var(--border); }
  .cell .glyph { font-size: 20px; line-height: 1.2; }
  .cell .point { font-family: var(--font-mono); font-size: 9px; color: var(--muted-foreground); }
  .detail { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); }
  .detail .big { font-size: 44px; line-height: 1; min-width: 56px; text-align: center; }
`;

const BLOCKS = [
  { id: 'ascii', label: 'Basic Latin', from: 0x20, to: 0x7e, icon: 'type' },
  { id: 'latin1', label: 'Latin-1', from: 0xa0, to: 0xff, icon: 'type' },
  { id: 'latinext', label: 'Latin Extended', from: 0x100, to: 0x17f, icon: 'type' },
  { id: 'greek', label: 'Greek', from: 0x370, to: 0x3ff, icon: 'languages' },
  { id: 'cyrillic', label: 'Cyrillic', from: 0x400, to: 0x4ff, icon: 'languages' },
  { id: 'arabic', label: 'Arabic', from: 0x600, to: 0x6ff, icon: 'languages' },
  { id: 'hebrew', label: 'Hebrew', from: 0x590, to: 0x5ff, icon: 'languages' },
  { id: 'punctuation', label: 'Punctuation', from: 0x2000, to: 0x206f, icon: 'asterisk' },
  { id: 'currency', label: 'Currency', from: 0x20a0, to: 0x20bf, icon: 'landmark' },
  { id: 'letterlike', label: 'Letterlike', from: 0x2100, to: 0x214f, icon: 'badge' },
  { id: 'arrows', label: 'Arrows', from: 0x2190, to: 0x21ff, icon: 'transform' },
  { id: 'math', label: 'Math operators', from: 0x2200, to: 0x22ff, icon: 'calculator' },
  { id: 'technical', label: 'Technical', from: 0x2300, to: 0x23ff, icon: 'gear' },
  { id: 'boxes', label: 'Box drawing', from: 0x2500, to: 0x257f, icon: 'grid' },
  { id: 'blocks', label: 'Block elements', from: 0x2580, to: 0x259f, icon: 'blocks' },
  { id: 'geometric', label: 'Geometric shapes', from: 0x25a0, to: 0x25ff, icon: 'vector' },
  { id: 'dingbats', label: 'Dingbats', from: 0x2700, to: 0x27bf, icon: 'sparkles' },
  { id: 'braille', label: 'Braille', from: 0x2800, to: 0x28ff, icon: 'binary' },
];

const CATEGORIES = [
  [0x20, 0x2f, 'punctuation or symbol'],
  [0x30, 0x39, 'digit'],
  [0x41, 0x5a, 'uppercase letter'],
  [0x61, 0x7a, 'lowercase letter'],
];

const describe = (point) => {
  const found = CATEGORIES.find(([from, to]) => point >= from && point <= to);
  if (found) return found[2];
  if (point >= 0x2190 && point <= 0x21ff) return 'arrow';
  if (point >= 0x2200 && point <= 0x22ff) return 'math operator';
  if (point >= 0x2500 && point <= 0x259f) return 'drawing element';
  if (point >= 0x2800 && point <= 0x28ff) return 'braille pattern';
  return 'symbol';
};

const utf8Bytes = (text) => [...new TextEncoder().encode(text)].map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'));

const printable = (point) => !(point >= 0x7f && point <= 0x9f) && !(point >= 0x2028 && point <= 0x202f) && !(point >= 0x2060 && point <= 0x206f);

class UnicodeTables extends JGApp {
  static appId = 'unicode-tables';
  static styles = [...JGApp.styles, sheet];

  #block = 'ascii';
  #query = '';
  #point = 65;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-input id="search" size="sm" placeholder="Search a character, U+00E9 or 233" style="flex:1;min-width:200px"></jg-input>
        <jg-button size="sm" variant="ghost" id="copy-char">Copy character</jg-button>
      </div>

      <div class="shell">
        <jg-toolbar id="blocks" variant="sidebar"></jg-toolbar>
        <div class="main">
          <div class="grid" id="grid"></div>
          <div class="detail">
            <span class="big" id="big"></span>
            <div class="kv" id="info"></div>
          </div>
        </div>
      </div>
    </div>`);

    const blocks = this.$('#blocks');
    blocks.items = BLOCKS.map((block) => ({ id: block.id, label: block.label, icon: block.icon, select: true }));
    blocks.value = this.#block;
    this.on(blocks, 'select', (event) => {
      this.#block = event.detail.id;
      this.#query = '';
      this.$('#search').value = '';
      this.#paintGrid();
    });

    this.on(this.$('#search'), 'input', debounce((event) => {
      this.#query = event.target.value.trim();
      this.#paintGrid();
    }, 140));

    this.on(this.$('#copy-char'), 'click', () => copyText(String.fromCodePoint(this.#point)));

    this.#paintGrid();
    this.#select(this.#point);
  }

  #points() {
    if (this.#query) {
      const direct = /^(u\+|0x|\\u)?([0-9a-f]{2,6})$/i.exec(this.#query);
      if (direct) return [Number.parseInt(direct[2], 16)].filter((point) => point <= 0x10ffff);
      if (/^\d+$/.test(this.#query)) return [Number(this.#query)].filter((point) => point <= 0x10ffff);
      return [...this.#query].map((character) => character.codePointAt(0));
    }
    const block = BLOCKS.find((item) => item.id === this.#block);
    const points = [];
    for (let point = block.from; point <= block.to; point += 1) if (printable(point)) points.push(point);
    return points;
  }

  #paintGrid() {
    const points = this.#points();
    this.$('#grid').innerHTML = points.length
      ? points
          .map(
            (point) => html`<button class="cell" data-point="${point}">
              <span class="glyph">${String.fromCodePoint(point)}</span>
              <span class="point">${point.toString(16).toUpperCase().padStart(4, '0')}</span>
            </button>`,
          )
          .join('')
      : html`<div class="hint" style="grid-column:1/-1;padding:12px">Nothing to show for that search.</div>`;

    this.bind('[data-point]', 'click', (event) => {
      const point = Number(event.currentTarget.dataset.point);
      this.#select(point);
      copyText(String.fromCodePoint(point));
      toast(`${String.fromCodePoint(point)} copied`);
    });

    if (points.length) this.#select(points[0]);
  }

  #select(point) {
    this.#point = point;
    const character = String.fromCodePoint(point);
    const hex = point.toString(16).toUpperCase().padStart(4, '0');

    this.$('#big').textContent = character;
    this.$('#info').innerHTML = html`
      <div>Code point</div><div class="mono">U+${hex}</div>
      <div>Decimal</div><div class="mono">${point}</div>
      <div>Kind</div><div>${describe(point)}</div>
      <div>HTML</div><div class="mono">&amp;#${point}; &nbsp; &amp;#x${hex};</div>
      <div>JavaScript</div><div class="mono">${point > 0xffff ? `\\u{${hex}}` : `\\u${hex}`}</div>
      <div>UTF-8</div><div class="mono">${utf8Bytes(character).join(' ')}</div>
      <div>URL encoded</div><div class="mono">${encodeURIComponent(character)}</div>
    `;
  }
}

define('jg-app-unicode-tables', UnicodeTables);
