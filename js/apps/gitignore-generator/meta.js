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
  i18n: {
    de: { name: 'GitIgnore-Generator', tagline: '.gitignore aus den verwendeten Werkzeugen bauen' },
    es: { name: 'Generador de GitIgnore', tagline: 'Crear un .gitignore a partir de tus herramientas' },
    zh: { name: 'GitIgnore 生成器', tagline: '根据所用工具生成 .gitignore' },
  },
  load: () => import('./index.js'),
};
