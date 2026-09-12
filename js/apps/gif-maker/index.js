import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { clamp, download, formatBytes, pickFiles, toast } from '../../core/util.js';
import { decodeGif, encodeGif } from '../../lib/gif.js';

const t = await appWords('gif-maker', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

// A GIF of more than a few hundred frames is rarely what anyone wants, and
// every frame is held in memory until the file is made.
const MAX_FRAMES = 300;
// frames are kept at no more than this on their longest side
const SOURCE_SIDE = 960;
const MAX_WIDTH = 960;
// Every frame of the finished GIF is held as pixels while it is made. Past
// this many pixels in all, a phone can run out of memory.
const PIXEL_BUDGET = 60_000_000;

const SETTINGS = {
  delay: 100,
  repeat: 0,
  boomerang: false,
  fit: 'contain',
  colours: 256,
  dither: true,
  transparent: true,
  background: '#ffffff',
  fps: 10,
};

let nextId = 1;

const canvasOf = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

/** A picture copied onto a canvas no larger than SOURCE_SIDE on its longest side. */
const keep = (source, width, height) => {
  const shrink = Math.min(1, SOURCE_SIDE / Math.max(width, height));
  const canvas = canvasOf(width * shrink, height * shrink);
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const frameOf = (canvas, delay = null) => ({ id: nextId++, canvas, delay, tile: null });

// Waited for with onload rather than decode(), which can hang for as long as
// the page is hidden.
const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That picture could not be read'));
    image.src = url;
  });

const isGif = (file) => file.type === 'image/gif' || /\.gif$/i.test(file.name ?? '');
const isVideo = (file) => file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name ?? '');

/** Each frame of a GIF as it looks at its moment, with its own delay. */
const gifFrames = (bytes) => {
  const { width, height, frames } = decodeGif(bytes);
  const whole = canvasOf(width, height);
  const context = whole.getContext('2d');
  return frames.map(({ data, delay }) => {
    context.putImageData(new ImageData(data, width, height), 0, 0);
    return frameOf(keep(whole, width, height), delay || null);
  });
};

const pictureFrame = async (source) => {
  const bitmap = typeof source === 'string' ? await loadImage(source) : await createImageBitmap(source);
  const canvas = keep(bitmap, bitmap.width, bitmap.height);
  bitmap.close?.();
  return frameOf(canvas);
};

const bytesOf = (url) => {
  const text = atob(url.slice(url.indexOf(',') + 1));
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
};

const framesOfUrl = async (url) => (/^data:image\/gif/i.test(url) ? gifFrames(bytesOf(url)) : [await pictureFrame(url)]);

const dataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** One frame drawn at the GIF's size, fitted inside or cropped to fill. */
const paint = (context, frame, width, height, { fit, background }) => {
  context.clearRect(0, 0, width, height);
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  const { width: wide, height: tall } = frame.canvas;
  const scale = (fit === 'cover' ? Math.max : Math.min)(width / wide, height / tall);
  // enlarged two times or more, pixel art keeps its hard edges
  context.imageSmoothingEnabled = scale < 2;
  context.imageSmoothingQuality = 'high';
  context.drawImage(frame.canvas, (width - wide * scale) / 2, (height - tall * scale) / 2, wide * scale, tall * scale);
};

/** Which frame shows when, and for how long; forwards then backwards repeats neither end. */
const orderOf = (frames, delay, boomerang) => {
  const forwards = frames.map((frame, index) => ({ index, delay: frame.delay ?? delay }));
  if (!boomerang || frames.length < 3) return forwards;
  return [...forwards, ...forwards.slice(1, -1).reverse()];
};

const pixelsOf = (frames, width, height, look) => {
  const canvas = canvasOf(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return frames.map((frame) => {
    paint(context, frame, width, height, look);
    return context.getImageData(0, 0, width, height).data;
  });
};

/**
 * Make the GIF in a worker, so a long one never freezes the page, or in the
 * page itself where a worker cannot start. `onStop` is handed a function that
 * abandons the work.
 */
const makeGif = (frames, order, width, height, look, { onProgress, onStop } = {}) =>
  new Promise((resolve, reject) => {
    const options = { repeat: look.repeat, colours: look.colours, dither: look.dither };
    const inPage = () => {
      try {
        const images = pixelsOf(frames, width, height, look);
        const list = order.map(({ index, delay }) => ({ data: images[index], delay }));
        resolve(encodeGif(list, width, height, { ...options, onProgress }));
      } catch (failure) {
        reject(failure);
      }
    };
    let worker;
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch {
      inPage();
      return;
    }
    onStop?.(() => {
      worker.terminate();
      reject(new Error('stopped'));
    });
    worker.onmessage = ({ data }) => {
      if ('progress' in data) {
        onProgress?.(data.progress);
        return;
      }
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data.bytes);
    };
    // a browser without module workers fails here rather than above
    worker.onerror = (event) => {
      event.preventDefault();
      worker.terminate();
      inPage();
    };
    const images = pixelsOf(frames, width, height, look);
    worker.postMessage({ images, order, width, height, options }, images.map((data) => data.buffer));
  });

