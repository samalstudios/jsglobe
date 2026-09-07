export const LANGUAGES = [
  { code: 'en', path: '', label: 'English', native: 'English', locale: 'en', dir: 'ltr' },
  { code: 'de', path: 'de', label: 'German', native: 'Deutsch', locale: 'de', dir: 'ltr' },
  { code: 'es', path: 'es', label: 'Spanish', native: 'Español', locale: 'es', dir: 'ltr' },
  { code: 'zh', path: 'zh', label: 'Chinese', native: '中文', locale: 'zh-Hans', dir: 'ltr' },
  { code: 'fr', path: 'fr', label: 'French', native: 'Français', locale: 'fr', dir: 'ltr' },
  { code: 'pt', path: 'pt', label: 'Portuguese', native: 'Português', locale: 'pt-BR', dir: 'ltr' },
  { code: 'ja', path: 'ja', label: 'Japanese', native: '日本語', locale: 'ja', dir: 'ltr' },
  { code: 'ko', path: 'ko', label: 'Korean', native: '한국어', locale: 'ko', dir: 'ltr' },
  { code: 'nl', path: 'nl', label: 'Dutch', native: 'Nederlands', locale: 'nl', dir: 'ltr' },
  { code: 'sv', path: 'sv', label: 'Swedish', native: 'Svenska', locale: 'sv', dir: 'ltr' },
  { code: 'no', path: 'no', label: 'Norwegian', native: 'Norsk', locale: 'nb', dir: 'ltr' },
  { code: 'da', path: 'da', label: 'Danish', native: 'Dansk', locale: 'da', dir: 'ltr' },
  { code: 'pl', path: 'pl', label: 'Polish', native: 'Polski', locale: 'pl', dir: 'ltr' },
  { code: 'uk', path: 'uk', label: 'Ukrainian', native: 'Українська', locale: 'uk', dir: 'ltr' },
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
