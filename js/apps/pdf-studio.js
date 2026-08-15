import { JGApp, define, html, css } from '../core/app.js';
import { settings } from '../core/settings.js';
import { copyText, download, formatBytes } from '../core/util.js';

const sheet = css`
  .app { padding: 0; gap: 0; container-type: inline-size; overflow: hidden; }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex: none;
  }

  .body { flex: 1; min-height: 0; display: flex; }
  .stage { flex: 1; min-width: 0; overflow: auto; padding: 14px; }
  .side {
    width: 236px;
    flex: none;
    border-left: 1px solid var(--border);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: auto;
  }

  .drop {
    display: grid;
    place-items: center;
    gap: 10px;
    min-height: 240px;
    border: 1px dashed var(--glass-border);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 50%, transparent);
    text-align: center;
    padding: 28px;
  }
  .drop[data-over="true"] { border-color: var(--ring); background: color-mix(in srgb, var(--ring) 10%, transparent); }

  .pages { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 12px; }
  .page {
    position: relative;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    padding: 8px;
    display: grid;
    gap: 6px;
    cursor: pointer;
  }
  .page[data-picked="true"] { border-color: var(--ring); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 40%, transparent); }
  .page canvas { width: 100%; border-radius: var(--radius-sm); background: #fff; display: block; }
  .page .meta { display: flex; align-items: center; justify-content: space-between; font: 500 11px/1 var(--font-mono); color: var(--muted-foreground); }
  .page .tools { display: flex; gap: 4px; }
  .page .tools button {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--muted-foreground);
    font-size: 11px;
    cursor: pointer;
  }
  .page .tools button:hover { color: var(--foreground); border-color: var(--border-strong); }

  .text { width: 100%; min-height: 320px; }
  .status { font-size: 12px; color: var(--muted-foreground); }

  @container (max-width: 760px) {
    .body { flex-direction: column; }
    .side { width: auto; border-left: 0; border-top: 1px solid var(--border); }
  }
`;

const MODES = [
  { value: 'pages', label: 'Pages' },
  { value: 'images', label: 'To images' },
  { value: 'text', label: 'To text' },
  { value: 'build', label: 'From images' },
];

