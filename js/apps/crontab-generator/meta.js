export default {
  id: "crontab-generator",
  name: "Crontab",
  tagline: "Explain cron expressions and preview next runs",
  category: "development",
  glyph: "✳",
  icon: "repeat",
  tint: "#4d7c0f",
  keywords: ["cron","crontab","schedule","job","timer"],
  tag: "jg-app-crontab",
  load: () => import('./index.js'),
};
