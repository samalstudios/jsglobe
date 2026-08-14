import { JGApp, define, html, css } from '../core/app.js';
import { download, toast, formatBytes } from '../core/util.js';

const sheet = css`
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
    text-align: center;
    padding: 12px;
  }
  .drop[data-over="true"] { border-color: var(--ring); color: var(--foreground); }
  .drop { min-height: 88px; }

  .shell { display: grid; grid-template-columns: 290px 1fr; gap: 14px; flex: 1; min-height: 0; }
  @media (max-width: 900px) { .shell { grid-template-columns: 1fr; } }
  .list-pane { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .list-head { display: flex; align-items: center; gap: 8px; }
  .list {
    flex: 1;
    min-height: 160px;
    overflow: auto;
    display: grid;
    gap: 3px;
    align-content: start;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 40%, transparent);
    scrollbar-width: thin;
  }
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 5px 7px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
  }
  .row[data-current="true"] { background: var(--card); border-color: transparent; box-shadow: var(--shadow-raise); }
  .row:hover { background: color-mix(in srgb, var(--card) 70%, transparent); }
  .open {
    display: grid;
    gap: 1px;
    min-width: 0;
    text-align: left;
    border: 0;
    background: none;
    padding: 0;
    cursor: pointer;
    color: var(--foreground);
    font-family: inherit;
  }
  .open .name { font-size: 12.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .open .sub { font-size: 11px; color: var(--muted-foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mark { font-family: var(--font-mono); font-size: 11px; color: var(--muted-foreground); }
  .mark[data-dirty="true"]::after { content: " *"; color: var(--warning); }

  .edit { min-width: 0; overflow: auto; scrollbar-width: thin; }
  .split { display: grid; grid-template-columns: 190px 1fr; gap: 14px; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .cover {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 55%, transparent);
    color: var(--muted-foreground);
    font-size: 12px;
    overflow: hidden;
  }
  .cover img { width: 100%; height: 100%; object-fit: cover; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 620px) { .fields { grid-template-columns: 1fr; } }
`;

const FRAMES = {
  TIT2: { key: 'title', label: 'Title' },
  TPE1: { key: 'artist', label: 'Artist' },
  TPE2: { key: 'albumArtist', label: 'Album artist' },
  TALB: { key: 'album', label: 'Album' },
  TYER: { key: 'year', label: 'Year' },
  TDRC: { key: 'year', label: 'Year' },
  TRCK: { key: 'track', label: 'Track' },
  TPOS: { key: 'disc', label: 'Disc' },
  TCON: { key: 'genre', label: 'Genre' },
  TCOM: { key: 'composer', label: 'Composer' },
  TPUB: { key: 'publisher', label: 'Publisher' },
  TBPM: { key: 'bpm', label: 'BPM' },
  COMM: { key: 'comment', label: 'Comment' },
};

const WRITE_ORDER = [
  ['TIT2', 'title'],
  ['TPE1', 'artist'],
  ['TPE2', 'albumArtist'],
  ['TALB', 'album'],
  ['TYER', 'year'],
  ['TRCK', 'track'],
  ['TPOS', 'disc'],
  ['TCON', 'genre'],
  ['TCOM', 'composer'],
  ['TPUB', 'publisher'],
  ['TBPM', 'bpm'],
];

const GENRES = [
  'Blues', 'Classical', 'Country', 'Dance', 'Electronic', 'Folk', 'Hip-Hop', 'Jazz', 'Metal',
  'Pop', 'Punk', 'R&B', 'Reggae', 'Rock', 'Soundtrack', 'Techno', 'Ambient', 'Podcast',
];

const syncsafe = (value) => [(value >> 21) & 0x7f, (value >> 14) & 0x7f, (value >> 7) & 0x7f, value & 0x7f];

const readSyncsafe = (view, offset) =>
  (view.getUint8(offset) << 21) | (view.getUint8(offset + 1) << 14) | (view.getUint8(offset + 2) << 7) | view.getUint8(offset + 3);