class PdfStudio extends JGApp {
  static appId = 'pdf-studio';
  static settings = [
    { key: 'pdfLib', label: 'pdf-lib module', type: 'text', default: 'https://esm.run/pdf-lib@1.17.1' },
    { key: 'pdfJs', label: 'pdf.js module', type: 'text', default: 'https://esm.run/pdfjs-dist@4.0.379/build/pdf.min.mjs' },
    { key: 'worker', label: 'pdf.js worker', type: 'text', default: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs' },
    { key: 'scale', label: 'Image export scale', type: 'number', default: 2, min: 1, max: 4 },
  ];
  static styles = [...JGApp.styles, sheet];

  #mode = 'pages';
  #pages = [];
  #sources = new Map();
  #pdfjs = null;
  #pdflib = null;
  #busy = false;

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">PDF Studio</div>
        <div class="hint">Merge, split, rotate, and convert to or from images.</div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head">
        <jg-toolbar id="bar"></jg-toolbar>
      </div>
      <div class="body">
        <div class="stage">
          <div id="empty">
            <div class="drop" id="drop">
              <div class="title">Drop PDFs or images here</div>
              <p class="hint" style="max-width:44ch">
                Everything is processed by this tab. Nothing is uploaded, and the files never leave your machine.
              </p>
              <jg-button size="sm" id="pick">Choose files</jg-button>
            </div>
          </div>
          <div class="pages" id="pages" hidden></div>
          <jg-textarea id="text" class="text" mono readonly hidden></jg-textarea>
        </div>
        <aside class="side">
          <div class="label">Document</div>
          <div class="status" id="status">No file open</div>
          <div class="sep"></div>
          <div id="controls"></div>
          <span class="grow"></span>
          <span class="error" id="error"></span>
        </aside>
      </div>
    </div>`);

    this.$('#bar').items = [
      ...MODES.map((mode) => ({
        id: mode.value,
        label: mode.label,
        icon: mode.value === 'text' ? 'type' : mode.value === 'build' ? 'image' : 'spec',
        select: true,
        action: () => this.#setMode(mode.value),
      })),
      { separator: true },
      { id: 'open', label: 'Open', icon: 'folder', action: () => this.#pick() },
      { spacer: true },
      { id: 'clear', label: 'Clear', icon: 'eraser', action: () => this.#clear() },
    ];
    this.$('#bar').value = this.#mode;

    this.on(this.$('#pick'), 'click', () => this.#pick());

    const drop = this.$('#drop');
    ['dragenter', 'dragover'].forEach((type) =>
      this.on(drop, type, (event) => {
        event.preventDefault();
        drop.dataset.over = 'true';
      }),
    );
    ['dragleave', 'drop'].forEach((type) =>
      this.on(drop, type, (event) => {
        event.preventDefault();
        drop.dataset.over = 'false';
      }),
    );
    this.on(drop, 'drop', (event) => this.#accept([...(event.dataTransfer?.files ?? [])]));

    this.#controls();
  }

  async #libs() {
    if (!this.#pdflib) {
      this.#pdflib = await import(/* @vite-ignore */ this.config.get('pdfLib', 'https://esm.run/pdf-lib@1.17.1'));
    }
    if (!this.#pdfjs) {
      const module = await import(/* @vite-ignore */ this.config.get('pdfJs', 'https://esm.run/pdfjs-dist@4.0.379/build/pdf.min.mjs'));
      const workerUrl = this.config.get('worker', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs');
      const source = await fetch(workerUrl).then((response) => response.text());
      module.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      this.#pdfjs = module;
    }
    return { lib: this.#pdflib, js: this.#pdfjs };
  }

  #setMode(mode) {
    this.#mode = mode;
    this.$('#bar').value = mode;
    this.$('#pages').hidden = mode === 'text' || !this.#pages.length;
    this.$('#text').hidden = mode !== 'text';
    this.$('#empty').hidden = this.#pages.length > 0;
    this.#controls();
    if (mode === 'text' && this.#pages.length) this.#extract();
  }

  async #pick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'application/pdf,image/*';
    input.onchange = () => this.#accept([...(input.files ?? [])]);
    input.click();
  }

  #report(message) {
    const status = this.$('#status');
    if (status) status.textContent = message;
  }

  async #accept(files) {
    if (!files.length || this.#busy) return;
    this.#busy = true;
    this.$('#error').textContent = '';
    this.#report(`Reading ${files.length} file${files.length === 1 ? '' : 's'}...`);

    try {
      const { js } = await this.#libs();
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
          const document = await js.getDocument({ data: bytes.slice() }).promise;
          const key = `${file.name}#${this.#sources.size}`;
          this.#sources.set(key, bytes);
          for (let number = 1; number <= document.numPages; number += 1) {
            this.#pages.push({ source: key, index: number - 1, label: `${file.name} p${number}`, rotate: 0, picked: true });
          }
        } else if (file.type.startsWith('image/')) {
          const key = `${file.name}#${this.#sources.size}`;
          this.#sources.set(key, bytes);
          this.#pages.push({ source: key, image: file.type, index: 0, label: file.name, rotate: 0, picked: true, size: file.size });
        }
      }

      this.$('#empty').hidden = this.#pages.length > 0;
      this.$('#pages').hidden = this.#mode === 'text' || !this.#pages.length;
      this.#report(`${this.#pages.length} page${this.#pages.length === 1 ? '' : 's'} from ${this.#sources.size} file${this.#sources.size === 1 ? '' : 's'}`);
      await this.#thumbs();
      this.#controls();
      if (this.#mode === 'text') this.#extract();
    } catch (failure) {
      this.$('#error').textContent = failure.message;
    } finally {
      this.#busy = false;
    }
  }

  async #thumbs() {
    const host = this.$('#pages');
    host.innerHTML = html`${this.#pages.map(
      (page, index) => html`<div class="page" data-index="${index}" data-picked="${String(page.picked)}">
        <canvas data-canvas="${index}"></canvas>
        <div class="meta">
          <span>${index + 1}</span>
          <span class="tools">
            <button data-rotate="${index}" title="Rotate">↻</button>
            <button data-drop="${index}" title="Remove">✕</button>
          </span>
        </div>
      </div>`,
    )}`;

    this.bind('.page', 'click', (event) => {
      if (event.target.closest('button')) return;
      const page = this.#pages[Number(event.currentTarget.dataset.index)];
      page.picked = !page.picked;
      event.currentTarget.dataset.picked = String(page.picked);
      this.#controls();
    });
    this.bind('[data-rotate]', 'click', async (event) => {
      const index = Number(event.currentTarget.dataset.rotate);
      this.#pages[index].rotate = (this.#pages[index].rotate + 90) % 360;
      await this.#paintThumb(index);
    });
    this.bind('[data-drop]', 'click', async (event) => {
      this.#pages.splice(Number(event.currentTarget.dataset.drop), 1);
      await this.#thumbs();
      this.#controls();
      this.#report(`${this.#pages.length} pages`);
      if (!this.#pages.length) this.$('#empty').hidden = false;
    });

    for (let index = 0; index < this.#pages.length; index += 1) await this.#paintThumb(index);
  }

  async #paintThumb(index) {
    const page = this.#pages[index];
    const canvas = this.$(`[data-canvas="${index}"]`);
    if (!canvas || !page) return;

    if (page.image) {
      const bitmap = await createImageBitmap(new Blob([this.#sources.get(page.source)], { type: page.image }));
      const turned = page.rotate % 180 !== 0;
      const width = turned ? bitmap.height : bitmap.width;
      const height = turned ? bitmap.width : bitmap.height;
      const scale = 220 / Math.max(width, height);
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((page.rotate * Math.PI) / 180);
      context.drawImage(bitmap, (-bitmap.width * scale) / 2, (-bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
      return;
    }

    const { js } = await this.#libs();
    const document = await js.getDocument({ data: this.#sources.get(page.source).slice() }).promise;
    const rendered = await document.getPage(page.index + 1);
    const viewport = rendered.getViewport({ scale: 1, rotation: (rendered.rotate + page.rotate) % 360 });
    const scale = 220 / Math.max(viewport.width, viewport.height);
    const view = rendered.getViewport({ scale, rotation: (rendered.rotate + page.rotate) % 360 });
    canvas.width = Math.round(view.width);
    canvas.height = Math.round(view.height);
    await rendered.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
  }

  #picked() {
    return this.#pages.filter((page) => page.picked);
  }

  #controls() {
    const host = this.$('#controls');
    if (!host) return;
    const picked = this.#picked().length;

    if (!this.#pages.length) {
      host.innerHTML = html`<div class="hint">Open a PDF to merge, split, rotate or convert it.</div>`;
      return;
    }

    if (this.#mode === 'text') {
      host.innerHTML = html`
        <div class="hint">Text is pulled from the PDF's own text layer. Scanned pages hold pictures, not letters, so they come out empty.</div>
        <jg-button size="sm" id="copy-text">Copy text</jg-button>
        <jg-button size="sm" variant="outline" id="save-text">Save .txt</jg-button>
      `;
      this.on(this.$('#copy-text'), 'click', () => copyText(this.$('#text').value));
      this.on(this.$('#save-text'), 'click', () => download('extracted.txt', this.$('#text').value));
      return;
    }

    host.innerHTML = html`
      <div class="hint">${picked} of ${this.#pages.length} pages selected. Click a page to include or exclude it.</div>
      <div class="row tight">
        <jg-button size="sm" variant="ghost" id="all">Select all</jg-button>
        <jg-button size="sm" variant="ghost" id="none">Select none</jg-button>
      </div>
      ${this.#mode === 'images'
        ? html`<jg-button size="sm" id="export-images">Save ${picked} PNG${picked === 1 ? '' : 's'}</jg-button>`
        : html`<jg-button size="sm" id="export-pdf">Save PDF</jg-button>`}
      <jg-progress id="progress" size="sm" hidden></jg-progress>
    `;

    this.on(this.$('#all'), 'click', () => this.#setAll(true));
    this.on(this.$('#none'), 'click', () => this.#setAll(false));
    const pdfButton = this.$('#export-pdf');
    if (pdfButton) this.on(pdfButton, 'click', () => this.#savePdf());
    const imageButton = this.$('#export-images');
    if (imageButton) this.on(imageButton, 'click', () => this.#saveImages());
  }

  #setAll(picked) {
    this.#pages.forEach((page) => {
      page.picked = picked;
    });
    this.$$('.page').forEach((node) => {
      node.dataset.picked = String(picked);
    });
    this.#controls();
  }

  async #savePdf() {
    const pages = this.#picked();
    if (!pages.length) return;
    const progress = this.$('#progress');
    progress.hidden = false;
    progress.setAttribute('label', 'Building the PDF');

    try {
      const { lib } = await this.#libs();
      const out = await lib.PDFDocument.create();
      const cache = new Map();

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        progress.setAttribute('value', String(Math.round(((index + 1) / pages.length) * 100)));

        if (page.image) {
          const bytes = this.#sources.get(page.source);
          const embedded = /png/i.test(page.image)
            ? await out.embedPng(bytes)
            : await out.embedJpg(bytes);
          const sheet = out.addPage([embedded.width, embedded.height]);
          sheet.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
          if (page.rotate) sheet.setRotation(lib.degrees(page.rotate));
          continue;
        }

        if (!cache.has(page.source)) {
          cache.set(page.source, await lib.PDFDocument.load(this.#sources.get(page.source).slice()));
        }
        const [copied] = await out.copyPages(cache.get(page.source), [page.index]);
        if (page.rotate) copied.setRotation(lib.degrees((copied.getRotation().angle + page.rotate) % 360));
        out.addPage(copied);
      }

      const bytes = await out.save();
      download('document.pdf', new Blob([bytes], { type: 'application/pdf' }));
      this.#report(`Saved ${pages.length} pages, ${formatBytes(bytes.length)}`);
    } catch (failure) {
      this.$('#error').textContent = failure.message;
    } finally {
      progress.hidden = true;
    }
  }

  async #saveImages() {
    const pages = this.#picked();
    if (!pages.length) return;
    const progress = this.$('#progress');
    progress.hidden = false;
    progress.setAttribute('label', 'Rendering pages');
    const scale = Math.max(1, Number(this.config.get('scale', 2)));

    try {
      const { js } = await this.#libs();
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        progress.setAttribute('value', String(Math.round(((index + 1) / pages.length) * 100)));
        const canvas = document.createElement('canvas');

        if (page.image) {
          const bitmap = await createImageBitmap(new Blob([this.#sources.get(page.source)], { type: page.image }));
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0);
        } else {
          const source = await js.getDocument({ data: this.#sources.get(page.source).slice() }).promise;
          const rendered = await source.getPage(page.index + 1);
          const view = rendered.getViewport({ scale, rotation: (rendered.rotate + page.rotate) % 360 });
          canvas.width = Math.round(view.width);
          canvas.height = Math.round(view.height);
          await rendered.render({ canvasContext: canvas.getContext('2d'), viewport: view }).promise;
        }

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        download(`page-${String(index + 1).padStart(3, '0')}.png`, blob);
        await new Promise((resolve) => setTimeout(resolve, 220));
      }
      this.#report(`Saved ${pages.length} image${pages.length === 1 ? '' : 's'}`);
    } catch (failure) {
      this.$('#error').textContent = failure.message;
    } finally {
      progress.hidden = true;
    }
  }

  async #extract() {
    const target = this.$('#text');
    target.value = 'Reading...';
    try {
      const { js } = await this.#libs();
      const chunks = [];
      for (const page of this.#pages) {
        if (page.image) continue;
        const source = await js.getDocument({ data: this.#sources.get(page.source).slice() }).promise;
        const rendered = await source.getPage(page.index + 1);
        const content = await rendered.getTextContent();
        const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
        chunks.push(`--- ${page.label} ---\n${text || '(no text layer)'}`);
      }
      target.value = chunks.join('\n\n') || 'No PDF pages are open.';
    } catch (failure) {
      target.value = '';
      this.$('#error').textContent = failure.message;
    }
  }

  #clear() {
    this.#pages = [];
    this.#sources = new Map();
    this.$('#pages').innerHTML = '';
    this.$('#pages').hidden = true;
    this.$('#empty').hidden = false;
    this.$('#text').value = '';
    this.#report('No file open');
    this.#controls();
  }
}

define('jg-app-pdf-studio', PdfStudio);
