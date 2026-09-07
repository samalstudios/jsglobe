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
  load: () => import('./index.js'),
};
