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
  load: () => import('./index.js'),
};
