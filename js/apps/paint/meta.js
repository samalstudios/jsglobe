export default {
  id: "paint",
  name: "Paint",
  tagline: "Pencil, shapes, fill and spray on a canvas",
  category: "media",
  glyph: "✎",
  icon: "bucket",
  tint: "#8a1c3b",
  keywords: ["paint","draw","canvas","pixel","sketch","bitmap","image"],
  tag: "jg-app-paint",
  window: {"width":1040,"height":760,"maximized":true},
  i18n: {
    de: { name: 'Malen', tagline: 'Stift, Formen, Füllen und Sprühdose auf einer Leinwand' },
    es: { name: 'Pintura', tagline: 'Lápiz, formas, relleno y spray sobre un lienzo' },
    zh: { name: '画板', tagline: '在画布上使用铅笔、形状、填充与喷枪' },
  },
  load: () => import('./index.js'),
};
