import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';

const sheet = css`
  :host { display: contents; }
  .shield {
    position: fixed;
    inset: 0;
    z-index: 650;
    display: none;
  }
  :host([open]) .shield { display: block; }
  .bubble {
    position: fixed;
    z-index: 651;
    min-width: var(--popover-min, 200px);
    max-width: min(var(--popover-max, 320px), calc(100vw - 24px));
    padding: 12px 14px;
    border-radius: var(--radius-lg);
    background: var(--glass-strong);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    color: var(--foreground);
    font-size: 13px;
    display: none;
    flex-direction: column;
    gap: 8px;
    animation: pop 0.15s cubic-bezier(0.2, 0.9, 0.3, 1.2);
    transform-origin: top center;
  }
  :host([open]) .bubble { display: flex; }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.96) translateY(-4px); }
    to { opacity: 1; transform: none; }
  }
  .head { font-size: 12.5px; font-weight: 600; }
  .head:empty { display: none; }
  .arrow {
    position: fixed;
    z-index: 652;
    width: 10px;
    height: 10px;
    rotate: 45deg;
    background: var(--glass-strong);
    border-left: 1px solid var(--glass-border);
    border-top: 1px solid var(--glass-border);
    display: none;
  }
  :host([open]) .arrow { display: block; }
  :host([placement="top"]) .arrow { border: 0; border-right: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border); }
`;

const GAP = 10;

class JGPopover extends JGElement {
  static styles = [base, sheet];

  #anchor = null;

  get isOpen() {
    return this.hasAttribute('open');
  }

  open(anchor) {
    this.#anchor = anchor ?? this.#anchor;
    if (!this.#anchor) return;
    this.setAttribute('open', '');
    this.#place();
    this.emit('popover:open');
  }

  close() {
    if (!this.isOpen) return;
    this.removeAttribute('open');
    this.emit('popover:close');
  }

  toggle(anchor) {
    if (this.isOpen) this.close();
    else this.open(anchor);
  }

  render() {
    this.paint(html`
      <div class="shield"></div>
      <span class="arrow"></span>
      <div class="bubble" role="dialog">
        <span class="head">${this.getAttribute('title-text') ?? ''}</span>
        <slot></slot>
      </div>
    `);

    this.on(this.$('.shield'), 'pointerdown', () => this.close());
    this.listen(window, 'keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });
    this.listen(window, 'resize', () => this.isOpen && this.#place());
    this.listen(window, 'scroll', () => this.isOpen && this.#place(), true);
  }

  #place() {
    const anchor = this.#anchor?.getBoundingClientRect?.();
    const bubble = this.$('.bubble');
    const arrow = this.$('.arrow');
    if (!anchor || !bubble) return;

    bubble.style.left = '0px';
    bubble.style.top = '0px';
    const size = bubble.getBoundingClientRect();

    const below = window.innerHeight - anchor.bottom > size.height + GAP + 8;
    const top = below ? anchor.bottom + GAP : anchor.top - size.height - GAP;
    const left = Math.min(
      Math.max(12, anchor.left + anchor.width / 2 - size.width / 2),
      window.innerWidth - size.width - 12,
    );

    this.setAttribute('placement', below ? 'bottom' : 'top');
    bubble.style.left = `${Math.round(left)}px`;
    bubble.style.top = `${Math.round(top)}px`;

    arrow.style.left = `${Math.round(anchor.left + anchor.width / 2 - 5)}px`;
    arrow.style.top = `${Math.round(below ? anchor.bottom + GAP - 5 : anchor.top - GAP - 5)}px`;
  }
}

define('jg-popover', JGPopover);
