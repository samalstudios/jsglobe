import { JGElement, define, css, html, raw } from '../core/dom.js';
import { base } from './styles.js';
import { copyText } from '../core/util.js';
import './jg-toolbar.js';
import './jg-code.js';
import './jg-sheet.js';
import './jg-dialog.js';
import './jg-popover.js';
import './jg-drop.js';
import './jg-stat.js';

const controlBase = css`
  :host {
    display: inline-flex;
    font-family: var(--font-sans);
  }
  :host([hidden]) { display: none; }
  :host([block]) { display: flex; width: 100%; }
`;

class JGButton extends JGElement {
  static styles = [
    base,
    controlBase,
    css`
      :host { vertical-align: middle; }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        white-space: nowrap;
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        line-height: 1;
        height: 34px;
        padding: 0 13px;
        border-radius: var(--radius-md);
        border: 1px solid transparent;
        background: var(--primary);
        color: var(--primary-foreground);
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.08s ease;
        user-select: none;
      }
      button:active { transform: translateY(0.5px) scale(0.99); }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      button:focus-visible { outline: none; box-shadow: var(--shadow-ring); }
      :host([variant="secondary"]) button {
        background: var(--secondary);
        color: var(--secondary-foreground);
        border-color: var(--border);
      }
      :host([variant="secondary"]) button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--secondary) 80%, var(--foreground) 6%);
      }
      :host([variant="outline"]) button {
        background: transparent;
        color: var(--foreground);
        border-color: var(--border-strong);
      }
      :host([variant="outline"]) button:hover:not(:disabled) { background: var(--accent); }
      :host([variant="ghost"]) button {
        background: transparent;
        color: var(--foreground);
      }
      :host([variant="ghost"]) button:hover:not(:disabled) { background: var(--accent); }
      :host([variant="destructive"]) button {
        background: color-mix(in srgb, var(--destructive) 16%, transparent);
        color: var(--destructive);
        border-color: color-mix(in srgb, var(--destructive) 40%, transparent);
      }
      :host([variant="destructive"]) button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--destructive) 26%, transparent);
      }
      :host([variant="primary"]) button:hover:not(:disabled),
      :host(:not([variant])) button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--primary) 88%, var(--background));
      }
      :host([group]) button { border-radius: 0; }
      :host([group="first"]) button { border-radius: var(--radius-md) 0 0 var(--radius-md); }
      :host([group="last"]) button { border-radius: 0 var(--radius-md) var(--radius-md) 0; }
      :host([group="only"]) button { border-radius: var(--radius-md); }
      :host([group="middle"]) button,
      :host([group="last"]) button { margin-left: -1px; }
      :host([group]) button:hover:not(:disabled),
      :host([group]) button:focus-visible { position: relative; z-index: 1; }
      :host([size="sm"]) button { height: 28px; padding: 0 10px; font-size: 12px; }
      :host([size="lg"]) button { height: 40px; padding: 0 18px; font-size: 14px; }
      :host([size="icon"]) button { width: 34px; height: 34px; padding: 0; }
      :host([size="icon-sm"]) button { width: 28px; height: 28px; padding: 0; font-size: 12px; }
      :host([group]) button { height: 100%; min-height: 34px; }
      :host([group][size="sm"]) button,
      :host([group][size="icon-sm"]) button { min-height: 28px; }
      :host([group][size="lg"]) button { min-height: 40px; }
      :host([full]) { display: flex; width: 100%; }
    `,
  ];

  static observedAttributes = ['disabled'];

  render() {
    this.paint(html`<button part="button" type="button"><slot></slot></button>`);
    this.$('button').disabled = this.hasAttribute('disabled');
    if (this.hasAttribute('aria-label')) this.$('button').setAttribute('aria-label', this.getAttribute('aria-label'));
  }

  attributeChangedCallback() {
    const button = this.$('button');
    if (button) button.disabled = this.hasAttribute('disabled');
  }

