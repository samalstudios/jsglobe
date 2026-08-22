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
  i18n: {
    de: { name: 'Crontab', tagline: 'Cron-Ausdrücke erklären und nächste Läufe anzeigen' },
    es: { name: 'Crontab', tagline: 'Explicar expresiones cron y ver las próximas ejecuciones' },
    zh: { name: 'Crontab', tagline: '解释 cron 表达式并预览下次运行' },
  },
  load: () => import('./index.js'),
};
