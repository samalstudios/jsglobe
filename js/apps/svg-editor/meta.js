export default {
  id: "svg-editor",
  name: "SVG Studio",
  tagline: "View, clean, recolour and export SVG",
  category: "media",
  glyph: "SVG",
  icon: "vector",
  tint: "#e11d48",
  keywords: ["svg","vector","viewer","editor","optimise","optimize","icon","minify","png"],
  tag: "jg-app-svg-editor",
  window: {"width":1080,"height":860,"maximized":true},
  i18n: {
    de: { name: 'SVG-Studio', tagline: 'SVG ansehen, säubern, umfärben und exportieren' },
    es: { name: 'SVG Studio', tagline: 'Ver, limpiar, recolorear y exportar SVG' },
    zh: { name: 'SVG 工作台', tagline: '查看、清理、改色并导出 SVG' },
  },
  load: () => import('./index.js'),
};
