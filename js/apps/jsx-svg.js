import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 820px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .preview {
    display: grid;
    place-items: center;
    min-height: 170px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background:
      repeating-conic-gradient(color-mix(in srgb, var(--muted) 70%, transparent) 0% 25%, transparent 0% 50%) 50% / 16px 16px;
  }
  .preview svg { max-width: 100%; max-height: 200px; }
`;

const SAMPLE_JSX = `export const Check = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.8}
    strokeLinecap="round"
    className="icon"
    {...props}
  >
    <path d="M20 6 9 17l-5-5" stroke="currentColor" />
  </svg>
);`;

const ATTRIBUTE_EXCEPTIONS = {
  classname: 'class',
  htmlfor: 'for',
  xmlnsxlink: 'xmlns:xlink',
  xlinkhref: 'xlink:href',
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio',
  gradientunits: 'gradientUnits',
  gradienttransform: 'gradientTransform',
  patternunits: 'patternUnits',
  clippath: 'clip-path',
  clippathunits: 'clipPathUnits',
  maskunits: 'maskUnits',
  spreadmethod: 'spreadMethod',
  stopcolor: 'stop-color',
  stopopacity: 'stop-opacity',
  textanchor: 'text-anchor',
  dominantbaseline: 'dominant-baseline',
};

const KEEP_CAMEL = new Set([
  'viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits',
  'patternContentUnits', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'spreadMethod',
  'startOffset', 'baseFrequency', 'numOctaves', 'stdDeviation', 'refX', 'refY', 'markerWidth',
  'markerHeight', 'markerUnits', 'textLength', 'lengthAdjust', 'pathLength', 'requiredExtensions',
  'systemLanguage', 'filterUnits', 'primitiveUnits', 'diffuseConstant', 'surfaceScale',
]);

const toSvg = (source) => {
  const opening = source.indexOf('<svg');
  const closing = source.lastIndexOf('</svg>');
  let markup = opening >= 0 && closing > opening ? source.slice(opening, closing + 6) : source;

  markup = markup
    .replace(/\{\s*\.\.\.[^}]*\}/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(\w[\w:-]*)=\{`([^`]*)`\}/g, '$1="$2"')
    .replace(/(\w[\w:-]*)=\{'([^']*)'\}/g, '$1="$2"')
    .replace(/(\w[\w:-]*)=\{"([^"]*)"\}/g, '$1="$2"')
    .replace(/(\w[\w:-]*)=\{([-\d.]+)\}/g, '$1="$2"')
    .replace(/\s*\w[\w:-]*=\{[^}]*\}/g, '')
    .replace(/\sstyle="[^"]*"/g, '');

  markup = markup.replace(/(\s)([A-Za-z][A-Za-z0-9]*)=/g, (match, space, name) => {
    const lower = name.toLowerCase();
    if (ATTRIBUTE_EXCEPTIONS[lower]) return `${space}${ATTRIBUTE_EXCEPTIONS[lower]}=`;
    if (KEEP_CAMEL.has(name)) return match;
    if (/^(data|aria)[A-Z]/.test(name)) return `${space}${name.replace(/([A-Z])/g, '-$1').toLowerCase()}=`;
    if (/[A-Z]/.test(name)) return `${space}${name.replace(/([A-Z])/g, '-$1').toLowerCase()}=`;
    return match;
  });

  if (!/xmlns=/.test(markup)) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

  return markup.replace(/\n\s*\n/g, '\n').trim();
};

const toJsx = (markup, componentName) => {
  let body = markup
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  body = body.replace(/(\s)([a-z][\w:-]*)=/gi, (match, space, name) => {
    if (name === 'class') return `${space}className=`;
    if (name === 'for') return `${space}htmlFor=`;
    if (name === 'xmlns:xlink') return `${space}xmlnsXlink=`;
    if (name === 'xlink:href') return `${space}xlinkHref=`;
    if (KEEP_CAMEL.has(name)) return match;
    if (name.includes('-') && !/^(data|aria)-/.test(name)) {
      return `${space}${name.replace(/-([a-z])/g, (item, letter) => letter.toUpperCase())}=`;
    }
    return match;
  });

  body = body.replace(/<svg([^>]*)>/, (match, attributes) => `<svg${attributes} {...props}>`);
  const indented = body.split('\n').map((line) => `    ${line}`).join('\n');

  return `export const ${componentName} = (props) => (\n${indented}\n);\n`;
};

class JsxSvg extends JGApp {
  static appId = 'jsx-svg';
  static styles = [...JGApp.styles, sheet];

  #direction = 'to-svg';

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="direction"></jg-tabs>
        <span class="grow"></span>
        <jg-input id="name" value="Icon" size="sm" style="width:150px" placeholder="Component name"></jg-input>
        <jg-button size="sm" variant="outline" id="sample">Sample</jg-button>
        <jg-button size="sm" variant="outline" id="copy">Copy result</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label" id="inlabel">JSX component</span>
          <jg-code id="input" rows="14" gutter language="jsx" placeholder="Paste a React SVG component"></jg-code>
        </div>
        <div class="pane">
          <span class="label" id="outlabel">SVG markup</span>
          <jg-code id="output" rows="14" gutter language="svg" readonly></jg-code>
          <div class="preview" id="preview"></div>
        </div>
      </div>

      <div class="hint">
        Spread props, expression attributes and inline style objects are dropped when converting to SVG, since
        they have no static equivalent.
      </div>
    </div>`);

    this.$('#direction').items = [
      { value: 'to-svg', label: 'JSX to SVG' },
      { value: 'to-jsx', label: 'SVG to JSX' },
    ];
    this.$('#direction').value = this.#direction;

    this.on(this.$('#direction'), 'change', (event) => {
      this.#direction = event.detail.value;
      this.$('#inlabel').textContent = this.#direction === 'to-svg' ? 'JSX component' : 'SVG markup';
      this.$('#outlabel').textContent = this.#direction === 'to-svg' ? 'SVG markup' : 'JSX component';
      this.$('#input').value = '';
      this.#run();
    });

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 200));
    this.on(this.$('#name'), 'input', debounce(() => this.#run(), 200));
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#output').value));
    this.on(this.$('#sample'), 'click', () => {
      this.$('#input').value =
        this.#direction === 'to-svg'
          ? SAMPLE_JSX
          : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" class="icon">\n  <path d="M20 6 9 17l-5-5" stroke="currentColor"/>\n</svg>';
      this.#run();
    });

    this.$('#input').value = SAMPLE_JSX;
    this.#run();
  }

  #run() {
    const source = this.$('#input').value;
    const preview = this.$('#preview');

    if (!source.trim()) {
      this.$('#output').value = '';
      preview.innerHTML = '';
      return;
    }

    const svg = this.#direction === 'to-svg' ? toSvg(source) : source;
    this.$('#output').value =
      this.#direction === 'to-svg' ? svg : toJsx(source, this.$('#name').value.trim() || 'Icon');

    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    preview.innerHTML = parsed.querySelector('parsererror')
      ? '<span class="hint">Preview unavailable for this input.</span>'
      : svg.replace(/<script[\s\S]*?<\/script>/gi, '');
  }
}

define('jg-app-jsx-svg', JsxSvg);
