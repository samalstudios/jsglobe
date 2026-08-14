import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { keys } from '../core/keys.js';

const sheet = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 700;
    display: none;
  }
  :host([open]) { display: block; }
  :host([inline]) { position: absolute; z-index: 40; }

  .veil {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--background) 55%, transparent);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: fade 0.16s ease;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  .panel {
    position: relative;
    width: min(var(--dialog-width, 460px), calc(100% - 32px));
    max-height: calc(100% - 64px);
    margin: min(18vh, 120px) auto 0;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-xl);
    background: var(--glass-strong);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    animation: rise 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.1);
    overflow: hidden;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }

  header { display: flex; align-items: flex-start; gap: 12px; padding: 18px 18px 0; }
  .names { display: grid; gap: 3px; flex: 1; min-width: 0; }
  .title { font-size: 15.5px; font-weight: 650; letter-spacing: -0.01em; }
  .sub { font-size: 12.5px; color: var(--muted-foreground); line-height: 1.5; }
  .close {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: 12px;
  }
  .close:hover { background: var(--accent); color: var(--foreground); }

  .body {
    padding: 14px 18px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scrollbar-width: thin;
  }
  .body:empty { display: none; }

  footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px 16px;
  }
  footer:not(:has(*)) { display: none; }

  @media (max-width: 640px) {
    .panel { margin-top: auto; margin-bottom: 0; width: 100%; border-radius: var(--radius-xl) var(--radius-xl) 0 0; }
    :host { display: none; }
    :host([open]) { display: flex; flex-direction: column; justify-content: flex-end; }
  }
`;

class JGDialog extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['title-text', 'sub'];

  #release = null;
  #previous = null;

  get isOpen() {
    return this.hasAttribute('open');
  }

  open() {
    if (this.isOpen) return;
    this.#previous = this.getRootNode()?.activeElement ?? null;
    this.#release ??= keys.overlay();
    this.setAttribute('open', '');
    this.emit('dialog:open');
    queueMicrotask(() => (this.querySelector('[autofocus]') ?? this.$('.close'))?.focus());
  }

  close(reason = 'dismiss') {
    if (!this.isOpen) return;
    this.#release?.();
    this.#release = null;
    this.removeAttribute('open');
    this.emit('dialog:close', { reason });
    this.#previous?.focus?.();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#release?.();
    this.#release = null;
  }

  render() {
    this.paint(html`
      <div class="veil"></div>
      <div class="panel" role="dialog" aria-modal="true" aria-label="${this.getAttribute('title-text') ?? 'Dialog'}">
        <header>
          <span class="names">
            <span class="title">${this.getAttribute('title-text') ?? ''}</span>
            ${this.getAttribute('sub') ? html`<span class="sub">${this.getAttribute('sub')}</span>` : ''}
          </span>
          <button class="close" title="Close" aria-label="Close">✕</button>
        </header>
        <div class="body"><slot></slot></div>
        <footer><slot name="actions"></slot></footer>
      </div>
    `);

    this.on(this.$('.veil'), 'click', () => this.close());
    this.on(this.$('.close'), 'click', () => this.close());
    this.listen(window, 'keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        event.stopPropagation();
        this.close();
      }
    });
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next || !this.$('.title')) return;
    if (name === 'title-text') this.$('.title').textContent = next ?? '';
    if (name === 'sub') this.refresh();
  }
}

define('jg-dialog', JGDialog);

export const confirm = ({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  root = document.body,
} = {}) =>
  new Promise((resolve) => {
    const dialog = document.createElement('jg-dialog');
    dialog.setAttribute('title-text', title);
    if (message) dialog.setAttribute('sub', message);

    const cancel = document.createElement('jg-button');
    cancel.setAttribute('variant', 'outline');
    cancel.setAttribute('slot', 'actions');
    cancel.textContent = cancelLabel;

    const accept = document.createElement('jg-button');
    accept.setAttribute('variant', danger ? 'destructive' : 'primary');
    accept.setAttribute('slot', 'actions');
    accept.setAttribute('autofocus', '');
    accept.textContent = confirmLabel;

    dialog.append(cancel, accept);
    root.append(dialog);

    const finish = (value) => {
      resolve(value);
      dialog.close();
      setTimeout(() => dialog.remove(), 200);
    };

    cancel.addEventListener('click', () => finish(false));
    accept.addEventListener('click', () => finish(true));
    dialog.addEventListener('dialog:close', () => resolve(false));

    requestAnimationFrame(() => dialog.open());
  });
