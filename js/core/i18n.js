import { bus } from './bus.js';
import { DEFAULT_LANGUAGE, languageOf, languageCodes } from './languages.js';

let active = DEFAULT_LANGUAGE;
let pack = { ui: {}, apps: {}, categories: {} };

const loaders = {
  de: () => import('../i18n/de.js'),
  es: () => import('../i18n/es.js'),
  zh: () => import('../i18n/zh.js'),
};

const appLoaders = {
  de: () => import('../i18n/de-apps.js'),
  es: () => import('../i18n/es-apps.js'),
  zh: () => import('../i18n/zh-apps.js'),
};

export const language = () => active;

export const isTranslated = () => active !== DEFAULT_LANGUAGE;

export const loadLanguage = async (code) => {
  if (!languageCodes.includes(code)) code = DEFAULT_LANGUAGE;
  if (code === active && (code === DEFAULT_LANGUAGE || Object.keys(pack.ui).length)) return;
  if (code === DEFAULT_LANGUAGE) {
    active = code;
    pack = { ui: {}, apps: {}, categories: {} };
  } else {
    const [module, appModule] = await Promise.all([
      loaders[code](),
      appLoaders[code]().catch(() => ({ default: {} })),
    ]);
    active = code;
    pack = { ui: {}, apps: {}, categories: {}, ...module.default };
    pack.ui = { ...pack.ui, ...appModule.default };
  }
  const entry = languageOf(active);
  document.documentElement.lang = entry.locale;
  document.documentElement.dir = entry.dir;
  bus.emit('language:change', active);
};

export const t = (key, fallback = key, vars) => {
  const raw = pack.ui[key] ?? fallback;
  if (!vars) return raw;
  return String(raw).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
};

export const appName = (app) => pack.apps[app.id]?.name ?? app.name;

export const appTagline = (app) => pack.apps[app.id]?.tagline ?? app.tagline;

export const appKeywords = (app) => [...(app.keywords ?? []), ...(pack.apps[app.id]?.keywords ?? [])];

export const categoryName = (category) => pack.categories[category.id] ?? category.name;

export const localise = (app) => ({ ...app, name: appName(app), tagline: appTagline(app), keywords: appKeywords(app) });
