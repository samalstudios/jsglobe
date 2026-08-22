export default {
  id: "periodic-table",
  name: "Periodic Table",
  tagline: "All 118 elements with full properties",
  category: "science",
  glyph: "H",
  icon: "element",
  tint: "#3f6b6b",
  keywords: ["element","chemistry","periodic","atomic","science","mendeleev"],
  tag: "jg-app-periodic-table",
  widget: true,
  window: {"width":1080,"height":860,"maximized":true},
  i18n: {
    de: { name: 'Periodensystem', tagline: 'Alle 118 Elemente mit allen Eigenschaften' },
    es: { name: 'Tabla periódica', tagline: 'Los 118 elementos con todas sus propiedades' },
    zh: { name: '元素周期表', tagline: '全部 118 种元素及完整属性' },
  },
  load: () => import('./index.js'),
};
