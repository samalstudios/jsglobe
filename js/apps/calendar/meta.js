export default {
  id: "calendar",
  name: "Calendar",
  tagline: "Month view with events saved per workspace",
  category: "utility",
  glyph: "▤",
  icon: "calendar",
  tint: "#ef4444",
  keywords: ["calendar","month","date","events","schedule","agenda"],
  tag: "jg-app-calendar",
  widget: true,
  load: () => import('./index.js'),
};
