import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { catalog, categories } from '../js/apps/catalog.js';

const SITE = process.env.SITE_URL ?? 'https://jsglobe.com';
const REPO = 'https://github.com/samalstudios/jsglobe';
const NAME = 'Toolbox';
const TAGLINE = 'Fast, private developer tools that run entirely in your browser';

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const apps = catalog.filter((app) => !app.system);

const MARK_OPEN = '<!-- seo:start -->';
const MARK_CLOSE = '<!-- seo:end -->';

const stripGenerated = (markup) =>
  markup
    .replace(new RegExp(`${MARK_OPEN}[\\s\\S]*?${MARK_CLOSE}\\n?`, 'g'), '')
    .replace(/<noscript>[\s\S]*?<\/noscript>/, '<noscript>NOSCRIPT</noscript>');

const template = stripGenerated(await readFile('index.html', 'utf8'));

const head = (meta) => `${MARK_OPEN}
<title>${escape(meta.title)}</title>
<meta name="description" content="${escape(meta.description)}">
<link rel="canonical" href="${meta.url}">
<meta property="og:title" content="${escape(meta.title)}">
<meta property="og:description" content="${escape(meta.description)}">
<meta property="og:url" content="${meta.url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:image" content="${SITE}/assets/icon.svg">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escape(meta.title)}">
<meta name="twitter:description" content="${escape(meta.description)}">
${meta.keywords ? `<meta name="keywords" content="${escape(meta.keywords)}">` : ''}
<script type="application/ld+json">${JSON.stringify(meta.schema)}</script>
${MARK_CLOSE}`.trim();

const page = (meta, body) => {
  let out = template;
  out = out.replace(/\s*<meta name="description"[^>]*>/, '');
  out = out.replace(/\s*<meta property="og:title"[^>]*>/, '');
  out = out.replace(/\s*<meta property="og:description"[^>]*>/, '');
  out = out.replace(/\s*<meta property="og:type"[^>]*>/, '');
  out = out.replace(/<title>[\s\S]*?<\/title>/, head(meta));
  out = out.replace('<noscript>NOSCRIPT</noscript>', body);
  return out;
};

const crawlList = (items) =>
  `<ul>${items.map((app) => `<li><a href="${SITE}/apps/${app.id}">${escape(app.name)}</a> - ${escape(app.tagline)}</li>`).join('')}</ul>`;

const appSchema = (app) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: app.name,
  description: app.tagline,
  url: `${SITE}/apps/${app.id}`,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any browser',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  keywords: (app.keywords ?? []).join(', '),
  publisher: { '@type': 'Organization', name: NAME, url: SITE },
});

const written = [];

for (const app of apps) {
  const meta = {
    title: `${app.name} - free online tool | ${NAME}`,
    description: `${app.tagline}. Runs entirely in your browser, nothing is uploaded. Free and no sign up.`,
    url: `${SITE}/apps/${app.id}`,
    keywords: (app.keywords ?? []).join(', '),
    schema: appSchema(app),
  };

  const related = apps.filter((item) => item.category === app.category && item.id !== app.id).slice(0, 8);
  const body = `<noscript>
  <main>
    <h1>${escape(app.name)}</h1>
    <p>${escape(app.tagline)}. This tool runs entirely in your browser: nothing you paste or upload leaves your device.</p>
    <p>${NAME} is a collection of ${apps.length} developer tools. ${escape(app.name)} lives at <code>${SITE}/apps/${app.id}</code>.</p>
    <h2>Related tools</h2>
    ${crawlList(related)}
    <p><a href="${SITE}/apps">Browse all ${apps.length} tools</a></p>
  </main>
</noscript>`;

  await mkdir(`apps/${app.id}`, { recursive: true });
  await writeFile(`apps/${app.id}/index.html`, page(meta, body));
  written.push(`apps/${app.id}/index.html`);
}

const libraryBody = `<noscript>
  <main>
    <h1>${NAME} app library</h1>
    <p>${escape(TAGLINE)}. Every tool has its own address and works offline once loaded.</p>
    ${categories
      .filter((group) => apps.some((app) => app.category === group.id))
      .map(
        (group) =>
          `<h2>${escape(group.name)}</h2>${crawlList(apps.filter((app) => app.category === group.id))}`,
      )
      .join('')}
  </main>
</noscript>`;

