export default {
  id: "regex-tester",
  name: "Regex Tester",
  tagline: "Test patterns with live matches and groups",
  category: "development",
  glyph: ".*",
  icon: "regex",
  tint: "#059669",
  keywords: ["regex","regexp","pattern","match","test"],
  tag: "jg-app-regex",
  load: () => import('./index.js'),
};
