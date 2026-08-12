import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { workspaces } from '../core/workspaces.js';
import { settings } from '../core/settings.js';
import { router } from '../core/router.js';
import { bus } from '../core/bus.js';
import { contextMenu } from './jg-menu.js';
import { icon } from './icons.js';

const sheet = css`
  :host {
    position: relative;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 44px;
    padding: 0 16px;
    flex: none;
    color: var(--foreground);
    font-size: 12.5px;
    user-select: none;
  }
  .side { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .side.right { margin-left: auto; }
  .brand {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 9px 4px 5px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    font: 600 12.5px/1 var(--font-sans);
    letter-spacing: -0.01em;
    cursor: pointer;
    text-decoration: none;
  }
  .brand:hover { background: var(--glass); border-color: var(--glass-border); text-decoration: none; }
  .mark {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: linear-gradient(160deg, #7c8bff, #4338ca);
    color: #fff;
    font-size: 11px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: var(--glass);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    color: inherit;
    font: 500 12px/1 var(--font-sans);
    cursor: pointer;
    white-space: nowrap;
  }
  .chip:hover { border-color: var(--border-strong); }
  .dot { width: 7px; height: 7px; border-radius: 999px; background: var(--tint, var(--ring)); }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    opacity: 0.8;
    transition: background 0.15s ease, opacity 0.15s ease;
  }
  .icon-btn svg { width: 17px; height: 17px; stroke-width: 1.75; }
  .icon-btn:hover { background: var(--glass); border-color: var(--glass-border); opacity: 1; }
  .clock { font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: 0.01em; }
  .date { color: color-mix(in srgb, var(--foreground) 66%, transparent); }
  @media (max-width: 620px) {
    .date, .brand span:not(.mark) { display: none; }
  }
`;

class JGStatusbar extends JGElement {
  static styles = [base, sheet];

  #timer = null;

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('workspace:switch', () => this.refresh()));
    this.keep(bus.on('workspaces:change', () => this.refresh()));
    this.keep(bus.on('settings:change', () => this.refresh()));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  render() {
    const workspace = workspaces.active();
    this.paint(html`
      <div class="side">
        <a class="brand" href="${router.href('/')}">
          <span class="mark">◍</span>
          <span>JS Globe</span>
        </a>
        <button class="chip workspace" style="--tint:${workspace.tint}">
          <span class="dot"></span>
          <span>${workspace.name}</span>
          <span style="opacity:.5">▾</span>
        </button>
      </div>
      <div class="side right">
        <button class="icon-btn widgets" title="Toggle widgets" aria-label="Toggle widgets">${icon('widgets', 17)}</button>
        <button class="icon-btn search" title="Search (⌘K)" aria-label="Search">${icon('search', 17)}</button>
        <button class="icon-btn settings" title="Settings" aria-label="Settings">${icon('gear', 17)}</button>
        <span class="date"></span>
        <span class="clock"></span>
      </div>
    `);

    this.on(this.$('.workspace'), 'click', (event) => this.#workspaceMenu(event));
    this.on(this.$('.search'), 'click', () => bus.emit('spotlight:open'));
    this.on(this.$('.settings'), 'click', () => router.app('settings'));
    this.on(this.$('.widgets'), 'click', () => bus.emit('home:toggle-widgets'));

    this.#tick();
    clearInterval(this.#timer);
    this.#timer = setInterval(() => this.#tick(), 10000);
    this.track(() => clearInterval(this.#timer));
  }

  #tick() {
    const clock = this.$('.clock');
    const date = this.$('.date');
    if (!clock) return;
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    date.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  #workspaceMenu(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const active = workspaces.activeId;
    contextMenu({
      x: rect.left,
      y: rect.bottom + 6,
      title: 'Workspaces',
      items: [
        ...workspaces.all().map((workspace) => ({
          label: workspace.name,
          glyph: workspace.id === active ? '✓' : workspace.kind === 'team' ? '⚭' : '·',
          action: () => workspaces.switchTo(workspace.id),
        })),
        { separator: true },
        {
          label: 'New workspace',
          glyph: '＋',
          action: () => {
            const name = prompt('Workspace name');
            if (name) workspaces.switchTo(workspaces.create({ name }).id);
          },
        },
        { label: 'Manage in settings', glyph: '⚙', action: () => router.app('settings') },
      ],
    });
  }
}

define('jg-statusbar', JGStatusbar);
