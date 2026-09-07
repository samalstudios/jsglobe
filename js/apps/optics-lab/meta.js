export default {
  id: "optics-lab",
  name: "Optics Lab",
  tagline: "Lenses, mirrors and prisms with real ray tracing",
  category: "science",
  glyph: "◐",
  icon: "prismLight",
  tint: "#3aa6d8",
  keywords: ["optics", "light", "lens", "mirror", "prism", "refraction", "physics", "ray", "rainbow"],
  tag: "jg-app-optics-lab",
  window: { width: 1120, height: 780 },
  load: () => import('./index.js'),
};
