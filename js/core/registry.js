import { catalog, categories } from '../apps/catalog.js';

const byId = new Map(catalog.map((app) => [app.id, app]));
const pending = new Map();

const score = (app, query) => {
  const name = app.name.toLowerCase();
  const id = app.id.toLowerCase();
  if (name === query || id === query) return 100;
  if (name.startsWith(query)) return 80;
  if (id.startsWith(query)) return 70;
  if (name.includes(query)) return 55;
  if (app.keywords?.some((word) => word === query)) return 50;
  if (app.keywords?.some((word) => word.startsWith(query))) return 40;
  if (app.tagline.toLowerCase().includes(query)) return 25;
  if (app.keywords?.some((word) => word.includes(query))) return 15;
  return 0;
};

export const registry = {
  all: (options = {}) => catalog.filter((app) => (options.includeSystem ? true : !app.system)),

  categories: () => categories.filter((group) => catalog.some((app) => app.category === group.id && !app.system)),

  category: (id) => categories.find((group) => group.id === id),

  find: (id) => byId.get(id) ?? null,

  byCategory(id) {
    return catalog.filter((app) => app.category === id);
  },

  search(query, limit = 12) {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return catalog
      .map((app) => ({ app, rank: score(app, term) }))
      .filter((entry) => entry.rank > 0)
      .sort((a, b) => b.rank - a.rank || a.app.name.localeCompare(b.app.name))
      .slice(0, limit)
      .map((entry) => entry.app);
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
