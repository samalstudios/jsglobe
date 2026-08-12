import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { layout } from '../core/layout.js';
import { settings } from '../core/settings.js';
import { usage } from '../core/usage.js';
import { router } from '../core/router.js';
import { bus } from '../core/bus.js';
import { contextMenu } from './jg-menu.js';
import { icon } from './icons.js';

const sheet = css`
  :host {
    position: absolute;
    inset: auto 0 0 0;
    display: flex;
    justify-content: center;
    padding: 0 16px 12px;
    pointer-events: none;
    z-index: 55;
  }
  :host([position="left"]), :host([position="right"]) {
    inset: 0 auto 0 auto;
    width: auto;
    padding: 12px;
    align-items: center;
  }
  :host([position="left"]) { left: 0; }
  :host([position="right"]) { right: 0; }
  :host([hidden]) { display: none; }

  .dock {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding: 8px 10px 10px;
    border-radius: 24px;
    background: var(--glass);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg), inset 0 1px 0 color-mix(in srgb, var(--foreground) 10%, transparent);
    pointer-events: auto;
    max-width: 100%;
    overflow: auto;
    scrollbar-width: none;
    transition: transform 0.26s cubic-bezier(0.2, 0.85, 0.3, 1), opacity 0.2s ease;
  }
  .dock::-webkit-scrollbar { display: none; }

  :host([position="left"]) .dock,
  :host([position="right"]) .dock {
    flex-direction: column;
    align-items: center;
    padding: 10px 8px;
    max-height: 100%;
  }

  :host([auto-hide]) .dock { transform: translateY(calc(100% + 18px)); opacity: 0; }
  :host([auto-hide][position="left"]) .dock { transform: translateX(calc(-100% - 18px)); opacity: 0; }
  :host([auto-hide][position="right"]) .dock { transform: translateX(calc(100% + 18px)); opacity: 0; }
  :host([auto-hide][peek]) .dock { transform: none; opacity: 1; }

  .zone {
    position: absolute;
    pointer-events: auto;
    display: none;
  }
  :host([auto-hide]) .zone { display: block; }
  :host([auto-hide]) .zone { inset: auto 0 0 0; height: 16px; }
  :host([auto-hide][position="left"]) .zone { inset: 0 auto 0 0; width: 16px; height: auto; }
  :host([auto-hide][position="right"]) .zone { inset: 0 0 0 auto; width: 16px; height: auto; }

  .slot {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: none;
    padding-bottom: 8px;
    transform-origin: bottom center;
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.1);
    will-change: transform;
  }
  :host([position="left"]) .slot,
  :host([position="right"]) .slot {
    flex-direction: row;
    padding: 0 0 0 8px;
    transform-origin: left center;
  }
  :host([position="right"]) .slot { padding: 0 8px 0 0; transform-origin: right center; }
  .slot[data-dragging="true"] { opacity: 0.4; }

  .item {
    display: grid;
    place-items: center;
    width: var(--dock-size, 46px);
    height: var(--dock-size, 46px);
    border-radius: calc(var(--dock-size, 46px) * 0.29);
    color: #fff;
    cursor: pointer;
    border: 0;
    padding: 0;
    text-decoration: none;
    background: linear-gradient(160deg,
      color-mix(in srgb, var(--tint) 92%, #fff 22%) 0%,
      var(--tint) 55%,
      color-mix(in srgb, var(--tint) 72%, #000 34%) 100%);
    box-shadow: 0 8px 16px -10px rgba(0, 0, 0, 0.65);
  }
  .item svg { width: 46%; height: 46%; stroke-width: 1.65; }
  .item:focus-visible { outline: none; box-shadow: var(--shadow-ring); }

  .launcher .item {
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    border: 1px solid var(--glass-border);
    color: var(--foreground);
    box-shadow: none;
  }

  .dot {
    position: absolute;
    bottom: 1px;
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--foreground) 70%, transparent);
    opacity: 0;
    transition: opacity 0.15s ease, width 0.2s ease, background 0.15s ease;
  }
  :host([position="left"]) .dot { bottom: auto; left: 1px; }
  :host([position="right"]) .dot { bottom: auto; right: 1px; }
  .slot[data-running="true"] .dot { opacity: 1; }
  .slot[data-focused="true"] .dot { width: 14px; background: var(--ring); }

  .divider {
    width: 1px;
    height: 34px;
    align-self: center;
    background: var(--glass-border);
    margin: 0 4px 8px;
    flex: none;
  }
  :host([position="left"]) .divider,
  :host([position="right"]) .divider { width: 34px; height: 1px; margin: 4px 0 4px 8px; }

  .tip {
    position: absolute;
    bottom: calc(100% - 4px);
    left: 0;
    transform: translateX(-50%) translateY(4px);
    padding: 4px 9px;
    border-radius: 8px;
    background: var(--glass-strong);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-md);
    color: var(--foreground);
    font-size: 11.5px;
    font-weight: 500;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.14s ease, transform 0.14s ease;
    z-index: 3;
  }
  .tip .sub { color: var(--muted-foreground); margin-left: 5px; }
  .tip[data-show="true"] { opacity: 1; transform: translateX(-50%) translateY(0); }
  :host([position="left"]) .tip,
  :host([position="right"]) .tip { bottom: auto; transform: translate(0, -50%); }
  :host([position="left"]) .tip[data-show="true"],
  :host([position="right"]) .tip[data-show="true"] { transform: translate(0, -50%); }

  @media (max-width: 620px) {
    .dock { --dock-size: 42px; gap: 4px; padding: 7px 8px 9px; }
    .tip { display: none; }
  }
  @media (pointer: coarse) {
    .tip { display: none; }
    :host([auto-hide]) .dock { transform: none; opacity: 1; }
    :host([auto-hide]) .zone { display: none; }
  }
`;

