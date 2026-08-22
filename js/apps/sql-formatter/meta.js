export default {
  id: "sql-formatter",
  name: "SQL Formatter",
  tagline: "Readable formatting for SQL statements",
  category: "development",
  glyph: "SQL",
  icon: "database",
  tint: "#16a34a",
  keywords: ["sql","format","query","pretty","database"],
  tag: "jg-app-sql-formatter",
  i18n: {
    de: { name: 'SQL-Formatierer', tagline: 'Lesbare Formatierung für SQL-Anweisungen' },
    es: { name: 'Formateador SQL', tagline: 'Formato legible para sentencias SQL' },
    zh: { name: 'SQL 格式化', tagline: '让 SQL 语句易读的排版' },
  },
  load: () => import('./index.js'),
};
