import { catalog, categories } from '../apps/catalog.js';
import { settings } from './settings.js';
import { bus } from './bus.js';
import { appName, appTagline, categoryName, language } from './i18n.js';

const byId = new Map(catalog.map((app) => [app.id, app]));
const pending = new Map();

let localised = new Map();
let localGroups = new Map();

bus.on('language:change', () => {
  localised = new Map();
  localGroups = new Map();
});

const shown = (app) => {
  if (!app) return app;
  if (language() === 'en') return app;
  let entry = localised.get(app.id);
  if (!entry) {
    entry = { ...app, name: appName(app), tagline: appTagline(app), source: app };
    localised.set(app.id, entry);
  }
  return entry;
};

const shownGroup = (group) => {
  if (!group) return group;
  if (language() === 'en') return group;
  let entry = localGroups.get(group.id);
  if (!entry) {
    entry = { ...group, name: categoryName(group), source: group };
    localGroups.set(group.id, entry);
  }
  return entry;
};

const matches = (value, query, exact) => {
  const text = String(value ?? '').toLowerCase();
  return exact ? text === query : text.includes(query);
};

const score = (app, query) => {
  const names = [app.name.toLowerCase(), appName(app).toLowerCase()];
  const taglines = [app.tagline, appTagline(app)];
  const id = app.id.toLowerCase();
  if (names.some((name) => name === query) || id === query) return 100;
  if (names.some((name) => name.startsWith(query))) return 80;
  if (id.startsWith(query)) return 70;
  if (names.some((name) => name.includes(query))) return 55;
  if (app.keywords?.some((word) => matches(word, query, true))) return 50;
  if (app.keywords?.some((word) => word.toLowerCase().startsWith(query))) return 40;
  if (taglines.some((line) => matches(line, query))) return 25;
  if (app.keywords?.some((word) => matches(word, query))) return 15;
  return 0;
};

export const registry = {
  all: (options = {}) => catalog.filter((app) => (options.includeSystem ? true : !app.system)).map(shown),

  categories: () =>
    categories.filter((group) => catalog.some((app) => app.category === group.id && !app.system)).map(shownGroup),

  category: (id) => shownGroup(categories.find((group) => group.id === id)),

  find: (id) => shown(byId.get(id)) ?? null,

  tint(app) {
    const meta = typeof app === 'string' ? byId.get(app) : app;
    if (!meta) return 'var(--muted-foreground)';
    const mode = settings.get('appearance.iconTint');
    if (mode === 'accent') return 'var(--ring)';
    if (mode === 'neutral') return 'var(--muted-foreground)';
    return categories.find((group) => group.id === meta.category)?.tint ?? meta.tint;
  },

  byCategory(id) {
    return catalog.filter((app) => app.category === id).map(shown);
  },

  search(query, limit = 12) {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return catalog
      .map((app) => ({ app, rank: score(app, term) }))
      .filter((entry) => entry.rank > 0)
      .sort((a, b) => b.rank - a.rank || a.app.name.localeCompare(b.app.name))
      .slice(0, limit)
      .map((entry) => shown(entry.app));
  },

  async load(id) {
    const app = byId.get(id);
    if (!app) return null;
    if (!pending.has(id)) {
      pending.set(
        id,
        app.load().catch((error) => {
          pending.delete(id);
          throw error;
        }),
      );
    }
    await pending.get(id);
    await customElements.whenDefined(app.tag);
    return app;
  },

  async create(id, mode = 'window') {
    let app;
    try {
      app = await registry.load(id);
    } catch {
      app = null;
    }
    if (!app) {
      const fallback = document.createElement('div');
      fallback.setAttribute('style', 'display:grid;place-items:center;height:100%;padding:24px;text-align:center;color:var(--muted-foreground);font:13px/1.6 var(--font-sans)');
      fallback.textContent = `"${id}" could not be loaded. The tool may not be installed in this build.`;
      return fallback;
    }
    const element = document.createElement(app.tag);
    element.setAttribute('mode', mode);
    element.dataset.appId = id;
    return element;
  },
};
