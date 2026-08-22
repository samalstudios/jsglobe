export const LANGUAGES = [
  { code: 'en', path: '', label: 'English', native: 'English', locale: 'en', dir: 'ltr' },
  { code: 'de', path: 'de', label: 'German', native: 'Deutsch', locale: 'de', dir: 'ltr' },
  { code: 'es', path: 'es', label: 'Spanish', native: 'Español', locale: 'es', dir: 'ltr' },
  { code: 'zh', path: 'zh', label: 'Chinese', native: '中文', locale: 'zh-Hans', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'en';

export const languageCodes = LANGUAGES.map((entry) => entry.code);

export const languageOf = (code) => LANGUAGES.find((entry) => entry.code === code) ?? LANGUAGES[0];

export const prefixFor = (code) => {
  const entry = languageOf(code);
  return entry.path ? `/${entry.path}` : '';
};

export const isLanguagePath = (segment) => LANGUAGES.some((entry) => entry.path && entry.path === segment);

export const codeForPath = (segment) => LANGUAGES.find((entry) => entry.path === segment)?.code ?? DEFAULT_LANGUAGE;
