export default {
  id: "optics-lab",
  name: "Optics Lab",
  tagline: "Lenses, mirrors and prisms with real ray tracing",
  category: "science",
  glyph: "◐",
  icon: "flask",
  tint: "#3aa6d8",
  keywords: ["optics", "light", "lens", "mirror", "prism", "refraction", "physics", "ray", "rainbow"],
  tag: "jg-app-optics-lab",
  window: { width: 1120, height: 780 },
  i18n: {
    de: { name: 'Optiklabor', tagline: 'Linsen, Spiegel und Prismen mit echter Strahlverfolgung' },
    es: { name: 'Laboratorio de óptica', tagline: 'Lentes, espejos y prismas con trazado de rayos real' },
    zh: { name: '光学实验室', tagline: '透镜、反射镜与棱镜，真实光线追踪' },
  },
  load: () => import('./index.js'),
};
