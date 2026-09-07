export default {
  id: "date-converter",
  name: "Date & Time",
  tagline: "Unix timestamps, ISO 8601 and relative time",
  category: "converter",
  glyph: "⌚",
  icon: "clock",
  tint: "#ea580c",
  keywords: ["date","time","unix","epoch","timestamp","iso"],
  tag: "jg-app-date",
  widget: true,
  load: () => import('./index.js'),
};
