export default {
  id: "calendar",
  name: "Calendar",
  tagline: "Month view with events saved per workspace",
  category: "utility",
  glyph: "▤",
  icon: "calendar",
  tint: "#ef4444",
  keywords: ["calendar","month","date","events","schedule","agenda"],
  tag: "jg-app-calendar",
  widget: true,
  i18n: {
    de: { name: 'Kalender', tagline: 'Monatsansicht mit Terminen pro Arbeitsbereich' },
    es: { name: 'Calendario', tagline: 'Vista mensual con eventos guardados por espacio' },
    zh: { name: '日历', tagline: '按工作区保存日程的月视图' },
  },
  load: () => import('./index.js'),
};
