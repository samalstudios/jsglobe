export default {
  id: "html-entities",
  name: "HTML Entities",
  tagline: "Escape and unescape HTML entities",
  category: "web",
  glyph: "&",
  icon: "ampersand",
  tint: "#0369a1",
  keywords: ["html","entities","escape","unescape","amp"],
  tag: "jg-app-html-entities",
  i18n: {
    de: { name: 'HTML-Entities', tagline: 'HTML-Entities maskieren und demaskieren' },
    es: { name: 'Entidades HTML', tagline: 'Escapar y desescapar entidades HTML' },
    zh: { name: 'HTML 实体', tagline: '转义与还原 HTML 实体' },
  },
  load: () => import('./index.js'),
};
