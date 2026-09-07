export default {
  id: "gitignore-generator",
  name: "GitIgnore Generator",
  tagline: "Build a .gitignore from the tools you use",
  category: "development",
  glyph: "🚫",
  icon: "gitCompare",
  tint: "#64748b",
  keywords: ["gitignore","git","ignore","repository","vcs","scm","boilerplate"],
  tag: "jg-app-gitignore-generator",
  window: { width: 1120, height: 820 },
  load: () => import('./index.js'),
};
