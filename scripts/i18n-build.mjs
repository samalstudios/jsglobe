import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const LANGS = ['de', 'es', 'zh'];
const APPS = 'js/apps';
const glossary = JSON.parse(await readFile('js/i18n/glossary.json', 'utf8'));

const quote = (text) => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (await readdir(APPS, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

const missing = [];
let written = 0;

for (const id of targets) {
  const file = `${APPS}/${id}/index.js`;
  if (!existsSync(file)) continue;
  const code = await readFile(file, 'utf8');

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

  await writeFile(`${APPS}/${id}/i18n.js`, `export default {\n${body}\n};\n`);
  written += 1;
}

console.log(`wrote ${written} app dictionaries`);
if (missing.length) {
  console.log(`\n${missing.length} strings still need a translation (app / key / english):`);
  missing.slice(0, 40).forEach((line) => console.log('  ' + line.replace(/\t/g, '  ')));
}
