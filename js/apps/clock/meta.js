export default {
  id: "clock",
  name: "Clock",
  tagline: "World clocks, stopwatch and countdown timer",
  category: "utility",
  glyph: "◷",
  icon: "clock",
  tint: "#0ea5e9",
  keywords: ["clock","time","timezone","stopwatch","timer","world"],
  tag: "jg-app-clock",
  widget: true,
  load: () => import('./index.js'),
};
