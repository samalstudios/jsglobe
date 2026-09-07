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
  load: () => import('./index.js'),
};
