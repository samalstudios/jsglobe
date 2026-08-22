import { JGElement, define, css, html } from '../core/dom.js';
import { t } from '../core/i18n.js';
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
    padding: 9px 10px;
    border-radius: 24px;
    overflow: visible;
    background: var(--glass);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg), inset 0 1px 0 color-mix(in srgb, var(--foreground) 10%, transparent);
    pointer-events: auto;
    max-width: 100%;
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

  .slot {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: none;
    transform-origin: bottom center;
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.1);
    will-change: transform;
  }
  :host([position="left"]) .slot,
  :host([position="right"]) .slot { flex-direction: row; transform-origin: left center; }
  :host([position="right"]) .slot { transform-origin: right center; }
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
    background: linear-gradient(165deg,
      color-mix(in srgb, var(--tint) 96%, #fff 10%) 0%,
      var(--tint) 62%,
      color-mix(in srgb, var(--tint) 86%, #000 16%) 100%);
    box-shadow:
      0 8px 16px -10px rgba(0, 0, 0, 0.65),
      inset 0 calc(1px * var(--icon-depth, 0)) 0 rgba(255, 255, 255, calc(0.5 * var(--icon-depth, 0))),
      inset 0 calc(-3px * var(--icon-depth, 0)) calc(5px * var(--icon-depth, 0)) rgba(0, 0, 0, calc(0.26 * var(--icon-depth, 0)));
    position: relative;
    overflow: hidden;
  }
  .item::after {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 56%;
    border-radius: inherit;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.05));
    opacity: var(--icon-gloss, 0);
    pointer-events: none;
  }
  .item svg { position: relative; z-index: 1; }
  .item svg { width: 46%; height: 46%; stroke-width: 1.65; }
  .launcher .item svg { width: 52%; height: 52%; fill: currentColor; stroke: none; }
  .item:focus-visible { outline: none; box-shadow: var(--shadow-ring); }

  .launcher .item {
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    border: 1px solid var(--glass-border);
    color: var(--foreground);
    box-shadow: none;
  }

  .dot {
    position: absolute;
    bottom: -7px;
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--foreground) 70%, transparent);
    opacity: 0;
    transition: opacity 0.15s ease, width 0.2s ease, height 0.2s ease, margin 0.2s ease, background 0.15s ease;
  }
  :host([position="left"]) .dot,
  :host([position="right"]) .dot { bottom: auto; top: 50%; margin-top: -2px; }
  :host([position="left"]) .dot { left: -7px; }
  :host([position="right"]) .dot { right: -7px; }
  .slot[data-running="true"] .dot { opacity: 1; }
  .slot[data-focused="true"] .dot { width: 14px; background: var(--ring); }
  :host([position="left"]) .slot[data-focused="true"] .dot,
  :host([position="right"]) .slot[data-focused="true"] .dot {
    width: 4px;
    height: 14px;
    margin-top: -7px;
  }

  .divider {
    width: 1px;
    height: 34px;
    align-self: center;
    background: var(--glass-border);
    margin: 0 4px;
    flex: none;
  }
  :host([position="left"]) .divider,
  :host([position="right"]) .divider { width: 34px; height: 1px; margin: 4px 0; }

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

  @media (max-width: 700px) {
    :host { display: none; }
  }
  @media (pointer: coarse) {
    .tip { display: none; }
    :host([auto-hide]) .dock { transform: none; opacity: 1; }
  }
`;

const REVEAL = 56;
const REVEAL_BUSY = 5;
const DWELL = 320;
const MAGNIFY = 0.34;
const REACH = 92;

class JGDock extends JGElement {
  static styles = [base, sheet];

  #running = [];
  #focused = null;
  #hideTimer = null;
  #dwellTimer = null;

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('layout:change', () => this.refresh()));
    this.keep(bus.on('workspace:switch', () => this.refresh()));
    this.keep(bus.on('settings:change', () => this.refresh()));
    this.keep(bus.on('usage:change', () => this.refresh()));
    this.listen(window, 'pointermove', (event) => {
      if (!this.hasAttribute('auto-hide')) return;
      const position = this.getAttribute('position') ?? 'bottom';
      const distance =
        position === 'left'
          ? event.clientX
          : position === 'right'
            ? window.innerWidth - event.clientX
            : window.innerHeight - event.clientY;

      const busy = Boolean(this.#focused);
      if (distance > (busy ? REVEAL_BUSY : REVEAL)) {
        this.#cancelDwell();
        if (this.hasAttribute('peek')) this.#scheduleHide();
        return;
      }

      if (!busy || this.hasAttribute('peek')) {
        this.#cancelDwell();
        this.#peek(true);
        return;
      }

      if (this.#dwellTimer) return;
      this.#dwellTimer = setTimeout(() => {
        this.#dwellTimer = null;
        this.#peek(true);
      }, DWELL);
    });
    this.keep(() => this.#cancelDwell());

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
      <nav class="dock" aria-label="Dock">
        <span class="slot launcher">
          <a class="item" href="${router.href('/apps')}" aria-label="${t('library.title', 'App Library')}">${icon('launcher', 22)}</a>
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
    return html`<span class="slot" data-id="${id}" data-kind="${kind}" style="--tint:${registry.tint(app)}">
      <a class="item" href="${router.href(`/apps/${app.id}`)}" aria-label="${app.name}">${icon(app.icon, 22)}</a>
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

  #cancelDwell() {
    clearTimeout(this.#dwellTimer);
    this.#dwellTimer = null;
  }

  #peek(show) {
    clearTimeout(this.#hideTimer);
    this.toggleAttribute('peek', show);
    bus.emit('dock:peek', { visible: show && this.hasAttribute('auto-hide') });
  }

  #scheduleHide() {
    clearTimeout(this.#hideTimer);
    this.#hideTimer = setTimeout(() => {
      this.removeAttribute('peek');
      bus.emit('dock:peek', { visible: false });
    }, 420);
    this.track(() => clearTimeout(this.#hideTimer));
  }

  #showTip(slot) {
    const tip = this.$('.tip');
    if (!tip) return;
    const isLauncher = slot.classList.contains('launcher');
    const app = isLauncher ? null : registry.find(slot.dataset.id);
    const label = isLauncher ? t('library.title', 'App Library') : app?.name ?? '';
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
        { label: t('action.open', 'Open'), icon: 'external', action: () => router.app(appId) },
        this.#running.includes(appId) && {
          label: t('action.minimise', 'Minimise'),
          icon: 'minimize',
          action: () => bus.emit('window:minimize-request', { appId }),
        },
        this.#running.includes(appId) && {
          label: t('action.close', 'Close'),
          icon: 'close',
          action: () => bus.emit('window:close-request', { appId }),
        },
        { separator: true },
        { label: locked ? 'Unpin from dock' : 'Keep in dock', icon: 'dock', action: () => layout.toggleDock(appId) },
        meta.widget && { label: t('action.addWidget', 'Add widget'), icon: 'widget', action: () => layout.addWidget(appId) },
        { separator: true },
        {
          label: t('action.copyLink', 'Copy link'),
          icon: 'copy',
          action: () => navigator.clipboard?.writeText(`${window.location.origin}${router.href(`/apps/${appId}`)}`),
        },
      ],
    });
  }
}

define('jg-dock', JGDock);
