import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { download, toast, formatBytes } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const TOOLS = [
  { id: 'pen', label: t('screenshot.pen', 'Pen') },
  { id: 'arrow', label: t('screenshot.arrow', 'Arrow') },
  { id: 'rect', label: t('screenshot.box', 'Box') },
  { id: 'ellipse', label: t('screenshot.circle', 'Circle') },
  { id: 'highlight', label: t('screenshot.marker', 'Marker') },
  { id: 'text', label: t('screenshot.text', 'Text') },
  { id: 'blur', label: t('screenshot.blur', 'Blur') },
  { id: 'pixelate', label: t('screenshot.pixelate', 'Pixelate') },
  { id: 'block', label: t('screenshot.block', 'Block') },
  { id: 'crop', label: t('screenshot.crop', 'Crop') },
];

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#8a1c3b', '#111827', '#ffffff'];

class Screenshot extends JGApp {
  static appId = 'screenshot';
  static styles = [...JGApp.styles, sheet];

  #source = null;
  #shapes = [];
  #redo = [];
  #tool = 'pen';
  #color = COLORS[0];
  #width = 4;
  #draft = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="bar">
        <jg-button id="capture">${t('screenshot.captureScreen', 'Capture screen')}</jg-button>
        <jg-button variant="outline" id="upload">${t('screenshot.openImage', 'Open image')}</jg-button>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="undo">${t('screenshot.undo', 'Undo')}</jg-button>
        <jg-button size="sm" variant="ghost" id="redoBtn">${t('screenshot.redo', 'Redo')}</jg-button>
        <jg-button size="sm" variant="ghost" id="clear">${t('screenshot.clearMarks', 'Clear marks')}</jg-button>
      </div>

      <div class="bar">
        <div class="tools" id="tools">
          ${TOOLS.map((tool) => html`<button class="tool" data-tool="${tool.id}" aria-pressed="${String(tool.id === this.#tool)}">${tool.label}</button>`)}
        </div>
        <span class="grow"></span>
        <div class="swatches" id="swatches">
          ${COLORS.map((color) => html`<button class="swatch" data-color="${color}" style="background:${color}" aria-pressed="${String(color === this.#color)}"></button>`)}
        </div>
        <jg-slider id="width" min="1" max="24" value="4" style="width:130px"></jg-slider>
      </div>

      <div class="stage" id="stage" data-compare="false">
        <div class="holder" id="holder" hidden>
          <canvas id="canvas"></canvas>
          <span class="handle" id="handle"></span>
        </div>
        <div class="empty" id="empty">
          <jg-empty glyph="▤" title="${t('screenshot.nothingLoaded', 'Nothing loaded')}">
            Capture a screen or window, open an image file, or paste one from the clipboard.
          </jg-empty>
        </div>
      </div>