  focus() {
    this.$('button')?.focus();
  }
}

const fieldSurface = css`
  .control {
    width: 100%;
    font-family: inherit;
    font-size: 13.5px;
    color: var(--foreground);
    background: color-mix(in srgb, var(--input) 100%, transparent);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 8px 11px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }
  .control::placeholder { color: color-mix(in srgb, var(--muted-foreground) 80%, transparent); }
  .control:hover { border-color: var(--border-strong); }
  .control:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--ring) 70%, var(--border));
    box-shadow: var(--shadow-ring);
  }
  .control:disabled { opacity: 0.55; cursor: not-allowed; }
  :host([invalid]) .control {
    border-color: color-mix(in srgb, var(--destructive) 60%, var(--border));
  }
  :host([mono]) .control { font-family: var(--font-mono); font-size: 12.5px; }
`;

class JGInput extends JGElement {
  static shadow = { mode: 'open', delegatesFocus: true };
  static styles = [
    base,
    controlBase,
    fieldSurface,
    css`
      :host { display: block; width: 100%; }
      .control { height: 34px; padding: 0 11px; }
      :host([size="sm"]) .control { height: 28px; font-size: 12.5px; }
      .wrap { position: relative; display: flex; align-items: center; }
      .affix {
        position: absolute;
        right: 8px;
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--muted-foreground);
        font-size: 12px;
        pointer-events: none;
      }
      :host([suffix]) .control { padding-right: 52px; }
    `,
  ];

  static observedAttributes = ['value', 'placeholder', 'type', 'disabled', 'suffix', 'min', 'max', 'step'];

  #value = '';

  get value() {
    return this.$('.control')?.value ?? this.#value;
  }

  set value(next) {
    this.#value = String(next ?? '');
    const control = this.$('.control');
    if (control) control.value = this.#value;
  }

  get valueAsNumber() {
    return Number(this.value);
  }

  render() {
    const type = this.getAttribute('type') ?? 'text';
    const suffix = this.getAttribute('suffix');
    this.paint(html`
      <div class="wrap">
        <input
          class="control"
          part="input"
          type="${type}"
          placeholder="${this.getAttribute('placeholder') ?? ''}"
          spellcheck="false"
          autocomplete="off"
        />
        ${suffix ? html`<span class="affix">${suffix}</span>` : ''}
      </div>
    `);
    const control = this.$('.control');
    control.value = this.getAttribute('value') ?? this.#value;
    control.disabled = this.hasAttribute('disabled');
    ['min', 'max', 'step'].forEach((attr) => {
      if (this.hasAttribute(attr)) control.setAttribute(attr, this.getAttribute(attr));
    });
    this.on(control, 'change', () => this.emit('change', { value: control.value }));
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next) return;
    const control = this.$('.control');
    if (!control) return;
    if (name === 'value') control.value = next ?? '';
    else if (name === 'disabled') control.disabled = this.hasAttribute('disabled');
    else if (name === 'placeholder') control.placeholder = next ?? '';
    else if (next === null) control.removeAttribute(name);
    else control.setAttribute(name, next);
  }

  select() {
    this.$('.control')?.select();
  }
}

class JGTextarea extends JGElement {
  static shadow = { mode: 'open', delegatesFocus: true };
  static styles = [
    base,
    controlBase,
    fieldSurface,
    css`
      :host { display: block; width: 100%; }
      :host([grow]) { flex: 1; min-height: 0; display: flex; }
      .control {
        display: block;
        min-height: 96px;
        height: 100%;
        resize: vertical;
        font-family: var(--font-mono);
        font-size: 12.5px;
        line-height: 1.6;
        tab-size: 2;
        scrollbar-width: thin;
      }
      :host([grow]) .control { resize: none; flex: 1; }
      :host([sans]) .control { font-family: var(--font-sans); font-size: 13.5px; }
    `,
  ];

  static observedAttributes = ['value', 'placeholder', 'disabled', 'rows'];

