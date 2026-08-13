import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, download } from '../core/util.js';

const sheet = css`
  .out {
    flex: none;
    margin: 0;
    padding: 14px;
    min-height: 180px;
    max-height: 420px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 45%, transparent);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1;
    white-space: pre;
    scrollbar-width: thin;
  }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
  .drop {
    display: grid;
    place-items: center;
    flex: none;
    min-height: 120px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    color: var(--muted-foreground);
    font-size: 13px;
    cursor: pointer;
  }
  .drop[data-over="true"] { border-color: var(--ring); color: var(--foreground); }
`;

const GLYPHS = {
  A: '.###.|#...#|#####|#...#|#...#',
  B: '####.|#...#|####.|#...#|####.',
  C: '.####|#....|#....|#....|.####',
  D: '####.|#...#|#...#|#...#|####.',
  E: '#####|#....|####.|#....|#####',
  F: '#####|#....|####.|#....|#....',
  G: '.####|#....|#..##|#...#|.###.',
  H: '#...#|#...#|#####|#...#|#...#',
  I: '#####|..#..|..#..|..#..|#####',
  J: '####.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|###..|#..#.|#...#',
  L: '#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#',
  O: '.###.|#...#|#...#|#...#|.###.',
  P: '####.|#...#|####.|#....|#....',
  Q: '.###.|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|####.|#..#.|#...#',
  S: '.####|#....|.###.|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#.#.#|##.##|#...#',
  X: '#...#|.#.#.|..#..|.#.#.|#...#',
  Y: '#...#|.#.#.|..#..|..#..|..#..',
  Z: '#####|...#.|..#..|.#...|#####',
  0: '.###.|#..##|#.#.#|##..#|.###.',
  1: '..#..|.##..|..#..|..#..|.###.',
  2: '.###.|#...#|..##.|.#...|#####',
  3: '####.|....#|.###.|....#|####.',
  4: '#..#.|#..#.|#####|...#.|...#.',
  5: '#####|#....|####.|....#|####.',
  6: '.###.|#....|####.|#...#|.###.',
  7: '#####|....#|...#.|..#..|..#..',
  8: '.###.|#...#|.###.|#...#|.###.',
  9: '.###.|#...#|.####|....#|.###.',
  ' ': '.....|.....|.....|.....|.....',
  '!': '..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|..##.|.....|..#..',
  '.': '.....|.....|.....|.....|..#..',
  ',': '.....|.....|.....|..#..|.#...',
  '-': '.....|.....|#####|.....|.....',
  '+': '.....|..#..|#####|..#..|.....',
  ':': '.....|..#..|.....|..#..|.....',
  '/': '....#|...#.|..#..|.#...|#....',
  "'": '..#..|..#..|.....|.....|.....',
};

const ROWS = 5;
const RAMPS = {
  standard: '@%#*+=-:. ',
  blocks: '█▓▒░ ',
  simple: '#+-. ',
  binary: '10 ',
};

const SHADES = ['▓', '▒', '░'];

const matrix = (text, spacing) => {
  const letters = [...text.toUpperCase()].map((character) => (GLYPHS[character] ?? GLYPHS['?']).split('|'));
  if (!letters.length) return [];
  return Array.from({ length: ROWS }, (item, row) =>
    [...letters.map((glyph) => glyph[row]).join('.'.repeat(spacing))].map((cell) => cell === '#'),
  );
};

const render = (cells) =>
  cells
    .map((line) => line.join('').replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');

const banner = (text, { fill, style, spacing, depth }) => {
  const grid = matrix(text, spacing);
  if (!grid.length) return '';

  const width = grid[0].length;
  const at = (row, column) => Boolean(grid[row]?.[column]);
  const face = fill.repeat(2);

  if (style === '3d') {
    const height = ROWS + depth;
    const cells = Array.from({ length: height }, () => Array.from({ length: width + depth }, () => '  '));

    for (let step = depth; step >= 1; step -= 1) {
      const shade = SHADES[Math.min(SHADES.length - 1, step - 1)].repeat(2);
      for (let row = 0; row < ROWS; row += 1) {
        for (let column = 0; column < width; column += 1) {
          if (at(row, column)) cells[row + depth - step][column + step] = shade;
        }
      }
    }

    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < width; column += 1) {
        if (at(row, column)) cells[row + depth][column] = face;
      }
    }

    return render(cells);
  }

  return render(
    grid.map((line, row) =>
      line.map((on, column) => {
        if (style === 'outline') {
          const inside = at(row - 1, column) && at(row + 1, column) && at(row, column - 1) && at(row, column + 1);
          return on && !inside ? face : '  ';
        }
        if (style === 'shadow') {
          if (on) return face;
          return at(row - 1, column - 1) ? '░░' : '  ';
        }
        return on ? face : '  ';
      }),
    ),
  );
};

const toAscii = (image, { columns, ramp, invert, contrast }) => {
  const width = Math.max(8, Math.min(300, columns));
  const height = Math.max(1, Math.round((image.height / image.width) * width * 0.5));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const characters = RAMPS[ramp] ?? RAMPS.standard;

  let out = '';
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3] / 255;
      const luma = (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
      const adjusted = Math.min(1, Math.max(0, (luma - 0.5) * contrast + 0.5)) * alpha + (1 - alpha);
      const level = invert ? 1 - adjusted : adjusted;
      out += characters[Math.min(characters.length - 1, Math.floor(level * characters.length))];
    }
    out += '\n';
  }
  return out.trimEnd();
};

