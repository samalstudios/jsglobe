import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { layout } from '../core/layout.js';
import { icon } from './icons.js';

const sheet = css`
  :host { display: block; -webkit-tap-highlight-color: transparent; }
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    color: inherit;
    font-family: inherit;
    cursor: pointer;
    padding: 0;
  }
  .shell {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(var(--tile, 62px) * 0.07);
    width: var(--tile, 62px);
    height: var(--tile, 62px);
    padding: calc(var(--tile, 62px) * 0.1);
    border-radius: calc(var(--tile, 62px) * 0.29);
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    border: 1px solid var(--glass-border);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: 0 8px 18px -10px rgba(0, 0, 0, 0.6);
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.2);
  }
  button:hover .shell { transform: translateY(-3px) scale(1.04); }
  button:active .shell { transform: scale(0.94); }
  button:focus-visible .shell { box-shadow: var(--shadow-ring); outline: none; }
  .mini {
    display: grid;
    place-items: center;
    border-radius: calc(var(--tile, 62px) * 0.12);
    background: var(--mini-tint, var(--muted));
    color: #fff;
    overflow: hidden;
  }
  .mini svg { width: 62%; height: 62%; stroke-width: 2.1; }
  .mini.empty { background: color-mix(in srgb, var(--foreground) 8%, transparent); }
  .label {
    max-width: calc(var(--tile, 62px) + 26px);
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.25;
    text-align: center;
    color: var(--foreground);
    text-shadow: var(--label-shadow);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }
  :host([no-label]) .label { display: none; }
  :host([editing]) { animation: jiggle 0.32s ease-in-out infinite alternate; }
  :host([dragging]) { opacity: 0.35; }
  @keyframes jiggle {
    from { transform: rotate(-1.1deg); }
    to { transform: rotate(1.1deg); }
  }
`;

class JGFolderTile extends JGElement {
  static styles = [base, sheet];

  get folderId() {
    return this.getAttribute('folder-id');
  }

  render() {
    const folder = layout.folder(this.folderId);
    if (!folder) return this.paint('');
    const previews = folder.items.slice(0, 4).map((id) => registry.find(id)).filter(Boolean);

    this.paint(html`
      <button type="button" title="${folder.name} - ${folder.items.length} tools">
        <span class="shell">
          ${Array.from({ length: 4 }, (unused, index) => {
            const app = previews[index];
            return app
              ? html`<span class="mini" style="--mini-tint:${app.tint}">${icon(app.icon, 24)}</span>`
              : html`<span class="mini empty"></span>`;
          })}
        </span>
        <span class="label">${folder.name}</span>
      </button>
    `);

    this.on(this.$('button'), 'click', () => {
      if (this.hasAttribute('editing')) return;
      this.emit('folder:open', { id: folder.id });
    });
    this.on(this.$('button'), 'contextmenu', (event) => {
      event.preventDefault();
      this.emit('folder:menu', { id: folder.id, x: event.clientX, y: event.clientY });
    });
  }
}

define('jg-folder-tile', JGFolderTile);
