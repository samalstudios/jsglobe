import { JGApp, define, html, css } from '../core/app.js';
import { copyText, debounce } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
`;

const SAMPLE =
  '<catalog><book id="1"><title>Custom Elements</title><tags><tag>web</tag><tag>js</tag></tags></book><book id="2"><title>Shadow DOM</title></book></catalog>';

const formatXml = (source, indentSize) => {
  const pad = typeof indentSize === 'string' ? indentSize : ' '.repeat(indentSize);
  const normalized = source
    .replace(/\r\n/g, '\n')
    .replace(/>\s+</g, '><')
    .trim();

  let depth = 0;
  const lines = [];
  const tokens = normalized.split(/(<[^>]+>)/).filter((token) => token.trim());

  tokens.forEach((token) => {
    if (!token.startsWith('<')) {
      lines.push(pad.repeat(depth) + token.trim());
      return;
    }
    const isClosing = /^<\//.test(token);
    const isSelfClosing = /\/>$/.test(token);
    const isDeclaration = /^<[?!]/.test(token);

    if (isClosing) depth = Math.max(0, depth - 1);
    lines.push(pad.repeat(depth) + token);
    if (!isClosing && !isSelfClosing && !isDeclaration) depth += 1;
  });

  return lines
    .join('\n')
    .replace(/(<([\w:-]+)[^>]*>)\n\s*([^<\n]+)\n\s*(<\/\2>)/g, '$1$3$4');
};

const minify = (source) => source.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();

class XmlFormatter extends JGApp {
  static appId = 'xml-formatter';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="mode"></jg-tabs>
        <jg-select id="indent" value="2" size="sm" style="width:130px">
          <option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tab</option>
        </jg-select>
        <span class="grow"></span>
        <jg-button size="sm" variant="outline" id="sample">Sample</jg-button>
        <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label">Input</span>
          <jg-textarea id="input" grow placeholder="<root><item/></root>"></jg-textarea>
        </div>
        <div class="pane">
          <div class="spread"><span class="label">Output</span><span class="hint" id="status"></span></div>
          <jg-textarea id="output" grow readonly></jg-textarea>
        </div>
      </div>
    </div>`);

    this.$('#mode').items = [
      { value: 'pretty', label: 'Format' },
      { value: 'minify', label: 'Minify' },
    ];

    const run = debounce(() => this.#run(), 150);
    this.on(this.$('#input'), 'input', run);
    this.on(this.$('#mode'), 'change', () => this.#run());
    this.on(this.$('#indent'), 'change', () => this.#run());
    this.on(this.$('#sample'), 'click', () => {
      this.$('#input').value = SAMPLE;
      this.#run();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#output').value));

    this.$('#input').value = SAMPLE;
    this.#run();
  }

  #run() {
    const source = this.$('#input').value.trim();
    const status = this.$('#status');
    const output = this.$('#output');

    if (!source) {
      output.value = '';
      status.textContent = '';
      return;
    }

    const parsed = new DOMParser().parseFromString(source, 'application/xml');
    const error = parsed.querySelector('parsererror');
    status.textContent = error ? 'Not well-formed XML - formatting anyway' : `Well-formed · ${parsed.documentElement.tagName}`;

    const indentSetting = this.$('#indent').value;
    const indent = indentSetting === 'tab' ? '\t' : Number(indentSetting);
    output.value = this.$('#mode').value === 'minify' ? minify(source) : formatXml(source, indent);
  }
}

define('jg-app-xml-formatter', XmlFormatter);
