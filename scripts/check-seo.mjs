import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { catalog, categories } from '../js/apps/catalog.js';
import { LANGUAGES, DEFAULT_LANGUAGE } from '../js/core/languages.js';

const SITE = process.env.SITE_URL ?? 'https://jsglobe.com';
const apps = catalog.filter((app) => !app.system);
const groups = categories.filter((group) => apps.some((app) => app.category === group.id));

const problems = [];
const fail = (message) => problems.push(message);

const prefix = (lang) => {
  const entry = LANGUAGES.find((item) => item.code === lang);
  return entry?.path ? `/${entry.path}` : '';
};

const link = (lang, path = '') => `${SITE}${prefix(lang)}${path}`;
const dir = (lang, path = '') => {
  const root = prefix(lang).replace(/^\//, '');
  const tail = path.replace(/^\/+/, '');
  return [root, tail].filter(Boolean).join('/') || '.';
};

const localeOf = (lang) => LANGUAGES.find((entry) => entry.code === lang)?.locale ?? lang;

const directories = async (path) => {
  const entries = await readdir(path);
  const out = [];
  for (const entry of entries) {
    if ((await stat(`${path}/${entry}`)).isDirectory()) out.push(entry);
  }
  return out;
};

const page = async (lang, path, route, label) => {
  const file = `${dir(lang, path)}/index.html`.replace(/^\.\//, '');
  if (!existsSync(file)) {
    fail(`${label}: ${file} is missing`);
    return;
  }
  const markup = await readFile(file, 'utf8');
  const url = link(lang, route);
  const title = markup.match(/<title>([^<]*)<\/title>/)?.[1];
  const description = markup.match(/name="description" content="([^"]*)"/)?.[1];
  const canonical = markup.match(/rel="canonical" href="([^"]+)"/)?.[1];
  const htmlLang = markup.match(/<html lang="([^"]+)"/)?.[1];
  const schemas = markup.match(/application\/ld\+json/g) ?? [];
  const body = markup.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? '';
  const alternates = Object.fromEntries(
    [...markup.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );

  if (!title) fail(`${label}: no title`);
  if (!description) fail(`${label}: no meta description`);
  if (canonical !== url) fail(`${label}: canonical is ${canonical ?? 'missing'}, expected ${url}`);
  if (htmlLang !== localeOf(lang)) fail(`${label}: html lang is ${htmlLang ?? 'missing'}, expected ${localeOf(lang)}`);
  if (!schemas.length) fail(`${label}: no structured data`);
  if (!markup.includes(`${SITE}/assets/og.png`)) fail(`${label}: no og:image`);
  if (!markup.includes(`<meta property="og:locale" content="${localeOf(lang)}">`)) fail(`${label}: wrong og:locale`);
  if (!/<h1>/.test(body)) fail(`${label}: the noscript body has no h1`);
  if (body.replace(/<[^>]+>/g, '').trim().length < 200) fail(`${label}: the crawlable body is thin`);

  for (const entry of LANGUAGES) {
    const want = link(entry.code, route);
    if (alternates[entry.locale] !== want) {
      fail(`${label}: hreflang ${entry.locale} is ${alternates[entry.locale] ?? 'missing'}, expected ${want}`);
    }
  }
  if (alternates['x-default'] !== link(DEFAULT_LANGUAGE, route)) fail(`${label}: x-default alternate is wrong`);
};

const folders = await directories('apps');
const appFolders = folders.filter((entry) => entry !== 'category');

apps.forEach((app) => {
  if (!appFolders.includes(app.id)) fail(`no page for ${app.id}, run scripts/build-seo.mjs`);
});
appFolders.forEach((folder) => {
  if (!apps.some((app) => app.id === folder)) fail(`apps/${folder} has no catalog entry, delete it`);
});

const routes = [
  { path: '', route: '/', label: 'home' },
  { path: 'apps', route: '/apps', label: 'library' },
  { path: 'privacy', route: '/privacy', label: 'privacy' },
  ...groups.map((group) => ({
    path: `apps/category/${group.id}`,
    route: `/apps/category/${group.id}`,
    label: `category ${group.id}`,
  })),
  ...apps.map((app) => ({ path: `apps/${app.id}`, route: `/apps/${app.id}`, label: app.id })),
];

for (const entry of LANGUAGES) {
  for (const item of routes) {
    await page(entry.code, item.path, item.route, `${entry.code} ${item.label}`);
  }
}

const sitemap = await readFile('sitemap.xml', 'utf8');
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const expected = LANGUAGES.flatMap((entry) =>
  routes.map((item) => (item.route === '/' ? link(entry.code, '/') : link(entry.code, item.route))),
);
expected.forEach((url) => {
  if (!listed.includes(url)) fail(`sitemap is missing ${url}`);
});
listed.forEach((url) => {
  if (!expected.includes(url)) fail(`sitemap has a stale url: ${url}`);
});
if (!sitemap.includes('xmlns:xhtml=')) fail('sitemap has no xhtml namespace for alternates');
LANGUAGES.forEach((entry) => {
  if (!sitemap.includes(`hreflang="${entry.locale}"`)) fail(`sitemap has no ${entry.locale} alternates`);
});

for (const entry of LANGUAGES) {
  const file = entry.code === DEFAULT_LANGUAGE ? 'index.html' : `${entry.path}/index.html`;
  const home = await readFile(file, 'utf8');
  if (!home.includes(link(entry.code, `/apps/${apps[0].id}`))) fail(`${file} has no crawl list`);
  if (!home.includes('rel="canonical"')) fail(`${file} has no canonical`);
}

const robots = await readFile('robots.txt', 'utf8');
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail('robots.txt does not point at the sitemap');
if (!existsSync('assets/og.png')) fail('assets/og.png is missing');

if (problems.length) {
  console.error(`SEO check failed with ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  problems.slice(0, 40).forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(
  `SEO ok: ${apps.length} tools, ${groups.length} categories, ${LANGUAGES.length} languages, ${listed.length} sitemap urls`,
);
