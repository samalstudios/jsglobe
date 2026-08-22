export default {
  id: "hash-text",
  name: "Hash Text",
  tagline: "MD5, SHA-1, SHA-256, SHA-512 digests",
  category: "crypto",
  glyph: "#",
  icon: "hash",
  tint: "#8b5cf6",
  keywords: ["hash","md5","sha","sha256","checksum","digest"],
  tag: "jg-app-hash-text",
  widget: true,
  i18n: {
    de: { name: 'Text-Hash', tagline: 'MD5-, SHA-1-, SHA-256- und SHA-512-Prüfsummen' },
    es: { name: 'Hash de texto', tagline: 'Resúmenes MD5, SHA-1, SHA-256 y SHA-512' },
    zh: { name: '文本哈希', tagline: 'MD5、SHA-1、SHA-256、SHA-512 摘要' },
  },
  load: () => import('./index.js'),
};
