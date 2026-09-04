import { JGElement, define as defineElement } from './dom.js';
import { appSheets } from '../ui/styles.js';
import { appConfig, appState } from './config.js';
import { keys } from './keys.js';
import { appSettings } from './app-settings.js';
import { provide } from '../lib/webmcp.js';
import '../ui/kit.js';

export class JGApp extends JGElement {
  static styles = appSheets;
  static appId = '';
  static settings = [];
  static observedAttributes = ['mode'];

  #config = null;
  #state = null;
  #withdraw = null;

  get mode() {
    return this.getAttribute('mode') ?? 'window';
  }

  get isWidget() {
    return this.mode === 'widget';
  }

  get config() {
    this.#config ??= appConfig(this.constructor.appId);
    return this.#config;
  }

  get store() {
    this.#state ??= appState(this.constructor.appId);
    return this.#state;
  }

  render() {
    if (this.isWidget && this.renderWidget) this.renderWidget();
    else this.renderApp();
    this.#offerTools();
  }

  // What this app can do, told to an assistant browsing the page. A widget is
  // a preview rather than the app, so it offers nothing.
  tools() {
    return [];
  }

  #offerTools() {
    this.#withdraw?.();
    this.#withdraw = null;
    if (this.isWidget) return;
    const tools = this.tools();
    if (!tools.length) return;
    this.#withdraw = provide(tools, {
      onFault: (name, faults) => console.warn(`${this.constructor.appId}: tool ${name} was not offered`, faults),
    });
    this.keep(() => {
      this.#withdraw?.();
      this.#withdraw = null;
    });
  }

  renderApp() {}

  attributeChangedCallback(name, previous, next) {
    if (name === 'mode' && previous !== null && previous !== next) this.refresh();
  }

  setTitle(text) {
    this.emit('app:title', { title: text });
  }

  setActions(items) {
    if (this.isWidget) return;
    this.emit('app:actions', { items });
  }

  setActiveAction(id) {
    const window = this.closest('jg-window');
    window?.setActive(id);
  }

  hotkeys(handler, options = {}) {
    const type = options.type ?? 'keydown';
    this.listen(window, type, (event) => {
      if (this.isWidget || this.offsetParent === null) return;
      if (!keys.owned(this.constructor.appId, event, options)) return;
      handler(event);
    });
  }

  frame(body, options = {}) {
    return `<div class="app${options.class ? ` ${options.class}` : ''}">${body}</div>`;
  }
}

export { html, raw, css } from './dom.js';

const sheets = new Map();

export async function styleSheet(base, file = 'styles.css') {
  const href = new URL(file, base).href;
  if (!sheets.has(href)) {
    sheets.set(
      href,
      fetch(href)
        .then((response) => (response.ok ? response.text() : ''))
        .catch(() => '')
        .then((text) => {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(text);
          return sheet;
        }),
    );
  }
  return sheets.get(href);
}

export function define(tag, ctor) {
  appSettings.define(ctor.appId, ctor.settings);
  return defineElement(tag, ctor);
}
