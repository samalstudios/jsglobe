import { bus } from './bus.js';

const baseHref = document.querySelector('base')?.getAttribute('href') ?? '/';
export const BASE = new URL(baseHref, window.location.origin).pathname.replace(/\/+$/, '');

const strip = (pathname) => {
  const clean = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  return clean.replace(/^\/+/, '').replace(/\/+$/, '');
};

const parse = () => {
  const segments = strip(window.location.pathname).split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  const [head, ...rest] = segments;

  if (!head) return { name: 'home', segments, params };
  if (head === 'search') return { name: 'search', query: params.q ?? '', segments, params };
  if (head === 'privacy') return { name: 'privacy', segments, params };
  if (head !== 'apps') return { name: 'app', appId: head, path: rest, segments, params, legacy: true };
  if (!rest.length) return { name: 'directory', category: params.category ?? null, segments, params };
  return { name: 'app', appId: rest[0], path: rest.slice(1), segments, params };
};

let current = parse();

const migrateHash = () => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return false;
  const segments = hash.split('?')[0].split('/').filter(Boolean);
  const rest = segments[0] === 'app' ? segments.slice(1) : segments;
  if (!rest.length) return false;
  history.replaceState(null, '', `${BASE}/apps/${rest.join('/')}`);
  return true;
};

const migrateLegacy = () => {
  if (!current.legacy) return false;
  const path = [current.appId, ...current.path].join('/');
  history.replaceState(null, '', `${BASE}/apps/${path}${window.location.search}`);
  return true;
};

const anchorFrom = (event) => {
  for (const node of event.composedPath()) {
    if (node instanceof HTMLAnchorElement) return node;
  }
  return null;
};

export const router = {
  get current() {
    return current;
  },

  href(path = '/') {
    return `${BASE}${path.startsWith('/') ? path : `/${path}`}` || '/';
  },

  start() {
    if (migrateHash()) current = parse();
    if (migrateLegacy()) current = parse();

    window.addEventListener('popstate', () => {
      current = parse();
      if (migrateLegacy()) current = parse();
      bus.emit('route:change', current);
    });

    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = anchorFrom(event);
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      router.go(`${url.pathname}${url.search}`);
    });

    bus.emit('route:change', current);
  },

  go(path, params) {
    const query = params && Object.keys(params).length ? `?${new URLSearchParams(params)}` : '';
    const target = path.startsWith(BASE) ? `${path}${query}` : `${router.href(path)}${query}`;
    if (target === `${window.location.pathname}${window.location.search}`) return;
    history.pushState(null, '', target || '/');
    current = parse();
    bus.emit('route:change', current);
  },

  replace(path) {
    history.replaceState(null, '', router.href(path) || '/');
    current = parse();
    bus.emit('route:change', current);
  },

  home: () => router.go('/'),

  app: (id) => router.go(`/apps/${id}`),

  directory: (category) => router.go('/apps', category ? { category } : undefined),

  search: (query) => router.go('/search', query ? { q: query } : undefined),
};
