import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { settings } from '../core/settings.js';
import { layout } from '../core/layout.js';
import { bus } from '../core/bus.js';
import { contextMenu } from './jg-menu.js';
import { isMobile, clamp } from '../core/util.js';
import { usage } from '../core/usage.js';
import './jg-window.js';

const sheet = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 40;
    pointer-events: none;
  }
  :host([active]) { pointer-events: auto; }
  jg-window { pointer-events: auto; }
`;

const OFFSET_STEP = 28;

class JGWindowLayer extends JGElement {
  static styles = [base, sheet];

  #windows = new Map();
  #order = [];
  #cascade = 0;

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('window:minimize-request', ({ appId }) => this.minimize(appId)));
    this.keep(bus.on('window:close-request', ({ appId }) => this.close(appId)));
  }

  render() {
    this.paint(html`<slot></slot>`);
  }

  get openIds() {
    return [...this.#windows.keys()];
  }

  get focusedId() {
    return this.#order[this.#order.length - 1] ?? null;
  }

  isVisible(appId) {
    return this.#windows.get(appId)?.getAttribute('state') !== 'minimized';
  }

  hasVisible() {
    return [...this.#windows.values()].some((node) => node.getAttribute('state') !== 'minimized');
  }

  async open(appId, options = {}) {
    const meta = registry.find(appId);
    if (!meta) return null;

    const existing = this.#windows.get(appId);
    if (existing) {
      existing.setAttribute('state', existing.getAttribute('state') === 'minimized' ? 'normal' : existing.getAttribute('state') ?? 'normal');
      this.focus(appId);
      return existing;
    }

    usage.record(appId);
    if (settings.get('behavior.singleWindow')) this.closeAll({ silent: true });

    const win = document.createElement('jg-window');
    win.setAttribute('app-id', appId);
    win.setAttribute('title-text', meta.name);
    win.setAttribute('state', 'normal');
    this.#placeNew(win, options);
    this.append(win);
    this.#windows.set(appId, win);
    this.#order.push(appId);
    this.#applyStacking();
    this.#wire(win, appId);
    this.#emitChange();

    const element = await registry.create(appId, this.#appMode());
    if (!this.#windows.has(appId)) return null;
    if (element) {
      element.addEventListener('app:title', (event) => win.setTitle(event.detail.title));
      win.append(element);
    }
    win.setLoaded();
    return win;
  }

  #appMode() {
    return isMobile() || settings.get('behavior.openMode') === 'fullscreen' ? 'fullscreen' : 'window';
  }

  #placeNew(win, options) {
    const fullscreen = isMobile() || settings.get('behavior.openMode') === 'fullscreen';
    if (fullscreen) {
      win.setAttribute('fullscreen', '');
      return;
    }
    const bounds = this.getBoundingClientRect();
    const preferred = registry.find(win.getAttribute('app-id'))?.window ?? {};
    const width = clamp(preferred.width ?? Math.round(bounds.width * 0.62), 360, Math.max(360, bounds.width - 24));
    const height = clamp(preferred.height ?? Math.round(bounds.height * 0.74), 300, Math.max(300, bounds.height - 24));
    const step = (this.#cascade % 6) * OFFSET_STEP;
    this.#cascade += 1;
    win.place({
      left: clamp(Math.round((bounds.width - width) / 2) + step - 60, 12, Math.max(12, bounds.width - width - 12)),
      top: clamp(Math.round((bounds.height - height) / 2) + step - 60, 12, Math.max(12, bounds.height - height - 12)),
      width: options.width ?? width,
      height: options.height ?? height,
    });
  }

  #wire(win, appId) {
    win.addEventListener('window:close', () => this.close(appId));
    win.addEventListener('window:minimize', () => this.minimize(appId));
    win.addEventListener('window:focus', () => this.focus(appId));
    win.addEventListener('window:menu', (event) => this.#menu(appId, event.detail));
  }

  #menu(appId, position) {
    const meta = registry.find(appId);
    const win = this.#windows.get(appId);
    const inDock = layout.dock().includes(appId);
    contextMenu({
      x: position.x,
      y: position.y,
      title: meta.name,
      items: [
        {
          label: win.getAttribute('state') === 'maximized' ? 'Restore size' : 'Maximize',
          icon: 'maximize',
          action: () => win.toggleMaximize(),
        },
        { label: 'Minimize', icon: 'minimize', action: () => this.minimize(appId) },
        { separator: true },
        {
          label: meta.widget ? 'Add widget to home' : 'No widget available',
          icon: 'widget',
          disabled: !meta.widget,
          action: () => layout.addWidget(appId),
        },
        {
          label: inDock ? 'Remove from dock' : 'Add to dock',
          icon: 'dock',
          action: () => layout.toggleDock(appId),
        },
        { separator: true },
        { label: 'Close', icon: 'close', danger: true, action: () => this.close(appId) },
      ],
    });
  }

  focus(appId) {
    if (!this.#windows.has(appId)) return;
    this.#order = [...this.#order.filter((id) => id !== appId), appId];
    const win = this.#windows.get(appId);
    if (win.getAttribute('state') === 'minimized') win.setAttribute('state', 'normal');
    this.#applyStacking();
    this.#emitChange();
  }

  minimize(appId) {
    this.#windows.get(appId)?.setAttribute('state', 'minimized');
    this.#order = this.#order.filter((id) => id !== appId);
    this.#order.unshift(appId);
    this.#applyStacking();
    this.#emitChange();
  }

  minimizeAll() {
    this.#windows.forEach((win) => win.setAttribute('state', 'minimized'));
    this.#applyStacking();
    this.#emitChange();
  }

  close(appId) {
    const win = this.#windows.get(appId);
    if (!win) return;
    win.remove();
    this.#windows.delete(appId);
    this.#order = this.#order.filter((id) => id !== appId);
    this.#cascade = Math.max(0, this.#cascade - 1);
    this.#applyStacking();
    this.#emitChange();
  }

  closeAll({ silent = false } = {}) {
    [...this.#windows.keys()].forEach((appId) => {
      this.#windows.get(appId).remove();
      this.#windows.delete(appId);
    });
    this.#order = [];
    this.#cascade = 0;
    if (!silent) this.#emitChange();
  }

  #applyStacking() {
    this.#order.forEach((appId, index) => {
      const win = this.#windows.get(appId);
      if (!win) return;
      win.style.zIndex = String(10 + index);
      win.toggleAttribute('focused', index === this.#order.length - 1 && win.getAttribute('state') !== 'minimized');
    });
    this.toggleAttribute('active', this.hasVisible());
  }

  #emitChange() {
    const visible = this.#order.filter((id) => this.isVisible(id));
    bus.emit('windows:change', {
      open: this.openIds,
      visible,
      focused: visible[visible.length - 1] ?? null,
    });
  }
}

define('jg-window-layer', JGWindowLayer);
