import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('js/i18n/strings.json', 'utf8'));
const table = JSON.parse(await readFile('js/i18n/translations.json', 'utf8'));

const LANGS = ['de', 'es', 'zh'];
const header = {
  de: 'German',
  es: 'Spanish',
  zh: 'Chinese',
};

const quote = (text) => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

for (const lang of LANGS) {
  const lines = [];
  let translated = 0;
  for (const [key, english] of Object.entries(manifest)) {
    const value = table[english]?.[lang];
    if (!value) continue;
    lines.push(`  ${quote(key)}: ${quote(value)},`);
    translated += 1;
  }
  const body = `export default {\n${lines.join('\n')}\n};\n`;
  await writeFile(`js/i18n/${lang}-apps.generated.js`, body);
  console.log(`${lang}: ${translated}/${Object.keys(manifest).length} app keys (${header[lang]})`);
}

const missing = [...new Set(Object.values(manifest))].filter(
  (english) => !LANGS.every((lang) => table[english]?.[lang]),
);
console.log(`untranslated unique strings: ${missing.length} of ${new Set(Object.values(manifest)).size}`);
await writeFile('js/i18n/untranslated.json', `${JSON.stringify(missing, null, 2)}\n`);
