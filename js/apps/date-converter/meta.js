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
  i18n: {
    de: { name: 'Datum & Zeit', tagline: 'Unix-Zeitstempel, ISO 8601 und relative Zeit' },
    es: { name: 'Fecha y hora', tagline: 'Marcas de tiempo Unix, ISO 8601 y tiempo relativo' },
    zh: { name: '日期与时间', tagline: 'Unix 时间戳、ISO 8601 与相对时间' },
  },
  load: () => import('./index.js'),
};
