import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { keys } from '../core/keys.js';

const sheet = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: none;
    overflow: hidden;
  }
  :host([open]) { display: block; }

  .backdrop {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--background) 48%, transparent);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    animation: fade 0.18s ease;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }

  .panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(var(--sheet-width, 340px), 88%);
    display: flex;
    flex-direction: column;
    background: var(--glass-strong);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border-left: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    animation: slide-left 0.26s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  :host([side="left"]) .panel {
    right: auto;
    left: 0;
    border-left: 0;
    border-right: 1px solid var(--border);
    animation: slide-right 0.26s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  @keyframes slide-left { from { transform: translateX(100%); } to { transform: none; } }
  @keyframes slide-right { from { transform: translateX(-100%); } to { transform: none; } }
  @keyframes slide-up { from { transform: translateY(100%); } to { transform: none; } }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 12px 12px 16px;
    border-bottom: 1px solid var(--border);
    flex: none;
  }
  .names { display: grid; gap: 1px; min-width: 0; flex: 1; }
  .title { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
  .sub { font-size: 11.5px; color: var(--muted-foreground); }
  .close {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex: none;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted-foreground);
    font-size: 12px;
    cursor: pointer;
  }
  .close:hover { color: var(--foreground); background: var(--accent); }

  .grabber { display: none; }

  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 14px 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scrollbar-width: thin;
  }

  @media (max-width: 860px) {
    .panel {
      inset: auto 0 0 0;
      width: auto;
      max-height: min(78%, 560px);
      border-left: 0;
      border-right: 0;
      border-top: 1px solid var(--border);
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
      animation: slide-up 0.26s cubic-bezier(0.2, 0.9, 0.3, 1);
    }
    :host([side="left"]) .panel { animation: slide-up 0.26s cubic-bezier(0.2, 0.9, 0.3, 1); }
    .grabber {
      display: block;
      width: 38px;
      height: 4px;
      margin: 8px auto 0;
      border-radius: 999px;
      background: var(--border-strong);
      flex: none;
    }
    header { padding-top: 10px; }
  }
`;

class JGSheet extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['open', 'title-text', 'sub'];

  #release = null;

  get isOpen() {
    return this.hasAttribute('open');
  }

  open() {
    if (this.isOpen) return;
    this.#release ??= keys.overlay();
    this.setAttribute('open', '');
    this.emit('sheet:open');
    queueMicrotask(() => this.$('.close')?.focus());
  }

  close() {
    if (!this.isOpen) return;
    this.#release?.();
    this.#release = null;
    this.removeAttribute('open');
    this.emit('sheet:close');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#release?.();
    this.#release = null;
  }

  render() {
    this.paint(html`
      <div class="backdrop"></div>
      <aside class="panel" role="dialog" aria-modal="true" aria-label="${this.getAttribute('title-text') ?? 'Panel'}">
        <span class="grabber"></span>
        <header>
          <span class="names">
            <span class="title">${this.getAttribute('title-text') ?? ''}</span>
            ${this.getAttribute('sub') ? html`<span class="sub">${this.getAttribute('sub')}</span>` : ''}
          </span>
          <button class="close" title="Close" aria-label="Close">✕</button>
        </header>
        <div class="body"><slot></slot></div>
      </aside>
    `);

    this.on(this.$('.backdrop'), 'click', () => this.close());
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

define('jg-sheet', JGSheet);
