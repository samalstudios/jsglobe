export default {
  id: "icon-studio",
  name: "Icon Studio",
  tagline: "Build an icon from thousands of parts, or describe one",
  category: "media",
  glyph: "◈",
  icon: "swatches",
  tint: "#7c5cff",
  keywords: ["icon", "svg", "logo", "symbol", "design", "generator", "mark", "favicon"],
  tag: "jg-app-icon-studio",
  window: { width: 1120, height: 780 },
  i18n: {
    de: { name: 'Icon-Studio', tagline: 'Ein Icon aus tausenden Bauteilen bauen oder beschreiben' },
    es: { name: 'Estudio de iconos', tagline: 'Crea un icono con miles de piezas, o descríbelo' },
    zh: { name: '图标工作室', tagline: '用数千个部件拼出图标，或者直接描述它' },
  },
  load: () => import('./index.js'),
};
