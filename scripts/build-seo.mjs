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
<meta property="og:image" content="${SITE}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(meta.title)}">
<meta name="twitter:description" content="${escape(meta.description)}">
<meta name="twitter:image" content="${SITE}/assets/og.png">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
${meta.keywords ? `<meta name="keywords" content="${escape(meta.keywords)}">` : ''}
${[]
  .concat(meta.schema)
  .map((entry) => `<script type="application/ld+json">${JSON.stringify(entry)}</script>`)
  .join('\n')}
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

const crumbs = (trail) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: trail.map((step, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: step.name,
    item: step.url,
  })),
});

const faqFor = (app) => [
  {
    q: `Is ${app.name} free?`,
    a: `Yes. ${app.name} is free to use, with no account, no sign up and no usage limits.`,
  },
  {
    q: `Does ${app.name} upload my data?`,
    a: `No. It runs entirely in your browser, so the text, files and images you give it never leave your device.`,
  },
  {
    q: `Does ${app.name} work offline?`,
    a: `Yes. Once the page has loaded, the tool keeps working without a connection.`,
  },
  {
    q: `Where can I find the source?`,
    a: `${NAME} is open source at ${REPO}.`,
  },
];

const faqSchema = (app) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqFor(app).map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
});

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
  const group = categories.find((entry) => entry.id === app.category);
  const meta = {
    title: `${app.name} - free online tool | ${NAME}`,
    description: `${app.tagline}. Runs entirely in your browser, nothing is uploaded. Free and no sign up.`,
    url: `${SITE}/apps/${app.id}`,
    keywords: (app.keywords ?? []).join(', '),
    schema: [
      appSchema(app),
      faqSchema(app),
      crumbs([
        { name: NAME, url: `${SITE}/` },
        { name: 'All tools', url: `${SITE}/apps` },
        { name: group?.name ?? 'Tools', url: `${SITE}/apps/category/${app.category}` },
        { name: app.name, url: `${SITE}/apps/${app.id}` },
      ]),
    ],
  };

  const related = apps.filter((item) => item.category === app.category && item.id !== app.id).slice(0, 8);
  const body = `<noscript>
  <main>
    <nav aria-label="Breadcrumb"><a href="${SITE}/">${NAME}</a> / <a href="${SITE}/apps">All tools</a> / <a href="${SITE}/apps/category/${app.category}">${escape(group?.name ?? 'Tools')}</a></nav>
    <h1>${escape(app.name)}</h1>
    <p>${escape(app.tagline)}. This tool runs entirely in your browser: nothing you paste or upload leaves your device.</p>
    <h2>What ${escape(app.name)} does</h2>
    <p>${escape(app.name)} sits in the ${escape(group?.name ?? 'tools')} section of ${NAME}, alongside ${related.length} related tools. It opens instantly at <code>${SITE}/apps/${app.id}</code>, keeps working offline once the page has loaded, and stores anything you save in this browser rather than on a server.</p>
    ${app.keywords?.length ? `<p>Also useful for: ${app.keywords.map((word) => escape(word)).join(', ')}.</p>` : ''}
    <h2>How it works</h2>
    <ul>
      <li>Open the page and start using it. There is no account, no sign up and no paywall.</li>
      <li>Everything runs as JavaScript in your own browser, so your input never reaches a server.</li>
      <li>Settings and saved work live in this browser and can be cleared at any time.</li>
      <li>The whole site is open source at <a href="${REPO}">${REPO}</a>.</li>
    </ul>
    <h2>Questions</h2>
    <dl>
      ${faqFor(app).map((item) => `<dt>${escape(item.q)}</dt><dd>${escape(item.a)}</dd>`).join('')}
    </dl>
    <h2>Related tools</h2>
    ${crawlList(related)}
    <p><a href="${SITE}/apps">Browse all ${apps.length} tools</a></p>
  </main>
</noscript>`;

  await mkdir(`apps/${app.id}`, { recursive: true });
  await writeFile(`apps/${app.id}/index.html`, page(meta, body));
  written.push(`apps/${app.id}/index.html`);
}

const groups = categories.filter((group) => apps.some((app) => app.category === group.id));

for (const group of groups) {
  const members = apps.filter((app) => app.category === group.id);
  const body = `<noscript>
  <main>
    <nav aria-label="Breadcrumb"><a href="${SITE}/">${NAME}</a> / <a href="${SITE}/apps">All tools</a></nav>
    <h1>${escape(group.name)} tools</h1>
    <p>${members.length} ${escape(group.name.toLowerCase())} tools that run in your browser, free and without an account. Nothing you paste or open is uploaded.</p>
    ${crawlList(members)}
    <h2>Other sections</h2>
    <ul>${groups
      .filter((entry) => entry.id !== group.id)
      .map((entry) => `<li><a href="${SITE}/apps/category/${entry.id}">${escape(entry.name)}</a></li>`)
      .join('')}</ul>
    <p><a href="${SITE}/apps">Browse all ${apps.length} tools</a></p>
  </main>
</noscript>`;

  await mkdir(`apps/category/${group.id}`, { recursive: true });
  await writeFile(
    `apps/category/${group.id}/index.html`,
    page(
      {
        title: `${group.name} tools - ${NAME}`,
        description: `${members.length} free ${group.name.toLowerCase()} tools that run entirely in your browser. No sign up, no uploads.`,
        url: `${SITE}/apps/category/${group.id}`,
        keywords: members.flatMap((app) => app.keywords ?? []).slice(0, 24).join(', '),
        schema: [
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${group.name} tools`,
            url: `${SITE}/apps/category/${group.id}`,
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: members.length,
              itemListElement: members.map((app, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: app.name,
                url: `${SITE}/apps/${app.id}`,
              })),
            },
          },
          crumbs([
            { name: NAME, url: `${SITE}/` },
            { name: 'All tools', url: `${SITE}/apps` },
            { name: group.name, url: `${SITE}/apps/category/${group.id}` },
          ]),
        ],
      },
      body,
    ),
  );
  written.push(`apps/category/${group.id}/index.html`);
}

const libraryBody = `<noscript>
  <main>
    <h1>${NAME} app library</h1>
    <p>${escape(TAGLINE)}. Every tool has its own address and works offline once loaded.</p>
    ${categories
      .filter((group) => apps.some((app) => app.category === group.id))
      .map(
        (group) =>
          `<h2><a href="${SITE}/apps/category/${group.id}">${escape(group.name)}</a></h2>${crawlList(
            apps.filter((app) => app.category === group.id),
          )}`,
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
      schema: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${NAME} app library`,
          url: `${SITE}/apps`,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: apps.length,
            itemListElement: apps.map((app, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: app.name,
              url: `${SITE}/apps/${app.id}`,
            })),
          },
        },
        crumbs([
          { name: NAME, url: `${SITE}/` },
          { name: 'All tools', url: `${SITE}/apps` },
        ]),
      ],
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
  ...groups.map((group) => ({ loc: `${SITE}/apps/category/${group.id}`, priority: '0.7', freq: 'weekly' })),
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
