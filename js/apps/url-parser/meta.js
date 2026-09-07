export default {
  id: "url-parser",
  name: "URL Parser",
  tagline: "Break a URL into its parts and query params",
  category: "web",
  glyph: "⋔",
  icon: "link",
  tint: "#0284c7",
  keywords: ["url","parse","query","params","host"],
  tag: "jg-app-url-parser",
  load: () => import('./index.js'),
};
