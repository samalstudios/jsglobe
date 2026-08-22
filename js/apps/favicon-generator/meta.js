export default {
  id: "favicon-generator",
  name: "Favicon Maker",
  tagline: "Every icon size, an .ico and the manifest",
  category: "media",
  glyph: "★",
  icon: "favicon",
  keywords: ["favicon","icon","ico","apple touch","manifest","pwa","app icon"],
  tag: "jg-app-favicon-generator",
  window: {"width":1040,"height":860},
  i18n: {
    de: { name: 'Favicon-Maker', tagline: 'Alle Symbolgrößen, eine .ico und das Manifest' },
    es: { name: 'Creador de favicon', tagline: 'Todos los tamaños de icono, un .ico y el manifiesto' },
    zh: { name: '图标生成', tagline: '所有图标尺寸、一个 .ico 和 manifest' },
  },
  load: () => import('./index.js'),
};