await mkdir('apps', { recursive: true });
await writeFile(
  'apps/index.html',
  page(
    {
      title: `All tools - ${NAME}`,
      description: `Browse all ${apps.length} developer tools in ${NAME}. Formatters, converters, generators, crypto and local AI, all running in the browser.`,
      url: `${SITE}/apps`,
      keywords: 'developer tools, online tools, free tools, browser tools',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${NAME} app library`,
        url: `${SITE}/apps`,
        hasPart: apps.map(appSchema),
      },
    },
    libraryBody,
  ),
);
written.push('apps/index.html');

const privacyBody = `<noscript>
  <main>
    <h1>Privacy policy</h1>
    <p>${NAME} is a static site. Every tool runs in your browser and the text, files and images you use are never uploaded.</p>
    <h2>Cookies</h2>
    <p>Google Analytics 4 is loaded only after you accept the cookie banner, with IP anonymisation and no advertising or personalisation storage. Declining sets no analytics cookies. You can change the choice at any time on this page or in Settings.</p>
    <h2>Local data</h2>
    <p>Notes, tasks, settings and app state are kept in this browser's local storage and IndexedDB, and can be erased from Settings under Data. There are no accounts and no email collection.</p>
    <h2>Third parties</h2>
    <p>Some tools call a public service only when you ask them to, such as DNS resolvers for lookups, Cloudflare for the speed test, CoinGecko and an open exchange rate dataset for portfolio prices, and public CDNs for AI models and media codecs.</p>
    <h2>Source</h2>
    <p>The site is open source at <a href="${REPO}">${REPO}</a>.</p>
    <p><a href="${SITE}/apps">Browse all ${apps.length} tools</a></p>
  </main>
</noscript>`;

await mkdir('privacy', { recursive: true });
await writeFile(
  'privacy/index.html',
  page(
    {
      title: `Privacy policy - ${NAME}`,
      description: `How ${NAME} handles data: tools run in your browser, analytics load only after you accept cookies, and nothing you paste is uploaded.`,
      url: `${SITE}/privacy`,
      keywords: 'privacy policy, cookies, analytics, gdpr',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `Privacy policy - ${NAME}`,
        url: `${SITE}/privacy`,
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
      },
    },
    privacyBody,
  ),
);
written.push('privacy/index.html');

const home = template
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${NAME} - ${TAGLINE}</title>`)
  .replace(
    '<noscript>NOSCRIPT</noscript>',
    `<noscript>
  <main>
    <h1>${NAME}</h1>
    <p>${escape(TAGLINE)}. ${apps.length} tools, no sign up, no uploads.</p>
    ${crawlList(apps)}
  </main>
</noscript>`,
  );

const homeHead = `${MARK_OPEN}
<link rel="canonical" href="${SITE}/">
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: NAME,
  url: SITE,
  description: TAGLINE,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
})}</script>
${MARK_CLOSE}
</head>`;

await writeFile('index.html', home.replace('</head>', homeHead));
written.push('index.html');

const urls = [
  { loc: `${SITE}/`, priority: '1.0', freq: 'weekly' },
  { loc: `${SITE}/apps`, priority: '0.9', freq: 'weekly' },
  { loc: `${SITE}/privacy`, priority: '0.3', freq: 'yearly' },
  ...apps.map((app) => ({ loc: `${SITE}/apps/${app.id}`, priority: '0.8', freq: 'monthly' })),
];

const today = new Date().toISOString().slice(0, 10);
await writeFile(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) =>
      `  <url><loc>${url.loc}</loc><lastmod>${today}</lastmod><changefreq>${url.freq}</changefreq><priority>${url.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`,
);
written.push('sitemap.xml');

await writeFile(
  'robots.txt',
  `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`,
);
written.push('robots.txt');

console.log(`generated ${written.length} files for ${apps.length} tools`);
console.log(`sitemap: ${urls.length} urls`);
