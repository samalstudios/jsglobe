export default {
  id: "css-gradient",
  name: "Gradient Maker",
  tagline: "Build CSS gradients with draggable colour stops",
  category: "web",
  glyph: "▞",
  icon: "gradient",
  keywords: ["css","gradient","linear","radial","conic","background","colour","color"],
  tag: "jg-app-css-gradient",
  window: {"width":780,"height":860},
  i18n: {
    de: { name: 'Verlauf-Maker', tagline: 'CSS-Verläufe mit ziehbaren Farbstopps bauen' },
    es: { name: 'Creador de degradados', tagline: 'Crear degradados CSS con paradas de color arrastrables' },
    zh: { name: '渐变生成', tagline: '用可拖动的色标构建 CSS 渐变' },
  },
  load: () => import('./index.js'),
};
