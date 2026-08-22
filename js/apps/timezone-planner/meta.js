export default {
  id: "timezone-planner",
  name: "Time Zones",
  tagline: "Line up cities and find the overlapping hours",
  category: "utility",
  glyph: "TZ",
  icon: "planner",
  keywords: ["timezone","time zone","meeting","planner","utc","schedule","world clock"],
  tag: "jg-app-timezone-planner",
  window: {"width":1080,"height":780},
  i18n: {
    de: { name: 'Zeitzonen', tagline: 'Städte vergleichen und gemeinsame Stunden finden' },
    es: { name: 'Zonas horarias', tagline: 'Alinear ciudades y encontrar las horas comunes' },
    zh: { name: '时区', tagline: '对齐各城市并找出重叠的时段' },
  },
  load: () => import('./index.js'),
};