  #value = '';

  get value() {
    return this.$('.control')?.value ?? this.#value;
  }

  set value(next) {
    this.#value = String(next ?? '');
    const control = this.$('.control');
    if (control) control.value = this.#value;
  }

  render() {
    this.paint(html`
      <textarea
        class="control"
        part="textarea"
        rows="${this.getAttribute('rows') ?? 6}"
        placeholder="${this.getAttribute('placeholder') ?? ''}"
        spellcheck="false"
        autocomplete="off"
      ></textarea>
    `);
    const control = this.$('.control');
    control.value = this.getAttribute('value') ?? this.#value;
    control.disabled = this.hasAttribute('disabled');
    this.on(control, 'change', () => this.emit('change', { value: control.value }));
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next) return;
    const control = this.$('.control');
    if (!control) return;
    if (name === 'value') control.value = next ?? '';
    if (name === 'placeholder') control.placeholder = next ?? '';
    if (name === 'disabled') control.disabled = this.hasAttribute('disabled');
    if (name === 'rows') control.rows = Number(next) || 6;
  }
}

class JGSelect extends JGElement {
  static shadow = { mode: 'open', delegatesFocus: true };
  static styles = [
    base,
    controlBase,
    fieldSurface,
    css`
      :host { display: block; width: 100%; }
      .wrap { position: relative; display: block; }
      .control {
        height: 34px;
        appearance: none;
        padding: 0 30px 0 11px;
        cursor: pointer;
      }
      .control option { background: var(--popover); color: var(--popover-foreground); }
      .chevron {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--muted-foreground);
        font-size: 10px;
      }
      :host([size="sm"]) .control { height: 28px; font-size: 12.5px; }
    `,
  ];

  static observedAttributes = ['value', 'disabled'];

  #options = [];
  #value = '';

  get value() {
    return this.$('.control')?.value ?? this.#value;
  }

  set value(next) {
    this.#value = String(next ?? '');
    const control = this.$('.control');
    if (control) control.value = this.#value;
  }

  set options(list) {
    this.#options = list.map((item) => (typeof item === 'object' ? item : { value: item, label: item }));
    this.refresh();
  }

  get options() {
    return this.#options;
  }

  render() {
    const inline = this.#options.length
      ? this.#options
      : [...this.querySelectorAll('option')].map((node) => ({ value: node.value, label: node.textContent }));
    this.#options = inline;
    this.paint(html`
      <div class="wrap">
        <select class="control" part="select">
          ${inline.map((option) => html`<option value="${option.value}">${option.label}</option>`)}
        </select>
        <span class="chevron">▼</span>
      </div>
    `);
    const control = this.$('.control');
    control.value = this.getAttribute('value') ?? this.#value ?? inline[0]?.value;
    control.disabled = this.hasAttribute('disabled');
    this.on(control, 'change', () => {
      this.#value = control.value;
      this.emit('change', { value: control.value });
    });
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next) return;
    const control = this.$('.control');
    if (!control) return;
    if (name === 'value') control.value = next ?? '';
    if (name === 'disabled') control.disabled = this.hasAttribute('disabled');
  }
}

class JGSwitch extends JGElement {
  static styles = [
    base,
    controlBase,
    css`
      :host { display: inline-flex; }
      button {
        position: relative;
        width: 38px;
        height: 22px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--muted);
        cursor: pointer;
        padding: 0;
        transition: background 0.18s ease, border-color 0.18s ease;
      }
      button:focus-visible { outline: none; box-shadow: var(--shadow-ring); }
      .thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: var(--foreground);
        box-shadow: var(--shadow-sm);
        transition: transform 0.18s cubic-bezier(0.3, 0.8, 0.4, 1);
      }
      :host([checked]) button {
        background: var(--ring);
        border-color: color-mix(in srgb, var(--ring) 70%, transparent);
      }
      :host([checked]) .thumb { transform: translateX(16px); background: #fff; }
      :host([disabled]) { opacity: 0.5; pointer-events: none; }
    `,
  ];

