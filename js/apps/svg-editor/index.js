import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { copyText, download, debounce, formatBytes, toast } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <circle cx="60" cy="60" r="52" fill="none" stroke="#8a1c3b" stroke-width="8"/>
  <path d="M36 62l16 16 32-36" fill="none" stroke="#8a1c3b" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const sanitise = (markup) =>
  markup
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');

const round = (markup, precision) =>
  markup.replace(/-?\d*\.\d+(e-?\d+)?/g, (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? String(Number(number.toFixed(precision))) : value;
  });

const optimise = (markup, precision) =>
  round(
    markup
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\?xml[\s\S]*?\?>/g, '')
      .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
      .replace(/<(metadata|title|desc|sodipodi:namedview)[\s\S]*?<\/\1>/gi, '')
      .replace(/<(metadata|sodipodi:namedview)[^>]*\/>/gi, '')
      .replace(/\s(inkscape|sodipodi|serif|figma|sketch):[\w-]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
      .replace(/\sxmlns:(inkscape|sodipodi|serif|figma|sketch)\s*=\s*("[^"]*"|'[^']*')/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim(),
    precision,
  );

const prettify = (markup) => {
  const cleaned = markup.replace(/>\s+</g, '><').trim();
  let depth = 0;
  return cleaned
    .split(/(<[^>]+>)/)
    .filter((part) => part.trim())
    .map((part) => {
      if (!part.startsWith('<')) return '  '.repeat(depth) + part.trim();
      const closing = part.startsWith('</');
      const selfClosing = part.endsWith('/>') || /^<\?|^<!/.test(part);
      if (closing) depth = Math.max(0, depth - 1);
      const line = '  '.repeat(depth) + part;
      if (!closing && !selfClosing) depth += 1;
      return line;
    })
    .join('\n');
};

const COLOUR_PATTERN = /#[0-9a-f]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi;

const PANELS = [
  { value: 'document', label: t('svg-editor.document', 'Document') },
  { value: 'transform', label: t('svg-editor.transform', 'Transform') },
  { value: 'style', label: t('svg-editor.style', 'Style') },
  { value: 'colours', label: t('svg-editor.colours', 'Colours') },
  { value: 'layers', label: t('svg-editor.elements', 'Elements') },
];

class SvgEditor extends JGApp {
  static appId = 'svg-editor';
  static styles = [...JGApp.styles, sheet];

  #zoom = 1;
  #original = '';
  #panel = 'document';
  #history = [];
  #future = [];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-button size="sm" id="open">${t('svg-editor.open', 'Open')}</jg-button>
        <jg-button size="sm" variant="outline" id="sample">${t('svg-editor.sample', 'Sample')}</jg-button>
        <jg-button size="sm" variant="outline" id="format">${t('svg-editor.format', 'Format')}</jg-button>
        <jg-button size="sm" variant="outline" id="minify">${t('svg-editor.minify', 'Minify')}</jg-button>
        <jg-button size="sm" variant="outline" id="clean">${t('svg-editor.optimise', 'Optimise')}</jg-button>
        <jg-button size="sm" variant="ghost" id="undo">${t('svg-editor.undo', 'Undo')}</jg-button>
        <jg-button size="sm" variant="ghost" id="redo">${t('svg-editor.redo', 'Redo')}</jg-button>
        <span class="grow"></span>
        <jg-select id="bg" value="grid" size="sm" style="width:120px">
          <option value="grid">${t('svg-editor.checker', 'Checker')}</option>
          <option value="light">${t('svg-editor.light', 'Light')}</option>
          <option value="dark">${t('svg-editor.dark', 'Dark')}</option>
          <option value="accent">${t('svg-editor.accent', 'Accent')}</option>
        </jg-select>
      </div>

      <div class="split">
        <div class="pane">
          <div class="spread">
            <span class="label">${t('svg-editor.source', 'Source')}</span>
            <jg-copy from="#source" size="icon"></jg-copy>
          </div>
          <jg-code id="source" grow gutter language="svg" placeholder="${t('svg-editor.pasteSvgMarkupHere', 'Paste SVG markup here')}"></jg-code>
          <div class="drop" id="drop">${t('svg-editor.dropAnSvgFileHere', 'Drop an SVG file here')}</div>
        </div>

        <div class="pane">
          <div class="spread">
            <span class="label">${t('svg-editor.preview', 'Preview')}</span>
            <span class="row tight">
              <jg-button size="icon-sm" variant="ghost" id="out">−</jg-button>
              <span class="hint mono" id="zoom">100%</span>
              <jg-button size="icon-sm" variant="ghost" id="in">＋</jg-button>
              <jg-button size="sm" variant="ghost" id="fit">${t('svg-editor.fit', 'Fit')}</jg-button>
            </span>
          </div>
          <div class="canvas" id="canvas" data-bg="grid">
            <div class="holder" id="holder"></div>
          </div>
          <div class="stats" id="stats"></div>
        </div>
      </div>

      <div class="tools">
        <jg-tabs id="panel" full></jg-tabs>
        <div class="panel-body" id="panel-body"></div>
      </div>

      <div class="row">
        <jg-button size="sm" variant="outline" id="saveSvg">${t('svg-editor.saveSvg', 'Save SVG')}</jg-button>
        <jg-select id="scale" value="2" size="sm" style="width:110px">
          <option value="1">${t('svg-editor.png1x', 'PNG 1x')}</option><option value="2">${t('svg-editor.png2x', 'PNG 2x')}</option><option value="4">${t('svg-editor.png4x', 'PNG 4x')}</option>
        </jg-select>
        <jg-button size="sm" variant="outline" id="savePng">${t('svg-editor.savePng', 'Save PNG')}</jg-button>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="copyUri">${t('svg-editor.dataUri', 'Data URI')}</jg-button>
        <jg-button size="sm" variant="ghost" id="copyCss">CSS</jg-button>
        <jg-button size="sm" variant="ghost" id="copyJsx">${t('svg-editor.jsx', 'JSX')}</jg-button>
      </div>
    </div>`);

    const source = this.$('#source');
    this.on(source, 'input', debounce(() => this.#render(), 220));
    this.on(this.$('#bg'), 'change', (event) => {
      this.$('#canvas').dataset.bg = event.detail.value;
    });

    this.$('#panel').items = PANELS;
    this.$('#panel').value = this.#panel;
    this.on(this.$('#panel'), 'change', (event) => {
      this.#panel = event.detail.value;
      this.#renderPanel();
    });

    this.on(this.$('#sample'), 'click', () => this.#load(SAMPLE));
    this.on(this.$('#open'), 'click', () => this.#open());
    this.on(this.$('#format'), 'click', () => this.#apply(prettify(source.value)));
    this.on(this.$('#minify'), 'click', () => this.#apply(source.value.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim()));
    this.on(this.$('#clean'), 'click', () => this.#apply(optimise(source.value, this.#precision())));
    this.on(this.$('#undo'), 'click', () => this.#undo());
    this.on(this.$('#redo'), 'click', () => this.#redo());

    this.on(this.$('#in'), 'click', () => this.#setZoom(this.#zoom * 1.25));
    this.on(this.$('#out'), 'click', () => this.#setZoom(this.#zoom / 1.25));
    this.on(this.$('#fit'), 'click', () => this.#fit());

    this.on(this.$('#saveSvg'), 'click', () => download('image.svg', source.value, 'image/svg+xml'));
    this.on(this.$('#savePng'), 'click', () => this.#png());
    this.on(this.$('#copyUri'), 'click', () => copyText(this.#dataUri()));
    this.on(this.$('#copyCss'), 'click', () => copyText(`background-image: url("${this.#dataUri()}");`));
    this.on(this.$('#copyJsx'), 'click', () => copyText(this.#jsx()));

    const drop = this.$('#drop');
    this.on(drop, 'click', () => this.#open());
    this.on(drop, 'dragover', (event) => {
      event.preventDefault();
      drop.dataset.over = 'true';
    });
    this.on(drop, 'dragleave', () => {
      drop.dataset.over = 'false';
    });
    this.on(drop, 'drop', async (event) => {
      event.preventDefault();
      drop.dataset.over = 'false';
      const file = [...event.dataTransfer.files].find((item) => item.type.includes('svg') || item.name.endsWith('.svg'));
      if (file) this.#load(await file.text());
    });

    source.value = SAMPLE;
    this.#original = SAMPLE;
    this.#render();
  }

  #precision() {
    return Number(this.$('#precision')?.value ?? 2);
  }

  #load(markup) {
    this.$('#source').value = markup;
    this.#original = markup;
    this.#history = [];
    this.#future = [];
    this.#render();
  }

  #apply(markup) {
    const source = this.$('#source');
    this.#history = [...this.#history, source.value].slice(-40);
    this.#future = [];
    source.value = markup;
    this.#render();
  }

  #undo() {
    const previous = this.#history.pop();
    if (previous === undefined) return;
    this.#future.push(this.$('#source').value);
    this.$('#source').value = previous;
    this.#render();
  }

  #redo() {
    const next = this.#future.pop();
    if (next === undefined) return;
    this.#history.push(this.$('#source').value);
    this.$('#source').value = next;
    this.#render();
  }

  #open() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) this.#load(await file.text());
    };
    input.click();
  }

  #doc() {
    const parsed = new DOMParser().parseFromString(this.$('#source').value, 'image/svg+xml');
    if (parsed.querySelector('parsererror') || parsed.documentElement.nodeName.toLowerCase() !== 'svg') return null;
    return parsed;
  }

  #commit(doc, { format = true } = {}) {
    const markup = new XMLSerializer().serializeToString(doc.documentElement);
    this.#apply(format ? prettify(markup) : markup);
  }

  #box(svg) {
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const [x, y, width, height] = viewBox.trim().split(/[\s,]+/).map(Number);
      return { x, y, width, height };
    }
    const width = Number.parseFloat(svg.getAttribute('width')) || 100;
    const height = Number.parseFloat(svg.getAttribute('height')) || 100;
    return { x: 0, y: 0, width, height };
  }

  #wrap(transform) {
    const doc = this.#doc();
    if (!doc) return toast('Fix the markup first', 'error');
    const svg = doc.documentElement;
    const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', transform);
    [...svg.childNodes].forEach((node) => group.appendChild(node));
    svg.appendChild(group);
    this.#commit(doc);
  }

  #setZoom(value) {
    this.#zoom = Math.min(16, Math.max(0.05, value));
    this.$('#holder').style.transform = `scale(${this.#zoom})`;
    this.$('#zoom').textContent = `${Math.round(this.#zoom * 100)}%`;
  }

  #fit() {
    const canvas = this.$('#canvas');
    const svg = this.$('#holder svg');
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const width = box.width / this.#zoom;
    const height = box.height / this.#zoom;
    if (!width || !height) return;
    this.#setZoom(Math.min((canvas.clientWidth - 32) / width, (canvas.clientHeight - 32) / height));
  }

  #renderPanel() {
    const body = this.$('#panel-body');
    const doc = this.#doc();
    if (!doc) {
      body.innerHTML = html`<span class="hint">${t('svg-editor.fixTheMarkupToUse', 'Fix the markup to use the editing tools.')}</span>`;
      return;
    }

    const svg = doc.documentElement;
    const box = this.#box(svg);
    const panels = {
      document: () => this.#panelDocument(body, svg, box),
      transform: () => this.#panelTransform(body, box),
      style: () => this.#panelStyle(body),
      colours: () => this.#panelColours(body),
      layers: () => this.#panelLayers(body, svg),
    };
    panels[this.#panel]();
  }

  #panelDocument(body, svg, box) {
    body.innerHTML = html`
      <div class="fields">
        <jg-field label="${t('svg-editor.width', 'Width')}"><jg-input id="doc-w" value="${svg.getAttribute('width') ?? ''}" placeholder="${t('svg-editor.auto', 'auto')}"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.height', 'Height')}"><jg-input id="doc-h" value="${svg.getAttribute('height') ?? ''}" placeholder="${t('svg-editor.auto', 'auto')}"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.viewbox', 'viewBox')}"><jg-input id="doc-vb" mono value="${svg.getAttribute('viewBox') ?? `${box.x} ${box.y} ${box.width} ${box.height}`}"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.preserveaspectratio', 'preserveAspectRatio')}">
          <jg-select id="doc-par" value="${svg.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet'}">
            <option value="xMidYMid meet">${t('svg-editor.xmidymidMeet', 'xMidYMid meet')}</option>
            <option value="xMidYMid slice">${t('svg-editor.xmidymidSlice', 'xMidYMid slice')}</option>
            <option value="none">${t('svg-editor.none', 'none')}</option>
          </jg-select>
        </jg-field>
        <jg-field label="${t('svg-editor.precision', 'Precision')}"><jg-input id="precision" type="number" min="0" max="6" value="2"></jg-input></jg-field>
      </div>
      <div class="row">
        <jg-button size="sm" id="doc-apply">${t('svg-editor.apply', 'Apply')}</jg-button>
        <jg-button size="sm" variant="outline" id="doc-fit">${t('svg-editor.fitViewboxToContent', 'Fit viewBox to content')}</jg-button>
        <jg-button size="sm" variant="outline" id="doc-responsive">${t('svg-editor.makeResponsive', 'Make responsive')}</jg-button>
        <jg-button size="sm" variant="outline" id="doc-square">${t('svg-editor.squareIt', 'Square it')}</jg-button>
      </div>
      <span class="hint">${t('svg-editor.makeResponsiveDropsWidthAnd', 'Make responsive drops width and height so the SVG scales with its container.')}</span>
    `;

    this.on(this.$('#doc-apply'), 'click', () => {
      const doc = this.#doc();
      if (!doc) return;
      const node = doc.documentElement;
      const width = this.$('#doc-w').value.trim();
      const height = this.$('#doc-h').value.trim();
      width ? node.setAttribute('width', width) : node.removeAttribute('width');
      height ? node.setAttribute('height', height) : node.removeAttribute('height');
      node.setAttribute('viewBox', this.$('#doc-vb').value.trim());
      node.setAttribute('preserveAspectRatio', this.$('#doc-par').value);
      this.#commit(doc);
    });

    this.on(this.$('#doc-responsive'), 'click', () => {
      const doc = this.#doc();
      if (!doc) return;
      doc.documentElement.removeAttribute('width');
      doc.documentElement.removeAttribute('height');
      this.#commit(doc);
    });

    this.on(this.$('#doc-fit'), 'click', () => {
      const live = this.$('#holder svg');
      if (!live) return;
      try {
        const bounds = live.getBBox();
        const pad = 0;
        const doc = this.#doc();
        doc.documentElement.setAttribute(
          'viewBox',
          `${+(bounds.x - pad).toFixed(2)} ${+(bounds.y - pad).toFixed(2)} ${+(bounds.width + pad * 2).toFixed(2)} ${+(bounds.height + pad * 2).toFixed(2)}`,
        );
        this.#commit(doc);
      } catch {
        toast('Could not measure the artwork', 'error');
      }
    });

    this.on(this.$('#doc-square'), 'click', () => {
      const doc = this.#doc();
      if (!doc) return;
      const current = this.#box(doc.documentElement);
      const size = Math.max(current.width, current.height);
      const x = current.x - (size - current.width) / 2;
      const y = current.y - (size - current.height) / 2;
      doc.documentElement.setAttribute('viewBox', `${+x.toFixed(2)} ${+y.toFixed(2)} ${size} ${size}`);
      this.#commit(doc);
    });
  }

  #panelTransform(body, box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    body.innerHTML = html`
      <div class="row">
        <jg-button size="sm" variant="outline" id="rot-left">${t('svg-editor.rotate90', 'Rotate −90°')}</jg-button>
        <jg-button size="sm" variant="outline" id="rot-right">${t('svg-editor.rotate902', 'Rotate +90°')}</jg-button>
        <jg-button size="sm" variant="outline" id="flip-h">${t('svg-editor.flipHorizontal', 'Flip horizontal')}</jg-button>
        <jg-button size="sm" variant="outline" id="flip-v">${t('svg-editor.flipVertical', 'Flip vertical')}</jg-button>
      </div>
      <div class="fields">
        <jg-field label="${t('svg-editor.rotateBy', 'Rotate by')}"><jg-input id="t-angle" type="number" value="15" suffix="${t('svg-editor.deg', 'deg')}"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.scale', 'Scale')}"><jg-input id="t-scale" type="number" min="1" max="400" value="110" suffix="%"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.moveX', 'Move X')}"><jg-input id="t-x" type="number" value="0"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.moveY', 'Move Y')}"><jg-input id="t-y" type="number" value="0"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.padding', 'Padding')}"><jg-input id="t-pad" type="number" value="8"></jg-input></jg-field>
      </div>
      <div class="row">
        <jg-button size="sm" variant="outline" id="t-rotate">${t('svg-editor.rotate', 'Rotate')}</jg-button>
        <jg-button size="sm" variant="outline" id="t-scale-go">${t('svg-editor.scale', 'Scale')}</jg-button>
        <jg-button size="sm" variant="outline" id="t-move">${t('svg-editor.move', 'Move')}</jg-button>
        <jg-button size="sm" variant="outline" id="t-padding">${t('svg-editor.addPadding', 'Add padding')}</jg-button>
      </div>
      <span class="hint">
        Transforms wrap the artwork in a group. Rotating a non square canvas may crop it, so follow with
        Fit viewBox to content.
      </span>
    `;

    this.on(this.$('#rot-left'), 'click', () => this.#wrap(`rotate(-90 ${cx} ${cy})`));
    this.on(this.$('#rot-right'), 'click', () => this.#wrap(`rotate(90 ${cx} ${cy})`));
    this.on(this.$('#flip-h'), 'click', () => this.#wrap(`translate(${2 * cx} 0) scale(-1 1)`));
    this.on(this.$('#flip-v'), 'click', () => this.#wrap(`translate(0 ${2 * cy}) scale(1 -1)`));
    this.on(this.$('#t-rotate'), 'click', () => this.#wrap(`rotate(${Number(this.$('#t-angle').value)} ${cx} ${cy})`));
    this.on(this.$('#t-scale-go'), 'click', () => {
      const factor = Number(this.$('#t-scale').value) / 100;
      this.#wrap(`translate(${cx} ${cy}) scale(${factor}) translate(${-cx} ${-cy})`);
    });
    this.on(this.$('#t-move'), 'click', () =>
      this.#wrap(`translate(${Number(this.$('#t-x').value)} ${Number(this.$('#t-y').value)})`),
    );
    this.on(this.$('#t-padding'), 'click', () => {
      const pad = Number(this.$('#t-pad').value);
      const doc = this.#doc();
      if (!doc) return;
      const current = this.#box(doc.documentElement);
      doc.documentElement.setAttribute(
        'viewBox',
        `${current.x - pad} ${current.y - pad} ${current.width + pad * 2} ${current.height + pad * 2}`,
      );
      this.#commit(doc);
    });
  }

  #panelStyle(body) {
    body.innerHTML = html`
      <div class="fields">
        <jg-field label="${t('svg-editor.fill', 'Fill')}"><jg-input id="s-fill" type="color" value="#8a1c3b"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.stroke', 'Stroke')}"><jg-input id="s-stroke" type="color" value="#8a1c3b"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.strokeWidth', 'Stroke width')}"><jg-input id="s-width" type="number" min="0" step="0.5" value="2"></jg-input></jg-field>
        <jg-field label="${t('svg-editor.lineCap', 'Line cap')}">
          <jg-select id="s-cap" value="round"><option value="butt">${t('svg-editor.butt', 'butt')}</option><option value="round">${t('svg-editor.round', 'round')}</option><option value="square">${t('svg-editor.square', 'square')}</option></jg-select>
        </jg-field>
        <jg-field label="${t('svg-editor.lineJoin', 'Line join')}">
          <jg-select id="s-join" value="round"><option value="miter">${t('svg-editor.miter', 'miter')}</option><option value="round">${t('svg-editor.round', 'round')}</option><option value="bevel">${t('svg-editor.bevel', 'bevel')}</option></jg-select>
        </jg-field>
        <jg-field label="${t('svg-editor.opacity', 'Opacity')}"><jg-input id="s-opacity" type="number" min="0" max="1" step="0.05" value="1"></jg-input></jg-field>
      </div>
      <div class="row">
        <jg-button size="sm" variant="outline" id="s-apply-fill">${t('svg-editor.setFill', 'Set fill')}</jg-button>
        <jg-button size="sm" variant="outline" id="s-apply-stroke">${t('svg-editor.setStroke', 'Set stroke')}</jg-button>
        <jg-button size="sm" variant="outline" id="s-apply-width">${t('svg-editor.setStrokeWidth', 'Set stroke width')}</jg-button>
        <jg-button size="sm" variant="outline" id="s-apply-caps">${t('svg-editor.setCapsAndJoins', 'Set caps and joins')}</jg-button>
        <jg-button size="sm" variant="outline" id="s-apply-opacity">${t('svg-editor.setOpacity', 'Set opacity')}</jg-button>
      </div>
      <div class="row">
        <jg-button size="sm" variant="ghost" id="s-no-fill">${t('svg-editor.fillNone', 'Fill none')}</jg-button>
        <jg-button size="sm" variant="ghost" id="s-no-stroke">${t('svg-editor.strokeNone', 'Stroke none')}</jg-button>
        <jg-button size="sm" variant="ghost" id="s-current">${t('svg-editor.useCurrentcolor', 'Use currentColor')}</jg-button>
        <jg-button size="sm" variant="ghost" id="s-strip">${t('svg-editor.stripAllStyling', 'Strip all styling')}</jg-button>
      </div>
    `;

    const setOnShapes = (attribute, value) => {
      const doc = this.#doc();
      if (!doc) return;
      doc.documentElement.querySelectorAll('path, circle, rect, ellipse, line, polyline, polygon, text, g').forEach((node) => {
        if (value === null) node.removeAttribute(attribute);
        else node.setAttribute(attribute, value);
      });
      this.#commit(doc);
    };

    this.on(this.$('#s-apply-fill'), 'click', () => setOnShapes('fill', this.$('#s-fill').value));
    this.on(this.$('#s-apply-stroke'), 'click', () => setOnShapes('stroke', this.$('#s-stroke').value));
    this.on(this.$('#s-apply-width'), 'click', () => setOnShapes('stroke-width', this.$('#s-width').value));
    this.on(this.$('#s-apply-opacity'), 'click', () => setOnShapes('opacity', this.$('#s-opacity').value));
    this.on(this.$('#s-apply-caps'), 'click', () => {
      const doc = this.#doc();
      if (!doc) return;
      doc.documentElement.querySelectorAll('path, line, polyline, polygon, g').forEach((node) => {
        node.setAttribute('stroke-linecap', this.$('#s-cap').value);
        node.setAttribute('stroke-linejoin', this.$('#s-join').value);
      });
      this.#commit(doc);
    });
    this.on(this.$('#s-no-fill'), 'click', () => setOnShapes('fill', 'none'));
    this.on(this.$('#s-no-stroke'), 'click', () => setOnShapes('stroke', 'none'));
    this.on(this.$('#s-current'), 'click', () =>
      this.#apply(this.$('#source').value.replace(/(fill|stroke)="(?!none|transparent)[^"]*"/gi, '$1="currentColor"')),
    );
    this.on(this.$('#s-strip'), 'click', () => {
      const doc = this.#doc();
      if (!doc) return;
      doc.documentElement.querySelectorAll('*').forEach((node) => {
        ['style', 'class', 'opacity', 'fill-opacity', 'stroke-opacity'].forEach((attribute) => node.removeAttribute(attribute));
      });
      this.#commit(doc);
    });
  }

  #panelColours(body) {
    const markup = this.$('#source').value;
    const counts = new Map();
    (markup.match(COLOUR_PATTERN) ?? []).forEach((value) => {
      const key = value.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    body.innerHTML = counts.size
      ? html`
          <div class="colours">
            ${[...counts.entries()].map(
              ([colour, count]) => html`<span class="colour">
                <input class="chip" type="color" data-colour="${colour}" value="${/^#[0-9a-f]{6}$/i.test(colour) ? colour : '#000000'}" />
                <span>${colour}</span>
                <span class="count">×${count}</span>
              </span>`,
            )}
          </div>
          <span class="hint">${t('svg-editor.changingASwatchReplacesEvery', 'Changing a swatch replaces every use of that colour in the document.')}</span>
        `
      : html`<span class="hint">${t('svg-editor.noLiteralColoursFoundThe', 'No literal colours found. The artwork may inherit currentColor or use gradients.')}</span>`;

    this.$$('[data-colour]').forEach((input) =>
      this.on(input, 'change', () => {
        const from = input.dataset.colour;
        const to = input.value;
        const pattern = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        this.#apply(this.$('#source').value.replace(pattern, to));
      }),
    );
  }

  #panelLayers(body, svg) {
    const children = [...svg.children].filter((node) => !['defs', 'metadata', 'title', 'desc'].includes(node.nodeName.toLowerCase()));

    body.innerHTML = children.length
      ? html`<div class="layers">
          ${children.map((node, index) => {
            const fill = node.getAttribute('fill') ?? node.getAttribute('stroke') ?? 'transparent';
            const label = node.nodeName + (node.getAttribute('id') ? `#${node.getAttribute('id')}` : '');
            return html`<div class="layer" data-index="${index}" data-hidden="${String(node.getAttribute('display') === 'none')}">
              <span class="swatch" style="background:${fill === 'none' ? 'transparent' : fill}"></span>
              <span class="name">${label}</span>
              <span class="acts">
                <jg-button size="icon-sm" variant="ghost" data-toggle="${index}" title="${t('svg-editor.showOrHide', 'Show or hide')}">◎</jg-button>
                <jg-button size="icon-sm" variant="ghost" data-up="${index}" title="${t('svg-editor.moveUp', 'Move up')}">↑</jg-button>
                <jg-button size="icon-sm" variant="ghost" data-down="${index}" title="${t('svg-editor.moveDown', 'Move down')}">↓</jg-button>
                <jg-button size="icon-sm" variant="ghost" data-dup="${index}" title="${t('svg-editor.duplicate', 'Duplicate')}">⧉</jg-button>
                <jg-button size="icon-sm" variant="destructive" data-del="${index}" title="${t('svg-editor.delete', 'Delete')}">✕</jg-button>
              </span>
            </div>`;
          })}
        </div>`
      : html`<span class="hint">${t('svg-editor.thisDocumentHasNoTop', 'This document has no top level shapes.')}</span>`;

    const withChild = (index, work) => {
      const doc = this.#doc();
      if (!doc) return;
      const nodes = [...doc.documentElement.children].filter(
        (node) => !['defs', 'metadata', 'title', 'desc'].includes(node.nodeName.toLowerCase()),
      );
      const node = nodes[index];
      if (!node) return;
      work(node, doc);
      this.#commit(doc);
    };

    this.bind('[data-toggle]', 'click', (event) =>
      withChild(Number(event.currentTarget.dataset.toggle), (node) => {
        if (node.getAttribute('display') === 'none') node.removeAttribute('display');
        else node.setAttribute('display', 'none');
      }),
    );
    this.bind('[data-up]', 'click', (event) =>
      withChild(Number(event.currentTarget.dataset.up), (node) => {
        if (node.previousElementSibling) node.parentNode.insertBefore(node, node.previousElementSibling);
      }),
    );
    this.bind('[data-down]', 'click', (event) =>
      withChild(Number(event.currentTarget.dataset.down), (node) => {
        if (node.nextElementSibling) node.parentNode.insertBefore(node.nextElementSibling, node);
      }),
    );
    this.bind('[data-dup]', 'click', (event) =>
      withChild(Number(event.currentTarget.dataset.dup), (node) => {
        node.parentNode.insertBefore(node.cloneNode(true), node.nextSibling);
      }),
    );
    this.bind('[data-del]', 'click', (event) =>
      withChild(Number(event.currentTarget.dataset.del), (node) => node.remove()),
    );
  }

  #dataUri() {
    return `data:image/svg+xml;utf8,${encodeURIComponent(this.$('#source').value.replace(/\s+/g, ' ').trim())}`;
  }

  #jsx() {
    return this.$('#source').value
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/([a-z]+)-([a-z])/g, (match, first, second) =>
        ['data', 'aria'].includes(first) ? match : `${first}${second.toUpperCase()}`,
      )
      .replace(/class=/g, 'className=')
      .replace(/xmlns:xlink=/g, 'xmlnsXlink=');
  }

  #render() {
    const markup = this.$('#source').value;
    const holder = this.$('#holder');

    if (!markup.trim()) {
      holder.innerHTML = '';
      this.$('#stats').innerHTML = '';
      this.#renderPanel();
      return;
    }

    const doc = this.#doc();
    if (!doc) {
      holder.innerHTML = html`<div class="broken">${t('svg-editor.thatIsNotValidSvg', 'That is not valid SVG markup.')}</div>`;
      this.$('#stats').innerHTML = '';
      this.#renderPanel();
      return;
    }

    holder.innerHTML = sanitise(markup);

    const svg = holder.querySelector('svg');
    const elements = doc.documentElement.querySelectorAll('*').length;
    const paths = doc.documentElement.querySelectorAll('path').length;
    const viewBox = svg?.getAttribute('viewBox') ?? '-';
    const bytes = new TextEncoder().encode(markup).length;
    const originalBytes = this.#original ? new TextEncoder().encode(this.#original).length : bytes;
    const saved = originalBytes && bytes < originalBytes ? Math.round((1 - bytes / originalBytes) * 100) : 0;

    this.$('#stats').innerHTML = html`
      <div class="stat"><div class="n">${formatBytes(bytes)}</div><div class="l">${saved ? `${saved}% smaller` : 'Size'}</div></div>
      <div class="stat"><div class="n">${elements}</div><div class="l">${t('svg-editor.elements', 'Elements')}</div></div>
      <div class="stat"><div class="n">${paths}</div><div class="l">${t('svg-editor.paths', 'Paths')}</div></div>
      <div class="stat"><div class="n mono" style="font-size:11px">${viewBox}</div><div class="l">${t('svg-editor.viewbox', 'viewBox')}</div></div>
    `;

    this.#renderPanel();
  }

  #png() {
    const markup = this.$('#source').value;
    const scale = Number(this.$('#scale').value);
    const svg = this.$('#holder svg');
    if (!svg) return;

    const box = svg.viewBox?.baseVal;
    const width = (box?.width || svg.clientWidth || 512) * scale;
    const height = (box?.height || svg.clientHeight || 512) * scale;

    const image = new Image();
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        download(`image@${scale}x.png`, blob, 'image/png');
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      toast('Could not rasterise that SVG', 'error');
    };
    image.src = url;
  }
}

define('jg-app-svg-editor', SvgEditor);