const MAGNIFY = 0.34;
const REACH = 92;

class JGDock extends JGElement {
  static styles = [base, sheet];

  #running = [];
  #focused = null;
  #hideTimer = null;

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('layout:change', () => this.refresh()));
    this.keep(bus.on('workspace:switch', () => this.refresh()));
    this.keep(bus.on('settings:change', () => this.refresh()));
    this.keep(bus.on('usage:change', () => this.refresh()));
    this.keep(
      bus.on('windows:change', (detail) => {
        const changed = detail.open.join() !== this.#running.join();
        this.#running = detail.open;
        this.#focused = detail.focused;
        if (changed) this.refresh();
        else this.#paintRunning();
      }),
    );
  }

  #entries() {
    const locked = layout.dock();
    const auto =
      settings.get('dock.mode') === 'auto' ? usage.top(Math.max(0, 6 - locked.length), locked) : [];
    const pinned = [...locked, ...auto];
    const recents = settings.get('dock.recents') ? usage.recents(3, pinned).filter((id) => !this.#running.includes(id)) : [];
    const running = this.#running.filter((id) => !pinned.includes(id) && !recents.includes(id));
    return { pinned, locked, recents, running };
  }

  render() {
    const position = settings.get('dock.position');
    this.toggleAttribute('hidden', position === 'hidden');
    if (position === 'hidden') return this.paint('');

    this.setAttribute('position', position);
    this.toggleAttribute('auto-hide', Boolean(settings.get('dock.autoHide')));

    const { pinned, locked, recents, running } = this.#entries();

    this.paint(html`
      <span class="zone"></span>
      <nav class="dock" aria-label="Dock">
        <span class="slot launcher">
          <a class="item" href="${router.href('/apps')}" aria-label="App Library">${icon('grid', 22)}</a>
          <span class="dot"></span>
        </span>
        <span class="divider"></span>
        ${pinned.map((id) => this.#slot(id, locked.includes(id) ? 'locked' : 'auto'))}
        ${recents.length ? html`<span class="divider"></span>` : ''}
        ${recents.map((id) => this.#slot(id, 'recent'))}
        ${running.length ? html`<span class="divider"></span>` : ''}
        ${running.map((id) => this.#slot(id, 'running'))}
      </nav>
      <span class="tip" data-show="false"></span>
    `);

    this.#paintRunning();
    this.#wire();
  }

  #slot(id, kind) {
    const app = registry.find(id);
    if (!app) return '';
    return html`<span class="slot" data-id="${id}" data-kind="${kind}" style="--tint:${app.tint}">
      <a class="item" href="${router.href(`/${app.id}`)}" aria-label="${app.name}">${icon(app.icon, 22)}</a>
      <span class="dot"></span>
    </span>`;
  }

  #paintRunning() {
    this.$$('.slot[data-id]').forEach((slot) => {
      slot.dataset.running = String(this.#running.includes(slot.dataset.id));
      slot.dataset.focused = String(this.#focused === slot.dataset.id);
    });
  }

  #wire() {
    const dock = this.$('.dock');
    const vertical = this.getAttribute('position') !== 'bottom';

    this.on(dock, 'pointermove', (event) => {
      this.$$('.slot').forEach((slot) => {
        const rect = slot.getBoundingClientRect();
        const distance = vertical
          ? Math.abs(event.clientY - (rect.top + rect.height / 2))
          : Math.abs(event.clientX - (rect.left + rect.width / 2));
        const strength = Math.max(0, 1 - distance / REACH);
        const scale = 1 + MAGNIFY * strength ** 2;
        const shift = (-6 * strength ** 2).toFixed(2);
        slot.style.transform = vertical ? `scale(${scale.toFixed(3)})` : `scale(${scale.toFixed(3)}) translateY(${shift}px)`;
      });
    });

    this.on(dock, 'pointerleave', () => {
      this.#resetMagnify();
      this.#hideTip();
      this.#scheduleHide();
    });
    this.on(dock, 'pointerenter', () => this.#peek(true));

    const zone = this.$('.zone');
    if (zone) this.on(zone, 'pointerenter', () => this.#peek(true));

    this.$$('.slot').forEach((slot) => {
      this.on(slot, 'pointerenter', () => this.#showTip(slot));
    });

    this.$$('.slot[data-id]').forEach((slot) => {
      this.on(slot, 'contextmenu', (event) => {
        event.preventDefault();
        this.#menu(slot.dataset.id, event.clientX, event.clientY);
      });
      this.on(slot, 'click', (event) => {
        const appId = slot.dataset.id;
        if (this.#focused === appId && this.#running.includes(appId)) {
          event.preventDefault();
          bus.emit('window:minimize-request', { appId });
        }
      });
    });
  }

  #peek(show) {
    clearTimeout(this.#hideTimer);
    if (show) this.setAttribute('peek', '');
    else this.removeAttribute('peek');
  }

  #scheduleHide() {
    clearTimeout(this.#hideTimer);
    this.#hideTimer = setTimeout(() => this.removeAttribute('peek'), 420);
    this.track(() => clearTimeout(this.#hideTimer));
  }

  #showTip(slot) {
    const tip = this.$('.tip');
    if (!tip) return;
    const isLauncher = slot.classList.contains('launcher');
    const app = isLauncher ? null : registry.find(slot.dataset.id);
    const label = isLauncher ? 'App Library' : app?.name ?? '';
    const kind = slot.dataset.kind;
    const suffix =
      this.#focused === slot.dataset.id ? 'click to minimise'
      : this.#running.includes(slot.dataset.id) ? 'open'
      : kind === 'recent' ? 'recent'
      : kind === 'auto' ? 'frequent'
      : '';
    tip.innerHTML = html`${label}${suffix ? html`<span class="sub">${suffix}</span>` : ''}`;

    const host = this.getBoundingClientRect();
    const rect = slot.getBoundingClientRect();
    const position = this.getAttribute('position');
    if (position === 'bottom') {
      tip.style.left = `${rect.left - host.left + rect.width / 2}px`;
      tip.style.top = '';
    } else {
      tip.style.top = `${rect.top - host.top + rect.height / 2}px`;
      tip.style.left = position === 'left' ? `${rect.right - host.left + 10}px` : '';
      tip.style.right = position === 'right' ? `${host.right - rect.left + 10}px` : '';
    }
    tip.dataset.show = 'true';
  }

  #hideTip() {
    const tip = this.$('.tip');
    if (tip) tip.dataset.show = 'false';
  }

  #resetMagnify() {
    this.$$('.slot').forEach((slot) => {
      slot.style.transform = '';
    });
  }

  #menu(appId, x, y) {
    const meta = registry.find(appId);
    const locked = layout.dock().includes(appId);
    const position = this.getAttribute('position');
    contextMenu({
      x: position === 'bottom' ? x : x + 20,
      y: position === 'bottom' ? y - 260 : y,
      title: meta.name,
      items: [
        { label: 'Open', glyph: '↗', action: () => router.app(appId) },
        this.#running.includes(appId) && {
          label: 'Minimise',
          glyph: '-',
          action: () => bus.emit('window:minimize-request', { appId }),
        },
        this.#running.includes(appId) && {
          label: 'Close',
          glyph: '✕',
          action: () => bus.emit('window:close-request', { appId }),
        },
        { separator: true },
        { label: locked ? 'Unpin from dock' : 'Keep in dock', glyph: '⌸', action: () => layout.toggleDock(appId) },
        meta.widget && { label: 'Add widget', glyph: '▣', action: () => layout.addWidget(appId) },
        { separator: true },
        {
          label: 'Copy link',
          glyph: '⧉',
          action: () => navigator.clipboard?.writeText(`${window.location.origin}${router.href(`/${appId}`)}`),
        },
      ],
    });
  }
}

define('jg-dock', JGDock);