class AsciiArt extends JGApp {
  static appId = 'ascii-art';
  static styles = [...JGApp.styles, sheet];

  #mode = 'banner';
  #image = null;

  renderApp() {
    this.paint(html`<div class="app">
      <jg-tabs id="mode"></jg-tabs>

      <div id="banner-panel" class="stack tight">
        <jg-field label="Text"><jg-input id="text" value="TOOLBOX" placeholder="TOOLBOX"></jg-input></jg-field>
        <div class="fields">
          <jg-field label="Style">
            <jg-select id="style" value="solid">
              <option value="solid">Solid</option>
              <option value="outline">Outline</option>
              <option value="shadow">Shadow</option>
              <option value="3d">3D extrude</option>
            </jg-select>
          </jg-field>
          <jg-field label="Depth" id="depthfield" hidden><jg-slider id="depth" min="1" max="4" value="2"></jg-slider></jg-field>
          <jg-field label="Character">
            <jg-select id="fill" value="█">
              <option value="█">Block</option>
              <option value="#">Hash</option>
              <option value="*">Star</option>
              <option value="@">At</option>
              <option value="▓">Shade</option>
            </jg-select>
          </jg-field>
          <jg-field label="Letter spacing"><jg-slider id="spacing" min="1" max="4" value="1"></jg-slider></jg-field>
        </div>
      </div>

      <div id="image-panel" class="stack tight" hidden>
        <div class="drop" id="drop">Drop an image here, or click to choose one</div>
        <div class="fields">
          <jg-field label="Columns"><jg-slider id="columns" min="20" max="220" value="100"></jg-slider></jg-field>
          <jg-field label="Contrast"><jg-slider id="contrast" min="5" max="30" value="10"></jg-slider></jg-field>
          <jg-field label="Ramp">
            <jg-select id="ramp" value="standard">
              ${Object.keys(RAMPS).map((key) => html`<option value="${key}">${key}</option>`)}
            </jg-select>
          </jg-field>
          <jg-field label="Invert" row><jg-switch id="invert"></jg-switch></jg-field>
        </div>
      </div>

      <pre class="out" id="out"></pre>

      <div class="row">
        <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
        <jg-button size="sm" variant="ghost" id="save">Download .txt</jg-button>
        <span class="grow"></span>
        <span class="hint" id="size"></span>
      </div>

      <input type="file" id="file" accept="image/*" hidden />
    </div>`);

    this.$('#mode').items = [
      { value: 'banner', label: 'Text banner' },
      { value: 'image', label: 'Image to ASCII' },
    ];
    this.$('#mode').value = this.#mode;

    this.on(this.$('#mode'), 'change', (event) => {
      this.#mode = event.detail.value;
      this.$('#banner-panel').hidden = this.#mode !== 'banner';
      this.$('#image-panel').hidden = this.#mode !== 'image';
      this.#paint();
    });

    const run = debounce(() => this.#paint(), 120);
    this.on(this.$('#text'), 'input', run);
    ['#style', '#fill', '#ramp'].forEach((selector) => this.on(this.$(selector), 'change', run));
    ['#spacing', '#columns', '#contrast', '#depth'].forEach((selector) => this.on(this.$(selector), 'input', run));
    this.on(this.$('#invert'), 'change', run);

    const file = this.$('#file');
    const drop = this.$('#drop');
    this.on(drop, 'click', () => file.click());
    this.on(file, 'change', () => this.#load(file.files[0]));
    this.on(drop, 'dragover', (event) => {
      event.preventDefault();
      drop.dataset.over = 'true';
    });
    this.on(drop, 'dragleave', () => {
      drop.dataset.over = 'false';
    });
    this.on(drop, 'drop', (event) => {
      event.preventDefault();
      drop.dataset.over = 'false';
      this.#load(event.dataTransfer.files[0]);
    });

    this.on(this.$('#copy'), 'click', () => copyText(this.$('#out').textContent));
    this.on(this.$('#save'), 'click', () => download('ascii-art.txt', this.$('#out').textContent, 'text/plain'));

    this.#paint();
  }

  #load(blob) {
    if (!blob || !blob.type.startsWith('image/')) return;
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      this.#image = image;
      this.$('#drop').textContent = `${blob.name} - ${image.width} x ${image.height}`;
      URL.revokeObjectURL(url);
      this.#paint();
    };
    image.src = url;
  }

  #paint() {
    const out = this.$('#out');

    if (this.#mode === 'banner') {
      const style = this.$('#style').value;
      this.$('#depthfield').hidden = style !== '3d';
      out.textContent = banner(this.$('#text').value || 'TOOLBOX', {
        fill: this.$('#fill').value,
        style,
        spacing: Number(this.$('#spacing').value),
        depth: Number(this.$('#depth').value),
      });
    } else if (this.#image) {
      out.textContent = toAscii(this.#image, {
        columns: Number(this.$('#columns').value),
        ramp: this.$('#ramp').value,
        invert: this.$('#invert').checked,
        contrast: Number(this.$('#contrast').value) / 10,
      });
    } else {
      out.textContent = '';
    }

    const text = out.textContent;
    this.$('#size').textContent = text ? `${text.split('\n').length} lines - ${text.length} characters` : '';
  }
}

define('jg-app-ascii-art', AsciiArt);