      <div class="bar">
        <jg-switch id="compare"></jg-switch><span class="hint">${t('screenshot.beforeAndAfter', 'Before and after')}</span>
        <jg-slider id="split" min="0" max="100" value="50" style="width:180px"></jg-slider>
        <span class="grow"></span>
        <span class="hint" id="info"></span>
        <jg-button size="sm" variant="outline" id="copy">${t('screenshot.copy', 'Copy')}</jg-button>
        <jg-button size="sm" variant="outline" id="save">${t('screenshot.savePng', 'Save PNG')}</jg-button>
      </div>
    </div>`);

    this.on(this.$('#capture'), 'click', () => this.#capture());
    this.on(this.$('#upload'), 'click', () => this.#upload());
    this.on(this.$('#undo'), 'click', () => this.#undo());
    this.on(this.$('#redoBtn'), 'click', () => this.#redoLast());
    this.on(this.$('#clear'), 'click', () => {
      this.#shapes = [];
      this.#redo = [];
      this.#paint();
    });
    this.on(this.$('#save'), 'click', () => this.#save());
    this.on(this.$('#copy'), 'click', () => this.#copy());

    this.bind('[data-tool]', 'click', (event) => {
      this.#tool = event.currentTarget.dataset.tool;
      this.$$('[data-tool]').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.tool === this.#tool)));
    });
    this.bind('[data-color]', 'click', (event) => {
      this.#color = event.currentTarget.dataset.color;
      this.$$('[data-color]').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.color === this.#color)));
    });
    this.on(this.$('#width'), 'input', () => {
      this.#width = Number(this.$('#width').value);
    });
    this.on(this.$('#compare'), 'change', (event) => {
      this.$('#stage').dataset.compare = String(event.detail.checked);
      this.#paint();
    });
    this.on(this.$('#split'), 'input', () => this.#paint());

    const canvas = this.$('#canvas');
    this.on(canvas, 'pointerdown', (event) => this.#down(event));
    this.on(canvas, 'pointermove', (event) => this.#move(event));
    this.on(canvas, 'pointerup', (event) => this.#up(event));

    this.listen(window, 'paste', (event) => {
      const item = [...(event.clipboardData?.items ?? [])].find((entry) => entry.type.startsWith('image/'));
      if (item) this.#load(item.getAsFile());
    });
    this.hotkeys((event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.#redoLast();
        else this.#undo();
      }
    });
  }

  async #capture() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast('Screen capture is not available in this browser', 'error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 220));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      track.stop();

      this.#source = await createImageBitmap(canvas);
      this.#shapes = [];
      this.#redo = [];
      this.#paint();
    } catch (error) {
      if (error.name !== 'NotAllowedError') toast(error.message, 'error');
    }
  }

  #upload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => input.files[0] && this.#load(input.files[0]);
    input.click();
  }

  async #load(file) {
    if (!file) return;
    this.#source = await createImageBitmap(file);
    this.#shapes = [];
    this.#redo = [];
    this.#paint();
  }

  #point(event) {
    const canvas = this.$('#canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  #down(event) {
    if (!this.#source) return;
    const point = this.#point(event);
    this.$('#canvas').setPointerCapture(event.pointerId);

    if (this.#tool === 'text') {
      const value = prompt('Text to add');
      if (value) {
        this.#shapes.push({ tool: 'text', color: this.#color, size: this.#width, text: value, from: point });
        this.#redo = [];
        this.#paint();
      }
      return;
    }

    this.#draft = {
      tool: this.#tool,
      color: this.#color,
      size: this.#width,
      from: point,
      to: point,
      points: [point],
    };
  }

  #move(event) {
    if (!this.#draft) return;
    const point = this.#point(event);
    this.#draft.to = point;
    if (this.#draft.tool === 'pen' || this.#draft.tool === 'highlight') this.#draft.points.push(point);
    this.#paint();
  }

  #up() {
    if (!this.#draft) return;
    const shape = this.#draft;
    this.#draft = null;

    const dragged = Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y) > 4;
    if (shape.tool === 'crop') {
      if (dragged) this.#crop(shape);
      else this.#paint();
      return;
    }
    if (dragged || shape.points.length > 2) {
      this.#shapes.push(shape);
      this.#redo = [];
    }
    this.#paint();
  }

  async #crop(shape) {
    const x = Math.round(Math.min(shape.from.x, shape.to.x));
    const y = Math.round(Math.min(shape.from.y, shape.to.y));
    const width = Math.round(Math.abs(shape.to.x - shape.from.x));
    const height = Math.round(Math.abs(shape.to.y - shape.from.y));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    this.#render(context, canvas.width, canvas.height, { offsetX: -x, offsetY: -y });

    this.#source = await createImageBitmap(canvas);
    this.#shapes = [];
    this.#redo = [];
    this.#paint();
  }

  #undo() {
    const shape = this.#shapes.pop();
    if (shape) this.#redo.push(shape);
    this.#paint();
  }

  #redoLast() {
    const shape = this.#redo.pop();
    if (shape) this.#shapes.push(shape);
    this.#paint();
  }

  #drawShape(context, shape) {
    const { from, to } = shape;
    const left = Math.min(from.x, to.x);
    const top = Math.min(from.y, to.y);
    const width = Math.abs(to.x - from.x);
    const height = Math.abs(to.y - from.y);

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = shape.color;
    context.fillStyle = shape.color;
    context.lineWidth = shape.size;

    if (shape.tool === 'pen' || shape.tool === 'highlight') {
      if (shape.tool === 'highlight') {
        context.globalAlpha = 0.35;
        context.lineWidth = shape.size * 4;
      }
      context.beginPath();
      shape.points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
      context.stroke();
    } else if (shape.tool === 'rect') {
      context.strokeRect(left, top, width, height);
    } else if (shape.tool === 'ellipse') {
      context.beginPath();
      context.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      context.stroke();
    } else if (shape.tool === 'arrow') {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const head = Math.max(12, shape.size * 3.5);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.beginPath();
      context.moveTo(to.x, to.y);
      context.lineTo(to.x - head * Math.cos(angle - Math.PI / 7), to.y - head * Math.sin(angle - Math.PI / 7));
      context.lineTo(to.x - head * Math.cos(angle + Math.PI / 7), to.y - head * Math.sin(angle + Math.PI / 7));
      context.closePath();
      context.fill();
    } else if (shape.tool === 'text') {
      const size = Math.max(16, shape.size * 6);
      context.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
      context.textBaseline = 'top';
      context.lineWidth = Math.max(3, size / 8);
      context.strokeStyle = 'rgba(0,0,0,0.45)';
      context.strokeText(shape.text, from.x, from.y);
      context.fillText(shape.text, from.x, from.y);
    } else if (shape.tool === 'block') {
      context.fillRect(left, top, width, height);
    } else if (shape.tool === 'blur' || shape.tool === 'pixelate') {
      if (width < 2 || height < 2) {
        context.restore();
        return;
      }
      context.beginPath();
      context.rect(left, top, width, height);
      context.clip();
      if (shape.tool === 'blur') {
        context.filter = `blur(${Math.max(6, shape.size * 2)}px)`;
        context.drawImage(this.#source, 0, 0);
      } else {
        const scale = Math.max(0.02, 1 / Math.max(6, shape.size * 2));
        const small = document.createElement('canvas');
        small.width = Math.max(1, Math.round(width * scale));
        small.height = Math.max(1, Math.round(height * scale));
        const smallContext = small.getContext('2d');
        smallContext.drawImage(this.#source, left, top, width, height, 0, 0, small.width, small.height);
        context.imageSmoothingEnabled = false;
        context.drawImage(small, 0, 0, small.width, small.height, left, top, width, height);
      }
    } else if (shape.tool === 'crop') {
      context.setLineDash([8, 6]);
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.strokeRect(left, top, width, height);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(left, top, width, height);
    }

    context.restore();
  }

  #render(context, width, height, { offsetX = 0, offsetY = 0, shapes = this.#shapes } = {}) {
    context.save();
    context.translate(offsetX, offsetY);
    context.drawImage(this.#source, 0, 0);
    shapes.forEach((shape) => this.#drawShape(context, shape));
    context.restore();
  }

  #paint() {
    const holder = this.$('#holder');
    const empty = this.$('#empty');
    if (!this.#source) {
      holder.hidden = true;
      empty.hidden = false;
      return;
    }

    holder.hidden = false;
    empty.hidden = true;

    const canvas = this.$('#canvas');
    canvas.width = this.#source.width;
    canvas.height = this.#source.height;
    const context = canvas.getContext('2d');

    const comparing = this.$('#compare').checked;
    const split = Number(this.$('#split').value) / 100;

    if (!comparing) {
      this.#render(context, canvas.width, canvas.height, {
        shapes: this.#draft ? [...this.#shapes, this.#draft] : this.#shapes,
      });
    } else {
      context.drawImage(this.#source, 0, 0);
      context.save();
      context.beginPath();
      context.rect(0, 0, canvas.width * split, canvas.height);
      context.clip();
      this.#render(context, canvas.width, canvas.height, {
        shapes: this.#draft ? [...this.#shapes, this.#draft] : this.#shapes,
      });
      context.restore();

      const rect = canvas.getBoundingClientRect();
      const handle = this.$('#handle');
      handle.style.left = `${rect.width * split}px`;
    }

    this.$('#info').textContent = `${canvas.width} × ${canvas.height} · ${this.#shapes.length} mark${this.#shapes.length === 1 ? '' : 's'}`;
  }

  #flatten() {
    const canvas = document.createElement('canvas');
    canvas.width = this.#source.width;
    canvas.height = this.#source.height;
    this.#render(canvas.getContext('2d'), canvas.width, canvas.height);
    return canvas;
  }

  #save() {
    if (!this.#source) return;
    this.#flatten().toBlob((blob) => {
      download(`screenshot-${Date.now()}.png`, blob, 'image/png');
      toast(`Saved ${formatBytes(blob.size)}`, 'success');
    }, 'image/png');
  }

  #copy() {
    if (!this.#source) return;
    this.#flatten().toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Image copied', 'success');
      } catch {
        toast('This browser blocked the clipboard write', 'error');
      }
    }, 'image/png');
  }
}

define('jg-app-screenshot', Screenshot);
