export default {
  id: "todo",
  name: "Tasks",
  tagline: "A lightweight checklist per workspace",
  category: "utility",
  glyph: "✓",
  icon: "checkSquare",
  tint: "#16a34a",
  keywords: ["todo","task","checklist","done"],
  tag: "jg-app-todo",
  widget: true,
  i18n: {
    de: { name: 'Aufgaben', tagline: 'Eine leichte Checkliste pro Arbeitsbereich' },
    es: { name: 'Tareas', tagline: 'Una lista de comprobación ligera por espacio de trabajo' },
    zh: { name: '任务', tagline: '每个工作区一份轻量清单' },
  },
  load: () => import('./index.js'),
};
