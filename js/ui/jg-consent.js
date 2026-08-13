import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { consent } from '../core/consent.js';
import { analytics } from '../core/analytics.js';
import { router } from '../core/router.js';
import { bus } from '../core/bus.js';

const sheet = css`
  :host {
    position: fixed;
    left: 50%;
    bottom: 18px;
    z-index: 200;
    width: min(680px, calc(100vw - 28px));
    transform: translate(-50%, 140%);
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }
  :host([open]) { transform: translate(-50%, 0); }

  .card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-radius: var(--radius-xl);
    border: 1px solid var(--glass-border);
    background: var(--glass-strong);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: var(--shadow-lg);
  }
  @media (max-width: 640px) { .card { flex-direction: column; align-items: stretch; gap: 12px; } }

  .copy { flex: 1; min-width: 0; }
  .title { font: 600 13.5px/1.4 var(--font-sans); color: var(--foreground); }
  .text { font: 400 12.5px/1.55 var(--font-sans); color: var(--muted-foreground); margin-top: 3px; }
  .text a { color: var(--foreground); text-underline-offset: 2px; }

  .actions { display: flex; align-items: center; gap: 8px; flex: none; }
  @media (max-width: 640px) { .actions { justify-content: flex-end; } }

  button {
    appearance: none;
    height: 32px;
    padding: 0 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--foreground);
    font: 500 12.5px/1 var(--font-sans);
    cursor: pointer;
  }
  button:hover { border-color: var(--border-strong); background: var(--accent); }
  button.primary {
    border-color: transparent;
    background: var(--ring);
    color: #fff;
  }
  button.primary:hover { filter: brightness(1.08); background: var(--ring); }
`;

class JGConsent extends JGElement {
  static styles = [base, sheet];

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('consent:change', () => this.#sync()));
  }

  render() {
    this.paint(html`
      <div class="card" role="dialog" aria-live="polite" aria-label="Cookie choices">
        <div class="copy">
          <div class="title">Cookies for anonymous usage stats</div>
          <div class="text">
            Toolbox runs entirely in your browser and never uploads what you paste. We would like to use Google
            Analytics cookies to count which tools get opened. Nothing else is tracked.
            <a href="${router.href('/privacy')}">Privacy policy</a>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="decline">Decline</button>
          <button type="button" class="primary accept">Accept</button>
        </div>
      </div>
    `);

    this.on(this.$('.accept'), 'click', () => this.#decide(true));
    this.on(this.$('.decline'), 'click', () => this.#decide(false));
    this.on(this.$('.text a'), 'click', () => this.removeAttribute('open'));
    this.#sync();
  }

  #sync() {
    if (consent.decided) this.removeAttribute('open');
    else requestAnimationFrame(() => this.setAttribute('open', ''));
  }

  #decide(accepted) {
    consent.set(accepted);
    if (accepted) analytics.start();
    else analytics.stop();
  }
}

define('jg-consent', JGConsent);
