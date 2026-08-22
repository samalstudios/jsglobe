import { bus } from './bus.js';
import { DEFAULT_LANGUAGE, languageOf, languageCodes } from './languages.js';

let active = DEFAULT_LANGUAGE;
let pack = { ui: {}, categories: {} };

const loaders = {
  de: () => import('../i18n/de.js'),
  es: () => import('../i18n/es.js'),
  zh: () => import('../i18n/zh.js'),
};

export const language = () => active;

export const isTranslated = () => active !== DEFAULT_LANGUAGE;

export const loadLanguage = async (code) => {
  if (!languageCodes.includes(code)) code = DEFAULT_LANGUAGE;
  if (code === active && (code === DEFAULT_LANGUAGE || Object.keys(pack.ui).length)) return;
  if (code === DEFAULT_LANGUAGE) {
    active = code;
    pack = { ui: {}, categories: {} };
  } else {
    const module = await loaders[code]();
    active = code;
    pack = { ui: {}, categories: {}, ...module.default };
  }
  const entry = languageOf(active);
  document.documentElement.lang = entry.locale;
  document.documentElement.dir = entry.dir;
  bus.emit('language:change', active);
};

const interpolate = (raw, vars) => {
  if (!vars) return raw;
  return String(raw).replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
};

export const t = (key, fallback = key, vars) => interpolate(pack.ui[key] ?? fallback, vars);

export const appText = (strings = {}) => (key, fallback = key, vars) =>
  interpolate(strings[active]?.[key] ?? fallback, vars);

export const appName = (app) => app.i18n?.[active]?.name ?? app.name;

export const appTagline = (app) => app.i18n?.[active]?.tagline ?? app.tagline;

export const appKeywords = (app) => [...(app.keywords ?? []), ...(app.i18n?.[active]?.keywords ?? [])];

export const categoryName = (category) => pack.categories[category.id] ?? category.name;

export const localise = (app) => ({ ...app, name: appName(app), tagline: appTagline(app), keywords: appKeywords(app) });
