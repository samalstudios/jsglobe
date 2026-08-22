export default {
  id: "url-parser",
  name: "URL Parser",
  tagline: "Break a URL into its parts and query params",
  category: "web",
  glyph: "⋔",
  icon: "link",
  tint: "#0284c7",
  keywords: ["url","parse","query","params","host"],
  tag: "jg-app-url-parser",
  i18n: {
    de: { name: 'URL-Parser', tagline: 'Eine URL in ihre Teile und Query-Parameter zerlegen' },
    es: { name: 'Analizador de URL', tagline: 'Dividir una URL en sus partes y parámetros' },
    zh: { name: 'URL 解析', tagline: '把 URL 拆成各个部分与查询参数' },
  },
  load: () => import('./index.js'),
};
