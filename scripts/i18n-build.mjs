import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const LANGS = ['de', 'es', 'zh', 'fr', 'pt', 'ja', 'ko', 'nl', 'sv', 'no', 'da', 'pl', 'uk'];
const APPS = 'js/apps';
const glossary = JSON.parse(await readFile('js/i18n/glossary.json', 'utf8'));

const quote = (text) => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (await readdir(APPS, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

const missing = [];
const dropped = [];
let written = 0;

for (const id of targets) {
  if (!existsSync(`${APPS}/${id}/index.js`)) continue;
  const sources = (await readdir(`${APPS}/${id}`))
    .filter((name) => name.endsWith('.js') && name !== 'i18n.js' && name !== 'meta.js')
    .sort();
  const code = (await Promise.all(sources.map((name) => readFile(`${APPS}/${id}/${name}`, 'utf8')))).join('\n');

  const keys = [...code.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
  if (!keys.length) continue;

  // where the fallback is a plain string we can look the translation up by it
  const english = new Map();
  for (const key of new Set(keys)) english.set(key, null);
  for (const [, key, source] of code.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'/g)) {
    english.set(key.replace(/\\'/g, "'"), source.replace(/\\'/g, "'"));
  }

  const existing = existsSync(`${APPS}/${id}/i18n.js`)
    ? (await import(`../${APPS}/${id}/i18n.js`)).default
    : {};

  const body = LANGS.map((lang) => {
    const lines = [];
    for (const [key, source] of english) {
      const value = existing[lang]?.[key] ?? (source ? glossary[source]?.[lang] : null);
      if (!value) {
        if (lang === LANGS[0]) missing.push(`${id}\t${key}\t${source}`);
        continue;
      }
      lines.push(`    ${quote(key)}: ${quote(value)},`);
    }
    return `  ${lang}: {\n${lines.join('\n')}\n  },`;
  }).join('\n');

  // A key held in the dictionary but never seen as a literal t('key') call is
  // about to be dropped. That is usually a key built from a template literal,
  // which is a mistake worth seeing rather than losing quietly.
  const keeping = new Set(english.keys());
  const losing = Object.keys(existing[LANGS[0]] ?? {}).filter((key) => !keeping.has(key));
  if (losing.length) dropped.push(`${id}: ${losing.join(', ')}`);

  await writeFile(`${APPS}/${id}/i18n.js`, `export default {\n${body}\n};\n`);
  written += 1;
}

console.log(`wrote ${written} app dictionaries`);
if (dropped.length) {
  console.log(`\n${dropped.length} app(s) had keys with no literal t() call, so they were dropped:`);
  dropped.forEach((line) => console.log('  ' + line));
}
if (missing.length) {
  console.log(`\n${missing.length} strings still need a translation (app / key / english):`);
  missing.slice(0, 40).forEach((line) => console.log('  ' + line.replace(/\t/g, '  ')));
}
