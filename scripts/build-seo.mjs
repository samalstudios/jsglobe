import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { catalog, categories } from '../js/apps/catalog.js';
import { LANGUAGES, DEFAULT_LANGUAGE } from '../js/core/languages.js';

const SITE = process.env.SITE_URL ?? 'https://jsglobe.com';
const REPO = 'https://github.com/samalstudios/jsglobe';
const NAME = 'Toolbox';
const TAGLINE = 'Fast, private developer tools that run entirely in your browser';

const packs = { en: null };
for (const entry of LANGUAGES) {
  if (entry.code === DEFAULT_LANGUAGE) continue;
  packs[entry.code] = (await import(`../js/i18n/${entry.code}.js`)).default;
}

const fill = (text, vars) =>
  vars ? String(text).replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match)) : text;

const T = (lang, key, english, vars) => fill(packs[lang]?.seo?.[key] ?? english, vars);

const appName = (lang, app) => packs[lang]?.apps?.[app.id]?.name ?? app.name;
const appTagline = (lang, app) => packs[lang]?.apps?.[app.id]?.tagline ?? app.tagline;
const groupName = (lang, group) => (group ? packs[lang]?.categories?.[group.id] ?? group.name : null);

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

const alternates = (path) =>
  [
    ...LANGUAGES.map(
      (entry) => `<link rel="alternate" hreflang="${entry.locale}" href="${link(entry.code, path)}">`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${link(DEFAULT_LANGUAGE, path)}">`,
  ].join('\n');

const localeOf = (lang) => LANGUAGES.find((entry) => entry.code === lang)?.locale ?? lang;

const head = (meta) => `${MARK_OPEN}
<meta name="description" content="${escape(meta.description)}">
<link rel="canonical" href="${meta.url}">
${alternates(meta.path)}
<meta property="og:title" content="${escape(meta.title)}">
<meta property="og:description" content="${escape(meta.description)}">
<meta property="og:url" content="${meta.url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${localeOf(meta.lang)}">
${LANGUAGES.filter((entry) => entry.code !== meta.lang)
  .map((entry) => `<meta property="og:locale:alternate" content="${entry.locale}">`)
  .join('\n')}
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
  out = out.replace(/<html lang="[^"]*"/, `<html lang="${localeOf(meta.lang)}"`);
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(meta.title)}</title>`);
  out = out.replace('</head>', `${head(meta)}\n</head>`);
  out = out.replace('<noscript>NOSCRIPT</noscript>', body);
  return out;
};

const crawlList = (lang, items) =>
  `<ul>${items
    .map(
      (app) =>
        `<li><a href="${link(lang, `/apps/${app.id}`)}">${escape(appName(lang, app))}</a> - ${escape(
          appTagline(lang, app),
        )}</li>`,
    )
    .join('')}</ul>`;

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

const faqFor = (lang, app) => {
  const name = appName(lang, app);
  return [
    {
      q: T(lang, 'faq.free.q', `Is ${name} free?`, { name }),
      a: T(lang, 'faq.free.a', `Yes. ${name} is free to use, with no account, no sign up and no usage limits.`, { name }),
    },
    {
      q: T(lang, 'faq.upload.q', `Does ${name} upload my data?`, { name }),
      a: T(
        lang,
        'faq.upload.a',
        'No. It runs entirely in your browser, so the text, files and images you give it never leave your device.',
        { name },
      ),
    },
    {
      q: T(lang, 'faq.offline.q', `Does ${name} work offline?`, { name }),
      a: T(lang, 'faq.offline.a', 'Yes. Once the page has loaded, the tool keeps working without a connection.', { name }),
    },
    {
      q: T(lang, 'faq.source.q', 'Where can I find the source?', {}),
      a: T(lang, 'faq.source.a', `${NAME} is open source at ${REPO}.`, { brand: NAME, repo: REPO }),
    },
  ];
};

const faqSchema = (lang, app) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  inLanguage: localeOf(lang),
  mainEntity: faqFor(lang, app).map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
});

const appSchema = (lang, app) => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: appName(lang, app),
  description: appTagline(lang, app),
  url: link(lang, `/apps/${app.id}`),
  inLanguage: localeOf(lang),
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any browser',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  keywords: (app.keywords ?? []).join(', '),
  publisher: { '@type': 'Organization', name: NAME, url: SITE },
});

const written = [];
const routes = [];

const groups = categories.filter((group) => apps.some((app) => app.category === group.id));

