export default {
  id: "css-animation",
  name: "CSS Animation",
  tagline: "Keyframe presets with a cubic-bezier editor",
  category: "web",
  glyph: "◠",
  icon: "motion",
  keywords: ["css","animation","keyframes","easing","cubic-bezier","transition","motion"],
  tag: "jg-app-css-animation",
  window: {"width":820,"height":900},
  i18n: {
    de: { name: 'CSS-Animation', tagline: 'Keyframe-Vorlagen mit einem Cubic-Bezier-Editor' },
    es: { name: 'Animación CSS', tagline: 'Plantillas de keyframes con un editor cubic-bezier' },
    zh: { name: 'CSS 动画', tagline: '关键帧预设与三次贝塞尔编辑器' },
  },
  load: () => import('./index.js'),
};