const decodeText = (bytes) => {
  const encoding = bytes[0];
  const body = bytes.subarray(1);
  if (encoding === 0) return new TextDecoder('windows-1252').decode(body).replace(/\0+$/, '');
  if (encoding === 3) return new TextDecoder('utf-8').decode(body).replace(/\0+$/, '');
  const little = body[0] === 0xff && body[1] === 0xfe;
  const start = body[0] === 0xff || body[0] === 0xfe ? 2 : 0;
  return new TextDecoder(little || start === 0 ? 'utf-16le' : 'utf-16be').decode(body.subarray(start)).replace(/\0+$/, '');
};

const readTag = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const empty = { tags: {}, cover: null, size: 0, version: null };

  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return empty;

  const major = bytes[3];
  const size = readSyncsafe(view, 6);
  const tags = {};
  let cover = null;
  let offset = 10;
  const end = Math.min(10 + size, bytes.length);

  while (offset + 10 <= end) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const frameSize = major === 4 ? readSyncsafe(view, offset + 4) : view.getUint32(offset + 4);
    if (frameSize <= 0 || offset + 10 + frameSize > end) break;

    const body = bytes.subarray(offset + 10, offset + 10 + frameSize);

    if (id === 'APIC') {
      const encoding = body[0];
      let cursor = 1;
      let mime = '';
      while (cursor < body.length && body[cursor] !== 0) mime += String.fromCharCode(body[cursor++]);
      cursor += 2;
      const step = encoding === 1 || encoding === 2 ? 2 : 1;
      while (cursor < body.length) {
        if (body[cursor] === 0 && (step === 1 || body[cursor + 1] === 0)) {
          cursor += step;
          break;
        }
        cursor += step;
      }
      cover = { mime: mime || 'image/jpeg', data: body.slice(cursor) };
    } else if (FRAMES[id]) {
      const text = decodeText(body);
      tags[FRAMES[id].key] = id === 'COMM' ? text.split('\0').pop() : text;
    }

    offset += 10 + frameSize;
  }

  return { tags, cover, size: size + 10, version: `2.${major}` };
};

const textFrame = (id, text) => {
  const body = new TextEncoder().encode(text);
  const frame = new Uint8Array(10 + 1 + body.length);
  [...id].forEach((character, index) => (frame[index] = character.charCodeAt(0)));
  const view = new DataView(frame.buffer);
  view.setUint32(4, body.length + 1);
  frame[10] = 3;
  frame.set(body, 11);
  return frame;
};

const commentFrame = (text) => {
  const body = new TextEncoder().encode(text);
  const frame = new Uint8Array(10 + 5 + body.length);
  [...'COMM'].forEach((character, index) => (frame[index] = character.charCodeAt(0)));
  new DataView(frame.buffer).setUint32(4, body.length + 5);
  frame[10] = 3;
  frame[11] = 0x65;
  frame[12] = 0x6e;
  frame[13] = 0x67;
  frame[14] = 0;
  frame.set(body, 15);
  return frame;
};

const pictureFrame = (cover) => {
  const mime = new TextEncoder().encode(cover.mime);
  const frame = new Uint8Array(10 + 1 + mime.length + 1 + 1 + 1 + cover.data.length);
  [...'APIC'].forEach((character, index) => (frame[index] = character.charCodeAt(0)));
  new DataView(frame.buffer).setUint32(4, frame.length - 10);
  let cursor = 10;
  frame[cursor++] = 3;
  frame.set(mime, cursor);
  cursor += mime.length;
  frame[cursor++] = 0;
  frame[cursor++] = 3;
  frame[cursor++] = 0;
  frame.set(cover.data, cursor);
  return frame;
};

const writeTag = (buffer, tags, cover) => {
  const existing = readTag(buffer);
  const audio = new Uint8Array(buffer).subarray(existing.size);

  const frames = WRITE_ORDER.filter(([, key]) => (tags[key] ?? '').trim()).map(([id, key]) => textFrame(id, tags[key].trim()));
  if ((tags.comment ?? '').trim()) frames.push(commentFrame(tags.comment.trim()));
  if (cover) frames.push(pictureFrame(cover));

  const body = frames.reduce((total, frame) => total + frame.length, 0);
  const out = new Uint8Array(10 + body + audio.length);

  out.set([0x49, 0x44, 0x33, 3, 0, 0], 0);
  out.set(syncsafe(body), 6);

  let cursor = 10;
  frames.forEach((frame) => {
    out.set(frame, cursor);
    cursor += frame.length;
  });
  out.set(audio, cursor);
  return out;
};