for (const entry of LANGUAGES) {
  const lang = entry.code;
  const allTools = T(lang, 'nav.allTools', 'All tools');
  const browseAll = T(lang, 'nav.browseAll', `Browse all ${apps.length} tools`, { count: apps.length });
  const tagline = T(lang, 'site.tagline', TAGLINE);

  for (const app of apps) {
    const group = categories.find((item) => item.id === app.category);
    const name = appName(lang, app);
    const line = appTagline(lang, app);
    const section = groupName(lang, group) ?? T(lang, 'nav.tools', 'Tools');
    const path = `/apps/${app.id}`;
    const related = apps.filter((item) => item.category === app.category && item.id !== app.id).slice(0, 8);
    const vars = { name, tagline: line, group: section, brand: NAME, repo: REPO, count: related.length, url: link(lang, path) };

    const meta = {
      lang,
      path,
      title: T(lang, 'app.title', `${name} - free online tool | ${NAME}`, vars),
      description: T(
        lang,
        'app.description',
        `${line}. Runs entirely in your browser, nothing is uploaded. Free and no sign up.`,
        vars,
      ),
      url: link(lang, path),
      keywords: (app.keywords ?? []).join(', '),
      schema: [
        appSchema(lang, app),
        faqSchema(lang, app),
        crumbs([
          { name: NAME, url: link(lang, '/') },
          { name: allTools, url: link(lang, '/apps') },
          { name: section, url: link(lang, `/apps/category/${app.category}`) },
          { name, url: link(lang, path) },
        ]),
      ],
    };

    const body = `<noscript>
  <main>
    <nav aria-label="Breadcrumb"><a href="${link(lang, '/')}">${NAME}</a> / <a href="${link(lang, '/apps')}">${escape(allTools)}</a> / <a href="${link(lang, `/apps/category/${app.category}`)}">${escape(section)}</a></nav>
    <h1>${escape(name)}</h1>
    <p>${escape(T(lang, 'app.intro', `${line}. This tool runs entirely in your browser: nothing you paste or upload leaves your device.`, vars))}</p>
    <h2>${escape(T(lang, 'app.whatHeading', `What ${name} does`, vars))}</h2>
    <p>${escape(T(lang, 'app.whatBody', `${name} sits in the ${section} section of ${NAME}, alongside ${related.length} related tools. It opens instantly at ${link(lang, path)}, keeps working offline once the page has loaded, and stores anything you save in this browser rather than on a server.`, vars))}</p>
    ${app.keywords?.length ? `<p>${escape(T(lang, 'app.alsoUseful', `Also useful for: ${app.keywords.join(', ')}.`, { words: app.keywords.join(', ') }))}</p>` : ''}
    <h2>${escape(T(lang, 'app.howHeading', 'How it works'))}</h2>
    <ul>
      <li>${escape(T(lang, 'app.how1', 'Open the page and start using it. There is no account, no sign up and no paywall.'))}</li>
      <li>${escape(T(lang, 'app.how2', 'Everything runs as JavaScript in your own browser, so your input never reaches a server.'))}</li>
      <li>${escape(T(lang, 'app.how3', 'Settings and saved work live in this browser and can be cleared at any time.'))}</li>
      <li>${escape(T(lang, 'app.how4', `The whole site is open source at ${REPO}.`, { repo: REPO })).replace(escape(REPO), `<a href="${REPO}">${REPO}</a>`)}</li>
    </ul>
    <h2>${escape(T(lang, 'app.questions', 'Questions'))}</h2>
    <dl>
      ${faqFor(lang, app).map((item) => `<dt>${escape(item.q)}</dt><dd>${escape(item.a)}</dd>`).join('')}
    </dl>
    <h2>${escape(T(lang, 'app.related', 'Related tools'))}</h2>
    ${crawlList(lang, related)}
    <p><a href="${link(lang, '/apps')}">${escape(browseAll)}</a></p>
  </main>
</noscript>`;

    await mkdir(dir(lang, `apps/${app.id}`), { recursive: true });
    await writeFile(`${dir(lang, `apps/${app.id}`)}/index.html`, page(meta, body));
    written.push(`${dir(lang, `apps/${app.id}`)}/index.html`);
    if (lang === DEFAULT_LANGUAGE) routes.push({ path, priority: '0.8', freq: 'monthly' });
  }

  for (const group of groups) {
    const members = apps.filter((app) => app.category === group.id);
    const section = groupName(lang, group);
    const path = `/apps/category/${group.id}`;
    const vars = { name: section, count: members.length, brand: NAME };

    const body = `<noscript>
  <main>
    <nav aria-label="Breadcrumb"><a href="${link(lang, '/')}">${NAME}</a> / <a href="${link(lang, '/apps')}">${escape(allTools)}</a></nav>
    <h1>${escape(T(lang, 'category.h1', `${section} tools`, vars))}</h1>
    <p>${escape(T(lang, 'category.body', `${members.length} ${section.toLowerCase()} tools that run in your browser, free and without an account. Nothing you paste or open is uploaded.`, vars))}</p>
    ${crawlList(lang, members)}
    <h2>${escape(T(lang, 'category.other', 'Other sections'))}</h2>
    <ul>${groups
      .filter((item) => item.id !== group.id)
      .map((item) => `<li><a href="${link(lang, `/apps/category/${item.id}`)}">${escape(groupName(lang, item))}</a></li>`)
      .join('')}</ul>
    <p><a href="${link(lang, '/apps')}">${escape(browseAll)}</a></p>
  </main>
</noscript>`;

    await mkdir(dir(lang, path.replace(/^\//, '')), { recursive: true });
    await writeFile(
      `${dir(lang, path.replace(/^\//, ''))}/index.html`,
      page(
        {
          lang,
          path,
          title: T(lang, 'category.title', `${section} tools - ${NAME}`, vars),
          description: T(
            lang,
            'category.description',
            `${members.length} free ${section.toLowerCase()} tools that run entirely in your browser. No sign up, no uploads.`,
            vars,
          ),
          url: link(lang, path),
          keywords: members.flatMap((app) => app.keywords ?? []).slice(0, 24).join(', '),
          schema: [
            {
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: T(lang, 'category.collection', `${section} tools`, vars),
              url: link(lang, path),
              inLanguage: localeOf(lang),
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: members.length,
                itemListElement: members.map((app, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: appName(lang, app),
                  url: link(lang, `/apps/${app.id}`),
                })),
              },
            },
            crumbs([
              { name: NAME, url: link(lang, '/') },
              { name: allTools, url: link(lang, '/apps') },
              { name: section, url: link(lang, path) },
            ]),
          ],
        },
        body,
      ),
    );
    written.push(`${dir(lang, path.replace(/^\//, ''))}/index.html`);
    if (lang === DEFAULT_LANGUAGE) routes.push({ path, priority: '0.7', freq: 'weekly' });
  }

  const libraryVars = { count: apps.length, brand: NAME, tagline };
  const libraryBody = `<noscript>
  <main>
    <h1>${escape(T(lang, 'library.h1', `${NAME} app library`, libraryVars))}</h1>
    <p>${escape(T(lang, 'library.body', `${tagline}. Every tool has its own address and works offline once loaded.`, libraryVars))}</p>
    ${groups
      .map(
        (group) =>
          `<h2><a href="${link(lang, `/apps/category/${group.id}`)}">${escape(groupName(lang, group))}</a></h2>${crawlList(
            lang,
            apps.filter((app) => app.category === group.id),
          )}`,
      )
      .join('')}
  </main>
</noscript>`;

  await mkdir(dir(lang, 'apps'), { recursive: true });
  await writeFile(
    `${dir(lang, 'apps')}/index.html`,
    page(
      {
        lang,
        path: '/apps',
        title: T(lang, 'library.title', `All tools - ${NAME}`, libraryVars),
        description: T(
          lang,
          'library.description',
          `Browse all ${apps.length} developer tools in ${NAME}. Formatters, converters, generators, crypto and local AI, all running in the browser.`,
          libraryVars,
        ),
        url: link(lang, '/apps'),
        keywords: T(lang, 'library.keywords', 'developer tools, online tools, free tools, browser tools'),
        schema: [
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: T(lang, 'library.h1', `${NAME} app library`, libraryVars),
            url: link(lang, '/apps'),
            inLanguage: localeOf(lang),
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: apps.length,
              itemListElement: apps.map((app, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: appName(lang, app),
                url: link(lang, `/apps/${app.id}`),
              })),
            },
          },
          crumbs([
            { name: NAME, url: link(lang, '/') },
            { name: allTools, url: link(lang, '/apps') },
          ]),
        ],
      },
      libraryBody,
    ),
  );
  written.push(`${dir(lang, 'apps')}/index.html`);
  if (lang === DEFAULT_LANGUAGE) routes.push({ path: '/apps', priority: '0.9', freq: 'weekly' });

  const privacyVars = { brand: NAME, repo: REPO, count: apps.length };
  const privacyBody = `<noscript>
  <main>
    <h1>${escape(T(lang, 'privacy.h1', 'Privacy policy'))}</h1>
    <p>${escape(T(lang, 'privacy.intro', `${NAME} is a static site. Every tool runs in your browser and the text, files and images you use are never uploaded.`, privacyVars))}</p>
    <h2>${escape(T(lang, 'privacy.cookies.h', 'Cookies'))}</h2>
    <p>${escape(T(lang, 'privacy.cookies.p', 'Google Analytics 4 is loaded only after you accept the cookie banner, with IP anonymisation and no advertising or personalisation storage. Declining sets no analytics cookies. You can change the choice at any time on this page or in Settings.'))}</p>
    <h2>${escape(T(lang, 'privacy.local.h', 'Local data'))}</h2>
    <p>${escape(T(lang, 'privacy.local.p', "Notes, tasks, settings and app state are kept in this browser's local storage and IndexedDB, and can be erased from Settings under Data. There are no accounts and no email collection."))}</p>
    <h2>${escape(T(lang, 'privacy.third.h', 'Third parties'))}</h2>
    <p>${escape(T(lang, 'privacy.third.p', 'Some tools call a public service only when you ask them to, such as DNS resolvers for lookups, Cloudflare for the speed test, CoinGecko and an open exchange rate dataset for portfolio prices, and public CDNs for AI models and media codecs.'))}</p>
    <h2>${escape(T(lang, 'privacy.source.h', 'Source'))}</h2>
    <p>${escape(T(lang, 'privacy.source.p', `The site is open source at ${REPO}.`, privacyVars)).replace(escape(REPO), `<a href="${REPO}">${REPO}</a>`)}</p>
    <p><a href="${link(lang, '/apps')}">${escape(browseAll)}</a></p>
  </main>
</noscript>`;

  await mkdir(dir(lang, 'privacy'), { recursive: true });
  await writeFile(
    `${dir(lang, 'privacy')}/index.html`,
    page(
      {
        lang,
        path: '/privacy',
        title: T(lang, 'privacy.title', `Privacy policy - ${NAME}`, privacyVars),
        description: T(
          lang,
          'privacy.description',
          `How ${NAME} handles data: tools run in your browser, analytics load only after you accept cookies, and nothing you paste is uploaded.`,
          privacyVars,
        ),
        url: link(lang, '/privacy'),
        keywords: T(lang, 'privacy.keywords', 'privacy policy, cookies, analytics, gdpr'),
        schema: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: T(lang, 'privacy.title', `Privacy policy - ${NAME}`, privacyVars),
          url: link(lang, '/privacy'),
          inLanguage: localeOf(lang),
          publisher: { '@type': 'Organization', name: NAME, url: SITE },
        },
      },
      privacyBody,
    ),
  );
  written.push(`${dir(lang, 'privacy')}/index.html`);
  if (lang === DEFAULT_LANGUAGE) routes.push({ path: '/privacy', priority: '0.3', freq: 'yearly' });

  const homeBody = `<noscript>
  <main>
    <h1>${NAME}</h1>
    <p>${escape(T(lang, 'home.description', `${tagline}. ${apps.length} tools, no sign up, no uploads.`, { tagline, count: apps.length }))}</p>
    ${crawlList(lang, apps)}
  </main>
</noscript>`;

  const homeMeta = {
    lang,
    path: '/',
    title: `${NAME} - ${tagline}`,
    description: T(lang, 'home.description', `${tagline}. ${apps.length} tools, no sign up, no uploads.`, {
      tagline,
      count: apps.length,
    }),
    url: link(lang, '/'),
    keywords: T(lang, 'library.keywords', 'developer tools, online tools, free tools, browser tools'),
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: NAME,
      url: link(lang, '/'),
      description: tagline,
      inLanguage: localeOf(lang),
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${link(lang, '/search')}?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
  };

  if (lang === DEFAULT_LANGUAGE) {
    await writeFile('index.html', page(homeMeta, homeBody));
    written.push('index.html');
    routes.push({ path: '/', priority: '1.0', freq: 'weekly' });
  } else {
    await mkdir(dir(lang), { recursive: true });
    await writeFile(`${dir(lang)}/index.html`, page(homeMeta, homeBody));
    written.push(`${dir(lang)}/index.html`);
  }
}

const today = new Date().toISOString().slice(0, 10);
const sitemapUrls = [];
for (const route of routes) {
  for (const entry of LANGUAGES) {
    sitemapUrls.push({ ...route, lang: entry.code, loc: link(entry.code, route.path) });
  }
}

await writeFile(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapUrls
  .map(
    (url) =>
      `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url.freq}</changefreq>
    <priority>${url.priority}</priority>
${LANGUAGES.map(
  (entry) =>
    `    <xhtml:link rel="alternate" hreflang="${entry.locale}" href="${link(entry.code, url.path)}"/>`,
).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${link(DEFAULT_LANGUAGE, url.path)}"/>
  </url>`,
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

console.log(`generated ${written.length} files for ${apps.length} tools in ${LANGUAGES.length} languages`);
console.log(`sitemap: ${sitemapUrls.length} urls (${routes.length} routes x ${LANGUAGES.length} languages)`);