  static observedAttributes = ['checked'];

  get checked() {
    return this.hasAttribute('checked');
  }

  set checked(value) {
    this.toggleAttribute('checked', Boolean(value));
  }

  render() {
    this.paint(html`<button type="button" role="switch"><span class="thumb"></span></button>`);
    this.$('button').setAttribute('aria-checked', String(this.checked));
    this.on(this.$('button'), 'click', () => {
      this.checked = !this.checked;
      this.emit('change', { checked: this.checked });
    });
  }

  attributeChangedCallback() {
    this.$('button')?.setAttribute('aria-checked', String(this.checked));
  }
}

class JGButtonGroup extends JGElement {
  static styles = [
    base,
    css`
      :host { display: inline-flex; vertical-align: middle; }
      :host([full]) { display: flex; width: 100%; }
      .group { display: inline-flex; align-items: stretch; }
      ::slotted(jg-button) { display: inline-flex; }
      :host([full]) .group { display: flex; width: 100%; }
      :host([full]) ::slotted(jg-button) { flex: 1; }
    `,
  ];

  render() {
    this.paint(html`<div class="group" role="group"><slot></slot></div>`);
    const slot = this.$('slot');
    const assign = () => {
      const buttons = slot.assignedElements().filter((node) => node.tagName === 'JG-BUTTON');
      buttons.forEach((button, index) => {
        const position =
          buttons.length === 1 ? 'only' : index === 0 ? 'first' : index === buttons.length - 1 ? 'last' : 'middle';
        button.setAttribute('group', position);
      });
    };
    assign();
    this.on(slot, 'slotchange', assign);
  }
}

class JGField extends JGElement {
  static styles = [
    base,
    css`
      :host { display: block; }
      :host([hidden]) { display: none; }
      :host([grow]) { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .field { display: flex; flex-direction: column; gap: 6px; height: 100%; }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 18px; }
      .label { font-size: 12px; font-weight: 500; color: var(--muted-foreground); }
      .hint { font-size: 11.5px; color: var(--muted-foreground); }
      .body { display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0; }
      ::slotted(*) { flex: 1; min-height: 0; }
      :host([row]) .field { flex-direction: row; align-items: center; justify-content: space-between; gap: 14px; }
      :host([row]) .head { flex-direction: column; align-items: flex-start; gap: 1px; }
      :host([row]) .label { color: var(--foreground); font-size: 13px; }
      :host([row]) .body { flex: 0 0 auto; }
    `,
  ];

  render() {
    const label = this.getAttribute('label');
    const hint = this.getAttribute('hint');
    const action = this.querySelector('[slot="action"]');
    this.paint(html`
      <div class="field">
        <div class="head">
          <div>
            ${label ? html`<div class="label">${label}</div>` : ''}
            ${hint ? html`<div class="hint">${hint}</div>` : ''}
          </div>
          ${action ? html`<slot name="action"></slot>` : ''}
        </div>
        <div class="body"><slot></slot></div>
      </div>
    `);
  }
}

class JGCard extends JGElement {
  static styles = [
    base,
    css`
      :host { display: block; }
      .card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 14px;
        height: 100%;
      }
      :host([soft]) .card { background: color-mix(in srgb, var(--muted) 60%, transparent); }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .titles { display: flex; flex-direction: column; gap: 2px; }
      .title { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
      .sub { font-size: 12px; color: var(--muted-foreground); }
      .body { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
    `,
  ];

  render() {
    const title = this.getAttribute('title');
    const sub = this.getAttribute('sub');
    const action = this.querySelector('[slot="action"]');
    this.paint(html`
      <div class="card">
        ${title || sub || action
          ? html`<div class="head">
              <div class="titles">
                ${title ? html`<div class="title">${title}</div>` : ''}
                ${sub ? html`<div class="sub">${sub}</div>` : ''}
              </div>
              ${action ? html`<slot name="action"></slot>` : ''}
            </div>`
          : ''}
        <div class="body"><slot></slot></div>
      </div>
    `);
  }
}

