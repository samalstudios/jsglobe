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
  if (head === 'apps') return { name: 'directory', category: rest[0] ?? null, segments, params };
  return { name: 'app', appId: head, path: rest, segments, params };
};

let current = parse();

const migrateHash = () => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return false;
  const segments = hash.split('?')[0].split('/').filter(Boolean);
  const target = segments[0] === 'app' ? segments[1] : segments[0];
  if (!target) return false;
  history.replaceState(null, '', `${BASE}/${target}`);
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

    window.addEventListener('popstate', () => {
      current = parse();
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

  app: (id) => router.go(`/${id}`),

  search: (query) => router.go('/search', query ? { q: query } : undefined),
};
