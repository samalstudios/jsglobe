import { readdir, readFile } from 'node:fs/promises';

const problems = [];
const fail = (message) => problems.push(message);

// a worker entry point is loaded by URL, not imported, so it is not a domain
const WORKERS = new Set(['chess-worker.js']);

const libFiles = (await readdir('js/lib')).filter((name) => name.endsWith('.js') && !WORKERS.has(name));

// 1. the library layer must not reach upwards
for (const name of libFiles) {
  const source = await readFile(`js/lib/${name}`, 'utf8');
  for (const match of source.matchAll(/from '([^']+)'/g)) {
    const target = match[1];
    if (target.includes('../apps/')) fail(`js/lib/${name} imports an app: ${target}`);
    if (target.includes('../ui/')) fail(`js/lib/${name} imports the interface layer: ${target}`);
  }
}

// 2. every library is published, and every published domain is described
const platform = await readFile('js/platform.js', 'utf8');
const published = new Map(
  [...platform.matchAll(/export \* as (\w+) from '\.\/lib\/([\w-]+\.js)'/g)].map((match) => [match[2], match[1]]),
);

for (const name of libFiles) {
  if (!published.has(name)) fail(`js/lib/${name} is not exported from js/platform.js`);
}
for (const name of published.keys()) {
  if (!libFiles.includes(name)) fail(`js/platform.js exports js/lib/${name}, which does not exist`);
}

const described = new Set([...platform.matchAll(/^  (\w+): '/gm)].map((match) => match[1]));
for (const domain of published.values()) {
  if (!described.has(domain)) fail(`platform domain "${domain}" has no line in SURFACE`);
}
for (const domain of described) {
  if (![...published.values()].includes(domain)) fail(`SURFACE describes "${domain}", which is not exported`);
}

// 3. an app may not import another app
const appDirs = (await readdir('js/apps', { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const app of appDirs) {
  let source;
  try {
    source = await readFile(`js/apps/${app}/index.js`, 'utf8');
  } catch {
    continue;
  }
  for (const match of source.matchAll(/from '\.\.\/([\w-]+)\/index\.js'/g)) {
    fail(`js/apps/${app} imports another app: ${match[1]}`);
  }
}

if (problems.length) {
  console.error(`platform check failed with ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(
  `platform ok: ${libFiles.length} libraries, all published and described, no library reaching into apps or the interface`,
);