class JGBadge extends JGElement {
  static styles = [
    base,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: color-mix(in srgb, var(--muted) 70%, transparent);
        color: var(--muted-foreground);
        font-size: 11.5px;
        font-weight: 500;
        line-height: 1.6;
        white-space: nowrap;
      }
      :host([tone="success"]) {
        color: var(--success);
        border-color: color-mix(in srgb, var(--success) 35%, transparent);
        background: color-mix(in srgb, var(--success) 12%, transparent);
      }
      :host([tone="danger"]) {
        color: var(--destructive);
        border-color: color-mix(in srgb, var(--destructive) 35%, transparent);
        background: color-mix(in srgb, var(--destructive) 12%, transparent);
      }
      :host([tone="warning"]) {
        color: var(--warning);
        border-color: color-mix(in srgb, var(--warning) 35%, transparent);
        background: color-mix(in srgb, var(--warning) 12%, transparent);
      }
      :host([tone="accent"]) {
        color: var(--ring);
        border-color: color-mix(in srgb, var(--ring) 40%, transparent);
        background: color-mix(in srgb, var(--ring) 12%, transparent);
      }
      :host([mono]) { font-family: var(--font-mono); }
    `,
  ];

  render() {
    this.paint(html`<slot></slot>`);
  }
}

class JGTabs extends JGElement {
  static styles = [
    base,
    css`
      :host { display: block; }
      .tabs {
        display: inline-flex;
        gap: 2px;
        padding: 3px;
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--muted) 92%, var(--foreground) 4%);
        border: 1px solid var(--border);
        box-shadow: var(--shadow-well);
        max-width: 100%;
        overflow: auto;
        scrollbar-width: none;
      }
      .tabs::-webkit-scrollbar { display: none; }
      :host([full]) .tabs { display: flex; }
      :host([full]) button { flex: 1; }
      button {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--muted-foreground);
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 500;
        padding: 6px 12px;
        border-radius: calc(var(--radius-md) - 2px);
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s ease, color 0.15s ease;
      }
      button:hover { color: var(--foreground); }
      button[aria-selected="true"] {
        background: var(--card);
        color: var(--foreground);
        box-shadow: var(--shadow-raise);
        font-weight: 600;
      }
      button:focus-visible { outline: none; box-shadow: var(--shadow-ring); }
    `,
  ];

  #items = [];
  #value = null;

  set items(list) {
    this.#items = list.map((item) => (typeof item === 'object' ? item : { value: item, label: item }));
    this.refresh();
  }

  get items() {
    return this.#items;
  }

  get value() {
    return this.#value ?? this.getAttribute('value') ?? this.#items[0]?.value;
  }

  set value(next) {
    this.#value = next;
    this.$$('button').forEach((node) => node.setAttribute('aria-selected', String(node.dataset.value === next)));
  }

  render() {
    if (!this.#items.length) {
      this.#items = [...this.querySelectorAll('option')].map((node) => ({
        value: node.value,
        label: node.textContent,
      }));
    }
    const active = this.value;
    this.paint(html`
      <div class="tabs" role="tablist">
        ${this.#items.map(
          (item) => html`<button
            type="button"
            role="tab"
            data-value="${item.value}"
            aria-selected="${String(item.value === active)}"
          >${item.label}</button>`,
        )}
      </div>
    `);
    this.#value = active;
    this.bind('button', 'click', (event) => {
      this.value = event.currentTarget.dataset.value;
      this.emit('change', { value: this.value });
    });
  }
}

class JGCopy extends JGElement {
  static styles = [
    base,
    controlBase,
    css`
      button {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 28px;
        padding: 0 10px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
        background: transparent;
        color: var(--muted-foreground);
        font-family: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
      }
      button:hover { color: var(--foreground); background: var(--accent); }
      button:focus-visible { outline: none; box-shadow: var(--shadow-ring); }
      :host([done]) button { color: var(--success); border-color: color-mix(in srgb, var(--success) 40%, transparent); }
      :host([size="icon"]) button { width: 28px; padding: 0; justify-content: center; }
    `,
  ];

  #value = '';

  set value(next) {
    this.#value = String(next ?? '');
  }

  get value() {
    return this.#value || this.getAttribute('value') || '';
  }

  render() {
    const iconOnly = this.getAttribute('size') === 'icon';
    this.paint(html`<button type="button" aria-label="Copy">
      <span class="glyph">⧉</span>${iconOnly ? '' : html`<span class="text">${this.textContent.trim() || 'Copy'}</span>`}
    </button>`);
    this.on(this.$('button'), 'click', async () => {
      const source = this.getAttribute('from');
      const target = source ? this.getRootNode().querySelector(source) : null;
      const value = target ? target.value ?? target.textContent : this.value;
      if (!value) return;
      await copyText(value);
      this.setAttribute('done', '');
      this.$('.glyph').textContent = '✓';
      setTimeout(() => {
        this.removeAttribute('done');
        const glyph = this.$('.glyph');
        if (glyph) glyph.textContent = '⧉';
      }, 1200);
    });
  }
}

class JGOutput extends JGElement {
  static styles = [
    base,
    css`
      :host { display: block; }
      .out {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--muted) 72%, transparent);
        font-family: var(--font-mono);
        font-size: 12.5px;
        line-height: 1.6;
        min-height: 40px;
      }
      .value {
        flex: 1;
        min-width: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        user-select: all;
        color: var(--foreground);
      }
      .value:empty::before {
        content: attr(data-placeholder);
        color: var(--muted-foreground);
        user-select: none;
      }
      :host([tone="danger"]) .out {
        border-color: color-mix(in srgb, var(--destructive) 45%, transparent);
        background: color-mix(in srgb, var(--destructive) 10%, transparent);
        color: var(--destructive);
      }
      :host([tone="danger"]) .value { color: var(--destructive); }
      :host([scroll]) .value { max-height: 320px; overflow: auto; }
    `,
  ];

  #value = '';

  set value(next) {
    this.#value = String(next ?? '');
    const node = this.$('.value');
    if (node) node.textContent = this.#value;
    const copy = this.$('jg-copy');
    if (copy) copy.value = this.#value;
  }

  get value() {
    return this.#value;
  }

  render() {
    this.paint(html`
      <div class="out">
        <div class="value" data-placeholder="${this.getAttribute('placeholder') ?? '-'}">${this.#value}</div>
        ${this.hasAttribute('no-copy') ? '' : html`<jg-copy size="icon"></jg-copy>`}
      </div>
    `);
    const copy = this.$('jg-copy');
    if (copy) copy.value = this.#value;
  }
}

class JGSlider extends JGElement {
  static shadow = { mode: 'open', delegatesFocus: true };
  static styles = [
    base,
    css`
      :host { display: flex; align-items: center; gap: 10px; width: 100%; }
      input {
        flex: 1;
        min-width: 0;
        appearance: none;
        height: 4px;
        border-radius: 999px;
        background: var(--border-strong);
        outline: none;
      }
      input::-webkit-slider-thumb {
        appearance: none;
        width: 15px;
        height: 15px;
        border-radius: 999px;
        background: var(--foreground);
        border: 2px solid var(--background);
        box-shadow: var(--shadow-sm);
        cursor: pointer;
      }
      input::-moz-range-thumb {
        width: 13px;
        height: 13px;
        border-radius: 999px;
        background: var(--foreground);
        border: 2px solid var(--background);
        cursor: pointer;
      }
      .value {
        min-width: 40px;
        text-align: right;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--muted-foreground);
      }
    `,
  ];

  get value() {
    return Number(this.$('input')?.value ?? this.getAttribute('value') ?? 0);
  }

  set value(next) {
    const input = this.$('input');
    if (input) {
      input.value = next;
      this.$('.value').textContent = next;
    }
  }

  render() {
    this.paint(html`
      <input
        type="range"
        min="${this.getAttribute('min') ?? 0}"
        max="${this.getAttribute('max') ?? 100}"
        step="${this.getAttribute('step') ?? 1}"
        value="${this.getAttribute('value') ?? 0}"
      />
      <span class="value">${this.getAttribute('value') ?? 0}</span>
    `);
    this.on(this.$('input'), 'input', (event) => {
      this.$('.value').textContent = event.target.value;
    });
  }
}

class JGSegment extends JGElement {
  static styles = [
    base,
    css`
      :host { display: block; }
      .seg { display: flex; flex-wrap: wrap; gap: 6px; }
      button {
        appearance: none;
        border: 1px solid var(--border);
        background: transparent;
        color: var(--muted-foreground);
        font-family: inherit;
        font-size: 12px;
        font-weight: 500;
        padding: 5px 11px;
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      button:hover { color: var(--foreground); border-color: var(--border-strong); }
      button[aria-pressed="true"] {
        background: color-mix(in srgb, var(--ring) 18%, transparent);
        border-color: color-mix(in srgb, var(--ring) 55%, transparent);
        color: var(--foreground);
        font-weight: 600;
        box-shadow: var(--shadow-sm);
      }
    `,
  ];

  #items = [];
  #value = null;

  set items(list) {
    this.#items = list.map((item) => (typeof item === 'object' ? item : { value: item, label: item }));
    this.refresh();
  }

  get value() {
    return this.#value ?? this.getAttribute('value') ?? this.#items[0]?.value;
  }

  set value(next) {
    this.#value = next;
    this.$$('button').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.value === next)));
  }

  render() {
    const active = this.value;
    this.paint(html`
      <div class="seg">
        ${this.#items.map(
          (item) => html`<button type="button" data-value="${item.value}" aria-pressed="${String(item.value === active)}">
            ${item.label}
          </button>`,
        )}
      </div>
    `);
    this.#value = active;
    this.bind('button', 'click', (event) => {
      this.value = event.currentTarget.dataset.value;
      this.emit('change', { value: this.value });
    });
  }
}

class JGEmpty extends JGElement {
  static styles = [
    base,
    css`
      :host { display: block; }
      .empty {
        display: grid;
        place-items: center;
        gap: 8px;
        padding: 40px 20px;
        border: 1px dashed var(--border);
        border-radius: var(--radius-lg);
        text-align: center;
        color: var(--muted-foreground);
      }
      .glyph { font-size: 26px; opacity: 0.65; }
      .title { font-size: 13.5px; font-weight: 600; color: var(--foreground); }
      .text { font-size: 12.5px; max-width: 42ch; }
    `,
  ];

  render() {
    this.paint(html`
      <div class="empty">
        ${this.hasAttribute('glyph') ? html`<div class="glyph">${this.getAttribute('glyph')}</div>` : ''}
        ${this.hasAttribute('title') ? html`<div class="title">${this.getAttribute('title')}</div>` : ''}
        <div class="text"><slot></slot></div>
      </div>
    `);
  }
}

define('jg-button', JGButton);
define('jg-button-group', JGButtonGroup);
define('jg-input', JGInput);
define('jg-textarea', JGTextarea);
define('jg-select', JGSelect);
define('jg-switch', JGSwitch);
define('jg-field', JGField);
define('jg-card', JGCard);
define('jg-badge', JGBadge);
define('jg-tabs', JGTabs);
define('jg-copy', JGCopy);
define('jg-output', JGOutput);
define('jg-slider', JGSlider);
define('jg-segment', JGSegment);
define('jg-empty', JGEmpty);

export { raw };
export { confirm } from './jg-dialog.js';
