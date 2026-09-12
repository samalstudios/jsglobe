import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { copyText, debounce, download, formatBytes, toast } from '../../core/util.js';
import { DEFAULT_THRESHOLD, borderColour, guessMode, statsOf, toPath, toSvg, traceImage } from '../../lib/trace.js';

const t = await appWords('png-outline', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

// Pictures are traced at no more than this on their longest side, and the
// outline scaled back up. Tracing a phone photo at full size would take a
// second on every move of a slider, for a difference nobody could see.
const WORKING = 1400;

const SETTINGS = { specks: 24, holes: false, offset: 0, tolerance: 0.8, smooth: true, style: 'outline', colour: '#e11d48' };

const hex = ({ r, g, b }) => `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;

/** A picture's pixels at tracing size, from a file or a data URL. */
const readPicture = async (source) => {
  let bitmap;
  if (typeof source === 'string') {
    // Waited for with onload rather than decode(), which can hang for as long
    // as the page is hidden; an assistant calling from a background tab would
    // have waited for ever.
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('That picture could not be read'));
      image.src = source;
    });
    bitmap = await createImageBitmap(image);
  } else {
    bitmap = await createImageBitmap(source);
  }
  const shrink = Math.min(1, WORKING / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * shrink));
  const height = Math.max(1, Math.round(bitmap.height * shrink));
  // A new canvas is clear, and stays clear wherever the picture is: a PNG's
  // transparency comes through as transparency, not as black.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  const picture = {
    pixels: context.getImageData(0, 0, width, height),
    width: bitmap.width,
    height: bitmap.height,
    scale: bitmap.width / width,
  };
  bitmap.close?.();
  return picture;
};

const dataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

class PngOutline extends JGApp {
  static appId = 'png-outline';
  static styles = [...JGApp.styles, sheet];

  #picture = null;
  #background = null;
  #result = null;
  // the picture as a data URL, made the first time it is put in a file
  #embedded = null;
  // what is on screen and not worth remembering between visits
  #live = { mode: 'alpha', threshold: DEFAULT_THRESHOLD.alpha, width: 2, include: false };
  #settings = { ...SETTINGS };
  #fit = () => {};

  tools() {
    return [
      {
        name: 'trace_outline',
        description: 'Trace the outline of a picture into an SVG. The picture is read in the page and never uploaded.',
        params: {
          image: { type: 'string', description: 'The picture as a data URL, such as data:image/png;base64,...', required: true },
          subject: {
            type: 'string',
            description: 'What to trace: alpha for where it is not transparent, dark, light, or colour for what differs from the background. Guessed when left out.',
          },
          threshold: { type: 'number', description: 'Where the subject starts, from 1 to 254' },
          offset: { type: 'number', description: 'Grow the outline outwards by this many pixels, or shrink it when negative' },
          smooth: { type: 'boolean', description: 'Draw curves rather than straight segments' },
          filled: { type: 'boolean', description: 'Fill the shape rather than draw its outline' },
        },
        run: async ({ image, subject, threshold, offset = 0, smooth = true, filled = false }) => {
          try {
            const picture = await readPicture(image);
            const result = traceImage(picture.pixels, {
              mode: subject,
              threshold,
              offset,
              specks: SETTINGS.specks * picture.scale ** 2,
              tolerance: SETTINGS.tolerance * picture.scale,
              scale: picture.scale,
            });
            return toSvg(
              { ...result, width: picture.width, height: picture.height },
              {
                style: filled ? 'filled' : 'outline',
                smooth,
                strokeWidth: Math.max(2, Math.round(Math.max(picture.width, picture.height) / 400)),
              },
            );
          } catch (failure) {
            return `Could not trace that picture: ${failure.message}`;
          }
        },
      },
    ];
  }

  renderApp() {
    this.#settings = { ...SETTINGS, ...(this.store.read({}) ?? {}) };
    if (!(this.#settings.tolerance >= 0 && this.#settings.tolerance <= 4)) this.#settings.tolerance = SETTINGS.tolerance;
    const settings = this.#settings;
    const live = this.#live;

    this.paint(html`<div class="app" tabindex="-1">
      <section class="stage">
        <div class="board" id="board">
          <jg-drop
            id="drop"
            icon="image"
            accept="image/*,.png,.webp,.gif,.avif"
            label="${t('png-outline.dropAPicture', 'Drop a picture here, or click to choose one')}"
            hint="${t('png-outline.dropHint', 'A PNG with a transparent background works best. You can paste one too. Nothing leaves this device.')}"
          ></jg-drop>
          <div class="view" id="view" hidden>
            <img id="picture" alt="" draggable="false" />
            <div class="overlay" id="overlay"></div>
          </div>
        </div>
        <div class="stats" id="stats"></div>
      </section>

      <aside class="panel">
        <div class="group">${t('png-outline.whatToTrace', 'What to trace')}</div>
        <jg-field label="${t('png-outline.pictureSubject', 'Picture subject')}">
          <jg-select id="mode" value="${live.mode}">
            <option value="alpha">${t('png-outline.transparency', 'Where it is not transparent')}</option>
            <option value="dark">${t('png-outline.darkParts', 'The dark parts')}</option>
            <option value="light">${t('png-outline.lightParts', 'The light parts')}</option>
            <option value="colour">${t('png-outline.differsFromBackground', 'What differs from the background')}</option>
          </jg-select>
        </jg-field>
        <div class="backdrop" id="backdrop" hidden>
          <span class="swatch" id="swatch"></span>
          <code id="swatchValue"></code>
          <span>${t('png-outline.pickBackground', 'Click the picture to pick the background colour')}</span>
        </div>
        <jg-field label="${t('png-outline.threshold', 'Threshold')}" hint="${t('png-outline.thresholdHint', 'Where the subject starts')}">
          <jg-slider id="threshold" min="1" max="254" value="${live.threshold}"></jg-slider>
        </jg-field>

        <div class="group">${t('png-outline.tidying', 'Tidying')}</div>
        <jg-field label="${t('png-outline.ignoreSpecks', 'Ignore specks smaller than')}">
          <jg-slider id="specks" min="0" max="400" value="${settings.specks}"></jg-slider>
        </jg-field>
        <label class="toggle">
          <jg-switch id="holes" ${settings.holes ? 'checked' : ''}></jg-switch>
          <span>${t('png-outline.fillHoles', 'Fill holes')}</span>
        </label>
        <jg-field
          label="${t('png-outline.offset', 'Offset')}"
          hint="${t('png-outline.offsetHint', 'Grow the outline outwards, or shrink it with a negative value')}"
        >
          <jg-slider id="offset" min="-20" max="60" value="${settings.offset}"></jg-slider>
        </jg-field>

        <div class="group">${t('png-outline.shape', 'Shape')}</div>
        <jg-field label="${t('png-outline.simplify', 'Simplify')}">
          <jg-slider id="tolerance" min="0" max="4" step="0.1" value="${settings.tolerance}"></jg-slider>
        </jg-field>
        <label class="toggle">
          <jg-switch id="smooth" ${settings.smooth ? 'checked' : ''}></jg-switch>
          <span>${t('png-outline.smoothCurves', 'Smooth curves')}</span>
        </label>

        <div class="group">${t('png-outline.output', 'Output')}</div>
        <jg-field label="${t('png-outline.style', 'Style')}">
          <jg-select id="style" value="${settings.style}">
            <option value="outline">${t('png-outline.outline', 'Outline')}</option>
            <option value="filled">${t('png-outline.filledShape', 'Filled shape')}</option>
          </jg-select>
        </jg-field>
        <div class="pair">
          <jg-field label="${t('png-outline.colour', 'Colour')}">
            <jg-color-picker id="colour" value="${settings.colour}" label="${t('png-outline.pickColour', 'Pick a colour')}"></jg-color-picker>
          </jg-field>
          <jg-field id="widthField" label="${t('png-outline.lineWidth', 'Line width')}">
            <jg-slider id="width" min="1" max="40" value="${live.width}"></jg-slider>
          </jg-field>
        </div>
        <label class="toggle">
          <jg-switch id="include" ${live.include ? 'checked' : ''}></jg-switch>
          <span>${t('png-outline.includePicture', 'Include the picture')}</span>
        </label>

        <div class="actions">
          <jg-button id="save" disabled>${t('png-outline.saveSvg', 'Save SVG')}</jg-button>
          <jg-button id="copy" variant="outline" disabled>${t('png-outline.copySvg', 'Copy SVG')}</jg-button>
          <jg-button id="copyPath" variant="outline" disabled>${t('png-outline.copyPath', 'Copy path')}</jg-button>
          <jg-button id="open" variant="ghost">${t('png-outline.openAnother', 'Open another')}</jg-button>
        </div>
      </aside>
    </div>`);

    const root = this.$('.app');
    // focus follows a click, so a paste lands here and not in another window
    this.on(root, 'pointerdown', () => root.focus({ preventScroll: true }));
    this.on(document, 'paste', (event) => {
      if (!event.composedPath().includes(this)) return;
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      this.#open(file);
    });

    this.on(this.$('#drop'), 'drop:files', (event) => this.#open(event.detail.file));
    this.on(this.$('#drop'), 'drop:reject', () => this.#unreadable());
    this.on(this.$('#open'), 'click', () => this.#pick());
    this.on(this.$('#picture'), 'click', (event) => this.#pickBackground(event));

    const retrace = debounce(() => this.#trace(), 70);
    for (const id of ['threshold', 'specks', 'offset', 'tolerance']) {
      this.on(this.$(`#${id}`), 'input', () => retrace());
      this.on(this.$(`#${id}`), 'change', () => {
        this.#trace();
        this.#remember();
      });
    }
    this.on(this.$('#mode'), 'change', () => {
      this.$('#threshold').value = DEFAULT_THRESHOLD[this.$('#mode').value];
      this.#modeFields();
      this.#trace();
    });
    this.on(this.$('#holes'), 'change', () => {
      this.#trace();
      this.#remember();
    });
    for (const id of ['smooth', 'style', 'colour']) {
      this.on(this.$(`#${id}`), 'change', () => {
        this.#styleFields();
        this.#draw();
        this.#remember();
      });
    }
    this.on(this.$('#width'), 'input', () => {
      this.#live.width = Number(this.$('#width').value);
      this.#draw();
    });
    this.on(this.$('#include'), 'change', async () => {
      this.#live.include = this.$('#include').checked;
      if (this.#live.include && this.#picture && !this.#embedded) this.#embedded = await dataUrl(this.#picture.file);
      this.#draw();
    });

    this.on(this.$('#save'), 'click', async () => {
      if (!this.#result) return;
      download(`${this.#picture.name}-outline.svg`, await this.#svg(), 'image/svg+xml');
    });
    this.on(this.$('#copy'), 'click', async () => {
      if (this.#result) await copyText(await this.#svg());
    });
    this.on(this.$('#copyPath'), 'click', async () => {
      if (this.#result) await copyText(toPath(this.#result.rings, { smooth: this.$('#smooth').checked }));
    });

    const board = this.$('#board');
    this.#fit = () => {
      if (!this.#picture) return;
      const room = board.getBoundingClientRect();
      const { width, height } = this.#picture;
      // a small icon is shown larger so its outline can be seen, but only so far
      const zoom = Math.min(8, (room.width - 40) / width, (room.height - 40) / height);
      const view = this.$('#view');
      view.style.width = `${Math.max(1, width * zoom)}px`;
      view.style.height = `${Math.max(1, height * zoom)}px`;
      view.dataset.pixelated = String(zoom > 2);
    };
    const watch = new ResizeObserver(() => this.#fit());
    watch.observe(board);
    this.keep(() => watch.disconnect());

    this.#styleFields();
    // a change of language paints the app afresh; what was open stays open
    if (this.#picture) this.#show();
  }

  #pick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => this.#open(input.files?.[0]);
    input.click();
  }

  #unreadable() {
    toast(t('png-outline.notAPicture', 'That file could not be read as a picture'), 'error');
  }

  async #open(file) {
    if (!file) return;
    let picture;
    try {
      picture = await readPicture(file);
    } catch {
      this.#unreadable();
      return;
    }
    if (this.#picture?.url) URL.revokeObjectURL(this.#picture.url);
    this.#picture = {
      ...picture,
      file,
      name: (file.name ?? '').replace(/\.[^.]+$/, '') || 'picture',
      url: URL.createObjectURL(file),
    };
    this.#embedded = this.#live.include ? await dataUrl(file) : null;
    this.#background = borderColour(picture.pixels);
    const mode = guessMode(picture.pixels);
    this.#live.mode = mode;
    this.#live.threshold = DEFAULT_THRESHOLD[mode];
    this.#live.width = Math.max(2, Math.round(Math.max(picture.width, picture.height) / 400));
    this.$('#mode').value = mode;
    this.$('#threshold').value = this.#live.threshold;
    this.$('#width').value = this.#live.width;
    this.#show();
  }

  #show() {
    this.$('#picture').src = this.#picture.url;
    this.$('#drop').hidden = true;
    this.$('#view').hidden = false;
    this.#fit();
    this.#modeFields();
    this.#trace();
  }

  #trace() {
    const picture = this.#picture;
    if (!picture) return;
    const { scale } = picture;
    this.#live.mode = this.$('#mode').value;
    this.#live.threshold = Number(this.$('#threshold').value);
    const result = traceImage(picture.pixels, {
      mode: this.#live.mode,
      threshold: this.#live.threshold,
      background: this.#background ?? undefined,
      // specks and simplifying are measured on the traced picture, so they
      // behave the same whatever size the original was
      specks: Number(this.$('#specks').value) * scale * scale,
      fillHoles: this.$('#holes').checked,
      offset: Number(this.$('#offset').value),
      tolerance: Number(this.$('#tolerance').value) * scale,
      scale,
    });
    this.#result = { ...result, width: picture.width, height: picture.height };
    this.#draw();
  }

  #look() {
    const colour = this.$('#colour').value;
    return {
      style: this.$('#style').value,
      stroke: colour,
      fill: colour,
      strokeWidth: Number(this.$('#width').value),
      smooth: this.$('#smooth').checked,
    };
  }

  async #svg() {
    const look = this.#look();
    if (this.$('#include').checked) {
      this.#embedded ??= await dataUrl(this.#picture.file);
      look.picture = this.#embedded;
    }
    return toSvg(this.#result, look);
  }

  #draw() {
    const result = this.#result;
    const ready = Boolean(result?.rings.length);
    for (const id of ['save', 'copy', 'copyPath']) this.$(`#${id}`).toggleAttribute('disabled', !ready);
    if (!result) return;

    // the preview is the file itself, laid over the picture in the same units
    const markup = toSvg(result, this.#look());
    const overlay = this.$('#overlay');
    overlay.innerHTML = markup;
    const [left, top, wide, tall] = (markup.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 1 1').split(' ').map(Number);
    const { width, height } = this.#picture;
    Object.assign(overlay.style, {
      left: `${(left / width) * 100}%`,
      top: `${(top / height) * 100}%`,
      width: `${(wide / width) * 100}%`,
      height: `${(tall / height) * 100}%`,
    });

    if (!ready) {
      this.$('#stats').textContent = t('png-outline.nothingFound', 'Nothing to trace. Try another subject or threshold.');
      return;
    }
    const { shapes, holes, points } = statsOf(result.rings);
    const size = markup.length + (this.$('#include').checked && this.#embedded ? this.#embedded.length : 0);
    this.$('#stats').textContent = [
      `${t('png-outline.shapes', 'Shapes')} ${shapes}`,
      `${t('png-outline.holes', 'Holes')} ${holes}`,
      `${t('png-outline.points', 'Points')} ${points}`,
      `${width} × ${height} px`,
      formatBytes(size),
    ].join(' · ');
  }

  #pickBackground(event) {
    if (this.$('#mode').value !== 'colour' || !this.#picture) return;
    const box = event.currentTarget.getBoundingClientRect();
    const { pixels } = this.#picture;
    const x = Math.min(pixels.width - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * pixels.width)));
    const y = Math.min(pixels.height - 1, Math.max(0, Math.floor(((event.clientY - box.top) / box.height) * pixels.height)));
    const at = (y * pixels.width + x) * 4;
    this.#background = { r: pixels.data[at], g: pixels.data[at + 1], b: pixels.data[at + 2], a: pixels.data[at + 3] };
    this.#modeFields();
    this.#trace();
  }

  #modeFields() {
    const picking = this.$('#mode').value === 'colour';
    this.$('#backdrop').hidden = !picking;
    this.$('#view').dataset.picking = String(picking);
    if (!this.#background) return;
    // the code beside the swatch, so a white background reads as a colour and
    // not as an empty box
    this.$('#swatch').style.background = hex(this.#background);
    this.$('#swatchValue').textContent = hex(this.#background);
  }

  #styleFields() {
    this.$('#widthField').hidden = this.$('#style').value === 'filled';
  }

  #remember() {
    this.store.write({
      specks: Number(this.$('#specks').value),
      holes: this.$('#holes').checked,
      offset: Number(this.$('#offset').value),
      tolerance: Number(this.$('#tolerance').value),
      smooth: this.$('#smooth').checked,
      style: this.$('#style').value,
      colour: this.$('#colour').value,
    });
  }
}

define('jg-app-png-outline', PngOutline);
