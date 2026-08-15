import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { catalog, categories } from '../js/apps/catalog.js';

const SITE = process.env.SITE_URL ?? 'https://jsglobe.com';
const apps = catalog.filter((app) => !app.system);
const groups = categories.filter((group) => apps.some((app) => app.category === group.id));

const problems = [];
const fail = (message) => problems.push(message);

const directories = async (path) => {
  const entries = await readdir(path);
  const out = [];
  for (const entry of entries) {
    if ((await stat(`${path}/${entry}`)).isDirectory()) out.push(entry);
  }
  return out;
};

const page = async (path, url, label) => {
  if (!existsSync(path)) {
    fail(`${label}: ${path} is missing`);
    return;
  }
  const markup = await readFile(path, 'utf8');
  const title = markup.match(/<title>([^<]*)<\/title>/)?.[1];
  const description = markup.match(/name="description" content="([^"]*)"/)?.[1];
  const canonical = markup.match(/rel="canonical" href="([^"]+)"/)?.[1];
  const schemas = markup.match(/application\/ld\+json/g) ?? [];
  const body = markup.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? '';

  if (!title) fail(`${label}: no title`);
  if (!description) fail(`${label}: no meta description`);
  if (canonical !== url) fail(`${label}: canonical is ${canonical ?? 'missing'}, expected ${url}`);
  if (!schemas.length) fail(`${label}: no structured data`);
  if (!markup.includes(`${SITE}/assets/og.png`)) fail(`${label}: no og:image`);
  if (!/<h1>/.test(body)) fail(`${label}: the noscript body has no h1`);
  if (body.replace(/<[^>]+>/g, '').trim().length < 200) fail(`${label}: the crawlable body is thin`);
};

const folders = await directories('apps');
const appFolders = folders.filter((entry) => entry !== 'category');

apps.forEach((app) => {
  if (!appFolders.includes(app.id)) fail(`no page for ${app.id}, run scripts/build-seo.mjs`);
});
appFolders.forEach((folder) => {
  if (!apps.some((app) => app.id === folder)) fail(`apps/${folder} has no catalog entry, delete it`);
});

for (const app of apps) {
  await page(`apps/${app.id}/index.html`, `${SITE}/apps/${app.id}`, app.id);
}
for (const group of groups) {
  await page(`apps/category/${group.id}/index.html`, `${SITE}/apps/category/${group.id}`, `category ${group.id}`);
}
await page('apps/index.html', `${SITE}/apps`, 'library');
await page('privacy/index.html', `${SITE}/privacy`, 'privacy');

const sitemap = await readFile('sitemap.xml', 'utf8');
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const expected = [
  `${SITE}/`,
  `${SITE}/apps`,
  `${SITE}/privacy`,
  ...groups.map((group) => `${SITE}/apps/category/${group.id}`),
  ...apps.map((app) => `${SITE}/apps/${app.id}`),
];
expected.forEach((url) => {
  if (!listed.includes(url)) fail(`sitemap is missing ${url}`);
});
listed.forEach((url) => {
  if (!expected.includes(url)) fail(`sitemap has a stale url: ${url}`);
});

const home = await readFile('index.html', 'utf8');
if (!home.includes(`${SITE}/apps/${apps[0].id}`)) fail('index.html has no crawl list');
if (!home.includes('rel="canonical"')) fail('index.html has no canonical');

const robots = await readFile('robots.txt', 'utf8');
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail('robots.txt does not point at the sitemap');
if (!existsSync('assets/og.png')) fail('assets/og.png is missing');

if (problems.length) {
  console.error(`SEO check failed with ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(`SEO ok: ${apps.length} tools, ${groups.length} categories, ${listed.length} sitemap urls`);
