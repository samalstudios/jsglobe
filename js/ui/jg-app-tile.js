import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { router } from '../core/router.js';
import { icon } from './icons.js';

const sheet = css`
  :host {
    display: block;
    -webkit-tap-highlight-color: transparent;
  }
  a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    outline: none;
  }
  a:hover { text-decoration: none; }
  .app-icon {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--tile, 62px);
    height: var(--tile, 62px);
    border-radius: calc(var(--tile, 62px) * 0.29);
    background:
      linear-gradient(165deg,
        color-mix(in srgb, var(--tint) 96%, #fff 10%) 0%,
        var(--tint) 62%,
        color-mix(in srgb, var(--tint) 86%, #000 16%) 100%);
    color: #fff;
    font-size: calc(var(--tile, 62px) * 0.34);
    font-weight: 600;
    letter-spacing: -0.02em;
    box-shadow: 0 8px 18px -10px rgba(0, 0, 0, 0.6);
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.2), box-shadow 0.18s ease;
    overflow: hidden;
    user-select: none;
  }
  a:hover .app-icon { box-shadow: 0 14px 26px -12px rgba(0, 0, 0, 0.6); }
  .app-icon svg {
    width: calc(var(--tile, 62px) * 0.46);
    height: calc(var(--tile, 62px) * 0.46);
    stroke-width: 1.6;
  }
  a:hover .app-icon { transform: translateY(-3px) scale(1.04); }
  a:active .app-icon { transform: scale(0.94); }
  a:focus-visible .app-icon { box-shadow: var(--shadow-ring); }
  .label {
    max-width: calc(var(--tile, 62px) + 26px);
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.25;
    text-align: center;
    color: var(--foreground);
    text-shadow: var(--label-shadow);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }
  :host([no-label]) .label { display: none; }
  :host([running]) .app-icon::before {
    content: "";
    position: absolute;
    bottom: 5px;
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.9);
    z-index: 1;
  }
  :host([editing]) { animation: jiggle 0.32s ease-in-out infinite alternate; }
  :host([editing]) .remove { display: grid; }
  .remove {
    display: none;
    position: absolute;
    top: -6px;
    left: -6px;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: var(--popover);
    border: 1px solid var(--border-strong);
    color: var(--foreground);
    font-size: 12px;
    line-height: 1;
    place-items: center;
    cursor: pointer;
    z-index: 2;
  }
  .shell { position: relative; }
  :host([dragging]) { opacity: 0.35; }
  @keyframes jiggle {
    from { transform: rotate(-1.1deg); }
    to { transform: rotate(1.1deg); }
  }
`;

class JGAppTile extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['app-id', 'editing'];

  get appId() {
    return this.getAttribute('app-id');
  }

  render() {
    const app = registry.find(this.appId);
    if (!app) return this.paint('');
    this.style.setProperty('--tint', registry.tint(app));
    this.paint(html`
      <a href="${router.href(`/apps/${app.id}`)}" title="${app.tagline}" draggable="false">
        <span class="shell">
          <span class="app-icon">${icon(app.icon)}</span>
          <span class="remove" title="Remove from home">✕</span>
        </span>
        <span class="label">${app.name}</span>
      </a>
    `);
    this.on(this.$('.remove'), 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.emit('tile:remove', { appId: app.id });
    });
    this.on(this.$('a'), 'click', (event) => {
      if (this.hasAttribute('editing')) event.preventDefault();
    });
    this.on(this.$('a'), 'contextmenu', (event) => {
      event.preventDefault();
      this.emit('tile:menu', { appId: app.id, x: event.clientX, y: event.clientY });
    });
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'app-id' && previous && previous !== next) this.refresh();
  }
}

define('jg-app-tile', JGAppTile);
