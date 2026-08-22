import { bus } from './bus.js';

const sheets = new Map();

export function css(strings, ...values) {
  const text = String.raw({ raw: strings }, ...values);
  if (!sheets.has(text)) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    sheets.set(text, sheet);
  }
  return sheets.get(text);
}

const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => escapes[char]);

export class Markup {
  constructor(value) {
    this.raw = String(value ?? '');
  }

  toString() {
    return this.raw;
  }
}

export const raw = (value) => new Markup(value);

function serialize(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (Array.isArray(value)) return value.map(serialize).join('');
  if (typeof value === 'object' && 'raw' in value) return String(value.raw);
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += serialize(values[i]) + strings[i + 1];
  return new Markup(out);
}

export function define(tag, ctor) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
  return tag;
}

export class JGElement extends HTMLElement {
  static styles = [];
  static shadow = { mode: 'open' };

  #disposers = [];
  #keepers = [];

  constructor() {
    super();
    this.attachShadow(this.constructor.shadow);
    this.shadowRoot.adoptedStyleSheets = this.constructor.styles;
  }

  connectedCallback() {
    this.render();
    this.keep(bus.on('language:change', () => this.refresh()));
  }

  disconnectedCallback() {
    this.dispose();
    this.#keepers.forEach((fn) => fn());
    this.#keepers = [];
  }

  dispose() {
    this.#disposers.forEach((fn) => fn());
    this.#disposers = [];
  }

  track(disposer) {
    if (typeof disposer === 'function') this.#disposers.push(disposer);
    return disposer;
  }

  keep(disposer) {
    if (typeof disposer === 'function') this.#keepers.push(disposer);
    return disposer;
  }

  on(target, type, handler, options) {
    const node = typeof target === 'string' ? this.$(target) : target;
    if (!node) return;
    node.addEventListener(type, handler, options);
    this.track(() => node.removeEventListener(type, handler, options));
  }

  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.keep(() => target.removeEventListener(type, handler, options));
  }

  bind(selector, type, handler, options) {
    this.$$(selector).forEach((node) => this.on(node, type, handler, options));
  }

  paint(markup) {
    this.shadowRoot.innerHTML = String(markup ?? '');
  }

  render() {}

  refresh() {
    if (!this.isConnected) return;
    this.dispose();
    this.render();
  }

  $(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  $$(selector) {
    return [...this.shadowRoot.querySelectorAll(selector)];
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}