const uid = () => Math.random().toString(36).slice(2, 9);

const SHARED = ['artist', 'albumArtist', 'album', 'year', 'genre', 'composer', 'publisher', 'bpm', 'comment'];
const ALL_KEYS = [...new Set(Object.values(FRAMES).map((frame) => frame.key))];

const titleFromName = (name) =>
  name
    .replace(/\.mp3$/i, '')
    .replace(/^\s*\d{1,3}\s*[-._)]\s*/, '')
    .replace(/_/g, ' ')
    .trim();

const trackFromName = (name) => {
  const match = /^\s*(\d{1,3})\s*[-._)]/.exec(name);
  return match ? String(Number(match[1])) : '';
};

class Mp3Metadata extends JGApp {
  static appId = 'mp3-metadata';
  static styles = [...JGApp.styles, sheet];

  #tracks = [];
  #current = null;
  #coverUrl = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="drop" id="drop">Drop MP3 files here, or click to choose them</div>

      <div class="shell" id="body" hidden>
        <div class="list-pane">
          <div class="list-head">
            <jg-switch id="select-all" checked></jg-switch>
            <span class="hint" id="counts"></span>
          </div>
          <div class="list" id="list"></div>
        </div>

        <div class="edit">
          <div class="split">
            <div class="stack tight">
              <div class="cover" id="cover">No artwork</div>
              <jg-button size="sm" variant="outline" id="pick-cover">Replace artwork</jg-button>
              <jg-button size="sm" variant="ghost" id="drop-cover">Remove artwork</jg-button>
            </div>

            <div class="stack tight">
              <div class="fields">
                <jg-field label="Title"><jg-input id="title"></jg-input></jg-field>
                <jg-field label="Artist"><jg-input id="artist"></jg-input></jg-field>
                <jg-field label="Album"><jg-input id="album"></jg-input></jg-field>
                <jg-field label="Album artist"><jg-input id="albumArtist"></jg-input></jg-field>
                <jg-field label="Year"><jg-input id="year" placeholder="2026"></jg-input></jg-field>
                <jg-field label="Track"><jg-input id="track" placeholder="1/12"></jg-input></jg-field>
                <jg-field label="Disc"><jg-input id="disc" placeholder="1/1"></jg-input></jg-field>
                <jg-field label="Genre"><jg-input id="genre" placeholder="${GENRES.slice(0, 3).join(', ')}"></jg-input></jg-field>
                <jg-field label="Composer"><jg-input id="composer"></jg-input></jg-field>
                <jg-field label="Publisher"><jg-input id="publisher"></jg-input></jg-field>
                <jg-field label="BPM"><jg-input id="bpm" type="number" min="0" max="400"></jg-input></jg-field>
              </div>
              <jg-field label="Comment"><jg-textarea id="comment" rows="2" sans></jg-textarea></jg-field>
              <div class="kv" id="file"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="hint">
        Tags are read from and written back as ID3v2.3. Batch actions only touch the ticked files, and the audio
        frames are copied through untouched.
      </div>

