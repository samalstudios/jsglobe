import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
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

  // translations live one file per language; the single file they used to
  // share is still read once so nothing is lost on the way across
  const existing = {};
  if (existsSync(`${APPS}/${id}/i18n.js`)) {
    Object.assign(existing, (await import(`../${APPS}/${id}/i18n.js`)).default);
  }
  for (const lang of LANGS) {
    const at = `${APPS}/${id}/i18n/${lang}.js`;
    if (existsSync(at)) existing[lang] = (await import(`../${at}?v=${Date.now()}`)).default;
  }

  const packs = new Map();
  for (const lang of LANGS) {
    const lines = [];
    for (const [key, source] of english) {
      const value = existing[lang]?.[key] ?? (source ? glossary[source]?.[lang] : null);
      if (!value) {
        if (lang === LANGS[0]) missing.push(`${id}\t${key}\t${source}`);
        continue;
      }
      lines.push(`  ${quote(key)}: ${quote(value)},`);
    }
    if (lines.length) packs.set(lang, lines);
  }

  // A key held in the dictionary but never seen as a literal t('key') call is
  // about to be dropped. That is usually a key built from a template literal,
  // which is a mistake worth seeing rather than losing quietly.
  const keeping = new Set(english.keys());
  const losing = Object.keys(existing[LANGS[0]] ?? {}).filter((key) => !keeping.has(key));
  if (losing.length) dropped.push(`${id}: ${losing.join(', ')}`);

  await mkdir(`${APPS}/${id}/i18n`, { recursive: true });
  for (const lang of LANGS) {
    const at = `${APPS}/${id}/i18n/${lang}.js`;
    // a language with nothing translated yet still gets a file, so asking for
    // it is a small answer rather than a failed request
    const lines = packs.get(lang) ?? [];
    await writeFile(at, lines.length ? `export default {\n${lines.join('\n')}\n};\n` : 'export default {};\n');
  }
  if (existsSync(`${APPS}/${id}/i18n.js`)) await rm(`${APPS}/${id}/i18n.js`);
  written += 1;
}

console.log(`wrote dictionaries for ${written} apps, one file per language`);
if (dropped.length) {
  console.log(`\n${dropped.length} app(s) had keys with no literal t() call, so they were dropped:`);
  dropped.forEach((line) => console.log('  ' + line));
}
if (missing.length) {
  console.log(`\n${missing.length} strings still need a translation (app / key / english):`);
  missing.slice(0, 40).forEach((line) => console.log('  ' + line.replace(/\t/g, '  ')));
}
