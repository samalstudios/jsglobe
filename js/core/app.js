import { JGElement } from './dom.js';
import { appSheets } from '../ui/styles.js';
import { appConfig, appState } from './config.js';
import '../ui/kit.js';

export class JGApp extends JGElement {
  static styles = appSheets;
  static appId = '';
  static observedAttributes = ['mode'];

  #config = null;
  #state = null;

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
  }

  renderApp() {}

  attributeChangedCallback(name, previous, next) {
    if (name === 'mode' && previous !== null && previous !== next) this.refresh();
  }

  setTitle(text) {
    this.emit('app:title', { title: text });
  }

  frame(body, options = {}) {
    return `<div class="app${options.class ? ` ${options.class}` : ''}">${body}</div>`;
  }
}

export { html, raw, css, define } from './dom.js';
