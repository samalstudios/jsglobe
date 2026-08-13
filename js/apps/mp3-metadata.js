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
  .split { display: grid; grid-template-columns: 200px 1fr; gap: 14px; }
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

class Mp3Metadata extends JGApp {
  static appId = 'mp3-metadata';
  static styles = [...JGApp.styles, sheet];

  #file = null;
  #buffer = null;
  #cover = null;
  #coverUrl = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="drop" id="drop">Drop an MP3 here, or click to choose one</div>

      <div class="split" id="body" hidden>
        <div class="stack tight">
          <div class="cover" id="cover">No artwork</div>
          <jg-button size="sm" variant="outline" id="pick-cover">Replace artwork</jg-button>
          <jg-button size="sm" variant="ghost" id="drop-cover">Remove artwork</jg-button>
          <div class="kv" id="file"></div>
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
            <jg-field label="Genre">
              <jg-input id="genre" list="genres"></jg-input>
            </jg-field>
            <jg-field label="Composer"><jg-input id="composer"></jg-input></jg-field>
            <jg-field label="Publisher"><jg-input id="publisher"></jg-input></jg-field>
            <jg-field label="BPM"><jg-input id="bpm" type="number" min="0" max="400"></jg-input></jg-field>
          </div>
          <jg-field label="Comment"><jg-textarea id="comment" rows="2" sans></jg-textarea></jg-field>

          <div class="row">
            <jg-button size="sm" id="save">Save MP3</jg-button>
            <jg-button size="sm" variant="outline" id="clear">Clear all tags</jg-button>
            <span class="grow"></span>
            <span class="hint">${GENRES.slice(0, 4).join(', ')} and more are accepted in Genre</span>
          </div>
        </div>
      </div>

      <div class="hint">
        Tags are read from and written back as ID3v2.3, which is what music players and phones read. The audio
        frames are copied through untouched.
      </div>

      <input type="file" id="picker" accept="audio/mpeg,.mp3" hidden />
      <input type="file" id="art" accept="image/*" hidden />
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

    this.on(this.$('#pick-cover'), 'click', () => this.$('#art').click());
    this.on(this.$('#art'), 'change', async () => {
      const image = this.$('#art').files[0];
      if (!image) return;
      this.#cover = { mime: image.type || 'image/jpeg', data: new Uint8Array(await image.arrayBuffer()) };
      this.#paintCover();
    });
    this.on(this.$('#drop-cover'), 'click', () => {
      this.#cover = null;
      this.#paintCover();
    });

    this.on(this.$('#save'), 'click', () => this.#save());
    this.on(this.$('#clear'), 'click', () => {
      Object.values(FRAMES).forEach((frame) => {
        const node = this.$(`#${frame.key}`);
        if (node) node.value = '';
      });
      toast('Fields cleared, save to write the file');
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#coverUrl) URL.revokeObjectURL(this.#coverUrl);
  }

  async #load(file) {
    if (!file) return;
    if (!/mpeg|mp3/i.test(file.type) && !/\.mp3$/i.test(file.name)) {
      toast('Choose an MP3 file', 'error');
      return;
    }

    this.#file = file;
    this.#buffer = await file.arrayBuffer();
    const { tags, cover, size, version } = readTag(this.#buffer);

    this.#cover = cover;
    this.$('#body').hidden = false;
    this.$('#drop').textContent = `${file.name} - ${formatBytes(file.size)}`;

    Object.values(FRAMES).forEach((frame) => {
      const node = this.$(`#${frame.key}`);
      if (node) node.value = tags[frame.key] ?? '';
    });

    this.$('#file').innerHTML = html`
      <div>Name</div><div class="mono">${file.name}</div>
      <div>Size</div><div>${formatBytes(file.size)}</div>
      <div>Tag</div><div>${version ? `ID3v${version}, ${formatBytes(size)}` : 'none found'}</div>
      <div>Audio</div><div>${formatBytes(file.size - size)}</div>
    `;

    this.#paintCover();
  }

  #paintCover() {
    const node = this.$('#cover');
    if (this.#coverUrl) URL.revokeObjectURL(this.#coverUrl);

    if (!this.#cover?.data?.length) {
      this.#coverUrl = null;
      node.textContent = 'No artwork';
      return;
    }

    this.#coverUrl = URL.createObjectURL(new Blob([this.#cover.data], { type: this.#cover.mime }));
    node.innerHTML = html`<img src="${this.#coverUrl}" alt="Artwork" />`;
  }

  #save() {
    if (!this.#buffer) return;
    const tags = Object.fromEntries(
      [...new Set(Object.values(FRAMES).map((frame) => frame.key))].map((key) => [key, this.$(`#${key}`)?.value ?? '']),
    );
    const bytes = writeTag(this.#buffer, tags, this.#cover);
    const name = this.#file.name.replace(/\.mp3$/i, '');
    download(`${name}-tagged.mp3`, bytes, 'audio/mpeg');
    toast('Saved with the new tags');
  }
}

define('jg-app-mp3-metadata', Mp3Metadata);
