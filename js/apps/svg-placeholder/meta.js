export default {
  id: "svg-placeholder",
  name: "Placeholder SVG",
  tagline: "Generate placeholder images as inline SVG",
  category: "media",
  glyph: "▢",
  icon: "frame",
  keywords: ["placeholder","svg","image","mockup","dummy","data uri"],
  tag: "jg-app-svg-placeholder",
  window: {"width":860,"height":900},
  i18n: {
    de: { name: 'Platzhalter-SVG', tagline: 'Platzhalterbilder als Inline-SVG erzeugen' },
    es: { name: 'SVG de relleno', tagline: 'Generar imágenes de relleno como SVG en línea' },
    zh: { name: '占位 SVG', tagline: '生成内联 SVG 占位图' },
  },
  load: () => import('./index.js'),
};
