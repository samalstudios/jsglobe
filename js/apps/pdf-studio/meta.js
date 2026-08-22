export default {
  id: "pdf-studio",
  name: "PDF Studio",
  tagline: "Merge, split, rotate and convert PDFs",
  category: "converter",
  glyph: "P",
  icon: "file",
  tint: "#96703f",
  keywords: ["pdf","merge","split","rotate","convert","image","png","extract","text","combine"],
  tag: "jg-app-pdf-studio",
  window: {"width":1080,"height":800,"maximized":true},
  i18n: {
    de: { name: 'PDF-Studio', tagline: 'PDFs zusammenführen, teilen, drehen und umwandeln' },
    es: { name: 'PDF Studio', tagline: 'Unir, dividir, rotar y convertir PDF' },
    zh: { name: 'PDF 工作台', tagline: '合并、拆分、旋转并转换 PDF' },
  },
  load: () => import('./index.js'),
};