const seekTo = (video, time) =>
  new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
      resolve();
    };
    // a seek that never reports back is not waited on for ever
    const timer = setTimeout(done, 4000);
    video.addEventListener('seeked', done);
    video.currentTime = time;
  });

const makeSlider = (id, max, value) => {
  const slider = document.createElement('jg-slider');
  slider.id = id;
  slider.setAttribute('min', '0');
  slider.setAttribute('max', String(max));
  slider.setAttribute('step', '0.1');
  slider.setAttribute('value', String(value));
  return slider;
};

const seconds = (value) => `${(Math.round(value * 10) / 10).toFixed(1)} s`;

class GifMaker extends JGApp {
  static appId = 'gif-maker';
  static styles = [...JGApp.styles, sheet];

  #frames = [];
  #selected = null;
  #settings = { ...SETTINGS };
  #name = 'animation';
  #result = null;
  #job = 0;
  #stop = null;
  #clip = null;
  #busy = false;
  #play = { on: true, step: 0, due: 0, order: [] };
  #fit = () => {};
  #dragging = null;

  tools() {
    return [
      {
        name: 'make_gif',
        description: 'Make an animated GIF from pictures. The pictures are read in the page and never uploaded. Returns the GIF as a data URL.',
        params: {
          images: {
            type: 'string',
            description: 'The frames as data URLs, in order, separated by spaces or new lines. A GIF among them adds all of its frames.',
            required: true,
          },
          delay: { type: 'number', description: 'How long each frame shows, in milliseconds. 100 is ten frames a second.' },
          width: { type: 'integer', description: 'Width of the GIF in pixels. The height follows the first frame.' },
          loop: { type: 'integer', description: 'How many times it plays: 0 for ever, 1 once' },
          colours: { type: 'integer', description: 'How many colours, from 2 to 256' },
          boomerang: { type: 'boolean', description: 'Play forwards, then backwards' },
        },
        run: async ({ images, delay = 100, width, loop = 0, colours = 256, boomerang = false }) => {
          try {
            const frames = [];
            for (const url of String(images ?? '').split(/\s+/).filter(Boolean)) frames.push(...(await framesOfUrl(url)));
            if (!frames.length) throw new Error('no pictures were given');
            const list = frames.slice(0, MAX_FRAMES);
            const first = list[0].canvas;
            const wide = Math.round(clamp(width ?? Math.min(480, first.width), 16, MAX_WIDTH));
            const tall = Math.max(1, Math.round((wide * first.height) / first.width));
            if (wide * tall * list.length > PIXEL_BUDGET) throw new Error('that is too many pixels for one GIF; ask for a smaller width');
            const bytes = await makeGif(list, orderOf(list, Math.max(20, delay), boomerang), wide, tall, {
              fit: 'contain',
              background: null,
              repeat: Math.max(0, Math.round(loop)),
              colours: clamp(Math.round(colours), 2, 256),
              dither: true,
            });
            return await dataUrl(new Blob([bytes], { type: 'image/gif' }));
          } catch (failure) {
            return `Could not make that GIF: ${failure.message}`;
          }
        },
      },
    ];
  }

