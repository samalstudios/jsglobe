import { JGApp, define, html, css } from '../core/app.js';
import { download, toast, formatBytes } from '../core/util.js';

const sheet = css`
  .drop {
    display: grid;
    place-items: center;
    flex: none;
    min-height: 130px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    color: var(--muted-foreground);
    font-size: 13px;
    cursor: pointer;
    text-align: center;
    padding: 12px;
  }
  .drop[data-over="true"] { border-color: var(--ring); color: var(--foreground); }
  .split { display: grid; grid-template-columns: 260px 1fr; gap: 14px; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .shot {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: color-mix(in srgb, var(--muted) 50%, transparent);
  }
  .shot img { display: block; width: 100%; height: auto; }
  .tags { display: grid; gap: 6px; }
  .tag { display: grid; grid-template-columns: 168px 1fr auto; gap: 8px; align-items: center; }
  .tag .name { font-size: 12px; color: var(--muted-foreground); }
  .removed { opacity: 0.45; }
`;

const EXIF_TAGS = {
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x011a: 'X resolution',
  0x011b: 'Y resolution',
  0x0131: 'Software',
  0x0132: 'Date time',
  0x013b: 'Artist',
  0x8298: 'Copyright',
  0x829a: 'Exposure time',
  0x829d: 'F number',
  0x8827: 'ISO',
  0x9003: 'Date taken',
  0x9004: 'Date digitised',
  0x920a: 'Focal length',
  0xa002: 'Pixel width',
  0xa003: 'Pixel height',
  0xa430: 'Camera owner',
  0xa431: 'Body serial',
  0xa433: 'Lens make',
  0xa434: 'Lens model',
  0xa435: 'Lens serial',
  0x8825: 'GPS block',
  0x8769: 'Exif block',
};

const GPS_TAGS = {
  0x0001: 'GPS latitude ref',
  0x0002: 'GPS latitude',
  0x0003: 'GPS longitude ref',
  0x0004: 'GPS longitude',
  0x0006: 'GPS altitude',
  0x0007: 'GPS timestamp',
  0x001d: 'GPS date',
};

const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

const readValue = (view, offset, type, count, tiffStart, little) => {
  const size = SIZES[type] ?? 1;
  const total = size * count;
  const start = total > 4 ? tiffStart + view.getUint32(offset + 8, little) : offset + 8;
  if (start + total > view.byteLength) return null;

  if (type === 2) {
    let text = '';
    for (let index = 0; index < count - 1; index += 1) text += String.fromCharCode(view.getUint8(start + index));
    return text.replace(/\0+$/, '');
  }

  const values = [];
  for (let index = 0; index < count && index < 8; index += 1) {
    const at = start + index * size;
    if (type === 1 || type === 7) values.push(view.getUint8(at));
    else if (type === 3) values.push(view.getUint16(at, little));
    else if (type === 4) values.push(view.getUint32(at, little));
    else if (type === 5) values.push(`${view.getUint32(at, little)}/${view.getUint32(at + 4, little)}`);
    else if (type === 9) values.push(view.getInt32(at, little));
    else if (type === 10) values.push(`${view.getInt32(at, little)}/${view.getInt32(at + 4, little)}`);
  }
  return values.join(', ');
};

const readIfd = (view, offset, tiffStart, little, names, into) => {
  if (offset + 2 > view.byteLength) return;
  const entries = view.getUint16(offset, little);
  for (let index = 0; index < entries; index += 1) {
    const entry = offset + 2 + index * 12;
    if (entry + 12 > view.byteLength) return;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const count = view.getUint32(entry + 4, little);

    if (tag === 0x8769 || tag === 0x8825) {
      const sub = tiffStart + view.getUint32(entry + 8, little);
      readIfd(view, sub, tiffStart, little, tag === 0x8825 ? GPS_TAGS : names, into);
      continue;
    }

    const name = names[tag];
    if (!name) continue;
    const value = readValue(view, entry, type, count, tiffStart, little);
    if (value !== null && value !== '') into.push({ tag, name, value: String(value) });
  }
};

const segments = (buffer) => {
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xffd8) return null;

  const found = [];
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    found.push({ marker, start: offset, length: length + 2 });
    if (marker === 0xda) break;
    offset += 2 + length;
  }
  return found;
};

const readExif = (buffer) => {
  const found = segments(buffer);
  if (!found) return { tags: [], app: [] };

  const view = new DataView(buffer);
  const tags = [];

  found
    .filter((segment) => segment.marker === 0xe1)
    .forEach((segment) => {
      const header = segment.start + 4;
      let text = '';
      for (let index = 0; index < 4; index += 1) text += String.fromCharCode(view.getUint8(header + index));
      if (text !== 'Exif') return;

      const tiffStart = header + 6;
      const little = view.getUint16(tiffStart) === 0x4949;
      const first = view.getUint32(tiffStart + 4, little);
      readIfd(view, tiffStart + first, tiffStart, little, EXIF_TAGS, tags);
    });

  return { tags, app: found.filter((segment) => segment.marker >= 0xe0 && segment.marker <= 0xef) };
};

