import { bus } from './bus.js';
import { DEFAULT_LANGUAGE, languageOf, languageCodes } from './languages.js';

let active = DEFAULT_LANGUAGE;
let pack = { ui: {}, categories: {} };
// the catalogue's names and taglines, kept out of the eagerly loaded meta files
// so they cost nothing until a language other than the default is chosen
let named = {};

const loaders = {
  de: () => import('../i18n/de.js'),
  es: () => import('../i18n/es.js'),
  zh: () => import('../i18n/zh.js'),
  fr: () => import('../i18n/fr.js'),
  pt: () => import('../i18n/pt.js'),
  ja: () => import('../i18n/ja.js'),
  ko: () => import('../i18n/ko.js'),
  nl: () => import('../i18n/nl.js'),
  sv: () => import('../i18n/sv.js'),
  no: () => import('../i18n/no.js'),
  da: () => import('../i18n/da.js'),
  pl: () => import('../i18n/pl.js'),
  uk: () => import('../i18n/uk.js'),
};

const catalogues = {
  de: () => import('../i18n/catalog/de.js'),
  es: () => import('../i18n/catalog/es.js'),
  zh: () => import('../i18n/catalog/zh.js'),
  fr: () => import('../i18n/catalog/fr.js'),
  pt: () => import('../i18n/catalog/pt.js'),
  ja: () => import('../i18n/catalog/ja.js'),
  ko: () => import('../i18n/catalog/ko.js'),
  nl: () => import('../i18n/catalog/nl.js'),
  sv: () => import('../i18n/catalog/sv.js'),
  no: () => import('../i18n/catalog/no.js'),
  da: () => import('../i18n/catalog/da.js'),
  pl: () => import('../i18n/catalog/pl.js'),
  uk: () => import('../i18n/catalog/uk.js'),
};

export const language = () => active;

export const isTranslated = () => active !== DEFAULT_LANGUAGE;

export const loadLanguage = async (code) => {
  if (!languageCodes.includes(code)) code = DEFAULT_LANGUAGE;
  if (code === active && (code === DEFAULT_LANGUAGE || Object.keys(pack.ui).length)) return;
  if (code === DEFAULT_LANGUAGE) {
    active = code;
    pack = { ui: {}, categories: {} };
    named = {};
  } else {
    const [module, catalogue] = await Promise.all([loaders[code](), catalogues[code]?.().catch(() => null)]);
    active = code;
    pack = { ui: {}, categories: {}, ...module.default };
    named = catalogue?.default ?? {};
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

export const appName = (app) => named[app.id]?.name ?? app.i18n?.[active]?.name ?? app.name;

export const appTagline = (app) => named[app.id]?.tagline ?? app.i18n?.[active]?.tagline ?? app.tagline;

export const appKeywords = (app) => [...(app.keywords ?? []), ...(named[app.id]?.keywords ?? app.i18n?.[active]?.keywords ?? [])];

export const categoryName = (category) => pack.categories[category.id] ?? category.name;

export const localise = (app) => ({ ...app, name: appName(app), tagline: appTagline(app), keywords: appKeywords(app) });
