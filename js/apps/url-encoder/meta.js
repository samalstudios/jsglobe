export default {
  id: "url-encoder",
  name: "URL Encode",
  tagline: "Percent-encode and decode URL components",
  category: "web",
  glyph: "%",
  icon: "percent",
  tint: "#0ea5e9",
  keywords: ["url","encode","decode","percent","uri"],
  tag: "jg-app-url-encoder",
  i18n: {
    de: { name: 'URL kodieren', tagline: 'URL-Bestandteile prozentkodieren und dekodieren' },
    es: { name: 'Codificar URL', tagline: 'Codificar y decodificar componentes de una URL' },
    zh: { name: 'URL 编码', tagline: '对 URL 片段进行百分号编码和解码' },
  },
  load: () => import('./index.js'),
};