  renderApp() {
    this.#settings = { ...SETTINGS, ...(this.store.read({}) ?? {}) };
    const settings = this.#settings;

    this.paint(html`<div class="app" tabindex="-1">
      <section class="stage" id="stage">
        <div class="board" id="board">
          <jg-drop
            id="drop"
            icon="image"
            multiple
            accept="image/*,video/*,.gif,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov"
            label="${t('gif-maker.dropHere', 'Drop pictures, a GIF or a video clip here, or click to choose')}"
            hint="${t('gif-maker.dropHint', 'Pictures become frames in the order they come. You can paste one too. Nothing leaves this device.')}"
          ></jg-drop>
          <div class="view" id="view" hidden>
            <canvas id="screen"></canvas>
            <img id="result" alt="" hidden />
          </div>
          <div class="clip" id="clip" hidden>
            <video id="video" muted playsinline controls preload="auto"></video>
            <div class="clip-fields">
              <jg-field label="${t('gif-maker.startsAt', 'Starts at')}" id="startField"></jg-field>
              <jg-field label="${t('gif-maker.endsAt', 'Ends at')}" id="endField"></jg-field>
              <jg-field label="${t('gif-maker.framesPerSecond', 'Frames per second')}">
                <jg-select id="fps" value="${settings.fps}">
                  ${[5, 8, 10, 12, 15, 20, 25].map((fps) => html`<option value="${fps}">${fps}</option>`)}
                </jg-select>
              </jg-field>
            </div>
            <div class="clip-foot">
              <span id="clipCount"></span>
              <jg-button id="clipCancel" variant="ghost">${t('gif-maker.cancel', 'Cancel')}</jg-button>
              <jg-button id="clipAdd">${t('gif-maker.addTheseFrames', 'Add these frames')}</jg-button>
            </div>
          </div>
        </div>
        <jg-progress id="progress" size="sm" max="100" hidden></jg-progress>
        <div class="transport" id="transport" hidden>
          <jg-button id="playing" variant="ghost" size="sm">${t('gif-maker.pause', 'Pause')}</jg-button>
          <span id="position"></span>
          <span class="stats" id="stats"></span>
        </div>
        <div class="strip" id="strip" hidden></div>
      </section>

      <aside class="panel">
        <div class="group">${t('gif-maker.timing', 'Timing')}</div>
        <jg-field
          label="${t('gif-maker.delayBetweenFrames', 'Delay between frames')}"
          hint="${t('gif-maker.delayHint', 'In milliseconds. 100 is ten frames a second.')}"
        >
          <jg-slider id="delay" min="20" max="2000" step="10" value="${settings.delay}"></jg-slider>
        </jg-field>
        <jg-field label="${t('gif-maker.loop', 'Loop')}">
          <jg-select id="repeat" value="${settings.repeat}">
            <option value="0">${t('gif-maker.forEver', 'For ever')}</option>
            <option value="1">${t('gif-maker.playOnce', 'Play once')}</option>
            <option value="2">${t('gif-maker.playTwice', 'Play twice')}</option>
            <option value="3">${t('gif-maker.playTimes', 'Play {count} times', { count: 3 })}</option>
            <option value="5">${t('gif-maker.playTimes', 'Play {count} times', { count: 5 })}</option>
          </jg-select>
        </jg-field>
        <label class="toggle">
          <jg-switch id="boomerang" ${settings.boomerang ? 'checked' : ''}></jg-switch>
          <span>${t('gif-maker.boomerang', 'Play forwards, then backwards')}</span>
        </label>

        <div class="frame-card" id="frameCard" hidden>
          <div class="group" id="frameTitle"></div>
          <jg-field label="${t('gif-maker.thisFramesDelay', 'This frame’s delay')}">
            <jg-slider id="frameDelay" min="20" max="5000" step="10" value="100"></jg-slider>
          </jg-field>
          <div class="frame-actions">
            <jg-button id="earlier" variant="outline" size="sm">${t('gif-maker.earlier', 'Earlier')}</jg-button>
            <jg-button id="later" variant="outline" size="sm">${t('gif-maker.later', 'Later')}</jg-button>
            <jg-button id="duplicate" variant="outline" size="sm">${t('gif-maker.duplicate', 'Duplicate')}</jg-button>
            <jg-button id="remove" variant="outline" size="sm">${t('gif-maker.remove', 'Remove')}</jg-button>
          </div>
          <jg-button id="sharedDelay" variant="ghost" size="sm">${t('gif-maker.useSharedDelay', 'Use the shared delay')}</jg-button>
        </div>

        <div class="group">${t('gif-maker.size', 'Size')}</div>
        <jg-field label="${t('gif-maker.width', 'Width')}" id="widthField">
          <jg-slider id="width" min="16" max="${MAX_WIDTH}" value="480"></jg-slider>
        </jg-field>
        <jg-field label="${t('gif-maker.otherShapes', 'Frames of another shape')}">
          <jg-select id="fit" value="${settings.fit}">
            <option value="contain">${t('gif-maker.fitInside', 'Fit inside')}</option>
            <option value="cover">${t('gif-maker.fillAndCrop', 'Fill and crop')}</option>
          </jg-select>
        </jg-field>

        <div class="group">${t('gif-maker.colours', 'Colours')}</div>
        <jg-field label="${t('gif-maker.howManyColours', 'How many colours')}" hint="${t('gif-maker.coloursHint', 'Fewer colours make a smaller file')}">
          <jg-slider id="colours" min="2" max="256" value="${settings.colours}"></jg-slider>
        </jg-field>
        <label class="toggle">
          <jg-switch id="dither" ${settings.dither ? 'checked' : ''}></jg-switch>
          <span>${t('gif-maker.dither', 'Smooth gradients with dithering')}</span>
        </label>
        <label class="toggle">
          <jg-switch id="transparent" ${settings.transparent ? 'checked' : ''}></jg-switch>
          <span>${t('gif-maker.keepTransparency', 'Keep transparency')}</span>
        </label>
        <jg-field id="backgroundField" label="${t('gif-maker.background', 'Background')}">
          <jg-color-picker id="background" value="${settings.background}" label="${t('gif-maker.pickColour', 'Pick a colour')}"></jg-color-picker>
        </jg-field>

        <div class="actions">
          <jg-button id="make" disabled>${t('gif-maker.makeGif', 'Make GIF')}</jg-button>
          <jg-button id="save" variant="outline" disabled>${t('gif-maker.saveGif', 'Save GIF')}</jg-button>
          <jg-button id="add" variant="outline">${t('gif-maker.addFrames', 'Add frames')}</jg-button>
          <jg-button id="reverse" variant="ghost" disabled>${t('gif-maker.reverseOrder', 'Reverse order')}</jg-button>
          <jg-button id="clear" variant="ghost" disabled>${t('gif-maker.removeAll', 'Remove all')}</jg-button>
        </div>
      </aside>
    </div>`);

    const root = this.$('.app');
    // focus follows a click, so a paste or a key lands here and not elsewhere
    this.on(root, 'pointerdown', () => root.focus({ preventScroll: true }));
    this.on(document, 'paste', (event) => {
      if (!event.composedPath().includes(this)) return;
      const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault();
      this.#add(files);
    });
    this.on(root, 'keydown', (event) => this.#key(event));

    this.on(this.$('#drop'), 'drop:files', (event) => this.#add(event.detail.files));
    this.on(this.$('#drop'), 'drop:reject', () => toast(t('gif-maker.notUsable', 'Those files are not pictures, GIFs or videos'), 'error'));
    this.on(this.$('#add'), 'click', async () => this.#add(await pickFiles('image/*,video/*,.gif')));

    // files dropped anywhere on the stage once there are frames
    const stage = this.$('#stage');
    const carriesFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');
    this.on(stage, 'dragover', (event) => {
      if (!carriesFiles(event) || !this.#frames.length) return;
      event.preventDefault();
      stage.dataset.dropping = 'true';
    });
    this.on(stage, 'dragleave', (event) => {
      if (!stage.contains(event.relatedTarget)) delete stage.dataset.dropping;
    });
    this.on(stage, 'drop', (event) => {
      delete stage.dataset.dropping;
      if (!carriesFiles(event) || !this.#frames.length) return;
      event.preventDefault();
      this.#add([...event.dataTransfer.files]);
    });

    this.#wireStrip();
    this.#wireClip();

    this.on(this.$('#playing'), 'click', () => this.#toggle());
    this.on(this.$('#make'), 'click', () => this.#make());
    this.on(this.$('#save'), 'click', () => {
      if (this.#result) download(`${this.#name}.gif`, this.#result.blob);
    });
    this.on(this.$('#reverse'), 'click', () => {
      this.#frames.reverse();
      this.#changed();
    });
    this.on(this.$('#clear'), 'click', () => {
      this.#frames = [];
      this.#selected = null;
      this.#changed();
    });

    this.on(this.$('#delay'), 'input', () => this.#changed({ strip: false }));
    this.on(this.$('#width'), 'input', () => this.#changed({ strip: false }));
    this.on(this.$('#colours'), 'change', () => this.#changed({ strip: false }));
    for (const id of ['delay', 'repeat', 'boomerang', 'fit', 'colours', 'dither', 'transparent', 'background']) {
      this.on(this.$(`#${id}`), 'change', () => {
        this.#changed({ strip: false });
        this.#remember();
      });
    }

    this.on(this.$('#frameDelay'), 'input', () => {
      const frame = this.#current();
      if (!frame) return;
      frame.delay = this.$('#frameDelay').value;
      this.#changed();
    });
    this.on(this.$('#sharedDelay'), 'click', () => {
      const frame = this.#current();
      if (!frame) return;
      frame.delay = null;
      this.#changed();
    });
    this.on(this.$('#earlier'), 'click', () => this.#shift(-1));
    this.on(this.$('#later'), 'click', () => this.#shift(1));
    this.on(this.$('#duplicate'), 'click', () => {
      const index = this.#index();
      if (index < 0 || this.#frames.length >= MAX_FRAMES) return;
      const copy = frameOf(this.#frames[index].canvas, this.#frames[index].delay);
      this.#frames.splice(index + 1, 0, copy);
      this.#selected = copy.id;
      this.#changed();
    });
    this.on(this.$('#remove'), 'click', () => this.#removeSelected());

    const board = this.$('#board');
    this.#fit = () => {
      if (!this.#frames.length) return;
      const room = board.getBoundingClientRect();
      const { width, height } = this.#size();
      // Shown at its real size where it fits, so what is seen is what is made.
      // A tiny one is enlarged by whole steps, which keeps pixel art crisp.
      const most = clamp(Math.floor(400 / Math.max(width, height)), 1, 4);
      const zoom = Math.max(0.05, Math.min(most, (room.width - 32) / width, (room.height - 32) / height));
      const view = this.$('#view');
      view.style.width = `${Math.max(1, width * zoom)}px`;
      view.style.height = `${Math.max(1, height * zoom)}px`;
      view.dataset.pixelated = String(zoom >= 2);
    };
    const watch = new ResizeObserver(() => this.#fit());
    watch.observe(board);
    this.keep(() => watch.disconnect());

    let frame = 0;
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      this.#tick(now);
    };
    frame = requestAnimationFrame(tick);
    this.keep(() => cancelAnimationFrame(frame));
    this.keep(() => this.#stop?.());

    this.#look();
    // a change of language paints the app afresh; what was open stays open
    this.#changed({ keepResult: true });
  }

  // ---- adding frames ----------------------------------------------------

  async #add(files) {
    const list = [...(files ?? [])];
    if (!list.length) return;
    const video = list.find(isVideo);
    const found = [];
    let unreadable = 0;
    for (const file of list) {
      if (file === video || isVideo(file)) continue;
      try {
        if (isGif(file)) found.push(...gifFrames(new Uint8Array(await file.arrayBuffer())));
        else found.push(await pictureFrame(file));
      } catch {
        unreadable += 1;
      }
    }
    if (unreadable) toast(t('gif-maker.someUnreadable', 'Some files could not be read as pictures'), 'error');
    if (found.length) {
      if (!this.#frames.length) this.#name = (list[0].name ?? '').replace(/\.[^.]+$/, '') || 'animation';
      this.#append(found);
    }
    if (video) this.#openClip(video);
  }

  #append(found) {
    const room = MAX_FRAMES - this.#frames.length;
    if (found.length > room) {
      toast(t('gif-maker.tooManyFrames', 'A GIF can hold {count} frames here; the rest were left out', { count: MAX_FRAMES }), 'error');
    }
    const kept = found.slice(0, Math.max(0, room));
    if (!kept.length) return;
    const empty = !this.#frames.length;
    // Frames that all share one delay, arriving on an empty strip, set the
    // shared delay rather than each carrying their own.
    const delays = new Set(kept.map((frame) => frame.delay));
    if (empty && delays.size === 1 && [...delays][0]) {
      this.$('#delay').value = clamp(Math.round([...delays][0] / 10) * 10, 20, 2000);
      this.#remember();
    }
    // a frame whose own delay is the shared one needs no delay of its own
    const shared = this.$('#delay').value;
    kept.forEach((frame) => {
      if (frame.delay === shared) frame.delay = null;
    });
    this.#frames.push(...kept);
    if (empty) {
      const { width } = kept[0].canvas;
      this.$('#width').value = Math.round(clamp(Math.min(480, width), 16, MAX_WIDTH));
    }
    this.#changed();
  }

  // ---- a video clip -----------------------------------------------------

  #wireClip() {
    const video = this.$('#video');
    this.on(this.$('#clipCancel'), 'click', () => this.#closeClip());
    this.on(this.$('#clipAdd'), 'click', () => this.#capture());
    this.on(this.$('#fps'), 'change', () => {
      this.#clipCount();
      this.#remember();
    });
    for (const id of ['startField', 'endField']) {
      this.on(this.$(`#${id}`), 'input', (event) => {
        const value = Number(event.target.value);
        if (Number.isFinite(value)) video.currentTime = value;
        this.#clipCount();
      });
    }
  }

  async #openClip(file) {
    this.#closeClip();
    const video = this.$('#video');
    const url = URL.createObjectURL(file);
    this.#clip = { url, name: (file.name ?? '').replace(/\.[^.]+$/, '') || 'clip' };
    video.src = url;
    try {
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });
    } catch {
      toast(t('gif-maker.videoUnreadable', 'This browser cannot play that video'), 'error');
      this.#closeClip();
      return;
    }
    let duration = video.duration;
    if (!Number.isFinite(duration)) {
      // A recording straight from a browser often knows nothing of its length
      // until it has been sought to the end.
      await seekTo(video, 1e7);
      duration = video.duration;
      await seekTo(video, 0);
    }
    const max = Math.round((Number.isFinite(duration) && duration > 0 ? duration : 10) * 10) / 10;
    this.$('#startField').replaceChildren(makeSlider('clipStart', max, 0));
    this.$('#endField').replaceChildren(makeSlider('clipEnd', max, Math.min(max, 5)));
    this.#showing();
    this.#clipCount();
  }

  #closeClip() {
    const video = this.$('#video');
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (this.#clip) URL.revokeObjectURL(this.#clip.url);
    this.#clip = null;
    this.#showing();
  }

  #span() {
    const start = Number(this.$('#clipStart')?.value ?? 0);
    const end = Number(this.$('#clipEnd')?.value ?? 0);
    const fps = Number(this.$('#fps').value);
    const [from, to] = start <= end ? [start, end] : [end, start];
    const count = Math.min(MAX_FRAMES - this.#frames.length, Math.floor((to - from) * fps) + 1);
    return { from, to, fps, count: Math.max(0, count) };
  }

  #clipCount() {
    if (!this.#clip) return;
    const { from, to, count } = this.#span();
    this.$('#clipCount').textContent = `${seconds(to - from)} · ${t('gif-maker.frameCount', '{count} frames', { count })}`;
    this.$('#clipAdd').toggleAttribute('disabled', count < 1);
  }

  async #capture() {
    const video = this.$('#video');
    const { from, fps, count } = this.#span();
    if (count < 1 || this.#busy) return;
    video.pause();
    this.#busy = true;
    this.$('#clipAdd').toggleAttribute('disabled', true);
    const progress = this.$('#progress');
    progress.hidden = false;
    progress.value = 0;
    progress.setAttribute('label', t('gif-maker.takingFrames', 'Taking frames from the video'));
    const captured = [];
    try {
      const last = Math.max(0, video.duration - 0.001);
      for (let step = 0; step < count; step += 1) {
        await seekTo(video, Math.min(from + step / fps, Number.isFinite(last) ? last : from + step / fps));
        captured.push(frameOf(keep(video, video.videoWidth, video.videoHeight)));
        progress.value = Math.round(((step + 1) / count) * 100);
      }
    } finally {
      this.#busy = false;
      progress.hidden = true;
      progress.removeAttribute('label');
    }
    const delay = Math.round(1000 / fps / 10) * 10;
    if (this.#frames.length) {
      // joined onto frames already here, they keep the video's own speed
      if (delay !== this.$('#delay').value) captured.forEach((frame) => (frame.delay = delay));
    } else {
      this.#name = this.#clip?.name ?? 'animation';
      captured.forEach((frame) => (frame.delay = delay));
    }
    this.#closeClip();
    this.#append(captured);
  }

  // ---- the strip of frames ---------------------------------------------

  #wireStrip() {
    const strip = this.$('#strip');
    const tileOf = (event) => event.target.closest?.('.tile');
    const unmark = () => strip.querySelectorAll('.before, .after').forEach((tile) => tile.classList.remove('before', 'after'));
    const after = (event, tile) => {
      const box = tile.getBoundingClientRect();
      return event.clientX > box.left + box.width / 2;
    };

    this.on(strip, 'click', (event) => {
      if (event.target.closest?.('.add-tile')) {
        this.$('#add').click();
        return;
      }
      const tile = tileOf(event);
      if (!tile) return;
      this.#select(Number(tile.dataset.id));
    });
    this.on(strip, 'dragstart', (event) => {
      const tile = tileOf(event);
      if (!tile) return;
      this.#dragging = Number(tile.dataset.id);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', tile.dataset.id);
    });
    this.on(strip, 'dragover', (event) => {
      const tile = tileOf(event);
      if (this.#dragging === null || !tile) return;
      event.preventDefault();
      unmark();
      tile.classList.add(after(event, tile) ? 'after' : 'before');
    });
    this.on(strip, 'drop', (event) => {
      const tile = tileOf(event);
      unmark();
      if (this.#dragging === null || !tile) return;
      event.preventDefault();
      event.stopPropagation();
      const from = this.#frames.findIndex((frame) => frame.id === this.#dragging);
      const [moved] = this.#frames.splice(from, 1);
      let to = this.#frames.findIndex((frame) => frame.id === Number(tile.dataset.id));
      if (to < 0) to = this.#frames.length;
      else if (after(event, tile)) to += 1;
      this.#frames.splice(to, 0, moved);
      this.#dragging = null;
      this.#selected = moved.id;
      this.#changed();
    });
    this.on(strip, 'dragend', () => {
      this.#dragging = null;
      unmark();
    });
  }

  #tile(frame) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.draggable = true;
    tile.dataset.id = String(frame.id);
    const { width, height } = frame.canvas;
    const thumb = canvasOf(Math.min(112, Math.max(24, (56 * width) / height)) * 2, 112);
    paint(thumb.getContext('2d'), frame, thumb.width, thumb.height, { fit: 'contain', background: null });
    thumb.style.width = `${thumb.width / 2}px`;
    const label = document.createElement('span');
    label.className = 'label';
    label.innerHTML = '<span class="number"></span><span class="delay"></span>';
    tile.append(thumb, label);
    return tile;
  }

  #drawStrip() {
    const strip = this.$('#strip');
    strip.hidden = !this.#frames.length;
    if (!this.#frames.length) {
      strip.replaceChildren();
      return;
    }
    const tiles = this.#frames.map((frame, index) => {
      frame.tile ??= this.#tile(frame);
      frame.tile.classList.toggle('selected', frame.id === this.#selected);
      frame.tile.querySelector('.number').textContent = String(index + 1);
      frame.tile.querySelector('.delay').textContent = frame.delay ? `${frame.delay} ms` : '';
      frame.tile.title = t('gif-maker.frameOf', 'Frame {n} of {count}', { n: index + 1, count: this.#frames.length });
      return frame.tile;
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'add-tile';
    add.textContent = `+ ${t('gif-maker.add', 'Add')}`;
    add.hidden = this.#frames.length >= MAX_FRAMES;
    strip.replaceChildren(...tiles, add);
  }

  #index() {
    return this.#frames.findIndex((frame) => frame.id === this.#selected);
  }

  #current() {
    return this.#frames[this.#index()] ?? null;
  }

  #select(id) {
    this.#selected = id;
    const index = this.#index();
    if (index >= 0) {
      // looking at one frame stops the playing on it
      this.#play.on = false;
      this.#play.step = Math.max(0, this.#play.order.findIndex((step) => step.index === index));
      this.#hideResult();
    }
    this.#drawStrip();
    this.#frameCard();
    this.#transport();
    this.#current()?.tile?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  #shift(by) {
    const index = this.#index();
    const to = index + by;
    if (index < 0 || to < 0 || to >= this.#frames.length) return;
    const [moved] = this.#frames.splice(index, 1);
    this.#frames.splice(to, 0, moved);
    this.#changed();
  }

  #removeSelected() {
    const index = this.#index();
    if (index < 0) return;
    this.#frames.splice(index, 1);
    this.#selected = this.#frames[Math.min(index, this.#frames.length - 1)]?.id ?? null;
    this.#changed();
  }

  #key(event) {
    const target = event.composedPath()[0];
    if (target?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (!this.#frames.length || this.#clip) return;
    const index = this.#index();
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (index < 0) return;
      event.preventDefault();
      this.#removeSelected();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const step = event.key === 'ArrowLeft' ? -1 : 1;
      const next = index < 0 ? 0 : clamp(index + step, 0, this.#frames.length - 1);
      this.#select(this.#frames[next].id);
    } else if (event.key === ' ' && target === this.$('.app')) {
      event.preventDefault();
      this.#toggle();
    }
  }

  // ---- showing it -------------------------------------------------------

  #size() {
    const first = this.#frames[0]?.canvas;
    if (!first) return { width: 0, height: 0 };
    const width = Math.round(clamp(this.$('#width').value, 16, MAX_WIDTH));
    return { width, height: Math.max(1, Math.round((width * first.height) / first.width)) };
  }

  #options() {
    const transparent = this.$('#transparent').checked;
    return {
      fit: this.$('#fit').value,
      background: transparent ? null : this.$('#background').value,
      repeat: Number(this.$('#repeat').value),
      colours: this.$('#colours').value,
      dither: this.$('#dither').checked,
    };
  }

  #changed({ strip = true, keepResult = false } = {}) {
    if (!keepResult) this.#forget();
    this.#play.order = orderOf(this.#frames, this.$('#delay').value, this.$('#boomerang').checked);
    if (this.#play.step >= this.#play.order.length) this.#play.step = 0;
    this.#play.due = 0;
    if (this.#selected !== null && this.#index() < 0) this.#selected = null;

    const { width, height } = this.#size();
    const screen = this.$('#screen');
    if (width && (screen.width !== width || screen.height !== height)) {
      screen.width = width;
      screen.height = height;
    }
    if (strip) this.#drawStrip();
    this.#look();
    this.#showing();
    this.#frameCard();
    this.#draw();
    this.#transport();
  }

  /** Throw away a finished GIF that no longer matches, and stop one being made. */
  #forget() {
    this.#job += 1;
    this.#stop?.();
    this.#stop = null;
    this.$('#progress').hidden = true;
    if (this.#result) URL.revokeObjectURL(this.#result.url);
    this.#result = null;
  }

  #showing() {
    const has = this.#frames.length > 0;
    const clip = Boolean(this.#clip);
    this.$('#drop').hidden = has || clip;
    this.$('#view').hidden = !has || clip;
    this.$('#clip').hidden = !clip;
    this.$('#transport').hidden = !has;
    const result = this.$('#result');
    result.hidden = !this.#result;
    this.$('#screen').hidden = Boolean(this.#result);
    if (this.#result && result.getAttribute('src') !== this.#result.url) result.src = this.#result.url;
    for (const id of ['make', 'reverse', 'clear']) this.$(`#${id}`).toggleAttribute('disabled', !has || this.#busy);
    this.$('#save').toggleAttribute('disabled', !this.#result);
    this.$('#add').toggleAttribute('disabled', this.#frames.length >= MAX_FRAMES);
    this.#fit();
  }

  #look() {
    const transparent = this.$('#transparent').checked;
    this.$('#backgroundField').hidden = transparent;
    this.$('#view').dataset.clear = String(transparent);
  }

  #frameCard() {
    const frame = this.#current();
    this.$('#frameCard').hidden = !frame;
    if (!frame) return;
    this.$('#frameTitle').textContent = t('gif-maker.frameOf', 'Frame {n} of {count}', {
      n: this.#index() + 1,
      count: this.#frames.length,
    });
    this.$('#frameDelay').value = clamp(frame.delay ?? this.$('#delay').value, 20, 5000);
    this.$('#sharedDelay').hidden = frame.delay === null;
    this.$('#earlier').toggleAttribute('disabled', this.#index() === 0);
    this.$('#later').toggleAttribute('disabled', this.#index() === this.#frames.length - 1);
    this.$('#duplicate').toggleAttribute('disabled', this.#frames.length >= MAX_FRAMES);
  }

  #draw() {
    const step = this.#play.order[this.#play.step];
    const frame = step ? this.#frames[step.index] : null;
    if (!frame) return;
    const { width, height } = this.#size();
    paint(this.$('#screen').getContext('2d'), frame, width, height, this.#options());
  }

  #tick(now) {
    const play = this.#play;
    if (!play.on || this.#result || !play.order.length || this.#clip) return;
    if (!play.due) {
      play.due = now + play.order[play.step].delay;
      return;
    }
    if (now < play.due) return;
    play.step = (play.step + 1) % play.order.length;
    // a slow tab catches up rather than rushing through the frames it missed
    play.due = Math.max(play.due + play.order[play.step].delay, now);
    this.#draw();
    this.#transport();
  }

  #toggle() {
    this.#play.on = !this.#play.on;
    this.#play.due = 0;
    if (this.#play.on) {
      this.#selected = null;
      this.#hideResult();
      this.#drawStrip();
      this.#frameCard();
    }
    this.#transport();
  }

  #hideResult() {
    // the finished GIF stays made, but the frames show again
    if (!this.#result) return;
    this.$('#result').hidden = true;
    this.$('#screen').hidden = false;
    this.#draw();
  }

  #transport() {
    const count = this.#frames.length;
    if (!count) return;
    const showingResult = this.#result && !this.$('#result').hidden;
    const playing = this.$('#playing');
    playing.hidden = Boolean(showingResult);
    playing.textContent = this.#play.on ? t('gif-maker.pause', 'Pause') : t('gif-maker.play', 'Play');
    const step = this.#play.order[this.#play.step];
    this.$('#position').textContent = showingResult
      ? t('gif-maker.finishedGif', 'The finished GIF')
      : `${(step?.index ?? 0) + 1} / ${count}`;
    const { width, height } = this.#size();
    const total = this.#play.order.reduce((sum, item) => sum + Math.max(20, Math.round(item.delay / 10) * 10), 0);
    this.$('#stats').textContent = [
      t('gif-maker.frameCount', '{count} frames', { count: this.#play.order.length }),
      seconds(total / 1000),
      `${width} × ${height} px`,
      ...(this.#result ? [formatBytes(this.#result.size)] : []),
    ].join(' · ');
  }

  // ---- making it --------------------------------------------------------

  async #make() {
    if (!this.#frames.length || this.#busy) return;
    const { width, height } = this.#size();
    if (width * height * this.#frames.length > PIXEL_BUDGET) {
      toast(t('gif-maker.tooBig', 'That is too much for one GIF. Make it narrower or use fewer frames.'), 'error');
      return;
    }
    this.#forget();
    const job = this.#job;
    const progress = this.$('#progress');
    progress.hidden = false;
    progress.value = 0;
    progress.setAttribute('label', t('gif-maker.making', 'Making the GIF'));
    this.$('#make').toggleAttribute('disabled', true);
    try {
      const bytes = await makeGif(this.#frames, this.#play.order, width, height, this.#options(), {
        onProgress: (share) => {
          if (job === this.#job) progress.value = Math.round(share * 100);
        },
        onStop: (stop) => (this.#stop = stop),
      });
      if (job !== this.#job) return;
      const blob = new Blob([bytes], { type: 'image/gif' });
      this.#result = { blob, url: URL.createObjectURL(blob), size: bytes.length };
      this.#stop = null;
      this.#showing();
      this.#transport();
    } catch (failure) {
      if (job === this.#job) toast(`${t('gif-maker.couldNotMake', 'The GIF could not be made')}: ${failure.message}`, 'error');
    } finally {
      if (job === this.#job) {
        progress.hidden = true;
        progress.removeAttribute('label');
        this.$('#make').toggleAttribute('disabled', !this.#frames.length);
      }
    }
  }

  #remember() {
    this.store.write({
      delay: this.$('#delay').value,
      repeat: Number(this.$('#repeat').value),
      boomerang: this.$('#boomerang').checked,
      fit: this.$('#fit').value,
      colours: this.$('#colours').value,
      dither: this.$('#dither').checked,
      transparent: this.$('#transparent').checked,
      background: this.$('#background').value,
      fps: Number(this.$('#fps').value),
    });
  }
}

define('jg-app-gif-maker', GifMaker);
