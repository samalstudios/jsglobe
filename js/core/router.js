import { bus } from './bus.js';
import { DEFAULT_LANGUAGE, codeForPath, isLanguagePath, prefixFor } from './languages.js';

const baseHref = document.querySelector('base')?.getAttribute('href') ?? '/';
export const BASE = new URL(baseHref, window.location.origin).pathname.replace(/\/+$/, '');

const strip = (pathname) => {
  const clean = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  return clean.replace(/^\/+/, '').replace(/\/+$/, '');
};

const parse = () => {
  const raw = strip(window.location.pathname).split('/').filter(Boolean);
  const language = raw.length && isLanguagePath(raw[0]) ? codeForPath(raw[0]) : DEFAULT_LANGUAGE;
  const segments = language === DEFAULT_LANGUAGE ? raw : raw.slice(1);
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  const [head, ...rest] = segments;
  const base = { language, segments, params };

  if (!head) return { ...base, name: 'home' };
  if (head === 'search') return { ...base, name: 'search', query: params.q ?? '' };
  if (head === 'privacy') return { ...base, name: 'privacy' };
  if (head !== 'apps') return { ...base, name: 'app', appId: head, path: rest, legacy: true };
  if (!rest.length) return { ...base, name: 'directory', category: params.category ?? null };
  if (rest[0] === 'category') return { ...base, name: 'directory', category: rest[1] ?? null };
  return { ...base, name: 'app', appId: rest[0], path: rest.slice(1) };
};

let current = parse();

const migrateHash = () => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return false;
  const segments = hash.split('?')[0].split('/').filter(Boolean);
  const rest = segments[0] === 'app' ? segments.slice(1) : segments;
  if (!rest.length) return false;
  history.replaceState(null, '', router.href(`/apps/${rest.join('/')}`));
  return true;
};

const migrateLegacy = () => {
  if (!current.legacy) return false;
  const path = [current.appId, ...current.path].join('/');
  history.replaceState(null, '', `${router.href(`/apps/${path}`)}${window.location.search}`);
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

  get language() {
    return current.language;
  },

  href(path = '/', language = current.language) {
    const tail = path.startsWith('/') ? path : `/${path}`;
    return `${BASE}${prefixFor(language)}${tail === '/' ? '/' : tail}` || '/';
  },

  pathFor(language) {
    const tail = current.segments.length ? `/${current.segments.join('/')}` : '/';
    return `${router.href(tail, language)}${window.location.search}`;
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
      router.navigate(`${url.pathname}${url.search}`);
    });

    bus.emit('route:change', current);
  },

  navigate(target) {
    if (target === `${window.location.pathname}${window.location.search}`) return;
    history.pushState(null, '', target || '/');
    current = parse();
    bus.emit('route:change', current);
  },

  go(path, params) {
    const query = params && Object.keys(params).length ? `?${new URLSearchParams(params)}` : '';
    router.navigate(`${router.href(path)}${query}`);
  },

  replace(path) {
    history.replaceState(null, '', router.href(path) || '/');
    current = parse();
    bus.emit('route:change', current);
  },

  switchLanguage(code) {
    router.navigate(router.pathFor(code));
  },

  home: () => router.go('/'),

  app: (id) => router.go(`/apps/${id}`),

  directory: (category) => router.go(category ? `/apps/category/${category}` : '/apps'),

  search: (query) => router.go('/search', query ? { q: query } : undefined),
};
