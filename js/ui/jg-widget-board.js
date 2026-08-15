import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { layout } from '../core/layout.js';
import { bus } from '../core/bus.js';
import { router } from '../core/router.js';
import { contextMenu } from './jg-menu.js';
import { icon } from './icons.js';

const sheet = css`
  :host {
    display: block;
    height: 100%;
    overflow: auto;
    scrollbar-width: none;
  }
  :host::-webkit-scrollbar { display: none; }
  .board {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 14px;
    align-content: start;
    padding: 2px;
  }
  .widget {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 168px;
    border-radius: var(--radius-xl);
    background: var(--glass);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-md);
    overflow: hidden;
    transition: transform 0.16s ease, box-shadow 0.16s ease;
  }
  .widget:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .widget[data-size="wide"] { grid-column: span 2; }
  .widget[data-size="tall"] { grid-row: span 2; min-height: 350px; }
  .widget[data-size="large"] { grid-column: span 2; grid-row: span 2; min-height: 350px; }
  @media (max-width: 620px) {
    .widget[data-size="wide"], .widget[data-size="large"] { grid-column: span 1; }
  }
  .head {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 10px 12px 6px;
    flex: none;
  }
  .badge {
    display: grid;
    place-items: center;
    width: 17px;
    height: 17px;
    border-radius: 5px;
    background: var(--tint);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 8.5px;
    font-weight: 700;
  }
  .name {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--muted-foreground);
    letter-spacing: 0.01em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .more {
    margin-left: auto;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    opacity: 0;
    font-size: 12px;
  }
  .widget:hover .more { opacity: 1; }
  .more:hover { background: var(--accent); color: var(--foreground); }
  .surface { flex: 1; min-height: 0; overflow: hidden; }
  ::slotted(*), .surface > * { height: 100%; }
  .add {
    display: grid;
    place-items: center;
    gap: 6px;
    min-height: 168px;
    align-self: start;
    border-radius: var(--radius-xl);
    border: 1px dashed var(--glass-border);
    background: color-mix(in srgb, var(--glass) 45%, transparent);
    color: var(--muted-foreground);
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .add:hover { border-color: var(--ring); color: var(--foreground); }
  .add .plus { font-size: 20px; }
  .add[data-empty="true"] {
    min-height: 92px;
    grid-column: 1 / -1;
    max-width: 260px;
    flex-direction: row;
    gap: 8px;
  }
  .add[data-empty="true"] .plus { font-size: 17px; }

  :host([compact]) .add[data-empty="true"] {
    display: flex;
    flex-direction: row;
    align-items: center;
    min-height: 0;
    max-width: max-content;
    justify-self: center;
    padding: 6px 12px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    gap: 6px;
    font-size: 12px;
    opacity: 0.75;
  }
  :host([compact]) .add[data-empty="true"]:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }
  :host([compact]) .add[data-empty="true"] .plus { font-size: 13px; }
`;

class JGWidgetBoard extends JGElement {
  static styles = [base, sheet];

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('layout:change', () => this.refresh()));
    this.keep(bus.on('workspace:switch', () => this.refresh()));
  }

  render() {
    const widgets = layout.widgets();
    this.paint(html`
      <div class="board">
        ${widgets.map((widget) => {
          const meta = registry.find(widget.appId);
          if (!meta) return '';
          return html`<article class="widget" data-size="${widget.size}" data-uid="${widget.uid}" style="--tint:${registry.tint(meta)}">
            <header class="head">
              <span class="badge">${icon(meta.icon, 11)}</span>
              <span class="name">${meta.name}</span>
              <button class="more" title="Widget options">⋯</button>
            </header>
            <div class="surface" data-app="${widget.appId}"></div>
          </article>`;
        })}
        <button class="add" type="button" data-empty="${String(!widgets.length)}">
          <span class="plus">＋</span>
          <span>${widgets.length ? 'Add widget' : 'Add widgets'}</span>
        </button>
      </div>
    `);

    widgets.forEach(async (widget) => {
      const host = this.$(`[data-uid="${widget.uid}"] .surface`);
      if (!host) return;
      const element = await registry.create(widget.appId, 'widget');
      if (element && host.isConnected) host.append(element);
    });

    this.bind('.more', 'click', (event) => {
      event.stopPropagation();
      const card = event.currentTarget.closest('.widget');
      const rect = event.currentTarget.getBoundingClientRect();
      this.#menu(card.dataset.uid, rect.left - 170, rect.bottom + 6);
    });

    this.bind('.widget', 'dblclick', (event) => {
      const uid = event.currentTarget.dataset.uid;
      const widget = layout.widgets().find((item) => item.uid === uid);
      if (widget) router.app(widget.appId);
    });

    this.on(this.$('.add'), 'click', (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      this.#addMenu(rect.left, rect.top - 10);
    });
  }

  #menu(uid, x, y) {
    const widget = layout.widgets().find((item) => item.uid === uid);
    if (!widget) return;
    const meta = registry.find(widget.appId);
    contextMenu({
      x,
      y,
      title: meta.name,
      items: [
        { label: 'Open app', icon: 'external', action: () => router.app(widget.appId) },
        { separator: true },
        ...['small', 'wide', 'tall', 'large'].map((size) => ({
          label: `Size: ${size}`,
          glyph: widget.size === size ? '✓' : '',
          action: () => layout.resizeWidget(uid, size),
        })),
        { separator: true },
        { label: 'Remove widget', icon: 'close', danger: true, action: () => layout.removeWidget(uid) },
      ],
    });
  }

  #addMenu(x, y) {
    const available = registry.all().filter((app) => app.widget);
    contextMenu({
      x,
      y,
      title: 'Add widget',
      items: available.map((app) => ({
        label: app.name,
        glyph: app.glyph,
        action: () => layout.addWidget(app.id, 'small'),
      })),
    });
  }
}

define('jg-widget-board', JGWidgetBoard);
