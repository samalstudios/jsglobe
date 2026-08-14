import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { icon } from './icons.js';
import { formatBytes } from '../core/util.js';

const sheet = css`
  :host { display: block; flex: none; }
  :host([hidden]) { display: none; }
  .zone {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: var(--drop-height, 120px);
    padding: 16px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--muted-foreground);
    font-size: 13px;
    text-align: center;
    cursor: pointer;
    width: 100%;
    font-family: inherit;
    transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
  }
  .zone:hover { border-color: var(--border-strong); background: color-mix(in srgb, var(--muted) 40%, transparent); }
  .zone[data-over="true"] {
    border-color: var(--ring);
    background: color-mix(in srgb, var(--ring) 10%, transparent);
    color: var(--foreground);
  }
  .zone svg { opacity: 0.7; }
  .label { font-weight: 500; color: var(--foreground); }
  .hint { font-size: 11.5px; }
  input { display: none; }
`;

class JGDrop extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['label', 'hint'];

  #files = [];

  get files() {
    return this.#files;
  }

  reset() {
    this.#files = [];
    this.refresh();
  }

  describe(text) {
    const label = this.$('.label');
    if (label) label.textContent = text;
  }

  render() {
    const label = this.getAttribute('label') ?? 'Drop a file here, or click to choose one';
    const hint = this.getAttribute('hint') ?? '';

    this.paint(html`
      <button class="zone" type="button">
        ${icon(this.getAttribute('icon') ?? 'external', 20)}
        <span class="label">${label}</span>
        ${hint ? html`<span class="hint">${hint}</span>` : ''}
      </button>
      <input
        type="file"
        ${this.hasAttribute('multiple') ? 'multiple' : ''}
        accept="${this.getAttribute('accept') ?? ''}"
      />
    `);

    const zone = this.$('.zone');
    const input = this.$('input');

    this.on(zone, 'click', () => input.click());
    this.on(input, 'change', () => this.#accept([...input.files]));

    this.on(zone, 'dragover', (event) => {
      event.preventDefault();
      zone.dataset.over = 'true';
    });
    this.on(zone, 'dragleave', () => {
      zone.dataset.over = 'false';
    });
    this.on(zone, 'drop', (event) => {
      event.preventDefault();
      zone.dataset.over = 'false';
      this.#accept([...(event.dataTransfer?.files ?? [])]);
    });
  }

  #accept(files) {
    const accept = this.getAttribute('accept');
    const allowed = accept
      ? files.filter((file) =>
          accept
            .split(',')
            .map((entry) => entry.trim().toLowerCase())
            .some((entry) =>
              entry.startsWith('.')
                ? file.name.toLowerCase().endsWith(entry)
                : entry.endsWith('/*')
                  ? file.type.startsWith(entry.slice(0, -1))
                  : file.type === entry,
            ),
        )
      : files;

    if (!allowed.length) {
      this.emit('drop:reject', { files });
      return;
    }

    this.#files = this.hasAttribute('multiple') ? allowed : allowed.slice(0, 1);
    this.describe(
      this.#files.length === 1
        ? `${this.#files[0].name} - ${formatBytes(this.#files[0].size)}`
        : `${this.#files.length} files selected`,
    );
    this.emit('drop:files', { files: this.#files, file: this.#files[0] });
  }

  attributeChangedCallback(name, previous, next) {
    if (previous !== next && this.$('.zone')) this.refresh();
  }
}

define('jg-drop', JGDrop);
