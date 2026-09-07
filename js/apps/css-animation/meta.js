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
  load: () => import('./index.js'),
};