const stripMetadata = (buffer, { keepIcc }) => {
  const found = segments(buffer);
  if (!found) return null;

  const drop = found.filter((segment) => {
    if (segment.marker === 0xfe) return true;
    if (segment.marker < 0xe0 || segment.marker > 0xef) return false;
    if (segment.marker === 0xe0) return false;
    if (segment.marker === 0xe2 && keepIcc) return false;
    return true;
  });

  const size = buffer.byteLength - drop.reduce((total, segment) => total + segment.length, 0);
  const out = new Uint8Array(size);
  const source = new Uint8Array(buffer);
  let cursor = 0;
  let position = 0;

  drop
    .sort((a, b) => a.start - b.start)
    .forEach((segment) => {
      out.set(source.subarray(position, segment.start), cursor);
      cursor += segment.start - position;
      position = segment.start + segment.length;
    });

  out.set(source.subarray(position), cursor);
  return out;
};

class ExifEditor extends JGApp {
  static appId = 'exif-editor';
  static styles = [...JGApp.styles, sheet];

  #file = null;
  #buffer = null;
  #url = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="drop" id="drop">Drop a JPEG here, or click to choose one</div>

      <div class="split" id="body" hidden>
        <div class="stack tight">
          <div class="shot"><img id="preview" alt="Preview" /></div>
          <div class="kv" id="file"></div>
        </div>
        <div class="stack tight">
          <jg-card title="Metadata" sub="Untick a tag to drop it from the saved copy">
            <div class="tags" id="tags"></div>
          </jg-card>
          <div class="row">
            <jg-switch id="keep-icc" checked></jg-switch><span class="hint">Keep the colour profile</span>
          </div>
          <div class="row">
            <jg-button size="sm" id="save">Save cleaned copy</jg-button>
            <jg-button size="sm" variant="outline" id="save-all">Strip everything</jg-button>
            <jg-button size="sm" variant="ghost" id="copy-json">Copy metadata as JSON</jg-button>
          </div>
        </div>
      </div>

      <div class="hint">
        JPEG metadata is read and rewritten in the browser. Removing a tag rewrites the file without the segment
        that carries it, which is why the whole Exif block goes together.
      </div>

      <input type="file" id="picker" accept="image/jpeg" hidden />
    </div>`);

    const picker = this.$('#picker');
    const drop = this.$('#drop');

    this.on(drop, 'click', () => picker.click());
    this.on(picker, 'change', () => this.#load(picker.files[0]));
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

    this.on(this.$('#save'), 'click', () => this.#save(true));
    this.on(this.$('#save-all'), 'click', () => this.#save(false));
    this.on(this.$('#copy-json'), 'click', () => {
      const tags = readExif(this.#buffer).tags;
      navigator.clipboard?.writeText(JSON.stringify(Object.fromEntries(tags.map((tag) => [tag.name, tag.value])), null, 2));
      toast('Metadata copied');
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#url) URL.revokeObjectURL(this.#url);
  }

  async #load(file) {
    if (!file) return;
    if (!/jpe?g/i.test(file.type)) {
      toast('Only JPEG files carry Exif metadata', 'error');
      return;
    }

    this.#file = file;
    this.#buffer = await file.arrayBuffer();

    if (this.#url) URL.revokeObjectURL(this.#url);
    this.#url = URL.createObjectURL(file);
    this.$('#preview').src = this.#url;
    this.$('#body').hidden = false;
    this.$('#drop').textContent = `${file.name} - ${formatBytes(file.size)}`;

    const { tags, app } = readExif(this.#buffer);
    const metaBytes = app.reduce((total, segment) => total + segment.length, 0);

    this.$('#file').innerHTML = html`
      <div>Name</div><div class="mono">${file.name}</div>
      <div>Size</div><div>${formatBytes(file.size)}</div>
      <div>Type</div><div class="mono">${file.type}</div>
      <div>Metadata</div><div>${formatBytes(metaBytes)} in ${app.length} segment${app.length === 1 ? '' : 's'}</div>
    `;

    this.$('#tags').innerHTML = tags.length
      ? tags
          .map(
            (tag) => html`<div class="tag" data-tag="${tag.tag}">
              <span class="name">${tag.name}</span>
              <jg-input size="sm" mono value="${tag.value}" readonly></jg-input>
              <jg-switch checked data-keep="${tag.tag}"></jg-switch>
            </div>`,
          )
          .join('')
      : html`<span class="hint">No Exif tags found in this file.</span>`;

    this.bind('[data-keep]', 'change', (event) => {
      event.currentTarget.closest('.tag').classList.toggle('removed', !event.detail.checked);
    });
  }

  #save(keepIcc) {
    if (!this.#buffer) return;
    const bytes = stripMetadata(this.#buffer, { keepIcc: keepIcc && this.$('#keep-icc').checked });
    if (!bytes) {
      toast('That file is not a JPEG', 'error');
      return;
    }
    const name = this.#file.name.replace(/\.jpe?g$/i, '');
    download(`${name}-clean.jpg`, bytes, 'image/jpeg');
    toast(`Saved without metadata, ${formatBytes(this.#buffer.byteLength - bytes.byteLength)} removed`);
  }
}

define('jg-app-exif-editor', ExifEditor);
