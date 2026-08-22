import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const APPS = 'js/apps';

const folders = (await readdir(APPS, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && existsSync(`${APPS}/${entry.name}/meta.js`))
  .map((entry) => entry.name)
  .sort();

const metas = [];
for (const id of folders) {
  const meta = (await import(`../${APPS}/${id}/meta.js`)).default;
  if (meta.id !== id) throw new Error(`${id}/meta.js declares id "${meta.id}"`);
  metas.push(meta);
}

const order = JSON.parse(await readFile(`${APPS}/order.json`, 'utf8'));
const rank = new Map(order.map((id, index) => [id, index]));
metas.sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));

const imports = metas.map((meta) => `import ${meta.id.replace(/-/g, '_')} from './${meta.id}/meta.js';`).join('\n');
const list = metas.map((meta) => `  ${meta.id.replace(/-/g, '_')},`).join('\n');

await writeFile(
  `${APPS}/catalog.js`,
  `${imports}
import { categories } from './categories.js';

export { categories };

export const catalog = [
${list}
];
`,
);

console.log(`catalog: ${metas.length} apps from ${APPS}/*/meta.js`);