      <input type="file" id="picker" accept="audio/mpeg,.mp3" multiple hidden />
      <input type="file" id="art" accept="image/*" hidden />
    </div>`);

    this.setActions([
      { id: 'add', label: 'Add files', icon: 'plus' },
      { separator: true },
      { id: 'apply', label: 'Apply shared fields', icon: 'copy', title: 'Copy artist, album, year and the rest to every ticked file' },
      { id: 'number', label: 'Number tracks', icon: 'list', title: 'Number the ticked files in list order' },
      { id: 'from-name', label: 'Titles from filenames', icon: 'type', title: 'Read the title and track number from each filename' },
      { spacer: true },
      { id: 'save', label: 'Save selected', icon: 'music' },
      { id: 'remove', label: 'Remove', icon: 'close', danger: true },
    ].map((item) => (item.id ? { ...item, action: () => this.#action(item.id) } : item)));

    const picker = this.$('#picker');
    const drop = this.$('#drop');

    this.on(drop, 'click', () => picker.click());
    this.on(picker, 'change', () => this.#load(picker.files));
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
      this.#load(event.dataTransfer.files);
    });

    ALL_KEYS.forEach((key) => {
      const node = this.$(`#${key}`);
      if (node) this.on(node, 'input', () => this.#capture());
    });

    this.on(this.$('#select-all'), 'change', (event) => {
      this.#tracks.forEach((track) => {
        track.selected = event.detail.checked;
      });
      this.#paintList();
    });

    this.on(this.$('#pick-cover'), 'click', () => this.$('#art').click());
    this.on(this.$('#art'), 'change', async () => {
      const image = this.$('#art').files[0];
      if (!image || !this.#current) return;
      this.#current.cover = { mime: image.type || 'image/jpeg', data: new Uint8Array(await image.arrayBuffer()) };
      this.#current.dirty = true;
      this.#paintCover();
      this.#paintList();
    });
    this.on(this.$('#drop-cover'), 'click', () => {
      if (!this.#current) return;
      this.#current.cover = null;
      this.#current.dirty = true;
      this.#paintCover();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#coverUrl) URL.revokeObjectURL(this.#coverUrl);
  }

  async #load(files) {
    const list = [...(files ?? [])].filter((file) => /mpeg|mp3/i.test(file.type) || /\.mp3$/i.test(file.name));
    if (!list.length) {
      toast('Choose one or more MP3 files', 'error');
      return;
    }

    for (const file of list) {
      const buffer = await file.arrayBuffer();
      const { tags, cover, size, version } = readTag(buffer);
      this.#tracks.push({
        id: uid(),
        file,
        buffer,
        cover,
        version,
        tagSize: size,
        selected: true,
        dirty: false,
        tags: Object.fromEntries(ALL_KEYS.map((key) => [key, tags[key] ?? ''])),
      });
    }

    this.$('#body').hidden = false;
    this.$('#drop').textContent = `${this.#tracks.length} file${this.#tracks.length === 1 ? '' : 's'} loaded, drop more or click to add`;
    if (!this.#current) this.#select(this.#tracks[0]);
    this.#paintList();
  }

  #paintList() {
    const selected = this.#tracks.filter((track) => track.selected).length;
    this.$('#counts').textContent = `${selected} of ${this.#tracks.length} selected`;

    this.$('#list').innerHTML = this.#tracks
      .map(
        (track) => html`<div class="row" data-id="${track.id}" data-current="${String(track === this.#current)}">
          <jg-switch ${track.selected ? 'checked' : ''} data-pick="${track.id}"></jg-switch>
          <button class="open" data-open="${track.id}">
            <span class="name">${track.tags.title || track.file.name}</span>
            <span class="sub">${[track.tags.artist, track.tags.album].filter(Boolean).join(' - ') || 'No artist or album'}</span>
          </button>
          <span class="mark" data-dirty="${String(track.dirty)}">${track.tags.track || ''}</span>
        </div>`,
      )
      .join('');

    this.bind('[data-pick]', 'change', (event) => {
      const track = this.#find(event.currentTarget.dataset.pick);
      if (track) track.selected = event.detail.checked;
      this.$('#counts').textContent = `${this.#tracks.filter((item) => item.selected).length} of ${this.#tracks.length} selected`;
    });

    this.bind('[data-open]', 'click', (event) => {
      this.#select(this.#find(event.currentTarget.dataset.open));
      this.#paintList();
    });
  }

  #find(id) {
    return this.#tracks.find((track) => track.id === id) ?? null;
  }

  #select(track) {
    this.#current = track ?? null;
    if (!track) return;

    ALL_KEYS.forEach((key) => {
      const node = this.$(`#${key}`);
      if (node) node.value = track.tags[key] ?? '';
    });

    this.$('#file').innerHTML = html`
      <div>Name</div><div class="mono">${track.file.name}</div>
      <div>Size</div><div>${formatBytes(track.file.size)}</div>
      <div>Tag</div><div>${track.version ? `ID3v${track.version}, ${formatBytes(track.tagSize)}` : 'none found'}</div>
      <div>Audio</div><div>${formatBytes(track.file.size - track.tagSize)}</div>
    `;

    this.#paintCover();
  }

  #capture() {
    if (!this.#current) return;
    ALL_KEYS.forEach((key) => {
      const node = this.$(`#${key}`);
      if (node) this.#current.tags[key] = node.value;
    });
    this.#current.dirty = true;
    this.#paintList();
  }

  #paintCover() {
    const node = this.$('#cover');
    if (this.#coverUrl) URL.revokeObjectURL(this.#coverUrl);

    const cover = this.#current?.cover;
    if (!cover?.data?.length) {
      this.#coverUrl = null;
      node.textContent = 'No artwork';
      return;
    }

    this.#coverUrl = URL.createObjectURL(new Blob([cover.data], { type: cover.mime }));
    node.innerHTML = html`<img src="${this.#coverUrl}" alt="Artwork" />`;
  }

  #selection() {
    return this.#tracks.filter((track) => track.selected);
  }

  #action(id) {
    if (id === 'add') return this.$('#picker').click();

    const selection = this.#selection();
    if (!selection.length) {
      toast('Tick at least one file first', 'error');
      return undefined;
    }

    if (id === 'apply') return this.#applyShared(selection);
    if (id === 'number') return this.#numberTracks(selection);
    if (id === 'from-name') return this.#titlesFromNames(selection);
    if (id === 'save') return this.#saveAll(selection);
    if (id === 'remove') return this.#remove(selection);
    return undefined;
  }

  #applyShared(selection) {
    if (!this.#current) return;
    const source = this.#current;
    const fields = SHARED.filter((key) => (source.tags[key] ?? '').trim());

    selection.forEach((track) => {
      if (track === source) return;
      fields.forEach((key) => {
        track.tags[key] = source.tags[key];
      });
      if (source.cover) track.cover = source.cover;
      track.dirty = true;
    });

    this.#paintList();
    toast(`${fields.length} field${fields.length === 1 ? '' : 's'} copied to ${selection.length} files`);
  }

  #numberTracks(selection) {
    selection.forEach((track, index) => {
      track.tags.track = `${index + 1}/${selection.length}`;
      track.dirty = true;
    });
    if (this.#current) this.#select(this.#current);
    this.#paintList();
    toast(`Numbered ${selection.length} files`);
  }

  #titlesFromNames(selection) {
    selection.forEach((track) => {
      track.tags.title = titleFromName(track.file.name);
      const number = trackFromName(track.file.name);
      if (number) track.tags.track = number;
      track.dirty = true;
    });
    if (this.#current) this.#select(this.#current);
    this.#paintList();
    toast(`Titles read from ${selection.length} filenames`);
  }

  #remove(selection) {
    this.#tracks = this.#tracks.filter((track) => !selection.includes(track));
    if (selection.includes(this.#current)) this.#select(this.#tracks[0] ?? null);
    if (!this.#tracks.length) {
      this.$('#body').hidden = true;
      this.$('#drop').textContent = 'Drop MP3 files here, or click to choose them';
    }
    this.#paintList();
  }

  async #saveAll(selection) {
    for (const [index, track] of selection.entries()) {
      const bytes = writeTag(track.buffer, track.tags, track.cover);
      const name = track.tags.title ? `${track.tags.track ? `${String(track.tags.track).split('/')[0].padStart(2, '0')} ` : ''}${track.tags.title}` : track.file.name.replace(/\.mp3$/i, '');
      download(`${name.replace(/[\\/:*?"<>|]/g, '-')}.mp3`, bytes, 'audio/mpeg');
      track.dirty = false;
      if (index < selection.length - 1) await new Promise((resolve) => setTimeout(resolve, 350));
    }
    this.#paintList();
    toast(`Saved ${selection.length} file${selection.length === 1 ? '' : 's'}`);
  }
}

define('jg-app-mp3-metadata', Mp3Metadata);
