import { JGElement, define, css, html } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { router } from '../core/router.js';
import './jg-app-tile.js';
import { icon } from './icons.js';

const sheet = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 200;
    overflow: auto;
    padding: 22px clamp(18px, 5vw, 56px) 48px;
    background: color-mix(in srgb, var(--background) 72%, transparent);
    backdrop-filter: blur(26px) saturate(150%);
    -webkit-backdrop-filter: blur(26px) saturate(150%);
    animation: library-in 0.18s ease;
  }
  @keyframes library-in {
    from { opacity: 0; transform: scale(1.01); }
    to { opacity: 1; transform: none; }
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
  h1 { font-size: 20px; font-weight: 650; letter-spacing: -0.02em; margin: 0; }
  .sub { font-size: 12.5px; color: var(--muted-foreground); }
  .close {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: var(--glass);
    color: var(--foreground);
    cursor: pointer;
  }
  .filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
  .filter {
    appearance: none;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted-foreground);
    font: 500 12px/1 var(--font-sans);
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
  }
  .filter[aria-pressed="true"] {
    color: var(--foreground);
    border-color: color-mix(in srgb, var(--ring) 50%, transparent);
    background: color-mix(in srgb, var(--ring) 15%, transparent);
  }
  section { margin-bottom: 26px; }
  h2 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted-foreground);
    margin: 0 0 12px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 10px;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: var(--card);
    color: inherit;
    text-decoration: none;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .card:hover { border-color: var(--border-strong); transform: translateY(-2px); text-decoration: none; }
  .badge {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--tint);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    flex: none;
  }
  .meta { min-width: 0; }
  .name { font-size: 13px; font-weight: 600; }
  .tag {
    font-size: 11.5px;
    color: var(--muted-foreground);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
`;

class JGLibrary extends JGElement {
  static styles = [base, sheet];

  #filter = null;
  #painted = false;

  connectedCallback() {
    super.connectedCallback();
    this.listen(window, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      router.home();
    });
  }

  set category(value) {
    const next = value ?? null;
    if (this.#painted && next === this.#filter) return;
    this.#filter = next;
    this.#painted = true;
    this.refresh();
    this.scrollTop = 0;
  }

  render() {
    const groups = registry.categories().filter((group) => !this.#filter || group.id === this.#filter);
    this.paint(html`
      <header>
        <div>
          <h1>${t('library.title', 'App Library')}</h1>
          <div class="sub">${t('library.sub', `${registry.all().length} tools - every app has its own link`, { count: registry.all().length })}</div>
        </div>
        <button class="close" title="${t('action.close', 'Close')}">✕</button>
      </header>
      <div class="filters">
        <button class="filter" data-id="" aria-pressed="${String(!this.#filter)}">${t('home.all', 'All')}</button>
        ${registry.categories().map(
          (group) => html`<button class="filter" data-id="${group.id}" aria-pressed="${String(this.#filter === group.id)}">
            ${group.name}
          </button>`,
        )}
      </div>
      ${groups.map(
        (group) => html`<section>
          <h2>${group.name}</h2>
          <div class="grid">
            ${registry
              .byCategory(group.id)
              .filter((app) => !app.system)
              .map(
                (app) => html`<a class="card" href="${router.href(`/apps/${app.id}`)}" style="--tint:${registry.tint(app)}">
                  <span class="badge">${icon(app.icon, 18)}</span>
                  <span class="meta">
                    <span class="name">${app.name}</span>
                    <span class="tag">${app.tagline}</span>
                  </span>
                </a>`,
              )}
          </div>
        </section>`,
      )}
    `);

    this.on(this.$('.close'), 'click', () => router.home());
    this.bind('.filter', 'click', (event) => {
      router.directory(event.currentTarget.dataset.id);
    });
  }
}

define('jg-library', JGLibrary);
